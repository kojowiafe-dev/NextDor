"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MOCK_ORDERS } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

type StatusFilter = "all" | "processing" | "shipped" | "delivered" | "cancelled";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const statusConfig: Record<string, { label: string; classes: string }> = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
};

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filtered =
    filter === "all" ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === filter);

  return (
    <AdminLayout title="Orders">
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
        {/* Filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto border-b border-zinc-100 px-4 pt-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === tab.value
                  ? "border-b-2 border-[#ff9900] text-[#ff9900]"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                {tab.value === "all"
                  ? MOCK_ORDERS.length
                  : MOCK_ORDERS.filter((o) => o.status === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3 text-left">Order</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Items</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((order) => {
                const cfg = statusConfig[order.status];
                return (
                  <tr key={order.id} className="group hover:bg-zinc-50/70">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-semibold text-zinc-700">
                        {order.id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-zinc-900">{order.customer.name}</p>
                        <p className="text-xs text-zinc-400">{order.customer.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{order.date}</td>
                    <td className="px-5 py-3.5 text-zinc-500">
                      {order.items.reduce((s, i) => s + i.quantity, 0)} item
                      {order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                      {formatPrice(order.total, order.currency)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.classes}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-[#007185] opacity-0 hover:underline group-hover:opacity-100"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-zinc-400">
              No orders with status &quot;{filter}&quot;.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
