"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  User,
  MapPin,
  Heart,
  Lock,
  LogOut,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Overview", href: "/account", icon: LayoutDashboard },
  { label: "My Orders", href: "/account/orders", icon: Package },
  { label: "My Profile", href: "/account/profile", icon: User },
  { label: "My Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Change Password", href: "/account/password", icon: Lock },
];

export function AccountSidebar() {
  const router = useRouter();
  const { user, isAdmin, isVendor, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="flex h-fit flex-col rounded-xl bg-white shadow-sm">
      {/* User info */}
      <div className="flex items-center gap-3 border-b border-zinc-100 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-lg font-bold text-[#ff9900]">
          {user?.avatarInitials ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900">{user?.name}</p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
        </div>
      </div>

      {/* Management Portal Shortcut */}
      {isAdmin && (
        <div className="border-b border-zinc-100 bg-amber-50/60 p-3">
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-lg bg-amber-500/15 border border-amber-300/60 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-500/25 transition"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>Admin Portal</span>
            </div>
            <span className="rounded bg-[#ff9900] px-1.5 py-0.5 text-[10px] font-bold text-zinc-900 uppercase">
              Admin
            </span>
          </Link>
        </div>
      )}

      {isVendor && !isAdmin && (
        <div className="border-b border-zinc-100 bg-purple-50/60 p-3">
          <Link
            href="/vendor/dashboard"
            className="flex items-center justify-between rounded-lg bg-purple-500/15 border border-purple-300/60 px-3 py-2 text-xs font-bold text-purple-900 hover:bg-purple-500/25 transition"
          >
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-purple-600" />
              <span>Vendor Portal</span>
            </div>
            <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
              Merchant
            </span>
          </Link>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/account" ? pathname === "/account" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#fff3e0] text-[#c7511f]"
                  : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-[#ff9900]" : "text-zinc-400"}`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-zinc-100 p-3">
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 shrink-0 text-zinc-400" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom tab bar (shows only primary items)
const mobileNavItems = [
  { label: "Overview", href: "/account", icon: LayoutDashboard },
  { label: "Orders", href: "/account/orders", icon: Package },
  { label: "Profile", href: "/account/profile", icon: User },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
];

export function AccountBottomNav() {
  const router = useRouter();
  const { logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white px-2 pb-safe md:hidden">
      <div className="flex items-center justify-around">
        {mobileNavItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/account" ? pathname === "/account" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-3 text-xs font-medium transition-colors ${
                isActive ? "text-[#ff9900]" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex flex-col items-center gap-1 px-3 py-3 text-xs font-medium text-zinc-500 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
