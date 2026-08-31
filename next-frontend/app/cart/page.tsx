"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();
  const currency = items[0]?.currency ?? "GHS";

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Your Cart</h1>
        <p className="mt-4 text-zinc-500">Your cart is empty.</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Your Cart</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex gap-4 rounded-lg bg-white p-4 shadow-sm"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-50">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                    No image
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col">
                <Link
                  href={`/product/${item.slug}`}
                  className="font-medium text-zinc-900 hover:text-[#c7511f]"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm font-semibold text-[#b12704]">
                  {formatPrice(item.price, item.currency)}
                </p>

                <div className="mt-auto flex items-center gap-3">
                  <div className="flex items-center rounded border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      className="p-1.5 hover:bg-zinc-50"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      className="p-1.5 hover:bg-zinc-50"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Order Summary</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-zinc-600">Subtotal</span>
            <span className="font-semibold">
              {formatPrice(subtotal, currency)}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Shipping and taxes calculated at checkout.
          </p>
          <Link
            href="/checkout"
            className="mt-4 block w-full rounded-lg bg-[#ff9900] px-6 py-3 text-center text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
          >
            Proceed to Checkout
          </Link>
          <Link
            href="/shop"
            className="mt-3 block text-center text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
