"use client";

import { useEffect, useState } from "react";
import { Package, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchMyOrders, type Order } from "@/lib/orders/api";
import { createSWRCache } from "@/lib/cache/clientCache";

export type OrdersPageCache = { orders: Order[]; meta: { total: number; pages: number } };
// Cache user order pages with 2-min SWR TTL
export const ordersCache = createSWRCache<OrdersPageCache>("nextdor_my_orders", 2 * 60_000);


// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  PENDING:    { label: "Pending",    bg: "bg-amber-50",  text: "text-amber-700"  },
  CONFIRMED:  { label: "Confirmed",  bg: "bg-blue-50",   text: "text-blue-700"   },
  PROCESSING: { label: "Processing", bg: "bg-purple-50", text: "text-purple-700" },
  SHIPPED:    { label: "Shipped",    bg: "bg-indigo-50", text: "text-indigo-700" },
  DELIVERED:  { label: "Delivered",  bg: "bg-green-50",  text: "text-green-700"  },
  CANCELLED:  { label: "Cancelled",  bg: "bg-red-50",    text: "text-red-600"    },
  REFUNDED:   { label: "Refunded",   bg: "bg-zinc-100",  text: "text-zinc-600"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-zinc-100", text: "text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const itemCount = order.items?.length ?? 0;
  const preview = order.items?.[0]?.productName ?? "—";
  const extra = itemCount > 1 ? ` +${itemCount - 1} more` : "";

  return (
    <Link
      href={`/account/orders/${order.number}`}
      className="group flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:border-[#ff9900] hover:shadow-md"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#fff3e0]">
        <Package className="h-6 w-6 text-[#ff9900]" />
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-900">{order.number}</span>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-500">
          {preview}{extra}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {new Date(order.createdAt).toLocaleDateString("en-GH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Total + arrow */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="font-bold text-zinc-900">
          GH₵ {Number(order.total).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-[#ff9900]" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 10;

  const load = async (p: number, forceRefresh = false) => {
    if (!token) return;
    setError(null);

    const subKey = String(p);
    const { data: cached, isStale, hasData } = ordersCache.getEntry(subKey);

    if (hasData && !forceRefresh) {
      setOrders(cached!.orders);
      setTotal(cached!.meta.total);
      setPages(cached!.meta.pages);
      setPage(p);
      setLoading(false);
      if (!isStale) return; // Completely fresh — background fetch skipped
    } else if (!hasData) {
      setLoading(true);
    }

    try {
      const res = await fetchMyOrders(token, p, LIMIT);
      ordersCache.set({ orders: res.orders, meta: res.meta }, subKey);
      setOrders(res.orders);
      setTotal(res.meta.total);
      setPages(res.meta.pages);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">My Orders</h2>
            {!loading && (
              <p className="text-sm text-zinc-500">
                {total} order{total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => { ordersCache.invalidateAll(); load(page, true); }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error} —{" "}
            <button
              onClick={() => load(page)}
              className="underline hover:no-underline"
            >
              retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-zinc-200" />
            <p className="font-medium text-zinc-700">No orders yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              When you place an order, it will appear here.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-[#ff9900] px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
            >
              Browse Products
            </Link>
          </div>
        )}

        {/* Order list */}
        {!loading && !error && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => load(page - 1)}
                  disabled={page === 1}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={page === pages}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AccountLayout>
  );
}
