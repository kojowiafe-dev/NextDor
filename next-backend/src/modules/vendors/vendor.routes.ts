/**
 * Vendor Routes — Presentation Layer (Controller).
 *
 * DESIGN PATTERN: Clean Architecture Controller / Thin Route Handler
 * ──────────────────────────────────────────────────────────────────
 * HTTP concerns ONLY:
 * - Extracts and verifies JWT bearer tokens for merchant authorization.
 * - Enforces tenant context (`req.vendorId`).
 * - Validates route schemas and parameters.
 * - Delegates all business logic to VendorService (Domain Layer).
 *
 * ZERO direct database queries exist in this file.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { VendorRepository } from "./vendor.repository.js";
import { VendorService } from "./vendor.service.js";
import { CommissionCalculator } from "../../domain/CommissionCalculator.js";
import { AuthService } from "../auth/auth.service.js";
import { AuditService } from "../audit/audit.service.js";
import { prisma } from "../../lib/prisma.js";

// Extend FastifyRequest with vendor tenant context
declare module "fastify" {
  interface FastifyRequest {
    vendorId?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
  }
}

/**
 * Pre-handler hook enforcing vendor tenant isolation.
 * Resolves the authenticated merchant's vendorId securely.
 */
async function requireVendorAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const token = authHeader.slice(7);
    const payload = AuthService.verifyAccessToken(token);

    if (
      payload.role !== "VENDOR_OWNER" &&
      payload.role !== "VENDOR_STAFF" &&
      payload.role !== "ADMIN" &&
      payload.role !== "SUPER_ADMIN"
    ) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Vendor portal access required." },
      });
    }

    let vendorId = payload.vendorId;
    let userEmail = payload.email;
    if (!vendorId || !userEmail) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, vendorId: true, ownedVendor: { select: { id: true } } },
      });
      vendorId = vendorId || user?.vendorId || user?.ownedVendor?.id;
      userEmail = userEmail || user?.email;
    }

    if (!vendorId) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "NO_VENDOR_STORE",
          message: "You are not associated with any active vendor store.",
        },
      });
    }

    req.vendorId = vendorId;
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userEmail = userEmail;
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: err.message || "Invalid or expired token" },
    });
  }
}

/**
 * Pre-handler hook enforcing platform administrator access.
 */
async function requireAdminAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Admin authorization required." },
    });
  }

  try {
    const token = authHeader.slice(7);
    const payload = AuthService.verifyAccessToken(token);

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Platform administrator access required." },
      });
    }

    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userEmail = payload.email;
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: err.message || "Invalid or expired token" },
    });
  }
}

