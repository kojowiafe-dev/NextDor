/**
 * Order Routes — Presentation Layer (Controller).
 *
 * DESIGN PATTERN: Thin Controller / Clean Architecture
 * ─────────────────────────────────────────────────────
 * HTTP-only concerns:
 * - Token verification via shared guards (lib/auth.guards.ts)
 * - JSON-schema request validation
 * - Delegating ALL domain logic to OrderService / PaymentService
 * - Formatting and sending HTTP responses
 *
 * ZERO direct database queries in this file (payments live in modules/payments).
 *
 * Registered at:
 *   Customer  → /api/v1/orders
 *   Vendor    → /api/v1/vendors/my-orders
 *   Admin     → /api/v1/admin/orders
 */

import type { FastifyPluginAsync } from "fastify";
import { orderService } from "./order.service.js";
import { paymentService } from "../payments/payment.service.js";
import { optionalAuth, requireAdmin, requireAuth, requireVendor, resolveVendorId } from "../../lib/auth.guards.js";
import type { OrderStatus, VendorOrderStatus } from "@prisma/client";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

// ─── Customer Order Routes ────────────────────────────────────────────────────

export const orderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/v1/orders
   * Place a new order (checkout — authenticated customers or guests).
   */
  app.post(
    "/",
    {
      preHandler: optionalAuth,
      schema: {
        description: "Place a new order (checkout - authenticated customers or guests)",
        tags: ["Orders"],
        body: {
          type: "object",
          required: ["cart", "shippingAddress"],
          properties: {
            guestEmail: { type: "string", format: "email", maxLength: 254 },
            cart: {
              type: "array",
              minItems: 1,
              maxItems: 100,
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "string", minLength: 1, maxLength: 200 },
                  quantity: { type: "integer", minimum: 1, maximum: 100 },
                  name: { type: "string" },
                  price: { type: "number" },
                  slug: { type: "string" },
                  image: { type: "string" },
                },
              },
            },
            shippingAddress: {
              type: "object",
              required: ["street", "city", "region"],
              properties: {
                label: { type: "string", maxLength: 50 },
                street: { type: "string", minLength: 1, maxLength: 300 },
                city: { type: "string", minLength: 1, maxLength: 100 },
                region: { type: "string", minLength: 1, maxLength: 100 },
                digitalAddress: { type: "string", maxLength: 50 },
                postcode: { type: "string", maxLength: 20 },
                recipientName: { type: "string", maxLength: 150 },
                recipientPhone: { type: "string", maxLength: 30 },
              },
            },
            addressId: { type: "string", format: "uuid" },
            deliveryMethod: { type: "string", enum: ["STANDARD", "EXPRESS", "PICKUP"] },
            notes: { type: "string", maxLength: 1000 },
            couponId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;

      const order = await orderService.checkout({
        userId: req.authUser?.userId,
        guestEmail: body.guestEmail,
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
      const { userId } = req.authUser!;
      const { page, limit } = req.query as { page: number; limit: number };

      const result = await orderService.getMyOrders(userId, page, limit);

      return reply.send({
        success: true,
        data: result.orders,
        meta: { total: result.total, page, limit, pages: Math.ceil(result.total / limit) },
      });
    },
  );

  /**
   * GET /api/v1/orders/:number
   * Full order detail + tracking timeline (authenticated customer only).
   */
  app.get(
    "/:number",
    {
      preHandler: requireAuth,
      schema: {
        description: "Get order detail and tracking timeline",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { number: { type: "string", example: "ND-00001" } } },
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const order = await orderService.getOrderByNumber(number, req.authUser!.userId);
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
        params: { type: "object", properties: { number: { type: "string" } } },
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const order = await orderService.cancelOrder(number, req.authUser!.userId);
      return reply.send({ success: true, data: { orderNumber: number, status: order.status } });
    },
  );

  /**
   * POST /api/v1/orders/verify-payment
   * Verifies a Paystack reference server-side and idempotently settles the order.
   */
  app.post(
    "/verify-payment",
    {
      preHandler: optionalAuth,
      schema: {
        description: "Verify Paystack payment server-side",
        tags: ["Orders"],
        body: {
          type: "object",
          required: ["orderNumber", "reference"],
          properties: {
            orderNumber: { type: "string", maxLength: 50 },
            reference: { type: "string", minLength: 4, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const { orderNumber, reference } = req.body as { orderNumber: string; reference: string };
      const data = await paymentService.verify(orderNumber, reference, req.authUser ?? null);
      return reply.send({ success: true, data });
    },
  );

  /**
   * POST /api/v1/orders/:number/initialize-payment
   * Server-side initialization of a Paystack transaction.
   */
  app.post(
    "/:number/initialize-payment",
    {
      preHandler: optionalAuth,
      schema: {
        description: "Initialize Paystack transaction server-side",
        tags: ["Orders"],
        params: { type: "object", properties: { number: { type: "string" } } },
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            callbackUrl: { type: "string", maxLength: 2000 },
            method: { type: "string", enum: ["CARD", "MOMO", "card", "momo"] },
          },
        },
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const body = (req.body || {}) as { email?: string; callbackUrl?: string; method?: string };
      const data = await paymentService.initialize(number, body, req.authUser ?? null);
      return reply.send({ success: true, data });
    },
  );

  /**
   * GET /api/v1/orders/track/:number
   * Public tracking (guests / buyers without authentication) with privacy masking.
   */
  app.get(
    "/track/:number",
    {
      schema: {
        description: "Public order tracking timeline with privacy masking",
        tags: ["Orders"],
        params: { type: "object", properties: { number: { type: "string" } } },
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const data = await orderService.getPublicTracking(number);
      return reply.send({ success: true, data });
    },
  );

  /**
   * POST /api/v1/orders/webhook/paystack
   * Paystack payment webhook (HMAC-SHA512 verified, idempotent).
   * Rate limiting is disabled here: authenticity is enforced by the signature,
   * and throttling Paystack's retries would only delay legitimate settlements.
   */
  app.post(
    "/webhook/paystack",
    {
      config: { rateLimit: false },
      schema: {
        description: "Paystack Payment Webhook Handler (Idempotent)",
        tags: ["Orders"],
      },
    },
    async (req, reply) => {
      const outcome = await paymentService.handleWebhook({
        rawBody: (req as any).rawBody as string | undefined,
        signature: req.headers["x-paystack-signature"] as string | undefined,
        payload: req.body,
        ip: req.ip,
      });
      return reply.status(outcome.status).send(outcome.body);
    },
  );
};

// ─── Admin Order Routes ───────────────────────────────────────────────────────

export const adminOrderRoutes: FastifyPluginAsync = async (app) => {
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
            status: { type: "string", enum: ORDER_STATUSES },
          },
        },
      },
    },
    async (req, reply) => {
      const { page, limit, status } = req.query as { page: number; limit: number; status?: OrderStatus };
      const result = await orderService.getAllOrders({ page, limit, status });

      return reply.send({
        success: true,
        data: result.orders,
        meta: { total: result.total, page, limit, pages: Math.ceil(result.total / limit) },
      });
    },
  );

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

  app.patch(
    "/:id/status",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Admin: update order status",
        tags: ["Admin", "Orders"],
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ORDER_STATUSES },
            note: { type: "string", maxLength: 1000 },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { status, note } = req.body as { status: OrderStatus; note?: string };

      const order = await orderService.updateOrderStatus(id, status, note, req.authUser!.userId);

      return reply.send({ success: true, data: { orderId: order.id, status: order.status } });
    },
  );
};

