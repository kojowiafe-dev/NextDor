/**
 * Fastify app factory.
 *
 * DESIGN DECISION: Factory function vs direct export
 * ───────────────────────────────────────────────────
 * We export a `buildApp()` function rather than a module-level `app`
 * instance. This is critical for testing — each test can call buildApp()
 * to get a fresh, isolated instance without shared state between tests.
 *
 * WHAT IF: What if we exported `export const app = fastify()` at module level?
 * Tests would share state — plugins registered in one test could affect
 * others, and you'd see intermittent failures depending on test order
 * (the classic "works alone, fails in CI" problem).
 *
 * 📚 Read: Fastify documentation → "Testing" guide.
 *    Also: "xUnit Test Patterns" by Gerard Meszaros — "Fresh Fixture" pattern.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { isAppError } from "./lib/errors.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export async function buildApp() {
  const app = Fastify({
    // Use our Pino instance so Fastify's built-in request logging
    // (req.log.info / req.log.error) flows through the same logger.
    loggerInstance: logger,

    // Automatically generate a unique requestId for every request.
    // This ID is attached to every log line via req.log — so you can
    // grep for a single requestId and see the entire lifecycle of that
    // request in production logs.
    genReqId: () => crypto.randomUUID(),

    // Trust X-Forwarded-For headers from reverse proxy (Nginx/Cloudflare)
    // SHOULD INCASE: If you skip this, req.ip always shows the proxy IP,
    // not the real client IP — breaking IP-based rate limiting.
    trustProxy: config.NODE_ENV === "production",

    // Allow OpenAPI schema keywords (like example, description) in Ajv
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  });

  // ── Plugins (order matters — each can depend on the previous) ────────────

  // Security headers — always register first
  await app.register(import("@fastify/helmet"), {
    contentSecurityPolicy: false, // API only — CSP is for HTML pages
  });

  // CORS — controls which origins can call this API
  await app.register(import("@fastify/cors"), {
    origin: config.CORS_ORIGINS,
    credentials: true, // Required for httpOnly cookie (refresh token)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookie parser — required for reading the refresh_token httpOnly cookie
  await app.register(import("@fastify/cookie"), {
    secret: config.JWT_SECRET, // Signs cookies to prevent client-side tampering
  });

  // Rate limiting — backed by Redis for accuracy across multiple instances
  // WHAT IF: We use in-memory rate limiting? It's per-instance, not global.
  // If you have 3 API servers, a client could make 3× the allowed requests
  // by round-robin-ing between instances. Redis ensures global accuracy.
  await app.register(import("@fastify/rate-limit"), {
    global: true,
    max: 200,             // 200 requests per windowMs per IP
    timeWindow: "1 minute",
    // Redis plugin connection is provided here in Phase 2 when we
    // integrate @fastify/rate-limit with ioredis
    keyGenerator: (req: any) => req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down.",
      },
    }),
  });

  // OpenAPI / Swagger — auto-generates API docs from route schemas
  await app.register(import("@fastify/swagger"), {
    openapi: {
      info: { title: "NextDor API", version: "1.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  await app.register(import("@fastify/swagger-ui"), {
    routePrefix: "/docs",
    uiConfig: { deepLinking: true },
  });

  // ── Global error handler ─────────────────────────────────────────────────
  //
  // DESIGN DECISION: Centralised error handling
  // All errors — whether thrown by route handlers or plugins — flow here.
  // This ensures every error response has the same JSON shape, and we
  // never accidentally leak a raw stack trace to the client.

  app.setErrorHandler((error: any, req, reply) => {
    // Known operational error (thrown by our code intentionally)
    if (isAppError(error)) {
      req.log.warn({ err: error, code: error.code }, error.message);
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? undefined,
        },
      });
    }

    // Zod validation error (from manual schema parsing)
    if (error.name === "ZodError" || error.issues) {
      req.log.warn({ issues: error.issues }, "Request validation failed");
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues?.[0]?.message ?? "Invalid request data",
          details: error.issues,
        },
      });
    }

    // Fastify validation error (Zod/JSON schema mismatch in request body)
    if (error.validation) {
      req.log.warn({ validation: error.validation }, "Request validation failed");
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.validation,
        },
      });
    }

    // Unknown / programming error — log full stack, return generic 500
    // SECURITY: Never send the real error.message to clients for 500s —
    // it might reveal implementation details or file paths.
    req.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Our team has been notified.",
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.url} not found`,
      },
    });
  });

  // ── Routes ───────────────────────────────────────────────────────────────

  // Health check (no auth — used by load balancer / Docker health checks)
  await app.register(healthRoutes, { prefix: "/health" });

  // All API routes will be registered under /api/v1 in Phase 2+
  await app.register(authRoutes,    { prefix: "/api/v1/auth" });
  // await app.register(productRoutes, { prefix: "/api/v1/products" });
  // ... etc.

  return app;
}
