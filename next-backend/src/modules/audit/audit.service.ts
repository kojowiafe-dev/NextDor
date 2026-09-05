/**
 * Audit Service — Immutable Platform Audit Trail for Administrative Actions.
 *
 * DESIGN PRINCIPLE:
 * ──────────────────────────────────
 * Every sensitive administrative action (approving/suspending vendors, creating/deactivating admins,
 * changing commission rates, modifying system settings) MUST write to this audit trail.
 * Records actor identity, timestamp, IP address, user agent, target entity, and payload details.
 */

import { prisma } from "../../lib/prisma.js";

export interface LogAuditParams {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Records an immutable audit log entry.
   */
  static async log(params: LogAuditParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          userEmail: params.userEmail || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          details: params.details || {},
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (err) {
      console.error("Failed to record audit log:", err);
      return null;
    }
  }

  /**
   * Queries audit logs with pagination, search, and action filters.
   */
  static async listLogs(query: {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    entity?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action && query.action !== "ALL") {
      where.action = query.action;
    }

    if (query.entity && query.entity !== "ALL") {
      where.entity = query.entity;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { userEmail: { contains: s, mode: "insensitive" } },
        { action: { contains: s, mode: "insensitive" } },
        { entityId: { contains: s, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
