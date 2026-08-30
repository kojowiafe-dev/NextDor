"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MapPin, ShoppingCart, User, ChevronDown, LogOut, Package, Settings } from "lucide-react";
import type { Category } from "@/lib/catalog/types";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { MobileNav } from "./MobileNav";
import { SearchBar } from "./SearchBar";

type HeaderProps = {
  categories: Category[];
};

function AccountDropdown() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="hidden items-center gap-1 hover:text-[#febd69] sm:flex"
      >
        <User className="h-5 w-5" />
        <div className="text-xs leading-tight">
          <p>Hello, sign in</p>
          <p className="font-semibold">Account</p>
        </div>
      </Link>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "Account";

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="flex items-center gap-1 hover:text-[#febd69]"
        aria-expanded={open}
      >
        {/* Avatar initials */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff9900] text-xs font-bold text-[#131921]">
          {user?.avatarInitials}
        </div>
        <div className="text-xs leading-tight">
          <p>Hello, {firstName}</p>
          <p className="font-semibold flex items-center gap-0.5">
            Account <ChevronDown className="h-3 w-3" />
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-zinc-100">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="truncate font-semibold text-zinc-900 text-sm">{user?.name}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          {[
            { label: "My Account", href: "/account", icon: User },
            { label: "My Orders", href: "/account/orders", icon: Package },
            { label: "My Profile", href: "/account/profile", icon: Settings },
          ].map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Icon className="h-4 w-4 text-zinc-400" />
              {label}
            </Link>
          ))}
          <div className="border-t border-zinc-100 mt-1">
            <button
              type="button"
              onClick={() => { logout(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 text-zinc-400" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ categories }: HeaderProps) {
  const { itemCount } = useCart();

  return (
    <header className="bg-[#131921] text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <div className="flex shrink-0 items-center gap-1">
          <div className="md:hidden">
            <MobileNav categories={categories} />
          </div>
          <Link href="/" className="text-xl font-bold tracking-tight">
            next<span className="text-[#ff9900]">dor</span>
          </Link>
        </div>

        <div className="hidden items-center gap-1 text-xs text-zinc-300 sm:flex">
          <MapPin className="h-4 w-4" />
          <div>
            <p className="text-[11px]">Deliver to</p>
            <p className="font-semibold text-white">Ghana</p>
          </div>
        </div>

        <SearchBar className="hidden md:flex" />

        <div className="ml-auto flex items-center gap-4 text-sm">
          <AccountDropdown />

          <Link
            href="/cart"
            className="relative flex items-end gap-1 hover:text-[#febd69]"
          >
            <ShoppingCart className="h-7 w-7" />
            <span className="hidden font-semibold sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-1 left-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff9900] px-1 text-xs font-bold text-[#131921]">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="px-4 pb-2 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
