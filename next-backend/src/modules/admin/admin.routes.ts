/**
 * Admin Routes — Presentation Layer (Controller).
 *
 * Exposes administration endpoints for customer management and analytics.
 */

import type { FastifyPluginAsync } from "fastify";
import { adminCustomerService } from "./admin.customer.service.js";
import { adminAnalyticsService } from "./admin.analytics.service.js";
import { ReconciliationService } from "./reconciliation.service.js";
import { MerchantAnalyticsService } from "../vendors/merchant.analytics.service.js";
import { requireAdmin, requireSuperAdmin } from "../../lib/auth.guards.js";

export const reconciliationService = new ReconciliationService();
export const merchantAnalyticsService = new MerchantAnalyticsService();

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

  /**
   * GET /api/v1/admin/analytics/merchants
   * Super-Admin benchmark comparing all merchants across GMV, AOV, and return rates.
   */
  app.get(
    "/analytics/merchants",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Get multi-vendor comparison benchmark leaderboard",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      const { limit = 10 } = req.query as { limit?: number };
      const benchmark = await merchantAnalyticsService.getAdminMerchantLeaderboard(Number(limit));
      return reply.send({
        success: true,
        data: benchmark,
      });
    },
  );

  /**
   * GET /api/v1/admin/reconciliation/ledger
   * Super-Admin accounting ledger comparing gateway inflows against disbursements and liabilities.
   */
  app.get(
    "/reconciliation/ledger",
    {
      preHandler: requireSuperAdmin,
      schema: {
        description: "Get platform financial reconciliation ledger and balance sheet",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      const ledger = await reconciliationService.getLedger(start, end);
      return reply.send({
        success: true,
        data: ledger,
      });
    },
  );
};

