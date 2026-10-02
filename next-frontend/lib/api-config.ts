/**
 * Central API configuration for NextDor frontend.
 * Resolves the backend base URL with safe fallbacks for both production and development.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://nextdor.onrender.com/api/v1"
    : "http://127.0.0.1:4000/api/v1");
