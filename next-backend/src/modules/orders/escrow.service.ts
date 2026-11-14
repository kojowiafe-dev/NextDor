/**
 * Escrow Service — Delivery verification, 48-hour inspection window, and clearance.
 *
 * Implements spec §4 (Order flow and escrow window) and §5 (Disputes and refunds).
 *
 * Key invariants:
 *  - Only a delivery agent or customer code/confirmation starts the escrow clock
 *    (NOT the vendor marking "delivered" — spec §4.3).
 *  - Escrow clearance writes ledger entry D atomically.
 *  - Disputes freeze only the affected vendor's funds (spec §5).
 *  - Scheduled job calls processExpiredEscrows() — spec §10 rule 7.
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { LedgerService } from "../payments/ledger.service.js";
import { Money } from "../../domain/Money.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import {
  NotFoundError,
  BadRequestError,
  UnprocessableError,
  ForbiddenError,
} from "../../lib/errors.js";
import type { Prisma, DisputeResolution, DisputeReason } from "@prisma/client";

const ESCROW_WINDOW_HOURS = 48;
const DISPATCH_FALLBACK_DAYS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryVerifyInput = {
  vendorOrderId: string;
  /** Actor confirming delivery: "DELIVERY_AGENT" | "CUSTOMER" | "TRACKING_SYSTEM" */
  confirmedBy: "DELIVERY_AGENT" | "CUSTOMER" | "TRACKING_SYSTEM";
  actorId?: string;
  isAdmin?: boolean;
  note?: string;
};

export type OpenDisputeInput = {
  vendorOrderId: string;
  customerId?: string;
  reason: DisputeReason;
  details?: string;
  evidenceUrls?: string[];
};

