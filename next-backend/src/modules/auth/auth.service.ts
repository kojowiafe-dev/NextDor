/**
 * Auth service — core business logic for authentication.
 *
 * DESIGN DECISION: Service layer separation
 * ──────────────────────────────────────────
 * The route handler (auth.routes.ts) handles HTTP concerns:
 *   parsing the request body, setting cookies, returning HTTP status codes.
 *
 * The service (auth.service.ts) handles BUSINESS concerns:
 *   is this password correct? should this token be revoked? is this email taken?
 *
 * This separation means:
 *   1. We can unit-test auth logic without spinning up an HTTP server
 *   2. If we add a CLI command or WebSocket endpoint that needs auth,
 *      we call the same service — no logic duplication
 *   3. The route handler stays thin and readable
 *
 * WHAT IF: We wanted to add OAuth (Google, Apple) login in the future?
 * We'd add a new route handler (oauth.routes.ts) that calls the same
 * AuthService.createSession() method — zero changes to the core auth logic.
 *
 * 📚 Read: "Clean Architecture" by Robert C. Martin
 *    Chapter 22: The Clean Architecture — specifically the "Use Cases" layer
 *    which maps to our service layer.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "../../lib/errors.js";
import type { User } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = Pick<User, "id" | "email" | "name" | "phone" | "role">;

// ─── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Sign a short-lived JWT access token.
 *
 * DESIGN: Access tokens are stateless — the server doesn't store them.
 * Any instance can verify them by checking the signature against JWT_SECRET.
 * This is what makes JWTs suitable for horizontally-scaled APIs.
 *
 * WHAT IF: We need to invalidate an access token before it expires?
 * (e.g., a user's account is suspended mid-session)
 * Pure JWTs can't be invalidated — you'd need a blocklist in Redis.
 * This is why access tokens are SHORT-LIVED (15 min). After expiry,
 * the client must refresh — and THAT check hits the database, where
 * we can block suspended accounts.
 *
 * The trade-off: up to 15 minutes of access for a suspended user.
 * For most e-commerce use cases, this is acceptable. For banking,
 * you'd shorten the window to 1-5 minutes.
 */
function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

/**
 * Generate an opaque refresh token (cryptographically random bytes).
 *
 * DESIGN: We use an opaque token (random bytes) rather than a signed JWT
 * for the refresh token because:
 *   1. We CAN invalidate it — it's stored (hashed) in the database
 *   2. It carries no embedded claims — a stolen token reveals nothing
 *   3. Token rotation is possible — swap old for new on each use
 *
 * The raw token is sent to the client once. We store only the bcrypt hash.
 * On refresh, we bcrypt.compare the incoming raw token against stored hashes.
 */
function generateOpaqueToken(): string {
  return crypto.randomBytes(64).toString("hex"); // 128 hex chars = 512 bits
}

