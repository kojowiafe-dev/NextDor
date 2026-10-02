/**
 * Order Service — Domain Business Logic for Checkout & Order Management.
 *
 * DESIGN PATTERN: Domain Service (Clean Architecture Use Case Layer)
 * ──────────────────────────────────────────────────────────────────
 * This class owns all checkout business rules:
 * - Cart validation (stock, availability)
 * - Price snapshot calculation using the Money value object
 * - Multi-vendor sub-order splitting via CommissionCalculator
 * - Status transition enforcement (e.g. can't cancel a delivered order)
 *
 * WHAT IF: Two customers buy the last item simultaneously?
 * The `placeOrder` transaction uses `updateMany` with a stock guard
 * (`stockQty >= quantity`). If stock reaches 0 between load and write,
 * the updateMany matches 0 rows. The service treats this as a conflict
 * and raises an UnprocessableError — one buyer wins, one gets a clear error.
 */

import { prisma } from "../../lib/prisma.js";
import { OrderRepository } from "./order.repository.js";
import { Money } from "../../domain/Money.js";
import { CommissionCalculator } from "../../domain/CommissionCalculator.js";
import { logger } from "../../lib/logger.js";
import {
  NotFoundError,
  BadRequestError,
  UnprocessableError,
  ForbiddenError,
  UnauthorizedError,
} from "../../lib/errors.js";
import { Prisma } from "@prisma/client";
import type { OrderStatus, VendorOrderStatus, DeliveryMethod } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartItem = {
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
  slug?: string;
  image?: string;
};

export type CheckoutInput = {
  userId?: string;
  guestEmail?: string;
  cart: CartItem[];
  shippingAddress: {
    label?: string;
    street: string;
    city: string;
    region: string;
    recipientName?: string;
    recipientPhone?: string;
  };
  addressId?: string;
  deliveryMethod?: DeliveryMethod;
  notes?: string;
  couponId?: string;
};

// Delivery fee schedule (GHS) — Phase 2: pull from a delivery zone config table
const DELIVERY_FEES: Record<DeliveryMethod, number> = {
  STANDARD: 25.0,
  EXPRESS: 50.0,
  PICKUP: 0.0,
};

// ─── Allowed status transitions ───────────────────────────────────────────────
// Guards against illegal state jumps (e.g. DELIVERED → PENDING is nonsensical).

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:     ["CONFIRMED", "CANCELLED"],
  CONFIRMED:   ["PROCESSING", "CANCELLED"],
  PROCESSING:  ["SHIPPED", "CANCELLED"],
  SHIPPED:     ["DELIVERED"],
  DELIVERED:   ["REFUNDED"],
  CANCELLED:   [],
  REFUNDED:    [],
};

const ALLOWED_VENDOR_TRANSITIONS: Partial<Record<VendorOrderStatus, VendorOrderStatus[]>> = {
  PENDING:    ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED:    ["DELIVERED"],
  DELIVERED:  [],
  CANCELLED:  [],
};

// ─── Order Service ────────────────────────────────────────────────────────────

