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
import { redis, redisForQueue } from "./lib/redis.js";
import { closeEmailQueue } from "./lib/email.queue.js";
import { orderService } from "./modules/orders/order.service.js";

async function main() {
  const app = await buildApp();

  let isShuttingDown = false;
  let reclamationTimer: NodeJS.Timeout | null = null;

  // Graceful shutdown handler
  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, "Received shutdown signal — shutting down gracefully");

    // Force exit timeout to avoid hung connections during deploys
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out after 10s — forcing exit");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      // 1. Stop background workers
      if (reclamationTimer) {
        clearInterval(reclamationTimer);
      }

      // 2. Stop accepting new connections
      await app.close();

      // 3. Close background job queues and workers
      await closeEmailQueue();

      // 4. Close database pool
      await prisma.$disconnect();

      // 4. Disconnect Redis clients if connected
      if (redis.status !== "wait" && redis.status !== "end") {
        redis.disconnect();
      }
      if (redisForQueue.status !== "wait" && redisForQueue.status !== "end") {
        redisForQueue.disconnect();
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

  // Pre-warm database connection to prevent cold-start latency on first request
  try {
    await prisma.$connect();
    logger.info("⚡ Database connection pool established (Neon Serverless)");

    // Ensure order_number_seq PostgreSQL sequence exists
    try {
      await prisma.$executeRawUnsafe("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;");
      logger.info("⚡ Order sequence order_number_seq verified");
    } catch (seqErr) {
      logger.warn({ seqErr }, "Order sequence creation notice");
    }
  } catch (err) {
    logger.warn({ err }, "Initial database pool warm-up deferred — will connect on demand");
  }

  // Start listening
  try {
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    logger.info({ address, env: config.NODE_ENV }, "🚀 NextDor API is running");

    // ─── Automated Inventory Reclamation Worker (Loophole 2 Fix) ─────────────
    // Runs every 10 minutes to release reserved stock from unpaid abandoned checkouts
    const RECLAMATION_INTERVAL_MS = 10 * 60 * 1000;
    reclamationTimer = setInterval(async () => {
      try {
        await orderService.reclaimAbandonedOrders(30);
      } catch (err) {
        logger.warn({ err }, "Periodic abandoned order reclamation encountered an error");
      }
    }, RECLAMATION_INTERVAL_MS);
    reclamationTimer.unref();
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main();