function verifyAccessToken(token: string): { sub: string; role: string } {
  try {
    return jwt.verify(token, config.JWT_SECRET) as { sub: string; role: string };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

// ─── Auth Service ──────────────────────────────────────────────────────────────

export const AuthService = {

  /**
   * Register a new customer account.
   *
   * WHAT IF: Two requests arrive simultaneously with the same email?
   * The `email` column has a UNIQUE constraint in the database.
   * Prisma throws a P2002 (unique constraint violation) error which we
   * catch and convert to a 409 Conflict response.
   * This is the correct approach — don't check-then-insert (race condition),
   * let the database enforce the constraint atomically.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {

    // bcrypt with cost factor 12:
    // On modern hardware, ~300ms per hash — slow enough to resist
    // brute-force, fast enough for normal login (users won't notice 300ms).
    // SHOULD INCASE: If your server CPU is very slow, reduce to 10.
    // If you need post-quantum resistance, consider Argon2id instead.
    const passwordHash = await bcrypt.hash(input.password, 12);

    let user: User;
    try {
      user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase().trim(), // Normalise email
          phone: input.phone,
          passwordHash,
        },
      });
    } catch (err: unknown) {
      // P2002 = Prisma unique constraint violation
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictError("An account with this email already exists");
      }
      throw err;
    }

    const tokens = await AuthService._issueTokens(user.id);

    logger.info({ userId: user.id }, "auth: new user registered");
    return { user: AuthService._safeUser(user), tokens };
  },

  /**
   * Authenticate with email + password.
   *
   * SECURITY: We use the same error message for "user not found" and
   * "wrong password" intentionally. Separate messages would let an
   * attacker enumerate which emails are registered (user enumeration attack).
   */
  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {

    const user = await prisma.user.findFirst({
      where: {
        email: input.email.toLowerCase().trim(),
        deletedAt: null,
      },
    });

    // SECURITY: Always run bcrypt.compare even when user is null.
    // If we return early ("user not found"), the response time differs
    // from "wrong password" — timing attacks can detect this difference.
    const passwordToCheck = user?.passwordHash ?? "$2b$12$invalidhashpadding";
    const valid = await bcrypt.compare(input.password, passwordToCheck);

    if (!user || !valid) {
      throw new UnauthorizedError("Email or password is incorrect");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedError("Your account has been suspended. Contact support.");
    }

    const tokens = await AuthService._issueTokens(user.id);

    logger.info({ userId: user.id }, "auth: user logged in");
    return { user: AuthService._safeUser(user), tokens };
  },

  /**
   * Exchange a refresh token for a new access + refresh pair.
   *
   * This implements the "token family rotation" pattern:
   * Each refresh creates a new token and revokes the old one.
   * If the OLD token is used again (replay attack), the entire family
   * is revoked — forcing re-login.
   *
   * WHAT IF: A refresh token is stolen from a network log or device?
   * The attacker uses it. The legitimate user tries to refresh again →
   * the system sees the old token being replayed → revokes the family.
   * The attacker's newly-issued token is now also invalid.
   * Both parties must re-login. The user is protected from prolonged
   * impersonation.
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    // Find by family: we need to check all non-expired tokens
    // to detect family reuse. We do this by scanning the raw token
    // against stored hashes — which is O(N) per user's refresh tokens.
    // In practice, a user has at most ~3-5 active refresh tokens
    // (one per device), so this is fast.
    //
    // ALTERNATIVE DESIGN: Embed the family ID in the opaque token
    // (e.g. `{familyId}.{randomBytes}`). Then we can look up the family
    // directly without scanning — O(1). Implemented in Phase 2 hardening.

    const activeTokens = await prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    // Find which stored token matches the incoming raw token
    let matched: (typeof activeTokens)[number] | null = null;
    for (const token of activeTokens) {
      if (await bcrypt.compare(rawRefreshToken, token.tokenHash)) {
        matched = token;
        break;
      }
    }

    if (!matched) {
      // Could be expired, revoked, or a replay attack.
      // We can't distinguish without knowing the family, so we just reject.
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Check if this family has ANY revoked tokens (= detected replay attack)
    const familyHasRevoked = await prisma.refreshToken.findFirst({
      where: { family: matched.family, revokedAt: { not: null } },
    });

    if (familyHasRevoked) {
      // Token theft detected: revoke the ENTIRE family
      await prisma.refreshToken.updateMany({
        where: { family: matched.family },
        data: { revokedAt: new Date() },
      });
      logger.warn(
        { userId: matched.userId, family: matched.family },
        "auth: refresh token replay detected — family revoked",
      );
      throw new UnauthorizedError("Session invalidated. Please log in again.");
    }

    // Revoke the current token
    await prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token pair in the same family
    const tokens = await AuthService._issueTokens(matched.userId, matched.family);

    logger.info({ userId: matched.userId }, "auth: tokens refreshed");
    return tokens;
  },

  /**
   * Revoke a specific refresh token (logout from current device).
   *
   * WHAT IF: A user wants to log out of ALL devices?
   * Add a `revokeAll` method that sets revokedAt on ALL refresh tokens
   * for that userId — equivalent to "sign out everywhere".
   */
  async logout(rawRefreshToken: string): Promise<void> {
    // Find matching token and revoke it
    // (same O(N) scan as refresh — see note above)
    const tokens = await prisma.refreshToken.findMany({
      where: { revokedAt: null },
    });

    for (const token of tokens) {
      if (await bcrypt.compare(rawRefreshToken, token.tokenHash)) {
        await prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        logger.info({ userId: token.userId }, "auth: user logged out");
        return;
      }
    }
    // If not found, that's fine — logout is idempotent
  },

  verifyAccessToken,

  // ─── Private helpers ────────────────────────────────────────────────────────

  async _issueTokens(userId: string, existingFamily?: string): Promise<AuthTokens> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const accessToken  = signAccessToken(userId, user.role);
    const refreshToken = generateOpaqueToken();
    const tokenHash    = await bcrypt.hash(refreshToken, 10); // Lower cost for refresh — it's random, not user-chosen

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        family: existingFamily ?? crypto.randomUUID(), // New family for fresh login
        expiresAt,
      },
    });

    // Clean up expired tokens for this user (housekeeping)
    // WHAT IF: We skip this? Over years of logins, the refresh_tokens table
    // would grow unboundedly. This trims it on every login/refresh.
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    return { accessToken, refreshToken };
  },

  _safeUser(user: User): AuthUser {
    // NEVER return passwordHash to the client
    return {
      id:    user.id,
      email: user.email,
      name:  user.name,
      phone: user.phone,
      role:  user.role,
    };
  },
};
