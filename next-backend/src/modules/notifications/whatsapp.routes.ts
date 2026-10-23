/**
 * Meta WhatsApp Cloud API Webhook Routes & Notification Management.
 *
 * Provides:
 * 1. GET /api/v1/webhooks/whatsapp — Meta Webhook Subscription Verification (Challenge-Response)
 * 2. POST /api/v1/webhooks/whatsapp — Meta Delivery Statuses & Inbound Webhook Processing
 * 3. GET /api/v1/admin/notifications/logs — Super-Admin Notification Audit Trail
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../../lib/auth.guards.js";

/**
 * Validates Meta x-hub-signature-256 HMAC against the raw request body.
 */
function verifyMetaSignature(rawBody: string | undefined, signatureHeader: string | undefined): boolean {
  if (!config.WHATSAPP_APP_SECRET || config.WHATSAPP_APP_SECRET.includes("placeholder")) {
    // If app secret is not yet configured in development, bypass HMAC validation
    return true;
  }

  if (!rawBody || !signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const signature = parts[1];
  const expected = crypto
    .createHmac("sha256", config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const whatsappWebhookRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/webhooks/whatsapp
   * Endpoint verified by Meta Business Manager when configuring webhooks.
   */
  app.get(
    "/whatsapp",
    {
      schema: {
        description: "Meta WhatsApp Cloud API Webhook Verification Endpoint",
        tags: ["Notifications"],
        querystring: {
          type: "object",
          properties: {
            "hub.mode": { type: "string" },
            "hub.verify_token": { type: "string" },
            "hub.challenge": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{
      Querystring: {
        "hub.mode"?: string;
        "hub.verify_token"?: string;
        "hub.challenge"?: string;
      };
    }>, reply: FastifyReply) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      logger.info(
        { mode, tokenReceived: Boolean(token), configuredToken: Boolean(config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) },
        "Meta WhatsApp Webhook verification handshake received"
      );

      if (mode === "subscribe" && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        logger.info("Meta WhatsApp Webhook handshake successfully verified");
        return reply.status(200).type("text/plain").send(challenge || "");
      }

      logger.warn({ mode, token }, "Meta WhatsApp Webhook verification failed: token mismatch");
      return reply.status(403).send("Forbidden");
    }
  );

  /**
   * POST /api/v1/webhooks/whatsapp
   * Inbound delivery status receipts (sent, delivered, read, failed) from Meta.
   */
  app.post(
    "/whatsapp",
    {
      schema: {
        description: "Meta WhatsApp Inbound Delivery Receipts & Statuses",
        tags: ["Notifications"],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const rawBody = (req as any).rawBody;
      const signature = req.headers["x-hub-signature-256"] as string | undefined;

      if (!verifyMetaSignature(rawBody, signature)) {
        logger.warn({ ip: req.ip }, "Meta WhatsApp Webhook rejected: invalid HMAC signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const body = req.body as any;

      // Immediately respond 200 OK to Meta so it does not retry
      reply.status(200).send({ success: true });

      // Process delivery statuses asynchronously
      try {
        const entries = body?.entry || [];
        for (const entry of entries) {
          const changes = entry?.changes || [];
          for (const change of changes) {
            const value = change?.value;
            const statuses = value?.statuses || [];

            for (const statusObj of statuses) {
              const msgId = statusObj.id; // e.g. "wamid.HBgLMjMz..."
              const statusStr = statusObj.status; // "sent" | "delivered" | "read" | "failed"
              const recipientId = statusObj.recipient_id;

              if (msgId) {
                if (statusStr === "delivered" || statusStr === "read") {
                  await prisma.notificationLog.updateMany({
                    where: { providerMsgId: msgId },
                    data: {
                      status: "DELIVERED",
                      metadata: {
                        lastWebhookStatus: statusStr,
                        updatedAt: new Date().toISOString(),
                      },
                    },
                  }).catch(() => {});
                } else if (statusStr === "failed") {
                  const errorMsg = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || "Meta delivery failed";
                  await prisma.notificationLog.updateMany({
                    where: { providerMsgId: msgId },
                    data: {
                      status: "FAILED",
                      error: errorMsg,
                      metadata: {
                        errorDetails: statusObj.errors,
                        updatedAt: new Date().toISOString(),
                      },
                    },
                  }).catch(() => {});
                }
              }

              logger.info(
                { msgId, status: statusStr, recipientId },
                "Meta WhatsApp delivery status processed"
              );
            }
          }
        }
      } catch (err: any) {
        logger.error({ err: err?.message }, "Error processing WhatsApp webhook payload");
      }
    }
  );
};

export const adminNotificationRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/admin/notifications/logs
   * Super-Admin audit trail for notification deliveries across all channels.
   */
  app.get(
    "/logs",
    {
      preHandler: [requireAuth, requireSuperAdmin],
      schema: {
        description: "Fetch notification audit logs across WhatsApp, Email, and SMS (Super Admin)",
        tags: ["Admin"],
        querystring: {
          type: "object",
          properties: {
            channel: { type: "string", enum: ["WHATSAPP", "EMAIL", "SMS"] },
            status: { type: "string", enum: ["DISPATCHED", "DELIVERED", "FAILED", "FALLBACK_TRIGGERED"] },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (req: any, reply: FastifyReply) => {
      const { channel, status, page = 1, limit = 20 } = (req.query || {}) as {
        channel?: "WHATSAPP" | "EMAIL" | "SMS";
        status?: "DISPATCHED" | "DELIVERED" | "FAILED" | "FALLBACK_TRIGGERED";
        page?: number;
        limit?: number;
      };
      const skip = (page - 1) * limit;

      const where: any = {};
      if (channel) where.channel = channel;
      if (status) where.status = status;

      const [total, logs] = await Promise.all([
        prisma.notificationLog.count({ where }),
        prisma.notificationLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }
  );
};
