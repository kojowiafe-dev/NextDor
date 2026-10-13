/**
 * Configured origin policy singleton (reads validated env config).
 * Kept separate from app.ts so feature modules (payments, CORS) can import it
 * without creating a circular dependency on the app factory.
 */

import { config } from "../config/env.js";
import { createOriginMatcher } from "./origins.js";

const isProduction = config.NODE_ENV === "production";

export const isOriginAllowed = createOriginMatcher({
  explicitOrigins: config.CORS_ORIGINS,
  allowPreviewOrigins: config.CORS_ALLOW_PREVIEW_ORIGINS ?? !isProduction,
  allowLocalhost: !isProduction || config.CORS_ORIGINS.some((o) => /localhost|127\.0\.0\.1/.test(o)),
});