// ─── Vendor Order Routes ──────────────────────────────────────────────────────

export const vendorOrderRoutes: FastifyPluginAsync = async (app) => {
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
      const { page, limit } = req.query as { page: number; limit: number };

      // Tenant isolation: the vendor scope ALWAYS comes from the verified identity,
      // never from client input (and never falls back to a user id).
      const vendorId = await resolveVendorId(req.authUser!);
      if (!vendorId) {
        return reply.status(403).send({
          success: false,
          error: { code: "NO_VENDOR", message: "Not associated with a vendor store" },
        });
      }

      const result = await orderService.getVendorOrders(vendorId, page, limit);

      return reply.send({
        success: true,
        data: result.vendorOrders,
        meta: { total: result.total, page, limit, pages: Math.ceil(result.total / limit) },
      });
    },
  );

  app.patch(
    "/my-orders/:vendorOrderId/status",
    {
      preHandler: requireVendor,
      schema: {
        description: "Vendor: update fulfillment status of a sub-order",
        tags: ["Vendors", "Orders"],
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { vendorOrderId: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] },
          },
        },
      },
    },
    async (req, reply) => {
      const { vendorOrderId } = req.params as { vendorOrderId: string };
      const { status } = req.body as { status: VendorOrderStatus };

      const vendorId = await resolveVendorId(req.authUser!);
      if (!vendorId) {
        return reply.status(403).send({
          success: false,
          error: { code: "NO_VENDOR", message: "Not associated with a vendor store" },
        });
      }

      const vendorOrder = await orderService.updateVendorOrderStatus(vendorOrderId, status, vendorId);

      return reply.send({
        success: true,
        data: { vendorOrderId: vendorOrder.id, status: vendorOrder.status },
      });
    },
  );
};
