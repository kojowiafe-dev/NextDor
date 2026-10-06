"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  User,
  Package,
  LogOut,
  LogIn,
  ShieldCheck,
  Store,
  ChevronRight,
  Truck,
  Heart,
  HelpCircle,
  Sparkles,
  Flame,
} from "lucide-react";
import type { Category } from "@/lib/catalog/types";
import { useAuth } from "@/context/AuthContext";

type MobileNavProps = {
  categories: Category[];
};

export function MobileNav({ categories }: MobileNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, isAdmin, isVendor, logout } = useAuth();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-lg p-1.5 text-white hover:bg-white/10 active:scale-95 transition"
        aria-label="Open mobile menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={close}
            aria-label="Close menu"
          />

          {/* Drawer Sidebar */}
          <aside className="relative flex h-full w-[min(85vw,340px)] flex-col bg-[#131921] text-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header with NextDor logo and close button */}
            <div className="flex h-15 items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0d1117]">
              <Link href="/" onClick={close} className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="NextDor"
                  width={115}
                  height={32}
                  className="h-7 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Auth / Profile Bar */}
            <div className="border-b border-white/10 p-3 bg-[#1b222d]">
              {isAuthenticated ? (
                <div>
                  <div className="flex items-center gap-3 px-1 py-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff9900] text-sm font-bold text-[#131921] shadow-sm">
                      {user?.avatarInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white leading-tight">
                        {user?.name}
                      </p>
                      <p className="truncate text-xs text-zinc-400">{user?.email}</p>
                    </div>
                  </div>

                  {/* Portal Badges */}
                  <div className="mt-2.5 space-y-1.5">
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={close}
                        className="flex items-center justify-between rounded-lg bg-[#ff9900]/20 border border-[#ff9900]/40 px-3 py-2 text-xs font-bold text-[#ff9900] hover:bg-[#ff9900]/30 transition"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-[#ff9900]" />
                          <span>Admin Portal</span>
                        </div>
                        <span className="rounded bg-[#ff9900] px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-950 uppercase">
                          Console
                        </span>
                      </Link>
                    )}

                    {isVendor && (
                      <Link
                        href="/vendor/dashboard"
                        onClick={close}
                        className="flex items-center justify-between rounded-lg bg-purple-500/20 border border-purple-400/40 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/30 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-purple-400" />
                          <span>Vendor Portal</span>
                        </div>
                        <span className="rounded bg-purple-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white uppercase">
                          Merchant
                        </span>
                      </Link>
                    )}

                    {!isVendor && !isAdmin && (
                      <Link
                        href="/vendor/register"
                        onClick={close}
                        className="flex items-center justify-between rounded-lg bg-purple-500/10 border border-purple-400/20 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-purple-400" />
                          <span>Sell on Nextdor</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    onClick={close}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ff9900] px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f08804] transition"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={close}
                    className="flex flex-1 items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Customer Links */}
            <div className="border-b border-white/10 px-2 py-2 text-xs">
              <Link
                href="/account/orders"
                onClick={close}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-[#ff9900]" />
                  <span>My Orders</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              </Link>
              <Link
                href="/account/wishlist"
                onClick={close}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="h-4 w-4 text-rose-400" />
                  <span>My Wishlist</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              </Link>
              <Link
                href="/account"
                onClick={close}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-blue-400" />
                  <span>Account Settings</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              </Link>
            </div>

            {/* Shop by Category List */}
            <nav className="flex-1 overflow-y-auto px-2 py-2">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Categories
              </p>
              <Link
                href="/shop"
                onClick={close}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-white hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[#ff9900]" />
                  <span>All Products</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              </Link>
              <Link
                href="/deals"
                onClick={close}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-[#ff9900] hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-[#ff9900]" />
                  <span>Today&apos;s Deals</span>
                </div>
                <span className="rounded bg-[#cc0c39] px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                  Hot
                </span>
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  onClick={close}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
                >
                  <span className="truncate">{category.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                </Link>
              ))}
            </nav>

            {/* Bottom Footer Section */}
            <div className="border-t border-white/10 p-3 bg-[#0d1117] text-xs space-y-1">
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    close();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-400 hover:bg-red-500/10 transition font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              )}
              <div className="pt-1 text-[11px] text-zinc-500 text-center">
                NextDor Ghana • Shop More, Wait Less
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