export type ResolveDisputeInput = {
  disputeId: string;
  resolution: DisputeResolution;
  resolutionNote?: string;
  resolvedBy: string;
  /** For PARTIAL_REFUND: amount in pesewas to refund */
  refundAmountPesewas?: number;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class EscrowService {

  /**
   * Step 3 of spec §4: Verify delivery by a third party (delivery agent, tracking, or customer).
   * The VENDOR marking their order dispatched does NOT call this method.
   *
   * Starts the 48-hour inspection window (ledger entry C).
   */
  async verifyDelivery(input: DeliveryVerifyInput): Promise<void> {
    let emailNotification: {
      email: string;
      customerName: string;
      orderNumber: string;
      deliveryAddress: string;
    } | null = null;

    await prisma.$transaction(async (tx) => {
      const vo = await tx.vendorOrder.findUnique({
        where: { id: input.vendorOrderId },
        include: {
          vendor: { select: { id: true, name: true, commissionRate: true } },
          order: {
            select: {
              id: true,
              number: true,
              userId: true,
              guestEmail: true,
              shippingAddress: true,
              paymentStatus: true,
              notes: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      });
      if (!vo) throw new NotFoundError(`VendorOrder ${input.vendorOrderId}`);

      // Authorization guard: Customer must own the order; agent/system verification requires admin privilege
      if (input.confirmedBy === "CUSTOMER") {
        if (!input.actorId || input.actorId !== vo.order.userId) {
          throw new ForbiddenError("You can only verify delivery for your own orders.");
        }
      } else if (!input.isAdmin) {
        throw new ForbiddenError("Only authorized logistics dispatchers or administrators may verify third-party delivery.");
      }

      if (vo.fundsStatus !== "PENDING_FULFILLMENT") {
        throw new BadRequestError(
          `Cannot verify delivery: vendor order funds are in ${vo.fundsStatus} state`,
        );
      }
      if (vo.status !== "SHIPPED") {
        throw new BadRequestError(
          `Cannot verify delivery: order must be SHIPPED first (current: ${vo.status})`,
        );
      }

      const now = new Date();
      const escrowExpiry = new Date(now.getTime() + ESCROW_WINDOW_HOURS * 60 * 60 * 1000);

      await tx.vendorOrder.update({
        where: { id: vo.id },
        data: {
          status: "DELIVERED",
          fundsStatus: "ESCROW",
          deliveryVerifiedAt: now,
          escrowStartedAt: now,
          escrowExpiresAt: escrowExpiry,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: vo.orderId,
          status: "DELIVERED_VERIFIED",
          note: `Delivery verified by ${input.confirmedBy === "CUSTOMER" ? "Customer" : input.confirmedBy}${input.note ? ` — ${input.note}` : ""}. 48-hour Buyer Protection Escrow active until ${escrowExpiry.toLocaleString("en-GH")}.`,
          createdBy: input.actorId ?? null,
        },
      });

      // Update parent order status to DELIVERED_VERIFIED
      // Only if ALL vendor orders have now been verified (multi-vendor: wait for all)
      const allVendorOrders = await tx.vendorOrder.findMany({
        where: { orderId: vo.orderId },
        select: { fundsStatus: true },
      });
      const allVerified = allVendorOrders.every(
        (v) => v.fundsStatus === "ESCROW" || v.fundsStatus === "AVAILABLE" || v.fundsStatus === "PAID_OUT",
      );
      if (allVerified) {
        const notesLower = (vo.order.notes || "").toLowerCase();
        const isCod =
          notesLower.includes("payment method: cod") ||
          notesLower.includes("cash on delivery") ||
          notesLower.includes("cod");

        await tx.order.update({
          where: { id: vo.orderId },
          data: {
            status: "DELIVERED_VERIFIED",
            ...(isCod && vo.order.paymentStatus === "PENDING" ? { paymentStatus: "PAID" } : {}),
          },
        });
      }

      // Ledger entry C: Pending → Escrow
      const vendorEarningsPesewas = Money.fromMajor(vo.vendorEarnings).toMinor();
      await LedgerService.entryC_EscrowStart(tx, {
        vendorEarningsPesewas,
        orderId: vo.orderId,
        vendorOrderId: vo.id,
        vendorId: vo.vendor.id,
      });

      const shipAddr = (vo.order.shippingAddress as any) || {};
      const customerEmail = vo.order.guestEmail || vo.order.user?.email;
      if (customerEmail) {
        emailNotification = {
          email: customerEmail,
          customerName: shipAddr.recipientName || vo.order.user?.name || "Valued Customer",
          orderNumber: vo.order.number,
          deliveryAddress: `${shipAddr.street || "Direct Delivery"}, ${shipAddr.city || "Accra"}, ${shipAddr.region || "Greater Accra"}`,
        };
      }

      logger.info(
        { vendorOrderId: vo.id, escrowExpiry, confirmedBy: input.confirmedBy },
        "escrow: delivery verified, 48h window started",
      );
    });

    if (emailNotification) {
      const n = emailNotification as {
        email: string;
        customerName: string;
        orderNumber: string;
        deliveryAddress: string;
      };
      dispatchEmailAsync({
        type: "delivery_confirmation",
        params: n,
      }).catch((err) => {
        logger.warn({ err, orderNumber: n.orderNumber }, "Failed to queue delivery confirmation email");
      });
    }
  }

  /**
   * Customer early-confirms receipt (before 48h expires).
   * Clears escrow immediately — writes ledger entry D.
   */
  async customerConfirmReceipt(vendorOrderId: string, customerId?: string): Promise<void> {
    await this._clearEscrow(vendorOrderId, "CUSTOMER_CONFIRMED", customerId);
  }

  /**
   * Spec §10 rule 7: Called by the scheduled job every hour.
   * Processes all vendor orders whose escrow window has expired with no open dispute.
   */
  async processExpiredEscrows(): Promise<{ cleared: number; skipped: number }> {
    const now = new Date();

    // Find all ESCROW vendor orders whose window has expired
    const expired = await prisma.vendorOrder.findMany({
      where: {
        fundsStatus: "ESCROW",
        OR: [
          { escrowExpiresAt: { lte: now } },
          { escrowExpiresAt: null, clearedAt: { lte: now } },
        ],
        flaggedForReview: false,
        // No open dispute
        disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
      },
      select: { id: true },
    });

    let cleared = 0;
    let skipped = 0;

    for (const { id } of expired) {
      try {
        await this._clearEscrow(id, "ESCROW_EXPIRED");
        cleared++;
      } catch (err) {
        logger.error({ err, vendorOrderId: id }, "escrow: failed to clear expired escrow");
        skipped++;
      }
    }

    if (cleared > 0 || skipped > 0) {
      logger.info({ cleared, skipped }, "escrow: processed expired windows");
    }

    return { cleared, skipped };
  }

  /**
   * Spec §4 fallback: Flag orders where vendor dispatched but no verified delivery within 7 days.
   * Called by the scheduled job daily.
   */
  async flagStaleDispatchedOrders(): Promise<{ flagged: number }> {
    const cutoff = new Date(Date.now() - DISPATCH_FALLBACK_DAYS * 24 * 60 * 60 * 1000);

    const result = await prisma.vendorOrder.updateMany({
      where: {
        status: "SHIPPED",
        fundsStatus: "PENDING_FULFILLMENT",
        deliveryVerifiedAt: null,
        flaggedForReview: false,
        // Dispatched more than 7 days ago (use updatedAt as proxy for dispatch time)
        updatedAt: { lte: cutoff },
      },
      data: { flaggedForReview: true },
    });

    if (result.count > 0) {
      logger.warn({ count: result.count }, "escrow: flagged stale dispatched orders for admin review");
    }

    return { flagged: result.count };
  }

  // ─── Disputes ────────────────────────────────────────────────────────────────

  /**
   * Spec §5: Open a dispute — freezes only the affected vendor's funds.
   * Other vendor orders from the same vendor are NOT frozen.
   */
  async openDispute(input: OpenDisputeInput): Promise<{ disputeId: string }> {
    return prisma.$transaction(async (tx) => {
      const vo = await tx.vendorOrder.findUnique({
        where: { id: input.vendorOrderId },
        include: {
          vendor: { select: { id: true } },
          order: { select: { id: true, userId: true } },
        },
      });
      if (!vo) throw new NotFoundError(`VendorOrder ${input.vendorOrderId}`);

      // Authorization guard: Customer must own the order to open a dispute
      if (!input.customerId || input.customerId !== vo.order.userId) {
        throw new ForbiddenError("You can only open disputes for your own orders.");
      }

      const disputeableFundStatuses = ["ESCROW", "AVAILABLE"] as const;
      if (!disputeableFundStatuses.includes(vo.fundsStatus as any)) {
        throw new BadRequestError(
          `Cannot open dispute: funds are in ${vo.fundsStatus} state`,
        );
      }

      const vendorEarningsPesewas = Money.fromMajor(vo.vendorEarnings).toMinor();
      const fromAccount = vo.fundsStatus === "ESCROW"
        ? "VENDOR_PAYABLE_ESCROW"
        : "VENDOR_PAYABLE_AVAILABLE";

      // Move order status to DISPUTED
      await tx.vendorOrder.update({
        where: { id: vo.id },
        data: { fundsStatus: "DISPUTED" },
      });

      await tx.order.update({
        where: { id: vo.orderId },
        data: { status: "DISPUTED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: vo.orderId,
          status: "DISPUTED",
          note: `Dispute opened: ${input.reason}${input.details ? ` — ${input.details}` : ""}`,
          createdBy: input.customerId ?? null,
        },
      });

      const dispute = await tx.dispute.create({
        data: {
          vendorOrderId: vo.id,
          orderId: vo.orderId,
          vendorId: vo.vendor.id,
          customerId: input.customerId ?? null,
          reason: input.reason,
          details: input.details ?? null,
          evidenceUrls: input.evidenceUrls ?? [],
          status: "OPEN",
          frozenAmountPesewas: vendorEarningsPesewas,
        },
      });

      // Ledger: freeze funds
      await LedgerService.entryDisputeFreeze(tx, {
        vendorEarningsPesewas,
        fromAccount,
        orderId: vo.orderId,
        vendorOrderId: vo.id,
        disputeId: dispute.id,
        vendorId: vo.vendor.id,
      });

      logger.info(
        { disputeId: dispute.id, vendorOrderId: vo.id, reason: input.reason },
        "dispute: opened, vendor funds frozen",
      );

      return { disputeId: dispute.id };
    });
  }

  /**
   * Spec §5: Admin resolves a dispute.
   * Resolution: RELEASE_TO_VENDOR | PARTIAL_REFUND | FULL_REFUND
   */
  async resolveDispute(input: ResolveDisputeInput): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: input.disputeId },
        include: {
          vendorOrder: {
            include: { vendor: { select: { id: true, commissionRate: true } } },
          },
        },
      });
      if (!dispute) throw new NotFoundError(`Dispute ${input.disputeId}`);
      if (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW") {
        throw new BadRequestError(`Dispute is already ${dispute.status}`);
      }

      const vo = dispute.vendorOrder;
      const vendorEarningsPesewas = dispute.frozenAmountPesewas;
      const commissionPesewas     = Money.fromMajor(vo.commissionAmount).toMinor();
      const deliveryFeePesewas    = Money.fromMajor(vo.deliveryFeeAlloc).toMinor();
      const totalPesewas          = vendorEarningsPesewas + commissionPesewas + deliveryFeePesewas;

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED",
          resolution: input.resolution,
          resolutionNote: input.resolutionNote,
          resolvedBy: input.resolvedBy,
          resolvedAt: new Date(),
          refundAmountPesewas: input.refundAmountPesewas ?? null,
        },
      });

      if (input.resolution === "RELEASE_TO_VENDOR") {
        // Release frozen funds to AVAILABLE
        await tx.vendorOrder.update({
          where: { id: vo.id },
          data: { fundsStatus: "AVAILABLE" },
        });

        await LedgerService.entryDisputeRelease(tx, {
          vendorEarningsPesewas,
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          disputeId: dispute.id,
          vendorId: vo.vendor.id,
        });

        // Restore order status to DELIVERED_VERIFIED so escrow can clear
        await tx.order.update({
          where: { id: vo.orderId },
          data: { status: "DELIVERED_VERIFIED" },
        });

      } else if (input.resolution === "FULL_REFUND") {
        await tx.vendorOrder.update({
          where: { id: vo.id },
          data: { fundsStatus: "REFUNDED" },
        });

        await LedgerService.entryJ_FullRefund(tx, {
          totalPesewas,
          vendorEarningsPesewas,
          commissionPesewas,
          deliveryFeePesewas,
          fromAccount: "VENDOR_PAYABLE_DISPUTED",
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          disputeId: dispute.id,
          vendorId: vo.vendor.id,
        });

      } else if (input.resolution === "PARTIAL_REFUND") {
        const refundTotal = input.refundAmountPesewas ?? 0;
        if (refundTotal <= 0 || refundTotal >= totalPesewas) {
          throw new BadRequestError("Partial refund amount must be > 0 and < total order amount");
        }

        // Spec §5: proportional reversal with spec §2 rounding rule
        const refundRatio = refundTotal / totalPesewas;
        const vendorRefund = Math.round(vendorEarningsPesewas * refundRatio);
        const commRefund   = refundTotal - Math.round((deliveryFeePesewas * refundRatio)) - vendorRefund;
        const delivRefund  = refundTotal - vendorRefund - commRefund;

        const remainingVendorEarnings = vendorEarningsPesewas - vendorRefund;

        await tx.vendorOrder.update({
          where: { id: vo.id },
          data: {
            fundsStatus: remainingVendorEarnings > 0 ? "AVAILABLE" : "REFUNDED",
            vendorEarnings: new (await import("@prisma/client")).Prisma.Decimal(
              (remainingVendorEarnings / 100).toFixed(2),
            ),
          },
        });

        await LedgerService.entryPartialRefund(tx, {
          refundTotalPesewas:              refundTotal,
          vendorEarningsRefundPesewas:     vendorRefund,
          commissionRefundPesewas:         commRefund,
          deliveryFeeRefundPesewas:        delivRefund,
          fromAccount: "VENDOR_PAYABLE_DISPUTED",
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          disputeId: dispute.id,
          vendorId: vo.vendor.id,
        });

        // Release remaining (if any) to AVAILABLE
        if (remainingVendorEarnings > 0) {
          await LedgerService.entryDisputeRelease(tx, {
            vendorEarningsPesewas: remainingVendorEarnings,
            orderId: vo.orderId,
            vendorOrderId: vo.id,
            disputeId: dispute.id,
            vendorId: vo.vendor.id,
          });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: vo.orderId,
          status: "COMPLETED",
          note: `Dispute resolved: ${input.resolution}${input.resolutionNote ? ` — ${input.resolutionNote}` : ""}`,
          createdBy: input.resolvedBy,
        },
      });

      logger.info(
        { disputeId: dispute.id, resolution: input.resolution, resolvedBy: input.resolvedBy },
        "dispute: resolved",
      );
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _clearEscrow(
    vendorOrderId: string,
    trigger: "CUSTOMER_CONFIRMED" | "ESCROW_EXPIRED",
    actorId?: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const vo = await tx.vendorOrder.findUnique({
        where: { id: vendorOrderId },
        include: {
          vendor: { select: { id: true, commissionRate: true } },
          order: { select: { id: true, userId: true } },
        },
      });
      if (!vo) throw new NotFoundError(`VendorOrder ${vendorOrderId}`);

      if (trigger === "CUSTOMER_CONFIRMED") {
        if (!actorId || actorId !== vo.order.userId) {
          throw new ForbiddenError("You can only confirm receipt for your own orders.");
        }
      }

      if (vo.fundsStatus !== "ESCROW") {
        logger.warn(
          { vendorOrderId, fundsStatus: vo.fundsStatus },
          "escrow: clearance skipped, not in ESCROW state",
        );
        return;
      }

      // Re-check for open disputes at the moment of clearance (spec §10 rule 7)
      const openDispute = await tx.dispute.findFirst({
        where: { vendorOrderId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      });
      if (openDispute) {
        logger.warn(
          { vendorOrderId, disputeId: openDispute.id },
          "escrow: clearance skipped, open dispute exists",
        );
        return;
      }

      const now = new Date();
      const vendorEarningsPesewas = Money.fromMajor(vo.vendorEarnings).toMinor();
      const commissionPesewas     = Money.fromMajor(vo.commissionAmount).toMinor();
      const deliveryFeePesewas    = Money.fromMajor(vo.deliveryFeeAlloc).toMinor();

      await tx.vendorOrder.update({
        where: { id: vo.id },
        data: { fundsStatus: "AVAILABLE", clearedAt: now },
      });

      // Check if all vendor orders under this master order are now AVAILABLE/PAID_OUT
      const siblings = await tx.vendorOrder.findMany({
        where: { orderId: vo.orderId },
        select: { fundsStatus: true },
      });
      const allCleared = siblings.every(
        (s) => s.fundsStatus === "AVAILABLE" || s.fundsStatus === "PAID_OUT",
      );

      if (allCleared) {
        await tx.order.update({
          where: { id: vo.orderId },
          data: { status: "COMPLETED" },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: vo.orderId,
          status: "COMPLETED",
          note: `Escrow cleared: ${trigger}${actorId ? ` (actor: ${actorId})` : ""}. Vendor funds moved to available.`,
          createdBy: actorId ?? null,
        },
      });

      // Ledger entry D: Escrow → Available + revenue recognition
      await LedgerService.entryD_EscrowCleared(tx, {
        vendorEarningsPesewas,
        commissionPesewas,
        deliveryFeePesewas,
        orderId: vo.orderId,
        vendorOrderId: vo.id,
        vendorId: vo.vendor.id,
      });

      logger.info(
        { vendorOrderId: vo.id, trigger, vendorEarningsPesewas },
        "escrow: cleared, funds available for payout",
      );
    });
  }
}

export const escrowService = new EscrowService();
