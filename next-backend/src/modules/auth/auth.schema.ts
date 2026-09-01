/**
 * Shared Zod schemas for auth — imported by BOTH the Fastify backend
 * and the Next.js frontend.
 *
 * DESIGN DECISION: Single source of truth for validation
 * ───────────────────────────────────────────────────────
 * Without shared schemas, the same validation logic is written twice:
 *   - Frontend: "password must be 8+ characters"
 *   - Backend:  "password must be 8+ characters"
 *
 * When the requirement changes to 12+ characters, someone inevitably
 * updates one but not the other. The shared schema lives in
 * `packages/shared` and is imported by both — one change, both updated.
 *
 * WHAT IF: The frontend and backend need slightly different validation?
 * (e.g., frontend shows stricter UI hints but backend accepts more)
 * → Extend the base schema: `backendSchema = frontendSchema.extend({...})`
 *    The base schema is the minimum both agree on.
 *
 * 📚 Read: The concept of "contract-first design" — you define the
 *    interface (Zod schema) before implementation. This is the TypeScript
 *    equivalent of OpenAPI schema-first development.
 */

import { z } from "zod";

// ─── Password rules ───────────────────────────────────────────────────────────
// Centralised so frontend validation UI and backend enforcement are identical.

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(254, "Email address too long") // RFC 5321 limit
    .transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Please enter a valid phone number")
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  // Refresh token comes from httpOnly cookie, not request body.
  // This schema is used for internal validation only.
  refreshToken: z.string().min(128).max(128), // 64 bytes hex = 128 chars
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

// ─── Inferred TypeScript types ────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput    = z.infer<typeof loginSchema>;
