/**
 * Product Repository — Data Access Layer.
 *
 * DESIGN PATTERN: Repository Pattern (Martin Fowler, P of EAA)
 * ────────────────────────────────────────────────────────────
 * Mediates between the domain and data mapping layers, acting like an
 * in-memory collection of Product domain objects.
 *
 * BENEFITS:
 * 1. Single Responsibility: Encapsulates all Prisma / PostgreSQL operations.
 * 2. Dependency Inversion: Services depend on this class/abstraction rather than
 *    calling the database directly inside route handlers.
 * 3. Testability: Easy to mock in unit tests without a live database.
 */

import { prisma } from "../../lib/prisma.js";
import type { Prisma, Product } from "@prisma/client";

export interface FindProductsFilter {
  search?: string;
  category?: string;
  vendorSlug?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "popular";
  page: number;
  limit: number;
}

export interface PaginatedProducts {
  products: any[];
  total: number;
  page: number;
  limit: number;
}

export class ProductRepository {
  /**
   * Queries paginated products matching search, category, and vendor criteria.
   *
   * IMPORTANT LINES EXPLAINED:
   * - `deletedAt: null`: Soft-delete filter ensuring deleted items never appear in catalog queries.
   * - `images.orderBy: { sortOrder: "asc" }`: Ensures the primary merchant image displays first.
   * - `vendor.select`: Proactively projects vendor branding (name, slug, logo) to avoid N+1 queries.
   */
  async findMany(filter: FindProductsFilter): Promise<PaginatedProducts> {
    const { page, limit, search, category, vendorSlug, sort } = filter;
    const skip = (page - 1) * limit;

    const andConditions: Prisma.ProductWhereInput[] = [
      {
        OR: [
          { vendorId: null },
          { vendor: { status: "ACTIVE", deletedAt: null } },
        ],
      },
    ];

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      AND: andConditions,
    };

    if (category) {
      where.categories = {
        some: { slug: category },
      };
    }

    if (vendorSlug) {
      where.vendor = { slug: vendorSlug, status: "ACTIVE", deletedAt: null };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    if (sort === "price_desc") orderBy = { price: "desc" };
    if (sort === "popular") orderBy = { reviewCount: "desc" };

    // Parallel count & query for optimal database latency
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, url: true, alt: true },
          },
          categories: {
            select: { id: true, name: true, slug: true },
          },
          vendor: {
            select: { id: true, name: true, slug: true, logoUrl: true, status: true },
          },
        },
      }),
    ]);

    return { products, total, page, limit };
  }

  /**
   * Retrieves single product by URL slug with relations.
   */
  async findBySlug(slug: string): Promise<any | null> {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: true,
        vendor: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            description: true,
            status: true,
          },
        },
        reviews: {
          where: { approved: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
  }

  /**
   * Retrieves all product categories with their current live product count.
   */
  async listCategoriesWithCounts() {
    return prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
                OR: [
                  { vendorId: null },
                  { vendor: { status: "ACTIVE", deletedAt: null } },
                ],
              },
            },
          },
        },
      },
    });
  }

  /**
   * Finds a single product by its primary key ID.
   */
  async findById(id: string): Promise<any | null> {
    return prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, deletedAt: true },
    });
  }

  /**
   * Soft-deletes a product by setting deletedAt timestamp.
   *
   * DESIGN DECISION: Soft-delete vs Hard-delete
   * ─────────────────────────────────────────────
   * We keep the row in the database for audit / order history integrity.
   * Orders reference product IDs — a hard delete would break those foreign
   * key lookups and make historical order views show "Unknown Product".
   * The catalog query already filters `deletedAt: null`, so soft-deleted
   * products are invisiblee to customers immediately.
   */
  async softDelete(id: string): Promise<void> {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
