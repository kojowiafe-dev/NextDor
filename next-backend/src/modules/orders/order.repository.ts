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
import { ConflictError, UnprocessableError } from "../../lib/errors.js";
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
    warehouseId?: string | null;
    isBackorder?: boolean;
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
   * DESIGN DECISION: Non-transactional Sequence Generation
   * ───────────────────────────────────────────────────────
   * In PostgreSQL, any failed query inside a transaction block aborts the
   * entire transaction (Error 25P02), ignoring subsequent try/catches.
   * Because PostgreSQL sequences are natively atomic, concurrent-safe,
   * and non-transactional, we evaluate or initialize the sequence using
   * the root `prisma` client BEFORE entering `prisma.$transaction`.
   */
  private async generateOrderNumber(): Promise<string> {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ nextval: string | bigint | number }>>(
        "SELECT nextval('order_number_seq') AS nextval"
      );
      if (rows && rows.length > 0 && rows[0].nextval != null) {
        return `ND-${String(rows[0].nextval).padStart(5, "0")}`;
      }
    } catch {
      // Sequence might not exist yet — create outside transaction and retry
      try {
        await prisma.$executeRawUnsafe("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1");
        const rows = await prisma.$queryRawUnsafe<Array<{ nextval: string | bigint | number }>>(
          "SELECT nextval('order_number_seq') AS nextval"
        );
        if (rows && rows.length > 0 && rows[0].nextval != null) {
          return `ND-${String(rows[0].nextval).padStart(5, "0")}`;
        }
      } catch {
        // Fall through to database count fallback
      }
    }

    // Fallback: strictly clean sequential order numbers (e.g. ND-00001, ND-00002)
    const count = await prisma.order.count();
    let candidateSeq = count + 1;
    let candidate = `ND-${String(candidateSeq).padStart(5, "0")}`;
    while (await prisma.order.findUnique({ where: { number: candidate } })) {
      candidateSeq++;
      candidate = `ND-${String(candidateSeq).padStart(5, "0")}`;
    }
    return candidate;
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
    // Generate order number BEFORE starting transaction so tx is never aborted by sequence checks
    const orderNumber = await this.generateOrderNumber();

    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Decrement stock for tracked products or handle backorders
        for (const item of input.items) {
          if (item.isBackorder) {
            // Backordered items reserve quota instead of blocking on zero physical on-shelf stock
            await tx.product.update({
              where: { id: item.productId },
              data: {
                backorderCount: { increment: item.quantity },
                stockStatus: "BACKORDER",
              },
            });
          } else {
            const result = await tx.product.updateMany({
              where: {
                id: item.productId,
                stockQty: { not: null, gte: item.quantity },
              },
              data: { stockQty: { decrement: item.quantity } },
            });

            if (result.count === 0) {
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { name: true, stockQty: true },
              });
              if (product && product.stockQty !== null) {
                throw new UnprocessableError(
                  product.stockQty > 0
                    ? `Only ${product.stockQty} unit(s) of "${product.name}" available`
                    : `"${product.name}" just sold out`,
                  { productId: item.productId, available: product.stockQty },
                );
              }
            }

            if (item.warehouseId) {
              await tx.warehouseStock.updateMany({
                where: {
                  warehouseId: item.warehouseId,
                  productId: item.productId,
                  quantity: { gte: item.quantity },
                },
                data: { quantity: { decrement: item.quantity } },
              });
            }
          }
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
              warehouseId: item.warehouseId ?? null,
              isBackorder: item.isBackorder ?? false,
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
    },
    {
      maxWait: 10000,
      timeout: 25000,
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
        returnRequests: {
          include: {
            refunds: true,
          },
          orderBy: { createdAt: "desc" },
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
   *
   * CONCURRENCY: when `expectedStatus` is supplied the write is a compare-and-set
   * (`WHERE id = ? AND status = expected`). If another request changed the order in
   * the meantime, a ConflictError is raised instead of silently overwriting it.
   *
   * INVENTORY: moving an order to CANCELLED returns its units to stock (tracked
   * products only) and cancels its open vendor sub-orders, atomically.
   */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
    createdBy?: string,
    expectedStatus?: OrderStatus,
  ): Promise<Order> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, ...(expectedStatus ? { status: expectedStatus } : {}) },
        data: { status },
      });

      if (changed.count === 0) {
        throw new ConflictError("This order was modified by another request. Please reload and try again.");
      }

      if (status === "CANCELLED") {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          select: { productId: true, quantity: true, isBackorder: true, warehouseId: true },
        });
        for (const item of items) {
          if (item.isBackorder) {
            await tx.product.update({
              where: { id: item.productId },
              data: { backorderCount: { decrement: item.quantity } },
            });
          } else {
            await tx.product.updateMany({
              where: { id: item.productId, stockQty: { not: null } },
              data: { stockQty: { increment: item.quantity } },
            });
            if (item.warehouseId) {
              await tx.warehouseStock.updateMany({
                where: { warehouseId: item.warehouseId, productId: item.productId },
                data: { quantity: { increment: item.quantity } },
              });
            }
          }
        }
        await tx.vendorOrder.updateMany({
          where: { orderId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
          data: { status: "CANCELLED" },
        });
      } else if (status === "DELIVERED") {
        const escrowClearance = new Date(Date.now() + 48 * 60 * 60 * 1000);
        // Cascade delivery to all non-cancelled sub-orders and initialize 48h escrow release timer
        await tx.vendorOrder.updateMany({
          where: { orderId, status: { not: "CANCELLED" } },
          data: {
            status: "DELIVERED",
            clearedAt: escrowClearance,
          },
        });

        // If Cash on Delivery, mark paymentStatus as PAID upon delivery collection
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { notes: true, paymentStatus: true },
        });
        const notesLower = (currentOrder?.notes || "").toLowerCase();
        const isCod =
          notesLower.includes("payment method: cod") ||
          notesLower.includes("cash on delivery") ||
          notesLower.includes("cod");
        if (isCod && currentOrder?.paymentStatus === "UNPAID") {
          await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: "PAID" },
          });
        }
      } else if (status === "SHIPPED") {
        await tx.vendorOrder.updateMany({
          where: { orderId, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "SHIPPED" },
        });
      }

      await tx.orderStatusHistory.create({
        data: { orderId, status, note, createdBy },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    },
    {
      maxWait: 10000,
      timeout: 20000,
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

  /**
   * Resolves the flagship "NextDor Direct" vendor that owns catalog items with no
   * merchant (needed because VendorOrder.vendorId is a real UUID foreign key).
   */
  async findPlatformVendorId(): Promise<string | null> {
    const vendor = await prisma.vendor.findUnique({
      where: { slug: "nextdor" },
      select: { id: true },
    });
    return vendor?.id ?? null;
  }

  /**
   * Public tracking projection — deliberately excludes street address, phone, email and pricing.
   */
  async findPublicTracking(number: string) {
    return prisma.order.findUnique({
      where: { number },
      select: {
        number: true,
        status: true,
        paymentStatus: true,
        deliveryMethod: true,
        createdAt: true,
        shippingAddress: true,
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, createdAt: true },
        },
        vendorOrders: {
          select: {
            id: true,
            status: true,
            vendor: { select: { name: true, slug: true, logoUrl: true } },
          },
        },
        notes: true,
        total: true,
        payments: {
          select: { method: true, status: true },
          take: 1,
        },
        items: { select: { productName: true, productImage: true, quantity: true } },
      },
    });
  }
}
