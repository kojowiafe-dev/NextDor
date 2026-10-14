import type { FastifyPluginAsync } from "fastify";
import { PayoutService } from "./payout.service.js";
import { requireAdmin, requireSuperAdmin } from "../../lib/auth.guards.js";
import {
  CreatePayoutBatchSchema,
  ExecutePayoutBatchSchema,
  PaystackTransferWebhookSchema,
} from "@nextdor/shared";

export const payoutService = new PayoutService();

export const payoutRoutes: FastifyPluginAsync = async (app) => {
  // ─── Super Admin Payout Batches ─────────────────────────────────────────────

  app.post(
    "/batches",
    {
      preHandler: requireSuperAdmin,
      schema: {
        description: "Generate a new payout batch aggregating all cleared vendor escrow balances",
        tags: ["Admin Payouts"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const parsed = CreatePayoutBatchSchema.parse(req.body ?? {});
      const result = await payoutService.generateBatch(parsed, req.authUser?.userId);
      return reply.status(201).send({ success: true, data: result });
    }
  );

  app.post(
    "/batches/execute",
    {
      preHandler: requireSuperAdmin,
      schema: {
        description: "Execute and disburse a pending payout batch via Paystack Transfers API",
        tags: ["Admin Payouts"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const parsed = ExecutePayoutBatchSchema.parse(req.body);
      const result = await payoutService.executeBatch(parsed);
      return reply.send({ success: true, data: result });
    }
  );

  app.get(
    "/batches",
    {
      preHandler: requireAdmin,
      schema: {
        description: "List paginated payout batches",
        tags: ["Admin Payouts"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
      const result = await payoutService.listBatches(Number(page), Number(limit));
      return reply.send({ success: true, ...result });
    }
  );

  app.get(
    "/batches/:id",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Get detailed payout batch breakdown and merchant disbursements",
        tags: ["Admin Payouts"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const batch = await payoutService.getBatch(id);
      return reply.send({ success: true, data: batch });
    }
  );

  // ─── Paystack Transfer Webhooks ─────────────────────────────────────────────

  app.post(
    "/webhooks/transfers",
    {
      schema: {
        description: "Inbound webhook for Paystack Transfer success and failure events",
        tags: ["Admin Payouts"],
      },
    },
    async (req, reply) => {
      const parsed = PaystackTransferWebhookSchema.safeParse(req.body);
      if (parsed.success) {
        await payoutService.handleTransferWebhook(parsed.data);
      }
      return reply.send({ status: true, message: "Webhook acknowledged" });
    }
  );
};
