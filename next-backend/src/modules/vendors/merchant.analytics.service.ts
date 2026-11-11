import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";

export class MerchantAnalyticsService {
  /**
   * Generates performance KPIs and fulfillment metrics for a specific merchant.
   */
  async getVendorMetrics(vendorId: string, timeRange = "30d") {
    const now = new Date();
    let startDate: Date | undefined;

    if (timeRange === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const dateFilter: Prisma.DateTimeFilter = startDate ? { gte: startDate } : {};

    // 1. Vendor sub-orders within time range (excluding refunded parent orders)
    const orders = await prisma.vendorOrder.findMany({
      where: {
        vendorId,
        createdAt: dateFilter,
      },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            guestEmail: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const nonCancelledOrders = orders.filter(
      (o) =>
        o.status !== "CANCELLED" &&
        o.order.status !== "CANCELLED" &&
        o.order.status !== "REFUNDED" &&
        o.order.paymentStatus !== "REFUNDED" &&
        o.order.paymentStatus !== "FAILED"
    );
    const deliveredOrders = nonCancelledOrders.filter((o) => o.status === "DELIVERED");

    // GMV & Net Earnings
    const gmv = nonCancelledOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const netEarnings = nonCancelledOrders.reduce((sum, o) => sum + Number(o.vendorEarnings), 0);
    const totalOrders = nonCancelledOrders.length;
    const aov = totalOrders > 0 ? Number((gmv / totalOrders).toFixed(2)) : 0;

    // Repeat customer rate
    const customerIdentifierMap = new Map<string, number>();
    for (const o of nonCancelledOrders) {
      const custKey = o.order.userId || o.order.guestEmail || "guest";
      customerIdentifierMap.set(custKey, (customerIdentifierMap.get(custKey) || 0) + 1);
    }
    const uniqueCustomersCount = customerIdentifierMap.size;
    const repeatCustomersCount = Array.from(customerIdentifierMap.values()).filter(
      (count) => count > 1
    ).length;
    const repeatCustomerRate =
      uniqueCustomersCount > 0
        ? Number(((repeatCustomersCount / uniqueCustomersCount) * 100).toFixed(1))
        : 0;

    // Return requests
    const returnCount = await prisma.returnRequest.count({
      where: {
        vendorId,
        createdAt: dateFilter,
        status: { in: ["APPROVED", "REFUNDED"] },
      },
    });

    const returnRate =
      deliveredOrders.length > 0
        ? Number(((returnCount / deliveredOrders.length) * 100).toFixed(1))
        : 0;

    // Average fulfillment velocity in hours (from order placement to delivery)
    let totalFulfillmentHours = 0;
    let fulfilledWithTimeCount = 0;

    for (const o of deliveredOrders) {
      const startMs = new Date(o.order.createdAt).getTime();
      const endMs = new Date(o.updatedAt).getTime();
      const elapsedHours = (endMs - startMs) / (1000 * 60 * 60);
      if (elapsedHours > 0) {
        totalFulfillmentHours += elapsedHours;
        fulfilledWithTimeCount++;
      }
    }

    const avgFulfillmentHours =
      fulfilledWithTimeCount > 0
        ? Number((totalFulfillmentHours / fulfilledWithTimeCount).toFixed(1))
        : 0;

    // 2. Top products sold by this vendor
    const orderItems = await prisma.orderItem.findMany({
      where: {
        vendorId,
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
          createdAt: dateFilter,
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        subtotal: true,
        productImage: true,
        product: {
          select: { slug: true },
        },
      },
    });

    const productAggMap = new Map<
      string,
      {
        productId: string;
        name: string;
        slug: string;
        quantity: number;
        revenue: number;
        image?: string | null;
      }
    >();
    for (const item of orderItems) {
      const existing = productAggMap.get(item.productName) || {
        productId: item.productId,
        name: item.productName,
        slug: item.product?.slug || "",
        quantity: 0,
        revenue: 0,
        image: item.productImage,
      };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.subtotal);
      productAggMap.set(item.productName, existing);
    }

    const topProducts = Array.from(productAggMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => {
        const rev = Number(p.revenue.toFixed(2));
        return {
          productId: p.productId,
          name: p.name,
          slug: p.slug,
          quantity: p.quantity,
          totalQuantitySold: p.quantity,
          revenue: rev,
          totalRevenue: rev,
          image: p.image,
        };
      });

    // 3. Status distribution
    const statusCounts = {
      pending: orders.filter((o) => o.status === "PENDING").length,
      processing: orders.filter((o) => o.status === "PROCESSING").length,
      shipped: orders.filter((o) => o.status === "SHIPPED").length,
      delivered: deliveredOrders.length,
      cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    };

    return {
      timeRange,
      kpis: {
        grossMerchandiseValue: Number(gmv.toFixed(2)),
        netMerchantEarnings: Number(netEarnings.toFixed(2)),
        totalOrders,
        averageOrderValue: aov,
        deliveredOrdersCount: deliveredOrders.length,
        repeatCustomerRatePercent: repeatCustomerRate,
        returnCount,
        returnRatePercent: returnRate,
        avgFulfillmentHours,
      },
      topProducts,
      statusDistribution: statusCounts,
    };
  }

  /**
   * Super-Admin benchmark comparing all merchants across GMV, AOV, and return rates.
   */
  async getAdminMerchantLeaderboard(limit = 10) {
    const vendors = await prisma.vendor.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        commissionRate: true,
      },
      take: limit,
    });

    const benchmark = await Promise.all(
      vendors.map(async (v) => {
        const metrics = await this.getVendorMetrics(v.id, "30d");
        return {
          vendorId: v.id,
          vendorName: v.name,
          slug: v.slug,
          logoUrl: v.logoUrl,
          commissionRate: Number(v.commissionRate),
          kpis: metrics.kpis,
          topProduct: metrics.topProducts[0]
            ? {
                productId: metrics.topProducts[0].productId,
                name: metrics.topProducts[0].name,
                slug: metrics.topProducts[0].slug,
                totalQuantitySold: metrics.topProducts[0].totalQuantitySold,
                totalRevenue: metrics.topProducts[0].totalRevenue,
              }
            : null,
        };
      })
    );

    const leaderboard = benchmark.sort(
      (a, b) => b.kpis.grossMerchandiseValue - a.kpis.grossMerchandiseValue
    );

    return {
      asOf: new Date().toISOString(),
      merchantsCount: leaderboard.length,
      leaderboard,
    };
  }
}
