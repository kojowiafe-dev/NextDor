"use client";

import Link from "next/link";
import { MapPin, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SearchBar } from "./SearchBar";

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="bg-[#131921] text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight">
          next<span className="text-[#ff9900]">dor</span>
        </Link>

        <div className="hidden items-center gap-1 text-xs text-zinc-300 sm:flex">
          <MapPin className="h-4 w-4" />
          <div>
            <p className="text-[11px]">Deliver to</p>
            <p className="font-semibold text-white">Ghana</p>
          </div>
        </div>

        <SearchBar className="hidden md:flex" />

        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link
            href="/account"
            className="hidden items-center gap-1 hover:text-[#febd69] sm:flex"
          >
            <User className="h-5 w-5" />
            <div className="text-xs leading-tight">
              <p>Hello, sign in</p>
              <p className="font-semibold">Account</p>
            </div>
          </Link>

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
