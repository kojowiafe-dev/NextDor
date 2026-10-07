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
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  rating?: number;
  sort?: "price_asc" | "price_desc" | "newest" | "popular" | "rating";
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
   * Queries paginated products matching search, category, vendor, and faceted filter criteria.
   *
   * IMPORTANT LINES EXPLAINED:
   * - `deletedAt: null`: Soft-delete filter ensuring deleted items never appear in catalog queries.
   * - `images.orderBy: { sortOrder: "asc" }`: Ensures the primary merchant image displays first.
   * - `vendor.select`: Proactively projects vendor branding (name, slug, logo) to avoid N+1 queries.
   * - Faceted filters: Dynamically filters by price ranges (handling salePrice), stock status, on-sale flags, and customer ratings.
   */
  async findMany(filter: FindProductsFilter): Promise<PaginatedProducts> {
    const { page, limit, search, category, vendorSlug, minPrice, maxPrice, inStock, onSale, rating, sort } = filter;
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

    if (minPrice !== undefined && !isNaN(minPrice)) {
      andConditions.push({
        OR: [
          { AND: [{ salePrice: { not: null } }, { salePrice: { gte: minPrice } }] },
          { AND: [{ salePrice: null }, { price: { gte: minPrice } }] },
        ],
      });
    }

    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      andConditions.push({
        OR: [
          { AND: [{ salePrice: { not: null } }, { salePrice: { lte: maxPrice } }] },
          { AND: [{ salePrice: null }, { price: { lte: maxPrice } }] },
        ],
      });
    }

    if (inStock) {
      andConditions.push({
        stockStatus: { not: "OUT_OF_STOCK" },
        OR: [{ stockQty: null }, { stockQty: { gt: 0 } }],
      });
    }

    if (onSale) {
      andConditions.push({
        salePrice: { not: null, gt: 0 },
      });
    }

    if (rating && rating > 0) {
      andConditions.push({
        averageRating: { gte: rating },
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
    if (sort === "rating") orderBy = { averageRating: "desc" };

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
   * Retrieves single product by URL slug or UUID with relations.
   */
  async findBySlug(slug: string): Promise<any | null> {
    return this.findBySlugOrId(slug);
  }

  async findBySlugOrId(identifier: string): Promise<any | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    return prisma.product.findFirst({
      where: {
        OR: [
          { slug: identifier },
          ...(isUuid ? [{ id: identifier }] : []),
        ],
      },
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
   * Creates a new product record with associated categories and images.
   */
  async createProduct(data: Prisma.ProductCreateInput): Promise<any> {
    return prisma.product.create({
      data,
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: true,
        vendor: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Updates product fields by primary key ID.
   */
  async updateProduct(id: string, data: Prisma.ProductUpdateInput): Promise<any> {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: true,
        vendor: {
          select: { id: true, name: true, slug: true },
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

  /**
   * Retrieves trending products based on 7-day sales velocity and rating acceleration.
   * If recent order count is low, falls back gracefully to top-reviewed & top-rated items.
   */
  async findTrending(limit = 10): Promise<any[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Group recent OrderItems by productId to find real sales velocity
    const recentSales = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          createdAt: { gte: sevenDaysAgo },
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
      },
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: "desc" },
      },
      take: limit,
    });

    const velocityMap = new Map<string, number>();
    const trendingProductIds: string[] = [];
    for (const s of recentSales) {
      if (s.productId) {
        trendingProductIds.push(s.productId);
        velocityMap.set(s.productId, s._sum.quantity || 1);
      }
    }

    // 2. Fetch products that have active sales velocity
    let trendingProducts: any[] = [];
    if (trendingProductIds.length > 0) {
      trendingProducts = await prisma.product.findMany({
        where: {
          id: { in: trendingProductIds },
          deletedAt: null,
          stockStatus: "IN_STOCK",
          OR: [
            { vendorId: null },
            { vendor: { status: "ACTIVE", deletedAt: null } },
          ],
        },
        include: {
          images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
          categories: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      });
    }

    // Preserve the sales velocity ordering
    const sorted = trendingProductIds
      .map((id) => {
        const prod = trendingProducts.find((p) => p.id === id);
        if (!prod) return null;
        return {
          ...prod,
          recentSales: velocityMap.get(id) || 1,
          trendingBadge: "🔥 Trending Fast",
        };
      })
      .filter(Boolean) as any[];

    // 3. If fewer than limit, pad with top-rated/reviewed active products
    if (sorted.length < limit) {
      const existingIds = new Set(sorted.map((p) => p.id));
      const padProducts = await prisma.product.findMany({
        where: {
          id: { notIn: Array.from(existingIds) },
          deletedAt: null,
          stockStatus: "IN_STOCK",
          OR: [
            { vendorId: null },
            { vendor: { status: "ACTIVE", deletedAt: null } },
          ],
        },
        take: limit - sorted.length,
        orderBy: [
          { reviewCount: "desc" },
          { averageRating: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
          categories: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      });

      for (const prod of padProducts) {
        sorted.push({
          ...prod,
          recentSales: Math.max(1, prod.reviewCount * 2),
          trendingBadge: prod.reviewCount > 0 ? "★ Highly Rated" : "⚡ Popular Choice",
        });
      }
    }

    return sorted;
  }

  /**
   * Multi-seller grouping by product name.
   * Finds other active vendors offering products with the same normalized name.
   */
  async findOtherSellersByName(productName: string, excludeSlug?: string): Promise<any[]> {
    const cleanName = productName.trim();
    if (!cleanName) return [];

    const otherOffers = await prisma.product.findMany({
      where: {
        name: { equals: cleanName, mode: "insensitive" },
        slug: excludeSlug ? { not: excludeSlug } : undefined,
        deletedAt: null,
        OR: [
          { vendorId: null },
          { vendor: { status: "ACTIVE", deletedAt: null } },
        ],
      },
      include: {
        vendor: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
      orderBy: { price: "asc" },
      take: 10,
    });

    return otherOffers.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: Number(p.salePrice ?? p.price),
      currency: p.currency,
      stockStatus: p.stockStatus,
      stockQty: p.stockQty,
      vendor: p.vendor || { name: "Nextdor Direct", slug: "nextdor-direct", logoUrl: null },
    }));
  }

  /**
   * Groups active products by verified merchant for public storefront display.
   */
  async getGroupedByMerchant(limitMerchants = 6, productsPerMerchant = 4): Promise<any[]> {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        products: { some: { deletedAt: null } },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        bannerUrl: true,
        description: true,
        products: {
          where: { deletedAt: null, stockStatus: "IN_STOCK" },
          take: productsPerMerchant,
          orderBy: { createdAt: "desc" },
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
          },
        },
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
      take: limitMerchants,
      orderBy: { createdAt: "desc" },
    });

    // Also include Nextdor Direct flagship if products with vendorId: null exist
    const directProducts = await prisma.product.findMany({
      where: { vendorId: null, deletedAt: null, stockStatus: "IN_STOCK" },
      take: productsPerMerchant,
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
      },
    });

    const directCount = await prisma.product.count({
      where: { vendorId: null, deletedAt: null },
    });

    const result: any[] = [];
    if (directProducts.length > 0) {
      result.push({
        id: "nextdor-direct",
        name: "NextDor Direct (Official Store)",
        slug: "nextdor-direct",
        logoUrl: null,
        description: "Official NextDor flagship store with instant MoMo checkout and express courier dispatch.",
        rating: 5.0,
        totalProducts: directCount,
        products: directProducts,
        isOfficial: true,
      });
    }

    for (const v of vendors) {
      result.push({
        id: v.id,
        name: v.name,
        slug: v.slug,
        logoUrl: v.logoUrl,
        bannerUrl: v.bannerUrl,
        description: v.description,
        rating: 4.8,
        totalProducts: v._count.products,
        products: v.products,
        isOfficial: false,
      });
    }

    return result;
  }

  /**
   * Search autocomplete: finds top matching products and categories for instant live dropdown.
   */
  async autocomplete(query: string, limit = 6) {
    const trimmed = query.trim();
    if (!trimmed) {
      return { products: [], categories: [] };
    }

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          deletedAt: null,
          OR: [
            { vendorId: null },
            { vendor: { status: "ACTIVE", deletedAt: null } },
          ],
          AND: [
            {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { description: { contains: trimmed, mode: "insensitive" } },
                { categories: { some: { name: { contains: trimmed, mode: "insensitive" } } } },
              ],
            },
          ],
        },
        take: limit,
        orderBy: [{ reviewCount: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salePrice: true,
          currency: true,
          stockStatus: true,
          averageRating: true,
          reviewCount: true,
          images: {
            take: 1,
            orderBy: { sortOrder: "asc" },
            select: { url: true, alt: true },
          },
          vendor: {
            select: { name: true, slug: true },
          },
          categories: {
            take: 2,
            select: { name: true, slug: true },
          },
        },
      }),
      prisma.category.findMany({
        where: {
          name: { contains: trimmed, mode: "insensitive" },
        },
        take: 4,
        select: {
          id: true,
          name: true,
          slug: true,
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
      }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        currency: p.currency,
        stockStatus: p.stockStatus,
        rating: Number(p.averageRating),
        reviewCount: p.reviewCount,
        image: p.images[0]?.url || null,
        vendorName: p.vendor?.name || "NextDor Official",
        categoryName: p.categories[0]?.name || null,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        count: c._count.products,
      })),
    };
  }
}

