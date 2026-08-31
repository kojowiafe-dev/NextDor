"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Calendar, ShoppingBag } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MOCK_CUSTOMERS, MOCK_ORDERS } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

const statusConfig: Record<string, { label: string; classes: string }> = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = MOCK_CUSTOMERS.find((c) => c.id === id);

  if (!customer) {
    return (
      <AdminLayout title="Customer Not Found">
        <p className="text-zinc-500">Customer not found.</p>
        <Link href="/admin/customers" className="mt-4 inline-flex items-center gap-1 text-sm text-[#007185] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </AdminLayout>
    );
  }

  const customerOrders = MOCK_ORDERS.filter(
    (o) => o.customer.email === customer.email,
  );

  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AdminLayout title={customer.name}>
      <div className="mb-4">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#232f3e] text-2xl font-bold text-[#ff9900]">
              {initials}
            </div>
            <h2 className="font-semibold text-zinc-900">{customer.name}</h2>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              customer.status === "active" ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
            }`}>
              {customer.status === "active" ? "Active" : "Inactive"}
            </span>

            <div className="mt-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Mail className="h-4 w-4 text-zinc-400" />
                {customer.email}
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Calendar className="h-4 w-4 text-zinc-400" />
                Member since {customer.joined}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-zinc-900">{customer.totalOrders}</p>
                <p className="text-xs text-zinc-500">Total Orders</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-900">
                  {formatPrice(customer.totalSpent, customer.currency)}
                </p>
                <p className="text-xs text-zinc-500">Total Spent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-zinc-400" />
              <h3 className="font-semibold text-zinc-900">Order History</h3>
            </div>

            {customerOrders.length > 0 ? (
              <div className="space-y-3">
                {customerOrders.map((order) => {
                  const cfg = statusConfig[order.status];
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 p-4 hover:border-zinc-200 hover:bg-zinc-50"
                    >
                      <div>
                        <p className="font-mono text-xs font-semibold text-zinc-600">{order.id}</p>
                        <p className="mt-0.5 text-sm text-zinc-500">{order.date}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {order.items.map((i) => i.name).join(", ")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-semibold text-zinc-900">
                          {formatPrice(order.total, order.currency)}
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-zinc-200" />
                <p className="text-sm text-zinc-400">No orders from this customer yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
