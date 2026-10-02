"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, User, MapPin, Heart, ArrowRight, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { OrderCard, type AccountOrderSummary } from "@/components/account/OrderCard";
import { useAuth } from "@/context/AuthContext";
import { fetchMyOrders } from "@/lib/orders/api";

const quickLinks = [
  { label: "My Orders", href: "/account/orders", icon: Package, desc: "Track & manage orders" },
  { label: "My Profile", href: "/account/profile", icon: User, desc: "Edit personal details" },
  { label: "Addresses", href: "/account/addresses", icon: MapPin, desc: "Saved delivery addresses" },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart, desc: "Items you love" },
];

export default function AccountPage() {
  const { user, token } = useAuth();
  const [recentOrders, setRecentOrders] = useState<AccountOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadOrders() {
      if (!token) {
        setRecentOrders([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetchMyOrders(token, 1, 3);
        if (!isMounted) return;
        if (Array.isArray(res.orders)) {
          const mapped: AccountOrderSummary[] = res.orders.map((o: any) => ({
            id: o.number || o.id,
            date: new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(o.createdAt)),
            status: o.status.toLowerCase() as any,
            items: (o.items || []).map((it: any) => ({
              name: it.productName,
              quantity: it.quantity,
            })),
            total: Number(o.total || 0),
            currency: o.currency || "GHS",
          }));
          setRecentOrders(mapped);
        } else {
          setRecentOrders([]);
        }
      } catch (err) {
        console.error("Failed to load customer orders:", err);
        setRecentOrders([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOrders();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <AccountLayout>
      {/* Welcome banner */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-[#232f3e] to-[#37475a] p-6 text-white">
        <p className="text-sm font-medium text-[#ff9900]">Welcome back 👋</p>
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

        {isLoading ? (
          <div className="flex h-28 items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#ff9900]" />
            <span>Loading orders...</span>
          </div>
        ) : recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">No orders placed yet.</p>
            <Link
              href="/shop"
              className="mt-3 inline-block rounded-lg bg-[#ff9900] px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-[#e68a00]"
            >
              Start shopping
            </Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
