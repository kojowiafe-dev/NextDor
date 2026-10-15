import { InventoryRepository } from "./inventory.repository.js";
import { EmailService } from "../../lib/email.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import { SmsService } from "../../lib/sms.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  UnprocessableError,
} from "../../lib/errors.js";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  SetWarehouseStockInput,
  AdjustStockInput,
  StockTransferInput,
  BackorderConfigInput,
  StockAlertQuery,
  StockMovementQuery,
  WarehouseQuery,
} from "@nextdor/shared";

export class InventoryService {
  constructor(private readonly repo: InventoryRepository) {}

  // ═══════════════════════════════════════════════════════════════════
  // WAREHOUSES & LOCATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a warehouse / fulfillment location.
   */
  async createWarehouse(input: CreateWarehouseInput, vendorId?: string) {
    const existingCode = await this.repo.findWarehouseByCode(input.code);
    if (existingCode) {
      throw new BadRequestError(`Warehouse code "${input.code}" already exists.`);
    }

    return this.repo.createWarehouse({
      ...input,
      vendorId: vendorId ?? input.vendorId,
    });
  }

  /**
   * List warehouses.
   */
  async listWarehouses(query: WarehouseQuery, vendorId?: string) {
    return this.repo.listWarehouses({
      ...query,
      vendorId: vendorId ?? query.vendorId,
    });
  }

