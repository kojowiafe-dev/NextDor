"use client";

import { useState } from "react";
import { Heart, ShoppingCart, Trash2, Check, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AccountLayout } from "@/components/account/AccountLayout";
import { formatPrice } from "@/lib/utils";
import { useWishlist } from "@/context/WishlistContext";
import { useCart } from "@/context/CartContext";

export default function WishlistPage() {
  const { items, removeFromWishlist, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  function handleAddToCart(item: any) {
    addItem({
      productId: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      currency: item.currency || "GHS",
      image: item.image,
    });
    setAddedIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [item.id]: false }));
    }, 2000);
  }

  function handleMoveAllToCart() {
    items.forEach((item) => {
      addItem({
        productId: item.id,
        slug: item.slug,
        name: item.name,
        price: item.price,
        currency: item.currency || "GHS",
        image: item.image,
      });
    });
    clearWishlist();
  }

  return (
    <AccountLayout>
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">My Wishlist</h2>
            <p className="text-sm text-zinc-500">
              {items.length} saved item{items.length !== 1 ? "s" : ""}
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleMoveAllToCart}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ff9900] px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm transition hover:bg-[#f08804] active:scale-95"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Move All to Cart</span>
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => {
              const isAdded = addedIds[item.id];
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-100 p-4 transition hover:shadow-sm hover:border-zinc-200"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Product image */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-50 border border-zinc-100">
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
                        className="line-clamp-2 text-sm font-semibold text-zinc-900 hover:text-[#c7511f]"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm font-bold text-[#b12704]">
                        {formatPrice(item.price, item.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                        isAdded
                          ? "bg-emerald-600 text-white"
                          : "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804] active:scale-95"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span>Add to Cart</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/product/${item.slug}`}
                      className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <span>Details</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeFromWishlist(item.id)}
                      className="flex items-center justify-center rounded-lg border border-zinc-200 p-2 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
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
