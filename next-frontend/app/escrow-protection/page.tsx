import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "48h Escrow Protection Terms | Nextdor Ghana",
  description:
    "How Nextdor's 48-Hour Buyer Escrow Protection keeps your Mobile Money and card payments safe until you verify your delivery.",
};

export default function EscrowProtectionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Marketplace
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-xs space-y-6">
        <div className="flex items-start gap-3 border-b border-zinc-100 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">
              48-Hour Buyer Escrow Protection
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              Shop safely across Ghana — your payment is held in escrow until your order arrives as promised.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Clock className="h-5 w-5 text-[#ff9900] mb-2" />
            <h3 className="text-sm font-bold text-zinc-900">1. Payment Held Safely</h3>
            <p className="mt-1 text-xs text-zinc-600">
              When you pay via MoMo or card, Nextdor holds the funds in escrow rather than releasing
              them immediately to the seller.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-2" />
            <h3 className="text-sm font-bold text-zinc-900">2. 48-Hour Inspection</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Once your item is delivered, you have 48 hours to inspect it and verify condition,
              quantity, and authenticity.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <AlertCircle className="h-5 w-5 text-blue-600 mb-2" />
            <h3 className="text-sm font-bold text-zinc-900">3. Protected Disputes</h3>
            <p className="mt-1 text-xs text-zinc-600">
              If something is wrong, open a return claim within 48 hours and escrow payout is paused
              while our team resolves it.
            </p>
          </div>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">What Is Covered</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Items that never arrive or fail courier delivery.</li>
            <li>Items that arrive damaged, broken, or missing parts.</li>
            <li>Items materially different from the product description or photos.</li>
            <li>Wrong size, variant, or model shipped by the merchant.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">How Escrow Release Works</h2>
          <p>
            If no return or dispute is filed within 48 hours of confirmed delivery (or once you
            explicitly confirm receipt), the escrow hold concludes and funds are scheduled for
            merchant payout.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-900">
          <span className="font-medium">Need to file a claim or check an active order?</span>
          <div className="flex items-center gap-3">
            <Link href="/track" className="font-bold text-emerald-800 hover:underline">
              Track Order
            </Link>
            <Link href="/returns" className="font-bold text-emerald-800 hover:underline">
              Returns &amp; Refunds &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

