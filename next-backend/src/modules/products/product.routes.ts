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
   * Paginated product catalog with category filter, vendor filter, search, and sorting.
   */
  app.get(
    "/",
    {
      schema: {
        description: "List paginated products with category filtering and search",
        tags: ["Products"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            search: { type: "string" },
            category: { type: "string" },
            vendor: { type: "string" },
            sort: {
              type: "string",
              enum: ["price_asc", "price_desc", "newest", "popular"],
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
};
