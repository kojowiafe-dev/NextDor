import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import type {
  StockMovementType,
  StockAlertType,
  StockAlertStatus,
  StockStatus,
} from "@prisma/client";
import { NotFoundError, BadRequestError, UnprocessableError } from "../../lib/errors.js";

export class InventoryRepository {
  /**
   * Create a new warehouse / fulfillment hub.
   */
  async createWarehouse(data: {
    name: string;
    code: string;
    address: string;
    city: string;
    region: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    isDefault?: boolean;
    isActive?: boolean;
    vendorId?: string;
  }) {
    if (data.isDefault) {
      // If setting this as default, unset previous default for this tenant/vendor
      await prisma.warehouse.updateMany({
        where: { vendorId: data.vendorId ?? null, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address,
        city: data.city,
        region: data.region,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        vendorId: data.vendorId ?? null,
      },
      include: {
        vendor: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Find warehouse by unique ID.
   */
  async findWarehouseById(id: string) {
    return prisma.warehouse.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, slug: true } },
        _count: { select: { stocks: true, alerts: true } },
      },
    });
  }

  /**
   * Find warehouse by unique code.
   */
  async findWarehouseByCode(code: string) {
    return prisma.warehouse.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        vendor: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * List warehouses with filtering and multi-tenant scoping.
   */
  async listWarehouses(filter: {
    vendorId?: string;
    city?: string;
    region?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.WarehouseWhereInput = {
      deletedAt: null,
      ...(filter.vendorId !== undefined ? { vendorId: filter.vendorId } : {}),
      ...(filter.city ? { city: { equals: filter.city, mode: "insensitive" } } : {}),
      ...(filter.region ? { region: { equals: filter.region, mode: "insensitive" } } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { code: { contains: filter.search, mode: "insensitive" } },
              { address: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return prisma.warehouse.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        vendor: { select: { id: true, name: true, slug: true } },
        _count: { select: { stocks: true, alerts: { where: { status: "ACTIVE" } } } },
      },
    });
  }

  /**
   * Update warehouse details.
   */
  async updateWarehouse(
    id: string,
    data: Prisma.WarehouseUpdateInput,
    vendorId?: string
  ) {
    const where: Prisma.WarehouseWhereUniqueInput = { id };
    if (vendorId) {
      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing || (existing.vendorId && existing.vendorId !== vendorId)) {
        throw new NotFoundError("Warehouse not found or not owned by vendor");
      }
    }

    if (data.isDefault === true) {
      const current = await prisma.warehouse.findUnique({ where: { id }, select: { vendorId: true } });
      await prisma.warehouse.updateMany({
        where: { vendorId: current?.vendorId ?? null, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.warehouse.update({
      where,
      data,
      include: {
        vendor: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Soft-delete a warehouse.
   */
  async softDeleteWarehouse(id: string, vendorId?: string) {
    const where: Prisma.WarehouseWhereUniqueInput = { id };
    if (vendorId) {
      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing || (existing.vendorId && existing.vendorId !== vendorId)) {
        throw new NotFoundError("Warehouse not found or not owned by vendor");
      }
    }

    return prisma.warehouse.update({
      where,
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // STOCK ALLOCATION & AUDIT LEDGER
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get stock breakdown for a specific product across all locations.
   */
  async listStockByProduct(productId: string) {
    return prisma.warehouseStock.findMany({
      where: {
        productId,
        warehouse: { deletedAt: null, isActive: true },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            region: true,
            isDefault: true,
          },
        },
      },
      orderBy: [{ warehouse: { isDefault: "desc" } }, { quantity: "desc" }],
    });
  }

  /**
   * Get stock of all products within a specific warehouse.
   */
  async listStockByWarehouse(warehouseId: string) {
    return prisma.warehouseStock.findMany({
      where: { warehouseId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            stockStatus: true,
            allowBackorder: true,
            expectedRestockDate: true,
          },
        },
      },
      orderBy: [{ quantity: "asc" }],
    });
  }

  /**
   * Set or update initial stock level for a product in a warehouse.
   * Atomically records a movement in the audit ledger and syncs the product aggregate.
   */
  async setWarehouseStock(input: {
    warehouseId: string;
    productId: string;
    quantity: number;
    lowStockThreshold?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    binLocation?: string;
    performedBy?: string;
    reason?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: input.warehouseId,
            productId: input.productId,
          },
        },
      });

      const oldQuantity = existing?.quantity ?? 0;
      const delta = input.quantity - oldQuantity;

      const updated = await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: input.warehouseId,
            productId: input.productId,
          },
        },
        create: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          quantity: input.quantity,
          lowStockThreshold: input.lowStockThreshold ?? 5,
          reorderPoint: input.reorderPoint,
          reorderQuantity: input.reorderQuantity,
          binLocation: input.binLocation,
        },
        update: {
          quantity: input.quantity,
          ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
          ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
          ...(input.reorderQuantity !== undefined ? { reorderQuantity: input.reorderQuantity } : {}),
          ...(input.binLocation !== undefined ? { binLocation: input.binLocation } : {}),
        },
      });

