import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";

describe("E2E: Fulfillment, Courier Tracking & 48-Hour Escrow Returns", { timeout: 35000 }, () => {
  let app: FastifyInstance;

  const testId = Date.now();
  const testCustomerEmail = `customer_${testId}@nextdor.test`;
  const testAdminEmail = `admin_${testId}@nextdor.test`;
  const testOrderNumber = `ND-RET-${testId.toString().slice(-5)}`;
  const testTrackingNumber = `FEZ-GH-${testId.toString().slice(-6)}`;

  let customerUserId = "";
  let adminUserId = "";
  let customerToken = "";
  let adminToken = "";
  let createdOrderId = "";
  let createdOrderItemId = "";
  let createdShipmentId = "";
  let returnRequestId = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a customer user
    const customer = await prisma.user.create({
      data: {
        name: "Abena Serwaa",
        email: testCustomerEmail,
        passwordHash: "bcrypt_hashed_dummy_pw",
        role: "CUSTOMER",
        emailVerified: true,
        phone: "+233240001122",
      },
    });
    customerUserId = customer.id;
    customerToken = jwt.sign(
      { sub: customer.id, role: "CUSTOMER", email: customer.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Create an admin user
    const admin = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: testAdminEmail,
        passwordHash: "bcrypt_hashed_dummy_pw",
        role: "ADMIN",
        emailVerified: true,
      },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign(
      { sub: admin.id, role: "ADMIN", email: admin.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Find or use an existing vendor & product in the database
    let product = await prisma.product.findFirst({
      where: { deletedAt: null, stockStatus: "IN_STOCK" },
      include: { vendor: true },
    });

    if (!product) {
      // Create fallback vendor & product
      const vendor = await prisma.vendor.create({
        data: {
          name: `Test Vendor ${testId}`,
          slug: `test-vendor-${testId}`,
          email: `vendor_${testId}@nextdor.test`,
          phone: "+233201112233",
          status: "APPROVED",
        },
      });

      product = await prisma.product.create({
        data: {
          name: "Organic Shea Butter 250ml",
          description: "Pure handcrafted shea butter from northern Ghana",
          slug: `shea-butter-${testId}`,
          price: 65.0,
          stockQty: 50,
          stockStatus: "IN_STOCK",
          vendorId: vendor.id,
        },
        include: { vendor: true },
      });
    }

    // 4. Create an order with an orderItem, payment, and shipment
    const order = await prisma.order.create({
      data: {
        number: testOrderNumber,
        userId: customerUserId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        currency: "GHS",
        subtotal: 65.0,
        deliveryFee: 15.0,
        total: 80.0,
        deliveryMethod: "STANDARD",
        shippingAddress: {
          recipientName: "Abena Serwaa",
          recipientPhone: "+233240001122",
          addressLine1: "House 14, Ring Road Central",
          city: "Accra",
          region: "Greater Accra",
          digitalAddress: "GA-183-9281",
        },
        items: {
          create: {
            productId: product.id,
            vendorId: product.vendorId,
            productName: product.name,
            quantity: 1,
            unitPrice: 65.0,
            subtotal: 65.0,
          },
        },
      },
      include: { items: true },
    });

    createdOrderId = order.id;
    createdOrderItemId = order.items[0].id;

    // Create successful payment
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paystackRef: `ND-${testOrderNumber}-paymock`,
        method: "CARD",
        amount: 80.0,
        currency: "GHS",
        status: "SUCCESS",
        paidAt: new Date(),
      },
    });

    // Create shipment record
    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: "Fez Delivery",
        trackingNumber: testTrackingNumber,
        status: "LABEL_CREATED",
      },
    });
    createdShipmentId = shipment.id;
  });

  afterAll(async () => {
    try {
      if (createdOrderId) {
        // Clean up refund records
        await prisma.refund.deleteMany({ where: { returnRequest: { orderId: createdOrderId } } });
        // Clean up return requests
        await prisma.returnRequest.deleteMany({ where: { orderId: createdOrderId } });
        // Clean up shipment events and shipment
        if (createdShipmentId) {
          await prisma.shipmentEvent.deleteMany({ where: { shipmentId: createdShipmentId } });
          await prisma.shipment.deleteMany({ where: { id: createdShipmentId } });
        }
        // Clean up payments
        const payments = await prisma.payment.findMany({ where: { orderId: createdOrderId } });
        const pIds = payments.map((p) => p.id);
        if (pIds.length > 0) {
          await prisma.paymentAttempt.deleteMany({ where: { paymentId: { in: pIds } } });
        }
        await prisma.payment.deleteMany({ where: { orderId: createdOrderId } });
        // Clean up items & order history
        await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.vendorOrder.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.orderStatusHistory.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.order.delete({ where: { id: createdOrderId } });
      }

      if (customerUserId) {
        await prisma.user.delete({ where: { id: customerUserId } }).catch(() => {});
      }
      if (adminUserId) {
        await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
      }
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it("handles inbound courier webhook for IN_TRANSIT milestone", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/logistics/webhooks/courier",
      payload: {
        carrier: "Fez Delivery",
        trackingNumber: testTrackingNumber,
        status: "IN_TRANSIT",
        location: "Accra Central Sorting Depot",
        description: "Package departed sort facility to local delivery hub",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("IN_TRANSIT");

    // Verify order transitioned to SHIPPED
    const updatedOrder = await prisma.order.findUnique({ where: { id: createdOrderId } });
    expect(updatedOrder?.status).toBe("SHIPPED");
  });

  it("handles courier DELIVERED milestone and activates the 48-hour buyer protection escrow window", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/logistics/webhooks/courier",
      payload: {
        carrier: "Fez Delivery",
        trackingNumber: testTrackingNumber,
        status: "DELIVERED",
        location: "Ring Road Central, Accra",
        description: "Delivered to recipient with buyer signature",
        courierName: "Kwame K.",
        courierPhone: "+233541112233",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("DELIVERED");

    // Order status must now be DELIVERED
    const deliveredOrder = await prisma.order.findUnique({ where: { id: createdOrderId } });
    expect(deliveredOrder?.status).toBe("DELIVERED");
  });

  it("allows the customer to submit a return request within the 48-hour escrow window", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/returns/orders/${testOrderNumber}/returns`,
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      payload: {
        reason: "DAMAGED_ITEM",
        details: "The packaging seal was broken upon receipt and product was damaged.",
        evidenceUrls: ["https://res.cloudinary.com/nextdor/image/upload/sample_damage.jpg"],
        items: [
          {
            orderItemId: createdOrderItemId,
            quantity: 1,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    returnRequestId = body.data.id;
    expect(body.data.status).toBe("REQUESTED");
    expect(Number(body.data.refundAmount)).toBe(65.0);
  });

  it("allows customer to dispute the return request to escalate to super-admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/returns/${returnRequestId}/dispute`,
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      payload: {
        disputeNotes: "Escalating claim for immediate super-admin mediation and inspection.",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isDisputed).toBe(true);
    expect(body.data.disputeNotes).toContain("immediate super-admin mediation");
  });

  it("allows admin to review, arbitrate, and APPROVE the return, triggering refund settlement", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/returns/${returnRequestId}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        decision: "APPROVED",
        note: "Escrow arbitration complete: evidence validated, refund issued to buyer.",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("APPROVED");

    // Verify refund record was created and settled
    const refund = await prisma.refund.findFirst({
      where: { returnRequestId },
    });
    expect(refund).toBeDefined();
    expect(refund?.status).toBe("PROCESSED");
    expect(Number(refund?.amount)).toBe(65.0);
  });
});
