"use client";

import Link from "next/link";
import { Package, User, MapPin, Heart, ArrowRight } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { OrderCard, type MockOrder } from "@/components/account/OrderCard";
import { useAuth } from "@/context/AuthContext";

// Mock recent orders — replace with real API fetch when backend is ready
const MOCK_RECENT_ORDERS: MockOrder[] = [
  {
    id: "ND-00123",
    date: "Aug 25, 2026",
    status: "delivered",
    items: [{ name: "JBL Wireless Speaker", quantity: 1 }],
    total: 450,
    currency: "GHS",
  },
  {
    id: "ND-00118",
    date: "Aug 14, 2026",
    status: "processing",
    items: [
      { name: "Nivea Body Lotion", quantity: 2 },
      { name: "Dove Shampoo", quantity: 1 },
    ],
    total: 120,
    currency: "GHS",
  },
];

const quickLinks = [
  { label: "My Orders", href: "/account/orders", icon: Package, desc: "Track & manage orders" },
  { label: "My Profile", href: "/account/profile", icon: User, desc: "Edit personal details" },
  { label: "Addresses", href: "/account/addresses", icon: MapPin, desc: "Saved delivery addresses" },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart, desc: "Items you love" },
];

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <AccountLayout>
      {/* Welcome banner */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-[#232f3e] to-[#37475a] p-6 text-white">
        <p className="text-sm font-medium text-[#febd69]">Welcome back 👋</p>
        <h1 className="mt-1 text-2xl font-bold">{user?.name ?? "Customer"}</h1>
        <p className="mt-1 text-sm text-zinc-300">{user?.email}</p>
      </div>

      {/* Quick links */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickLinks.map(({ label, href, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-zinc-100 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3e0]">
              <Icon className="h-5 w-5 text-[#ff9900]" />
            </div>
            <span className="text-sm font-semibold text-zinc-900">{label}</span>
            <span className="text-xs text-zinc-500">{desc}</span>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Recent Orders</h2>
          <Link
            href="/account/orders"
            className="flex items-center gap-1 text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {MOCK_RECENT_ORDERS.length > 0 ? (
          <div className="space-y-3">
            {MOCK_RECENT_ORDERS.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">No orders yet.</p>
            <Link
              href="/shop"
              className="mt-3 inline-block text-sm font-medium text-[#007185] hover:underline"
            >
              Start shopping
            </Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
