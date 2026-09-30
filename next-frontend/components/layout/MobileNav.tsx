"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, User, Package, LogOut, LogIn, ShieldCheck, Store } from "lucide-react";
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
        className="flex items-center justify-center rounded p-1 hover:bg-white/10 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={close}
            aria-label="Close menu"
          />

          <aside className="relative flex h-full w-[min(85vw,320px)] flex-col bg-[#232f3e] text-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <Link href="/" onClick={close} className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="NextDor"
                  width={110}
                  height={30}
                  className="h-6 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={close}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Auth section */}
            <div className="border-b border-white/10 px-2 py-2">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff9900] text-sm font-bold text-[#131921]">
                      {user?.avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user?.name}</p>
                      <p className="truncate text-xs text-zinc-400">{user?.email}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={close}
                      className="my-1 flex items-center justify-between rounded-lg bg-[#ff9900]/20 border border-[#ff9900]/40 px-3 py-2 text-sm font-bold text-[#ff9900] hover:bg-[#ff9900]/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-4 w-4 text-[#ff9900]" />
                        <span>Admin Portal</span>
                      </div>
                      <span className="rounded bg-[#ff9900] px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-900 uppercase">
                        Admin
                      </span>
                    </Link>
                  )}

                  {isVendor && (
                    <Link
                      href="/vendor/dashboard"
                      onClick={close}
                      className="my-1 flex items-center justify-between rounded-lg bg-purple-500/20 border border-purple-400/40 px-3 py-2 text-sm font-bold text-purple-300 hover:bg-purple-500/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <Store className="h-4 w-4 text-purple-400" />
                        <span>Vendor Portal</span>
                      </div>
                      <span className="rounded bg-purple-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
                        Merchant
                      </span>
                    </Link>
                  )}

                  {!isVendor && !isAdmin && (
                    <Link
                      href="/vendor/register"
                      onClick={close}
                      className="my-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-white/10"
                    >
                      <Store className="h-4 w-4 text-purple-400" />
                      <span>Sell on Nextdor</span>
                    </Link>
                  )}

                  <Link
                    href="/account"
                    onClick={close}
                    className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-white/10"
                  >
                    <User className="h-4 w-4 text-zinc-400" />
                    My Account
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={close}
                    className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-white/10"
                  >
                    <Package className="h-4 w-4 text-zinc-400" />
                    My Orders
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      close();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-red-400 hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-2 py-2">
                  <Link
                    href="/login"
                    onClick={close}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-3 py-2 text-sm font-semibold text-zinc-900"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={close}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Categories */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Shop by Category
              </p>
              <Link
                href="/shop"
                onClick={close}
                className="block rounded px-3 py-2.5 font-semibold hover:bg-white/10"
              >
                All Products
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  onClick={close}
                  className="block rounded px-3 py-2.5 hover:bg-white/10"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
