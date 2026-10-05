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

    // 3. Top products by revenue (excluding CANCELLED and REFUNDED orders)
    const validOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
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

    // 4. Sales by category (excluding CANCELLED and REFUNDED orders)
    const categoriesWithSales = await prisma.category.findMany({
      take: 6,
      select: {
        name: true,
        products: {
          select: {
            orderItems: {
              where: {
                order: {
                  status: { notIn: ["CANCELLED", "REFUNDED"] },
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
      .filter((cat) => cat.revenue > 0);

    // 5. Total customers, completed orders, and catalog products
    const [totalCustomers, totalCompletedOrders, totalProducts] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
      prisma.order.count({
        where: {
          status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      }),
      prisma.product.count({ where: { deletedAt: null } }),
    ]);

    const conversionRate =
      totalCustomers > 0
        ? `${((totalCompletedOrders / totalCustomers) * 100).toFixed(1)}%`
        : "0.0%";

    const validRecentOrders = recentOrders.filter(
      (o) => o.status !== "CANCELLED" && o.status !== "REFUNDED",
    );

    return {
      revenueData: revenueBuckets,
      ordersByStatus,
      topProducts,
      salesByCategory,
      conversionRate,
      metrics: {
        totalOrders: validRecentOrders.length,
        totalRevenue: revenueBuckets.reduce((acc, v) => acc + v, 0),
        totalCustomers,
        totalProducts,
      },
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
