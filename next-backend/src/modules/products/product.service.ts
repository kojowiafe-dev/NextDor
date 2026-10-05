/**
 * Product Service — Domain Business Logic.
 *
 * DESIGN PATTERN: Domain Service / Clean Architecture Use Case
 * ─────────────────────────────────────────────────────────────
 * Encapsulates all domain business rules surrounding product cataloging.
 *
 * DEPENDENCY INVERSION (SOLID - D):
 * Injected with ProductRepository via constructor injection. This service does not
 * instantiate the database directly, making it 100% unit-testable.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ProductRepository, type FindProductsFilter } from "./product.repository.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { cacheGet, cacheSet, cacheDel, flushPattern, CacheKey } from "../../lib/redis.js";

import { slugify } from "../../lib/slugify.js";


export class ProductService {
  /**
   * Constructor injection enforces Dependency Inversion.
   */
  constructor(private readonly productRepo: ProductRepository) {}

  /**
   * Lists catalog products with sanitized pagination and business sorting rules.
   *
   * IMPORTANT LINES EXPLAINED:
   * - `Math.max(1, filter.page)`: Prevents negative or zero page inputs from crashing offset math.
   * - `Math.min(100, ...)`: Enforces upper bound limit to protect PostgreSQL connection memory.
   */
  async listCatalogProducts(filter: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    vendor?: string;
    sort?: "price_asc" | "price_desc" | "newest" | "popular";
  }) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 50));

    // Build a strictly deterministic cache key from query parameters (Fix #11).
    // Keys are sorted and string inputs trimmed/normalized to avoid cache misses.
    const normalized = {
      category: filter.category?.trim().toLowerCase() || "",
      limit,
      page,
      search: filter.search?.trim().toLowerCase() || "",
      sort: filter.sort || "newest",
      vendor: filter.vendor?.trim().toLowerCase() || "",
    };
    const cacheHash = Buffer.from(
      JSON.stringify(normalized, Object.keys(normalized).sort())
    ).toString("base64url");
    const cacheKey = CacheKey.productList(cacheHash);


    // 1. Cache-first lookup (Redis TTL: 5 minutes)
    type CatalogPayload = { products: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    const cached = await cacheGet<CatalogPayload>(cacheKey);
    if (cached) return cached;

    // 2. Cache miss — fetch from PostgreSQL
    const result = await this.productRepo.findMany({
      page,
      limit,
      search: filter.search?.trim(),
      category: filter.category?.trim(),
      vendorSlug: filter.vendor?.trim(),
      sort: filter.sort,
    });

    const payload = {
      products: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };

    // 3. Populate cache for next request (fire-and-forget)
    await cacheSet(cacheKey, payload, 5 * 60);
    return payload;
  }

  /**
   * Retrieves single product by URL slug, throwing standard NotFoundError if missing.
   * Cached in Redis for 10 minutes — individual product pages are high-traffic.
   */
  async getProductBySlug(slug: string) {
    const cacheKey = CacheKey.product(slug);
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const product = await this.productRepo.findBySlug(slug);

    if (
      !product ||
      product.deletedAt ||
      (product.vendor && product.vendor.status !== "ACTIVE") ||
      (product.vendor && product.vendor.deletedAt)
    ) {
      throw new NotFoundError(`Product '${slug}' not found.`);
    }

    await cacheSet(cacheKey, product, 10 * 60);
    return product;
  }

  /**
   * Admin creates a new product in the catalog.
   */
  async createProduct(input: {
    name: string;
    description: string;
    shortDesc?: string;
    price: number;
    salePrice?: number | null;
    currency?: string;
    stockStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK";
    stockQty?: number | null;
    category?: string;
    vendorId?: string;
    image?: string;
  }) {
    if (!input.name || !input.name.trim()) {
      throw new BadRequestError("Product name is required.");
    }
    if (input.price === undefined || input.price < 0) {
      throw new BadRequestError("Valid product price is required.");
    }

    let slug = slugify(input.name);
    const existing = await this.productRepo.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Resolve vendor: connect specified vendor or default to flagship "NextDor Direct"
    let vendorConnect: Prisma.VendorCreateNestedOneWithoutProductsInput | undefined;
    if (input.vendorId) {
      vendorConnect = { connect: { id: input.vendorId } };
    } else {
      const flagship = await prisma.vendor.findFirst({
        where: { slug: "nextdor" },
        select: { id: true },
      });
      if (flagship) {
        vendorConnect = { connect: { id: flagship.id } };
      }
    }

    // Resolve category
    let categoryConnect: Prisma.CategoryCreateNestedManyWithoutProductsInput | undefined;
    if (input.category) {
      const cleanCat = input.category.trim();
      const existingCats = await this.productRepo.listCategoriesWithCounts();
      const match = existingCats.find(
        (c) =>
          c.name.toLowerCase() === cleanCat.toLowerCase() ||
          c.slug.toLowerCase() === cleanCat.toLowerCase() ||
          c.id === cleanCat
      );

      if (match) {
        categoryConnect = { connect: [{ id: match.id }] };
      } else {
        const catSlug = slugify(cleanCat);
        categoryConnect = {
          connectOrCreate: [
            {
              where: { slug: catSlug },
              create: { name: cleanCat, slug: catSlug },
            },
          ],
        };
      }
    }

    const stockStatus =
      input.stockStatus ||
      (input.stockQty !== undefined && input.stockQty !== null && input.stockQty <= 0
        ? "OUT_OF_STOCK"
        : input.stockQty !== undefined && input.stockQty !== null && input.stockQty <= 3
        ? "LOW_STOCK"
        : "IN_STOCK");

    const created = await this.productRepo.createProduct({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || "",
      shortDesc: input.shortDesc?.trim() || null,
      price: input.price,
      salePrice: input.salePrice ?? null,
      currency: input.currency || "GHS",
      stockStatus,
      stockQty: input.stockQty ?? null,
      version: 1,
      vendor: vendorConnect,
      categories: categoryConnect,
      images: input.image?.trim()
        ? {
            create: [
              {
                url: input.image.trim(),
                alt: input.name.trim(),
                sortOrder: 0,
              },
            ],
          }
        : undefined,
    });

    await Promise.allSettled([
      cacheDel(CacheKey.categories()),
      cacheDel(CacheKey.trendingProducts()),
      cacheDel(CacheKey.groupedByMerchant()),
      flushPattern("products:list:*"),
    ]);

    return created;
  }

  /**
   * Bulk creates products in catalog (Admin or bulk ingestion).
   */
  async bulkCreateProducts(items: any[], defaultVendorId?: string) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("No products provided for bulk upload.");
    }
    const created: any[] = [];
    const errors: Array<{ row: number; name: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const prod = await this.createProduct({
          ...item,
          vendorId: item.vendorId || defaultVendorId,
        });
        created.push(prod);
      } catch (err: any) {
        errors.push({
          row: i + 1,
          name: item.name || `Row ${i + 1}`,
          message: err.message || "Failed to create product",
        });
      }
    }

    return {
      totalProcessed: items.length,
      createdCount: created.length,
      failedCount: errors.length,
      errors,
      products: created.slice(0, 10),
    };
  }

  /**
   * Updates an existing product and evicts corresponding cache keys.
   */
  async updateProduct(id: string, input: {
    name?: string;
    description?: string;
    price?: number;
    salePrice?: number | null;
    currency?: string;
    stockStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK";
    stockQty?: number | null;
    category?: string;
    image?: string;
  }) {
    const existing = await this.productRepo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError(`Product '${id}' not found.`);
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.price !== undefined) data.price = input.price;
    if (input.salePrice !== undefined) data.salePrice = input.salePrice;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.stockStatus !== undefined) data.stockStatus = input.stockStatus;
    if (input.stockQty !== undefined) data.stockQty = input.stockQty;

    if (input.category) {
      const categories = await this.productRepo.listCategoriesWithCounts();
      const match = categories.find(
        (c) => c.name.toLowerCase() === input.category!.toLowerCase() || c.slug === input.category
      );
      if (match) {
        data.categories = {
          set: [{ id: match.id }],
        };
      }
    }

    if (input.image) {
      data.images = {
        deleteMany: {},
        create: [{ url: input.image, alt: input.name || existing.name || "Product image" }],
      };
    }

    const updated = await this.productRepo.updateProduct(id, data);

    await Promise.allSettled([
      cacheDel(CacheKey.product(existing.slug)),
      cacheDel(CacheKey.trendingProducts()),
      cacheDel(CacheKey.groupedByMerchant()),
      flushPattern("products:list:*"),
    ]);

    return updated;
  }

  /**
   * Lists all categories with product counts.
   * Cached in Redis for 15 minutes (categories change infrequently).
   */
  async getCategories() {
    const cacheKey = CacheKey.categories();
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.productRepo.listCategoriesWithCounts();
    await cacheSet(cacheKey, categories, 15 * 60);
    return categories;
  }

  /**
   * Soft-deletes a product by ID.
   *
   * After deletion:
   *  1. The product’s individual Redis cache key is evicted immediately.
   *  2. All paginated product-list cache keys are flushed so the product
   *     disappears from every catalog page without waiting for TTL expiry.
   *
   * ALGORITHM — Pattern flush (SCAN + DEL):
   * We use SCAN with a glob pattern `products:list:*` rather than KEYS
   * (which blocks Redis) or FLUSHALL (which nukes sessions too).
   * The flushPattern helper paginates with SCAN cursor ensuring O(N)
   * but non-blocking— safe for production traffic.
   */
  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepo.findById(id);

    if (!product || product.deletedAt) {
      throw new NotFoundError(`Product '${id}' not found.`);
    }

    await this.productRepo.softDelete(id);

    // Evict targeted caches (fire-and-forget — non-fatal if Redis is down)
    await Promise.allSettled([
      cacheDel(CacheKey.product(product.slug ?? id)),
      cacheDel(CacheKey.trendingProducts()),
      cacheDel(CacheKey.groupedByMerchant()),
      flushPattern("products:list:*"),
    ]);
  }

  /**
   * Retrieves trending products with 5-minute Redis caching.
   */
  async getTrendingProducts(limit = 10) {
    const cacheKey = CacheKey.trendingProducts();
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const products = await this.productRepo.findTrending(limit);
    await cacheSet(cacheKey, products, 5 * 60);
    return products;
  }

  /**
   * Retrieves other merchants selling the same product name.
   */
  async getOtherSellers(productName: string, excludeSlug?: string) {
    const cacheKey = CacheKey.otherSellers(`${productName}:${excludeSlug || ""}`);
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const sellers = await this.productRepo.findOtherSellersByName(productName, excludeSlug);
    await cacheSet(cacheKey, sellers, 3 * 60);
    return sellers;
  }

  /**
   * Retrieves products grouped by merchant for storefront spotlight.
   */
  async getGroupedByMerchant(limitMerchants = 6, productsPerMerchant = 4) {
    const cacheKey = CacheKey.groupedByMerchant();
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const grouped = await this.productRepo.getGroupedByMerchant(limitMerchants, productsPerMerchant);
    await cacheSet(cacheKey, grouped, 10 * 60);
    return grouped;
  }
}
