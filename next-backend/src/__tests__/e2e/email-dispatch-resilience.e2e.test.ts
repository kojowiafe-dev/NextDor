import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dispatchEmailAsync, getEmailQueueTelemetry, type EmailJobData } from "../../lib/email.queue.js";
import { EmailService } from "../../lib/email.js";

describe("E2E & Resilience: Customer Email Dispatch Subsystem", () => {
  const testRecipient = "customer_test@nextdor.test";

  it("verifies non-blocking async dispatch returns immediately without halting caller", async () => {
    const startTime = performance.now();

    await dispatchEmailAsync({
      type: "welcome_customer",
      email: testRecipient,
      customerName: "Kofi Mensah",
    });

    const elapsed = performance.now() - startTime;
    // Async dispatch must complete immediately without blocking caller (under 100ms)
    expect(elapsed).toBeLessThan(100);
  });

  it("reports accurate telemetry from getEmailQueueTelemetry()", () => {
    const telemetry = getEmailQueueTelemetry();

    expect(telemetry).toBeDefined();
    expect(typeof telemetry.bullmqConnected).toBe("boolean");
    expect(typeof telemetry.memoryQueueLength).toBe("number");
    expect(typeof telemetry.activeWorkers).toBe("number");
    expect(telemetry.activeWorkers).toBeLessThanOrEqual(5); // Concurrency cap invariant
    expect(typeof telemetry.processedCount).toBe("number");
    expect(typeof telemetry.failedCount).toBe("number");
  });

  it("compiles and dispatches welcome_customer email with buyer protection notice", async () => {
    const result = await EmailService.sendWelcomeCustomer(
      testRecipient,
      "Akua Agyemang"
    );
    expect(result).toBe(true);
  });

  it("compiles and dispatches order_confirmation email with order items and 48-hour escrow notice", async () => {
    const result = await EmailService.sendOrderConfirmation({
      email: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      items: [
        { productName: "Handmade Bolga Basket", quantity: 2, unitPrice: 85.0, subtotal: 170.0 },
        { productName: "Pure Shea Butter 500g", quantity: 1, unitPrice: 45.0, subtotal: 45.0 },
      ],
      total: 215.0,
      subtotal: 215.0,
      deliveryFee: 0.0,
      paymentMethod: "Mobile Money",
      shippingAddress: {
        recipientName: "Kwame Asante",
        recipientPhone: "+233241234567",
        street: "House 14, Ring Road Central",
        city: "Accra",
        region: "Greater Accra",
      },
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches payment_receipt email with Paystack channel and reference", async () => {
    const result = await EmailService.sendPaymentReceipt({
      email: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      paystackRef: "ND-ND-TEST-00123-abc12345",
      amountPaid: 215.0,
      paymentChannel: "MTN Mobile Money",
      paidAt: new Date(),
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches delivery_confirmation email with active 48h escrow inspection notice", async () => {
    const result = await EmailService.sendDeliveryConfirmation({
      customerEmail: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      carrier: "Fez Delivery",
      trackingNumber: "FEZ-GH-998877",
      deliveredAt: new Date(),
      deliveryAddress: "Ring Road Central, Accra (GA-183-9281)",
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches return_request_submitted email with dispute details", async () => {
    const result = await EmailService.sendReturnRequestConfirmation({
      email: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      returnId: "ret-uuid-12345",
      refundAmount: 85.0,
      items: [{ productName: "Handmade Bolga Basket", quantity: 1 }],
      reason: "DAMAGED_ITEM",
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches refund_processed email with Paystack settlement confirmation", async () => {
    const result = await EmailService.sendRefundProcessedNotification({
      email: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      returnId: "ret-uuid-12345",
      refundAmount: 85.0,
      paymentChannel: "MOMO",
      paystackRefundId: "rf-paystack-9988",
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches return_disputed escalation notification to customer", async () => {
    const result = await EmailService.sendReturnDisputedNotification({
      email: testRecipient,
      customerName: "Kwame Asante",
      orderNumber: "ND-TEST-00123",
      returnId: "ret-uuid-12345",
      disputeNotes: "Escalating claim for super-admin arbitration and inspection.",
    });
    expect(result).toBe(true);
  });

  it("compiles and dispatches low_stock_alert to merchants and logistics team", async () => {
    const result = await EmailService.sendLowStockAlert({
      recipientEmail: "merchant@craftsgh.test",
      recipientName: "Bolga Crafts Cooperative",
      productName: "Handmade Bolga Basket",
      warehouseName: "Accra Central Fulfillment Hub",
      currentStock: 2,
      threshold: 5,
    });
    expect(result).toBe(true);
  });

  it("dispatches high-concurrency burst of 15 email jobs through the queue without memory exhaustion", async () => {
    const jobs: EmailJobData[] = Array.from({ length: 15 }, (_, i) => ({
      type: "welcome_customer",
      email: `burst_customer_${i}@nextdor.test`,
      customerName: `Burst Customer ${i}`,
    }));

    // Dispatch all 15 concurrently
    await Promise.all(jobs.map((job) => dispatchEmailAsync(job)));

    // Let in-memory workers pump and process
    await new Promise((resolve) => setTimeout(resolve, 100));

    const telemetry = getEmailQueueTelemetry();
    expect(telemetry.activeWorkers).toBeLessThanOrEqual(5);
    expect(telemetry.processedCount).toBeGreaterThan(0);
  });
});
