"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingBag, Trash2, Plus, Minus, ShieldCheck, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const { items, itemCount, subtotal, isDrawerOpen, closeDrawer, updateQty, removeItem } = useCart();

  useEffect(() => {
    if (!isDrawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-label="Shopping Cart Drawer"
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-[#131921] px-4 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#ff9900]" />
            <h2 className="text-sm sm:text-base font-bold">
              Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart drawer"
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Escrow Notice */}
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 border-b border-emerald-100">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Protected by 48-Hour Nextdor Buyer Escrow</span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="h-12 w-12 text-zinc-300 mb-3" />
              <p className="text-sm font-semibold text-zinc-800">Your cart is empty</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Add items from the marketplace to get started.</p>
              <Link
                href="/shop"
                onClick={closeDrawer}
                className="rounded-lg bg-[#ffd814] px-4 py-2 text-xs font-bold text-[#0f1111] hover:bg-[#f7ca00]"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <Link
                  href={`/product/${item.slug}`}
                  onClick={closeDrawer}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-50 border border-zinc-100"
                >
                  <Image
                    src={item.image || "/placeholder.png"}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </Link>

                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={closeDrawer}
                      className="text-xs sm:text-sm font-semibold text-zinc-900 line-clamp-2 hover:text-[#c7511f]"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-sm font-bold text-[#0f1111]">
                      {formatPrice(item.price, item.currency || "GHS")}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50">
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="p-1.5 text-zinc-600 hover:text-zinc-900"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-2.5 text-xs font-bold text-zinc-900">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-1.5 text-zinc-600 hover:text-zinc-900"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Remove ${item.name}`}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-600">Subtotal</span>
              <span className="text-lg font-extrabold text-zinc-900">
                {formatPrice(subtotal, items[0]?.currency || "GHS")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition"
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ffd814] px-3 py-2.5 text-xs sm:text-sm font-bold text-[#0f1111] hover:bg-[#f7ca00] transition"
              >
                <span>Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

