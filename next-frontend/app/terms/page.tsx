import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Nextdor Ghana",
  description:
    "Read Nextdor Ghana's Terms of Service covering marketplace orders, verified merchants, 48-hour escrow, delivery, and returns.",
};

export default function TermsOfServicePage() {
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ff9900]/15 text-[#c7511f]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">Terms of Service</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              Effective Date: November 2026 • Nextdor Ghana Marketplace
            </p>
          </div>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">1. Marketplace Overview</h2>
          <p>
            Nextdor operates an online multi-vendor marketplace connecting buyers across Ghana with
            verified independent merchants and flagship outlets. By placing an order or registering
            an account on Nextdor, you agree to these Terms of Service.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">2. Orders, Pricing &amp; Payments</h2>
          <p>
            All prices are displayed in Ghana Cedis (GHS) unless otherwise specified. Payments are
            processed securely via Paystack (Mobile Money, Visa, Mastercard) or approved Cash on
            Delivery where available. Orders are confirmed once payment authorization or COD
            verification succeeds.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">3. 48-Hour Buyer Escrow Protection</h2>
          <p>
            Prepaid marketplace orders are protected by Nextdor&apos;s{" "}
            <Link href="/escrow-protection" className="font-semibold text-[#007185] hover:underline">
              48-Hour Escrow Protection
            </Link>
            . Funds are held safely in escrow until delivery is completed and the 48-hour inspection
            window expires without an open dispute.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">4. Delivery &amp; Returns</h2>
          <p>
            Estimated delivery windows vary by region across Ghana. Eligible items that arrive
            damaged, defective, or materially different from the listing may be returned within 48
            hours of delivery via your order tracking or account orders page.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">5. Account &amp; Merchant Conduct</h2>
          <p>
            Users must provide accurate delivery and contact information. Fraudulent orders,
            counterfeit listings, or abuse of the escrow dispute system may result in immediate
            account suspension.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4 border border-zinc-200 text-xs text-zinc-600">
          <span className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Questions about these terms? Reach our support team anytime.
          </span>
          <Link href="/contact" className="font-bold text-[#007185] hover:underline">
            Contact Customer Service &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

