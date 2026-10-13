/**
 * Origin allow-listing — shared by CORS and payment callback-URL validation.
 *
 * SECURITY RATIONALE
 * ──────────────────
 * The API uses `credentials: true` CORS (httpOnly refresh cookie). Allowing a
 * wildcard such as `*.vercel.app` means ANY third party who deploys a page on
 * that host can issue credentialed cross-origin requests as your users.
 * Therefore, in production the wildcard "preview" hosts are OFF by default and
 * only exact origins listed in `CORS_ORIGINS` (+ the NextDor domain) are trusted.
 *
 * The matcher is a pure factory so it can be unit-tested without booting the app.
 */

export interface OriginPolicyOptions {
  /** Exact origins from `CORS_ORIGINS` (e.g. "https://nextdor.online"). */
  explicitOrigins: readonly string[];
  /** Permit *.vercel.app, *.onrender.com, *.netlify.app, *.pages.dev. */
  allowPreviewOrigins: boolean;
  /** Permit http://localhost and http://127.0.0.1 on any port. */
  allowLocalhost: boolean;
}

const NEXTDOR_DOMAIN = /^https:\/\/([a-z0-9-]+\.)*nextdor\.online$/i;
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const PREVIEW_HOSTS: readonly RegExp[] = [
  /^https:\/\/[a-z0-9-.]+\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-.]+\.onrender\.com$/i,
  /^https:\/\/[a-z0-9-.]+\.netlify\.app$/i,
  /^https:\/\/[a-z0-9-.]+\.pages\.dev$/i,
];

export function createOriginMatcher(options: OriginPolicyOptions): (origin: string) => boolean {
  const explicit = new Set(options.explicitOrigins.map((o) => o.replace(/\/+$/, "").toLowerCase()));

  return (origin: string): boolean => {
    if (!origin) return false;
    const normalised = origin.replace(/\/+$/, "").toLowerCase();

    if (explicit.has(normalised)) return true;
    if (NEXTDOR_DOMAIN.test(normalised)) return true;
    if (options.allowLocalhost && LOCALHOST.test(normalised)) return true;
    if (options.allowPreviewOrigins && PREVIEW_HOSTS.some((re) => re.test(normalised))) return true;
    return false;
  };
}

/** Extracts the `scheme://host[:port]` origin of a URL, or null when it is not a valid http(s) URL. */
export function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
