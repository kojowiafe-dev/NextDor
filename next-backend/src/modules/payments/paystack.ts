/**
 * Paystack protocol helpers — PURE functions (no I/O) so they can be unit-tested
 * exhaustively. All money-critical decisions (is this webhook authentic? is this
 * transaction really paying for this order?) live here.
 */

import crypto from "node:crypto";

/**
 * Verifies the `x-paystack-signature` header.
 *
 * Paystack computes HMAC-SHA512(rawBody, SECRET_KEY) — the account secret key,
 * not a separate "webhook secret". The comparison is constant-time and safe
 * against malformed (non-hex / wrong-length) signatures.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer | undefined,
  signature: string | undefined,
  secretKey: string,
): boolean {
  if (!rawBody || !signature || !secretKey) return false;

  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest();

  // A valid SHA-512 hex digest is exactly 128 hex chars; reject anything else up-front.
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const provided = Buffer.from(signature, "hex");

  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

/** Converts a major-unit amount (GHS) to the integer pesewas Paystack expects. */
export function toPesewas(amount: number | string | { toString(): string }): number {
  const value = Number(typeof amount === "object" ? amount.toString() : amount);
  if (!Number.isFinite(value)) throw new Error(`Invalid monetary amount: ${String(amount)}`);
  return Math.round(value * 100);
}

/** Server-generated, unguessable payment reference bound to an order number. */
export function buildReference(orderNumber: string): string {
  return `ND-${orderNumber}-${crypto.randomBytes(8).toString("hex")}`;
}

export interface PaystackTransactionLike {
  currency?: string;
  amount?: number | string;
  metadata?: { orderNumber?: string } | null;
}

export type TransactionAssessment =
  | { ok: true }
  | { ok: false; reason: "ORDER_MISMATCH" | "CURRENCY_MISMATCH" | "UNDERPAYMENT" };

/**
 * Decides whether a SUCCESSFUL Paystack transaction legitimately settles an order.
 *  - metadata.orderNumber (when present) must equal the order being paid
 *  - currency must be GHS
 *  - amount must cover the full order total (overpayment is tolerated, underpayment is not)
 */
export function assessTransaction(
  tx: PaystackTransactionLike,
  expected: { orderNumber: string; totalPesewas: number },
): TransactionAssessment {
  const metaOrder = tx.metadata?.orderNumber;
  if (metaOrder && metaOrder !== expected.orderNumber) return { ok: false, reason: "ORDER_MISMATCH" };

  if (String(tx.currency ?? "").toUpperCase() !== "GHS") return { ok: false, reason: "CURRENCY_MISMATCH" };

  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || amount < expected.totalPesewas) return { ok: false, reason: "UNDERPAYMENT" };

  return { ok: true };
}

/** Maps a Paystack `channel` to the local PaymentMethod enum. */
export function methodFromChannel(channel: unknown): "MOMO" | "CARD" {
  const c = String(channel ?? "").toLowerCase();
  return c.includes("momo") || c.includes("mobile") ? "MOMO" : "CARD";
}
