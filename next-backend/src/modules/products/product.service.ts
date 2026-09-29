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

import { ProductRepository, type FindProductsFilter } from "./product.repository.js";
import { NotFoundError } from "../../lib/errors.js";
import { cacheGet, cacheSet, cacheDel, flushPattern, CacheKey } from "../../lib/redis.js";


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

    // Build a deterministic cache key from query parameters.
    // JSON.stringify sorts keys consistently so identical queries share one key.
    const cacheHash = Buffer.from(
      JSON.stringify({ page, limit, search: filter.search, category: filter.category, vendor: filter.vendor, sort: filter.sort })
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
      flushPattern("products:list:*"),
    ]);
  }
}