      // Record movement in audit ledger if quantity changed
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            warehouseId: input.warehouseId,
            productId: input.productId,
            type: delta > 0 ? "RESTOCK" : "MANUAL_ADJUSTMENT",
            quantityDelta: delta,
            quantityBefore: oldQuantity,
            quantityAfter: input.quantity,
            notes: input.reason ?? "Stock level updated manually",
            performedBy: input.performedBy,
          },
        });
      }

      // Check low-stock threshold trigger
      await this.evaluateStockAlertInTx(tx, {
        warehouseId: input.warehouseId,
        productId: input.productId,
        quantity: input.quantity,
        threshold: updated.lowStockThreshold,
      });

      // Synchronize product aggregated stock status
      await this.syncAggregatedProductStockInTx(tx, input.productId);

      return updated;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });
  }

  /**
   * Manually adjust stock (+ or -) with mandatory audit reason.
   */
  async adjustStock(input: {
    warehouseId: string;
    productId: string;
    delta: number;
    type?: StockMovementType;
    reason: string;
    referenceId?: string;
    performedBy?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const stock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: input.warehouseId,
            productId: input.productId,
          },
        },
      });

      if (!stock) {
        throw new NotFoundError("Product stock record not found in the specified warehouse");
      }

      const newQuantity = stock.quantity + input.delta;
      if (newQuantity < 0) {
        throw new BadRequestError(
          `Cannot deduct ${Math.abs(input.delta)} units. Available physical stock is ${stock.quantity}.`
        );
      }

      const updated = await tx.warehouseStock.update({
        where: { id: stock.id },
        data: { quantity: newQuantity },
      });

      // Record immutable movement
      await tx.stockMovement.create({
        data: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          type: input.type ?? "MANUAL_ADJUSTMENT",
          quantityDelta: input.delta,
          quantityBefore: stock.quantity,
          quantityAfter: newQuantity,
          referenceId: input.referenceId,
          notes: input.reason,
          performedBy: input.performedBy,
        },
      });

      // Evaluate alert
      await this.evaluateStockAlertInTx(tx, {
        warehouseId: input.warehouseId,
        productId: input.productId,
        quantity: newQuantity,
        threshold: stock.lowStockThreshold,
      });

      // Sync aggregate
      await this.syncAggregatedProductStockInTx(tx, input.productId);

      return updated;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });
  }

  /**
   * Inter-warehouse transfer with conservation invariant:
   * Total stock across both warehouses before === Total stock after.
   */
  async transferStock(input: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    productId: string;
    quantity: number;
    notes?: string;
    transferReference?: string;
    performedBy?: string;
  }) {
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw new BadRequestError("Source and destination warehouses must be different");
    }
    if (input.quantity <= 0) {
      throw new BadRequestError("Transfer quantity must be greater than zero");
    }

    const ref = input.transferReference || `TRF-${Date.now().toString(36).toUpperCase()}`;

    return prisma.$transaction(async (tx) => {
      // 1. Fetch and lock source stock
      const sourceStock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: input.sourceWarehouseId,
            productId: input.productId,
          },
        },
      });

      if (!sourceStock || sourceStock.quantity < input.quantity) {
        throw new UnprocessableError(
          `Insufficient stock at source warehouse. Available: ${sourceStock?.quantity ?? 0}, Requested: ${input.quantity}`
        );
      }

      // 2. Fetch destination stock (or create if not yet existing)
      const destStock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: input.destinationWarehouseId,
            productId: input.productId,
          },
        },
      });

      const destOldQty = destStock?.quantity ?? 0;
      const sourceOldQty = sourceStock.quantity;

      // 3. Decrement source
      const updatedSource = await tx.warehouseStock.update({
        where: { id: sourceStock.id },
        data: { quantity: sourceStock.quantity - input.quantity },
      });

      // 4. Increment destination
      const updatedDest = await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: input.destinationWarehouseId,
            productId: input.productId,
          },
        },
        create: {
          warehouseId: input.destinationWarehouseId,
          productId: input.productId,
          quantity: input.quantity,
          lowStockThreshold: sourceStock.lowStockThreshold,
        },
        update: {
          quantity: { increment: input.quantity },
        },
      });

      // 5. Invariant check: Conservation of units
      const totalBefore = sourceOldQty + destOldQty;
      const totalAfter = updatedSource.quantity + updatedDest.quantity;
      if (totalBefore !== totalAfter) {
        throw new Error(
          `Stock transfer invariant violated! Before: ${totalBefore}, After: ${totalAfter}`
        );
      }

      // 6. Record movement logs for both sides
      await tx.stockMovement.createMany({
        data: [
          {
            warehouseId: input.sourceWarehouseId,
            productId: input.productId,
            type: "TRANSFER_OUT",
            quantityDelta: -input.quantity,
            quantityBefore: sourceOldQty,
            quantityAfter: updatedSource.quantity,
            referenceId: ref,
            notes: input.notes ? `Transfer out to ${input.destinationWarehouseId}: ${input.notes}` : `Transfer out to ${input.destinationWarehouseId}`,
            performedBy: input.performedBy,
          },
          {
            warehouseId: input.destinationWarehouseId,
            productId: input.productId,
            type: "TRANSFER_IN",
            quantityDelta: input.quantity,
            quantityBefore: destOldQty,
            quantityAfter: updatedDest.quantity,
            referenceId: ref,
            notes: input.notes ? `Transfer in from ${input.sourceWarehouseId}: ${input.notes}` : `Transfer in from ${input.sourceWarehouseId}`,
            performedBy: input.performedBy,
          },
        ],
      });

      // 7. Evaluate alerts on source and destination
      await this.evaluateStockAlertInTx(tx, {
        warehouseId: input.sourceWarehouseId,
        productId: input.productId,
        quantity: updatedSource.quantity,
        threshold: updatedSource.lowStockThreshold,
      });

      await this.evaluateStockAlertInTx(tx, {
        warehouseId: input.destinationWarehouseId,
        productId: input.productId,
        quantity: updatedDest.quantity,
        threshold: updatedDest.lowStockThreshold,
      });

      return {
        reference: ref,
        source: updatedSource,
        destination: updatedDest,
        transferredQuantity: input.quantity,
      };
    }, {
      maxWait: 10000,
      timeout: 25000,
    });
  }

  /**
   * Backorder & Pre-Order Configuration for a product.
   */
  async updateBackorderConfig(
    productId: string,
    data: {
      allowBackorder: boolean;
      backorderLimit?: number | null;
      expectedRestockDate?: Date | null;
      isPreOrder?: boolean;
      preOrderReleaseDate?: Date | null;
    }
  ) {
    return prisma.product.update({
      where: { id: productId },
      data: {
        allowBackorder: data.allowBackorder,
        backorderLimit: data.backorderLimit,
        expectedRestockDate: data.expectedRestockDate,
        isPreOrder: data.isPreOrder ?? false,
        preOrderReleaseDate: data.preOrderReleaseDate,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ALERTS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Directly creates or updates an alert record.
   */
  async createOrUpdateAlert(params: {
    warehouseId: string;
    productId: string;
    vendorId?: string | null;
    alertType: StockAlertType;
    threshold: number;
    currentStock: number;
    notes?: string;
  }) {
    const existing = await prisma.stockAlert.findFirst({
      where: {
        warehouseId: params.warehouseId,
        productId: params.productId,
        alertType: params.alertType,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (existing) {
      return prisma.stockAlert.update({
        where: { id: existing.id },
        data: {
          currentStock: params.currentStock,
          threshold: params.threshold,
          notes: params.notes,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.stockAlert.create({
      data: {
        warehouseId: params.warehouseId,
        productId: params.productId,
        vendorId: params.vendorId,
        alertType: params.alertType,
        threshold: params.threshold,
        currentStock: params.currentStock,
        status: "ACTIVE",
        notes: params.notes,
      },
    });
  }

  /**
   * Helper executed inside transactions to evaluate whether to trigger or resolve low-stock alert.
   */
  async evaluateStockAlertInTx(
    tx: Prisma.TransactionClient,
    params: {
      warehouseId: string;
      productId: string;
      quantity: number;
      threshold: number;
    }
  ) {
    const product = await tx.product.findUnique({
      where: { id: params.productId },
      select: { vendorId: true, name: true },
    });

    if (params.quantity <= 0) {
      // OUT OF STOCK ALERT
      await tx.stockAlert.upsert({
        where: {
          id: (
            await tx.stockAlert.findFirst({
              where: {
                warehouseId: params.warehouseId,
                productId: params.productId,
                alertType: "OUT_OF_STOCK",
                status: "ACTIVE",
              },
              select: { id: true },
            })
          )?.id ?? "00000000-0000-0000-0000-000000000000",
        },
        create: {
          warehouseId: params.warehouseId,
          productId: params.productId,
          vendorId: product?.vendorId,
          alertType: "OUT_OF_STOCK",
          threshold: params.threshold,
          currentStock: params.quantity,
          status: "ACTIVE",
          notes: `Item "${product?.name}" is completely out of stock at this location.`,
        },
        update: {
          currentStock: params.quantity,
          updatedAt: new Date(),
        },
      });
    } else if (params.quantity <= params.threshold) {
      // LOW STOCK ALERT
      await tx.stockAlert.upsert({
        where: {
          id: (
            await tx.stockAlert.findFirst({
              where: {
                warehouseId: params.warehouseId,
                productId: params.productId,
                alertType: "LOW_STOCK",
                status: "ACTIVE",
              },
              select: { id: true },
            })
          )?.id ?? "00000000-0000-0000-0000-000000000000",
        },
        create: {
          warehouseId: params.warehouseId,
          productId: params.productId,
          vendorId: product?.vendorId,
          alertType: "LOW_STOCK",
          threshold: params.threshold,
          currentStock: params.quantity,
          status: "ACTIVE",
          notes: `Stock fell below threshold of ${params.threshold} units. Current: ${params.quantity}.`,
        },
        update: {
          currentStock: params.quantity,
          updatedAt: new Date(),
        },
      });
    } else {
      // Auto-resolve any existing active alerts if stock is comfortably above threshold
      await tx.stockAlert.updateMany({
        where: {
          warehouseId: params.warehouseId,
          productId: params.productId,
          status: "ACTIVE",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          notes: `Auto-resolved: Stock replenished to ${params.quantity} units (threshold: ${params.threshold}).`,
        },
      });
    }
  }

  /**
   * List active or historical stock alerts.
   */
  async listAlerts(filter: {
    warehouseId?: string;
    vendorId?: string;
    productId?: string;
    status?: StockAlertStatus;
    alertType?: StockAlertType;
    page?: number;
    limit?: number;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAlertWhereInput = {
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.alertType ? { alertType: filter.alertType } : {}),
    };

    const [alerts, total] = await Promise.all([
      prisma.stockAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: "asc" }, { notifiedAt: "desc" }],
        include: {
          warehouse: { select: { id: true, name: true, code: true, city: true } },
          product: { select: { id: true, name: true, slug: true, price: true } },
          vendor: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.stockAlert.count({ where }),
    ]);

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Manually resolve an alert.
   */
  async resolveAlert(alertId: string, notes: string, vendorId?: string) {
    const alert = await prisma.stockAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundError("Stock alert not found");
    }
    if (vendorId && alert.vendorId && alert.vendorId !== vendorId) {
      throw new NotFoundError("Alert not found for this vendor");
    }

    return prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        notes: `Resolved: ${notes}`,
      },
    });
  }

  /**
   * List immutable stock movement logs.
   */
  async listMovements(filter: {
    warehouseId?: string;
    productId?: string;
    type?: StockMovementType;
    page?: number;
    limit?: number;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    };

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Sync aggregate total stock across all active warehouses back to `Product.stockQty` and `Product.stockStatus`.
   */
  async syncAggregatedProductStock(productId: string) {
    return prisma.$transaction(async (tx) => {
      return this.syncAggregatedProductStockInTx(tx, productId);
    }, {
      maxWait: 10000,
      timeout: 25000,
    });
  }

  private async syncAggregatedProductStockInTx(
    tx: Prisma.TransactionClient,
    productId: string
  ) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        allowBackorder: true,
        isPreOrder: true,
        stockQty: true,
      },
    });

    if (!product) return;

    // Sum physical available quantities across all non-deleted, active warehouses
    const aggregates = await tx.warehouseStock.aggregate({
      where: {
        productId,
        warehouse: { deletedAt: null, isActive: true },
      },
      _sum: { quantity: true },
    });

    const totalQty = aggregates._sum.quantity ?? 0;

    let stockStatus: StockStatus = "IN_STOCK";
    if (product.isPreOrder) {
      stockStatus = "PRE_ORDER";
    } else if (totalQty <= 0) {
      stockStatus = product.allowBackorder ? "BACKORDER" : "OUT_OF_STOCK";
    } else if (totalQty <= 5) {
      stockStatus = "LOW_STOCK";
    }

    return tx.product.update({
      where: { id: productId },
      data: {
        stockQty: totalQty,
        stockStatus,
      },
    });
  }
}
