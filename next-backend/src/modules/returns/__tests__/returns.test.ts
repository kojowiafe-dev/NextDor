import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { Money } from "../../../domain/Money.js";
import { toPesewas } from "../../payments/paystack.js";

describe("Phase 8: Return & Refund Financial Invariants", () => {
  it("converts major GHS amounts to integer pesewas accurately for Paystack refund", () => {
    expect(toPesewas("149.99")).toBe(14999);
    expect(toPesewas(45.5)).toBe(4550);
    expect(toPesewas(new Prisma.Decimal("745.00"))).toBe(74500);
  });

  it("calculates partial returns maintaining mathematical balance conservation", () => {
    const vOrderSubtotal = new Prisma.Decimal("100.00");
    const vOrderEarnings = new Prisma.Decimal("90.00");
    const refundAmount = new Prisma.Decimal("40.00");

    const newSubtotal = Prisma.Decimal.max(0, Prisma.Decimal.sub(vOrderSubtotal, refundAmount));
    expect(newSubtotal.toString()).toBe("60");

    const ratio = Number(newSubtotal) / Number(vOrderSubtotal);
    const newEarnings = Prisma.Decimal.mul(vOrderEarnings, ratio);
    const newCommission = Prisma.Decimal.sub(newSubtotal, newEarnings);

    expect(newEarnings.toString()).toBe("54");
    expect(newCommission.toString()).toBe("6");
    expect(Prisma.Decimal.add(newEarnings, newCommission).equals(newSubtotal)).toBe(true);
  });

  it("handles full return resetting subtotal and vendor earnings to zero", () => {
    const vOrderSubtotal = new Prisma.Decimal("250.00");
    const vOrderEarnings = new Prisma.Decimal("225.00");
    const fullRefundAmount = new Prisma.Decimal("250.00");

    const newSubtotal = Prisma.Decimal.max(0, Prisma.Decimal.sub(vOrderSubtotal, fullRefundAmount));
    expect(newSubtotal.toString()).toBe("0");

    const ratio = Number(vOrderSubtotal) > 0 ? Number(newSubtotal) / Number(vOrderSubtotal) : 0;
    const newEarnings = Prisma.Decimal.mul(vOrderEarnings, ratio);
    const newCommission = Prisma.Decimal.sub(newSubtotal, newEarnings);

    expect(newEarnings.toString()).toBe("0");
    expect(newCommission.toString()).toBe("0");
  });

  it("determines whether cumulative refunds cover the order total", () => {
    const orderTotal = new Prisma.Decimal("500.00");
    const refund1 = new Prisma.Decimal("200.00");
    const refund2 = new Prisma.Decimal("300.00");

    const cumulativePartial = Prisma.Decimal.add(new Prisma.Decimal(0), refund1);
    expect(cumulativePartial.gte(orderTotal)).toBe(false);

    const cumulativeFull = Prisma.Decimal.add(cumulativePartial, refund2);
    expect(cumulativeFull.gte(orderTotal)).toBe(true);
  });
});