export const vendorRoutes: FastifyPluginAsync = async (app) => {
  // Instantiate Repository and Domain Strategy, then inject into VendorService (DIP)
  const vendorRepository = new VendorRepository();
  const commissionCalculator = new CommissionCalculator();
  const vendorService = new VendorService(vendorRepository, commissionCalculator);

  // ─── PUBLIC DIRECTORY & STOREFRONTS ──────────────────────────────────────

  /**
   * GET /vendors
   * List active marketplace vendors.
   */
  app.get(
    "/",
    {
      schema: {
        description: "List all active marketplace vendors",
        tags: ["Vendors"],
      },
    },
    async (_req, reply) => {
      const vendors = await vendorService.listPublicVendors();
      return reply.send({
        success: true,
        data: { vendors },
      });
    }
  );

  /**
   * GET /vendors/:slug
   * Public storefront profile & products for a specific vendor.
   */
  app.get(
    "/:slug",
    {
      schema: {
        description: "Get vendor storefront details and catalog",
        tags: ["Vendors"],
        params: {
          type: "object",
          required: ["slug"],
          properties: { slug: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 24 },
          },
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const query = req.query as { page?: number; limit?: number };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));

      const data = await vendorService.getVendorBySlug(slug, page, limit);
      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * POST /vendors/register
   * Self-serve onboarding for new merchants.
   */
  app.post(
    "/register",
    {
      schema: {
        description: "Register a new vendor store and owner account",
        tags: ["Vendors"],
        body: {
          type: "object",
          required: ["ownerName", "email", "password", "storeName"],
          properties: {
            ownerName: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            phone: { type: "string" },
            storeName: { type: "string", minLength: 2 },
            storeDescription: { type: "string" },
            momoNumber: { type: "string" },
            momoNetwork: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const result = await vendorService.registerVendor(body);

      req.log.info(
        { ip: req.ip, storeName: body.storeName, email: body.email, userAgent: req.headers["user-agent"] },
        "security: new vendor merchant registered — pending approval"
      );

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  // ─── AUTHENTICATED VENDOR PORTAL ────────────────────────────────────────

  /**
   * GET /vendors/portal/me
   * Vendor dashboard metrics and profile.
   */
  app.get(
    "/portal/me",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Get current authenticated vendor profile and metrics",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const data = await vendorService.getVendorDashboard(req.vendorId!);
      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * PATCH /vendors/portal/me
   * Update vendor store settings.
   */
  app.patch(
    "/portal/me",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Update vendor store settings (MoMo, phone, description)",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            phone: { type: "string" },
            momoNumber: { type: "string" },
            momoNetwork: { type: "string" },
            logoUrl: { type: "string" },
            bannerUrl: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const updated = await vendorService.updateVendorProfile(req.vendorId!, body);

      await AuditService.log({
        userId: req.userId,
        userEmail: req.userEmail,
        action: "VENDOR_PROFILE_UPDATED",
        entity: "Vendor",
        entityId: req.vendorId!,
        details: {
          storeName: updated.name,
          phone: updated.phone,
          momoNetwork: updated.momoNetwork,
          momoNumber: updated.momoNumber,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return reply.send({
        success: true,
        data: { vendor: updated },
      });
    }
  );

  /**
   * GET /vendors/portal/products
   * List products belonging exclusively to this vendor (with OCC versions).
   */
  app.get(
    "/portal/products",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "List vendor's own products with OCC versions",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 50 },
            search: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as { page?: number; limit?: number; search?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));

      const data = await vendorService.listVendorProducts(
        req.vendorId!,
        page,
        limit,
        query.search
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * POST /vendors/portal/products
   * Vendor creates a new product.
   */
  app.post(
    "/portal/products",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Create a new product under authenticated vendor",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "description", "price"],
          properties: {
            name: { type: "string", minLength: 2 },
            description: { type: "string", minLength: 5 },
            shortDesc: { type: "string" },
            price: { type: "number", minimum: 0.01 },
            salePrice: { type: "number", minimum: 0.01 },
            stockQty: { type: "integer", minimum: 0 },
            categoryIds: { type: "array", items: { type: "string" } },
            imageUrl: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const product = await vendorService.createVendorProduct(req.vendorId!, body);
      return reply.status(201).send({
        success: true,
        data: { product },
      });
    }
  );

  /**
   * PATCH /vendors/portal/products/:id
   * Vendor updates stock/price with Optimistic Concurrency Control (OCC).
   */
  app.patch(
    "/portal/products/:id",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Update product price/stock with OCC version verification",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["version"],
          properties: {
            version: {
              type: "integer",
              description: "Expected OCC version counter before update",
            },
            name: { type: "string" },
            description: { type: "string" },
            shortDesc: { type: "string" },
            price: { type: "number", minimum: 0.01 },
            salePrice: { type: "number", nullable: true },
            stockQty: { type: "integer", minimum: 0, nullable: true },
            stockStatus: {
              type: "string",
              enum: ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"],
            },
            categoryIds: { type: "array", items: { type: "string" } },
            imageUrl: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const expectedVersion = Number(body.version);

      const updated = await vendorService.updateVendorProduct(
        req.vendorId!,
        id,
        body,
        expectedVersion
      );

      return reply.send({
        success: true,
        data: { product: updated },
      });
    }
  );

  /**
   * DELETE /vendors/portal/products/:id
   * Vendor soft-deletes a product they own.
   * Enforces Tenant Isolation: WHERE id = productId AND vendorId = currentVendorId
   */
  app.delete(
    "/portal/products/:id",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Soft-delete a product owned by authenticated vendor",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await vendorService.deleteVendorProduct(req.vendorId!, id);
      return reply.send({
        success: true,
        message: "Product deleted successfully.",
      });
    }
  );

  /**
   * GET /vendors/portal/orders
   * List customer sub-orders partitioned for the authenticated merchant.
   */
  app.get(
    "/portal/orders",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "List vendor's own sub-orders with status filter and customer details",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            status: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as { page?: number; limit?: number; status?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

      const data = await vendorService.listVendorOrders(
        req.vendorId!,
        page,
        limit,
        query.status
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * PATCH /vendors/portal/orders/:id/status
   * Advance dispatch / fulfillment status of a sub-order.
   */
  app.patch(
    "/portal/orders/:id/status",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Update fulfillment dispatch status of a merchant sub-order",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
            },
            notes: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { status: any; notes?: string };

      const updated = await vendorService.updateVendorOrderStatus(
        req.vendorId!,
        id,
        body.status,
        body.notes,
        {
          userId: req.userId,
          userEmail: req.userEmail,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        }
      );

      return reply.send({
        success: true,
        data: { vendorOrder: updated },
      });
    }
  );

  /**
   * GET /vendors/portal/payouts
   * Retrieve merchant payouts ledger and 48-hour escrow breakdown.
   */
  app.get(
    "/portal/payouts",
    {
      preHandler: [requireVendorAuth],
      schema: {
        description: "Get merchant payouts ledger and 48-hour escrow settlement metrics",
        tags: ["Vendor Portal"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            status: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as { page?: number; limit?: number; status?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

      const data = await vendorService.getVendorPayoutsAndEscrow(
        req.vendorId!,
        page,
        limit,
        query.status
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // ─── ADMIN VENDOR OVERSIGHT & ALERTS ────────────────────────────────────

  /**
   * GET /vendors/admin/alerts
   * Provides pending vendor applications and critical marketplace alerts for the Admin Dashboard.
   */
  app.get(
    "/admin/alerts",
    {
      preHandler: [requireAdminAuth],
      schema: {
        description: "Get admin marketplace alerts and pending merchant registrations",
        tags: ["Admin Vendors"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      const [pendingVendors, activeCount, totalCount] = await Promise.all([
        prisma.vendor.findMany({
          where: { status: "PENDING_APPROVAL", deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.vendor.count({ where: { status: "ACTIVE", deletedAt: null } }),
        prisma.vendor.count({ where: { deletedAt: null } }),
      ]);

      return reply.send({
        success: true,
        data: {
          pendingVendors,
          pendingCount: pendingVendors.length,
          activeCount,
          totalCount,
        },
      });
    }
  );

  /**
   * GET /vendors/admin/list
   * Full list of all registered marketplace merchants with filtering, search, and metrics.
   */
  app.get(
    "/admin/list",
    {
      preHandler: [requireAdminAuth],
      schema: {
        description: "List all merchants with status filters, product counts, and revenue",
        tags: ["Admin Vendors"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", default: "ALL" },
            search: { type: "string" },
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 25 },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
      };

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
      const skip = (page - 1) * limit;

      const where: any = { deletedAt: null };

      if (query.status && query.status !== "ALL") {
        where.status = query.status;
      }

      if (query.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { name: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
          { momoNumber: { contains: s, mode: "insensitive" } },
        ];
      }

      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                products: true,
                vendorOrders: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.vendor.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: {
          vendors,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
      });
    }
  );

  /**
   * PATCH /vendors/admin/:id/approve
   * Admin approves a vendor store application.
   */
  app.patch(
    "/admin/:id/approve",
    {
      preHandler: [requireAdminAuth],
      schema: {
        description: "Approve a pending merchant vendor account",
        tags: ["Admin Vendors"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const previous = await prisma.vendor.findUnique({ where: { id } });
      const updated = await prisma.vendor.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      await AuditService.log({
        userId: req.userId,
        userEmail: req.userEmail,
        action: "MERCHANT_APPROVED",
        entity: "Vendor",
        entityId: id,
        details: {
          storeName: updated.name,
          storeSlug: updated.slug,
          previousStatus: previous?.status,
          newStatus: "ACTIVE",
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      req.log.info(
        { adminId: req.userId, vendorId: id, vendorName: updated.name },
        "admin: approved vendor application"
      );

      return reply.send({
        success: true,
        data: { vendor: updated },
      });
    }
  );

  /**
   * PATCH /vendors/admin/:id/status
   * Super Admin / Operations Admin updates merchant status or commission rate.
   */
  app.patch(
    "/admin/:id/status",
    {
      preHandler: [requireAdminAuth],
      schema: {
        description: "Update merchant status or commission rate",
        tags: ["Admin Vendors"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ACTIVE", "PENDING_APPROVAL", "SUSPENDED"] },
            commissionRate: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED"; commissionRate?: number };

      const previous = await prisma.vendor.findUnique({ where: { id } });
      if (!previous) {
        return reply.status(404).send({ success: false, error: { message: "Vendor not found" } });
      }

      const dataToUpdate: any = {};
      if (body.status) dataToUpdate.status = body.status;
      if (body.commissionRate !== undefined) dataToUpdate.commissionRate = body.commissionRate;

      const updated = await prisma.vendor.update({
        where: { id },
        data: dataToUpdate,
      });

      await AuditService.log({
        userId: req.userId,
        userEmail: req.userEmail,
        action: body.status === "SUSPENDED" ? "MERCHANT_SUSPENDED" : "MERCHANT_UPDATED",
        entity: "Vendor",
        entityId: id,
        details: {
          storeName: updated.name,
          previousStatus: previous.status,
          newStatus: updated.status,
          commissionRate: updated.commissionRate,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return reply.send({
        success: true,
        data: { vendor: updated },
      });
    }
  );
};

