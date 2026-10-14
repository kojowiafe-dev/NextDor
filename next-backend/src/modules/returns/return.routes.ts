import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { returnService } from "./return.service.js";
import { requireAuth, requireVendor, requireAdmin, resolveVendorId } from "../../lib/auth.guards.js";
import {
  CreateReturnRequestSchema,
  ReviewReturnRequestSchema,
  DisputeReturnRequestSchema,
} from "@nextdor/shared";

async function requireVendorAuth(req: FastifyRequest, reply: FastifyReply) {
  await requireVendor(req, reply);
  if (reply.sent) return;

  const authUser = req.authUser!;
  const vendorId = await resolveVendorId(authUser);

  if (!vendorId) {
    return reply.status(403).send({
      success: false,
      error: {
        code: "NO_VENDOR_STORE",
        message: "You are not associated with any active vendor store.",
      },
    });
  }

  req.authUser!.vendorId = vendorId;
}

export const returnRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/orders/:number/returns",
    {
      preHandler: requireAuth,
      schema: {
        description: "Submit a return or refund request for a delivered order within the 48h escrow window",
        tags: ["Returns & Refunds"],
        params: {
          type: "object",
          required: ["number"],
          properties: {
            number: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const parsed = CreateReturnRequestSchema.parse(req.body);
      const result = await returnService.requestReturn(number, parsed, req.authUser!);
      return reply.status(201).send({ success: true, data: result });
    }
  );

  app.get(
    "/my-returns",
    {
      preHandler: requireAuth,
      schema: {
        description: "Get current customer's return requests",
        tags: ["Returns & Refunds"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
          },
        },
      },
    },
    async (req) => {
      const { page, limit } = req.query as { page?: number; limit?: number };
      const data = await returnService.getCustomerReturns(req.authUser!.userId, page, limit);
      return { success: true, data };
    }
  );

  app.get(
    "/:id",
    {
      preHandler: requireAuth,
      schema: {
        description: "Get return request details by ID",
        tags: ["Returns & Refunds"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const data = await returnService.getReturnDetail(id, req.authUser!);
      return { success: true, data };
    }
  );

  app.post(
    "/:id/dispute",
    {
      preHandler: requireAuth,
      schema: {
        description: "Raise a dispute on a return claim to escalate to super-admin",
        tags: ["Returns & Refunds"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const parsed = DisputeReturnRequestSchema.parse(req.body);
      const data = await returnService.disputeReturn(id, parsed, req.authUser!);
      return { success: true, data };
    }
  );
};

export const vendorReturnRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/returns",
    {
      preHandler: requireVendorAuth,
      schema: {
        description: "Get vendor's incoming return claims",
        tags: ["Vendor Returns"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            status: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { page, limit, status } = req.query as { page?: number; limit?: number; status?: string };
      const data = await returnService.getVendorReturns(req.authUser!.vendorId!, page, limit, status);
      return { success: true, data };
    }
  );

  app.post(
    "/returns/:id/review",
    {
      preHandler: requireVendorAuth,
      schema: {
        description: "Approve or reject a customer return request",
        tags: ["Vendor Returns"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const parsed = ReviewReturnRequestSchema.parse(req.body);
      const data = await returnService.reviewReturn(id, parsed, req.authUser!);
      return { success: true, data };
    }
  );
};

export const adminReturnRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      preHandler: requireAdmin,
      schema: {
        description: "List all return claims and arbitration cases across the platform",
        tags: ["Admin Returns"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            status: { type: "string" },
            isDisputed: { type: "boolean" },
          },
        },
      },
    },
    async (req) => {
      const { page, limit, status, isDisputed } = req.query as {
        page?: number;
        limit?: number;
        status?: string;
        isDisputed?: boolean;
      };
      const data = await returnService.getAdminReturns(page, limit, status, isDisputed);
      return { success: true, data };
    }
  );

  app.post(
    "/:id/review",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin arbitration decision on return request or dispute",
        tags: ["Admin Returns"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const parsed = ReviewReturnRequestSchema.parse(req.body);
      const data = await returnService.reviewReturn(id, parsed, req.authUser!);
      return { success: true, data };
    }
  );
};
