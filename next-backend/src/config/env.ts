/**
 * Environment configuration — validated at startup with Zod.
 *
 * DESIGN DECISION: Fail-fast on bad config
 * ─────────────────────────────────────────
 * If any required env variable is missing or malformed, the server
 * refuses to start and prints a clear error. This prevents the classic
 * "works in dev, silently broken in prod" failure mode where missing
 * secrets cause errors deep inside request handlers — hours after deploy.
 *
 * WHAT IF: What if we add a new required env var but forget to set it
 * in production? → The deployment fails at startup, the old version
 * stays up (if using blue/green), and you get an immediate alert.
 * Without Zod validation, you'd get a cryptic runtime error on first
 * use of that variable — potentially silently affecting only some users.
 */

import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env automatically in development/local environments
try {
  if (typeof process.loadEnvFile === "function") {
    if (existsSync(".env")) {
      process.loadEnvFile(".env");
    } else if (existsSync(resolve("next-backend", ".env"))) {
      process.loadEnvFile(resolve("next-backend", ".env"));
    }
  }
} catch {
  // In containers or CI/CD, env vars are passed directly into the environment
}

const envSchema = z.object({
  // ── Runtime ─────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("0.0.0.0"),

  // ── Database ─────────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL must be a valid PostgreSQL connection string",
    }),

  // ── Redis ────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // ── JWT ─────────────────────────────────────────────────────────────────
  //
  // SHOULD INCASE: What if the JWT_SECRET is weak or short?
  // Enforcing minimum length (64 chars = 256 bits) prevents someone from
  // using a trivially brute-forceable secret like "secret" or "password".
  // The min(64) check is a hard gate.
  //
  JWT_SECRET: z.string().min(64, "JWT_SECRET must be at least 64 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // ── Paystack ─────────────────────────────────────────────────────────────
  PAYSTACK_SECRET_KEY: z.string().min(10),
  PAYSTACK_PUBLIC_KEY: z.string().min(10),
  PAYSTACK_WEBHOOK_SECRET: z.string().min(10),

  // ── Email ────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(5),
  EMAIL_FROM: z.string().email().or(
    z.string().regex(/^.+ <.+@.+>$/, "EMAIL_FROM must be 'Name <email@domain.com>'"),
  ),

  // ── SMS ──────────────────────────────────────────────────────────────────
  ARKESEL_API_KEY: z.string().min(5),
  SMS_FROM: z.string().default("NextDor"),

  // ── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),

  // ── WooCommerce ──────────────────────────────────────────────────────────
  WOOCOMMERCE_STORE_URL: z.string().url(),

  // ── Cloudinary ───────────────────────────────────────────────────────────
  // SECURITY: Never hardcode credentials here. Rotate old keys immediately.
  // Use environment variables only. See .env.example for required names.
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  CLOUDINARY_URL: z.string().optional(),
});

// Parsed, type-safe config object — import this everywhere, never process.env
export type Config = z.infer<typeof envSchema>;

function parseEnv(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    // Use console.error intentionally here — logger not yet initialised
    console.error(
      `\n❌ Invalid environment configuration:\n${formatted}\n\n` +
        `Copy .env.example to .env and fill in the required values.\n`,
    );
    process.exit(1);
  }

  return result.data;
}

// Singleton — parsed once at module load
export const config = parseEnv();
