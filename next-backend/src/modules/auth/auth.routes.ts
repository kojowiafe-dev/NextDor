/**
 * Auth route handlers — the HTTP interface to AuthService.
 *
 * DESIGN DECISION: Thin routes, fat services
 * ───────────────────────────────────────────
 * Route handlers do only:
 *   1. Parse and validate the request (Zod)
 *   2. Call the service
 *   3. Set cookies / format the HTTP response
 *
 * They contain ZERO business logic. "Is the password correct?" is a
 * business question — it lives in AuthService, not here.
 *
 * WHAT IF: We add a GraphQL endpoint or a WebSocket later?
 * The route handlers are the only things that change — the service
 * stays untouched. This is the "ports and adapters" architecture.
 *
 * REFRESH TOKEN COOKIE DESIGN:
 * The refresh token is sent as an httpOnly, SameSite=Strict, Secure cookie.
 * httpOnly = JavaScript cannot read it (XSS protection)
 * SameSite=Strict = Not sent on cross-site requests (CSRF protection)
 * Secure = Only sent over HTTPS (prevents network sniffing)
 *
 * The access token is returned in the JSON body and stored in memory
 * (not localStorage — localStorage is readable by any XSS script).
 */

import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    cookies: Record<string, string>;
  }
  interface FastifyReply {
    setCookie(name: string, value: string, options?: any): this;
    clearCookie(name: string, options?: any): this;
  }
}
import { AuthService } from "./auth.service.js";
import { registerSchema, loginSchema, forgotPasswordSchema } from "@nextdor/shared";

const REFRESH_COOKIE_NAME = "refresh_token";

// Cookie options — production-hardened
function refreshCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,                          // Not readable by JS
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict" as const,             // CSRF protection
    path: "/api/v1/auth",                    // Only sent to auth routes
    maxAge: maxAgeMs,                        // 30 days in ms
  };
}

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export const authRoutes: FastifyPluginAsync = async (app) => {

  /**
   * POST /auth/register
   * Rate limit: 5 per 15 minutes per IP (stricter than global 200/min)
   */
  app.post(
    "/register",
    {
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        description: "Register a new user account",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 2, example: "Kojo Wiafe" },
            email: { type: "string", format: "email", example: "kojo@nextdor.com" },
            password: { type: "string", minLength: 8, example: "Password123!" },
            phone: { type: "string", example: "+233241234567" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = registerSchema.parse(req.body);

      const { user, tokens } = await AuthService.register(body);

      reply
        .setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions(REFRESH_MAX_AGE))
        .status(201)
        .send({
          success: true,
          data: {
            user,
            accessToken: tokens.accessToken,
          },
        });
    },
  );

  /**
   * POST /auth/login
   * Rate limit: 10 per 15 minutes per IP (brute-force protection)
   *
   * WHAT IF: A user fat-fingers their password 10 times?
   * They're rate-limited for 15 minutes. To prevent locking out
   * legitimate users, consider "per IP + per email" rate limiting
   * instead of "per IP only". Phase 2 hardening will add this.
   */
  app.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
      schema: {
        description: "Authenticate with email and password",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "kojo@nextdor.com" },
            password: { type: "string", minLength: 1, example: "Password123!" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = loginSchema.parse(req.body);

      const { user, tokens } = await AuthService.login(body);

      reply
        .setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions(REFRESH_MAX_AGE))
        .send({
          success: true,
          data: {
            user,
            accessToken: tokens.accessToken,
          },
        });
    },
  );

  /**
   * POST /auth/refresh
   * Reads refresh token from cookie — no body required.
   *
   * DESIGN: The client sends this silently in the background when the
   * access token expires (the 401 response triggers an automatic retry
   * with a refresh). The user never sees a login page — their session
   * just extends automatically.
   */
  app.post(
    "/refresh",
    {
      schema: {
        description: "Refresh access token using the httpOnly cookie",
        tags: ["Auth"],
      },
    },
    async (req, reply) => {
      const rawToken = req.cookies[REFRESH_COOKIE_NAME];

      if (!rawToken) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "No refresh token provided" },
        });
      }

      const tokens = await AuthService.refresh(rawToken);

      reply
        .setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions(REFRESH_MAX_AGE))
        .send({
          success: true,
          data: { accessToken: tokens.accessToken },
        });
    },
  );

  /**
   * POST /auth/logout
   * Revokes the refresh token and clears the cookie.
   *
   * WHAT IF: The client's cookie is already gone (cleared by browser)?
   * We return 200 anyway — logout is idempotent. "Already logged out"
   * is a success state, not an error.
   */
  app.post(
    "/logout",
    {
      schema: {
        description: "Log out and revoke the session refresh token",
        tags: ["Auth"],
      },
    },
    async (req, reply) => {
      const rawToken = req.cookies[REFRESH_COOKIE_NAME];

      if (rawToken) {
        await AuthService.logout(rawToken);
      }

      // Clear the cookie by setting maxAge to 0
      reply
        .setCookie(REFRESH_COOKIE_NAME, "", {
          ...refreshCookieOptions(0),
          maxAge: 0,
        })
        .send({ success: true, data: null });
    },
  );

  /**
   * POST /auth/forgot-password
   * Always returns 200 — even if the email doesn't exist.
   *
   * SECURITY: If we returned 404 for unknown emails, an attacker could
   * use this endpoint to discover which emails are registered. Always
   * respond with the same message regardless of whether the email exists.
   *
   * The actual OTP email is enqueued as a background job (Phase 2).
   */
  app.post(
    "/forgot-password",
    {
      config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
      schema: {
        description: "Request a password reset link (idempotent)",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", example: "kojo@nextdor.com" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = forgotPasswordSchema.parse(req.body);

      // TODO Phase 2: enqueue email job with OTP
      // await emailQueue.add("forgot-password", { email: body.email });
      req.log.info({ email: body.email }, "auth: forgot password requested");

      // Always the same response
      return reply.send({
        success: true,
        data: {
          message: "If an account with that email exists, a reset link has been sent.",
        },
      });
    },
  );

  /**
   * GET /auth/me
   * Returns the currently authenticated user from the access token.
   * Used by the frontend on page load to restore session state.
   */
  app.get(
    "/me",
    {
      schema: {
        description: "Get currently authenticated user details",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      // Temporary: decode token manually until auth plugin is wired up
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const token = authHeader.slice(7);
      const payload = AuthService.verifyAccessToken(token);

      const user = await import("../../lib/prisma.js").then(({ prisma }) =>
        prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, name: true, phone: true, role: true },
        }),
      );

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "User not found" },
        });
      }

      return reply.send({ success: true, data: { user } });
    },
  );
};
