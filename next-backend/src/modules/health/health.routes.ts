/**
 * Health check routes.
 *
 * DESIGN DECISION: Why does a health check need to ping DB and Redis?
 * ────────────────────────────────────────────────────────────────────
 * Load balancers (Nginx, AWS ALB, Railway) use health checks to decide
 * whether to route traffic to an instance. If we return 200 even when
 * the database is down, the load balancer keeps sending traffic —
 * causing every request to fail instead of routing to a healthy instance.
 *
 * A "deep" health check (pings real dependencies) vs a "shallow" one
 * (just returns 200) is the difference between a useful canary signal
 * and false confidence.
 *
 * Two endpoints:
 *   GET /health        — shallow (just "am I alive?"), used by Kubernetes
 *                        liveness probe (if this fails, restart the pod)
 *   GET /health/ready  — deep (do I have working DB + Redis?), used by
 *                        readiness probe (if this fails, stop sending traffic)
 *
 * WHAT IF: The DB is slow but not down? The readiness check times out
 * at 3 seconds. If it takes longer, we report "degraded" — the load
 * balancer can decide what to do based on the status field.
 *
 * 📚 Read: Kubernetes documentation → "Configure Liveness, Readiness,
 *    and Startup Probes" — explains the three probe types in depth.
 */

import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness probe — just confirms the process is running
  app.get("/", { logLevel: "silent" }, async (_req, reply) => {
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness probe — confirms DB and Redis are reachable
  app.get("/ready", { logLevel: "silent" }, async (_req, reply) => {
    const checks: Record<string, "ok" | "error"> = {};
    let overallOk = true;

    // Postgres ping — SELECT 1 is the lightest possible query
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 3000),
        ),
      ]);
      checks.database = "ok";
    } catch {
      checks.database = "error";
      overallOk = false;
    }

    // Redis ping
    try {
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 2000),
        ),
      ]);
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
      overallOk = false;
    }

    const statusCode = overallOk ? 200 : 503;

    return reply.status(statusCode).send({
      status: overallOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
};
