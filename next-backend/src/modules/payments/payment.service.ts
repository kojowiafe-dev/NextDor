/**
 * Payment Service — Paystack initialize / verify / webhook use-cases.
 *
 * Extracted from order.routes.ts (where ~500 lines of payment logic and direct
 * Prisma calls lived inside HTTP handlers) so that payment rules are:
 *   - unit-testable without HTTP,
 *   - reusable (webhook + client verify share ONE settlement path),
 *   - auditable in a single file.
 */

import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { Money } from "../../domain/Money.js";
import { isOriginAllowed } from "../../lib/originPolicy.js";
import { originOf } from "../../lib/origins.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import { SmsService } from "../../lib/sms.js";
import { ADMIN_ROLES, type AuthUser } from "../../lib/auth.guards.js";
import {
  AppError,
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "../../lib/errors.js";
import { PaymentRepository } from "./payment.repository.js";
import {
  assessTransaction,
  buildReference,
  methodFromChannel,
  toPesewas,
  verifyWebhookSignature,
} from "./paystack.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_TIMEOUT_MS = 10_000;
const isProduction = config.NODE_ENV === "production";

type PaystackEnvelope = { status?: boolean; data?: any; message?: string };

async function paystackRequest(path: string, init: RequestInit = {}): Promise<PaystackEnvelope> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
    },
    // Never let a hung gateway hold a request (and a DB connection upstream) open forever.
    signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
  });
  return (await res.json()) as PaystackEnvelope;
}

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export class PaymentService {
  constructor(private readonly repo: PaymentRepository = new PaymentRepository()) {}

  // ─── Initialize ────────────────────────────────────────────────────────────

  async initialize(
    orderNumber: string,
    input: { email?: string; callbackUrl?: string; method?: string },
    caller: AuthUser | null,
  ) {
    const order = await this.repo.findOrderByNumber(orderNumber);
    if (!order) throw new NotFoundError(`Order ${orderNumber}`);
    this.assertCanAccess(order.userId, caller);

    if (order.paymentStatus === "PAID") {
      return { orderNumber: order.number, alreadyPaid: true as const };
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      throw new UnprocessableError(`Order ${order.number} is ${order.status} and can no longer be paid`);
    }

    // Prefer the identity we already hold for the order over client-supplied input,
    // so receipts can't be redirected to an arbitrary address.
    const email = order.user?.email || order.guestEmail || input.email;
    if (!email) throw new BadRequestError("A customer email address is required to start payment");

    // Only honour callback URLs that point back to a trusted NextDor frontend origin.
    let callbackUrl: string | undefined;
    if (input.callbackUrl) {
      const origin = originOf(input.callbackUrl);
      if (origin && isOriginAllowed(origin)) callbackUrl = input.callbackUrl;
      else logger.warn({ callbackUrl: input.callbackUrl }, "security: untrusted payment callbackUrl ignored");
    }

    const amountInPesewas = Money.fromMajor(order.total).toMinor();
    const reference = buildReference(order.number);
    const method = input.method?.toUpperCase() === "MOMO" ? "MOMO" : "CARD";

    try {
      const data = await paystackRequest("/transaction/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          reference,
          callback_url: callbackUrl,
          metadata: { orderId: order.id, orderNumber: order.number },
        }),
      });

      if (data.status && data.data) {
        await this.repo.createPending({ orderId: order.id, reference, amount: order.total, method });
        return {
          authorizationUrl: data.data.authorization_url as string,
          accessCode: data.data.access_code as string,
          reference,
          amount: amountInPesewas,
          currency: "GHS",
          email,
          publicKey: config.PAYSTACK_PUBLIC_KEY,
        };
      }
      logger.error({ orderNumber, message: data.message }, "Paystack initialize rejected");
    } catch (err) {
      logger.error({ err, orderNumber }, "Paystack initialize transaction failed");
    }

    // Production must never pretend initialization succeeded: the customer would be
    // charged for a reference the server has no record of.
    if (isProduction) {
      throw new BadGatewayError("Payment gateway is unavailable. Please try again in a moment.");
    }

    // Development convenience: let the sandbox flow continue with a local reference.
    return {
      authorizationUrl: null,
      accessCode: null,
      reference,
      amount: amountInPesewas,
      currency: "GHS",
      email,
      publicKey: config.PAYSTACK_PUBLIC_KEY,
    };
  }

  // ─── Verify (client-driven, after Paystack popup/redirect) ─────────────────

  async verify(orderNumber: string, reference: string, caller: AuthUser | null) {
    const order = await this.repo.findOrderByNumber(orderNumber);
    if (!order) throw new NotFoundError(`Order ${orderNumber}`);
    this.assertCanAccess(order.userId, caller);

    if (order.paymentStatus === "PAID") {
      return {
        orderNumber: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        alreadyVerified: true as const,
      };
    }

    // A reference may settle exactly one order.
    const ownPayment = order.payments.find((p) => p.paystackRef === reference);
    if (!ownPayment) {
      const elsewhere = await this.repo.findPaymentByReference(reference);
      if (elsewhere && elsewhere.orderId !== order.id) {
        logger.warn({ reference, orderNumber }, "security: payment reference belongs to another order");
        throw new AppError(400, "INVALID_REFERENCE", "Payment reference does not match this order");
      }
      if (isProduction && !reference.startsWith(`ND-${order.number}-`)) {
        logger.warn({ reference, orderNumber }, "security: Paystack reference mismatch for order");
        throw new AppError(400, "INVALID_REFERENCE", "Payment reference does not match this order");
      }
    }

    const expected = { orderNumber: order.number, totalPesewas: Money.fromMajor(order.total).toMinor() };
    let transaction: any = null;
    let gatewayUnreachable = false;

    try {
      const res = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
      if (res.status && res.data?.status === "success") {
        const assessment = assessTransaction(res.data, expected);
        if (assessment.ok) transaction = res.data;
        else logger.warn({ reference, orderNumber, reason: assessment.reason }, "Paystack verification rejected");
      } else {
        logger.warn({ reference, message: res.message }, "Paystack verification returned unsuccessful status");
      }
    } catch (err) {
      gatewayUnreachable = true;
      logger.error({ err, reference }, "Failed to reach Paystack verify endpoint");
    }

    // Sandbox-only shortcut. STRICTLY unreachable in production.
    if (!transaction && !isProduction) {
      const isTestKey = config.PAYSTACK_SECRET_KEY.startsWith("sk_test_");
      const isMock =
        reference.startsWith("mock_test_") ||
        (isTestKey && reference.startsWith("test_")) ||
        reference.startsWith(`ND-${order.number}-`);
      if (isMock) {
        transaction = {
          reference,
          status: "success",
          channel: "card",
          amount: expected.totalPesewas,
          currency: "GHS",
          paid_at: new Date().toISOString(),
        };
        logger.info({ reference }, "Development mock sandbox payment accepted");
      }
    }

    if (!transaction) {
      if (gatewayUnreachable && isProduction) {
        throw new BadGatewayError(
          "Could not reach the payment gateway. If you were charged, your order will update automatically.",
        );
      }
      throw new AppError(400, "PAYMENT_NOT_VERIFIED", "Payment transaction could not be verified by payment gateway.");
    }

    const method = methodFromChannel(transaction.channel);
    const settled = await this.repo.settleSuccessfulPayment({
      orderId: order.id,
      reference,
      amount: order.total,
      method,
      paidAt: transaction.paid_at ? new Date(transaction.paid_at) : new Date(),
      gatewayData: transaction,
      source: `Payment verified via Paystack (${reference})`,
    });

    if (settled.applied) {
      this.notifyPaid(order, reference, method, transaction.paid_at);
      if (settled.needsManualReview) {
        logger.error(
          { orderNumber: order.number, reference, status: settled.status },
          "payment: funds received for a non-PENDING order — manual review required",
        );
      }
    }

    return {
      orderNumber: order.number,
      status: settled.status,
      paymentStatus: "PAID" as const,
      reference,
    };
  }

  // ─── Webhook (Paystack → server) ───────────────────────────────────────────

  async handleWebhook(input: {
    rawBody: string | undefined;
    signature: string | undefined;
    payload: any;
    ip?: string;
  }): Promise<WebhookOutcome> {
    if (!input.signature) {
      return { status: 400, body: { success: false, message: "Missing x-paystack-signature header" } };
    }

    // Paystack signs the exact bytes it sent; re-serialising parsed JSON is NOT equivalent.
    if (!verifyWebhookSignature(input.rawBody, input.signature, config.PAYSTACK_SECRET_KEY)) {
      logger.warn({ ip: input.ip }, "security: invalid Paystack webhook signature");
      return { status: 401, body: { success: false, message: "Invalid webhook signature" } };
    }

    if (input.payload?.event !== "charge.success") {
      return { status: 200, body: { received: true } };
    }

    const reference: string | undefined = input.payload.data?.reference;
    if (!reference) return { status: 200, body: { received: true } };

    const payment = await this.repo.findPaymentByReference(reference);
    if (!payment) {
      // Not initiated by this server (or already purged) — acknowledge so Paystack stops retrying.
      logger.warn({ reference }, "Paystack webhook: unknown payment reference — ignored");
      return { status: 200, body: { received: true, ignored: true } };
    }

    const order = await this.repo.findOrderById(payment.orderId);
    if (!order) return { status: 200, body: { received: true, ignored: true } };

    const assessment = assessTransaction(input.payload.data, {
      orderNumber: order.number,
      totalPesewas: toPesewas(payment.amount),
    });
    if (!assessment.ok) {
      // Acknowledge (200) to stop retry storms, but surface loudly for investigation.
      logger.error(
        { reference, orderNumber: order.number, reason: assessment.reason },
        "payment: webhook amount/currency/order mismatch — NOT marking paid",
      );
      return { status: 200, body: { received: true, flagged: assessment.reason } };
    }

    const method = methodFromChannel(input.payload.data?.channel);
    const settled = await this.repo.settleSuccessfulPayment({
      orderId: order.id,
      reference,
      amount: payment.amount,
      method,
      paidAt: input.payload.data?.paid_at ? new Date(input.payload.data.paid_at) : new Date(),
      gatewayData: input.payload.data,
      source: `Payment verified via Paystack Webhook (${reference})`,
    });

    if (!settled.applied) {
      logger.info({ reference }, "Paystack webhook: duplicate charge.success — skipped (idempotent)");
      return { status: 200, body: { received: true, idempotent: true } };
    }

    logger.info({ orderId: order.id, reference }, "Order marked PAID via Paystack webhook");
    if (settled.needsManualReview) {
      logger.error(
        { orderNumber: order.number, reference, status: settled.status },
        "payment: funds received for a non-PENDING order — manual review required",
      );
    }
    this.notifyPaid(order, reference, method, input.payload.data?.paid_at);
    return { status: 200, body: { received: true } };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Authenticated callers may only touch their own orders (admins excepted). Guests are allowed. */
  private assertCanAccess(orderUserId: string | null, caller: AuthUser | null) {
    if (caller && orderUserId && orderUserId !== caller.userId && !ADMIN_ROLES.includes(caller.role as any)) {
      throw new ForbiddenError("You do not have permission to access payment for this order");
    }
  }

  /** Fire-and-forget receipt email + SMS. Never throws into the payment path. */
  private notifyPaid(
    order: NonNullable<Awaited<ReturnType<PaymentRepository["findOrderByNumber"]>>>,
    reference: string,
    method: string,
    paidAt?: string,
  ) {
    const ship = (order.shippingAddress as any) || {};
    const email = order.user?.email || order.guestEmail;

    if (email) {
      dispatchEmailAsync({
        type: "payment_receipt",
        params: {
          email,
          customerName: ship.recipientName || order.user?.name || "Customer",
          orderNumber: order.number,
          paystackRef: reference,
          amountPaid: Number(order.total),
          paymentChannel: method,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
        },
      }).catch((err) => logger.warn({ err, orderNumber: order.number }, "Failed to queue payment receipt email"));
    }

    if (ship.recipientPhone) {
      SmsService.sendOrderConfirmed(ship.recipientPhone, order.number, Number(order.total)).catch((err) =>
        logger.warn({ err, orderNumber: order.number }, "Failed to send payment confirmation SMS"),
      );
    }
  }
}

export const paymentService = new PaymentService();
