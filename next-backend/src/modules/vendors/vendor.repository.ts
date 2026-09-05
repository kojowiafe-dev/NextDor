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
   * Finds a vendor by its unique URL slug.
   */
  async findBySlug(slug: string): Promise<any | null> {
    return prisma.vendor.findUnique({
      where: { slug },
      include: {
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
    return prisma.$transaction(async (tx) => {
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
            shippingAddress: true,
            paymentStatus: true,
            createdAt: true,
            user: { select: { name: true, email: true, phone: true } },
            items: { where: { vendorId } },
          },
        },
        payout: true,
      },
    });
  }

  /**
   * Updates sub-order fulfillment/dispatch status and initiates 48h escrow clearance upon delivery.
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

    // If status is DELIVERED and clearedAt is not yet set, initiate 48h escrow clearance timer
    if (status === "DELIVERED") {
      const existing = await prisma.vendorOrder.findUnique({
        where: { id: vendorOrderId },
        select: { clearedAt: true },
      });
      if (!existing?.clearedAt) {
        data.clearedAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour escrow window
      }
    }

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

    const [total, payouts, earningsAgg, inEscrowAgg, availableAgg, paidOutAgg] = await Promise.all([
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
      // Lifetime net earnings (non-cancelled sub-orders)
      prisma.vendorOrder.aggregate({
        where: { vendorId, status: { not: "CANCELLED" } },
        _sum: { vendorEarnings: true, subtotal: true },
      }),
      // In 48h escrow (delivered but clearedAt > now)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          status: "DELIVERED",
          clearedAt: { gt: now },
          payoutId: null,
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),
      // Available for payout (clearedAt <= now and payoutId is null)
      prisma.vendorOrder.aggregate({
        where: {
          vendorId,
          status: "DELIVERED",
          clearedAt: { lte: now },
          payoutId: null,
        },
        _sum: { vendorEarnings: true },
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
        inEscrowAmount: Number(inEscrowAgg._sum.vendorEarnings || 0),
        inEscrowOrdersCount: inEscrowAgg._count.id || 0,
        availableForPayoutAmount: Number(availableAgg._sum.vendorEarnings || 0),
        availableOrdersCount: availableAgg._count.id || 0,
        totalPaidOut: Number(paidOutAgg._sum.amount || 0),
      },
    };
  }
}
