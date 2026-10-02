import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";
import type { Prisma } from "@prisma/client";

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export class AdminCustomerService {
  async listCustomers(params: ListCustomersParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: "CUSTOMER",
      deletedAt: null,
    };

    if (params.search?.trim()) {
      const search = params.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
          orders: {
            select: {
              total: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const customers = users.map((u) => {
      const totalSpent = u.orders
        .filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED")
        .reduce((sum, o) => sum + Number(o.total), 0);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? "",
        joined: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(u.createdAt),
        status: u.status === "ACTIVE" ? ("active" as const) : ("inactive" as const),
        totalOrders: u._count.orders,
        totalSpent,
        currency: "GHS",
      };
    });

    return {
      customers,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id }] : []),
          { email: id },
        ],
        deletedAt: null,
      },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              select: {
                id: true,
                productName: true,
                quantity: true,
                unitPrice: true,
                subtotal: true,
                productImage: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError(`Customer '${id}' not found`);
    }

    const totalSpent = user.orders
      .filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED")
      .reduce((sum, o) => sum + Number(o.total), 0);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      joined: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(user.createdAt),
      status: user.status === "ACTIVE" ? ("active" as const) : ("inactive" as const),
      totalOrders: user.orders.length,
      totalSpent,
      currency: "GHS",
      addresses: user.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        street: a.street,
        city: a.city,
        region: a.region,
        isDefault: a.isDefault,
      })),
      orders: user.orders.map((o) => ({
        id: o.number || o.id,
        dbId: o.id,
        date: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(o.createdAt),
        status: o.status.toLowerCase(),
        total: Number(o.total),
        currency: o.currency || "GHS",
        items: o.items.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          price: Number(i.unitPrice),
        })),
      })),
    };
  }
}

export const adminCustomerService = new AdminCustomerService();
