/**
 * Payment Repository — persistence for Paystack payments.
 *
 * The settlement method is the heart of payment integrity. It is:
 *   - IDEMPOTENT  (webhook + client verify racing each other can't double-apply),
 *   - ATOMIC      (payment row, ledger entries, vendor funds status and order status in one tx),
 *   - STATE-SAFE  (a cancelled order is never silently resurrected by a late payment).
 *
 * Spec §10 rule 3: "Wrap payment verification, order creation and ledger entries
 * in a single database transaction."
 *
 * Spec §10 rule 4: "Use the payment reference as the idempotency key for order
 * creation. If a payment succeeded but order creation failed, recover from the reference."
 */

import { prisma } from "../../lib/prisma.js";
import { ConflictError } from "../../lib/errors.js";
import { LedgerService } from "./ledger.service.js";
import { Money } from "../../domain/Money.js";
import { CommissionCalculator } from "../../domain/CommissionCalculator.js";
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

const COMMISSION_RATE = 10; // 10% — spec §2 default. Override per vendor via vendor.commissionRate.

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

  /**
   * Spec §10 rule 4: Idempotency key. Recover from reference if order creation failed after payment.
   */
  async findOrderByPaymentReference(paystackRef: string) {
    const payment = await prisma.payment.findUnique({
      where: { paystackRef },
      include: { order: { include: ORDER_PAYMENT_INCLUDE } },
    });
    return payment?.order ?? null;
  }

  async settleSuccessfulPayment(input: SettleInput): Promise<SettleResult> {
    return prisma.$transaction(
      async (tx) => {
        // ── Idempotency guard ──────────────────────────────────────────────────
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

        // Compare-and-set: only ONE concurrent caller can flip PENDING → PAID.
        const flipped = await tx.order.updateMany({
          where: { id: input.orderId, paymentStatus: { not: "PAID" } },
          data: { paymentStatus: "PAID" },
        });

        if (flipped.count === 0) {
          // Already PAID — idempotent replay, do nothing.
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

        // Spec §3: Advance order from PLACED → PLACED (payment is separate lifecycle).
        // Order moves to PLACED once paid (formerly CONFIRMED in old enum).
        const confirmed = await tx.order.updateMany({
          where: { id: input.orderId, status: "PLACED" },
          data: { status: "PLACED" }, // remains PLACED; vendor must ACCEPT next
        });

        // ── Ledger entry A: Payment received ─────────────────────────────────
        // Per spec §6A. Must be inside this transaction.
        await this._writeLedgerEntryA(tx, input.orderId, payment.id);

        if (confirmed.count > 0) {
          await tx.orderStatusHistory.create({
            data: { orderId: input.orderId, status: "PLACED", note: input.source },
          });
          return { applied: true, status: "PLACED" as OrderStatus, needsManualReview: false };
        }

        const current = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { status: true },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: input.orderId,
            status: current.status,
            note: `${input.source} — received while order was ${current.status}; manual review required`,
          },
        });
        return { applied: true, status: current.status, needsManualReview: true };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }

  /**
   * Writes ledger entry A for each vendor line on the order.
   * Spec §6A: DR Gateway Clearing / CR Vendor Payable (Pending) + CR Deferred Revenues.
   *
   * Note: For multi-vendor orders (spec §8), each VendorOrder gets its own entry,
   * computed independently with the vendor's commission rate.
   */
  private async _writeLedgerEntryA(
    tx: Prisma.TransactionClient,
    orderId: string,
    paymentId: string,
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        vendorOrders: {
          include: { vendor: { select: { id: true, commissionRate: true } } },
        },
      },
    });

    // Spec §2: Total = subtotal + deliveryFee
    // Delivery fee belongs to NextDor (spec assumption 1).
    // Split delivery fee across vendor lines proportionally by their subtotal share.
    const totalSubtotalPesewas = Money.fromMajor(order.subtotal).toMinor();
    const deliveryFeePesewas   = Money.fromMajor(order.deliveryFee).toMinor();
    const totalPesewas         = Money.fromMajor(order.total).toMinor();

    // For single-vendor orders the full delivery fee is allocated to that vendor line.
    // For multi-vendor (spec §8): allocate proportionally by vendor subtotal share.
    let remainingDeliveryPesewas = deliveryFeePesewas;

    for (let i = 0; i < order.vendorOrders.length; i++) {
      const vo = order.vendorOrders[i];
      const vendorSubtotalPesewas = Money.fromMajor(vo.subtotal).toMinor();

      // Proportional delivery fee allocation (last vendor absorbs rounding remainder)
      const isLast = i === order.vendorOrders.length - 1;
      let allocatedDeliveryPesewas: number;
      if (order.vendorOrders.length === 1 || isLast) {
        allocatedDeliveryPesewas = remainingDeliveryPesewas;
      } else {
        allocatedDeliveryPesewas = Math.floor(
          (vendorSubtotalPesewas / totalSubtotalPesewas) * deliveryFeePesewas,
        );
        remainingDeliveryPesewas -= allocatedDeliveryPesewas;
      }

      // Spec §2 rounding rule: commission = round_half_up(subtotal × rate)
      // then vendorEarnings = subtotal − commission.
      const commissionRate = Number(vo.vendor.commissionRate);
      const calc = new CommissionCalculator(commissionRate);
      const split = calc.calculateSplit(Money.fromMinor(vendorSubtotalPesewas));

      const commissionPesewas     = split.platformFee.toMinor();
      const vendorEarningsPesewas = split.vendorNet.toMinor();

      // The vendor earnings + commission + delivery fee must equal the total
      // collected for this vendor's items + their delivery allocation.
      const vendorLineTotalPesewas = vendorEarningsPesewas + commissionPesewas + allocatedDeliveryPesewas;

      await LedgerService.entryA_PaymentReceived(tx, {
        totalPesewas:          vendorLineTotalPesewas,
        vendorEarningsPesewas,
        commissionPesewas,
        deliveryFeePesewas:    allocatedDeliveryPesewas,
        orderId,
        vendorOrderId:         vo.id,
        paymentId,
        vendorId:              vo.vendor.id,
      });

      // Update the VendorOrder to persist the delivery allocation (if not already set)
      await tx.vendorOrder.update({
        where: { id: vo.id },
        data: {
          deliveryFeeAlloc: new (await import("@prisma/client")).Prisma.Decimal(
            (allocatedDeliveryPesewas / 100).toFixed(2),
          ),
          fundsStatus: "PENDING_FULFILLMENT",
        },
      });
    }
  }
}
