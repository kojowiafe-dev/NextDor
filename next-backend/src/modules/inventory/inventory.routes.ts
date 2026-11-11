import type { FastifyPluginAsync } from "fastify";
import { InventoryRepository } from "./inventory.repository.js";
import { InventoryService } from "./inventory.service.js";
import {
  requireAuth,
  requireAdmin,
  requireVendor,
  resolveVendorId,
  ADMIN_ROLES,
  type AuthUser,
} from "../../lib/auth.guards.js";
import { ForbiddenError } from "../../lib/errors.js";
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  SetWarehouseStockSchema,
  AdjustStockSchema,
  StockTransferSchema,
  BackorderConfigSchema,
  StockAlertQuerySchema,
  StockMovementQuerySchema,
  WarehouseQuerySchema,
  ResolveAlertSchema,
} from "@nextdor/shared";

/**
 * SECURITY: Resolves the tenant scope for inventory operations.
 *  - Admins → undefined (platform-wide access)
 *  - Vendors → their own vendorId
 *  - Vendor-role users without a store → 403 (previously they silently got admin scope)
 */
async function resolveInventoryScope(user: AuthUser): Promise<string | undefined> {
  if (ADMIN_ROLES.includes(user.role as any)) return undefined;
  const vendorId = await resolveVendorId(user);
  if (!vendorId) {
    throw new ForbiddenError("You are not associated with any active vendor store.");
  }
  return vendorId;
}

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  const repo = new InventoryRepository();
  const service = new InventoryService(repo);

  // ═══════════════════════════════════════════════════════════════════
  // WAREHOUSES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/inventory/warehouses
   * List warehouses with filtering.
   */
  app.get(
    "/warehouses",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "List fulfillment warehouses and depots",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const query = WarehouseQuerySchema.parse(req.query);
      const vendorId = await resolveInventoryScope(req.authUser!);

      const warehouses = await service.listWarehouses(query, vendorId);
      return reply.send({ success: true, data: { warehouses } });
    }
  );

  /**
   * GET /api/v1/inventory/warehouses/:id
   * Get single warehouse details with stock summary.
   */
  app.get(
    "/warehouses/:id",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Get single warehouse details and stored inventory",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const vendorId = await resolveInventoryScope(req.authUser!);

      const warehouse = await service.getWarehouse(id, vendorId);
      const stockSummary = await service.getWarehouseStockList(id);

      // Vendors only see their own SKUs inside shared warehouses
      if (vendorId) {
        const ownItems = (stockSummary.items as any[]).filter((i) => i.product?.vendorId === vendorId);
        stockSummary.items = ownItems as any;
        stockSummary.totalItems = ownItems.length;
        stockSummary.totalUnits = ownItems.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
      }

      return reply.send({
        success: true,
        data: { warehouse, stockSummary },
      });
    }
  );

  /**
   * POST /api/v1/inventory/warehouses
   * Create a new fulfillment location (Admin or Vendor).
   */
  app.post(
    "/warehouses",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Create a new warehouse or fulfillment hub",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const body = CreateWarehouseSchema.parse(req.body);
      const vendorId = await resolveInventoryScope(req.authUser!);

      const warehouse = await service.createWarehouse(body, vendorId);
      return reply.status(201).send({ success: true, data: { warehouse } });
    }
  );

  /**
   * PATCH /api/v1/inventory/warehouses/:id
   * Update warehouse details.
   */
  app.patch(
    "/warehouses/:id",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Update warehouse details",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = UpdateWarehouseSchema.parse(req.body);
      const vendorId = await resolveInventoryScope(req.authUser!);
      if (vendorId) await service.getWarehouse(id, vendorId);

      const warehouse = await service.updateWarehouse(id, body, vendorId);
      return reply.send({ success: true, data: { warehouse } });
    }
  );

  /**
   * DELETE /api/v1/inventory/warehouses/:id
   * Soft-delete warehouse.
   */
  app.delete(
    "/warehouses/:id",
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        description: "Soft-delete warehouse (Admin only)",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await service.deleteWarehouse(id);
      return reply.send({ success: true, message: "Warehouse soft-deleted successfully" });
    }
  );

  // ═══════════════════════════════════════════════════════════════════
  // STOCK ALLOCATION & MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/inventory/products/:productId/stock
   * View multi-location stock breakdown for a product.
   */
  app.get(
    "/products/:productId/stock",
    {
      schema: {
        description: "View multi-location inventory levels for a product",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { productId } = req.params as { productId: string };
      const breakdown = await service.getProductStockBreakdown(productId);
      return reply.send({ success: true, data: breakdown });
    }
  );

  /**
   * POST /api/v1/inventory/stock/set
   * Set or initialize stock level for a SKU at a warehouse.
   */
  app.post(
    "/stock/set",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Set on-shelf stock quantity at a warehouse",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const body = SetWarehouseStockSchema.parse(req.body);
      const authUser = req.authUser!;
      const vendorId = await resolveInventoryScope(authUser);
      await service.assertStockAccess(vendorId, body.productId, [body.warehouseId]);

      const stock = await service.setWarehouseStock(body, authUser.userId);
      return reply.send({ success: true, data: { stock } });
    }
  );

  /**
   * POST /api/v1/inventory/stock/adjust
   * Manually adjust stock with mandatory reason.
   */
  app.post(
    "/stock/adjust",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Manually adjust stock (+ or -) with audit log",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const body = AdjustStockSchema.parse(req.body);
      const authUser = req.authUser!;
      const vendorId = await resolveInventoryScope(authUser);
      await service.assertStockAccess(vendorId, body.productId, [body.warehouseId]);

      const stock = await service.adjustStock(body, authUser.userId);
      return reply.send({ success: true, data: { stock } });
    }
  );

  /**
   * POST /api/v1/inventory/stock/transfer
   * Transfer units between two warehouses with conservation checks.
   */
  app.post(
    "/stock/transfer",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Transfer stock between warehouses",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const body = StockTransferSchema.parse(req.body);
      const authUser = req.authUser!;
      const vendorId = await resolveInventoryScope(authUser);
      await service.assertStockAccess(vendorId, body.productId, [
        body.sourceWarehouseId,
        body.destinationWarehouseId,
      ]);

      const result = await service.transferStock(body, authUser.userId);
      return reply.send({ success: true, data: result });
    }
  );

  /**
   * POST /api/v1/inventory/products/:productId/backorder
   * Configure backorder and pre-order parameters.
   */
  app.post(
    "/products/:productId/backorder",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Configure backorders and pre-order settings for a product",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { productId } = req.params as { productId: string };
      const body = BackorderConfigSchema.parse({
        ...req.body as Record<string, unknown>,
        productId,
      });
      const vendorId = await resolveInventoryScope(req.authUser!);
      if (vendorId) await service.assertStockAccess(vendorId, productId, []);

      const product = await service.configureBackorders(body, vendorId);
      return reply.send({ success: true, data: { product } });
    }
  );

  /**
   * GET /api/v1/inventory/movements
   * View immutable stock movement audit ledger.
   */
  app.get(
    "/movements",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "View stock movement audit ledger",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const query = StockMovementQuerySchema.parse(req.query);
      const vendorId = await resolveInventoryScope(req.authUser!);
      // Vendors may only read the ledger for one of their own products
      if (vendorId) {
        if (!query.productId) {
          throw new ForbiddenError("Vendors must filter the stock ledger by one of their own products (productId).");
        }
        await service.assertStockAccess(vendorId, query.productId, []);
      }
      const result = await service.listMovements(query);
      return reply.send({ success: true, data: result });
    }
  );

  // ═══════════════════════════════════════════════════════════════════
  // ALERTS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/inventory/alerts
   * List low-stock and out-of-stock alerts.
   */
  app.get(
    "/alerts",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "List low-stock and out-of-stock alerts",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const query = StockAlertQuerySchema.parse(req.query);
      const vendorId = await resolveInventoryScope(req.authUser!);

      const result = await service.listAlerts(vendorId ? { ...query, vendorId } : query, vendorId);
      return reply.send({ success: true, data: result });
    }
  );

  /**
   * PATCH /api/v1/inventory/alerts/:id/resolve
   * Manually mark an alert as resolved.
   */
  app.patch(
    "/alerts/:id/resolve",
    {
      preHandler: [requireAuth, requireVendor],
      schema: {
        description: "Mark a stock alert as resolved",
        tags: ["Inventory"],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = ResolveAlertSchema.parse(req.body);
      const vendorId = await resolveInventoryScope(req.authUser!);

      const alert = await service.resolveAlert(id, body.notes, vendorId);
      return reply.send({ success: true, data: { alert } });
    }
  );

  /**
   * POST /api/v1/inventory/webhooks/trigger-audit
   * Run automated stock audit sweep across all active warehouses.
   */
  app.post(
    "/webhooks/trigger-audit",
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        description: "Trigger automated low-stock audit across all active locations (Admin)",
        tags: ["Inventory"],
      },
    },
    async (_req, reply) => {
      const summary = await service.runAutomatedStockAudit();
      return reply.send({ success: true, data: summary });
    }
  );
};
