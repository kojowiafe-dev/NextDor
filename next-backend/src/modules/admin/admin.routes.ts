/**
 * Admin Routes — Presentation Layer (Controller).
 *
 * Exposes administration endpoints for customer management and analytics.
 */

import type { FastifyPluginAsync } from "fastify";
import { adminCustomerService } from "./admin.customer.service.js";
import { adminAnalyticsService } from "./admin.analytics.service.js";
import { requireAdmin } from "../../lib/auth.guards.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/admin/customers
   * List paginated customers with order aggregates.
   */
  app.get(
    "/customers",
    {
      preHandler: requireAdmin,
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
      preHandler: requireAdmin,
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
      preHandler: requireAdmin,
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
