import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Nextdor Ghana",
  description:
    "Learn how Nextdor Ghana collects, protects, and uses your personal and order information.",
};

export default function PrivacyPolicyPage() {
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">Privacy Policy</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              Effective Date: November 2026 • Nextdor Ghana Marketplace
            </p>
          </div>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">1. Information We Collect</h2>
          <p>
            We collect information you provide when creating an account, placing an order, or
            contacting support — including your name, phone number, email address, and Ghana
            delivery address. Payment card and Mobile Money credentials are handled directly by
            Paystack and are never stored in plain text on Nextdor servers.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">2. How We Use Your Information</h2>
          <p>
            Your information is used strictly to fulfill orders, coordinate courier delivery,
            manage 48-hour escrow protection and returns, send order updates, and prevent fraud.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">3. Sharing With Merchants &amp; Couriers</h2>
          <p>
            To complete delivery, we share only the necessary fulfillment details (recipient name,
            delivery phone, and address) with the verified merchant fulfilling your order and the
            assigned logistics partner.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-900">4. Data Security &amp; Your Rights</h2>
          <p>
            We use encrypted HTTPS transport, strict access controls, and secure authentication
            tokens. You may request access to, correction of, or deletion of your account data by
            contacting{" "}
            <Link href="/contact" className="font-semibold text-[#007185] hover:underline">
              Nextdor Support
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

