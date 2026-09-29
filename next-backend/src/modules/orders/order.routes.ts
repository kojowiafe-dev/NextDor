/**
 * Order Routes — Presentation Layer (Controller).
 *
 * DESIGN PATTERN: Thin Controller / Clean Architecture
 * ─────────────────────────────────────────────────────
 * HTTP-only concerns:
 * - JWT token verification and userId extraction
 * - Zod/JSON-schema request body validation
 * - Delegating all domain logic to OrderService
 * - Formatting and sending HTTP responses
 *
 * ZERO direct database queries in this file.
 *
 * Registered at:
 *   Customer  → /api/v1/orders
 *   Vendor    → /api/v1/vendors/orders (vendorOrderId scope)
 *   Admin     → /api/v1/admin/orders
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { orderService } from "./order.service.js";
import { AuthService } from "../auth/auth.service.js";
import type { OrderStatus, VendorOrderStatus } from "@prisma/client";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function extractUser(req: FastifyRequest): { userId: string; role: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = AuthService.verifyAccessToken(authHeader.slice(7));
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = extractUser(req);
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
  (req as any).authUser = user;
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const user = extractUser(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required" },
    });
  }
  (req as any).authUser = user;
}

async function requireVendor(req: FastifyRequest, reply: FastifyReply) {
  const user = extractUser(req);
  if (
    !user ||
    !["VENDOR_OWNER", "VENDOR_STAFF", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  ) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Vendor access required" },
    });
  }
  (req as any).authUser = user;
}

// ─── Customer Order Routes ────────────────────────────────────────────────────

export const orderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/v1/orders
   * Place a new order (checkout).
   */
  app.post(
    "/",
    {
      preHandler: requireAuth,
      schema: {
        description: "Place a new order (checkout)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["cart", "shippingAddress"],
          properties: {
            cart: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "string", format: "uuid" },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
            shippingAddress: {
              type: "object",
              required: ["street", "city", "region"],
              properties: {
                label: { type: "string" },
                street: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                recipientName: { type: "string" },
                recipientPhone: { type: "string" },
              },
            },
            addressId: { type: "string", format: "uuid" },
            deliveryMethod: {
              type: "string",
              enum: ["STANDARD", "EXPRESS", "PICKUP"],
            },
            notes: { type: "string" },
            couponId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const body = req.body as any;

      const order = await orderService.checkout({
        userId,
        cart: body.cart,
        shippingAddress: body.shippingAddress,
        addressId: body.addressId,
        deliveryMethod: body.deliveryMethod,
        notes: body.notes,
        couponId: body.couponId,
      });

      return reply.status(201).send({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.number,
          total: order.total,
          status: order.status,
        },
      });
    },
  );

  /**
   * GET /api/v1/orders
   * List the authenticated user's orders (paginated).
   */
  app.get(
    "/",
    {
      preHandler: requireAuth,
      schema: {
        description: "List my orders",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const { page, limit } = req.query as { page: number; limit: number };

      const result = await orderService.getMyOrders(userId, page, limit);

      return reply.send({
        success: true,
        data: result.orders,
        meta: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    },
  );

  /**
   * GET /api/v1/orders/:number
   * Get full order detail + tracking timeline.
   */
  app.get(
    "/:number",
    {
      preHandler: requireAuth,
      schema: {
        description: "Get order detail and tracking timeline",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            number: { type: "string", example: "ND-00001" },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const { number } = req.params as { number: string };

      const order = await orderService.getOrderByNumber(number, userId);

      return reply.send({ success: true, data: order });
    },
  );

  /**
   * POST /api/v1/orders/:number/cancel
   * Customer cancels their own order.
   */
  app.post(
    "/:number/cancel",
    {
      preHandler: requireAuth,
      schema: {
        description: "Cancel an order (customer)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            number: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const { number } = req.params as { number: string };

      const order = await orderService.cancelOrder(number, userId);

      return reply.send({
        success: true,
        data: { orderNumber: number, status: order.status },
      });
    },
  );
};

// ─── Admin Order Routes ───────────────────────────────────────────────────────

export const adminOrderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/admin/orders
   * Admin: list all orders with optional filters.
   */
  app.get(
    "/",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin: list all orders",
        tags: ["Admin", "Orders"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { page, limit, status } = req.query as {
        page: number;
        limit: number;
        status?: OrderStatus;
      };

      const result = await orderService.getAllOrders({ page, limit, status });

      return reply.send({
        success: true,
        data: result.orders,
        meta: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    },
  );

  /**
   * GET /api/v1/admin/orders/:number
   * Admin: get any order by number (no userId scoping).
   */
  app.get(
    "/:number",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin: get order detail by number",
        tags: ["Admin", "Orders"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const order = await orderService.getOrderByNumber(number); // no userId — admin bypass

      return reply.send({ success: true, data: order });
    },
  );

  /**
   * PATCH /api/v1/admin/orders/:id/status
   * Admin: force-update order status with audit trail note.
   */
  app.patch(
    "/:id/status",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin: update order status",
        tags: ["Admin", "Orders"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"],
            },
            note: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const { id } = req.params as { id: string };
      const { status, note } = req.body as { status: OrderStatus; note?: string };

      const order = await orderService.updateOrderStatus(id, status, note, userId);

      return reply.send({
        success: true,
        data: { orderId: order.id, status: order.status },
      });
    },
  );
};

// ─── Vendor Order Routes ──────────────────────────────────────────────────────

export const vendorOrderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/vendors/my-orders
   * Vendor: list their VendorOrders (fulfillment queue).
   */
  app.get(
    "/my-orders",
    {
      preHandler: requireVendor,
      schema: {
        description: "Vendor: list my vendor sub-orders",
        tags: ["Vendors", "Orders"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const payload = extractUser(req)!;
      const { page, limit } = req.query as { page: number; limit: number };

      // Vendors can only see their own orders
      const result = await orderService.getVendorOrders(
        (req as any).authUser.vendorId ?? payload.userId,
        page,
        limit,
      );

      return reply.send({
        success: true,
        data: result.vendorOrders,
        meta: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    },
  );

  /**
   * PATCH /api/v1/vendors/my-orders/:vendorOrderId/status
   * Vendor: update their VendorOrder status (PROCESSING → SHIPPED → DELIVERED).
   */
  app.patch(
    "/my-orders/:vendorOrderId/status",
    {
      preHandler: requireVendor,
      schema: {
        description: "Vendor: update fulfillment status of a sub-order",
        tags: ["Vendors", "Orders"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            vendorOrderId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { vendorOrderId } = req.params as { vendorOrderId: string };
      const { status } = req.body as { status: VendorOrderStatus };

      // Extract vendorId from token
      const authHeader = req.headers.authorization!;
      const token = AuthService.verifyAccessToken(authHeader.slice(7));
      const vendorId = token.vendorId;

      if (!vendorId) {
        return reply.status(403).send({
          success: false,
          error: { code: "NO_VENDOR", message: "Not associated with a vendor store" },
        });
      }

      const vendorOrder = await orderService.updateVendorOrderStatus(
        vendorOrderId,
        status,
        vendorId,
      );

      return reply.send({
        success: true,
        data: { vendorOrderId: vendorOrder.id, status: vendorOrder.status },
      });
    },
  );
};
