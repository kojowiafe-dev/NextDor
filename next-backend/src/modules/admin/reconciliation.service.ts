import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { Money } from "../../domain/Money.js";

export class ReconciliationService {
  /**
   * Generates a comprehensive financial ledger balancing gateway receipts,
   * platform commission, merchant escrow liabilities, and disbursed payouts.
   */
  async getLedger(startDate?: Date, endDate?: Date) {
    const now = new Date();

    const orderWhere: Prisma.OrderWhereInput = {};
    const paymentWhere: Prisma.PaymentWhereInput = { status: "SUCCESS" };
    const payoutWhere: Prisma.VendorPayoutWhereInput = { status: "PAID" };
    const refundWhere: Prisma.RefundWhereInput = { status: "PROCESSED" };

    if (startDate || endDate) {
      paymentWhere.createdAt = {};
      payoutWhere.paidAt = {};
      refundWhere.createdAt = {};

      if (startDate) {
        paymentWhere.createdAt.gte = startDate;
        payoutWhere.paidAt.gte = startDate;
        refundWhere.createdAt.gte = startDate;
      }
      if (endDate) {
        paymentWhere.createdAt.lte = endDate;
        payoutWhere.paidAt.lte = endDate;
        refundWhere.createdAt.lte = endDate;
      }
    }

    const [
      // 1. Gateway Inflows (Customer Paystack Payments)
      customerPaymentsAgg,
      customerPaymentsCount,

      // 2. Platform Commission & Delivery Fees
      commissionsAgg,
      deliveryFeesAgg,

      // 3. Disbursed Payouts to Merchants
      disbursedAgg,
      disbursedCount,

      // 4. In-Escrow Funds (Delivered and paid, but within 48-hour buyer protection window)
      inEscrowAgg,

      // 5. Unclaimed Available Balance (Delivered and paid, escrow elapsed, not yet disbursed)
      availableAgg,

      // 6. Processing Payouts (Disbursement in-flight)
      processingPayoutsAgg,

      // 7. Customer Refunds Settled
      refundsAgg,
      refundsCount,

      // 8. Cash on Delivery Collections (Delivered and collected without online gateway payment)
      codPaymentsAgg,
      codPaymentsCount,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: paymentWhere }),

