import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description:
    "Nextdor's hassle-free returns and refund policy. Learn what qualifies, how to initiate a return, and when to expect your refund.",
};

const steps = [
  {
    number: "01",
    title: "Initiate your return",
    desc: 'Log in to your account, go to My Orders, and click "Request Return" on the item you wish to send back.',
  },
  {
    number: "02",
    title: "Package the item",
    desc: "Repack the product in its original packaging (if available) with all accessories, tags, and proof of purchase.",
  },
  {
    number: "03",
    title: "Drop off or schedule pickup",
    desc: "Drop the parcel at your nearest pickup point, or schedule a free collection for orders above GHS 200.",
  },
  {
    number: "04",
    title: "Receive your refund",
    desc: "Once we inspect and approve the return, your refund is processed within 3–5 business days to your original payment method.",
  },
];

const eligible = [
  "Item is unused, unwashed, and in original condition",
  "All original tags, packaging, and accessories are included",
  "Return is requested within 14 days of delivery",
  "Item is not from the non-returnable categories below",
];

const notEligible = [
  "Perishable goods (food, fresh bakery items)",
  "Personalised or custom-made products",
  "Opened beauty and personal care products",
  "Downloadable software or digital products",
  "Items marked as Final Sale",
];

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] hover:underline">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-zinc-900">Returns &amp; Refunds</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Returns &amp; Refunds</h1>
        <p className="mt-2 text-zinc-500">
          Not happy with your order? No worries — we make returns simple.
        </p>
      </div>

      {/* Policy summary banner */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-[#232f3e] to-[#37475a] p-6 text-white">
        <div className="flex flex-wrap gap-6">
          {[
            { icon: RefreshCw, label: "14-Day Returns", sub: "From delivery date" },
            { icon: Clock, label: "3–5 Day Refunds", sub: "After approval" },
            { icon: CheckCircle, label: "Free Collection", sub: "For orders above GHS 200" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="h-6 w-6 text-[#ff9900]" />
              <div>
                <p className="font-semibold">{label}</p>
                <p className="text-sm text-zinc-300">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to return */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-6 font-semibold text-zinc-900">How to Return an Item</h2>
        <div className="space-y-5">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff3e0] text-sm font-bold text-[#ff9900]">
                {step.number}
              </div>
              <div>
                <p className="font-semibold text-zinc-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Eligible / Not eligible */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h2 className="font-semibold text-zinc-900">Eligible for Return</h2>
          </div>
          <ul className="space-y-2">
            {eligible.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-zinc-900">Not Eligible for Return</h2>
          </div>
          <ul className="space-y-2">
            {notEligible.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Refund timeline */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-4 font-semibold text-zinc-900">Refund Timeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="pb-2 text-left">Payment Method</th>
                <th className="pb-2 text-left">Refund Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {[
                ["Mobile Money (MoMo)", "1 – 2 business days"],
                ["Credit / Debit Card", "3 – 5 business days"],
                ["Bank Transfer", "3 – 7 business days"],
                ["Nextdor Store Credit", "Instant"],
              ].map(([method, timeline]) => (
                <tr key={method} className="hover:bg-zinc-50/50">
                  <td className="py-3 font-medium text-zinc-900">{method}</td>
                  <td className="py-3 text-zinc-500">{timeline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-sm text-zinc-500">
        Need help with a return?{" "}
        <Link href="/contact" className="font-medium text-[#007185] hover:underline">
          Contact our team
        </Link>
        {" "}— we&apos;re happy to help.
      </div>
    </div>
  );
}
