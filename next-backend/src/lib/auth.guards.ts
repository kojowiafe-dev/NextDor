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

interface CachedUserState {
  active: boolean;
  role: string;
  vendorId?: string;
  expiresAt: number;
}

const USER_STATE_CACHE_TTL_MS = 15_000; // 15s cache to prevent DB spam while ensuring near-instant suspension
const userStateCache = new Map<string, CachedUserState>();

export function evictUserAuthCache(userId: string) {
  userStateCache.delete(userId);
}

async function verifyActiveUserState(user: AuthUser): Promise<AuthUser | null> {
  const now = Date.now();
  const cached = userStateCache.get(user.userId);
  if (cached && cached.expiresAt > now) {
    if (!cached.active) return null;
    return {
      ...user,
      role: cached.role,
      vendorId: cached.vendorId ?? user.vendorId,
    };
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        status: true,
        deletedAt: true,
        role: true,
        vendorId: true,
        ownedVendor: { select: { id: true } },
      },
    });

    const active = Boolean(dbUser && !dbUser.deletedAt && dbUser.status === "ACTIVE");
    const resolvedVendorId = dbUser?.vendorId ?? dbUser?.ownedVendor?.id ?? user.vendorId;
    const role = dbUser?.role ?? user.role;

    if (userStateCache.size > 5000) {
      userStateCache.clear();
    }
    userStateCache.set(user.userId, {
      active,
      role,
      vendorId: resolvedVendorId,
      expiresAt: now + USER_STATE_CACHE_TTL_MS,
    });

    if (!active) return null;
    return {
      ...user,
      role,
      vendorId: resolvedVendorId,
    };
  } catch {
    // On transient DB connection blip, fall back to verified JWT claims
    return user;
  }
}

/** Requires any valid access token and an active (non-suspended) user account. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const tokenUser = extractUser(req);
  if (!tokenUser) return unauthorized(reply);
  const activeUser = await verifyActiveUserState(tokenUser);
  if (!activeUser) return unauthorized(reply, "Account is inactive or suspended");
  req.authUser = activeUser;
}

/** Attaches the user when a valid token is present; never rejects. */
export async function optionalAuth(req: FastifyRequest) {
  const tokenUser = extractUser(req);
  if (tokenUser) {
    const activeUser = await verifyActiveUserState(tokenUser);
    if (activeUser) req.authUser = activeUser;
  }
}

/** Requires a valid token whose live role is one of `roles` and account is active. */
export function requireRole(roles: readonly string[], message = "Insufficient permissions") {
  return async function roleGuard(req: FastifyRequest, reply: FastifyReply) {
    const tokenUser = extractUser(req);
    if (!tokenUser) return unauthorized(reply);
    const activeUser = await verifyActiveUserState(tokenUser);
    if (!activeUser) return unauthorized(reply, "Account is inactive or suspended");
    if (!roles.includes(activeUser.role)) return forbidden(reply, message);
    req.authUser = activeUser;
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
