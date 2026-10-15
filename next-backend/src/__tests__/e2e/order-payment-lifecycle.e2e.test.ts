import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

describe("E2E: Order Placement, Checkout & Payment Verification Lifecycle", { timeout: 35000 }, () => {
  let app: FastifyInstance;
  let testProductId: string;
  let testOrderNumber = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Ensure at least one active product exists for checkout
    let product = await prisma.product.findFirst({
      where: { stockStatus: "IN_STOCK", stockQty: { gt: 5 } },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: "E2E Test Smartphone Case",
          slug: `e2e-test-case-${Date.now()}`,
          description: "E2E test product description",
          price: 50.0,
          stockQty: 25,
          stockStatus: "IN_STOCK",
        },
      });
    }
    testProductId = product.id;
  });

  afterAll(async () => {
    // Cleanup created test order
    if (testOrderNumber) {
      try {
        const order = await prisma.order.findUnique({ where: { number: testOrderNumber } });
        if (order) {
          const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
          const paymentIds = payments.map((p) => p.id);
          if (paymentIds.length > 0) {
            await prisma.paymentAttempt.deleteMany({ where: { paymentId: { in: paymentIds } } });
          }
          await prisma.payment.deleteMany({ where: { orderId: order.id } });
          await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
          await prisma.vendorOrder.deleteMany({ where: { orderId: order.id } });
          await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
          await prisma.order.delete({ where: { id: order.id } });
        }
      } catch {
        // Ignore cleanup error
      }
    }
    await app.close();
  });

  it("places a new order with guest checkout via POST /api/v1/orders", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      payload: {
        guestEmail: "guest_buyer@nextdor.test",
        deliveryMethod: "STANDARD",
        cart: [
          {
            productId: testProductId,
            quantity: 2,
            name: "E2E Test Smartphone Case",
            price: 50.0,
          },
        ],
        shippingAddress: {
          recipientName: "Ama Serwaa",
          recipientPhone: "+233551234567",
          street: "14 Ring Road Central",
          city: "Accra",
          region: "Greater Accra",
          digitalAddress: "GA-014-9988",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.orderNumber).toBeDefined();
    testOrderNumber = body.data.orderNumber;
    expect(body.data.status).toBe("PENDING");
    expect(Number(body.data.total)).toBeGreaterThan(0);
  });

  it("retrieves the live order tracking stepper via GET /api/v1/orders/track/:number", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/track/${testOrderNumber}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.orderNumber).toBe(testOrderNumber);
    expect(body.data.status).toBe("PENDING");
  });

  it("initializes Paystack transaction for the order via POST /api/v1/orders/:number/initialize-payment", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${testOrderNumber}/initialize-payment`,
      payload: {
        email: "guest_buyer@nextdor.test",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.reference).toBeDefined();
    expect(body.data.reference).toContain(testOrderNumber);

    const paystackRef = body.data.reference;

    // Settle / Verify the payment using development mock reference
    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders/verify-payment",
      payload: {
        orderNumber: testOrderNumber,
        reference: paystackRef,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.paymentStatus).toBe("PAID");
  });

  it("confirms order status transitions to PAID/CONFIRMED after payment settlement", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/track/${testOrderNumber}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.paymentStatus).toBe("PAID");
  });
});
