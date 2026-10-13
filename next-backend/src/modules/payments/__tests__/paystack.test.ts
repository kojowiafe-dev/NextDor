import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyWebhookSignature,
  toPesewas,
  buildReference,
  assessTransaction,
  methodFromChannel,
} from "../paystack.js";

describe("Paystack Protocols & Security (paystack.ts)", () => {
  const secretKey = "sk_test_testsecretkey1234567890";

  it("verifies authentic HMAC-SHA512 webhook payload signature", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ND-123" } });
    const signature = crypto.createHmac("sha512", secretKey).update(payload).digest("hex");

    expect(verifyWebhookSignature(payload, signature, secretKey)).toBe(true);
  });

  it("rejects tampered webhook payloads", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ND-123" } });
    const tampered = JSON.stringify({ event: "charge.success", data: { reference: "ND-666" } });
    const signature = crypto.createHmac("sha512", secretKey).update(payload).digest("hex");

    expect(verifyWebhookSignature(tampered, signature, secretKey)).toBe(false);
  });

  it("rejects invalid or non-hex signatures without crashing", () => {
    const payload = "sample";
    expect(verifyWebhookSignature(payload, "short-non-hex", secretKey)).toBe(false);
    expect(verifyWebhookSignature(payload, undefined, secretKey)).toBe(false);
    expect(verifyWebhookSignature(undefined, "abc", secretKey)).toBe(false);
  });

  it("converts major amounts to integer pesewas accurately", () => {
    expect(toPesewas(10.5)).toBe(1050);
    expect(toPesewas("250.75")).toBe(25075);
    expect(toPesewas(0)).toBe(0);
  });

  it("builds unique, prefixed transaction references", () => {
    const ref1 = buildReference("ORD-1001");
    const ref2 = buildReference("ORD-1001");

    expect(ref1).toMatch(/^ND-ORD-1001-[0-9a-f]{16}$/);
    expect(ref2).toMatch(/^ND-ORD-1001-[0-9a-f]{16}$/);
    expect(ref1).not.toBe(ref2);
  });

  describe("assessTransaction", () => {
    const expected = { orderNumber: "ORD-999", totalPesewas: 5000 };

    it("accepts valid matching transaction", () => {
      const result = assessTransaction(
        { currency: "GHS", amount: 5000, metadata: { orderNumber: "ORD-999" } },
        expected,
      );
      expect(result).toEqual({ ok: true });
    });

    it("rejects mismatched order numbers in metadata", () => {
      const result = assessTransaction(
        { currency: "GHS", amount: 5000, metadata: { orderNumber: "ORD-OTHER" } },
        expected,
      );
      expect(result).toEqual({ ok: false, reason: "ORDER_MISMATCH" });
    });

    it("rejects non-GHS currencies", () => {
      const result = assessTransaction(
        { currency: "USD", amount: 5000, metadata: { orderNumber: "ORD-999" } },
        expected,
      );
      expect(result).toEqual({ ok: false, reason: "CURRENCY_MISMATCH" });
    });

    it("rejects underpayments", () => {
      const result = assessTransaction(
        { currency: "GHS", amount: 4999, metadata: { orderNumber: "ORD-999" } },
        expected,
      );
      expect(result).toEqual({ ok: false, reason: "UNDERPAYMENT" });
    });
  });

  describe("methodFromChannel", () => {
    it("maps mobile_money to MOMO", () => {
      expect(methodFromChannel("mobile_money")).toBe("MOMO");
      expect(methodFromChannel("momo")).toBe("MOMO");
    });

    it("maps card to CARD", () => {
      expect(methodFromChannel("card")).toBe("CARD");
    });

    it("defaults unknown or missing channels to CARD", () => {
      expect(methodFromChannel(undefined)).toBe("CARD");
      expect(methodFromChannel("unknown")).toBe("CARD");
    });
  });
});
