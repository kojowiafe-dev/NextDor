import crypto from "node:crypto";
import { PayoutRepository } from "./payout.repository.js";
import { PaystackTransferClient } from "./paystack.transfer.js";
import { Money } from "../../domain/Money.js";
import { logger } from "../../lib/logger.js";
import { SmsService } from "../../lib/sms.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import { WhatsAppService } from "../../lib/whatsapp.js";
import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from "../../lib/errors.js";
import type {
  CreatePayoutBatchInput,
  ExecutePayoutBatchInput,
  PaystackTransferWebhook,
} from "@nextdor/shared";

export class PayoutService {
  constructor(private readonly repo: PayoutRepository = new PayoutRepository()) {}

  /**
   * Generates a new pending payout batch aggregating all cleared vendor escrow balances.
   */
  async generateBatch(input: CreatePayoutBatchInput, createdBy?: string) {
    const minThreshold = input.minThreshold ?? 5;
    const eligible = await this.repo.findEligibleVendorsForPayout(
      minThreshold,
      input.vendorIds
    );

    if (eligible.length === 0) {
      throw new UnprocessableError(
        `No vendors with cleared escrow balances meeting the minimum threshold of GH₵${minThreshold.toFixed(
          2
        )} were found.`
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
      },
      "Payout batch generated"
    );

    return result;
  }

