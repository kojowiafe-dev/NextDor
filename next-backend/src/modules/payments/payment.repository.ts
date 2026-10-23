/**
 * Payment Repository — persistence for Paystack payments.
 *
 * The settlement method is the heart of payment integrity: it is
 *   - IDEMPOTENT  (webhook + client verify racing each other can't double-apply),
 *   - ATOMIC      (payment row, attempt log, order flags and history in one tx),
 *   - STATE-SAFE  (a cancelled order is never silently resurrected by a late payment).
 */

import { prisma } from "../../lib/prisma.js";
import { ConflictError } from "../../lib/errors.js";
import type { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";

export type SettleInput = {
  orderId: string;
  reference: string;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  paidAt: Date;
  gatewayData: unknown;
  /** Human-readable audit note, e.g. "Payment verified via Paystack (ref)". */
  source: string;
};

export type SettleResult = {
  /** false → the order was already PAID; nothing changed (idempotent replay). */
  applied: boolean;
  /** Final order status after settlement. */
  status: OrderStatus;
  /** true → payment arrived for an order that was no longer PENDING (e.g. cancelled). */
  needsManualReview: boolean;
};

const ORDER_PAYMENT_INCLUDE = {
  payments: true,
  user: { select: { email: true, name: true, phone: true } },
} satisfies Prisma.OrderInclude;

export class PaymentRepository {
  findOrderByNumber(number: string) {
    return prisma.order.findUnique({ where: { number }, include: ORDER_PAYMENT_INCLUDE });
  }

  findOrderById(id: string) {
    return prisma.order.findUnique({ where: { id }, include: ORDER_PAYMENT_INCLUDE });
  }

  findPaymentByReference(paystackRef: string) {
    return prisma.payment.findUnique({ where: { paystackRef } });
  }

  createPending(input: { orderId: string; reference: string; amount: Prisma.Decimal; method: PaymentMethod }) {
    return prisma.payment.create({
      data: {
        orderId: input.orderId,
        paystackRef: input.reference,
        amount: input.amount,
        method: input.method,
        status: "PENDING",
      },
    });
  }

  async settleSuccessfulPayment(input: SettleInput): Promise<SettleResult> {
    return prisma.$transaction(
      async (tx) => {
        // A reference can only ever settle ONE order.
      const existing = await tx.payment.findUnique({ where: { paystackRef: input.reference } });
      if (existing && existing.orderId !== input.orderId) {
        throw new ConflictError("This payment reference belongs to a different order");
      }

      const payment = await tx.payment.upsert({
        where: { paystackRef: input.reference },
        update: {
          status: "SUCCESS",
          paidAt: input.paidAt,
          metadata: input.gatewayData as Prisma.InputJsonValue,
        },
        create: {
          orderId: input.orderId,
          paystackRef: input.reference,
          amount: input.amount,
          method: input.method,
          status: "SUCCESS",
          paidAt: input.paidAt,
          metadata: input.gatewayData as Prisma.InputJsonValue,
        },
      });

      // Compare-and-set: only ONE concurrent caller can flip UNPAID/PARTIAL → PAID.
      const flipped = await tx.order.updateMany({
        where: { id: input.orderId, paymentStatus: { not: "PAID" } },
        data: { paymentStatus: "PAID" },
      });

      if (flipped.count === 0) {
        const current = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { status: true },
        });
        return { applied: false, status: current.status, needsManualReview: false };
      }

      await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          status: "SUCCESS",
          gatewayResp: input.gatewayData as Prisma.InputJsonValue,
        },
      });

      // Only a PENDING order may advance to CONFIRMED.
      const confirmed = await tx.order.updateMany({
        where: { id: input.orderId, status: "PENDING" },
        data: { status: "CONFIRMED" },
      });

      if (confirmed.count > 0) {
        await tx.orderStatusHistory.create({
          data: { orderId: input.orderId, status: "CONFIRMED", note: input.source },
        });
        return { applied: true, status: "CONFIRMED" as OrderStatus, needsManualReview: false };
      }

      const current = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: { status: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          status: current.status,
          note: `${input.source} — received while order was ${current.status}; manual refund/fulfilment review required`,
        },
      });
      return { applied: true, status: current.status, needsManualReview: true };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    });
  }
}
