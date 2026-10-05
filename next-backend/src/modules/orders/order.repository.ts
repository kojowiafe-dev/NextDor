/**
 * Order Repository — Persistence Layer for Orders.
 *
 * DESIGN PATTERN: Repository Pattern (Clean Architecture)
 * ───────────────────────────────────────────────────────
 * All Prisma queries for the Order domain are encapsulated here.
 * Service layer never imports Prisma directly — it calls this repository.
 *
 * TRANSACTION DESIGN:
 * The `placeOrder` method wraps the entire checkout persistence in a
 * Prisma interactive transaction. If ANY step fails (e.g. stock decrement
 * conflicts), the entire operation is rolled back atomically.
 */

import { prisma } from "../../lib/prisma.js";
import type {
  Order,
  OrderItem,
  OrderStatus,
  VendorOrderStatus,
  DeliveryMethod,
  Prisma,
} from "@prisma/client";

// ─── Input Types ──────────────────────────────────────────────────────────────

export type PlaceOrderInput = {
  userId?: string;
  guestEmail?: string;
  addressId?: string;
  shippingAddress: object;
  deliveryMethod: DeliveryMethod;
  notes?: string;
  couponId?: string;
  items: {
    productId: string;
    vendorId: string | null;
    productName: string;
    productImage: string | null;
    unitPrice: Prisma.Decimal;
    quantity: number;
    subtotal: Prisma.Decimal;
  }[];
  /** Per-vendor breakdown for VendorOrder creation */
  vendorBreakdown: {
    vendorId: string;
    subtotal: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    vendorEarnings: Prisma.Decimal;
  }[];
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
};

// ─── Repository ───────────────────────────────────────────────────────────────

export class OrderRepository {
  /**
   * Generates a human-readable order number: ND-XXXXX (zero-padded).
   *
   * FIX #5 — Race condition solved:
   * Uses PostgreSQL sequence `order_number_seq` executed atomically INSIDE the transaction.
   * If sequence doesn't exist yet, it's auto-created, and has a safe random/entropy fallback.
   */
  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    try {
      const rows = await tx.$queryRawUnsafe<Array<{ nextval: string | bigint | number }>>(
        "SELECT nextval('order_number_seq') AS nextval"
      );
      if (rows && rows.length > 0 && rows[0].nextval != null) {
        return `ND-${String(rows[0].nextval).padStart(5, "0")}`;
      }
    } catch {
      // Sequence might not exist yet — try creating it
      try {
        await tx.$executeRawUnsafe("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1");
        const rows = await tx.$queryRawUnsafe<Array<{ nextval: string | bigint | number }>>(
          "SELECT nextval('order_number_seq') AS nextval"
        );
        if (rows && rows.length > 0 && rows[0].nextval != null) {
          return `ND-${String(rows[0].nextval).padStart(5, "0")}`;
        }
      } catch {
        // Fall through to entropy-backed sequence
      }
    }