  /**
   * Executes a pending payout batch via Paystack Transfers API.
   */
  async executeBatch(input: ExecutePayoutBatchInput) {
    const batch = await this.repo.findBatchById(input.batchId);
    if (!batch) {
      throw new NotFoundError(`Payout batch "${input.batchId}"`);
    }

    if (batch.status !== "PENDING") {
      throw new BadRequestError(
        `Batch "${batch.batchReference}" cannot be executed because its status is ${batch.status}.`
      );
    }

    // Advance batch to PROCESSING
    await this.repo.updateBatchStatus(batch.id, "PROCESSING");

    let successCount = 0;
    let failureCount = 0;

    for (const payout of batch.payouts) {
      try {
        const vendor = payout.vendor;
        if (!vendor.momoNumber) {
          throw new Error("Vendor does not have a registered Mobile Money phone number.");
        }

        // 1. Resolve or create Paystack Recipient Code
        let recipientCode = payout.recipientCode || vendor.momoNumber;
        try {
          recipientCode = await PaystackTransferClient.createMomoRecipient({
            vendorName: vendor.name,
            momoNumber: vendor.momoNumber,
            momoNetwork: vendor.momoNetwork,
          });
          // Cache on vendor
          await this.repo.saveVendorRecipientCode(vendor.id, recipientCode);
        } catch (recipErr: any) {
          logger.warn(
            { err: recipErr?.message, vendorId: vendor.id },
            "Failed to create transfer recipient"
          );
        }

        // 2. Initiate Transfer via Paystack
        const transferRef = `TRF-${payout.id.slice(0, 8)}-${crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase()}`;

        const transferRes = await PaystackTransferClient.initiateTransfer({
          recipientCode,
          amountGhs: Number(payout.amount),
          reference: transferRef,
          reason: `NextDor Vendor Payout ${batch.batchReference}`,
        });

        const isInstantSuccess = transferRes.data?.status === "success";

        await this.repo.updatePayout(payout.id, {
          status: isInstantSuccess ? "PAID" : "PROCESSING",
          paystackTransferRef: transferRef,
          recipientCode,
          paidAt: isInstantSuccess ? new Date() : undefined,
          gatewayResponse: transferRes.data,
        });

        successCount++;

        // Send instant notification SMS to vendor phone
        const notifyPhone = vendor.phone || vendor.momoNumber;
        if (notifyPhone) {
          SmsService.sendSms(
            notifyPhone,
            `NextDor Payout: GH₵${Number(payout.amount).toFixed(
              2
            )} has been sent to your ${vendor.momoNetwork || "MoMo"} wallet (${vendor.momoNumber}). Ref: ${transferRef}`
          ).catch((err) =>
            logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout SMS notice failed")
          );
        }

        // Send confirmation email to merchant
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
              batchReference: batch.batchReference,
            },
          }).catch((err) =>
            logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout email notice failed")
          );
        }

        // Send WhatsApp Payout Confirmation to merchant
        const waPhone = vendor.whatsappPhone || vendor.phone || vendor.momoNumber;
        if (vendor.whatsappOptIn !== false && waPhone) {
          WhatsAppService.sendVendorPayoutAlert(
            waPhone,
            {
              storeName: vendor.name,
              amount: Number(payout.amount),
              batchId: transferRef,
              network: vendor.momoNetwork || "MoMo",
            },
            vendor.email ? { email: vendor.email, netEarnings: Number(payout.amount) } : undefined
          ).catch((err) =>
            logger.warn({ err: err?.message, vendorId: vendor.id }, "Payout WhatsApp notice failed")
          );
        }
      } catch (itemErr: any) {
        failureCount++;
        logger.error(
          { err: itemErr?.message, payoutId: payout.id, vendorId: payout.vendorId },
          "Failed to process individual vendor payout in batch"
        );

        await this.repo.updatePayout(payout.id, {
          status: "FAILED",
          failureReason: itemErr?.message || "Transfer initiation failed",
        });

        // Release orders back to available escrow balance
        await this.repo.releaseOrdersFromFailedPayout(payout.id);
      }
    }

    // Determine final batch status
    let finalStatus: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";
    if (failureCount > 0 && successCount > 0) {
      finalStatus = "PARTIAL";
    } else if (failureCount > 0 && successCount === 0) {
      finalStatus = "FAILED";
    }

    const updatedBatch = await this.repo.updateBatchStatus(batch.id, finalStatus);

    logger.info(
      {
        batchId: batch.id,
        status: finalStatus,
        successful: successCount,
        failed: failureCount,
      },
      "Payout batch execution completed"
    );

    return {
      batch: updatedBatch,
      summary: {
        totalPayouts: batch.payouts.length,
        successful: successCount,
        failed: failureCount,
        finalStatus,
      },
    };
  }

  /**
   * Processes inbound Paystack Transfer Webhooks (transfer.success / transfer.failed / transfer.reversed).
   */
  async handleTransferWebhook(payload: PaystackTransferWebhook) {
    const { event, data } = payload;
    const payout = await this.repo.findPayoutByTransferRef(data.reference);

    if (!payout) {
      logger.info({ reference: data.reference, event }, "Paystack transfer webhook ignored: reference not matched");
      return { success: true, ignored: true };
    }

    if (event === "transfer.success") {
      await this.repo.updatePayout(payout.id, {
        status: "PAID",
        paidAt: data.transferred_at ? new Date(data.transferred_at) : new Date(),
        gatewayResponse: data,
      });

      const notifyPhone = payout.vendor.phone || payout.vendor.momoNumber;
      if (notifyPhone) {
        SmsService.sendSms(
          notifyPhone,
          `NextDor Update: Payout of GH₵${Number(payout.amount).toFixed(
            2
          )} was successfully credited to your wallet.`
        ).catch(() => {});
      }

      if (payout.vendor.email) {
        dispatchEmailAsync({
          type: "vendor_payout",
          params: {
            vendorEmail: payout.vendor.email,
            storeName: payout.vendor.name,
            amount: Number(payout.amount),
            momoNumber: payout.vendor.momoNumber || "Registered MoMo",
            momoNetwork: payout.vendor.momoNetwork || "MoMo",
            reference: data.reference,
            batchReference: payout.batch?.batchReference,
          },
        }).catch(() => {});
      }

      const waPhone = (payout.vendor as any).whatsappPhone || payout.vendor.phone || payout.vendor.momoNumber;
      if ((payout.vendor as any).whatsappOptIn !== false && waPhone) {
        WhatsAppService.sendVendorPayoutAlert(
          waPhone,
          {
            storeName: payout.vendor.name,
            amount: Number(payout.amount),
            batchId: data.reference,
            network: payout.vendor.momoNetwork || "MoMo",
          },
          payout.vendor.email ? { email: payout.vendor.email, netEarnings: Number(payout.amount) } : undefined
        ).catch(() => {});
      }
    } else if (event === "transfer.failed" || event === "transfer.reversed") {
      await this.repo.updatePayout(payout.id, {
        status: "FAILED",
        failureReason: JSON.stringify(data.failures || "Transfer rejected by carrier"),
        gatewayResponse: data,
      });

      // Release orders so funds can be re-disbursed
      await this.repo.releaseOrdersFromFailedPayout(payout.id);

      logger.warn(
        { payoutId: payout.id, reference: data.reference, event },
        "Vendor payout transfer failed via webhook; escrow orders released back to balance"
      );
    }

    return { success: true, event };
  }

  async getBatch(batchId: string) {
    const batch = await this.repo.findBatchById(batchId);
    if (!batch) throw new NotFoundError(`Payout batch "${batchId}"`);
    return batch;
  }

  async listBatches(page = 1, limit = 20) {
    return this.repo.listBatches(page, limit);
  }
}
