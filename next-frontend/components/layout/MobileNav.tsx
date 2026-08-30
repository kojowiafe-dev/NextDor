"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, User, Package, LogOut, LogIn } from "lucide-react";
import type { Category } from "@/lib/catalog/types";
import { useAuth } from "@/context/AuthContext";

type MobileNavProps = {
  categories: Category[];
};

export function MobileNav({ categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

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
              <span className="font-semibold">
                {isAuthenticated ? `Hello, ${user?.name?.split(" ")[0]}` : "Browse NextDor"}
              </span>
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
                    onClick={() => { logout(); close(); }}
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
