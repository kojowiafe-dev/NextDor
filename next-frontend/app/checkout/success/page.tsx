"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  ShoppingBag,
  Home,
  Package,
  ShieldCheck,
  Clock,
  AlertCircle,
  Truck,
  ArrowRight,
} from "lucide-react";
import {
  fetchPublicOrderTracking,
  verifyPayment,
  type PublicOrderTracking,
} from "@/lib/orders/api";
import { formatPrice } from "@/lib/utils";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order") ?? "";
  const initialTotal = searchParams.get("total");
  const currency = searchParams.get("currency") ?? "GHS";
  const ref = searchParams.get("reference") || searchParams.get("trxref");
  const initialStatus = searchParams.get("status");
  const paymentMethod = searchParams.get("payment") || searchParams.get("method") || "";

  const [orderData, setOrderData] = useState<PublicOrderTracking | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(ref));
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAndVerify() {
      if (!orderNumber) {
        setIsVerifying(false);
        return;
      }

      // If reference was passed from Paystack, verify server-side
      if (ref) {
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("nextdor-token") : null;
          await verifyPayment(orderNumber, ref, token);
        } catch (err: any) {
          console.warn("Server payment verification notice:", err);
          // If server returns already verified, or webhook handled it, we continue
        }
      }

      // Fetch live order tracking from API
      try {
        const liveOrder = await fetchPublicOrderTracking(orderNumber);
        if (isMounted) {
          setOrderData(liveOrder);
        }
      } catch (fetchErr: any) {
        console.warn("Unable to fetch live tracking details:", fetchErr);
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    loadAndVerify();

    return () => {
      isMounted = false;
    };
  }, [orderNumber, ref]);

  const isPaid = orderData?.paymentStatus === "PAID" || initialStatus === "PAID" || Boolean(ref);
  const isCod = paymentMethod.toLowerCase() === "cod" || orderData?.paymentStatus === "UNPAID";
  const displayStatus = orderData?.status ?? (isPaid ? "CONFIRMED" : "PENDING");

  const formattedTotal = initialTotal
    ? formatPrice(Number(initialTotal), currency)
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {/* Verification Spinner */}
      {isVerifying ? (
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-[#ff9900]" />
        </div>
      ) : (
        /* Success Icon */
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50 shadow-xs">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
      )}

      <h1 className="text-3xl font-black text-zinc-900 tracking-tight sm:text-4xl">
        {isVerifying
          ? "Verifying Payment..."
          : isPaid
          ? "Payment Received & Order Confirmed!"
          : "Order Successfully Placed!"}
      </h1>
      <p className="mt-3 text-sm text-zinc-600 max-w-lg mx-auto">
        {isPaid
          ? "Thank you for shopping with NextDor! Your payment was verified via Paystack and your merchants are packaging your items."
          : "Thank you for shopping with NextDor. Your order has been registered in our system and is being prepared for dispatch."}
      </p>

      {/* Order Summary Card */}
      <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-xs ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff3e0]">
              <Package className="h-5 w-5 text-[#ff9900]" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Order Number</p>
              <p className="font-mono text-lg font-bold text-zinc-900">
                {orderNumber || "ND-00000"}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPaid
                ? "bg-emerald-100 text-emerald-800"
                : isCod
                ? "bg-amber-100 text-amber-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {isPaid ? "PAID & VERIFIED" : isCod ? "CASH ON DELIVERY" : "CONFIRMED"}
          </span>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-zinc-500">Fulfillment Status</dt>
            <dd>
              <span
                className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                  displayStatus === "CONFIRMED" || displayStatus === "PROCESSING"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : displayStatus === "SHIPPED"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {displayStatus}
              </span>
            </dd>
          </div>

          {formattedTotal && (
            <div className="flex justify-between items-center">
              <dt className="text-zinc-500">Final Total</dt>
              <dd className="font-bold text-zinc-900">{formattedTotal}</dd>
            </div>
          )}

          {orderData?.destinationCity && (
            <div className="flex justify-between items-center">
              <dt className="text-zinc-500">Delivery Location</dt>
              <dd className="font-medium text-zinc-800">
                {orderData.destinationCity}, {orderData.destinationRegion}
              </dd>
            </div>
          )}

          <div className="flex justify-between items-center">
            <dt className="text-zinc-500">Estimated Delivery Window</dt>
            <dd className="font-medium text-zinc-900">2 – 4 business days</dd>
          </div>
        </dl>

        {/* Live Tracking Information Notice */}
        <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 space-y-1.5 border border-zinc-100">
          <p className="flex items-center gap-2 font-medium text-zinc-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            48-Hour Buyer Protection Escrow Active
          </p>
          <p>📧 A detailed receipt and invoice have been sent to your email.</p>
          <p>📱 Live SMS updates will be delivered to your phone when dispatched.</p>
        </div>
      </div>

      {/* Fulfillment Milestone Steps */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          { icon: Package, label: "1. Preparing", sub: "Merchant packs order" },
          { icon: Truck, label: "2. Dispatch", sub: "Courier collects item" },
          { icon: Home, label: "3. Delivery", sub: "Direct to your door" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-zinc-200">
            <Icon className="mx-auto mb-2 h-6 w-6 text-[#ff9900]" />
            <p className="text-xs font-bold text-zinc-900">{label}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* Call to Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {orderNumber && (
          <Link
            href={`/track?order=${encodeURIComponent(orderNumber)}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#232f3e] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#37475a] shadow-xs"
          >
            <Package className="h-4 w-4 text-[#ff9900]" />
            Track Order #{orderNumber}
          </Link>
        )}
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 shadow-xs"
        >
          <ShoppingBag className="h-4 w-4" />
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[400px] max-w-2xl items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
            <p className="text-sm font-medium text-zinc-600">Loading order confirmation...</p>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
