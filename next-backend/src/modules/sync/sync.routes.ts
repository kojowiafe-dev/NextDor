/**
 * WooCommerce Sync Routes.
 */

import type { FastifyPluginAsync } from "fastify";
import { SyncService } from "./sync.service.js";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /sync/wc
   * Triggers background synchronization from WooCommerce. Returns immediately.
   */
  app.post(
    "/wc",
    {
      schema: {
        description: "Trigger background catalog sync from WooCommerce",
        tags: ["Sync"],
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
      const { started, message } = SyncService.startBackgroundSync();
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
