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
  RefreshCcw,
  ShoppingBag,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchOrderByNumber,
  cancelOrder,
  confirmOrderDelivery,
  confirmSatisfiedReleaseEscrow,
  type Order,
  type StatusHistoryEntry,
} from "@/lib/orders/api";
import { createSWRCache } from "@/lib/cache/clientCache";
import { ordersCache } from "@/app/account/orders/page";
import { ReturnRequestModal } from "@/components/returns/ReturnRequestModal";
import { ReturnClaimCard } from "@/components/returns/ReturnClaimCard";
import type { ReturnRequest } from "@/lib/returns/api";

const orderDetailCache = createSWRCache<Order>("nextdor_order_detail", 2 * 60_000);

// ─── Status config ────────────────────────────────────────────────────────────

type StatusKey =
  | "PLACED"
  | "ACCEPTED"
  | "DISPATCHED"
  | "DELIVERED_VERIFIED"
  | "COMPLETED"
  | "DISPUTED"
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const STATUS_META: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
  PLACED:             { label: "Order Placed",                  color: "text-amber-500",   icon: Clock        },
  ACCEPTED:           { label: "Accepted by Store",             color: "text-blue-500",    icon: CheckCircle2 },
  DISPATCHED:         { label: "Dispatched / In Transit",       color: "text-indigo-500",  icon: Truck        },
  DELIVERED_VERIFIED: { label: "Delivered (48h Escrow Active)", color: "text-emerald-500", icon: ShieldCheck  },
  COMPLETED:          { label: "Completed",                     color: "text-green-600",   icon: CheckCircle2 },
  DISPUTED:           { label: "Disputed (Escrow Frozen)",      color: "text-red-500",     icon: XCircle      },
  PENDING:            { label: "Order Placed",                  color: "text-amber-500",   icon: Clock        },
  CONFIRMED:          { label: "Confirmed",                     color: "text-blue-500",    icon: CheckCircle2 },
  PROCESSING:         { label: "Processing",                    color: "text-purple-500",  icon: Package      },
  SHIPPED:            { label: "Shipped",                       color: "text-indigo-500",  icon: Truck        },
  DELIVERED:          { label: "Delivered",                     color: "text-green-500",   icon: CheckCircle2 },
  CANCELLED:          { label: "Cancelled",                     color: "text-red-500",     icon: XCircle      },
  REFUNDED:           { label: "Refunded",                      color: "text-zinc-500",    icon: RefreshCcw   },
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
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [actingVendorOrderId, setActingVendorOrderId] = useState<string | null>(null);
  const [escrowBanner, setEscrowBanner] = useState<string | null>(null);

  const getEffectiveToken = () =>
    token ||
    (typeof window !== "undefined"
      ? localStorage.getItem("nextdor-token") || localStorage.getItem("vendor_token")
      : null);

  const load = async (forceRefresh = false) => {
    const effectiveToken = getEffectiveToken();

    if (!effectiveToken) {
      if (!authLoading) setLoading(false);
      return;
    }
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
      const data = await fetchOrderByNumber(number, effectiveToken);
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
  }, [token, number, authLoading]);

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

  const handleConfirmDelivery = async (vendorOrderId: string) => {
    const effectiveToken = getEffectiveToken();
    if (!effectiveToken) return;
    if (
      !confirm(
        "Confirm that you have received this package? This starts your 48-hour Buyer Protection inspection window before funds are released to the seller."
      )
    ) {
      return;
    }
    setActingVendorOrderId(vendorOrderId);
    setEscrowBanner(null);
    try {
      await confirmOrderDelivery(vendorOrderId, effectiveToken);
      orderDetailCache.invalidate(number);
      ordersCache.invalidateAll();
      setEscrowBanner(
        "Delivery confirmed! Your 48-hour Buyer Protection window has started. You have 48 hours to inspect your items before payment is released to the seller."
      );
      await load(true);
    } catch (e: any) {
      alert(e.message ?? "Failed to confirm delivery");
    } finally {
      setActingVendorOrderId(null);
    }
  };

  const handleReleaseEscrow = async (vendorOrderId: string) => {
    const effectiveToken = getEffectiveToken();
    if (!effectiveToken) return;
    if (
      !confirm(
        "Are you satisfied with your items? Confirming early will immediately release the escrow payment to the merchant."
      )
    ) {
      return;
    }
    setActingVendorOrderId(vendorOrderId);
    setEscrowBanner(null);
    try {
      await confirmSatisfiedReleaseEscrow(vendorOrderId, effectiveToken);
      orderDetailCache.invalidate(number);
      ordersCache.invalidateAll();
      setEscrowBanner("Thank you! Your satisfaction has been recorded and payment has been released to the merchant.");
      await load(true);
    } catch (e: any) {
      alert(e.message ?? "Failed to release escrow funds");
    } finally {
      setActingVendorOrderId(null);
    }
  };

  const canCancel =
    order && ["PLACED", "PENDING", "CONFIRMED"].includes(order.status);

  const hasDeliveredSubOrder =
    order &&
    (["DELIVERED", "DELIVERED_VERIFIED"].includes(order.status) ||
      order.vendorOrders?.some((vo) => vo.status === "DELIVERED"));

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
                <p className="text-sm font-medium text-[#ff9900]">
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

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Link
                href={`/track?order=${encodeURIComponent(order.number)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-3.5 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-[#e68a00]"
              >
                <Truck className="h-3.5 w-3.5" />
                Live Storefront Tracker
              </Link>

              {hasDeliveredSubOrder && (
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/20 border border-white/20 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#ff9900]" />
                  Request Return / Refund
                </button>
              )}

              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="rounded-lg bg-red-500/20 px-3.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel Order"}
                </button>
              )}
            </div>
          </div>

          {/* Escrow notification banner */}
          {escrowBanner && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-2xs">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="flex-1">
                <p className="font-semibold">Escrow Protection Updated</p>
                <p className="mt-0.5 text-xs text-emerald-800">{escrowBanner}</p>
              </div>
            </div>
          )}

          {/* Active Return Claim Cards */}
          {order.returnRequests && order.returnRequests.length > 0 && (
            <div className="space-y-4">
              {order.returnRequests.map((claim: any) => (
                <ReturnClaimCard
                  key={claim.id}
                  claim={claim}
                  token={token || ""}
                  onRefresh={() => load(true)}
                />
              ))}
            </div>
          )}

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

              {/* Vendor sub-orders & 48-Hour Buyer Protection Controls */}
              {order.vendorOrders && order.vendorOrders.length > 0 && (
                <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900">
                      Fulfillment by Store &amp; Buyer Protection
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      48h Escrow Protected
                    </span>
                  </div>
                  <div className="space-y-3">
                    {order.vendorOrders.map((vo) => {
                      const isActing = actingVendorOrderId === vo.id;
                      const inEscrow =
                        vo.status === "DELIVERED" && vo.fundsStatus === "ESCROW";
                      const isCleared =
                        vo.fundsStatus === "AVAILABLE" ||
                        vo.fundsStatus === "IN_PAYOUT" ||
                        vo.fundsStatus === "PAID_OUT";

                      return (
                        <div
                          key={vo.id}
                          className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">
                                {vo.vendor.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                Store Subtotal: GH₵ {Number(vo.subtotal).toFixed(2)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                                vo.status === "DELIVERED"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : vo.status === "SHIPPED"
                                  ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                                  : vo.status === "PROCESSING"
                                  ? "bg-blue-50 text-blue-700 ring-blue-200"
                                  : "bg-white text-zinc-600 ring-zinc-200"
                              }`}
                            >
                              {vo.status}
                            </span>
                          </div>

                          {/* Customer Action: Confirm Delivery when SHIPPED */}
                          {vo.status === "SHIPPED" && (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="text-xs text-indigo-950">
                                <p className="font-semibold">
                                  Package Dispatched — Have you received it?
                                </p>
                                <p className="text-indigo-800 mt-0.5">
                                  Your payment is safely held in escrow. Confirm once your package arrives to start your 48-hour inspection window.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConfirmDelivery(vo.id)}
                                disabled={isActing}
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {isActing
                                  ? "Confirming…"
                                  : "I've Received My Order"}
                              </button>
                            </div>
                          )}

                          {/* Customer Action: 48-Hour Inspection Window Active */}
                          {inEscrow && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs text-amber-950">
                                  <p className="font-bold flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                                    48-Hour Buyer Protection Window Active
                                  </p>
                                  <p className="text-amber-800 mt-0.5">
                                    Inspect your items. Funds automatically release to {vo.vendor.name}{" "}
                                    {vo.escrowExpiresAt
                                      ? `on ${new Date(vo.escrowExpiresAt).toLocaleString("en-GH", {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                        })}`
                                      : "after 48 hours"}{" "}
                                    unless you report an issue.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleReleaseEscrow(vo.id)}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {isActing
                                    ? "Releasing…"
                                    : "Satisfied — Release Funds Now"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowReturnModal(true)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 cursor-pointer"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                  Report Issue / Request Return
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Escrow Cleared / Completed */}
                          {vo.status === "DELIVERED" && isCleared && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                              <span>
                                Delivery verified &amp; 48h buyer protection completed.
                              </span>
                            </div>
                          )}

                          {/* Disputed */}
                          {vo.fundsStatus === "DISPUTED" && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span>
                                Escrow frozen while your return/dispute is under review.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

          {/* Return Request Modal */}
          {showReturnModal && (
            <ReturnRequestModal
              isOpen={showReturnModal}
              onClose={() => setShowReturnModal(false)}
              orderNumber={order.number}
              items={order.items as any}
              token={token || ""}
              onSuccess={(newClaim) => {
                alert("Return claim submitted successfully! The merchant has 24h to review.");
                orderDetailCache.invalidate(number);
                load(true);
              }}
            />
          )}
        </div>
      )}
    </AccountLayout>
  );
}
