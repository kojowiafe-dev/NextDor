/**
 * Auth Service — Core Domain Logic for Authentication.
 *
 * DESIGN PATTERN: Domain Service / Clean Architecture Use Case
 * ─────────────────────────────────────────────────────────────
 * Encapsulates password hashing (bcrypt), JWT access token issuance,
 * opaque refresh token rotation, and family-based theft detection.
 *
 * DEPENDENCY INVERSION (SOLID - D):
 * Injected with UserRepository via constructor injection.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../../lib/errors.js";
import { UserRepository } from "./user.repository.js";
import type { User } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = Pick<User, "id" | "email" | "name" | "phone" | "role" | "vendorId">;

// ─── Token helpers ─────────────────────────────────────────────────────────────

function signAccessToken(userId: string, role: string, vendorId?: string | null): string {
  return jwt.sign(
    { sub: userId, role, ...(vendorId ? { vendorId } : {}) },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(64).toString("hex"); // 128 hex chars = 512 bits
}

function verifyAccessToken(token: string): { sub: string; role: string; vendorId?: string } {
  try {
    return jwt.verify(token, config.JWT_SECRET) as { sub: string; role: string; vendorId?: string };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

// ─── Auth Service Class ───────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  /**
   * Static helper for token verification.
   */
  public static verifyAccessToken = verifyAccessToken;
  public static signAccessToken = signAccessToken;

  /**
   * Register a new customer account.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const passwordHash = await bcrypt.hash(input.password, 12);

    let user: User;
    try {
      user = await this.userRepo.create({
        name: input.name,
        email: input.email.toLowerCase().trim(),
        phone: input.phone,
        passwordHash,
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictError("An account with this email already exists");
      }
      throw err;
    }

    const tokens = await this._issueTokens(user.id);
    logger.info({ userId: user.id }, "auth: new user registered");
    return { user: this._safeUser(user), tokens };
  }

  /**
   * Authenticate with email + password.
   */
  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await this.userRepo.findByEmail(input.email);

    // Constant-time comparison padding against timing attacks
    const passwordToCheck = user?.passwordHash ?? "$2b$12$invalidhashpadding";
    const valid = await bcrypt.compare(input.password, passwordToCheck);

    if (!user || !valid || user.deletedAt) {
      throw new UnauthorizedError("Email or password is incorrect");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedError("Your account has been suspended. Contact support.");
    }

    const tokens = await this._issueTokens(user.id);
    logger.info({ userId: user.id }, "auth: user logged in");
    return { user: this._safeUser(user), tokens };
  }

  /**
   * Exchange a refresh token for a new access + refresh pair (Family Rotation).
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const user = await import("../../lib/prisma.js").then(({ prisma }) =>
      prisma.refreshToken.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      })
    );

    let matched: any = null;
    for (const token of user) {
      if (await bcrypt.compare(rawRefreshToken, token.tokenHash)) {
        matched = token;
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Check if this family has any revoked tokens (= replay attack detected)
    const familyHasRevoked = await import("../../lib/prisma.js").then(({ prisma }) =>
      prisma.refreshToken.findFirst({
        where: { family: matched.family, revokedAt: { not: null } },
      })
    );

    if (familyHasRevoked) {
      await this.userRepo.revokeTokenFamily(matched.family);
      logger.warn(
        { userId: matched.userId, family: matched.family },
        "auth: refresh token replay detected — family revoked"
      );
      throw new UnauthorizedError("Session invalidated. Please log in again.");
    }

    // Revoke current token
    await this.userRepo.revokeTokenById(matched.id);

    // Issue new token pair in the same family
    const tokens = await this._issueTokens(matched.userId, matched.family);
    logger.info({ userId: matched.userId }, "auth: tokens refreshed");
    return tokens;
  }

  /**
   * Revoke a refresh token (device logout).
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokens = await import("../../lib/prisma.js").then(({ prisma }) =>
      prisma.refreshToken.findMany({
        where: { revokedAt: null },
      })
    );

    for (const token of tokens) {
      if (await bcrypt.compare(rawRefreshToken, token.tokenHash)) {
        await this.userRepo.revokeTokenById(token.id);
        logger.info({ userId: token.userId }, "auth: user logged out");
        return;
      }
    }
  }

  /**
   * Internal helper: Issues token pair and cleans up expired tokens.
   */
  async _issueTokens(userId: string, existingFamily?: string): Promise<AuthTokens> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const accessToken = signAccessToken(userId, user.role, user.vendorId);
    const refreshToken = generateOpaqueToken();
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.userRepo.saveRefreshToken({
      userId,
      tokenHash,
      family: existingFamily ?? crypto.randomUUID(),
      expiresAt,
    });

    await this.userRepo.deleteExpiredTokens(userId);

    return { accessToken, refreshToken };
  }

  /**
   * Sanitizes User model to strip passwordHash before returning to clients.
   */
  _safeUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      vendorId: user.vendorId,
    };
  }
}

// Export default singleton instance
export const authService = new AuthService(new UserRepository());