  /**
   * Get single warehouse by ID.
   */
  async getWarehouse(id: string, vendorId?: string) {
    const warehouse = await this.repo.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }
    if (vendorId && warehouse.vendorId && warehouse.vendorId !== vendorId) {
      throw new NotFoundError("Warehouse not found for this vendor");
    }
    return warehouse;
  }

  /**
   * Update warehouse details.
   */
  async updateWarehouse(
    id: string,
    input: UpdateWarehouseInput,
    vendorId?: string
  ) {
    if (input.code) {
      const existing = await this.repo.findWarehouseByCode(input.code);
      if (existing && existing.id !== id) {
        throw new BadRequestError(`Warehouse code "${input.code}" is already in use.`);
      }
    }

    return this.repo.updateWarehouse(id, input, vendorId);
  }

  /**
   * Soft-delete a warehouse.
   */
  async deleteWarehouse(id: string, vendorId?: string) {
    return this.repo.softDeleteWarehouse(id, vendorId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STOCK ALLOCATION & MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Set or update stock quantity at a specific warehouse.
   */
  async setWarehouseStock(input: SetWarehouseStockInput, performedBy?: string) {
    const warehouse = await this.repo.findWarehouseById(input.warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, vendorId: true },
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const updated = await this.repo.setWarehouseStock({
      ...input,
      performedBy,
    });

    // Check if stock dropped below threshold and trigger notification
    if (input.quantity <= (input.lowStockThreshold ?? 5)) {
      this.dispatchLowStockNotification({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        threshold: input.lowStockThreshold ?? 5,
        vendorId: product.vendorId,
      }).catch((err) => {
        logger.warn({ err, productId: product.id }, "Failed to dispatch low-stock notification");
      });
    }

    return updated;
  }

  /**
   * Manually adjust stock (+ or -) with audit log.
   */
  async adjustStock(input: AdjustStockInput, performedBy?: string) {
    const updated = await this.repo.adjustStock({
      ...input,
      performedBy,
    });

    const warehouse = await this.repo.findWarehouseById(input.warehouseId);
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, vendorId: true },
    });

    if (warehouse && product && updated.quantity <= updated.lowStockThreshold) {
      this.dispatchLowStockNotification({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        productId: product.id,
        productName: product.name,
        quantity: updated.quantity,
        threshold: updated.lowStockThreshold,
        vendorId: product.vendorId,
      }).catch((err) => {
        logger.warn({ err, productId: product.id }, "Failed to dispatch low-stock alert");
      });
    }

    return updated;
  }

  /**
   * Inter-warehouse transfer with conservation verification.
   */
  async transferStock(input: StockTransferInput, performedBy?: string) {
    return this.repo.transferStock({
      ...input,
      performedBy,
    });
  }

  /**
   * Get multi-location stock breakdown for a product.
   */
  async getProductStockBreakdown(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockStatus: true,
        stockQty: true,
        allowBackorder: true,
        backorderLimit: true,
        backorderCount: true,
        expectedRestockDate: true,
        isPreOrder: true,
        preOrderReleaseDate: true,
      },
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const locations = await this.repo.listStockByProduct(productId);
    const totalPhysical = locations.reduce((sum, loc) => sum + loc.quantity, 0);
    const totalReserved = locations.reduce((sum, loc) => sum + loc.reservedQuantity, 0);

    return {
      product,
      totalPhysical,
      totalReserved,
      availablePhysical: Math.max(0, totalPhysical - totalReserved),
      locations,
    };
  }

  /**
   * List all stocks inside a specific warehouse.
   */
  async getWarehouseStockList(warehouseId: string) {
    const warehouse = await this.repo.findWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }

    const items = await this.repo.listStockByWarehouse(warehouseId);
    return {
      warehouse,
      totalItems: items.length,
      totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
    };
  }

  /**
   * View immutable stock movement audit ledger.
   */
  async listMovements(query: StockMovementQuery) {
    return this.repo.listMovements(query);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BACKORDERS & PRE-ORDERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Configure backorders and pre-orders for a product.
   */
  async configureBackorders(input: BackorderConfigInput, vendorId?: string) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, vendorId: true },
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (vendorId && product.vendorId && product.vendorId !== vendorId) {
      throw new NotFoundError("Product does not belong to vendor");
    }

    const updated = await this.repo.updateBackorderConfig(input.productId, {
      allowBackorder: input.allowBackorder,
      backorderLimit: input.backorderLimit,
      expectedRestockDate: input.expectedRestockDate ? new Date(input.expectedRestockDate) : null,
      isPreOrder: input.isPreOrder,
      preOrderReleaseDate: input.preOrderReleaseDate ? new Date(input.preOrderReleaseDate) : null,
    });

    // Re-sync aggregated status
    await this.repo.syncAggregatedProductStock(input.productId);

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ALERTS & AUTOMATED WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * List stock alerts.
   */
  async listAlerts(query: StockAlertQuery, vendorId?: string) {
    return this.repo.listAlerts({
      ...query,
      vendorId: vendorId ?? query.vendorId,
    });
  }

  /**
   * Resolve an alert.
   */
  async resolveAlert(alertId: string, notes: string, vendorId?: string) {
    return this.repo.resolveAlert(alertId, notes, vendorId);
  }

  /**
   * Automated scan: check all products for low stock or out of stock across active warehouses.
   */
  async runAutomatedStockAudit() {
    const lowStocks = await prisma.warehouseStock.findMany({
      where: {
        warehouse: { deletedAt: null, isActive: true },
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, name: true, vendorId: true } },
      },
    });

    const triggeredAlerts = [];

    for (const item of lowStocks) {
      if (item.quantity <= item.lowStockThreshold) {
        await this.repo.createOrUpdateAlert({
          warehouseId: item.warehouseId,
          productId: item.productId,
          vendorId: item.product.vendorId,
          alertType: item.quantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          threshold: item.lowStockThreshold,
          currentStock: item.quantity,
          notes: `Automated audit: ${item.quantity <= 0 ? "Out of stock" : "Low stock"} detected.`,
        });

        triggeredAlerts.push({
          productId: item.productId,
          productName: item.product.name,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse.name,
          currentStock: item.quantity,
          threshold: item.lowStockThreshold,
        });

        // Fire notification in background
        this.dispatchLowStockNotification({
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse.name,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          threshold: item.lowStockThreshold,
          vendorId: item.product.vendorId,
        }).catch((err) => {
          logger.warn({ err, productId: item.productId }, "Failed to dispatch audit notification");
        });
      }
    }

    return {
      auditedLocationsCount: lowStocks.length,
      triggeredAlertsCount: triggeredAlerts.length,
      triggeredAlerts,
    };
  }

  /**
   * Dispatch multi-channel notification (Email + SMS) to merchant and admins when low stock is hit.
   */
  private async dispatchLowStockNotification(params: {
    warehouseId: string;
    warehouseName: string;
    productId: string;
    productName: string;
    quantity: number;
    threshold: number;
    vendorId?: string | null;
  }) {
    logger.info(
      {
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: params.quantity,
        threshold: params.threshold,
      },
      "🚨 INVENTORY ALERT: Low stock threshold reached"
    );

    let notifyEmail: string | null = null;
    let notifyPhone: string | null = null;
    let vendorName = "Platform Flagship";

    if (params.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: params.vendorId },
        select: {
          name: true,
          email: true,
          phone: true,
          lowStockAlertEmail: true,
          lowStockAlertPhone: true,
          enableLowStockAlerts: true,
        },
      });

      if (vendor && vendor.enableLowStockAlerts) {
        vendorName = vendor.name;
        notifyEmail = vendor.lowStockAlertEmail || vendor.email;
        notifyPhone = vendor.lowStockAlertPhone || vendor.phone;
      }
    }

    const isOutOfStock = params.quantity <= 0;
    const alertSubject = isOutOfStock
      ? `🚨 [NextDor Alert] OUT OF STOCK: "${params.productName}" at ${params.warehouseName}`
      : `⚠️ [NextDor Alert] LOW STOCK: "${params.productName}" (${params.quantity} left) at ${params.warehouseName}`;

    // 1. Send SMS if phone number available
    if (notifyPhone) {
      const smsText = isOutOfStock
        ? `NextDor Alert: "${params.productName}" is OUT OF STOCK at ${params.warehouseName}. Please restock immediately.`
        : `NextDor Alert: "${params.productName}" is low on stock (${params.quantity} left, threshold ${params.threshold}) at ${params.warehouseName}.`;

      await SmsService.sendSms(notifyPhone, smsText).catch((err) => {
        logger.warn({ err, notifyPhone }, "Failed to send low stock SMS");
      });
    }

    // 2. Send Email if email address available
    if (notifyEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: ${isOutOfStock ? "#dc2626" : "#d97706"}; margin-top: 0;">
            ${isOutOfStock ? "🚨 Out of Stock Warning" : "⚠️ Low Stock Notice"}
          </h2>
          <p>Hello <strong>${vendorName}</strong>,</p>
          <p>This is an automated notification from your NextDor inventory monitoring engine.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Product:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${params.productName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Location / Hub:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${params.warehouseName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Current Available Stock:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: ${isOutOfStock ? "#dc2626" : "#d97706"}; font-weight: bold;">
                ${params.quantity} units
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Alert Threshold:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${params.threshold} units</td>
            </tr>
          </table>

          <p>Please log in to your NextDor Vendor Portal or Warehouse Management console to transfer units or update your restock window.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280;">NextDor Ghana Marketplace — Enterprise Multi-Warehouse Logistics & Inventory</p>
        </div>
      `;

      dispatchEmailAsync({
        type: "low_stock_alert",
        params: {
          vendorEmail: notifyEmail,
          storeName: vendorName,
          sku: params.sku,
          productName: params.productName,
          currentStock: params.quantity,
          threshold: params.threshold,
          warehouseName: params.warehouseName,
        },
      }).catch((err) => {
        logger.warn({ err, notifyEmail }, "Failed to queue low stock email");
      });
    }
  }
}
