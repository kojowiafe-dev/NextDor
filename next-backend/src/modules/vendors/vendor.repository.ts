/**
 * Vendor Repository — Persistence Layer for Marketplace Merchants.
 *
 * DESIGN PATTERN: Repository Pattern
 * ──────────────────────────────────
 * Encapsulates all database operations relating to Vendors, their Products,
 * Orders, and Payout aggregates.
 *
 * All Prisma database operations are strictly isolated here.
 */

import { prisma } from "../../lib/prisma.js";
import type { Prisma, Vendor, Product, VendorStatus, VendorOrderStatus, PayoutStatus } from "@prisma/client";

export class VendorRepository {
  /**
   * Retrieves all active, non-deleted vendors for the public marketplace directory.
   */
  async findActiveVendors() {
    return prisma.vendor.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Finds a vendor by its unique URL slug (projects only safe public storefront fields).
   */
  async findBySlug(slug: string): Promise<any | null> {
    return prisma.vendor.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: { products: true },
        },
      },
    });
  }

  /**
   * Finds a vendor by primary ID.
   */
  async findById(id: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { id },
    });
  }

  /**
   * Finds a vendor by its owner user ID.
   */
  async findByOwnerId(ownerId: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { ownerId },
    });
  }

  /**
   * Atomic merchant onboarding: creates User, Vendor, and links primary vendorId.
   *
   * IMPORTANT LINES EXPLAINED:
   * - `prisma.$transaction`: Runs in an ACID database transaction.
   *   If vendor creation fails, user creation rolls back automatically.
   */
  async createVendorWithUser(params: {
    user: Prisma.UserCreateInput;
    vendor: Omit<Prisma.VendorCreateInput, "owner">;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: params.user,
      });

      const newVendor = await tx.vendor.create({
        data: {
          ...params.vendor,
          owner: { connect: { id: newUser.id } },
        },
      });

      await tx.user.update({
        where: { id: newUser.id },
        data: { vendorId: newVendor.id },
      });

      return { user: newUser, vendor: newVendor };
    });
  }

  /**
   * Atomic customer-to-merchant upgrade: creates Vendor and links it to an existing User
   * while preserving the user's customer history, saved addresses, and orders.
   */
  async upgradeUserToVendor(params: {
    userId: string;
    newRole: Prisma.EnumUserRoleFieldUpdateOperationsInput["set"];
    name?: string;
    phone?: string | null;
    vendor: Omit<Prisma.VendorCreateInput, "owner">;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newVendor = await tx.vendor.create({
        data: {
          ...params.vendor,
          owner: { connect: { id: params.userId } },
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: params.userId },
        data: {
          vendorId: newVendor.id,
          role: params.newRole,
          ...(params.name ? { name: params.name } : {}),
          ...(params.phone ? { phone: params.phone } : {}),
        },
      });

      return { user: updatedUser, vendor: newVendor };
    });
  }

  /**
   * Gathers dashboard statistics for an individual vendor.
   */
  async getDashboardAggregates(vendorId: string) {
    const [totalProducts, inStock, lowStock, recentSubOrders, earningsAgg] = await Promise.all([
      prisma.product.count({ where: { vendorId, deletedAt: null } }),
      prisma.product.count({ where: { vendorId, stockStatus: "IN_STOCK", deletedAt: null } }),
      prisma.product.count({ where: { vendorId, stockStatus: "LOW_STOCK", deletedAt: null } }),
      prisma.vendorOrder.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          order: {
            select: {
              number: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.vendorOrder.aggregate({
        where: { vendorId, status: { not: "CANCELLED" } },
        _sum: { vendorEarnings: true, subtotal: true },
      }),
    ]);

    return {
      totalProducts,
      inStock,
      lowStock,
      recentSubOrders,
      grossSales: earningsAgg._sum.subtotal || 0,
      netEarnings: earningsAgg._sum.vendorEarnings || 0,
    };
  }

  /**
   * Finds products belonging strictly to this vendor (Tenant Isolation).
   */
  async findVendorProducts(
    vendorId: string,
    options: { page: number; limit: number; search?: string }
  ) {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      vendorId, // Strict tenant filter
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          categories: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { products, total, page, limit };
  }

  /**
   * Finds a product within a vendor's inventory.
   */
  async findVendorProductById(vendorId: string, productId: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: { id: productId, vendorId, deletedAt: null },
    });
  }

  /**
   * Creates a product owned by a specific vendor.
   */
  async createProduct(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
      include: {
        images: true,
        categories: true,
      },
    });
  }

  /**
   * Atomically updates product and increments OCC version counter.
   */
  async updateProductWithOcc(productId: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        version: { increment: 1 }, // Atomic version increment
      },
      include: {
        images: true,
        categories: true,
      },
    });
  }

  /**
   * Soft-deletes a product by setting deletedAt timestamp.
   */
  async softDeleteProduct(productId: string) {
    return prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Updates vendor store profile settings.
   */
  async updateProfile(vendorId: string, data: Prisma.VendorUpdateInput) {
    return prisma.vendor.update({
      where: { id: vendorId },
      data,
    });
  }

  /**
   * Finds customer sub-orders partitioned strictly for this vendor (Tenant Isolation).
   */
  async findVendorOrders(
    vendorId: string,
    options: { page: number; limit: number; status?: string }
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorOrderWhereInput = {
      vendorId,
    };

    if (status && status !== "ALL") {
      where.status = status as VendorOrderStatus;
    }

    const [total, orders] = await Promise.all([
      prisma.vendorOrder.count({ where }),
      prisma.vendorOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              number: true,
              paymentStatus: true,
              createdAt: true,
              shippingAddress: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              items: {
                where: { vendorId },
                select: {
                  id: true,
                  productName: true,
                  productImage: true,
                  unitPrice: true,
                  quantity: true,
                  subtotal: true,
                },
              },
            },
          },
          payout: {
            select: {
              id: true,
              status: true,
              paidAt: true,
              paystackTransferRef: true,
            },
          },
        },
      }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Finds a specific sub-order owned by this vendor.
   */
  async findVendorOrderById(vendorId: string, vendorOrderId: string) {
    return prisma.vendorOrder.findFirst({
      where: { id: vendorOrderId, vendorId },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            guestEmail: true,
            deliveryMethod: true,
            shippingAddress: true,
            paymentStatus: true,
            notes: true,
            createdAt: true,
            user: { select: { name: true, email: true, phone: true } },
            items: { where: { vendorId } },
          },
        },
        vendor: { select: { name: true } },
        payout: true,
      },
    });
  }

  /**
   * Updates sub-order fulfillment/dispatch status (PROCESSING / SHIPPED / CANCELLED).
   * NOTE: Delivery verification and the 48-hour escrow clock are exclusively initiated
   * by EscrowService.verifyDelivery (triggered by customer confirmation or courier/admin).
   */
  async updateVendorOrderStatus(
    vendorId: string,
    vendorOrderId: string,
    status: VendorOrderStatus,
    notes?: string
  ) {
    const data: Prisma.VendorOrderUpdateInput = {
      status,
      notes: notes !== undefined ? notes : undefined,
    };

    return prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data,
      include: {
        order: { select: { number: true } },
      },
    });
  }

  /**
   * Retrieves merchant payouts ledger and calculates live 48-hour escrow breakdown.
   */
  async findVendorPayouts(
    vendorId: string,
    options: { page: number; limit: number; status?: string }
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorPayoutWhereInput = {
      vendorId,
    };

    if (status && status !== "ALL") {
      where.status = status as PayoutStatus;
    }

    const now = new Date();

    const [
      total,
      payouts,
      earningsAgg,
      pendingFulfillmentAgg,
      inEscrowAgg,
      availableAgg,
      processingPayoutsAgg,
      paidOutAgg,
    ] = await Promise.all([
      prisma.vendorPayout.count({ where }),
      prisma.vendorPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          vendorOrders: {
            select: {
              id: true,
              subtotal: true,
              commissionAmount: true,
              vendorEarnings: true,
              status: true,
              order: { select: { number: true } },
            },
          },
        },
      }),
      // Lifetime net earnings (non-cancelled paid sub-orders)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          status: { not: "CANCELLED" },
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true, subtotal: true },
      }),
      // Pre-delivery fulfillment (paid, pending dispatch or in transit, not yet delivery-verified)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          status: { in: ["PENDING", "PROCESSING", "SHIPPED"] },
          fundsStatus: "PENDING_FULFILLMENT",
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),
      // In 48h escrow (delivery verified by customer/courier, 48h buyer inspection window active)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          fundsStatus: "ESCROW",
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),
      // Available for payout (48h escrow cleared or early-confirmed by customer, awaiting batch)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          fundsStatus: "AVAILABLE",
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),
      // Payouts currently processing / in flight
      prisma.vendorPayout.aggregate({
        where: { vendorId, status: "PROCESSING" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Total already paid out
      prisma.vendorPayout.aggregate({
        where: { vendorId, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    return {
      payouts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      escrowSummary: {
        lifetimeGrossSales: Number(earningsAgg._sum.subtotal || 0),
        lifetimeNetEarnings: Number(earningsAgg._sum.vendorEarnings || 0),
        pendingFulfillmentAmount: Number(pendingFulfillmentAgg._sum.vendorEarnings || 0),
        pendingFulfillmentOrdersCount: pendingFulfillmentAgg._count.id || 0,
        inEscrowAmount: Number(inEscrowAgg._sum.vendorEarnings || 0),
        inEscrowOrdersCount: inEscrowAgg._count.id || 0,
        availableForPayoutAmount: Number(availableAgg._sum.vendorEarnings || 0),
        availableOrdersCount: availableAgg._count.id || 0,
        inFlightPayoutAmount: Number(processingPayoutsAgg._sum.amount || 0),
        inFlightPayoutsCount: processingPayoutsAgg._count.id || 0,
        totalPaidOut: Number(paidOutAgg._sum.amount || 0),
      },
    };
  }
}
