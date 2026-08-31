import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Clock, MapPin, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Shipping Information",
  description:
    "Learn about NextDor delivery zones, timelines, and shipping costs across Ghana.",
};

const zones = [
  {
    region: "Greater Accra",
    cities: "Accra, Tema, Kasoa, Madina",
    timeframe: "Same day – 1 business day",
    cost: "GHS 15 – 25",
    highlight: true,
  },
  {
    region: "Ashanti",
    cities: "Kumasi, Obuasi, Ejisu",
    timeframe: "1 – 2 business days",
    cost: "GHS 30 – 45",
    highlight: false,
  },
  {
    region: "Western",
    cities: "Takoradi, Sekondi, Tarkwa",
    timeframe: "2 – 3 business days",
    cost: "GHS 35 – 50",
    highlight: false,
  },
  {
    region: "Central",
    cities: "Cape Coast, Winneba, Saltpond",
    timeframe: "1 – 2 business days",
    cost: "GHS 30 – 45",
    highlight: false,
  },
  {
    region: "Other Regions",
    cities: "All remaining regions",
    timeframe: "3 – 5 business days",
    cost: "GHS 50 – 80",
    highlight: false,
  },
];

const faqs = [
  {
    q: "When does my order ship?",
    a: "Orders placed before 12pm on business days are dispatched the same day. Orders placed after 12pm or on weekends ship the next business day.",
  },
  {
    q: "Do you offer free shipping?",
    a: "Yes! Orders above GHS 500 qualify for free standard shipping within Greater Accra. Orders to other regions receive a GHS 20 discount.",
  },
  {
    q: "Can I track my order?",
    a: "Once your order is dispatched, you will receive a tracking number via email and SMS. You can also track it from your account dashboard under My Orders.",
  },
  {
    q: "What if I'm not home at delivery?",
    a: "Our delivery partner will attempt delivery up to 2 times. If unsuccessful, the order will be held at the nearest pickup point for 5 days.",
  },
];

export default function ShippingInfoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] hover:underline">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-zinc-900">Shipping Information</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Shipping Information</h1>
        <p className="mt-2 text-zinc-500">
          We deliver quality products across Ghana. Here&apos;s everything you need to know.
        </p>
      </div>

      {/* Key highlights */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Truck, title: "Nationwide Delivery", desc: "We ship to all 16 regions of Ghana" },
          { icon: Clock, title: "Fast Dispatch", desc: "Same-day dispatch for orders before 12pm" },
          { icon: MapPin, title: "Real-time Tracking", desc: "Track your order every step of the way" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3e0]">
              <Icon className="h-6 w-6 text-[#ff9900]" />
            </div>
            <p className="font-semibold text-zinc-900">{title}</p>
            <p className="mt-1 text-sm text-zinc-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Delivery zones table */}
      <div className="mb-8 rounded-xl bg-white shadow-sm ring-1 ring-zinc-100 overflow-hidden">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="font-semibold text-zinc-900">Delivery Zones &amp; Costs</h2>
          <p className="text-sm text-zinc-500">Costs are estimates and may vary by exact location.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3 text-left">Region</th>
                <th className="px-5 py-3 text-left">Areas Covered</th>
                <th className="px-5 py-3 text-left">Delivery Time</th>
                <th className="px-5 py-3 text-left">Shipping Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {zones.map((zone) => (
                <tr key={zone.region} className={zone.highlight ? "bg-[#fff8ee]" : "hover:bg-zinc-50/50"}>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-zinc-900">{zone.region}</span>
                    {zone.highlight && (
                      <span className="ml-2 rounded-full bg-[#ff9900] px-2 py-0.5 text-xs font-semibold text-zinc-900">
                        Express
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">{zone.cities}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-700">{zone.timeframe}</td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{zone.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free shipping callout */}
      <div className="mb-8 flex items-start gap-3 rounded-xl bg-green-50 p-5 ring-1 ring-green-200">
        <Truck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">Free Shipping on Orders over GHS 500</p>
          <p className="mt-0.5 text-sm text-green-700">
            Qualifying orders within Greater Accra ship free. Other regions receive a GHS 20 discount.
          </p>
        </div>
      </div>

      {/* FAQs */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="mb-5 font-semibold text-zinc-900">Frequently Asked Questions</h2>
        <div className="space-y-5">
          {faqs.map(({ q, a }) => (
            <div key={q}>
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9900]" />
                <p className="font-medium text-zinc-900">{q}</p>
              </div>
              <p className="ml-6 mt-1 text-sm text-zinc-500">{a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-zinc-500">
        Still have questions?{" "}
        <Link href="/contact" className="font-medium text-[#007185] hover:underline">
          Contact our support team
        </Link>
      </div>
    </div>
  );
}
