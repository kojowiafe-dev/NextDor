/**
 * WooCommerce Sync Routes.
 */

import type { FastifyPluginAsync } from "fastify";
import { SyncService } from "./sync.service.js";
import { AuthService } from "../auth/auth.service.js";
import { config } from "../../config/env.js";
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
      // Check for x-sync-secret header or Admin bearer token
      const syncSecret = req.headers["x-sync-secret"];
      let isAuthorized = false;

      if (syncSecret && (syncSecret === config.JWT_SECRET || syncSecret === process.env.SYNC_SECRET)) {
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
