/**
 * Commission Calculator — Domain Strategy for Marketplace Financial Splits.
 *
 * DESIGN PATTERN: Domain Service / Strategy Pattern
 * ─────────────────────────────────────────────────
 * Encapsulates the mathematical split between platform fees (NextDor take-rate)
 * and vendor net earnings.
 *
 * INVARIANT GUARANTEE:
 * ────────────────────
 * In financial systems, independent rounding of splits can create or destroy pennies:
 * e.g., Subtotal = 10.05. Split 50/50: 5.025 rounded to 5.03 each = 10.06 (1 cent leak!).
 *
 * This class calculates the platform fee and computes the vendor net by DIRECT SUBTRACTION
 * (`vendorNet = subtotal.subtract(platformFee)`), guaranteeing 100% mathematical conservation:
 * platformFee + vendorNet ALWAYS identically equals subtotal!
 */

import { Money } from "./Money.js";

export interface CommissionSplitResult {
  subtotal: Money;
  platformFee: Money;
  vendorNet: Money;
  effectiveRatePercent: number;
}

export class CommissionCalculator {
  /**
   * Default platform commission rate (e.g., 10%).
   */
  private readonly defaultRatePercent: number;

  constructor(defaultRatePercent = 10.0) {
    if (defaultRatePercent < 0 || defaultRatePercent > 100) {
      throw new Error(`Commission rate must be between 0% and 100%, received: ${defaultRatePercent}`);
    }
    this.defaultRatePercent = defaultRatePercent;
  }

  /**
   * Calculates the split between the platform commission and the merchant net payout.
   *
   * @param subtotal Gross sales amount for this vendor's line items.
   * @param overrideRate Optional vendor-specific commission tier (e.g. 0% for flagship, 8% for VIP).
   */
  public calculateSplit(subtotal: Money, overrideRate?: number): CommissionSplitResult {
    const rate = overrideRate !== undefined ? overrideRate : this.defaultRatePercent;

    if (rate < 0 || rate > 100) {
      throw new Error(`Invalid commission rate: ${rate}%`);
    }

    // 1. Calculate platform take-rate
    const platformFee = subtotal.percentage(rate);

    // 2. Invariant conservation: Vendor Net = Subtotal - Platform Fee
    // This strictly prevents rounding leaks where fractions of a pesewa are lost or generated!
    const vendorNet = subtotal.subtract(platformFee);

    return {
      subtotal,
      platformFee,
      vendorNet,
      effectiveRatePercent: rate,
    };
  }
}
