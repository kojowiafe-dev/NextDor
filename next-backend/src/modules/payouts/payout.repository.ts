import { prisma } from "../../lib/prisma.js";
import { Prisma, PayoutBatchStatus, PayoutStatus } from "@prisma/client";

export class PayoutRepository {
  /**
   * Finds all active vendors who have cleared escrow balances awaiting payout.
   */
  async findEligibleVendorsForPayout(minThreshold: number, targetVendorIds?: string[]) {
    const now = new Date();

    const where: Prisma.VendorWhereInput = {
      status: "ACTIVE",
      deletedAt: null,
      momoNumber: { not: null },
    };

    if (targetVendorIds && targetVendorIds.length > 0) {
      where.id = { in: targetVendorIds };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        momoNumber: true,
        momoNetwork: true,
        paystackRecipientCode: true,
        vendorOrders: {
          where: {
            status: "DELIVERED",
            clearedAt: { lte: now },
            payoutId: null,
          },
          select: {
            id: true,
            subtotal: true,
            commissionAmount: true,
            vendorEarnings: true,
          },
        },
      },
    });

    // Filter to vendors whose available balance reaches minThreshold
    return vendors
      .map((vendor) => {
        const totalEarnings = vendor.vendorOrders.reduce(
          (sum, o) => sum + Number(o.vendorEarnings),
          0
        );
        return {
          ...vendor,
          availableAmount: totalEarnings,
          clearedOrderCount: vendor.vendorOrders.length,
        };
      })
      .filter((v) => v.availableAmount >= minThreshold && v.clearedOrderCount > 0);
  }

  /**
   * Creates a payout batch with individual vendor payouts in an atomic transaction.
   */
  async createBatchWithPayouts(params: {
    batchReference: string;
    totalAmount: number;
    createdBy?: string;
    notes?: string;
    payouts: Array<{
      vendorId: string;
      amount: number;
      orderIds: string[];
      recipientCode?: string | null;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Create PayoutBatch
      const batch = await tx.payoutBatch.create({
        data: {
          batchReference: params.batchReference,
          totalAmount: new Prisma.Decimal(params.totalAmount),
          totalCount: params.payouts.length,
          status: "PENDING",
          createdBy: params.createdBy || null,
          notes: params.notes || null,
        },
      });

      // 2. Create VendorPayout for each vendor and link vendorOrders
      const createdPayouts = [];
      for (const item of params.payouts) {
        const payout = await tx.vendorPayout.create({
          data: {
            vendorId: item.vendorId,
            batchId: batch.id,
            amount: new Prisma.Decimal(item.amount),
            currency: "GHS",
            status: "PENDING",
            recipientCode: item.recipientCode || null,
          },
        });

        // Link orders to this payout
        await tx.vendorOrder.updateMany({
          where: { id: { in: item.orderIds } },
          data: { payoutId: payout.id },
        });

        createdPayouts.push(payout);
      }

      return {
        batch,
        payouts: createdPayouts,
      };
    });
  }

  /**
   * Find a payout batch with its associated vendor payouts.
   */
  async findBatchById(batchId: string) {
    return prisma.payoutBatch.findUnique({
      where: { id: batchId },
      include: {
        payouts: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                momoNumber: true,
                momoNetwork: true,
                email: true,
                phone: true,
              },
            },
            vendorOrders: {
              select: {
                id: true,
                subtotal: true,
                commissionAmount: true,
                vendorEarnings: true,
                order: { select: { number: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all payout batches with pagination.
   */
  async listBatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, batches] = await Promise.all([
      prisma.payoutBatch.count(),
      prisma.payoutBatch.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { payouts: true } },
        },
      }),
    ]);

    return {
      batches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a payout by Paystack transfer reference.
   */
  async findPayoutByTransferRef(ref: string) {
    return prisma.vendorPayout.findUnique({
      where: { paystackTransferRef: ref },
      include: {
        vendor: true,
        batch: true,
      },
    });
  }

  /**
   * Update payout record status and optional details.
   */
  async updatePayout(
    payoutId: string,
    data: {
      status: PayoutStatus;
      paystackTransferRef?: string;
      recipientCode?: string;
      failureReason?: string;
      paidAt?: Date;
      gatewayResponse?: any;
    }
  ) {
    return prisma.vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: data.status,
        paystackTransferRef: data.paystackTransferRef,
        recipientCode: data.recipientCode,
        failureReason: data.failureReason,
        paidAt: data.paidAt,
        gatewayResponse: data.gatewayResponse,
      },
      include: { vendor: true, batch: true },
    });
  }

  /**
   * Update batch status.
   */
  async updateBatchStatus(batchId: string, status: PayoutBatchStatus) {
    return prisma.payoutBatch.update({
      where: { id: batchId },
      data: { status },
    });
  }

  /**
   * Unlink vendor orders if a payout fails permanently, so funds return to available balance.
   */
  async releaseOrdersFromFailedPayout(payoutId: string) {
    return prisma.vendorOrder.updateMany({
      where: { payoutId },
      data: { payoutId: null },
    });
  }

  /**
   * Saves resolved recipient code on a vendor.
   */
  async saveVendorRecipientCode(vendorId: string, recipientCode: string) {
    return prisma.vendor.update({
      where: { id: vendorId },
      data: { paystackRecipientCode: recipientCode },
    });
  }
}
