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

// Secrets that have been published in this repository's history. Never valid in production.
const PUBLISHED_JWT_SECRETS = [
  "4f7b2a9e8d1c6f3a5b0e7d9c2a4f6e8b1d3c5a7e9f0b2d4c6a8e1f3b5d7a9c2e0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
];

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
  // DEPRECATED + IGNORED: Paystack signs webhooks (x-paystack-signature) with the
  // account SECRET KEY — there is no separate webhook secret. Kept optional so
  // existing deployments that still define it keep booting.
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),

  // ── Email ────────────────────────────────────────────────────────────────
  // Cloudflare Email Sending (Primary)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  // Resend (Optional fallback)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z
    .string()
    .email()
    .or(z.string().regex(/^.+ <.+@.+>$/, "EMAIL_FROM must be 'Name <email@domain.com>'"))
    .default("NextDor <nextdor@nextdor.online>"),

  // ── SMS ──────────────────────────────────────────────────────────────────
  ARKESEL_API_KEY: z.string().min(5),
  SMS_FROM: z.string().default("NextDor"),

  // ── WhatsApp Provider & WATI / Meta Configuration ────────────────────────
  WHATSAPP_PROVIDER: z.enum(["meta", "wati"]).default("meta"),
  WATI_API_ENDPOINT: z.string().optional(),
  WATI_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // ── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  // Allow *.vercel.app / *.onrender.com / *.netlify.app / *.pages.dev origins.
  // Unset → true outside production, false in production (see lib/origins.ts).
  CORS_ALLOW_PREVIEW_ORIGINS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  // ── API docs ─────────────────────────────────────────────────────────────
  // Swagger UI (/docs). Unset → enabled outside production, disabled in production.
  ENABLE_API_DOCS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  // ── WooCommerce ──────────────────────────────────────────────────────────
  WOOCOMMERCE_STORE_URL: z.string().url(),

  // ── Cloudinary ───────────────────────────────────────────────────────────
  // SECURITY: Never hardcode credentials here. Rotate old keys immediately.
  // Use environment variables only. See .env.example for required names.
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  CLOUDINARY_URL: z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;

  // The JWT secret in the historical .env.example is public (it was committed to
  // git). Anyone could forge admin tokens against a deployment that still uses it.
  if (PUBLISHED_JWT_SECRETS.includes(env.JWT_SECRET) || /REPLACE_WITH|CHANGE_ME/i.test(env.JWT_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET is a published/placeholder value — generate a unique secret for production",
    });
  }

  // Without a provider, EmailService only logs messages locally: OTP codes and
  // receipts would silently never reach customers.
  const hasResend = Boolean(env.RESEND_API_KEY && !/placeholder|^re_dev_|CHANGE_ME/i.test(env.RESEND_API_KEY));
  const hasCloudflare = Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);
  if (!hasResend && !hasCloudflare) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RESEND_API_KEY"],
      message: "Production requires an email provider (RESEND_API_KEY or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)",
    });
  }
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
