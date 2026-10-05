"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  MapPin,
  MessageSquare,
  AlertCircle,
  XCircle,
  Store,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { fetchPublicOrderTracking, type PublicOrderTracking } from "@/lib/orders/api";
import { SITE_CONFIG } from "@/lib/constants/siteConfig";

// ─── 7-Stage Order Lifecycle Progression (Item #12) ───────────────────────────

const ORDER_LIFECYCLE_STEPS = [
  { id: "PENDING", label: "Pending", sub: "Order placed, awaiting payment" },
  { id: "PAID", label: "Paid", sub: "Payment verified by Paystack" },
  { id: "CONFIRMED", label: "Seller Confirmed", sub: "Merchant accepted order" },
  { id: "PROCESSING", label: "Preparing", sub: "Packaging & quality check" },
  { id: "PICKED_UP", label: "Picked Up", sub: "Collected by dispatch courier" },
  { id: "SHIPPED", label: "Out for Delivery", sub: "On the way to your door" },
  { id: "DELIVERED", label: "Delivered", sub: "Order completed & received" },
];

function getStepIndex(status: string, paymentStatus: string): number {
  if (status === "CANCELLED" || status === "REFUNDED") return -1;
  if (status === "DELIVERED") return 6;
  if (status === "SHIPPED") return 5;
  if (status === "PROCESSING") return 3;
  if (status === "CONFIRMED") return 2;
  if (paymentStatus === "PAID") return 1;
  return 0; // PENDING
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams.get("order") ?? "";

  const [orderNumberInput, setOrderNumberInput] = useState(initialOrder);
  const [activeTracking, setActiveTracking] = useState<PublicOrderTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const performLookup = async (orderNum: string) => {
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchPublicOrderTracking(clean);
      setActiveTracking(data);
    } catch (err: any) {
      setActiveTracking(null);
      setErrorMessage(
        err?.message || `Unable to find order "${clean}". Please verify your order number.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrder) {
      performLookup(initialOrder);
    }
  }, [initialOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumberInput.trim()) {
      performLookup(orderNumberInput);
    }
  };

  const currentStepIdx = activeTracking
    ? getStepIndex(activeTracking.status, activeTracking.paymentStatus)
    : 0;

  const isCancelled = activeTracking?.status === "CANCELLED";
  const isRefunded = activeTracking?.status === "REFUNDED";

  return (
    <div className="min-h-screen bg-zinc-50/60 pb-16 pt-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-zinc-900">Track Order</span>
        </div>

        {/* Hero header */}
        <div className="mb-8 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff9900]/10 px-3 py-1 text-xs font-bold text-[#b86200]">
            <Truck className="h-3.5 w-3.5" /> NextDor Real-Time Logistics Tracking
          </span>
          <h1 className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">
            Track Your Order
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Enter your NextDor Order Number (e.g. <span className="font-mono font-semibold">ND-00001</span>) to see live courier milestones.
          </p>
        </div>

        {/* Search bar card */}
        <div className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-zinc-200 sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={orderNumberInput}
                onChange={(e) => setOrderNumberInput(e.target.value)}
                placeholder="Enter order number (e.g. ND-00001)"
                className="w-full rounded-xl border border-zinc-300 py-3 pl-11 pr-4 font-mono text-sm uppercase text-zinc-900 placeholder:normal-case placeholder:font-sans placeholder:text-zinc-400 focus:border-[#ff9900] focus:outline-none focus:ring-2 focus:ring-[#ff9900]/20"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !orderNumberInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#232f3e] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#37475a] disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Locating...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Track Package
                </>
              )}
            </button>
          </form>

          {/* Quick instructions / tips */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <p>💡 Tip: You can find your order number in your confirmation email or SMS.</p>
            <Link
              href="/contact"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Need help finding it?
            </Link>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-bold">Order Lookup Notice</p>
                <p className="mt-0.5">{errorMessage}</p>
                <p className="mt-2 text-xs text-red-600">
                  Please verify the format is <span className="font-mono">ND-XXXXX</span>. If you recently placed the order, please allow 60 seconds for synchronization.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active tracking display */}
        {activeTracking && (
          <div className="mt-8 space-y-6">
            {/* Master Order Summary Header Card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#232f3e] via-[#1d2734] to-[#131921] p-6 text-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-black text-[#ff9900]">
                      #{activeTracking.orderNumber}
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {activeTracking.deliveryMethod} DELIVERY
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Placed on{" "}
                    {new Date(activeTracking.createdAt).toLocaleDateString("en-GH", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Payment Status</p>
                    <p
                      className={`text-sm font-bold ${
                        activeTracking.paymentStatus === "PAID"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {activeTracking.paymentStatus === "PAID" ? "VERIFIED PAID" : "PENDING / COD"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5 text-white">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Destination badge */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#ff9900]" />
                  <span>
                    Destination: <strong className="text-white">{activeTracking.destinationCity}, {activeTracking.destinationRegion}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-400" />
                  <span>
                    Package Contents: <strong className="text-white">{activeTracking.items.length} unique catalog items</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Visual 7-Stage Stepper (Item #12 & #15) */}
            <div className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-zinc-200">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-zinc-900">Order Progress</h2>
                  <p className="text-xs text-zinc-500">
                    {isCancelled
                      ? "This order was cancelled."
                      : isRefunded
                      ? "This order was refunded."
                      : `Current Status: Stage ${currentStepIdx + 1} of ${ORDER_LIFECYCLE_STEPS.length}`}
                  </p>
                </div>
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                    <XCircle className="h-3.5 w-3.5" /> Cancelled
                  </span>
                )}
              </div>

              {/* Stepper container */}
              {!isCancelled && !isRefunded && (
                <div className="relative">
                  {/* Desktop horizontal progression */}
                  <div className="hidden grid-cols-7 gap-1 md:grid">
                    {ORDER_LIFECYCLE_STEPS.map((step, idx) => {
                      const isCompleted = idx < currentStepIdx;
                      const isCurrent = idx === currentStepIdx;

                      return (
                        <div key={step.id} className="relative flex flex-col items-center text-center">
                          {/* Progress connector line */}
                          {idx > 0 && (
                            <div
                              className={`absolute -left-1/2 top-4 -z-1 h-1 w-full -translate-y-1/2 ${
                                idx <= currentStepIdx ? "bg-emerald-500" : "bg-zinc-200"
                              }`}
                            />
                          )}

                          {/* Node circle */}
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                              isCompleted
                                ? "bg-emerald-600 text-white shadow-sm"
                                : isCurrent
                                ? "bg-[#ff9900] text-zinc-900 ring-4 ring-[#ff9900]/25"
                                : "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>

                          {/* Label */}
                          <p
                            className={`mt-2 text-xs font-bold ${
                              isCurrent
                                ? "text-zinc-900"
                                : isCompleted
                                ? "text-emerald-800"
                                : "text-zinc-400"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2 px-1">
                            {step.sub}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile stacked progression */}
                  <div className="space-y-4 md:hidden">
                    {ORDER_LIFECYCLE_STEPS.map((step, idx) => {
                      const isCompleted = idx < currentStepIdx;
                      const isCurrent = idx === currentStepIdx;

                      return (
                        <div key={step.id} className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isCompleted
                                ? "bg-emerald-600 text-white"
                                : isCurrent
                                ? "bg-[#ff9900] text-zinc-900 ring-4 ring-[#ff9900]/25"
                                : "bg-zinc-100 text-zinc-400"
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                          </div>
                          <div>
                            <p
                              className={`text-xs font-bold ${
                                isCurrent
                                  ? "text-zinc-900 font-extrabold"
                                  : isCompleted
                                  ? "text-emerald-800"
                                  : "text-zinc-400"
                              }`}
                            >
                              {step.label} {isCurrent && "(Current State)"}
                            </p>
                            <p className="text-[11px] text-zinc-500">{step.sub}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Split Vendor Fulfillment by Store (Item #13) */}
            {activeTracking.vendorOrders && activeTracking.vendorOrders.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-zinc-200">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-[#ff9900]" />
                    <h3 className="font-bold text-zinc-900">
                      Store Fulfillment Status ({activeTracking.vendorOrders.length} {activeTracking.vendorOrders.length === 1 ? "merchant" : "merchants"})
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Independent Dispatch
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {activeTracking.vendorOrders.map((vo) => (
                    <div
                      key={vo.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-zinc-200 font-bold text-zinc-700">
                          {vo.vendorName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{vo.vendorName}</p>
                          <p className="text-[11px] text-zinc-500">Verified Marketplace Merchant</p>
                        </div>
                      </div>
                      <span className="rounded-lg bg-white px-3 py-1 font-mono text-xs font-bold text-zinc-800 ring-1 ring-zinc-200">
                        {vo.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Included */}
            <div className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-zinc-200">
              <h3 className="mb-4 font-bold text-zinc-900">
                Items in this Shipment ({activeTracking.items.length})
              </h3>
              <div className="divide-y divide-zinc-100">
                {activeTracking.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-semibold text-zinc-600">
                      {item.productImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="h-full w-full rounded-xl object-contain p-1"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-zinc-500">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Timeline */}
            <div className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-zinc-200">
              <h3 className="mb-4 font-bold text-zinc-900">Activity Log & Milestones</h3>
              {activeTracking.statusHistory && activeTracking.statusHistory.length > 0 ? (
                <div className="relative pl-6">
                  {/* Vertical rule */}
                  <div className="absolute bottom-2 left-2 top-2 w-0.5 bg-zinc-200" />
                  <div className="space-y-5">
                    {activeTracking.statusHistory.map((hist, i) => (
                      <div key={hist.id || i} className="relative">
                        <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#ff9900] shadow-xs" />
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{hist.status}</p>
                          {hist.note && (
                            <p className="mt-0.5 text-xs text-zinc-600">{hist.note}</p>
                          )}
                          <p className="mt-0.5 text-[10px] text-zinc-400">
                            {new Date(hist.createdAt).toLocaleString("en-GH", {
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
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No milestone entries logged yet.</p>
              )}
            </div>

            {/* Dispatch Support Help Card */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200/80">
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-950">
                  Questions regarding your delivery?
                </p>
                <p className="text-xs text-emerald-800">
                  Our Accra dispatch team is available Monday to Saturday, 8am – 7pm.
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${SITE_CONFIG.whatsapp.replace(/[^0-9]/g, "")}?text=Hello%20NextDor%2C%20I%20am%20tracking%20order%20${activeTracking.orderNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat on WhatsApp
                </a>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
                >
                  Shop More
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-zinc-200 border-t-[#ff9900]" />
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}
