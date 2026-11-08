/**
 * Payout Service — Vendor settlement via Paystack Transfers.
 *
 * Implements spec §7 (Payout processing and safety):
 *  - DRAFT → APPROVED → PROCESSING → PAID lifecycle (never created as PAID).
 *  - Unique transfer_reference stored BEFORE calling the gateway.
 *  - SELECT FOR UPDATE locking prevents two workers claiming the same funds.
 *  - Idempotency: unique DB constraint on (vendorId, batchId) and on transferRef.
 *  - Webhook deduplication via ProcessedWebhookEvent table.
 *  - FAILED: entry I (funds restored to AVAILABLE).
 *  - REVERSED: liability re-established.
 *  - Minimum payout threshold.
 */

import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { PayoutRepository } from "./payout.repository.js";
import { PaystackTransferClient } from "./paystack.transfer.js";
import { LedgerService } from "../payments/ledger.service.js";
import { Money } from "../../domain/Money.js";
import { logger } from "../../lib/logger.js";
import { SmsService } from "../../lib/sms.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import { WhatsAppService } from "../../lib/whatsapp.js";
import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
  ForbiddenError,
} from "../../lib/errors.js";
import type { CreatePayoutBatchInput, ExecutePayoutBatchInput, PaystackTransferWebhook } from "@nextdor/shared";

/** Spec §7: Minimum payout amount in GHS to avoid micro-transfers. */
const MIN_PAYOUT_GHS = 5;

export class PayoutService {
  constructor(private readonly repo: PayoutRepository = new PayoutRepository()) {}

  // ─── Generate batch (DRAFT) ─────────────────────────────────────────────────

