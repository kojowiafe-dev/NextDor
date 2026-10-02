"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Eye, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { MOCK_ORDERS, type AdminOrder } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";
import { adminOrdersCache } from "@/lib/cache/adminCache";
import { API_BASE } from "@/lib/api-config";

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
  pending: { label: "Pending", classes: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmed", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", classes: "bg-zinc-100 text-zinc-700" },
};

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [orders, setOrders] = useState<AdminOrder[]>(() => {
    return adminOrdersCache.get("all_orders") ?? MOCK_ORDERS;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadOrders(forceRefresh = false) {
    const cacheKey = "all_orders";

    // 1. INSTANT: serve from SWR cache if available
    const { data: cached, isStale, hasData } = adminOrdersCache.getEntry(cacheKey);
    if (hasData && !forceRefresh) {
      setOrders(cached!);
      setIsLoading(false);
      if (!isStale) return; // Completely fresh — background fetch skipped
      setIsRefreshing(true);
    } else if (!hasData) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    // 2. Network Fetch with in-flight deduplication
    try {
      const liveOrders = await adminOrdersCache.fetchDedupe(cacheKey, async () => {
        try {
          if (!token) return MOCK_ORDERS;

          const res = await fetch(`${API_BASE}/admin/orders?limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) return MOCK_ORDERS;

          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            if (json.data.length === 0) {
              return [];
            }
            return json.data.map((o: any): AdminOrder => ({
              id: o.number || o.id,
              dbId: o.id,
              customer: {
                name: o.user?.name || o.shippingAddress?.recipientName || "Customer",
                email: o.user?.email || "guest@nextdor.com",
              },
              date: new Date(o.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              items: (o.items || []).map((it: any) => ({
                name: it.productName,
                quantity: it.quantity,
                price: Number(it.unitPrice || 0),
              })),
              total: Number(o.total),
              currency: o.currency || "GHS",
              status: (o.status?.toLowerCase() as any) || "processing",
              shippingAddress: {
                street: o.shippingAddress?.street || "",
                city: o.shippingAddress?.city || "",
                region: o.shippingAddress?.region || "",
              },
            }));
          }

          return MOCK_ORDERS;
        } catch {
          return MOCK_ORDERS;
        }
      });

      if (liveOrders) {
        setOrders(liveOrders);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token]);

  // Compute status counts stably across the entire orders dataset
  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      processing: orders.filter(
        (o) => o.status === "processing" || o.status === "pending" || o.status === "confirmed"
      ).length,
      shipped: orders.filter((o) => o.status === "shipped").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "refunded").length,
    };
  }, [orders]);

  // Filter in memory with zero layout jump or counter mutation
  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "processing") {
      return orders.filter(
        (o) => o.status === "processing" || o.status === "pending" || o.status === "confirmed"
      );
    }
    if (filter === "cancelled") {
      return orders.filter((o) => o.status === "cancelled" || o.status === "refunded");
    }
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <AdminLayout
      title="Orders"
      actions={
        <button
          type="button"
          onClick={() => {
            adminOrdersCache.invalidateAll();
            loadOrders(true);
          }}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isRefreshing ? "animate-spin text-[#ff9900]" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
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
              <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-500">
                {statusCounts[tab.value]}
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
                const cfg = statusConfig[order.status] || statusConfig.processing;
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
                      <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.classes}`}>
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
