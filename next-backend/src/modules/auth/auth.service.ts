/**
 * Auth Service — Core Domain Logic for Authentication.
 *
 * DESIGN PATTERN: Domain Service / Clean Architecture Use Case
 * ─────────────────────────────────────────────────────────────
 * Encapsulates password hashing (bcrypt), JWT access token issuance,
 * opaque refresh token rotation, email verification OTPs, and password recovery.
 *
 * KEY FIXES APPLIED:
 * ─────────────────────────────────────────────────────────────
 * Fix #1  — O(1) refresh token lookup via SHA-256 + bcrypt dual-hash strategy.
 * Fix #15 — verifyEmail throws BadRequestError on already-verified instead of
 *            silently issuing new tokens (was an account takeover vector).
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
  BadRequestError,
} from "../../lib/errors.js";
import { UserRepository } from "./user.repository.js";
import { EmailService } from "../../lib/email.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import type { User } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = Pick<User, "id" | "email" | "name" | "phone" | "role" | "vendorId">;

// ─── Token helpers ─────────────────────────────────────────────────────────────

function signAccessToken(userId: string, role: string, email?: string, vendorId?: string | null): string {
  return jwt.sign(
    { sub: userId, role, ...(email ? { email } : {}), ...(vendorId ? { vendorId } : {}) },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * FIX #1 — O(1) Token Lookup via SHA-256 Fingerprint.
 *
 * WHY TWO HASHES?
 * ─────────────────────────────────────────────────────────────
 * - `tokenHash` (bcrypt):   Slow, salted, tamper-proof — the security guard.
 *   Cannot be used as a DB lookup key because bcrypt includes a random salt,
 *   so the same raw token always produces a DIFFERENT hash each time.
 *
 * - `lookupHash` (SHA-256): Fast, deterministic — the search key.
 *   SHA-256(rawToken) always produces the SAME output for the same input,
 *   so we can store it as a @unique DB index and do a O(1) findUnique().
 *
 * HOW IT WORKS:
 *   On save:    hash(raw, bcrypt) → tokenHash; sha256(raw) → lookupHash
 *   On lookup:  sha256(incoming) → findUnique(lookupHash) → one bcrypt.compare
 *
 * BEFORE FIX (the bug):
 *   refresh() called findMany({ revokedAt: null }) → loaded ALL active tokens.
 *   Then looped and ran bcrypt.compare() on EACH. With 10,000 users = 10,000
 *   bcrypt calls × 100ms each = system halted. O(N) disaster.
 *
 * AFTER FIX:
 *   sha256(incoming) → findUnique(lookupHash) → O(1) indexed DB lookup.
 *   One single bcrypt.compare(). O(1) regardless of user count.
 */
