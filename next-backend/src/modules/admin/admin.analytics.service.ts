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
        createdAt: true,
      },
    });

    // Bucket into 30 days
    const revenueBuckets = new Array(30).fill(0);
    for (const order of recentOrders) {
      if (order.status !== "CANCELLED" && order.status !== "REFUNDED") {
        const diffDays = Math.floor(
          (now.getTime() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        );
        const index = 29 - Math.min(29, Math.max(0, diffDays));
        revenueBuckets[index] += Number(order.total);
      }
    }

    // 2. Orders by status
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const ordersByStatus = {
      delivered: 0,
      shipped: 0,
      processing: 0,
      cancelled: 0,
      pending: 0,
      confirmed: 0,
    };

    for (const sc of statusCounts) {
      const key = sc.status.toLowerCase() as keyof typeof ordersByStatus;
      if (key in ordersByStatus) {
        ordersByStatus[key] = sc._count.id;
      }
    }

    // 3. Top products by revenue
    const topItems = await prisma.orderItem.groupBy({
      by: ["productName"],
      _sum: {
        subtotal: true,
        quantity: true,
      },
      orderBy: {
        _sum: { subtotal: "desc" },
      },
      take: 5,
    });

    const topProducts = topItems.map((item) => ({
      name: item.productName,
      revenue: Number(item._sum.subtotal ?? 0),
      quantity: item._sum.quantity ?? 0,
    }));

    // 4. Sales by category
    const categoriesWithSales = await prisma.category.findMany({
      take: 6,
      select: {
        name: true,
        products: {
          select: {
            orderItems: {
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
      .filter((cat) => cat.revenue > 0);

    // 5. Total customers and conversion rate
    const [totalCustomers, totalCompletedOrders] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
      prisma.order.count({
        where: {
          status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      }),
    ]);

    const conversionRate =
      totalCustomers > 0
        ? `${((totalCompletedOrders / totalCustomers) * 100).toFixed(1)}%`
        : "0.0%";

    return {
      revenueData: revenueBuckets,
      ordersByStatus,
      topProducts,
      salesByCategory,
      conversionRate,
      metrics: {
        totalOrders: recentOrders.length,
        totalRevenue: revenueBuckets.reduce((acc, v) => acc + v, 0),
        totalCustomers,
      },
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
