/**
 * Prisma Client singleton.
 *
 * DESIGN DECISION: Why a singleton?
 * ──────────────────────────────────
 * PrismaClient maintains an internal connection pool to PostgreSQL.
 * If you instantiate it in every module (e.g. `new PrismaClient()`
 * per request), you'll exhaust database connections very quickly —
 * Postgres has a hard limit (typically 100 by default).
 *
 * A singleton means exactly ONE pool is created for the lifetime of
 * the process. Every module that imports `prisma` from this file
 * shares that same pool.
 *
 * WHAT IF: What if we run multiple API instances (horizontal scaling)?
 * Each process gets its own Prisma singleton and its own connection pool.
 * With N instances each using poolSize=10, you need N×10 connections.
 * At scale, use PgBouncer (a connection pooler) in front of Postgres so
 * all API instances share a single pool. Neon and Supabase offer this
 * built-in via their "pooler" URLs.
 *
 * WHAT IF: What if hot-reload during dev keeps creating new PrismaClient
 * instances? This is the classic "hot module replacement + Prisma" bug.
 * We solve it by attaching the instance to `globalThis` in development —
 * reloads reuse the cached instance instead of creating a new one.
 *
 * 📚 Read: Prisma docs → "Connection Management" section.
 *    Also: "PostgreSQL up and running" by Regina Obe — Chapter on pooling.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "./logger.js";

// Extend globalThis to hold our dev-mode cached instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: "query", emit: "event" },   // captured below
      { level: "warn",  emit: "stdout" },
      { level: "error", emit: "stdout" },
    ],
  });

  // Forward slow queries to our structured logger
  // SHOULD INCASE: Tune the threshold — 500ms is a good starting point.
  // Any query slower than this is a candidate for an index or query rewrite.
  client.$on("query" as never, (e: Prisma.QueryEvent) => {
    const durationMs = Number(e.duration);
    if (durationMs > 500) {
      logger.warn(
        { query: e.query, params: e.params, durationMs },
        "Slow database query detected",
      );
    }
  });

  return client;
}

export const prisma: PrismaClient =
  // In production: always create a fresh singleton
  // In dev: reuse across hot-reloads to avoid connection exhaustion
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());

// Graceful shutdown — close pool on SIGINT / SIGTERM
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
