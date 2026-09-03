/**
 * Server entry point.
 *
 * DESIGN DECISION: Graceful shutdown
 * ────────────────────────────────────
 * When Kubernetes (or Railway/Render) wants to stop a container, it sends
 * SIGTERM. Without a handler, Node exits immediately — dropping any
 * in-flight requests and leaving DB transactions open.
 *
 * Graceful shutdown means:
 *   1. Stop accepting NEW requests (close the HTTP listener)
 *   2. Wait for IN-FLIGHT requests to finish (Fastify tracks these)
 *   3. Close DB connection pool (Prisma)
 *   4. Disconnect Redis
 *   5. Exit with code 0 (success) — so the orchestrator knows it was clean
 *
 * WHAT IF: A request is still in-flight when SIGTERM arrives?
 * We give it a 10-second grace period. If it doesn't finish by then,
 * we force-exit. This prevents a slow request from blocking a deploy forever.
 *
 * WHAT IF: We DON'T handle SIGTERM?
 * The orchestrator sends SIGTERM, waits (default 30s), then sends SIGKILL.
 * SIGKILL cannot be caught — the process dies instantly, mid-request.
 * Users see a 502 Bad Gateway on every deploy. This is why every
 * production Node app must handle graceful shutdown.
 *
 * 📚 Read: "Node.js Design Patterns" by Casciaro & Mammino
 *    Chapter 1 — The Node.js platform, specifically the event loop
 *    and why process signals matter.
 */

import { buildApp } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

async function main() {
  const app = await buildApp();

  // Graceful shutdown handler
  async function shutdown(signal: string) {
    logger.info({ signal }, "Received shutdown signal — shutting down gracefully");

    try {
      // 1. Stop accepting new connections
      await app.close();

      // 2. Close database pool
      await prisma.$disconnect();

      // 3. Disconnect Redis if connected
      if (redis.status !== "wait" && redis.status !== "end") {
        redis.disconnect();
      }

      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl+C in dev

  // Unhandled promise rejections — log and exit
  // SHOULD INCASE: Without this, unhandled rejections are silently swallowed
  // in older Node versions. In Node 20 they crash the process by default,
  // but we still want to log them properly before exit.
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    process.exit(1);
  });

  // Start listening
  try {
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    logger.info({ address, env: config.NODE_ENV }, "🚀 NextDor API is running");
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main();
