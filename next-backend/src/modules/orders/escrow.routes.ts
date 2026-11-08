import type { FastifyPluginAsync } from "fastify";
import { EscrowService } from "./escrow.service.js";
import { EscrowScheduler } from "./escrow.scheduler.js";
import { requireAuth, requireAdmin } from "../../lib/auth.guards.js";
import { DisputeReason, DisputeResolution } from "@prisma/client";

const escrowService = new EscrowService();

export const escrowRoutes: FastifyPluginAsync = async (app) => {
  // Verify delivery (customer, delivery agent, or admin)
  app.post(
    "/verify-delivery",
    {
      preHandler: requireAuth,
      schema: {
        description: "Verify delivery by delivery agent, tracking system, or customer (Spec §4.3)",
        tags: ["Escrow"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["vendorOrderId", "confirmedBy"],
          properties: {
            vendorOrderId: { type: "string", format: "uuid" },
            confirmedBy: { type: "string", enum: ["DELIVERY_AGENT", "CUSTOMER", "TRACKING_SYSTEM"] },
            note: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      await escrowService.verifyDelivery({
        vendorOrderId: body.vendorOrderId,
        confirmedBy: body.confirmedBy,
        actorId: req.authUser?.userId,
        note: body.note,
      });
      return reply.send({ success: true, message: "Delivery verified and 48-hour escrow inspection window started." });
    }
  );

  // Early confirmation by customer
  app.post(
    "/confirm-receipt",
    {
      preHandler: requireAuth,
      schema: {
        description: "Customer early-confirms order receipt before 48h escrow expires (Spec §4.5)",
        tags: ["Escrow"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["vendorOrderId"],
          properties: {
            vendorOrderId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      await escrowService.customerConfirmReceipt(body.vendorOrderId, req.authUser?.userId);
      return reply.send({ success: true, message: "Receipt confirmed. Vendor funds cleared to available balance." });
    }
  );

  // Customer opens dispute
  app.post(
    "/disputes",
    {
      preHandler: requireAuth,
      schema: {
        description: "Customer opens dispute within 48h escrow window — freezes only affected vendor funds (Spec §5)",
        tags: ["Disputes"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["vendorOrderId", "reason"],
          properties: {
            vendorOrderId: { type: "string", format: "uuid" },
            reason: {
              type: "string",
              enum: ["WRONG_PRODUCT", "DAMAGED_PRODUCT", "MISSING_ITEMS", "ORDER_NEVER_ARRIVED", "NOT_AS_DESCRIBED", "OTHER"],
            },
            details: { type: "string" },
            evidenceUrls: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const res = await escrowService.openDispute({
        vendorOrderId: body.vendorOrderId,
        customerId: req.authUser?.userId,
        reason: body.reason as DisputeReason,
        details: body.details,
        evidenceUrls: body.evidenceUrls,
      });
      return reply.status(201).send({ success: true, data: res });
    }
  );

  // Admin resolves dispute
  app.post(
    "/admin/disputes/:id/resolve",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin resolves an open dispute (Spec §5)",
        tags: ["Disputes", "Admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["resolution"],
          properties: {
            resolution: { type: "string", enum: ["RELEASE_TO_VENDOR", "PARTIAL_REFUND", "FULL_REFUND"] },
            resolutionNote: { type: "string" },
            refundAmountPesewas: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      await escrowService.resolveDispute({
        disputeId: id,
        resolution: body.resolution as DisputeResolution,
        resolutionNote: body.resolutionNote,
        resolvedBy: req.authUser!.userId,
        refundAmountPesewas: body.refundAmountPesewas,
      });
      return reply.send({ success: true, message: `Dispute resolved with ${body.resolution}.` });
    }
  );

  // Scheduled job trigger (cron or admin)
  app.post(
    "/admin/escrow/run-scheduler",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Trigger the 48-hour escrow clearance and 7-day fallback job (Spec §10 rule 7)",
        tags: ["Escrow", "Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      const result = await EscrowScheduler.runJobs();
      return reply.send({ success: true, data: result });
    }
  );
};
