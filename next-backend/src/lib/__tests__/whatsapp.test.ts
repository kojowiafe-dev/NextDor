import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeGhanaWhatsAppNumber, WhatsAppService } from "../whatsapp.js";
import { config } from "../../config/env.js";

// Mock email queue
vi.mock("../email.queue.js", () => ({
  dispatchEmailAsync: vi.fn().mockResolvedValue(true),
}));

// Mock prisma
vi.mock("../prisma.js", () => ({
  prisma: {
    notificationLog: {
      create: vi.fn().mockResolvedValue({ id: "log-123" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(10),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    },
    vendor: {
      findUnique: vi.fn(),
    },
  },
}));

describe("WhatsApp Service & Meta Normalization (whatsapp.ts)", () => {
  describe("normalizeGhanaWhatsAppNumber", () => {
    it("normalizes local Ghanaian numbers with leading zero", () => {
      expect(normalizeGhanaWhatsAppNumber("0244123456")).toBe("233244123456");
      expect(normalizeGhanaWhatsAppNumber("0551234567")).toBe("233551234567");
      expect(normalizeGhanaWhatsAppNumber("0209876543")).toBe("233209876543");
      expect(normalizeGhanaWhatsAppNumber("0302123456")).toBe("233302123456");
    });

    it("handles numbers with spaces, hyphens, and parentheses", () => {
      expect(normalizeGhanaWhatsAppNumber("024-412-3456")).toBe("233244123456");
      expect(normalizeGhanaWhatsAppNumber("(024) 412 3456")).toBe("233244123456");
      expect(normalizeGhanaWhatsAppNumber("+233 24 412 3456")).toBe("233244123456");
    });

    it("leaves already normalized international numbers intact", () => {
      expect(normalizeGhanaWhatsAppNumber("233244123456")).toBe("233244123456");
      expect(normalizeGhanaWhatsAppNumber("+233244123456")).toBe("233244123456");
    });

    it("returns null for invalid or empty numbers", () => {
      expect(normalizeGhanaWhatsAppNumber("")).toBeNull();
      expect(normalizeGhanaWhatsAppNumber(null)).toBeNull();
      expect(normalizeGhanaWhatsAppNumber(undefined)).toBeNull();
      expect(normalizeGhanaWhatsAppNumber("123")).toBeNull();
    });
  });

  describe("WhatsAppService Dispatch Methods in Dev/Mock Mode", () => {
    it("successfully sends 6-digit OTP code in dev mode", async () => {
      const sent = await WhatsAppService.sendOtp("0244123456", "123456", "verification", {
        email: "shopper@nextdor.com",
        name: "Test Shopper",
      });
      expect(sent).toBe(true);
    });

    it("successfully sends order received confirmation", async () => {
      const sent = await WhatsAppService.sendOrderReceived("0244123456", {
        orderNumber: "ND-00001",
        total: 150.0,
        customerName: "Kojo Wiafe",
        itemCount: 2,
      });
      expect(sent).toBe(true);
    });

    it("successfully sends payment receipt summary", async () => {
      const sent = await WhatsAppService.sendPaymentReceipt("0244123456", {
        orderNumber: "ND-00001",
        amountPaid: 150.0,
        paystackRef: "ND-00001-abc12345",
        paymentChannel: "mobile_money",
        customerName: "Kojo Wiafe",
      });
      expect(sent).toBe(true);
    });

    it("successfully sends live courier dispatch milestones", async () => {
      const sent = await WhatsAppService.sendCourierDelivery("0244123456", {
        orderNumber: "ND-00001",
        trackingNumber: "ND-SHIP-9999",
        courierName: "NextDor Express",
        status: "OUT_FOR_DELIVERY",
        recipientName: "Kojo Wiafe",
      });
      expect(sent).toBe(true);
    });

    it("successfully sends vendor alerts for new order", async () => {
      const sent = await WhatsAppService.sendVendorNewOrderAlert("0244123456", {
        storeName: "Accra Fresh Groceries",
        orderNumber: "ND-00001",
        itemCount: 3,
        total: 240.0,
        city: "East Legon, Greater Accra",
      });
      expect(sent).toBe(true);
    });

    it("successfully sends vendor low stock alert", async () => {
      const sent = await WhatsAppService.sendVendorLowStockAlert("0244123456", {
        storeName: "Accra Fresh Groceries",
        productName: "Ghana White Rice 5kg",
        currentStock: 2,
        threshold: 5,
      });
      expect(sent).toBe(true);
    });

    it("successfully sends vendor payout disbursement alert", async () => {
      const sent = await WhatsAppService.sendVendorPayoutAlert("0244123456", {
        storeName: "Accra Fresh Groceries",
        amount: 850.0,
        batchId: "TRF-BATCH-001",
        network: "MTN",
      });
      expect(sent).toBe(true);
    });
  });
});
