import { prisma } from "../lib/prisma.js";

async function main() {
  const now = new Date();

  const [
    customerPaymentsAgg,
    commissionsAgg,
    deliveryFeesAgg,
    disbursedAgg,
    inEscrowAgg,
    availableAgg,
    processingPayoutsAgg,
    refundsAgg,
    pendingFulfillmentAgg,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
      _count: { id: true },
    }),
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
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
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
      where: { status: "PROCESSED" },
      _sum: { amount: true },
    }),
    prisma.vendorOrder.aggregate({
      where: {
        status: { in: ["PENDING", "PROCESSING", "SHIPPED"] },
        payoutId: null,
        order: { paymentStatus: "PAID" },
      },
      _sum: { vendorEarnings: true },
      _count: { id: true },
    }),
  ]);

  const totalInflow = Number(customerPaymentsAgg._sum.amount || 0);
  const totalDisbursed = Number(disbursedAgg._sum.amount || 0);
  const totalInEscrow = Number(inEscrowAgg._sum.vendorEarnings || 0);
  const totalAvailable = Number(availableAgg._sum.vendorEarnings || 0);
  const totalProcessing = Number(processingPayoutsAgg._sum.amount || 0);
  const totalPendingFulfillment = Number(pendingFulfillmentAgg._sum.vendorEarnings || 0);
  const totalCommissions = Number(commissionsAgg._sum.commissionAmount || 0);
  const totalDeliveryFees = Number(deliveryFeesAgg._sum.deliveryFee || 0);
  const totalRefunds = Number(refundsAgg._sum.amount || 0);

  const platformRevenue = totalCommissions + totalDeliveryFees;
  const totalMerchantLiabilities =
    totalDisbursed + totalProcessing + totalInEscrow + totalAvailable + totalPendingFulfillment;

  const totalAccounted = totalMerchantLiabilities + platformRevenue + totalRefunds;
  const variance = Number((totalInflow - totalAccounted).toFixed(2));

  console.log("=== RECONCILIATION AUDIT ===");
  console.log("Total Inflow:", totalInflow);
  console.log("Pending Fulfillment:", totalPendingFulfillment);
  console.log("In 48h Escrow:", totalInEscrow);
  console.log("Available for Payout:", totalAvailable);
  console.log("Disbursed:", totalDisbursed);
  console.log("Commissions:", totalCommissions);
  console.log("Delivery Fees:", totalDeliveryFees);
  console.log("Total Accounted:", totalAccounted);
  console.log("VARIANCE:", variance);
  console.log("IS BALANCED:", Math.abs(variance) < 1.0);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
