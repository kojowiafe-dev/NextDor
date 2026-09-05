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
import type { Prisma, Vendor, Product, VendorStatus } from "@prisma/client";

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
}
