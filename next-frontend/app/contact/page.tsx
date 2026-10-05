import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Nextdor team. We're here to help with orders, deliveries, and anything else.",
};

import { SITE_CONFIG } from "@/lib/constants/siteConfig";

const contactDetails = [
  {
    icon: Phone,
    label: "Phone Support",
    value: SITE_CONFIG.phoneDisplay,
    sub: "Mon–Sat, 8am–6pm GMT",
    href: `tel:${SITE_CONFIG.phone}`,
  },
  {
    icon: Mail,
    label: "Email Us",
    value: SITE_CONFIG.email,
    sub: "Fast response within 24 hours",
    href: `mailto:${SITE_CONFIG.email}`,
  },
  {
    icon: MapPin,
    label: "Office Address",
    value: SITE_CONFIG.address,
    sub: `${SITE_CONFIG.city}, ${SITE_CONFIG.region}, ${SITE_CONFIG.country}`,
  },
  {
    icon: Clock,
    label: "Business Hours",
    value: "Mon – Sat: 8:00 AM – 6:00 PM",
    sub: "Sunday: Closed",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] hover:underline">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-zinc-900">Contact Us</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Contact Us</h1>
        <p className="mt-2 text-zinc-500">
          Have a question or need help? We&apos;d love to hear from you.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Contact info cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {contactDetails.map(({ icon: Icon, label, value, sub }) => (
            <div
              key={label}
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff3e0]">
                <Icon className="h-5 w-5 text-[#ff9900]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {label}
              </p>
              <p className="mt-1 font-semibold text-zinc-900">{value}</p>
              <p className="text-sm text-zinc-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Send Us a Message</h2>
          <form className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="contact-name" className="block text-sm font-medium text-zinc-700">
                  Full name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  placeholder="Kwame Mensah"
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="contact-email" className="block text-sm font-medium text-zinc-700">
                  Email address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="contact-subject" className="block text-sm font-medium text-zinc-700">
                Subject
              </label>
              <select
                id="contact-subject"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              >
                <option value="">Select a topic</option>
                <option>Order enquiry</option>
                <option>Delivery issue</option>
                <option>Returns &amp; refunds</option>
                <option>Product question</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="contact-message" className="block text-sm font-medium text-zinc-700">
                Message
              </label>
              <textarea
                id="contact-message"
                rows={5}
                placeholder="Tell us how we can help..."
                className="w-full resize-none rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
            >
              Send Message
            </button>

            <p className="text-center text-xs text-zinc-400">
              We typically respond within 1 business day.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
