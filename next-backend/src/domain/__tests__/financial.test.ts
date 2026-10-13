import { describe, it, expect } from "vitest";
import { Money } from "../Money.js";
import { CommissionCalculator } from "../CommissionCalculator.js";

describe("Domain Money & Commission Financial Conservation", () => {
  describe("Money Value Object", () => {
    it("creates money from major units without float rounding issues", () => {
      const m1 = Money.fromMajor(10.5);
      expect(m1.toMinor()).toBe(1050);
      expect(m1.toMajor()).toBe(10.5);
      expect(m1.format()).toBe("GH₵ 10.50");
    });

    it("adds and subtracts money preserving minor units", () => {
      const a = Money.fromMajor(10.25);
      const b = Money.fromMajor(5.5);
      expect(a.add(b).toMajor()).toBe(15.75);
      expect(a.subtract(b).toMajor()).toBe(4.75);
    });

    it("prevents operations across different currencies", () => {
      const ghs = Money.fromMajor(10, "GHS");
      const usd = Money.fromMajor(10, "USD");
      expect(() => ghs.add(usd)).toThrow();
      expect(() => ghs.subtract(usd)).toThrow();
    });

    it("calculates percentage splits using standard rounding", () => {
      const total = Money.fromMajor(100);
      const fee = total.percentage(15);
      expect(fee.toMajor()).toBe(15);
      expect(fee.toMinor()).toBe(1500);
    });
  });

  describe("CommissionCalculator Invariant Conservation", () => {
    it("guarantees vendorNet + platformFee === subtotal exactly (no penny leaks)", () => {
      const calculator = new CommissionCalculator(10); // 10%
      // 33.33 GHS: 10% = 3.333 GHS -> 3.33 platform fee, vendorNet must be 30.00
      const subtotal = Money.fromMajor(33.33);
      const split = calculator.calculateSplit(subtotal);

      expect(split.platformFee.add(split.vendorNet).toMinor()).toBe(subtotal.toMinor());
      expect(split.platformFee.toMinor() + split.vendorNet.toMinor()).toBe(subtotal.toMinor());
    });

    it("supports custom vendor commission rates", () => {
      const calculator = new CommissionCalculator(10);
      const subtotal = Money.fromMajor(200);

      const split = calculator.calculateSplit(subtotal, 5); // 5% override
      expect(split.effectiveRatePercent).toBe(5);
      expect(split.platformFee.toMajor()).toBe(10);
      expect(split.vendorNet.toMajor()).toBe(190);
    });

    it("rejects invalid commission rates outside 0-100%", () => {
      expect(() => new CommissionCalculator(-5)).toThrow();
      expect(() => new CommissionCalculator(105)).toThrow();

      const calc = new CommissionCalculator(10);
      expect(() => calc.calculateSplit(Money.fromMajor(100), -1)).toThrow();
      expect(() => calc.calculateSplit(Money.fromMajor(100), 101)).toThrow();
    });
  });
});
