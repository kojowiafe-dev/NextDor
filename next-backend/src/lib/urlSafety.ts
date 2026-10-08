import dns from "node:dns/promises";
import net from "node:net";
import { BadRequestError } from "./errors.js";
import { config } from "../config/env.js";

/**
 * Checks if an IPv4 address falls into a private, loopback, or cloud-metadata range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => parseInt(part, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / AWS & GCP & Azure Metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / TEST-NET)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is private, loopback, or link-local.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // Loopback (::1)
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  // Unspecified (::)
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
  // Unique Local Address (fc00::/7 -> fc.. or fd..)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-Local (fe80::/10 -> fe8, fe9, fea, feb)
  if (/^fe[89ab]/.test(normalized)) return true;
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.includes("::ffff:")) {
    const ipv4Part = normalized.split("::ffff:")[1];
    if (ipv4Part && net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
    return true;
  }
  return false;
}

/**
 * Validates that a URL is a safe, publicly reachable HTTPS/HTTP address.
 * Defends against Server-Side Request Forgery (SSRF), Cloud Metadata theft,
 * and internal network scanning.
 */
export async function assertSafePublicUrl(urlStr: string): Promise<string> {
  if (!urlStr || typeof urlStr !== "string") {
    throw new BadRequestError("A valid URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new BadRequestError("Invalid URL format.");
  }

  const isProduction = config.NODE_ENV === "production";

  // Protocol enforcement
  if (isProduction && parsed.protocol !== "https:") {
    throw new BadRequestError("Only secure HTTPS URLs are permitted in production.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new BadRequestError("Only HTTP and HTTPS protocols are permitted.");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname blocked names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home.arpa") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    throw new BadRequestError("Access to local or internal hostnames is prohibited.");
  }

  // Port restrictions — allow only standard web ports
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    const ALLOWED_PORTS = [80, 443, 8080, 8443];
    if (!ALLOWED_PORTS.includes(portNum)) {
      throw new BadRequestError(`Port ${portNum} is not permitted for external store integrations.`);
    }
  }

  // Direct IP address check
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new BadRequestError("Access to private, loopback, or link-local IP addresses is prohibited.");
    }
  } else if (net.isIPv6(hostname)) {
    if (isPrivateIPv6(hostname)) {
      throw new BadRequestError("Access to private or loopback IPv6 addresses is prohibited.");
    }
  } else {
    // DNS resolution check: resolve hostname and ensure it does not map to private IPs (DNS rebinding defense)
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        throw new BadRequestError(`Could not resolve hostname '${hostname}'.`);
      }

      for (const record of records) {
        if (record.family === 4 && isPrivateIPv4(record.address)) {
          throw new BadRequestError("URL hostname resolves to a private or restricted IP address.");
        }
        if (record.family === 6 && isPrivateIPv6(record.address)) {
          throw new BadRequestError("URL hostname resolves to a private or restricted IPv6 address.");
        }
      }
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(`Failed to verify host '${hostname}': ${err.message}`);
    }
  }

  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}
