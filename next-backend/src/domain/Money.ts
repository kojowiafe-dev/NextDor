/**
 * Money Value Object — Domain-Driven Design (DDD).
 *
 * DESIGN PATTERN: Value Object (Martin Fowler, P of EAA)
 * ───────────────────────────────────────────────────────
 * A Value Object has no conceptual identity; it is defined solely by its attributes
 * (amount and currency). Two Money objects with amount 50 and currency "GHS" are
 * completely equal.
 *
 * WHY NOT USE NATIVE JAVASCRIPT NUMBERS?
 * ──────────────────────────────────────
 * JavaScript numbers are IEEE 754 double-precision floats.
 * 0.1 + 0.2 = 0.30000000000000004.
 * Over thousands of e-commerce transactions, float rounding leaks real money.
 * This class uses fixed-point integer arithmetic in minor units (Pesewas / Cents)
 * to guarantee 100% exact mathematical operations with zero precision drift.
 */

import { Prisma } from "@prisma/client";

export class Money {
  /**
   * The monetary value stored in the smallest currency unit (e.g., Ghana Pesewas).
   * 1 GHS = 100 Pesewas. Storing as an integer prevents floating point errors.
   */
  private readonly minorAmount: number;

  /**
   * ISO 4217 Currency Code (e.g., "GHS", "USD").
   */
  public readonly currency: string;

  /**
   * Private constructor enforces creation via static factory methods.
   */
  private constructor(minorAmount: number, currency = "GHS") {
    if (!Number.isSafeInteger(minorAmount)) {
      throw new Error(`Money minorAmount must be a safe integer, received: ${minorAmount}`);
    }
    this.minorAmount = minorAmount;
    this.currency = currency.toUpperCase();
  }

  /**
   * Factory method: Create Money from major units (e.g. 45.50 GHS).
   * Parses strings, numbers, or Prisma Decimals safely.
   */
  public static fromMajor(amount: number | string | Prisma.Decimal, currency = "GHS"): Money {
    const numericAmount = typeof amount === "object" ? Number(amount) : Number(amount);
    if (isNaN(numericAmount)) {
      throw new Error(`Invalid monetary amount: ${amount}`);
    }
    // Round to 2 decimal places to capture exact pesewas
    const minor = Math.round(numericAmount * 100);
    return new Money(minor, currency);
  }

  /**
   * Factory method: Create Money directly from minor units (e.g. 4550 pesewas).
   */
  public static fromMinor(minorAmount: number, currency = "GHS"): Money {
    return new Money(Math.round(minorAmount), currency);
  }

  /**
   * Factory method: Create zero-value Money.
   */
  public static zero(currency = "GHS"): Money {
    return new Money(0, currency);
  }

  /**
   * Returns the amount in major units as a standard decimal number (e.g. 45.50).
   */
  public toMajor(): number {
    return this.minorAmount / 100;
  }

  /**
   * Returns the minor unit integer (e.g. for Paystack API which expects amounts in pesewas/kobo).
   */
  public toMinor(): number {
    return this.minorAmount;
  }

  /**
   * Returns a Prisma Decimal compatible representation for database storage.
   */
  public toDecimal(): Prisma.Decimal {
    return new Prisma.Decimal(this.toMajor().toFixed(2));
  }

  /**
   * Immutably adds another Money value of the same currency.
   */
  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorAmount + other.minorAmount, this.currency);
  }

  /**
   * Immutably subtracts another Money value of the same currency.
   */
  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorAmount - other.minorAmount, this.currency);
  }

  /**
   * Multiplies the monetary amount by a scalar factor (e.g., tax rate, quantity).
   */
  public multiply(factor: number): Money {
    const resultMinor = Math.round(this.minorAmount * factor);
    return new Money(resultMinor, this.currency);
  }

  /**
   * Percentage calculation helper (e.g., commission percentage).
   */
  public percentage(percent: number): Money {
    return this.multiply(percent / 100);
  }

  /**
   * Formats the money into a localized display string (e.g., "GH₵ 45.50").
   */
  public format(): string {
    const symbol = this.currency === "GHS" ? "GH₵" : this.currency;
    return `${symbol} ${this.toMajor().toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Value Object equality check: two instances are equal if amount and currency match.
   */
  public equals(other: Money): boolean {
    return this.minorAmount === other.minorAmount && this.currency === other.currency;
  }

  /**
   * Enforces currency safety to prevent accidentally summing GHS with USD.
   */
  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot operate on ${this.currency} and ${other.currency} without conversion rate.`
      );
    }
  }
}
