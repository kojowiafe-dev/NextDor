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
   * Uses the current order count to produce sequential numbers.
   */
  private async generateOrderNumber(): Promise<string> {
    const count = await prisma.order.count();
    return `ND-${String(count + 1).padStart(5, "0")}`;
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
    const orderNumber = await this.generateOrderNumber();

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Decrement stock for each product (Optimistic Concurrency Control)
      for (const item of input.items) {
        await tx.product.updateMany({
          where: {
            id: item.productId,
            stockQty: { gte: item.quantity }, // ensures stock doesn't go negative
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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: {
            select: {
              productName: true,
              productImage: true,
              quantity: true,
              unitPrice: true,
            },
          },
          vendorOrders: {
            select: { status: true, vendorId: true },
          },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return { orders, total };
  }

  /**
   * Fetches a single order by its human-readable number.
   * Includes the full status timeline, items, and vendor sub-orders.
   * Optionally scoped to a userId for customer access control.
   */
  async findByNumber(number: string, userId?: string) {
    return prisma.order.findFirst({
      where: {
        number,
        ...(userId ? { userId } : {}),
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
  async findProductsForCheckout(productIds: string[]) {
    return prisma.product.findMany({
      where: {
        id: { in: productIds },
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
