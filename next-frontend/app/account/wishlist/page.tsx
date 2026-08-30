"use client";

import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { formatPrice } from "@/lib/utils";

type WishlistItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  image: string;
};

// Mock wishlist — replace with real API / context when backend is ready
const INITIAL_WISHLIST: WishlistItem[] = [
  {
    id: "w1",
    slug: "jbl-wireless-speaker",
    name: "JBL Wireless Bluetooth Speaker",
    price: 450,
    currency: "GHS",
    image: "",
  },
  {
    id: "w2",
    slug: "hp-laptop-15",
    name: "HP 15.6\" Laptop – Intel Core i5",
    price: 3800,
    currency: "GHS",
    image: "",
  },
];

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>(INITIAL_WISHLIST);

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">My Wishlist</h2>
          <p className="text-sm text-zinc-500">
            {items.length} saved item{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-100 p-4 transition-shadow hover:shadow-sm"
              >
                {/* Product image / placeholder */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-50">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Heart className="h-6 w-6 text-zinc-300" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <Link
                    href={`/product/${item.slug}`}
                    className="line-clamp-2 text-sm font-medium text-zinc-900 hover:text-[#c7511f]"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm font-semibold text-[#b12704]">
                    {formatPrice(item.price, item.currency)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/product/${item.slug}`}
                    className="flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-[#f08804]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Heart className="mx-auto mb-3 h-12 w-12 text-zinc-200" />
            <p className="font-medium text-zinc-700">Your wishlist is empty</p>
            <p className="mt-1 text-sm text-zinc-500">
              Save items you love and find them here later.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-[#ff9900] px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
            >
              Browse Products
            </Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
