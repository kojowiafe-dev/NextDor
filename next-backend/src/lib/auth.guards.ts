/**
 * Shared authentication / authorization guards (Fastify preHandlers).
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Bearer-token parsing and role checks were previously copy-pasted into
 * order, product, auth, admin and vendor routes — each copy with slightly
 * different behaviour (some returned 403 for a missing token, some 401, some
 * leaked the raw jwt error). One implementation = one place to audit.
 *
 * SEMANTICS (consistent everywhere)
 *   401 UNAUTHORIZED → no / invalid / expired access token (client should refresh)
 *   403 FORBIDDEN    → valid token, insufficient role
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../modules/auth/auth.service.js";
import { prisma } from "./prisma.js";

export type Role = "CUSTOMER" | "VENDOR_OWNER" | "VENDOR_STAFF" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  userId: string;
  role: Role | string;
  email?: string;
  vendorId?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Populated by requireAuth / optionalAuth / requireRole. */
    authUser?: AuthUser;
  }
}

export const ADMIN_ROLES: readonly Role[] = ["ADMIN", "SUPER_ADMIN"];
export const VENDOR_ROLES: readonly Role[] = ["VENDOR_OWNER", "VENDOR_STAFF", "ADMIN", "SUPER_ADMIN"];

/** Parses and verifies the Bearer token. Returns null when absent or invalid. */
export function extractUser(req: FastifyRequest): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = AuthService.verifyAccessToken(header.slice(7));
    return {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
      vendorId: payload.vendorId,
    };
  } catch {
    return null;
  }
}

function unauthorized(reply: FastifyReply, message = "Authentication required") {
  return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message } });
}

function forbidden(reply: FastifyReply, message: string) {
  return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message } });
}

/** Requires any valid access token. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = extractUser(req);
  if (!user) return unauthorized(reply);
  req.authUser = user;
}

/** Attaches the user when a valid token is present; never rejects. */
export async function optionalAuth(req: FastifyRequest) {
  const user = extractUser(req);
  if (user) req.authUser = user;
}

/** Requires a valid token whose role is one of `roles`. */
export function requireRole(roles: readonly string[], message = "Insufficient permissions") {
  return async function roleGuard(req: FastifyRequest, reply: FastifyReply) {
    const user = extractUser(req);
    if (!user) return unauthorized(reply);
    if (!roles.includes(user.role)) return forbidden(reply, message);
    req.authUser = user;
  };
}

export const requireAdmin = requireRole(ADMIN_ROLES, "Admin access required");
export const requireVendor = requireRole(VENDOR_ROLES, "Vendor access required");
export const requireSuperAdmin = requireRole(["SUPER_ADMIN"], "Super Admin authorization required");

/**
 * Resolves the vendor (tenant) an authenticated user acts for.
 * Prefers the claim embedded in the token; falls back to the database for tokens
 * issued before the user was attached to a store. Returns null when none.
 */
export async function resolveVendorId(user: AuthUser): Promise<string | null> {
  if (user.vendorId) return user.vendorId;
  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { vendorId: true, ownedVendor: { select: { id: true } } },
  });
  return row?.vendorId ?? row?.ownedVendor?.id ?? null;
}
