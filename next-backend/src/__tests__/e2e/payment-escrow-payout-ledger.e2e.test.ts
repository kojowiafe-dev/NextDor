import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";

describe("E2E: Payment Lifecycle, 48-Hour Escrow, MoMo Payouts & Financial Ledger Reconciliation", { timeout: 45000 }, () => {
  let app: FastifyInstance;

  const testId = Date.now();
  const testCustomerEmail = `escrow_customer_${testId}@nextdor.test`;
  const testVendorEmail = `escrow_vendor_${testId}@nextdor.test`;
  const testAdminEmail = `escrow_admin_${testId}@nextdor.test`;
  const testOrderNumber = `ND-ESCROW-${testId.toString().slice(-5)}`;

  let customerUserId = "";
  let vendorUserId = "";
  let adminUserId = "";
  let vendorId = "";
  let productId = "";

  let customerToken = "";
  let vendorToken = "";
  let adminToken = "";

  let orderId = "";
  let vendorOrderId = "";
  let createdBatchId = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a Super Admin user
    const admin = await prisma.user.create({
      data: {
        name: "Financial Controller",
        email: testAdminEmail,
        passwordHash: "bcrypt_dummy_hash",
        role: "SUPER_ADMIN",
        emailVerified: true,
      },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign(
      { sub: admin.id, role: "SUPER_ADMIN", email: admin.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Create a Vendor Owner user & Vendor Store
    const vendorUser = await prisma.user.create({
      data: {
        name: "Kofi Merchant",
        email: testVendorEmail,
        passwordHash: "bcrypt_dummy_hash",
        role: "VENDOR_OWNER",
        emailVerified: true,
        phone: "+233241234567",
      },
    });
    vendorUserId = vendorUser.id;

    const vendor = await prisma.vendor.create({
      data: {
        name: `Accra Tech Hub ${testId}`,
        slug: `accra-tech-hub-${testId}`,
        email: testVendorEmail,
        phone: "+233241234567",
        momoNumber: "0241234567",
        momoNetwork: "MTN",
        commissionRate: 10, // 10% platform commission
        status: "ACTIVE",
        ownerId: vendorUser.id,
      },
    });
    vendorId = vendor.id;

    await prisma.user.update({
      where: { id: vendorUser.id },
      data: { vendorId: vendor.id },
    });

    vendorToken = jwt.sign(
      { sub: vendorUser.id, role: "VENDOR_OWNER", email: vendorUser.email, vendorId: vendor.id },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Create a Customer user
    const customer = await prisma.user.create({
      data: {
        name: "Kwame Buyer",
        email: testCustomerEmail,
        passwordHash: "bcrypt_dummy_hash",
        role: "CUSTOMER",
        emailVerified: true,
        phone: "+233559876543",
      },
    });
    customerUserId = customer.id;
    customerToken = jwt.sign(
      { sub: customer.id, role: "CUSTOMER", email: customer.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Create a Product for this vendor
    const product = await prisma.product.create({
      data: {
        name: "Wireless ANC Headphones GH",
        slug: `anc-headphones-${testId}`,
        description: "High fidelity wireless noise cancelling headphones",
        price: 100.0,
        stockQty: 50,
        stockStatus: "IN_STOCK",
        vendorId: vendor.id,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    try {
      if (orderId) {
        // Clean up payouts and batches
        if (createdBatchId) {
          await prisma.vendorPayout.deleteMany({ where: { batchId: createdBatchId } });
          await prisma.payoutBatch.deleteMany({ where: { id: createdBatchId } });
        }
        await prisma.vendorPayout.deleteMany({ where: { vendorId } });

        // Clean up payment attempts and payments
        const payments = await prisma.payment.findMany({ where: { orderId } });
        const pIds = payments.map((p) => p.id);
        if (pIds.length > 0) {
          await prisma.paymentAttempt.deleteMany({ where: { paymentId: { in: pIds } } });
        }
        await prisma.payment.deleteMany({ where: { orderId } });

        // Clean up vendor orders, items, order
        await prisma.vendorOrder.deleteMany({ where: { orderId } });
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.orderStatusHistory.deleteMany({ where: { orderId } });
        await prisma.order.deleteMany({ where: { id: orderId } });
      }

      if (productId) {
        await prisma.product.deleteMany({ where: { id: productId } });
      }

      if (vendorId) {
        await prisma.vendor.deleteMany({ where: { id: vendorId } });
      }

      if (vendorUserId) await prisma.user.deleteMany({ where: { id: vendorUserId } });
      if (customerUserId) await prisma.user.deleteMany({ where: { id: customerUserId } });
      if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
    } catch {
      // Ignore cleanup error in test
    }
    await app.close();
  });

  it("Step 1: Creates an order, settles payment, and verifies financial split invariants", async () => {
    // 2 units * GH₵100 = GH₵200 subtotal, GH₵20 delivery fee = GH₵220 total
    const itemSubtotal = 200.0;
    const deliveryFee = 20.0;
    const total = 220.0;
    const commission = 20.0; // 10% of 200
    const vendorEarnings = 180.0;

    const order = await prisma.order.create({
      data: {
        number: testOrderNumber,
        userId: customerUserId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        currency: "GHS",
        subtotal: itemSubtotal,
        deliveryFee,
        total,
        deliveryMethod: "STANDARD",
        shippingAddress: {
          recipientName: "Kwame Buyer",
          recipientPhone: "+233559876543",
          addressLine1: "12 Airport Bypass",
          city: "Accra",
          region: "Greater Accra",
          digitalAddress: "GA-440-1234",
        },
        items: {
          create: {
            productId,
            vendorId,
            productName: "Wireless ANC Headphones GH",
            quantity: 2,
            unitPrice: 100.0,
            subtotal: itemSubtotal,
          },
        },
      },
    });
    orderId = order.id;

    // Record successful Paystack gateway payment
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paystackRef: `ND-${testOrderNumber}-paymock`,
        method: "MOMO",
        amount: total,
        currency: "GHS",
        status: "SUCCESS",
        paidAt: new Date(),
      },
    });

    // Create VendorOrder record (simulating checkout partition)
    const vOrder = await prisma.vendorOrder.create({
      data: {
        orderId: order.id,
        vendorId,
        subtotal: itemSubtotal,
        commissionAmount: commission,
        vendorEarnings,
        status: "PROCESSING",
        // Not cleared yet because order is not delivered
        clearedAt: null,
      },
    });
    vendorOrderId = vOrder.id;

    expect(Number(vOrder.subtotal)).toBe(200.0);
    expect(Number(vOrder.commissionAmount)).toBe(20.0);
    expect(Number(vOrder.vendorEarnings)).toBe(180.0);
    // Invariant: Subtotal = Commission + VendorEarnings
    expect(Number(vOrder.commissionAmount) + Number(vOrder.vendorEarnings)).toBe(Number(vOrder.subtotal));
  });

  it("Step 2: Pre-delivery Vendor Dashboard shows zero escrow and zero available balance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/vendors/portal/payouts",
      headers: {
        authorization: `Bearer ${vendorToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const { escrowSummary } = body.data;
    // Lifetime earnings tracked
    expect(escrowSummary.lifetimeGrossSales).toBe(200.0);
    expect(escrowSummary.lifetimeNetEarnings).toBe(180.0);
    // Pre-delivery: funds are not in 48h escrow yet, nor available for payout
    expect(escrowSummary.inEscrowAmount).toBe(0);
    expect(escrowSummary.inEscrowOrdersCount).toBe(0);
    expect(escrowSummary.availableForPayoutAmount).toBe(0);
    expect(escrowSummary.availableOrdersCount).toBe(0);
  });

  it("Step 3: Delivering order initiates 48-hour escrow — funds lock into inEscrowAmount", async () => {
    // Merchant marks sub-order DELIVERED
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/vendors/portal/orders/${vendorOrderId}/status`,
      headers: {
        authorization: `Bearer ${vendorToken}`,
      },
      payload: {
        status: "DELIVERED",
        notes: "Package delivered to customer via Fez courier",
      },
    });

    expect(patchRes.statusCode).toBe(200);

    // Verify in database that clearedAt is set to ~48 hours in the future
    const updatedVo = await prisma.vendorOrder.findUnique({
      where: { id: vendorOrderId },
    });
    expect(updatedVo?.status).toBe("DELIVERED");
    expect(updatedVo?.clearedAt).not.toBeNull();
    const hoursFromNow = (updatedVo!.clearedAt!.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursFromNow).toBeGreaterThan(47);
    expect(hoursFromNow).toBeLessThanOrEqual(48.1);

    // Check Vendor Dashboard: funds are now held in 48h Escrow Protection
    const vendorDashboardRes = await app.inject({
      method: "GET",
      url: "/api/v1/vendors/portal/payouts",
      headers: {
        authorization: `Bearer ${vendorToken}`,
      },
    });

    expect(vendorDashboardRes.statusCode).toBe(200);
    const vBody = JSON.parse(vendorDashboardRes.payload);
    expect(vBody.data.escrowSummary.inEscrowAmount).toBe(180.0);
    expect(vBody.data.escrowSummary.inEscrowOrdersCount).toBe(1);
    expect(vBody.data.escrowSummary.availableForPayoutAmount).toBe(0); // Buyer protection period active!

    // Check Admin Ledger: shows in-escrow liability and mathematically balances
    const ledgerRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reconciliation/ledger",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(ledgerRes.statusCode).toBe(200);
    const ledgerBody = JSON.parse(ledgerRes.payload);
    expect(ledgerBody.success).toBe(true);

    const ledger = ledgerBody.data;
    expect(ledger.liabilities.vendorEscrowPendingGhs).toBeGreaterThanOrEqual(180.0);
    expect(ledger.inflow.totalCustomerPaymentsGhs).toBeGreaterThanOrEqual(220.0);
    expect(ledger.reconciliation.isReconciled).toBe(true);
    expect(Math.abs(ledger.reconciliation.varianceGhs)).toBeLessThan(1.0);
  });

  it("Step 4: Simulates 48-hour escrow maturation — funds transition to availableForPayoutAmount", async () => {
    // Fast-forward clearedAt in DB to 10 seconds in the past (48h elapsed)
    await prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: { clearedAt: new Date(Date.now() - 10000) },
    });

    // Verify Vendor Dashboard: inEscrow drops to 0, availableForPayout becomes 180.00
    const vendorDashboardRes = await app.inject({
      method: "GET",
      url: "/api/v1/vendors/portal/payouts",
      headers: {
        authorization: `Bearer ${vendorToken}`,
      },
    });

    expect(vendorDashboardRes.statusCode).toBe(200);
    const vBody = JSON.parse(vendorDashboardRes.payload);
    expect(vBody.data.escrowSummary.inEscrowAmount).toBe(0);
    expect(vBody.data.escrowSummary.inEscrowOrdersCount).toBe(0);
    expect(vBody.data.escrowSummary.availableForPayoutAmount).toBe(180.0);
    expect(vBody.data.escrowSummary.availableOrdersCount).toBe(1);

    // Verify Admin Ledger reflects transition from escrow liability to available liability
    const ledgerRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reconciliation/ledger",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(ledgerRes.statusCode).toBe(200);
    const ledger = JSON.parse(ledgerRes.payload).data;
    expect(ledger.liabilities.vendorAvailablePayoutGhs).toBeGreaterThanOrEqual(180.0);
    expect(ledger.reconciliation.isReconciled).toBe(true);
    expect(Math.abs(ledger.reconciliation.varianceGhs)).toBeLessThan(1.0);
  });

  it("Step 5: Admin generates payout batch aggregating cleared merchant escrow funds", async () => {
    const batchRes = await app.inject({
      method: "POST",
      url: "/api/v1/payouts/batches",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        minThreshold: 10,
        vendorIds: [vendorId],
        notes: "Automated weekly mobile money payout batch",
      },
    });

    expect(batchRes.statusCode).toBe(201);
    const body = JSON.parse(batchRes.payload);
    expect(body.success).toBe(true);

    const batch = body.data.batch;
    createdBatchId = batch.id;
    expect(batch.batchReference).toContain("PB-");
    expect(Number(batch.totalAmount)).toBe(180.0);
    expect(batch.status).toBe("PENDING");

    const payouts = body.data.payouts;
    expect(payouts).toHaveLength(1);
    expect(payouts[0].vendorId).toBe(vendorId);
    expect(Number(payouts[0].amount)).toBe(180.0);
  });

  it("Step 6: Admin executes batch and dispatches Mobile Money transfer to vendor", async () => {
    const execRes = await app.inject({
      method: "POST",
      url: "/api/v1/payouts/batches/execute",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        batchId: createdBatchId,
      },
    });

    expect(execRes.statusCode).toBe(200);
    const body = JSON.parse(execRes.payload);
    expect(body.success).toBe(true);

    // Find the vendor payout record
    const payout = await prisma.vendorPayout.findFirst({
      where: { batchId: createdBatchId },
    });
    expect(payout).not.toBeNull();
    expect(Number(payout!.amount)).toBe(180.0);

    // Settle payout status to PAID (simulating instant MoMo completion)
    await prisma.vendorPayout.update({
      where: { id: payout!.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paystackTransferRef: "TRF_MOCK_SUCCESS_123",
      },
    });

    await prisma.payoutBatch.update({
      where: { id: createdBatchId },
      data: { status: "SUCCESS" },
    });
  });

  it("Step 7: Post-disbursement verification — Vendor and Admin dashboards show perfect zero-variance balance", async () => {
    // 1. Vendor Portal Dashboard
    const vendorDashboardRes = await app.inject({
      method: "GET",
      url: "/api/v1/vendors/portal/payouts",
      headers: {
        authorization: `Bearer ${vendorToken}`,
      },
    });

    expect(vendorDashboardRes.statusCode).toBe(200);
    const vBody = JSON.parse(vendorDashboardRes.payload);
    const { escrowSummary, payouts } = vBody.data;

    // Balance cleared: Available drops back to 0, totalPaidOut increases by 180
    expect(escrowSummary.availableForPayoutAmount).toBe(0);
    expect(escrowSummary.inEscrowAmount).toBe(0);
    expect(escrowSummary.totalPaidOut).toBeGreaterThanOrEqual(180.0);

    // Payout record appears with PAID status
    const matchedPayout = payouts.find((p: any) => p.vendorId === vendorId);
    expect(matchedPayout).toBeDefined();
    expect(matchedPayout.status).toBe("PAID");
    expect(Number(matchedPayout.amount)).toBe(180.0);

    // 2. Super Admin Financial Ledger
    const ledgerRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reconciliation/ledger",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(ledgerRes.statusCode).toBe(200);
    const ledger = JSON.parse(ledgerRes.payload).data;

    // Disbursed amount reflects payout
    expect(ledger.disbursements.totalPaidOutGhs).toBeGreaterThanOrEqual(180.0);
    // Platform revenue (Commission + Delivery Fee)
    expect(ledger.equity.totalCommissionGhs).toBeGreaterThanOrEqual(20.0);
    // Mathematical Reconciliation Invariant holds
    expect(ledger.reconciliation.isReconciled).toBe(true);
    expect(Math.abs(ledger.reconciliation.varianceGhs)).toBeLessThan(1.0);
  });
});
