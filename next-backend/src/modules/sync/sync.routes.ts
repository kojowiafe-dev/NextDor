/**
 * WooCommerce Sync Routes.
 */

import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { SyncService } from "./sync.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ForbiddenError } from "../../lib/errors.js";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /sync/wc
   * Triggers background synchronization from WooCommerce. Returns immediately.
   * FIX #19: Protected by Admin JWT or x-sync-secret header to prevent unauthorized triggers.
   */
  app.post(
    "/wc",
    {
      schema: {
        description: "Trigger background catalog sync from WooCommerce",
        tags: ["Sync"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  started: { type: "boolean" },
                  message: { type: "string" },
                  status: {
                    type: "object",
                    properties: {
                      isSyncing: { type: "boolean" },
                      progress: { type: "string" },
                      totalFetched: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      // Check for x-sync-secret header or Admin bearer token.
      // SECURITY: JWT_SECRET is NEVER accepted here (secret reuse would let anyone who
      // obtains it forge tokens AND trigger syncs). Only a dedicated SYNC_SECRET (>= 32 chars)
      // compared in constant time.
      const syncSecret = req.headers["x-sync-secret"];
      const configuredSecret = process.env.SYNC_SECRET;
      let isAuthorized = false;

      if (
        typeof syncSecret === "string" &&
        configuredSecret &&
        configuredSecret.length >= 32 &&
        syncSecret.length === configuredSecret.length &&
        crypto.timingSafeEqual(Buffer.from(syncSecret), Buffer.from(configuredSecret))
      ) {
        isAuthorized = true;
      } else {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          try {
            const payload = AuthService.verifyAccessToken(authHeader.slice(7));
            if (payload.role === "ADMIN" || payload.role === "SUPER_ADMIN") {
              isAuthorized = true;
            }
          } catch {
            // Invalid token
          }
        }
      }

      if (!isAuthorized) {
        throw new ForbiddenError("Admin authorization or valid x-sync-secret required.");
      }

      const { started, message } = await SyncService.startBackgroundSync();
      const status = SyncService.getStatus();

      return reply.send({
        success: true,
        data: {
          started,
          message,
          status,
        },
      });
    },
  );

  /**
   * GET /sync/status
   * Polls live sync progress.
   */
  app.get(
    "/status",
    {
      schema: {
        description: "Get current status of WooCommerce catalog synchronization",
        tags: ["Sync"],
      },
    },
    async (req, reply) => {
      const status = SyncService.getStatus();
      return reply.send({
        success: true,
        data: status,
      });
    },
  );
};
