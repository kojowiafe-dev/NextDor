import { prisma } from "../../lib/prisma.js";

export class AdminAnalyticsService {
  async getOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Fetch orders in the last 30 days
    const recentOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    // Bucket into 30 days
    const revenueBuckets = new Array(30).fill(0);
    for (const order of recentOrders) {
      if (
        order.status !== "CANCELLED" &&
        order.status !== "REFUNDED" &&
        order.paymentStatus !== "REFUNDED" &&
        order.paymentStatus !== "FAILED"
      ) {
        const diffDays = Math.floor(
          (now.getTime() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        );
        const index = 29 - Math.min(29, Math.max(0, diffDays));
        revenueBuckets[index] += Number(order.total);
      }
    }

    const last7DaysRevenue = revenueBuckets.slice(23, 30).reduce((s, v) => s + v, 0);
    const prev7DaysRevenue = revenueBuckets.slice(16, 23).reduce((s, v) => s + v, 0);
    const weeklyGrowthPercent =
      prev7DaysRevenue > 0
        ? Number((((last7DaysRevenue - prev7DaysRevenue) / prev7DaysRevenue) * 100).toFixed(1))
        : last7DaysRevenue > 0
        ? 100
        : 0;

    // 2. Orders by status
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const ordersByStatus = {
      placed: 0,
      accepted: 0,
      dispatched: 0,
      delivered_verified: 0,
      completed: 0,
      cancelled: 0,
      disputed: 0,
      delivered: 0,
      shipped: 0,
      processing: 0,
      pending: 0,
      confirmed: 0,
    };

    for (const sc of statusCounts) {
      const key = sc.status.toLowerCase() as keyof typeof ordersByStatus;
      if (key in ordersByStatus) {
        ordersByStatus[key] = sc._count.id;
      }
      if (sc.status === "DELIVERED_VERIFIED" || sc.status === "COMPLETED") {
        ordersByStatus.delivered += sc._count.id;
      } else if (sc.status === "DISPATCHED") {
        ordersByStatus.shipped += sc._count.id;
      } else if (sc.status === "ACCEPTED") {
        ordersByStatus.processing += sc._count.id;
      } else if (sc.status === "PLACED") {
        ordersByStatus.pending += sc._count.id;
      }
    }

    // 3. Top products by revenue (excluding CANCELLED, REFUNDED, and FAILED orders)
    const validOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
        },
      },
      select: {
        productName: true,
        subtotal: true,
        quantity: true,
      },
    });

    const productMap = new Map<string, { revenue: number; quantity: number }>();
    for (const item of validOrderItems) {
      const existing = productMap.get(item.productName) || { revenue: 0, quantity: 0 };
      existing.revenue += Number(item.subtotal);
      existing.quantity += item.quantity;
      productMap.set(item.productName, existing);
    }

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, revenue: data.revenue, quantity: data.quantity }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 4. Sales by category (excluding CANCELLED, REFUNDED, and FAILED orders)
    const categoriesWithSales = await prisma.category.findMany({
      select: {
        name: true,
        products: {
          select: {
            orderItems: {
              where: {
                order: {
                  status: { notIn: ["CANCELLED", "REFUNDED"] },
                  paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
                },
              },
              select: {
                subtotal: true,
              },
            },
          },
        },
      },
    });

    const salesByCategory = categoriesWithSales
      .map((cat) => {
        let revenue = 0;
        for (const prod of cat.products) {
          for (const item of prod.orderItems) {
            revenue += Number(item.subtotal);
          }
        }
        return { name: cat.name, revenue };
      })
      .filter((cat) => cat.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // 5. Authoritative financial & operational aggregates from database
    const [
      totalCustomers,
      totalCompletedOrders,
      totalProducts,
      gmvAgg,
      commissionAgg,
      escrowPoolAgg,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
      prisma.order.count({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
        },
      }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.order.aggregate({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
        },
        _sum: {
          total: true,
          deliveryFee: true,
          discount: true,
        },
      }),
      prisma.vendorOrder.aggregate({
        where: {
          status: { not: "CANCELLED" },
          order: {
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            paymentStatus: { notIn: ["REFUNDED", "FAILED"] },
          },
        },
        _sum: {
          commissionAmount: true,
        },
      }),
      prisma.vendorOrder.aggregate({
        where: {
          status: { not: "CANCELLED" },
          payoutId: null,
          fundsStatus: { in: ["PENDING_FULFILLMENT", "ESCROW", "AVAILABLE"] },
          order: {
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            paymentStatus: "PAID",
          },
        },
        _sum: {
          vendorEarnings: true,
        },
      }),
    ]);

    const conversionRate =
      totalCustomers > 0
        ? `${((totalCompletedOrders / totalCustomers) * 100).toFixed(1)}%`
        : "0.0%";

    const validRecentOrders = recentOrders.filter(
      (o) =>
        o.status !== "CANCELLED" &&
        o.status !== "REFUNDED" &&
        o.paymentStatus !== "REFUNDED" &&
        o.paymentStatus !== "FAILED",
    );

    const grossMerchandiseValue = Number(gmvAgg._sum.total || 0);
    const totalCommission = Number(commissionAgg._sum.commissionAmount || 0);
    const totalDeliveryFee = Number(gmvAgg._sum.deliveryFee || 0);
    const totalDiscount = Number(gmvAgg._sum.discount || 0);
    const platformRevenue = Math.max(0, Number((totalCommission + totalDeliveryFee - totalDiscount).toFixed(2)));
    const escrowPool = Number(escrowPoolAgg._sum.vendorEarnings || 0);

    return {
      revenueData: revenueBuckets,
      ordersByStatus,
      topProducts,
      salesByCategory,
      conversionRate,
      metrics: {
        totalOrders: validRecentOrders.length,
        allTimeOrders: totalCompletedOrders,
        totalRevenue: revenueBuckets.reduce((acc, v) => acc + v, 0),
        grossMerchandiseValue,
        platformRevenue,
        escrowPool,
        weeklyRevenue: revenueBuckets.slice(23, 30),
        weeklyGrowthPercent,
        totalCustomers,
        totalProducts,
      },
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