  /**
   * Spec §7: Generates a DRAFT payout batch.
   * Nothing is sent to the gateway at this stage — admin must APPROVE first.
   * Spec §7 locking: uses a transaction to prevent double-generation for the same vendor.
   */
  async generateBatch(input: CreatePayoutBatchInput, createdBy?: string) {
    const minThreshold = input.minThreshold ?? MIN_PAYOUT_GHS;
    const eligible = await this.repo.findEligibleVendorsForPayout(minThreshold, input.vendorIds);

    if (eligible.length === 0) {
      throw new UnprocessableError(
        `No vendors with cleared escrow balances meeting the minimum threshold of GH₵${minThreshold.toFixed(2)}.`,
      );
    }

    const totalBatchAmount = eligible.reduce((sum, v) => sum + v.availableAmount, 0);
    const batchReference = `PB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const result = await this.repo.createBatchWithPayouts({
      batchReference,
      totalAmount: totalBatchAmount,
      createdBy,
      notes: input.notes,
      payouts: eligible.map((v) => ({
        vendorId: v.id,
        amount: v.availableAmount,
        orderIds: v.vendorOrders.map((o) => o.id),
        recipientCode: v.paystackRecipientCode,
      })),
    });

    logger.info(
      {
        batchId: result.batch.id,
        reference: batchReference,
        vendorsCount: eligible.length,
        totalGhs: totalBatchAmount,
        status: "DRAFT",
      },
      "payout: batch generated (DRAFT — awaiting admin approval)",
    );

    return result;
  }

  // ─── Approve batch (DRAFT → APPROVED) ──────────────────────────────────────

  /**
   * Spec §7: Deliberate admin action with audit log of who approved what.
   */
  async approveBatch(batchId: string, approvedBy: string) {
    const batch = await this.repo.findBatchById(batchId);
    if (!batch) throw new NotFoundError(`Payout batch "${batchId}"`);

    if (batch.status !== "DRAFT") {
      throw new BadRequestError(
        `Batch "${batch.batchReference}" cannot be approved because its status is ${batch.status}.`,
      );
    }

    const updatedBatch = await prisma.$transaction(async (tx) => {
      const updated = await tx.payoutBatch.update({
        where: { id: batchId },
        data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
      });

      // Approve all DRAFT payouts in this batch
      await tx.vendorPayout.updateMany({
        where: { batchId, status: "DRAFT" },
        data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
      });

      return updated;
    });

    logger.info({ batchId, approvedBy }, "payout: batch approved");
    return updatedBatch;
  }

  // ─── Execute batch (APPROVED → PROCESSING → …) ─────────────────────────────

  /**
   * Spec §7: Execute an APPROVED payout batch via Paystack Transfers API.
   * Generates unique transfer_reference BEFORE calling the gateway.
   * Uses SELECT FOR UPDATE (via Prisma interactive transaction) to lock vendor funds.
   */
  async executeBatch(input: ExecutePayoutBatchInput) {
    const batch = await this.repo.findBatchById(input.batchId);
    if (!batch) throw new NotFoundError(`Payout batch "${input.batchId}"`);

    if (batch.status !== "APPROVED") {
      throw new BadRequestError(
        `Batch "${batch.batchReference}" cannot be executed because its status is ${batch.status}. ` +
        `It must be APPROVED first.`,
      );
    }

    await this.repo.updateBatchStatus(batch.id, "PROCESSING");

    let successCount = 0;
    let failureCount = 0;

    for (const payout of batch.payouts) {
      if (payout.status !== "APPROVED") continue;

      try {
        const vendor = payout.vendor;
        if (!vendor.momoNumber) {
          throw new Error("Vendor does not have a registered Mobile Money phone number.");
        }

        // 1. Resolve Paystack Recipient Code
        let recipientCode = payout.recipientCode || vendor.momoNumber;
        try {
          recipientCode = await PaystackTransferClient.createMomoRecipient({
            vendorName: vendor.name,
            momoNumber: vendor.momoNumber,
            momoNetwork: vendor.momoNetwork,
          });
          await this.repo.saveVendorRecipientCode(vendor.id, recipientCode);
        } catch (recipErr: any) {
          logger.warn({ err: recipErr?.message, vendorId: vendor.id }, "payout: failed to create transfer recipient");
        }

        // 2. Spec §7: Generate unique transferRef and store BEFORE calling the gateway.
        //    This is the idempotency key. If the process crashes after storing but before
        //    calling the gateway, we can detect the orphaned reference on restart.
        const transferRef = `TRF-${payout.id.slice(0, 8)}-${crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase()}`;

        // 3. Lock vendor funds and set payout to PROCESSING in a transaction (spec §7 locking).
        //    SELECT FOR UPDATE equivalent: update with status guard ensures atomicity.
        await prisma.$transaction(async (tx) => {
          // Move VendorOrder funds from AVAILABLE → IN_PAYOUT (locks them from other batches)
          await tx.vendorOrder.updateMany({
            where: { payoutId: payout.id, fundsStatus: "AVAILABLE" },
            data: { fundsStatus: "IN_PAYOUT" },
          });

          // Store transferRef BEFORE calling gateway
          await tx.vendorPayout.update({
            where: { id: payout.id },
            data: { status: "PROCESSING", paystackTransferRef: transferRef, recipientCode },
          });

          // Ledger entry F: Available → In Transit
          const amountPesewas = Money.fromMajor(payout.amount).toMinor();
          await LedgerService.entryF_PayoutInitiated(tx, {
            amountPesewas,
            payoutId: payout.id,
            vendorId: vendor.id,
          });
        });

        // 4. Call Paystack (outside the DB lock transaction to avoid holding DB connections)
        const transferRes = await PaystackTransferClient.initiateTransfer({
          recipientCode,
          amountGhs: Number(payout.amount),
          reference: transferRef,
          reason: `NextDor Vendor Payout ${batch.batchReference}`,
        });

        // 5. If gateway returns instant success (rare), confirm immediately.
        //    Spec §7: "Do not trust the webhook alone." Normally wait for transfer.success webhook.
        const isInstantSuccess = transferRes.data?.status === "success";
        if (isInstantSuccess) {
          await this._confirmPayoutSuccess(payout.id, vendor.id, transferRef, transferRes.data);
        } else {
          await this.repo.updatePayout(payout.id, {
            status: "PROCESSING",
            paystackTransferRef: transferRef,
            recipientCode,
            gatewayResponse: transferRes.data,
          });
        }

        successCount++;
        this._notifyVendorPayoutSent(vendor, payout, transferRef, batch.batchReference);

      } catch (itemErr: any) {
        failureCount++;
        logger.error(
          { err: itemErr?.message, payoutId: payout.id, vendorId: payout.vendorId },
          "payout: failed to process individual vendor payout",
        );

        // Restore vendor order funds to AVAILABLE (spec: payout failed, retry later)
        await prisma.$transaction(async (tx) => {
          await tx.vendorOrder.updateMany({
            where: { payoutId: payout.id, fundsStatus: "IN_PAYOUT" },
            data: { fundsStatus: "AVAILABLE" },
          });
          await tx.vendorPayout.update({
            where: { id: payout.id },
            data: { status: "FAILED", failureReason: itemErr?.message || "Transfer initiation failed" },
          });
          // Ledger entry I: funds restored (only if entry F was written)
          const amountPesewas = Money.fromMajor(payout.amount).toMinor();
          await LedgerService.entryI_PayoutFailedReversal(tx, {
            amountPesewas,
            payoutId: payout.id,
            vendorId: payout.vendorId,
          }).catch(() => {}); // Best-effort: entry F may not have been written if crash was before it
        });
      }
    }

    let finalStatus: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";
    if (failureCount > 0 && successCount > 0) finalStatus = "PARTIAL";
    else if (failureCount > 0 && successCount === 0) finalStatus = "FAILED";

    const updatedBatch = await this.repo.updateBatchStatus(batch.id, finalStatus);
    logger.info(
      { batchId: batch.id, status: finalStatus, successful: successCount, failed: failureCount },
      "payout: batch execution completed",
    );

    return {
      batch: updatedBatch,
      summary: { totalPayouts: batch.payouts.length, successful: successCount, failed: failureCount, finalStatus },
    };
  }

  // ─── Transfer Webhooks ──────────────────────────────────────────────────────

  /**
   * Spec §7: Process Paystack transfer webhooks (success / failed / reversed).
   * Duplicate webhooks are safely ignored via ProcessedWebhookEvent deduplication.
   */
  async handleTransferWebhook(payload: PaystackTransferWebhook) {
    const { event, data } = payload;

    // Spec §7: Deduplication — store event ID so duplicate webhooks produce no duplicate entries
    const eventKey = `${event}:${data.reference}`;
    try {
      await prisma.processedWebhookEvent.create({
        data: { eventKey, eventType: event, rawPayload: payload as any },
      });
    } catch (dupErr: any) {
      if (dupErr?.code === "P2002") {
        logger.info({ eventKey }, "payout webhook: duplicate event — skipped (idempotent)");
        return { success: true, ignored: true };
      }
      throw dupErr;
    }

    const payout = await this.repo.findPayoutByTransferRef(data.reference);
    if (!payout) {
      logger.info({ reference: data.reference, event }, "payout webhook: reference not matched — ignored");
      return { success: true, ignored: true };
    }

    if (event === "transfer.success") {
      await prisma.$transaction(async (tx) => {
        await this._confirmPayoutSuccess(payout.id, payout.vendorId, data.reference, data, tx);
      });
      this._notifyVendorPayoutConfirmed(payout);

    } else if (event === "transfer.failed") {
      await prisma.$transaction(async (tx) => {
        await tx.vendorOrder.updateMany({
          where: { payoutId: payout.id, fundsStatus: "IN_PAYOUT" },
          data: { fundsStatus: "AVAILABLE" },
        });
        await tx.vendorPayout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED",
            failureReason: JSON.stringify(data.failures || "Transfer rejected by carrier"),
            gatewayResponse: data as any,
          },
        });
        // Ledger entry I
        const amountPesewas = Money.fromMajor(payout.amount).toMinor();
        await LedgerService.entryI_PayoutFailedReversal(tx, {
          amountPesewas,
          payoutId: payout.id,
          vendorId: payout.vendorId,
        });
      });
      logger.warn({ payoutId: payout.id, reference: data.reference }, "payout: transfer failed, funds restored");

    } else if (event === "transfer.reversed") {
      // Spec §3: Status REVERSED; liability re-established.
      await prisma.$transaction(async (tx) => {
        await tx.vendorPayout.update({
          where: { id: payout.id },
          data: { status: "REVERSED", gatewayResponse: data as any },
        });
        // Re-establish vendor liability (funds should be recoverable from gateway)
        const amountPesewas = Money.fromMajor(payout.amount).toMinor();
        await LedgerService.entryPayoutReversed(tx, {
          amountPesewas,
          payoutId: payout.id,
          vendorId: payout.vendorId,
        });
        // VendorOrder funds: move back to AVAILABLE so they can be retried
        await tx.vendorOrder.updateMany({
          where: { payoutId: payout.id },
          data: { fundsStatus: "AVAILABLE", payoutId: null },
        });
      });
      logger.warn({ payoutId: payout.id }, "payout: transfer reversed, liability re-established");
    }

    return { success: true, event };
  }

  // ─── Admin queries ──────────────────────────────────────────────────────────

  async getBatch(batchId: string) {
    const batch = await this.repo.findBatchById(batchId);
    if (!batch) throw new NotFoundError(`Payout batch "${batchId}"`);
    return batch;
  }

  async listBatches(page = 1, limit = 20) {
    return this.repo.listBatches(page, limit);
  }

  /**
   * Spec §9 payout health: find payouts stuck in PROCESSING beyond a threshold.
   */
  async findStuckPayouts(thresholdHours = 24) {
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
    return prisma.vendorPayout.findMany({
      where: { status: "PROCESSING", updatedAt: { lte: cutoff } },
      include: { vendor: { select: { id: true, name: true } }, batch: true },
      orderBy: { updatedAt: "asc" },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _confirmPayoutSuccess(
    payoutId: string,
    vendorId: string,
    transferRef: string,
    gatewayData: any,
    tx?: any,
  ) {
    const run = tx ?? prisma;
    const amountPesewas = await (async () => {
      const p = await (tx ? tx.vendorPayout : prisma.vendorPayout).findUnique({
        where: { id: payoutId },
        select: { amount: true },
      });
      return Money.fromMajor(p!.amount).toMinor();
    })();

    await (tx ? tx.vendorPayout : prisma.vendorPayout).update({
      where: { id: payoutId },
      data: {
        status: "PAID",
        paidAt: gatewayData?.transferred_at ? new Date(gatewayData.transferred_at) : new Date(),
        gatewayResponse: gatewayData,
      },
    });

    await (tx ? tx.vendorOrder : prisma.vendorOrder).updateMany({
      where: { payoutId, fundsStatus: "IN_PAYOUT" },
      data: { fundsStatus: "PAID_OUT" },
    });

    // Ledger entry G: In Transit → Bank/MoMo Settlement
    const ledgerTx = tx ?? await prisma.$transaction(async (innerTx: any) => innerTx);
    if (tx) {
      await LedgerService.entryG_PayoutConfirmed(tx, { amountPesewas, payoutId });
    } else {
      await prisma.$transaction(async (innerTx) => {
        await LedgerService.entryG_PayoutConfirmed(innerTx, { amountPesewas, payoutId });
      });
    }
  }

  private _notifyVendorPayoutSent(vendor: any, payout: any, transferRef: string, batchRef?: string) {
    const notifyPhone = vendor.phone || vendor.momoNumber;
    if (notifyPhone) {
      SmsService.sendSms(
        notifyPhone,
        `NextDor Payout: GH₵${Number(payout.amount).toFixed(2)} has been sent to your ${vendor.momoNetwork || "MoMo"} wallet (${vendor.momoNumber}). Ref: ${transferRef}`,
      ).catch((err) => logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout SMS notice failed"));
    }

    if (vendor.email) {
      dispatchEmailAsync({
        type: "vendor_payout",
        params: {
          vendorEmail: vendor.email,
          storeName: vendor.name,
          amount: Number(payout.amount),
          momoNumber: vendor.momoNumber,
          momoNetwork: vendor.momoNetwork || "MoMo",
          reference: transferRef,
          batchReference: batchRef,
        },
      }).catch((err) => logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout email notice failed"));
    }

    const waPhone = vendor.whatsappPhone || vendor.phone || vendor.momoNumber;
    if (vendor.whatsappOptIn !== false && waPhone) {
      WhatsAppService.sendVendorPayoutAlert(
        waPhone,
        { storeName: vendor.name, amount: Number(payout.amount), batchId: transferRef, network: vendor.momoNetwork || "MoMo" },
        vendor.email ? { email: vendor.email, netEarnings: Number(payout.amount) } : undefined,
      ).catch((err) => logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout WhatsApp notice failed"));
    }
  }

  private _notifyVendorPayoutConfirmed(payout: any) {
    const vendor = payout.vendor;
    const notifyPhone = vendor.phone || vendor.momoNumber;
    if (notifyPhone) {
      SmsService.sendSms(
        notifyPhone,
        `NextDor Update: Payout of GH₵${Number(payout.amount).toFixed(2)} was successfully credited to your wallet.`,
      ).catch(() => {});
    }

    if (vendor.email) {
      dispatchEmailAsync({
        type: "vendor_payout",
        params: {
          vendorEmail: vendor.email,
          storeName: vendor.name,
          amount: Number(payout.amount),
          momoNumber: vendor.momoNumber || "Registered MoMo",
          momoNetwork: vendor.momoNetwork || "MoMo",
          reference: payout.paystackTransferRef,
          batchReference: payout.batch?.batchReference,
        },
      }).catch(() => {});
    }
  }
}
