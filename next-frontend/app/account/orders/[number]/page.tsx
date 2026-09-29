"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  XCircle,
  ArrowLeft,
  RefreshCcw,
  ShoppingBag,
} from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchOrderByNumber, cancelOrder, type Order, type StatusHistoryEntry } from "@/lib/orders/api";
import { createSWRCache } from "@/lib/cache/clientCache";
import { ordersCache } from "@/app/account/orders/page";

const orderDetailCache = createSWRCache<Order>("nextdor_order_detail", 2 * 60_000);

// ─── Status config ────────────────────────────────────────────────────────────

type StatusKey =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const STATUS_META: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: "Order Placed",  color: "text-amber-500",  icon: Clock       },
  CONFIRMED:  { label: "Confirmed",     color: "text-blue-500",   icon: CheckCircle2 },
  PROCESSING: { label: "Processing",    color: "text-purple-500", icon: Package     },
  SHIPPED:    { label: "Shipped",       color: "text-indigo-500", icon: Truck       },
  DELIVERED:  { label: "Delivered",     color: "text-green-500",  icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",     color: "text-red-500",    icon: XCircle     },
  REFUNDED:   { label: "Refunded",      color: "text-zinc-500",   icon: RefreshCcw  },
};

// ─── Tracking timeline ────────────────────────────────────────────────────────