export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  /**
   * Checkout — validates cart, snapshots prices, splits by vendor, persists.
   */
  async checkout(input: CheckoutInput) {
    const deliveryMethod = input.deliveryMethod ?? "STANDARD";

    if (!input.cart || input.cart.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

    if (!input.userId) {
      throw new UnauthorizedError("You must be signed in to complete checkout.");
    }
    const finalUserId = input.userId;

    // ── Find products in database (by UUID, WooCommerce wcId, or slug) ────────
    const productIdentifiers = input.cart.map((i) => i.productId);
    let products = await this.repo.findProductsForCheckout(productIdentifiers);

    // If any item was not found in PostgreSQL (e.g. from live WooCommerce catalog)
    // auto-upsert a database record under the flagship vendor
    let flagshipVendorId: string | null = null;
    for (const cartItem of input.cart) {
      let product = products.find(
        (p: any) =>
          p.id === cartItem.productId ||
          (p.wcId !== null && String(p.wcId) === String(cartItem.productId)) ||
          p.slug === cartItem.productId,
      );

      if (!product) {
        if (!flagshipVendorId) {
          const flagship = await prisma.vendor.findFirst({
            where: { slug: "nextdor" },
            select: { id: true },
          });
          flagshipVendorId = flagship?.id ?? null;
        }

        const numericWcId = Number(cartItem.productId);
        const isNumeric = !isNaN(numericWcId) && Number.isInteger(numericWcId) && numericWcId > 0;
        const fallbackSlug = cartItem.slug || (isNumeric ? `wc-product-${numericWcId}` : `product-${Date.now()}`);
        const fallbackName = cartItem.name || (isNumeric ? `Catalog Item #${numericWcId}` : `Product #${cartItem.productId}`);
        const fallbackPrice = cartItem.price && cartItem.price > 0 ? cartItem.price : 50;

        const created = await prisma.product.upsert({
          where: isNumeric ? { wcId: numericWcId } : { slug: fallbackSlug },
          update: {},
          create: {
            wcId: isNumeric ? numericWcId : undefined,
            slug: fallbackSlug,
            name: fallbackName,
            description: fallbackName,
            price: fallbackPrice,
            currency: "GHS",
            stockStatus: "IN_STOCK",
            vendorId: flagshipVendorId,
            images: cartItem.image
              ? { create: [{ url: cartItem.image, alt: fallbackName }] }
              : undefined,
          },
          include: {
            images: { take: 1, orderBy: { sortOrder: "asc" } },
            vendor: { select: { id: true, commissionRate: true, status: true } },
          },
        });

        products.push(created);
      }
    }

    // ── Validate each cart item ──────────────────────────────────────────────
    const enrichedItems = input.cart.map((cartItem) => {
      const product = products.find(
        (p: { id: string; [key: string]: any }) =>
          p.id === cartItem.productId ||
          (p.wcId !== null && String(p.wcId) === String(cartItem.productId)) ||
          p.slug === cartItem.productId,
      );

      if (!product) {
        throw new NotFoundError(`Product ${cartItem.productId}`);
      }

      if (product.stockStatus === "OUT_OF_STOCK") {
        throw new UnprocessableError(
          `"${product.name}" is out of stock`,
          { productId: product.id },
        );
      }

      if (product.stockQty !== null && product.stockQty < cartItem.quantity) {
        throw new UnprocessableError(
          `Only ${product.stockQty} unit(s) of "${product.name}" available`,
          { productId: product.id, available: product.stockQty },
        );
      }

      if (product.vendor && product.vendor.status !== "ACTIVE") {
        throw new UnprocessableError(
          `Vendor store for "${product.name}" is currently inactive`,
        );
      }

      // Snapshot the price at checkout time (use salePrice if active)
      const activePrice = product.salePrice ?? product.price;
      const unitPrice = Money.fromMajor(activePrice);
      const subtotal = unitPrice.multiply(cartItem.quantity);

      return {
        productId: product.id, // always the real UUID primary key
        vendorId: product.vendorId,
        productName: product.name,
        productImage: product.images[0]?.url ?? cartItem.image ?? null,
        unitPrice: unitPrice.toDecimal(),
        quantity: cartItem.quantity,
        subtotal: subtotal.toDecimal(),
        // Keep Money instances for aggregation
        _unitPriceMoney: unitPrice,
        _subtotalMoney: subtotal,
        _commissionRatePercent: Number(product.vendor?.commissionRate ?? 10),
      };
    });

    // ── Aggregate totals ────────────────────────────────────────────────────
    const itemsSubtotal = enrichedItems.reduce(
      (acc, item) => acc.add(item._subtotalMoney),
      Money.zero(),
    );

    const deliveryFee = Money.fromMajor(DELIVERY_FEES[deliveryMethod]);
    const discount = Money.zero(); // Phase 2: apply coupon discount here
    const total = itemsSubtotal.add(deliveryFee).subtract(discount);

    // ── Build per-vendor breakdown using CommissionCalculator ────────────────
    // Group items by vendorId
    const vendorGroups = new Map<string, typeof enrichedItems>();
    for (const item of enrichedItems) {
      const vid = item.vendorId ?? "nextdor"; // fallback to platform store
      if (!vendorGroups.has(vid)) vendorGroups.set(vid, []);
      vendorGroups.get(vid)!.push(item);
    }

    const vendorBreakdown = Array.from(vendorGroups.entries()).map(
      ([vendorId, items]) => {
        const vendorSubtotal = items.reduce(
          (acc, i) => acc.add(i._subtotalMoney),
          Money.zero(),
        );
        // All items from same vendor share the same commission rate
        const commissionRate = items[0]._commissionRatePercent;
        const calculator = new CommissionCalculator(commissionRate);
        const split = calculator.calculateSplit(vendorSubtotal);

        return {
          vendorId,
          subtotal: split.subtotal.toDecimal(),
          commissionAmount: split.platformFee.toDecimal(),
          vendorEarnings: split.vendorNet.toDecimal(),
        };
      },
    );

    // ── Persist order ──────────────────────────────────────────────────────
    const order = await this.repo.placeOrder({
      userId: finalUserId,
      addressId: input.addressId,
      shippingAddress: input.shippingAddress,
      deliveryMethod,
      notes: input.notes,
      couponId: input.couponId,
      items: enrichedItems,
      vendorBreakdown,
      subtotal: itemsSubtotal.toDecimal(),
      deliveryFee: deliveryFee.toDecimal(),
      discount: discount.toDecimal(),
      total: total.toDecimal(),
    });

    logger.info(
      { orderId: order.id, number: order.number, userId: finalUserId, total: total.format() },
      "order: checkout completed",
    );

    return order;
  }

  /**
   * Returns a paginated list of orders for the authenticated customer.
   */
  async getMyOrders(userId: string, page = 1, limit = 10) {
    return this.repo.findByUserId(userId, page, limit);
  }

  /**
   * Returns full order detail including timeline — for customer or admin.
   * `userId` is required for customer access; omit for admin bypass.
   */
  async getOrderByNumber(number: string, userId?: string) {
    const order = await this.repo.findByNumber(number, userId);

    if (!order) {
      throw new NotFoundError(`Order ${number}`);
    }

    return order;
  }

  /**
   * Customer cancellation — only allowed from PENDING or CONFIRMED states.
   */
  async cancelOrder(number: string, userId: string) {
    const order = await this.repo.findByNumber(number, userId);

    if (!order) throw new NotFoundError(`Order ${number}`);

    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      throw new UnprocessableError(
        `Cannot cancel an order in ${order.status} status`,
      );
    }

    return this.repo.updateStatus(
      order.id,
      "CANCELLED",
      "Cancelled by customer",
      userId,
    );
  }

  /**
   * Admin: update master order status with transition validation.
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    note: string | undefined,
    adminId: string,
  ) {
    const order = await this.repo.findByNumber(orderId);

    if (!order) throw new NotFoundError("Order");

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new UnprocessableError(
        `Cannot transition order from ${order.status} → ${newStatus}`,
      );
    }

    return this.repo.updateStatus(order.id, newStatus, note, adminId);
  }

  /**
   * Admin: list all orders.
   */
  async getAllOrders(opts: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    userId?: string;
  }) {
    return this.repo.findAll(opts);
  }

  /**
   * Vendor: list their sub-orders (VendorOrders).
   */
  async getVendorOrders(vendorId: string, page = 1, limit = 20) {
    return this.repo.findVendorOrders(vendorId, page, limit);
  }

  /**
   * Vendor: update the fulfillment status of their VendorOrder.
   * Enforces: (1) ownership check, (2) allowed transition guard.
   */
  async updateVendorOrderStatus(
    vendorOrderId: string,
    newStatus: VendorOrderStatus,
    requestingVendorId: string,
  ) {
    const vendorOrder = await this.repo.findVendorOrderById(vendorOrderId);

    if (!vendorOrder) throw new NotFoundError("VendorOrder");

    if (vendorOrder.vendorId !== requestingVendorId) {
      throw new ForbiddenError("You can only update your own vendor orders");
    }

    const allowed = ALLOWED_VENDOR_TRANSITIONS[vendorOrder.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new UnprocessableError(
        `Cannot transition vendor order from ${vendorOrder.status} → ${newStatus}`,
      );
    }

    return this.repo.updateVendorOrderStatus(vendorOrderId, newStatus);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const orderService = new OrderService(new OrderRepository());
