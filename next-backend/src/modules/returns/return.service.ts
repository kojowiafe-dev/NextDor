import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "../../lib/errors.js";
import { ReturnRepository } from "./return.repository.js";
import { Money } from "../../domain/Money.js";
import { toPesewas } from "../payments/paystack.js";
import type { AuthUser } from "../../lib/auth.guards.js";
import type {
  CreateReturnRequestInput,
  ReviewReturnRequestInput,
  DisputeReturnRequestInput,
} from "@nextdor/shared";
import { dispatchEmailAsync } from "../../lib/email.queue.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const isProduction = config.NODE_ENV === "production";

export class ReturnService {
  constructor(private readonly repo: ReturnRepository = new ReturnRepository()) {}

  /**
   * Request a return for a delivered order within the 48-hour escrow window.
   */
  async requestReturn(orderNumber: string, input: CreateReturnRequestInput, caller: AuthUser) {
    const order = await this.repo.findOrderForReturn(orderNumber);
    if (!order) throw new NotFoundError(`Order ${orderNumber}`);

    // Must be customer who owns order or admin
    if (caller.role === "CUSTOMER" && order.userId && order.userId !== caller.userId) {
      throw new ForbiddenError("You can only request returns for your own orders.");
    }

    if (order.status !== "DELIVERED") {
      throw new UnprocessableError(
        `Returns can only be requested for DELIVERED orders. Current order status: ${order.status}`
      );
    }

    // Check 48h escrow window
    const orderDeliveredHistory = await this.getDeliveredTimestamp(order.id);
    const deliveredAt = orderDeliveredHistory || order.updatedAt;
    const hoursSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60);

    if (hoursSinceDelivery > 48) {
      throw new UnprocessableError(
        "The 48-hour buyer protection return window for this order has expired."
      );
    }

    // Validate returned items exist in the order and compute refund amount
    let totalRefundMinor = 0;
    const validatedItems: any[] = [];
    let singleVendorId: string | undefined = undefined;

    for (const itemInput of input.items) {
      const orderItem = order.items.find((i) => i.id === itemInput.orderItemId);
      if (!orderItem) {
        throw new BadRequestError(`Item ${itemInput.orderItemId} is not part of order ${orderNumber}`);
      }
      if (itemInput.quantity > orderItem.quantity) {
        throw new BadRequestError(
          `Requested return quantity (${itemInput.quantity}) exceeds ordered quantity (${orderItem.quantity}) for "${orderItem.productName}"`
        );
      }

      if (orderItem.vendorId) {
        if (!singleVendorId) singleVendorId = orderItem.vendorId;
        else if (singleVendorId !== orderItem.vendorId) {
          throw new BadRequestError(
            "Please submit separate return requests for items belonging to different merchants."
          );
        }
      }

      const unitPriceMoney = Money.fromMajor(orderItem.unitPrice);
      const itemRefundMinor = unitPriceMoney.toMinor() * itemInput.quantity;
      totalRefundMinor += itemRefundMinor;

      validatedItems.push({
        orderItemId: orderItem.id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity: itemInput.quantity,
        unitPrice: Number(orderItem.unitPrice),
        refundAmount: (itemRefundMinor / 100).toFixed(2),
      });
    }

    const refundAmountDecimal = new Prisma.Decimal(totalRefundMinor / 100);

    const returnRequest = await this.repo.createReturnRequest({
      orderId: order.id,
      userId: caller.userId,
      vendorId: singleVendorId,
      reason: input.reason,
      details: input.details,
      evidenceUrls: input.evidenceUrls,
      items: validatedItems,
      refundAmount: refundAmountDecimal,
    });

    logger.info(
      { returnId: returnRequest.id, orderNumber, refundAmount: totalRefundMinor / 100 },
      "Return request created successfully"
    );

    // Asynchronously dispatch confirmation email to customer
    const customerEmail = order.user?.email || order.guestEmail;
    if (customerEmail) {
      const shipAddr = (order.shippingAddress as any) || {};
      const customerName = shipAddr.recipientName || order.user?.name || "Valued Customer";
      dispatchEmailAsync({
        type: "return_request_submitted",
        params: {
          email: customerEmail,
          customerName,
          orderNumber,
          returnId: returnRequest.id,
          refundAmount: Number(totalRefundMinor / 100),
          items: validatedItems.map((i: any) => ({
            productName: i.productName,
            quantity: i.quantity,
          })),
          reason: input.reason,
        },
      }).catch((err) =>
        logger.warn({ err, returnId: returnRequest.id }, "Failed to queue return confirmation email")
      );
    }

