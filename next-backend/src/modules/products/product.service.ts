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

    const result = await this.productRepo.findMany({
      page,
      limit,
      search: filter.search?.trim(),
      category: filter.category?.trim(),
      vendorSlug: filter.vendor?.trim(),
      sort: filter.sort,
    });

    return {
      products: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Retrieves single product by URL slug, throwing standard NotFoundError if missing.
   */
  async getProductBySlug(slug: string) {
    const product = await this.productRepo.findBySlug(slug);

    if (
      !product ||
      product.deletedAt ||
      (product.vendor && product.vendor.status !== "ACTIVE") ||
      (product.vendor && product.vendor.deletedAt)
    ) {
      throw new NotFoundError(`Product '${slug}' not found.`);
    }

    return product;
  }

  /**
   * Lists all categories with product counts.
   */
  async getCategories() {
    return this.productRepo.listCategoriesWithCounts();
  }
}
