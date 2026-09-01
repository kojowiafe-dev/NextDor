/**
 * Structured logger using Pino.
 *
 * DESIGN DECISION: Structured (JSON) logging vs plain text
 * ─────────────────────────────────────────────────────────
 * Plain text logs like:
 *   [2026-09-01 04:00:00] ERROR Failed to process order ND-12345
 *
 * are useless in production because:
 *   1. You can't filter by orderId in a log aggregator (Datadog, Loki, CloudWatch)
 *   2. You can't join logs across services by requestId
 *   3. You can't write structured queries ("show all errors for user X today")
 *
 * JSON logs like:
 *   { "level": "error", "orderId": "ND-12345", "userId": "abc-123",
 *     "requestId": "req-789", "msg": "Failed to process order" }
 *
 * are machine-readable and let you slice/filter/alert on any field.
 *
 * WHAT IF: What if we need to read logs locally during dev?
 * JSON is unreadable in a terminal, so in development we pipe through
 * pino-pretty which renders coloured, human-readable output.
 * In production, raw JSON goes to stdout for the log aggregator to consume.
 *
 * 📚 Read: "The Twelve-Factor App" (12factor.net) — Factor XI: Logs.
 *    Treat logs as event streams, never manage log files yourself.
 */

import pino from "pino";
import { config } from "../config/env.js";

const isDev = config.NODE_ENV === "development";

export const logger = pino({
  level: isDev ? "debug" : "info",

  // In production: raw JSON → stdout → log aggregator collects it
  // In development: pretty-printed with colours via pino-pretty
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Base fields included in every log line
  base: {
    env: config.NODE_ENV,
    service: "nextdor-api",
  },

  // SECURITY: Redact any field that might accidentally contain PII.
  // Pino will replace these with "[Redacted]" before writing.
  // SHOULD INCASE: If you add new fields to request objects, check if
  // they need to be added here.
  redact: {
    paths: [
      "req.headers.authorization", // Bearer tokens
      "req.headers.cookie",        // Refresh token cookie
      "body.password",             // Login/register
      "body.passwordHash",
      "body.cardNumber",           // Payment forms
      "body.cvv",
      "*.email",                   // PII (logged as userId instead)
      "*.phone",
    ],
    censor: "[Redacted]",
  },
});

export type Logger = typeof logger;
