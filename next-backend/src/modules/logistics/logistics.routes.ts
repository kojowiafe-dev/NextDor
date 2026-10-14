import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { LogisticsService } from "./logistics.service.js";
import { LogisticsRepository } from "./logistics.repository.js";
import { requireAdmin, requireAuth } from "../../lib/auth.guards.js";
import {
  DeliveryQuoteRequestSchema,
  CreateDeliveryZoneSchema,
  UpdateDeliveryZoneSchema,
  CreateShipmentSchema,
  CourierWebhookPayloadSchema,
} from "@nextdor/shared";

export const logisticsRepo = new LogisticsRepository();
export const logisticsService = new LogisticsService(logisticsRepo);

export const logisticsRoutes: FastifyPluginAsync = async (app) => {
  // ─── Public Delivery Quote ──────────────────────────────────────────────────
  app.post(
    "/quote",
    {
      schema: {
        description: "Calculate dynamic delivery options and geo-priced fees",
        tags: ["Logistics & Delivery"],
        body: {
          type: "object",
          required: ["region"],
          properties: {
            region: { type: "string" },
            district: { type: "string" },
            postcode: { type: "string" },
            digitalAddress: { type: "string" },
            weightKg: { type: "number" },
            method: { type: "string", enum: ["STANDARD", "EXPRESS", "PICKUP"] },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = DeliveryQuoteRequestSchema.parse(req.body);
      const quotes = await logisticsService.calculateQuote(parsed);
      return reply.send({ success: true, data: quotes });
    }
  );

  // ─── Public Shipment Tracking ───────────────────────────────────────────────
  app.get(
    "/track/:trackingNumber",
    {
      schema: {
        description: "Public real-time tracking timeline for a package",
        tags: ["Logistics & Delivery"],
        params: {
          type: "object",
          required: ["trackingNumber"],
          properties: {
            trackingNumber: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { trackingNumber } = req.params as { trackingNumber: string };
      const tracking = await logisticsService.trackShipment(trackingNumber);
      return reply.send({ success: true, data: tracking });
    }
  );

  // ─── Order Shipments ────────────────────────────────────────────────────────
  app.get(
    "/orders/:orderId/shipments",
    {
      preHandler: requireAuth,
      schema: {
        description: "List courier dispatches and shipments for an order",
        tags: ["Logistics & Delivery"],
        params: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const { orderId } = req.params as { orderId: string };
      const shipments = await logisticsService.getOrderShipments(orderId);
      return reply.send({ success: true, data: shipments });
    }
  );

  // ─── Inbound Courier Webhooks (Fez / Kwik / DHL / Internal) ─────────────────
  app.post(
    "/webhooks/courier",
    {
      schema: {
        description: "Inbound webhook for real-time courier milestone updates",
        tags: ["Logistics & Delivery"],
      },
    },
    async (req, reply) => {
      const parsed = CourierWebhookPayloadSchema.parse(req.body);
      const result = await logisticsService.processCourierWebhook(parsed);
      return reply.send({ success: true, data: result });
    }
  );

  app.post(
    "/webhooks/:carrier",
    {
      schema: {
        description: "Carrier-specific webhook endpoint for courier milestone updates",
        tags: ["Logistics & Delivery"],
        params: {
          type: "object",
          required: ["carrier"],
          properties: {
            carrier: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { carrier } = req.params as { carrier: string };
      const raw = (req.body ?? {}) as Record<string, any>;
      // Normalize carrier if not in body
      const bodyWithCarrier = {
        ...raw,
        carrier: raw.carrier || carrier.toUpperCase(),
      };
      const parsed = CourierWebhookPayloadSchema.parse(bodyWithCarrier);
      const result = await logisticsService.processCourierWebhook(parsed);
      return reply.send({ success: true, data: result });
    }
  );

  // ─── Admin Zone & Dispatch Endpoints ─────────────────────────────────────────
  app.get(
    "/zones",
    {
      schema: {
        description: "List all delivery zones and dynamic pricing rates",
        tags: ["Logistics & Delivery"],
      },
    },
    async (_req, reply) => {
      const zones = await logisticsService.listZones();
      return reply.send({ success: true, data: zones });
    }
  );

  app.post(
    "/zones",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Create a new regional delivery zone and rate matrix",
        tags: ["Logistics & Delivery"],
      },
    },
    async (req, reply) => {
      const parsed = CreateDeliveryZoneSchema.parse(req.body);
      const zone = await logisticsService.createZone(parsed);
      return reply.status(201).send({ success: true, data: zone });
    }
  );

  app.get(
    "/zones/:id",
    {
      schema: {
        description: "Get delivery zone details by ID",
        tags: ["Logistics & Delivery"],
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
      const zone = await logisticsService.getZone(id);
      return reply.send({ success: true, data: zone });
    }
  );

  app.patch(
    "/zones/:id",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Update delivery zone or rates",
        tags: ["Logistics & Delivery"],
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
      const parsed = UpdateDeliveryZoneSchema.parse(req.body);
      const updated = await logisticsService.updateZone(id, parsed);
      return reply.send({ success: true, data: updated });
    }
  );

  app.post(
    "/shipments",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Dispatch order and create courier shipment tracking record",
        tags: ["Logistics & Delivery"],
      },
    },
    async (req, reply) => {
      const parsed = CreateShipmentSchema.parse(req.body);
      const shipment = await logisticsService.dispatchShipment(parsed);
      return reply.status(201).send({ success: true, data: shipment });
    }
  );
};