function makeLookupHash(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function verifyAccessToken(token: string): { sub: string; role: string; email?: string; vendorId?: string } {
  try {
    return jwt.verify(token, config.JWT_SECRET) as { sub: string; role: string; email?: string; vendorId?: string };
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
   * Register a new customer account and dispatch a 6-digit email verification code.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ user: AuthUser; requiresVerification: boolean; email: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    let user: User;
    try {
      user = await this.userRepo.create({
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone,
        passwordHash,
        emailVerified: false,
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictError("An account with this email already exists");
      }
      throw err;
    }

    // Generate 6-digit OTP code
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.userRepo.createAuthCode({
      email: normalizedEmail,
      codeHash,
      type: "VERIFY_EMAIL",
      expiresAt,
    });

    // FIX #13: Send verification email asynchronously via queue (non-blocking)
    await dispatchEmailAsync({
      type: "verification",
      email: normalizedEmail,
      name: user.name,
      code,
    });
    logger.info({ userId: user.id, email: normalizedEmail }, "auth: verification code dispatched on register");

    return {
      user: this._safeUser(user),
      requiresVerification: true,
      email: normalizedEmail,
    };
  }

  /**
   * Verifies the 6-digit OTP code, marks emailVerified = true, and issues login tokens.
   */
  async verifyEmail(input: {
    email: string;
    code: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError("Account not found");
    }

    // FIX #15: Don't silently issue tokens for already-verified accounts.
    // Original code issued new login tokens for ANY already-verified email
    // without checking the code at all — an attacker who knows a victim's email
    // could call this endpoint to get valid tokens for that user's account.
    // Correct behaviour: email already verified → direct them to login.
    if (user.emailVerified) {
      throw new BadRequestError("Email already verified. Please log in instead.");
    }

    const authCode = await this.userRepo.findLatestValidAuthCode(normalizedEmail, "VERIFY_EMAIL");
    if (!authCode) {
      throw new BadRequestError("Verification code has expired or is invalid. Please request a new code.");
    }

    if (authCode.attempts >= 5) {
      throw new BadRequestError("Too many incorrect attempts. Please request a new verification code.");
    }

    const isValid = await bcrypt.compare(input.code, authCode.code_hash);
    if (!isValid) {
      await this.userRepo.incrementAuthCodeAttempts(authCode.id);
      throw new BadRequestError("Invalid verification code. Please check and try again.");
    }

    // Mark code used and user as verified
    await this.userRepo.markAuthCodeUsed(authCode.id);
    const updatedUser = await this.userRepo.markEmailVerified(user.id);

    const tokens = await this._issueTokens(updatedUser.id);
    logger.info({ userId: updatedUser.id, email: normalizedEmail }, "auth: email verified successfully");

    return { user: this._safeUser(updatedUser), tokens };
  }

  /**
   * Resends a 6-digit verification code with a 60-second cooldown rate limit.
   */
  async resendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError("Account not found");
    }

    if (user.emailVerified) {
      throw new BadRequestError("This email address is already verified. You can log in.");
    }

    // Enforce 60-second cooldown
    const recent = await this.userRepo.findRecentAuthCode(normalizedEmail, "VERIFY_EMAIL", 60);
    if (recent) {
      throw new BadRequestError("Please wait at least 60 seconds before requesting a new verification code.");
    }

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.userRepo.createAuthCode({
      email: normalizedEmail,
      codeHash,
      type: "VERIFY_EMAIL",
      expiresAt,
    });

    // FIX #13: Asynchronously dispatch verification email
    await dispatchEmailAsync({
      type: "verification",
      email: normalizedEmail,
      name: user.name,
      code,
    });
    logger.info({ email: normalizedEmail }, "auth: verification code resent");

    return {
      success: true,
      message: "A new 6-digit verification code has been sent to your email.",
    };
  }

  /**
   * Sends a 6-digit password reset recovery code to the user's email.
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (user && !user.deletedAt) {
      // 60-second cooldown
      const recent = await this.userRepo.findRecentAuthCode(normalizedEmail, "RESET_PASSWORD", 60);
      if (!recent) {
        const code = generateOtp();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await this.userRepo.createAuthCode({
          email: normalizedEmail,
          codeHash,
          type: "RESET_PASSWORD",
          expiresAt,
        });

        // FIX #13: Asynchronously dispatch password reset email
        await dispatchEmailAsync({
          type: "password_reset",
          email: normalizedEmail,
          name: user.name,
          code,
        });
        logger.info({ email: normalizedEmail }, "auth: password reset code dispatched");
      }
    }

    // Always return generic success to prevent account enumeration
    return {
      success: true,
      message: "If an account exists with this email address, a password reset code has been sent.",
    };
  }

  /**
   * Validates reset code, updates password, and revokes all active session tokens.
   */
  async resetPassword(input: {
    email: string;
    code: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user || user.deletedAt) {
      throw new NotFoundError("Account not found");
    }

    const authCode = await this.userRepo.findLatestValidAuthCode(normalizedEmail, "RESET_PASSWORD");
    if (!authCode) {
      throw new BadRequestError("Reset code has expired or is invalid. Please request a new code.");
    }

    if (authCode.attempts >= 5) {
      throw new BadRequestError("Too many incorrect attempts. Please request a new reset code.");
    }

    const isValid = await bcrypt.compare(input.code, authCode.code_hash);
    if (!isValid) {
      await this.userRepo.incrementAuthCodeAttempts(authCode.id);
      throw new BadRequestError("Invalid reset code. Please check and try again.");
    }

    // Update password
    const passwordHash = await bcrypt.hash(input.password, 12);
    await this.userRepo.updatePassword(user.id, passwordHash);

    // Mark code used & revoke all sessions
    await this.userRepo.markAuthCodeUsed(authCode.id);
    await this.userRepo.revokeAllUserTokens(user.id);

    logger.info({ userId: user.id, email: normalizedEmail }, "auth: password reset successfully");

    return {
      success: true,
      message: "Your password has been reset successfully. Please sign in with your new password.",
    };
  }

  /**
   * Authenticate with email + password.
   */
  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    // Constant-time comparison padding against timing attacks
    const passwordToCheck = user?.passwordHash ?? "$2b$12$invalidhashpadding";
    const valid = await bcrypt.compare(input.password, passwordToCheck);

    if (!user || !valid || user.deletedAt) {
      throw new UnauthorizedError("Email or password is incorrect");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedError("Your account has been suspended. Contact support.");
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Automatically send a fresh verification code
      try {
        const code = generateOtp();
        const codeHash = await bcrypt.hash(code, 10);
        await this.userRepo.createAuthCode({
          email: normalizedEmail,
          codeHash,
          type: "VERIFY_EMAIL",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });
        await EmailService.sendVerificationCode(normalizedEmail, user.name, code);
      } catch (err) {
        logger.warn({ err }, "Could not auto-dispatch verification code on unverified login attempt");
      }

      const err: any = new UnauthorizedError("Please verify your email address before logging in. A new 6-digit code has been sent.");
      err.code = "EMAIL_NOT_VERIFIED";
      err.requiresVerification = true;
      err.email = normalizedEmail;
      throw err;
    }

    const tokens = await this._issueTokens(user.id);
    logger.info({ userId: user.id }, "auth: user logged in");
    return { user: this._safeUser(user), tokens };
  }

  /**
   * Exchange a refresh token for a new access + refresh pair (Family Rotation).
   *
   * FIX #1 — O(1) lookup via SHA-256 lookupHash.
   * Before: findMany(ALL active tokens) + bcrypt.compare on each = O(N).
   * After:  SHA-256(rawToken) → findUnique(lookupHash) = O(1) indexed lookup,
   *         then one single bcrypt.compare() to confirm authenticity.
   *
   * WHY still bcrypt.compare after SHA-256 lookup?
   * SHA-256 is fast but also easy to compute. If an attacker somehow reads the
   * lookupHash from DB, they still cannot reverse-engineer the raw token (SHA-256
   * is a one-way function for 256-bit entropy input). bcrypt.compare adds a second
   * layer: tamper-proof verification that the token truly matches. Belt + suspenders.
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const { prisma } = await import("../../lib/prisma.js");
    const lookupHash = makeLookupHash(rawRefreshToken);

    // O(1) indexed lookup — no table scan
    const matched = await prisma.refreshToken.findUnique({
      where: { lookupHash },
    });

    if (!matched || matched.revokedAt || matched.expiresAt <= new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Final verification: bcrypt confirms token was not tampered with
    const isValid = await bcrypt.compare(rawRefreshToken, matched.tokenHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Check if this family has any revoked tokens (= replay attack detected)
    const familyHasRevoked = await prisma.refreshToken.findFirst({
      where: { family: matched.family, revokedAt: { not: null } },
    });

    if (familyHasRevoked) {
      await this.userRepo.revokeTokenFamily(matched.family);
      logger.warn(
        { userId: matched.userId, family: matched.family },
        "auth: refresh token replay detected — entire family revoked"
      );
      throw new UnauthorizedError("Session invalidated due to suspicious activity. Please log in again.");
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
   *
   * FIX #1 — O(1) lookup via SHA-256 lookupHash.
   * Same dual-hash strategy: SHA-256 for fast lookup, bcrypt for verification.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const { prisma } = await import("../../lib/prisma.js");
    const lookupHash = makeLookupHash(rawRefreshToken);

    const token = await prisma.refreshToken.findUnique({
      where: { lookupHash },
    });

    if (token && !token.revokedAt) {
      // Verify before revoking (prevents logout-by-hash-guessing attacks)
      const isValid = await bcrypt.compare(rawRefreshToken, token.tokenHash);
      if (isValid) {
        await this.userRepo.revokeTokenById(token.id);
        logger.info({ userId: token.userId }, "auth: user logged out");
      }
    }
    // Logout is idempotent: if token not found or already revoked, succeed silently
  }

  /**
   * Internal helper: Issues token pair and cleans up expired tokens.
   *
   * FIX #1 — Now stores BOTH hashes:
   * - lookupHash: SHA-256(rawToken) → unique index → O(1) DB lookup
   * - tokenHash:  bcrypt(rawToken)  → tamper-proof verification
   */
  async _issueTokens(userId: string, existingFamily?: string): Promise<AuthTokens> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const accessToken = signAccessToken(userId, user.role, user.email, user.vendorId);
    const refreshToken = generateOpaqueToken();

    // Compute both hashes from the raw token
    const tokenHash  = await bcrypt.hash(refreshToken, 10);      // slow, salted — for verification
    const lookupHash = makeLookupHash(refreshToken);              // fast, deterministic — for lookup

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.userRepo.saveRefreshToken({
      userId,
      tokenHash,
      lookupHash,
      family: existingFamily ?? crypto.randomUUID(),
      expiresAt,
    });

    await this.userRepo.deleteExpiredTokens(userId);
    // FIX #16: Prune expired OTPs in background
    this.userRepo.deleteExpiredAuthCodes().catch(() => {});

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
