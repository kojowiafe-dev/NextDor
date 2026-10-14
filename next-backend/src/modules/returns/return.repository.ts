import { prisma } from "../../lib/prisma.js";
import { Prisma, ReturnStatus, ReturnReason, RefundStatus, OrderStatus, PaymentStatus } from "@prisma/client";

export class ReturnRepository {
  /**
   * Find order by number with its items, vendorOrders, payments, and existing return requests.
   */
  async findOrderForReturn(orderNumber: string) {
    return prisma.order.findUnique({
      where: { number: orderNumber },
      include: {
        items: true,
        vendorOrders: true,
        payments: {
          where: { status: "SUCCESS" },
          orderBy: { createdAt: "desc" },
        },
        returnRequests: {
          include: {
            refunds: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Find return request by ID with all relations.
   */
  async findReturnRequestById(id: string) {
    return prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            payments: { where: { status: "SUCCESS" } },
            vendorOrders: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        refunds: true,
      },
    });
  }

  /**
   * List return requests for a customer.
   */
  async findCustomerReturns(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, returns] = await Promise.all([
      prisma.returnRequest.count({ where: { userId } }),
      prisma.returnRequest.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: { number: true, total: true, currency: true, createdAt: true },
          },
          refunds: true,
        },
      }),
    ]);

    return { total, page, limit, returns };
  }

  /**
   * List return requests for a vendor.
   */
  async findVendorReturns(vendorId: string, page = 1, limit = 20, status?: ReturnStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReturnRequestWhereInput = {
      vendorId,
      ...(status ? { status } : {}),
    };

    const [total, returns] = await Promise.all([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: { number: true, createdAt: true },
          },
          refunds: true,
        },
      }),
    ]);

    return { total, page, limit, returns };
  }

  /**
   * List return requests for Admin governance.
   */
  async findAdminReturns(page = 1, limit = 20, status?: ReturnStatus, isDisputed?: boolean) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReturnRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(isDisputed !== undefined ? { isDisputed } : {}),
    };

    const [total, returns] = await Promise.all([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: { number: true, total: true, currency: true, userId: true },
          },
          refunds: true,
        },
      }),
    ]);

    return { total, page, limit, returns };
  }

  /**
   * Creates a return request record.
   */
  async createReturnRequest(data: {
    orderId: string;
    userId?: string;
    vendorId?: string;
    reason: ReturnReason;
    details?: string;
    evidenceUrls?: string[];
    items: any[];
    refundAmount: Prisma.Decimal;
  }) {
    return prisma.returnRequest.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        vendorId: data.vendorId,
        reason: data.reason,
        details: data.details,
        evidenceUrls: data.evidenceUrls || [],
        items: data.items,
        refundAmount: data.refundAmount,
        status: "REQUESTED",
      },
    });
  }

  /**
   * Review return request (Vendor or Admin approval/rejection).
   */
  async updateReturnDecision(
    id: string,
    decision: "APPROVED" | "REJECTED",
    reviewerId: string,
    adminNote?: string
  ) {
    return prisma.returnRequest.update({
      where: { id },
      data: {
        status: decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        adminNote,
      },
    });
  }

  /**
   * Escalate or raise dispute on return request.
   */
  async disputeReturnRequest(id: string, disputeNotes: string) {
    return prisma.returnRequest.update({
      where: { id },
      data: {
        isDisputed: true,
        disputeNotes,
        status: "UNDER_REVIEW",
      },
    });
  }

  /**
   * Creates an initial pending Refund record.
   */
  async createPendingRefund(data: {
    paymentId: string;
    returnRequestId?: string;
    paystackRef: string;
    amount: Prisma.Decimal;
    currency?: string;
    reason?: string;
  }) {
    return prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        returnRequestId: data.returnRequestId,
        paystackRef: data.paystackRef,
        amount: data.amount,
        currency: data.currency || "GHS",
        status: "PENDING",
        reason: data.reason,
      },
    });
  }

  /**
   * Executes atomic database update settling an approved refund:
   * - Marks Refund record as PROCESSED
   * - Sets ReturnRequest status to REFUNDED
   * - Proportionately adjusts VendorOrder.vendorEarnings and commissionAmount (conservation)
   * - Updates Order status and paymentStatus (PARTIALLY_REFUNDED or REFUNDED)
   */
  async settleRefundTransaction(params: {
    refundId: string;
    returnRequestId: string;
    orderId: string;
    vendorId?: string;
    refundAmount: Prisma.Decimal;
    gatewayData?: any;
    paystackRefundId?: string;
  }) {
    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Mark the refund record as processed
        const refund = await tx.refund.update({
          where: { id: params.refundId },
          data: {
            status: "PROCESSED",
            paystackRefundId: params.paystackRefundId,
            gatewayResponse: params.gatewayData,
            processedAt: new Date(),
          },
        });

        // 2. Mark ReturnRequest as REFUNDED
        await tx.returnRequest.update({
          where: { id: params.returnRequestId },
          data: { status: "REFUNDED" },
        });

        // 3. Adjust VendorOrder financial split if linked to vendor
        if (params.vendorId) {
          const vOrder = await tx.vendorOrder.findFirst({
            where: { orderId: params.orderId, vendorId: params.vendorId },
          });

          if (vOrder && Number(vOrder.subtotal) > 0) {
            // Deduct refunded amount proportionately from subtotal and vendor earnings
            const refundDec = params.refundAmount;
            const newSubtotal = Prisma.Decimal.max(0, Prisma.Decimal.sub(vOrder.subtotal, refundDec));
            const ratio = Number(vOrder.subtotal) > 0 ? Number(newSubtotal) / Number(vOrder.subtotal) : 0;
            const newEarnings = Prisma.Decimal.mul(vOrder.vendorEarnings, ratio);
            const newCommission = Prisma.Decimal.sub(newSubtotal, newEarnings);

            await tx.vendorOrder.update({
              where: { id: vOrder.id },
              data: {
                subtotal: newSubtotal,
                vendorEarnings: newEarnings,
                commissionAmount: newCommission,
              },
            });
          }
        }

        // 4. Check if total refunded covers order total to update paymentStatus
        const allProcessedRefunds = await tx.refund.findMany({
          where: {
            payment: { orderId: params.orderId },
            status: "PROCESSED",
          },
          select: { amount: true },
        });

        const totalRefunded = allProcessedRefunds.reduce(
          (acc, r) => Prisma.Decimal.add(acc, r.amount),
          new Prisma.Decimal(0)
        );

        const order = await tx.order.findUnique({
          where: { id: params.orderId },
          select: { total: true },
        });

        const isFullRefund = order && totalRefunded.gte(order.total);

        await tx.order.update({
          where: { id: params.orderId },
          data: {
            paymentStatus: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
            status: isFullRefund ? "REFUNDED" : undefined,
          },
        });

        return refund;
      },
      {
        maxWait: 10000,
        timeout: 25000,
      }
    );
  }
}
