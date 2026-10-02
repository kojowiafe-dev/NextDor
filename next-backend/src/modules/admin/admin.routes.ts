/**
 * Admin Routes — Presentation Layer (Controller).
 *
 * Exposes administration endpoints for customer management and analytics.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../auth/auth.service.js";
import { adminCustomerService } from "./admin.customer.service.js";
import { adminAnalyticsService } from "./admin.analytics.service.js";

async function requireAdminAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Admin authorization required." },
    });
  }

  try {
    const token = authHeader.slice(7);
    const payload = AuthService.verifyAccessToken(token);

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Platform administrator access required." },
      });
    }

    (req as any).adminUser = payload;
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: err.message || "Invalid or expired token" },
    });
  }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/admin/customers
   * List paginated customers with order aggregates.
   */
  app.get(
    "/customers",
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "List registered customers with order counts and spend",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as { page?: number; limit?: number; search?: string };
      const result = await adminCustomerService.listCustomers(query);
      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  /**
   * GET /api/v1/admin/customers/:id
   * Get single customer with order history and addresses.
   */
  app.get(
    "/customers/:id",
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Get customer details and order history by ID or email",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const customer = await adminCustomerService.getCustomerById(id);
      return reply.send({
        success: true,
        data: { customer },
      });
    },
  );

  /**
   * GET /api/v1/admin/analytics/overview
   * Get marketplace overview analytics and 30-day trends.
   */
  app.get(
    "/analytics/overview",
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Get platform analytics overview, charts, and metrics",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      const analytics = await adminAnalyticsService.getOverview();
      return reply.send({
        success: true,
        data: analytics,
      });
    },
  );
};