function TrackingTimeline({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-4 top-5 h-[calc(100%-28px)] w-0.5 bg-zinc-100" />

      <div className="space-y-6">
        {history.map((entry, idx) => {
          const meta = STATUS_META[entry.status as StatusKey] ?? {
            label: entry.status,
            color: "text-zinc-500",
            icon: Clock,
          };
          const Icon = meta.icon;
          const isLatest = idx === history.length - 1;

          return (
            <div key={entry.id} className="relative flex gap-4">
              {/* Icon bubble */}
              <div
                className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  isLatest
                    ? "border-[#ff9900] bg-[#ff9900] shadow-md shadow-amber-200"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isLatest ? "text-white" : "text-zinc-400"}`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-1 pt-0.5">
                <p className={`font-semibold ${isLatest ? meta.color : "text-zinc-500"}`}>
                  {meta.label}
                </p>
                {entry.note && (
                  <p className="mt-0.5 text-sm text-zinc-500">{entry.note}</p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(entry.createdAt).toLocaleString("en-GH", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shipping address card ────────────────────────────────────────────────────

function ShippingCard({ address }: { address: Order["shippingAddress"] }) {
  return (
    <div className="flex gap-3 rounded-xl bg-zinc-50 p-4">
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff9900]" />
      <div className="text-sm text-zinc-700">
        {address.recipientName && (
          <p className="font-semibold">{address.recipientName}</p>
        )}
        <p>{address.street}</p>
        <p>
          {address.city}, {address.region}
        </p>
        {address.recipientPhone && (
          <p className="mt-1 text-zinc-500">{address.recipientPhone}</p>
        )}
      </div>
    </div>
  );
}

// ─── Order item row ───────────────────────────────────────────────────────────

function ItemRow({ item }: { item: Order["items"][0] }) {
  const slug = item.product?.slug;
  const content = (
    <div className="flex items-center gap-3">
      {item.productImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.productImage}
          alt={item.productName}
          className="h-12 w-12 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
          <ShoppingBag className="h-5 w-5 text-zinc-300" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">
          {item.productName}
        </p>
        <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
      </div>
      <p className="flex-shrink-0 text-sm font-semibold text-zinc-900">
        GH₵{" "}
        {Number(item.subtotal).toLocaleString("en-GH", {
          minimumFractionDigits: 2,
        })}
      </p>
    </div>
  );

  return slug ? (
    <Link href={`/product/${slug}`} className="block rounded-lg transition hover:bg-zinc-50 px-1 py-1">
      {content}
    </Link>
  ) : (
    <div className="px-1 py-1">{content}</div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = use(params);
  const { token } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async (forceRefresh = false) => {
    if (!token) return;
    setError(null);

    const { data: cached, isStale, hasData } = orderDetailCache.getEntry(number);
    if (hasData && !forceRefresh) {
      setOrder(cached);
      setLoading(false);
      if (!isStale) return; // Completely fresh — background fetch skipped
    } else if (!hasData) {
      setLoading(true);
    }

    try {
      const data = await fetchOrderByNumber(number, token);
      orderDetailCache.set(data, number);
      setOrder(data);
    } catch (e: any) {
      if (!hasData) {
        setError(e.message ?? "Order not found");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, number]);

  const handleCancel = async () => {
    if (!token || !order) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelling(true);
    try {
      await cancelOrder(number, token);
      orderDetailCache.invalidate(number);
      ordersCache.invalidateAll(); // order status changed — orders list must update
      await load(true); // force fresh reload
    } catch (e: any) {
      alert(e.message ?? "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const canCancel =
    order && ["PENDING", "CONFIRMED"].includes(order.status);

  return (
    <AccountLayout>
      {/* Back link */}
      <Link
        href="/account/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl bg-red-50 p-6 text-center">
          <XCircle className="mx-auto mb-2 h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">{error}</p>
          <button
            onClick={() => load(true)}
            className="mt-3 text-sm text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Order detail */}
      {!loading && !error && order && (
        <div className="space-y-5">
          {/* Header card */}
          <div className="rounded-xl bg-gradient-to-r from-[#232f3e] to-[#37475a] p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#febd69]">
                  Order #{order.number}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Placed{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-GH", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  GH₵{" "}
                  {Number(order.total).toLocaleString("en-GH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium ${
                    STATUS_META[order.status as StatusKey]?.color ?? "text-white"
                  }`}
                >
                  {STATUS_META[order.status as StatusKey]?.label ?? order.status}
                </span>
              </div>
            </div>

            {/* Cancel button */}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel Order"}
              </button>
            )}
          </div>

          {/* Two-col layout on desktop */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Left: items + summary */}
            <div className="space-y-5 lg:col-span-2">
              {/* Items */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                <h3 className="mb-4 font-semibold text-zinc-900">
                  Items ({order.items.length})
                </h3>
                <div className="divide-y divide-zinc-50">
                  {order.items.map((item, i) => (
                    <div key={i} className="py-1">
                      <ItemRow item={item} />
                    </div>
                  ))}
                </div>

                {/* Price summary */}
                <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4 text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>GH₵ {Number(order.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Delivery ({order.deliveryMethod})</span>
                    <span>GH₵ {Number(order.deliveryFee).toFixed(2)}</span>
                  </div>
                  {Number(order.discount) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>−GH₵ {Number(order.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-100 pt-2 font-bold text-zinc-900">
                    <span>Total</span>
                    <span>GH₵ {Number(order.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                <h3 className="mb-3 font-semibold text-zinc-900">
                  Delivery Address
                </h3>
                <ShippingCard address={order.shippingAddress} />
              </div>

              {/* Vendor sub-orders */}
              {order.vendorOrders && order.vendorOrders.length > 0 && (
                <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                  <h3 className="mb-3 font-semibold text-zinc-900">
                    Fulfillment by Store
                  </h3>
                  <div className="space-y-3">
                    {order.vendorOrders.map((vo) => (
                      <div
                        key={vo.id}
                        className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            {vo.vendor.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            GH₵ {Number(vo.subtotal).toFixed(2)}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                          {vo.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: tracking timeline */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <h3 className="mb-5 font-semibold text-zinc-900">
                Tracking Timeline
              </h3>
              {order.statusHistory && order.statusHistory.length > 0 ? (
                <TrackingTimeline history={order.statusHistory} />
              ) : (
                <p className="text-sm text-zinc-400">No tracking updates yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
