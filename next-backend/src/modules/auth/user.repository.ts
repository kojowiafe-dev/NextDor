/**
 * User & Token Repository — Persistence Layer for Identity and Authentication.
 *
 * DESIGN PATTERN: Repository Pattern
 * ──────────────────────────────────
 * Encapsulates all Prisma database operations for User records and RefreshToken rotation.
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import type { Prisma, User, RefreshToken } from "@prisma/client";

export class UserRepository {
  /**
   * Helper to gracefully handle serverless cold starts (Neon / Prisma connection pool timeouts).
   */
  private async withRetry<T>(op: () => Promise<T>, maxAttempts = 4): Promise<T> {
    const isColdStartError = (err: any) =>
      err?.message?.includes("connection pool") ||
      err?.message?.includes("Can't reach database server") ||
      err?.name === "PrismaClientInitializationError";

    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await op();
      } catch (err: any) {
        if (!isColdStartError(err)) throw err; // non-retryable error — rethrow immediately

        lastErr = err;
        const delayMs = Math.min(2000 * 2 ** (attempt - 1), 8000); // 2s, 4s, 8s, 8s
        logger.warn(
          { attempt, maxAttempts, delayMs },
          `Database cold start — retrying in ${delayMs / 1000}s... (attempt ${attempt}/${maxAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastErr;
  }

  /**
   * Finds user by unique email address.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.withRetry(() =>
      prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      }),
    );
  }

  /**
   * Finds user by primary UUID.
   */
  async findById(id: string): Promise<User | null> {
    return this.withRetry(() =>
      prisma.user.findUnique({
        where: { id },
      }),
    );
  }

  /**
   * Creates a new user with hashed credentials.
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  /**
   * Updates user profile fields.
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Finds an active refresh token by user ID and family.
   */
  async findActiveTokensByUserId(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Saves a newly generated hashed refresh token with dual-hash lookup support.
   *
   * FIX #1: Both hashes are now stored:
   * - tokenHash  (bcrypt):  tamper-proof security verification
   * - lookupHash (SHA-256): O(1) indexed DB lookup key
   */
  async saveRefreshToken(data: {
    userId: string;
    tokenHash: string;
    lookupHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  }

  /**
   * Revokes all refresh tokens in a given family chain (breach detection).
   */
  async revokeTokenFamily(family: string): Promise<number> {
    const res = await prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  /**
   * Revokes a specific single token ID.
   */
  async revokeTokenById(id: string): Promise<RefreshToken> {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Cleans up expired tokens for a user.
   */
  async deleteExpiredTokens(userId: string): Promise<number> {
    const res = await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
    return res.count;
  }

  /**
   * FIX #16: Cleans up expired auth codes (OTPs) across all users.
   * Prevents unbounded table growth and keeps lookup index fast.
   */
  async deleteExpiredAuthCodes(): Promise<number> {
    try {
      const res = await prisma.authCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return res.count;
    } catch {
      return 0;
    }
  }

  /**
   * Saves a hashed one-time verification or recovery code in the auth_codes table.
   */
  async createAuthCode(data: {
    email: string;
    codeHash: string;
    type: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO auth_codes (id, email, code_hash, type, expires_at, created_at)
      VALUES (gen_random_uuid(), ${data.email.toLowerCase().trim()}, ${data.codeHash}, ${data.type}, ${data.expiresAt}, NOW())
    `;
  }

  /**
   * Finds the latest active, non-expired, and unused auth code for an email and type.
   */
  async findLatestValidAuthCode(
    email: string,
    type: string,
  ): Promise<{
    id: string;
    email: string;
    code_hash: string;
    type: string;
    expires_at: Date;
    used_at: Date | null;
    attempts: number;
    created_at: Date;
  } | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, email, code_hash, type, expires_at, used_at, attempts, created_at
      FROM auth_codes
      WHERE email = ${email.toLowerCase().trim()}
        AND type = ${type}
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  /**
   * Finds any code created within the last N seconds (for rate-limiting resend).
   */
  async findRecentAuthCode(
    email: string,
    type: string,
    withinSeconds = 60,
  ): Promise<any | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, created_at
      FROM auth_codes
      WHERE email = ${email.toLowerCase().trim()}
        AND type = ${type}
        AND created_at > NOW() - (${withinSeconds} || ' seconds')::interval
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  /**
   * Increments attempt counter on an auth code.
   */
  async incrementAuthCodeAttempts(id: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${id}::uuid
    `;
  }

  /**
   * Marks an auth code as used.
   */
  async markAuthCodeUsed(id: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE auth_codes SET used_at = NOW() WHERE id = ${id}::uuid
    `;
  }

  /**
   * Marks a user's email as verified.
   */
  async markEmailVerified(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  /**
   * Updates user's password hash.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  /**
   * Revokes all active refresh tokens for a user (security invalidate all sessions).
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const res = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }
}