      prisma.vendorOrder.aggregate({
        where: {
          status: { not: "CANCELLED" },
          order: { paymentStatus: "PAID" },
        },
        _sum: { commissionAmount: true },
      }),

      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
        _sum: { deliveryFee: true },
      }),

      prisma.vendorPayout.aggregate({
        where: payoutWhere,
        _sum: { amount: true },
      }),
      prisma.vendorPayout.count({ where: payoutWhere }),

      prisma.vendorOrder.aggregate({
        where: {
          status: "DELIVERED",
          clearedAt: { gt: now },
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),

      prisma.vendorOrder.aggregate({
        where: {
          status: "DELIVERED",
          clearedAt: { lte: now },
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),

      prisma.vendorPayout.aggregate({
        where: { status: "PROCESSING" },
        _sum: { amount: true },
      }),

      prisma.refund.aggregate({
        where: refundWhere,
        _sum: { amount: true },
      }),
      prisma.refund.count({ where: refundWhere }),

      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          status: "DELIVERED",
          payments: { none: { status: "SUCCESS" } },
          ...(startDate || endDate ? { updatedAt: { gte: startDate, lte: endDate } } : {}),
        },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: {
          paymentStatus: "PAID",
          status: "DELIVERED",
          payments: { none: { status: "SUCCESS" } },
          ...(startDate || endDate ? { updatedAt: { gte: startDate, lte: endDate } } : {}),
        },
      }),
    ]);

    const totalGatewayInflow = Number(customerPaymentsAgg._sum.amount || 0);
    const totalCodInflow = Number(codPaymentsAgg._sum.total || 0);
    const totalInflow = totalGatewayInflow + totalCodInflow;
    const totalDisbursed = Number(disbursedAgg._sum.amount || 0);
    const totalInEscrow = Number(inEscrowAgg._sum.vendorEarnings || 0);
    const totalAvailable = Number(availableAgg._sum.vendorEarnings || 0);
    const totalProcessing = Number(processingPayoutsAgg._sum.amount || 0);
    const totalCommissions = Number(commissionsAgg._sum.commissionAmount || 0);
    const totalDeliveryFees = Number(deliveryFeesAgg._sum.deliveryFee || 0);
    const totalRefunds = Number(refundsAgg._sum.amount || 0);

    // Platform Net Profit = Commissions + Delivery Fees
    const platformRevenue = totalCommissions + totalDeliveryFees;

    // Total Merchant Liabilities = Disbursed + In-Flight + In-Escrow + Available
    const totalMerchantLiabilities =
      totalDisbursed + totalProcessing + totalInEscrow + totalAvailable;

    // Mathematical Balance & Variance Check
    // Accounted Funds = Merchant Allocations + Platform Revenue + Customer Refunds
    const totalAccounted = totalMerchantLiabilities + platformRevenue + totalRefunds;
    const variance = Number((totalInflow - totalAccounted).toFixed(2));
    const isBalanced = Math.abs(variance) < 1.0; // Allow 1 GHS rounding tolerance over thousands of sub-orders

    // 8. 14-Day Trailing Trend
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentPayments = await prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { amount: true, createdAt: true },
    });

    const recentPayouts = await prisma.vendorPayout.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: fourteenDaysAgo },
      },
      select: { amount: true, paidAt: true },
    });

    const dailyTrends = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);

      const dayInflow = recentPayments
        .filter((p) => p.createdAt.toISOString().slice(0, 10) === dateKey)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const dayOutflow = recentPayouts
        .filter((p) => p.paidAt && p.paidAt.toISOString().slice(0, 10) === dateKey)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      dailyTrends.push({
        date: dateKey,
        inflow: Number(dayInflow.toFixed(2)),
        outflow: Number(dayOutflow.toFixed(2)),
      });
    }

    return {
      asOf: now.toISOString(),
      inflow: {
        totalCustomerPaymentsGhs: totalInflow,
        totalCustomerPaymentsPesewas: Math.round(totalInflow * 100),
        gatewayPaymentsGhs: totalGatewayInflow,
        cashOnDeliveryGhs: totalCodInflow,
        successfulPaymentsCount: customerPaymentsCount + codPaymentsCount,
      },
      liabilities: {
        vendorEscrowPendingGhs: totalInEscrow,
        vendorEscrowPendingPesewas: Math.round(totalInEscrow * 100),
        vendorEscrowOrdersCount: inEscrowAgg._count.id || 0,
        vendorAvailablePayoutGhs: totalAvailable,
        vendorAvailablePayoutPesewas: Math.round(totalAvailable * 100),
        vendorAvailableOrdersCount: availableAgg._count.id || 0,
        totalMerchantLiabilityGhs: totalMerchantLiabilities,
        totalMerchantLiabilityPesewas: Math.round(totalMerchantLiabilities * 100),
      },
      equity: {
        earnedPlatformCommissionGhs: totalCommissions,
        earnedPlatformCommissionPesewas: Math.round(totalCommissions * 100),
        potentialPlatformCommissionGhs: 0,
        potentialPlatformCommissionPesewas: 0,
        totalCommissionGhs: platformRevenue,
        totalCommissionPesewas: Math.round(platformRevenue * 100),
      },
      disbursements: {
        totalPaidOutGhs: totalDisbursed,
        totalPaidOutPesewas: Math.round(totalDisbursed * 100),
        paidOutBatchesCount: disbursedCount,
        refundedGhs: totalRefunds,
        refundedPesewas: Math.round(totalRefunds * 100),
      },
      reconciliation: {
        expectedInflowGhs: totalAccounted,
        expectedInflowPesewas: Math.round(totalAccounted * 100),
        actualInflowGhs: totalInflow,
        actualInflowPesewas: Math.round(totalInflow * 100),
        varianceGhs: variance,
        variancePesewas: Math.round(variance * 100),
        isReconciled: isBalanced,
      },
      dailyBreakdown: dailyTrends.map((d) => ({
        date: d.date,
        customerPaymentsGhs: d.inflow,
        vendorLiabilitiesGhs: 0,
        earnedCommissionGhs: 0,
        payoutDisbursementsGhs: d.outflow,
      })),
      // Summary & trends preserved for backward compatibility
      summary: {
        totalGatewayInflow: totalInflow,
        totalCustomerTransactions: customerPaymentsCount,
        platformCommissionEarned: totalCommissions,
        deliveryFeesEarned: totalDeliveryFees,
        totalPlatformRevenue: platformRevenue,
        disbursedToVendors: totalDisbursed,
        disbursedTransactionsCount: disbursedCount,
        inFlightDisbursements: totalProcessing,
        activeEscrowLiabilities: totalInEscrow,
        activeEscrowOrdersCount: inEscrowAgg._count.id || 0,
        unclaimedAvailableBalances: totalAvailable,
        unclaimedAvailableOrdersCount: availableAgg._count.id || 0,
        customerRefundsSettled: totalRefunds,
        customerRefundsCount: refundsCount,
        totalAccounted,
        variance,
        isBalanced,
      },
      dailyTrends,
    };
  }
}