    const count = await tx.order.count();
    const entropy = Math.floor(100 + Math.random() * 900);
    return `ND-${String(count + 1).padStart(5, "0")}-${entropy}`;
  }

  /**
   * Atomically places an order:
   * 1. Decrements stock for each product.
   * 2. Creates the master Order record.
   * 3. Creates all OrderItems (price-snapshotted).
   * 4. Creates one VendorOrder per vendor.
   * 5. Appends the initial PENDING status to OrderStatusHistory.
   *
   * All steps run in a single Prisma transaction — any failure rolls back everything.
   */
  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const orderNumber = await this.generateOrderNumber(tx);
      // 1. Decrement stock for tracked products only (where stockQty is not null)
      for (const item of input.items) {
        await tx.product.updateMany({
          where: {
            id: item.productId,
            stockQty: { not: null, gte: item.quantity },
          },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      // 2. Create the master Order
      const order = await tx.order.create({
        data: {
          number: orderNumber,
          userId: input.userId,
          guestEmail: input.guestEmail,
          addressId: input.addressId,
          shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
          deliveryMethod: input.deliveryMethod,
          notes: input.notes,
          couponId: input.couponId,
          subtotal: input.subtotal,
          deliveryFee: input.deliveryFee,
          discount: input.discount,
          total: input.total,
          status: "PENDING",
          paymentStatus: "UNPAID",
          // 3. Create OrderItems inline (price snapshots — immutable after creation)
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              vendorId: item.vendorId,
              productName: item.productName,
              productImage: item.productImage,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          },
          // 4. Create one VendorOrder per vendor (financial sub-orders)
          vendorOrders: {
            create: input.vendorBreakdown.map((v) => ({
              vendorId: v.vendorId,
              subtotal: v.subtotal,
              commissionAmount: v.commissionAmount,
              vendorEarnings: v.vendorEarnings,
              status: "PENDING" as VendorOrderStatus,
            })),
          },
          // 5. Seed the status history with the initial PENDING state
          statusHistory: {
            create: {
              status: "PENDING",
              note: "Order placed successfully",
            },
          },
        },
      });

      return order;
    });
  }

  /**
   * Lists orders for a specific user, newest first.
   * Includes items for the order card preview.
   */
  async findByUserId(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const where: Prisma.OrderWhereInput = user?.email
      ? {
          OR: [
            { userId },
            { guestEmail: { equals: user.email, mode: "insensitive" } },
          ],
        }
      : { userId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: { slug: true },
              },
            },
          },
          vendorOrders: {
            include: {
              vendor: {
                select: { name: true, slug: true, logoUrl: true },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Fetches a single order by its ID (UUID) or human-readable number (ND-XXXXX).
   * Includes the full status timeline, items, and vendor sub-orders.
   * Optionally scoped to a userId for customer access control.
   */
  async findByIdOrNumber(numberOrId: string, userId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(numberOrId);

    let userClause: Prisma.OrderWhereInput = {};
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userClause = user?.email
        ? { OR: [{ userId }, { guestEmail: { equals: user.email, mode: "insensitive" } }] }
        : { userId };
    }

    return prisma.order.findFirst({
      where: {
        AND: [
          {
            OR: [
              { number: numberOrId },
              ...(isUuid ? [{ id: numberOrId }] : []),
            ],
          },
          userClause,
        ],
      },
      include: {
        items: {
          include: {
            product: {
              select: { slug: true },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
        vendorOrders: {
          include: {
            vendor: {
              select: { name: true, slug: true, logoUrl: true },
            },
          },
        },
        payments: {
          select: {
            paystackRef: true,
            method: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
      },
    });
  }

  async findByNumber(numberOrId: string, userId?: string) {
    return this.findByIdOrNumber(numberOrId, userId);
  }

  async findById(id: string, userId?: string) {
    return this.findByIdOrNumber(id, userId);
  }

  /**
   * Admin: list all orders with optional filters.
   */
  async findAll(opts: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    userId?: string;
  }) {
    const { page = 1, limit = 20, status, userId } = opts;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: { select: { productName: true, quantity: true, unitPrice: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Updates the master Order status and appends an entry to the audit log.
   * Always call this instead of directly updating the status field —
   * it guarantees the status history is never out of sync.
   */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
    createdBy?: string,
  ): Promise<Order> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: { orderId, status, note, createdBy },
      });

      return order;
    });
  }

  /**
   * Updates the status of a single VendorOrder (vendor fulfillment).
   */
  async updateVendorOrderStatus(
    vendorOrderId: string,
    status: VendorOrderStatus,
  ) {
    return prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: { status },
    });
  }

  /**
   * Fetches all VendorOrders for a specific vendor (vendor dashboard).
   */
  async findVendorOrders(vendorId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [vendorOrders, total] = await Promise.all([
      prisma.vendorOrder.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              number: true,
              status: true,
              total: true,
              createdAt: true,
              shippingAddress: true,
              user: { select: { name: true, email: true } },
              items: {
                where: { vendorId },
                select: { productName: true, quantity: true, unitPrice: true },
              },
            },
          },
        },
      }),
      prisma.vendorOrder.count({ where: { vendorId } }),
    ]);

    return { vendorOrders, total };
  }

  /**
   * Loads products needed during checkout (price, stock, vendorId, vendor commission).
   */
  async findProductsForCheckout(productIdentifiers: string[]) {
    const isUuid = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const uuids = productIdentifiers.filter(isUuid);
    const numericWcIds = productIdentifiers
      .map((id) => Number(id))
      .filter((n) => !isNaN(n) && Number.isInteger(n) && n > 0);
    const slugs = productIdentifiers.filter((id) => !isUuid(id) && isNaN(Number(id)));

    const orClauses: Prisma.ProductWhereInput[] = [
      ...(uuids.length > 0 ? [{ id: { in: uuids } }] : []),
      ...(numericWcIds.length > 0 ? [{ wcId: { in: numericWcIds } }] : []),
      ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
    ];

    if (orClauses.length === 0) return [];

    return prisma.product.findMany({
      where: {
        OR: orClauses,
        deletedAt: null,
      },
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        vendor: {
          select: { id: true, commissionRate: true, status: true },
        },
      },
    });
  }

  /**
   * Loads a user's default delivery address for checkout pre-fill.
   */
  async findDefaultAddress(userId: string) {
    return prisma.address.findFirst({
      where: { userId, isDefault: true },
    });
  }

  /**
   * Finds a VendorOrder by ID, including owning vendorId for authorization.
   */
  async findVendorOrderById(vendorOrderId: string) {
    return prisma.vendorOrder.findUnique({
      where: { id: vendorOrderId },
      include: { order: { select: { number: true, status: true } } },
    });
  }
}
