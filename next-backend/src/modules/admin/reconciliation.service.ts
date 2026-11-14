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

      // 2. Platform Commission & Delivery Fees (Earned vs In-Flight)
      earnedCommissionsAgg,
      inFlightCommissionsAgg,
      earnedDeliveryFeesAgg,
      inFlightDeliveryFeesAgg,
      discountsAgg,

      // 3. Disbursed Payouts to Merchants
      disbursedAgg,
      disbursedCount,

      // 4. In-Escrow Funds (Delivered and paid, within 48-hour buyer protection window)
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

      // 9. Pre-Delivery Merchant Allocations (Paid, awaiting delivery & 48h escrow window)
      pendingFulfillmentAgg,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: paymentWhere }),

      prisma.vendorOrder.aggregate({
        where: {
          status: "DELIVERED",
          order: { paymentStatus: "PAID" },
        },
        _sum: { commissionAmount: true },
      }),

      prisma.vendorOrder.aggregate({
        where: {
          status: { in: ["PENDING", "PROCESSING", "SHIPPED"] },
          order: { paymentStatus: "PAID" },
        },
        _sum: { commissionAmount: true },
      }),

      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          status: { in: ["DELIVERED", "DELIVERED_VERIFIED", "COMPLETED"] },
        },
        _sum: { deliveryFee: true },
      }),

      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          status: { in: ["PLACED", "PENDING", "CONFIRMED", "ACCEPTED", "PROCESSING", "SHIPPED", "DISPATCHED"] },
        },
        _sum: { deliveryFee: true },
      }),

      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
        _sum: { discount: true },
      }),

      prisma.vendorPayout.aggregate({
        where: payoutWhere,
        _sum: { amount: true },
      }),
      prisma.vendorPayout.count({ where: payoutWhere }),

      prisma.vendorOrder.aggregate({
        where: {
          status: { not: "CANCELLED" },
          payoutId: null,
          order: { paymentStatus: "PAID" },
          OR: [
            { fundsStatus: "ESCROW" },
            {
              status: "DELIVERED",
              fundsStatus: "PENDING_FULFILLMENT",
              clearedAt: { gt: now },
            },
          ],
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),

      prisma.vendorOrder.aggregate({
        where: {
          status: { not: "CANCELLED" },
          payoutId: null,
          order: { paymentStatus: "PAID" },
          OR: [
            { fundsStatus: "AVAILABLE" },
            {
              status: "DELIVERED",
              fundsStatus: "PENDING_FULFILLMENT",
              clearedAt: { lte: now },
            },
          ],
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),

      prisma.vendorPayout.aggregate({
        where: { status: { in: ["DRAFT", "APPROVED", "PROCESSING"] } },
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
          status: { in: ["DELIVERED", "DELIVERED_VERIFIED", "COMPLETED"] },
          payments: { none: { status: "SUCCESS" } },
          ...(startDate || endDate ? { updatedAt: { gte: startDate, lte: endDate } } : {}),
        },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: {
          paymentStatus: "PAID",
          status: { in: ["DELIVERED", "DELIVERED_VERIFIED", "COMPLETED"] },
          payments: { none: { status: "SUCCESS" } },
          ...(startDate || endDate ? { updatedAt: { gte: startDate, lte: endDate } } : {}),
        },
      }),
      prisma.vendorOrder.aggregate({
        where: {
          status: { in: ["PENDING", "PROCESSING", "SHIPPED"] },
          fundsStatus: "PENDING_FULFILLMENT",
          payoutId: null,
          order: { paymentStatus: "PAID" },
        },
        _sum: { vendorEarnings: true },
        _count: { id: true },
      }),
    ]);

    const totalGatewayInflow = Number(customerPaymentsAgg._sum.amount || 0);
    const totalCodInflow = Number(codPaymentsAgg._sum?.total || 0);
    const totalInflow = totalGatewayInflow + totalCodInflow;
    const totalDisbursed = Number(disbursedAgg._sum.amount || 0);
    const totalInEscrow = Number(inEscrowAgg._sum.vendorEarnings || 0);
    const totalAvailable = Number(availableAgg._sum.vendorEarnings || 0);
    const totalProcessing = Number(processingPayoutsAgg._sum?.amount || 0);
    const totalPendingFulfillment = Number(pendingFulfillmentAgg._sum.vendorEarnings || 0);

    const earnedCommissions = Number(earnedCommissionsAgg._sum.commissionAmount || 0);
    const inFlightCommissions = Number(inFlightCommissionsAgg._sum.commissionAmount || 0);
    const totalCommissions = earnedCommissions + inFlightCommissions;

    const earnedDeliveryFees = Number(earnedDeliveryFeesAgg._sum?.deliveryFee || 0);
    const inFlightDeliveryFees = Number(inFlightDeliveryFeesAgg._sum?.deliveryFee || 0);
    const totalDeliveryFees = earnedDeliveryFees + inFlightDeliveryFees;
    const totalDiscounts = Number(discountsAgg._sum?.discount || 0);
    const totalRefunds = Number(refundsAgg._sum.amount || 0);

    // Earned vs In-Flight Platform Equity (net of promotional coupon discounts absorbed by platform)
    const earnedPlatformEquity = earnedCommissions + earnedDeliveryFees;
    const inFlightPlatformEquity = inFlightCommissions + inFlightDeliveryFees;
    const platformRevenue = Math.max(0, totalCommissions + totalDeliveryFees - totalDiscounts);

    // Total Unpaid Merchant Liabilities = In-Flight Payouts + In-Escrow + Available + Pre-Delivery
    const totalMerchantLiabilities =
      totalProcessing + totalInEscrow + totalAvailable + totalPendingFulfillment;

    // Mathematical Balance & Variance Check
    // Accounted Funds = Unpaid Merchant Liabilities + Disbursed Payouts + Platform Revenue + Customer Refunds
    const totalAccounted =
      totalMerchantLiabilities + totalDisbursed + platformRevenue + totalRefunds;
    const variance = Number((totalInflow - totalAccounted).toFixed(2));
    const isBalanced = Math.abs(variance) < 1.0; // Allow 1 GHS rounding tolerance over thousands of sub-orders

    // 8. 14-Day Trailing Trend & Recent Double-Entry Ledger Journal
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [recentPayments, recentPayouts, recentVendorOrders, ledgerEntries] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: "SUCCESS",
          createdAt: { gte: fourteenDaysAgo },
        },
        select: { amount: true, createdAt: true },
      }),
      prisma.vendorPayout.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: fourteenDaysAgo },
        },
        select: { amount: true, paidAt: true },
      }),
      prisma.vendorOrder.findMany({
        where: {
          createdAt: { gte: fourteenDaysAgo },
          status: { not: "CANCELLED" },
          order: { paymentStatus: "PAID" },
        },
        select: {
          vendorEarnings: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.ledgerEntry.findMany({
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true, accountType: true } },
            },
          },
        },
      }),
    ]);

    const ledgerOrderIds = Array.from(
      new Set(ledgerEntries.map((e) => e.orderId).filter((id): id is string => Boolean(id)))
    );
    const ledgerOrders =
      ledgerOrderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: ledgerOrderIds } },
            select: { id: true, number: true },
          })
        : [];
    const orderNumberById = new Map(ledgerOrders.map((o) => [o.id, o.number]));

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

      const dayVendorOrders = recentVendorOrders.filter(
        (vo) => vo.createdAt.toISOString().slice(0, 10) === dateKey
      );
      const dayLiabilities = dayVendorOrders.reduce(
        (sum, vo) => sum + Number(vo.vendorEarnings),
        0
      );
      const dayCommission = dayVendorOrders
        .filter((vo) => vo.status === "DELIVERED")
        .reduce((sum, vo) => sum + Number(vo.commissionAmount), 0);

      dailyTrends.push({
        date: dateKey,
        inflow: Number(dayInflow.toFixed(2)),
        outflow: Number(dayOutflow.toFixed(2)),
        vendorLiabilitiesGhs: Number(dayLiabilities.toFixed(2)),
        earnedCommissionGhs: Number(dayCommission.toFixed(2)),
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
        vendorPendingFulfillmentGhs: totalPendingFulfillment,
        vendorPendingFulfillmentPesewas: Math.round(totalPendingFulfillment * 100),
        vendorPendingFulfillmentOrdersCount: pendingFulfillmentAgg._count.id || 0,
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
        earnedPlatformCommissionGhs: earnedPlatformEquity,
        earnedPlatformCommissionPesewas: Math.round(earnedPlatformEquity * 100),
        potentialPlatformCommissionGhs: inFlightPlatformEquity,
        potentialPlatformCommissionPesewas: Math.round(inFlightPlatformEquity * 100),
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
        vendorLiabilitiesGhs: d.vendorLiabilitiesGhs,
        earnedCommissionGhs: d.earnedCommissionGhs,
        payoutDisbursementsGhs: d.outflow,
      })),
      ledgerEntries: ledgerEntries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        description: entry.description,
        currency: entry.currency,
        orderNumber: entry.orderId ? orderNumberById.get(entry.orderId) || null : null,
        occurredAt: entry.occurredAt,
        lines: entry.lines.map((line) => ({
          id: line.id,
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.accountType,
          amountGhs: Number((line.amountPesewas / 100).toFixed(2)),
          isDebit: line.isDebit,
          memo: line.memo,
        })),
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