    return returnRequest;
  }

  /**
   * Merchant or Admin review of return claim.
   */
  async reviewReturn(returnId: string, input: ReviewReturnRequestInput, caller: AuthUser) {
    const returnRequest = await this.repo.findReturnRequestById(returnId);
    if (!returnRequest) throw new NotFoundError(`Return request ${returnId}`);

    if (caller.role === "VENDOR_OWNER" || caller.role === "VENDOR_STAFF") {
      if (!caller.vendorId || caller.vendorId !== returnRequest.vendorId) {
        throw new ForbiddenError("You can only review return claims for your own store.");
      }
    }

    if (returnRequest.status === "REFUNDED") {
      throw new UnprocessableError("This return request has already been settled and refunded.");
    }

    const updated = await this.repo.updateReturnDecision(
      returnId,
      input.decision,
      caller.userId,
      input.note
    );

    if (input.decision === "APPROVED") {
      await this.processRefund(returnId, caller);
    }

    return updated;
  }

  /**
   * Raise a dispute on return claim (escalate to super-admin).
   */
  async disputeReturn(returnId: string, input: DisputeReturnRequestInput, caller: AuthUser) {
    const returnRequest = await this.repo.findReturnRequestById(returnId);
    if (!returnRequest) throw new NotFoundError(`Return request ${returnId}`);

    if (caller.role === "CUSTOMER" && returnRequest.userId !== caller.userId) {
      throw new ForbiddenError("You can only dispute your own return requests.");
    }
    if ((caller.role === "VENDOR_OWNER" || caller.role === "VENDOR_STAFF") && returnRequest.vendorId !== caller.vendorId) {
      throw new ForbiddenError("You can only dispute return requests for your store.");
    }

    const disputed = await this.repo.disputeReturnRequest(returnId, input.disputeNotes);

    // Asynchronously alert customer of dispute escalation
    const customerEmail = returnRequest.order?.user?.email || returnRequest.order?.guestEmail;
    if (customerEmail) {
      const shipAddr = (returnRequest.order?.shippingAddress as any) || {};
      const customerName = shipAddr.recipientName || returnRequest.order?.user?.name || "Valued Customer";
      dispatchEmailAsync({
        type: "return_disputed",
        params: {
          email: customerEmail,
          customerName,
          orderNumber: returnRequest.order.number,
          returnId: returnRequest.id,
          disputeNotes: input.disputeNotes,
        },
      }).catch((err) =>
        logger.warn({ err, returnId }, "Failed to queue return dispute email")
      );
    }

    return disputed;
  }

  /**
   * Processes Paystack refund for an approved return request.
   */
  async processRefund(returnId: string, caller: AuthUser) {
    const returnRequest = await this.repo.findReturnRequestById(returnId);
    if (!returnRequest) throw new NotFoundError(`Return request ${returnId}`);

    if (returnRequest.status !== "APPROVED") {
      throw new UnprocessableError(
        `Only APPROVED return requests can be refunded. Current status: ${returnRequest.status}`
      );
    }

    let successfulPayment = returnRequest.order.payments[0];
    const notesLower = (returnRequest.order.notes || "").toLowerCase();
    const isCod =
      notesLower.includes("payment method: cod") ||
      notesLower.includes("cash on delivery") ||
      notesLower.includes("cod");

    if (!successfulPayment) {
      if (isCod && returnRequest.order.paymentStatus === "PAID") {
        successfulPayment = await prisma.payment.create({
          data: {
            orderId: returnRequest.orderId,
            paystackRef: `COD-${returnRequest.order.number}-${Date.now()}`,
            amount: returnRequest.order.total,
            method: "MOMO",
            status: "SUCCESS",
            paidAt: returnRequest.order.updatedAt,
            metadata: { method: "CASH_ON_DELIVERY", settledBy: "COURIER_COLLECTION" },
          },
        });
      } else {
        throw new UnprocessableError("No successful payment record found to execute refund against.");
      }
    }

    const refundAmountPesewas = toPesewas(returnRequest.refundAmount);

    const pendingRefund = await this.repo.createPendingRefund({
      paymentId: successfulPayment.id,
      returnRequestId: returnRequest.id,
      paystackRef: successfulPayment.paystackRef,
      amount: returnRequest.refundAmount,
      reason: `Return refund for order ${returnRequest.order.number}`,
    });

    let gatewayRefundData: any = null;
    if (isCod || successfulPayment.paystackRef.startsWith("COD-")) {
      gatewayRefundData = {
        id: `cod_refund_${Date.now()}`,
        status: "processed",
        amount: refundAmountPesewas,
        currency: "GHS",
        note: "Cash on delivery return refund settled directly via Mobile Money",
      };
      logger.info({ returnId, orderNumber: returnRequest.order.number }, "Cash on Delivery return refund recorded");
    } else {
      try {
        const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: successfulPayment.paystackRef,
            amount: refundAmountPesewas,
            currency: "GHS",
            merchant_note: `Approved Return #${returnRequest.id}`,
          }),
        });

        const body = (await res.json()) as any;
        if (body.status && body.data) {
          gatewayRefundData = body.data;
        } else {
          logger.warn({ returnId, message: body.message }, "Paystack refund response rejected");
        }
      } catch (err) {
        logger.error({ err, returnId }, "Paystack refund network request failed");
      }
    }

    if (!gatewayRefundData && !isProduction) {
      gatewayRefundData = {
        id: `mock_rf_${Date.now()}`,
        status: "processed",
        amount: refundAmountPesewas,
        currency: "GHS",
      };
      logger.info({ returnId }, "Development mock sandbox refund accepted");
    }

    if (!gatewayRefundData) {
      throw new AppError(502, "REFUND_GATEWAY_ERROR", "Payment gateway could not process refund.");
    }

    const settled = await this.repo.settleRefundTransaction({
      refundId: pendingRefund.id,
      returnRequestId: returnRequest.id,
      orderId: returnRequest.orderId,
      vendorId: returnRequest.vendorId || undefined,
      refundAmount: returnRequest.refundAmount,
      gatewayData: gatewayRefundData,
      paystackRefundId: gatewayRefundData.id ? String(gatewayRefundData.id) : undefined,
    });

    logger.info(
      { returnId, refundId: settled.id, amount: returnRequest.refundAmount },
      "Refund processed and settled successfully"
    );

    // Asynchronously dispatch refund settled email to customer
    const customerEmail = returnRequest.order?.user?.email || returnRequest.order?.guestEmail;
    if (customerEmail) {
      const shipAddr = (returnRequest.order?.shippingAddress as any) || {};
      const customerName = shipAddr.recipientName || returnRequest.order?.user?.name || "Valued Customer";
      dispatchEmailAsync({
        type: "refund_processed",
        params: {
          email: customerEmail,
          customerName,
          orderNumber: returnRequest.order.number,
          returnId: returnRequest.id,
          refundAmount: Number(returnRequest.refundAmount),
          paymentChannel: successfulPayment.method || "MOMO",
          paystackRefundId: gatewayRefundData.id ? String(gatewayRefundData.id) : undefined,
        },
      }).catch((err) =>
        logger.warn({ err, returnId }, "Failed to queue refund processed email")
      );
    }

    return settled;
  }

  private async getDeliveredTimestamp(orderId: string): Promise<Date | null> {
    const { prisma } = await import("../../lib/prisma.js");
    const statusEntry = await prisma.orderStatusHistory.findFirst({
      where: { orderId, status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
    });
    return statusEntry?.createdAt || null;
  }

  async getCustomerReturns(userId: string, page = 1, limit = 20) {
    return this.repo.findCustomerReturns(userId, page, limit);
  }

  async getVendorReturns(vendorId: string, page = 1, limit = 20, status?: string) {
    return this.repo.findVendorReturns(vendorId, page, limit, status as any);
  }

  async getAdminReturns(page = 1, limit = 20, status?: string, isDisputed?: boolean) {
    return this.repo.findAdminReturns(page, limit, status as any, isDisputed);
  }

  async getReturnDetail(id: string, caller: AuthUser) {
    const ret = await this.repo.findReturnRequestById(id);
    if (!ret) throw new NotFoundError(`Return request ${id}`);

    if (caller.role === "CUSTOMER" && ret.userId !== caller.userId) {
      throw new ForbiddenError("You cannot view this return request.");
    }
    if ((caller.role === "VENDOR_OWNER" || caller.role === "VENDOR_STAFF") && ret.vendorId !== caller.vendorId) {
      throw new ForbiddenError("You cannot view returns for other vendors.");
    }

    return ret;
  }
}

export const returnService = new ReturnService();
