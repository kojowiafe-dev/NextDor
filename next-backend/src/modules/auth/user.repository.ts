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
   * Saves a newly generated hashed refresh token.
   */
  async saveRefreshToken(data: {
    userId: string;
    tokenHash: string;
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
}
