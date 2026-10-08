/**
 * Product Routes — Presentation Layer (Controller).
 *
 * DESIGN PATTERN: Clean Architecture Controller / Thin Route Handler
 * ──────────────────────────────────────────────────────────────────
 * HTTP concerns ONLY:
 * - Validates route schemas & query parameters.
 * - Extracts HTTP request variables.
 * - Delegates domain execution to ProductService.
 * - Maps results to HTTP 200 / 404 response envelopes.
 *
 * ZERO database queries exist in this file.
 */

import type { FastifyPluginAsync } from "fastify";
import { ProductRepository } from "./product.repository.js";
import { ProductService } from "./product.service.js";
import { AuthService } from "../auth/auth.service.js";

export const productRoutes: FastifyPluginAsync = async (app) => {
  // Instantiate Repository and inject into Service (Dependency Inversion)
  const productRepository = new ProductRepository();
  const productService = new ProductService(productRepository);

  /**
   * GET /products
   * Paginated product catalog with category filter, vendor filter, search, faceted filtering, and sorting.
   */
  app.get(
    "/",
    {
      schema: {
        description: "List paginated products with category filtering, search, and faceted filters",
        tags: ["Products"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            search: { type: "string" },
            category: { type: "string" },
            vendor: { type: "string" },
            minPrice: { type: "number", minimum: 0 },
            maxPrice: { type: "number", minimum: 0 },
            inStock: { type: "boolean" },
            onSale: { type: "boolean" },
            rating: { type: "number", minimum: 0, maximum: 5 },
            sort: {
              type: "string",
              enum: ["price_asc", "price_desc", "newest", "popular", "rating"],
              default: "newest",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as any;
      const data = await productService.listCatalogProducts(query);
      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * GET /products/autocomplete
   * Instant search autocomplete suggestions and top matching products.
   */
  app.get(
    "/autocomplete",
    {
      schema: {
        description: "Instant debounce autocomplete suggestions for products and categories",
        tags: ["Products"],
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 6 },
          },
        },
      },
    },
    async (req, reply) => {
      const { q, limit = 6 } = req.query as { q: string; limit?: number };
      const data = await productService.autocompleteSearch(q, Number(limit));
      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * GET /products/categories
   * List all categories with product counts.
   */
  app.get(
    "/categories",
    {
      schema: {
        description: "List all product categories",
        tags: ["Products"],
      },
    },
    async (_req, reply) => {
      const categories = await productService.getCategories();
      return reply.send({
        success: true,
        data: { categories },
      });
    }
  );

  /**
   * GET /products/trending
   * Trending products calculated from recent sales velocity & customer ratings.
   */
  app.get(
    "/trending",
    {
      schema: {
        description: "List trending products based on recent sales velocity and customer rating signals",
        tags: ["Products"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      const { limit = 10 } = (req.query as any) || {};
      const products = await productService.getTrendingProducts(Number(limit));
      return reply.send({
        success: true,
        data: { products },
      });
    }
  );

  /**
   * GET /products/sellers
   * Multi-seller lookup: find other merchants selling the same product name.
   */
  app.get(
    "/sellers",
    {
      schema: {
        description: "Find other vendors offering products with the same or equivalent name",
        tags: ["Products"],
        querystring: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            excludeSlug: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, excludeSlug } = req.query as { name: string; excludeSlug?: string };
      const sellers = await productService.getOtherSellers(name, excludeSlug);
      return reply.send({
        success: true,
        data: {
          productName: name,
          sellers,
          count: sellers.length,
        },
      });
    }
  );

  /**
   * GET /products/grouped-by-merchant
   * Groups active products by verified merchant for storefront marketplace discovery.
   */
  app.get(
    "/grouped-by-merchant",
    {
      schema: {
        description: "List active verified merchants with preview catalogs for storefront discovery",
        tags: ["Products"],
        querystring: {
          type: "object",
          properties: {
            limitMerchants: { type: "integer", default: 6 },
            productsPerMerchant: { type: "integer", default: 4 },
          },
        },
      },
    },
    async (req, reply) => {
      const { limitMerchants = 6, productsPerMerchant = 4 } = (req.query as any) || {};
      const merchants = await productService.getGroupedByMerchant(
        Number(limitMerchants),
        Number(productsPerMerchant)
      );
      return reply.send({
        success: true,
        data: { merchants },
      });
    }
  );

  /**
   * GET /products/:slug
   * Single product lookup by slug.
   */
  app.get(
    "/:slug",
    {
      schema: {
        description: "Get product details by URL slug",
        tags: ["Products"],
        params: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const product = await productService.getProductBySlug(slug);
      return reply.send({
        success: true,
        data: { product },
      });
    }
  );

  /**
   * POST /products
   * Creates a new product in the catalog.
   * Requires ADMIN or SUPER_ADMIN role.
   */
  app.post(
    "/",
    {
      schema: {
        description: "Create a new product (Admin only)",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "price", "category"],
          properties: {
            name: { type: "string", minLength: 2 },
            description: { type: "string" },
            shortDesc: { type: "string" },
            price: { type: "number", minimum: 0 },
            salePrice: { type: "number", nullable: true },
            currency: { type: "string" },
            stockStatus: { type: "string", enum: ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"] },
            stockQty: { type: "integer", nullable: true },
            category: { type: "string" },
            vendorId: { type: "string" },
            image: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const payload = AuthService.verifyAccessToken(authHeader.slice(7));
      if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Admin privileges required" },
        });
      }

      const body = req.body as any;
      const product = await productService.createProduct(body);

      return reply.status(201).send({
        success: true,
        data: { product },
      });
    }
  );

  /**
   * POST /products/bulk
   * Bulk upload products into catalog (Admin only).
   */
  app.post(
    "/bulk",
    {
      schema: {
        description: "Bulk create products (Admin only)",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["items"],
          properties: {
            vendorId: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "price"],
                properties: {
                  name: { type: "string", minLength: 2 },
                  description: { type: "string" },
                  shortDesc: { type: "string" },
                  price: { type: "number", minimum: 0 },
                  salePrice: { type: "number", nullable: true },
                  currency: { type: "string" },
                  stockStatus: { type: "string", enum: ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"] },
                  stockQty: { type: "integer", nullable: true },
                  category: { type: "string" },
                  vendorId: { type: "string" },
                  image: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const payload = AuthService.verifyAccessToken(authHeader.slice(7));
      if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Admin privileges required" },
        });
      }

      const body = req.body as { items: any[]; vendorId?: string };
      const result = await productService.bulkCreateProducts(body.items, body.vendorId);

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * DELETE /products/:id
   * Soft-deletes a product by its primary key ID.
   * Requires ADMIN or SUPER_ADMIN role.
   */
  app.delete(
    "/:id",
    {
      schema: {
        description: "Soft-delete a product by ID (Admin only)",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const payload = AuthService.verifyAccessToken(authHeader.slice(7));
      if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Admin privileges required" },
        });
      }

      const { id } = req.params as { id: string };
      await productService.deleteProduct(id);

      return reply.send({
        success: true,
        data: { message: "Product deleted successfully" },
      });
    }
  );

  /**
   * PATCH /products/:id
   * Updates product details (name, price, stock, category, etc.).
   * Requires ADMIN or SUPER_ADMIN role (Vendors must update via /vendors/portal/products/:id).
   */
  app.patch(
    "/:id",
    {
      schema: {
        description: "Update product details (Admin only)",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            salePrice: { type: "number", nullable: true },
            currency: { type: "string" },
            stockStatus: { type: "string", enum: ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"] },
            stockQty: { type: "integer", nullable: true },
            category: { type: "string" },
            image: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const payload = AuthService.verifyAccessToken(authHeader.slice(7));
      if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Admin privileges required to update catalog products" },
        });
      }

      const { id } = req.params as { id: string };
      const body = req.body as any;
      const updated = await productService.updateProduct(id, body);

      return reply.send({
        success: true,
        data: { product: updated },
      });
    }
  );
};
