"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, Check, Plus, Minus } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { useCart } from "@/context/CartContext";

type AddToCartButtonProps = {
  product: Product;
};

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  function handleAddToCart() {
    if (!product.inStock) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.src ?? "",
        price: product.price,
        currency: product.currency,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  }

  function handleBuyNow() {
    if (!product.inStock) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.src ?? "",
        price: product.price,
        currency: product.currency,
      },
      quantity
    );
    router.push("/checkout");
  }

  return (
    <div className="space-y-4">
      {product.inStock && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-600">Quantity:</span>
          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-700 shadow-2xs hover:bg-zinc-100 disabled:opacity-40 transition"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-9 text-center text-xs font-bold text-zinc-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-700 shadow-2xs hover:bg-zinc-100 transition"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons: Add to Cart + Buy Now */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all duration-200 shadow-xs active:scale-[0.98] ${
            justAdded
              ? "bg-emerald-600 text-white"
              : product.inStock
              ? "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804] cursor-pointer"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Added to Cart!</span>
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              <span>{product.inStock ? "Add to Cart" : "Out of Stock"}</span>
            </>
          )}
        </button>

        {product.inStock && (
          <button
            type="button"
            onClick={handleBuyNow}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffa41c] py-3 px-4 text-sm font-bold text-zinc-950 shadow-xs hover:bg-[#fa8900] transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 fill-zinc-950" />
            <span>Buy Now</span>
          </button>
        )}
      </div>
    </div>
  );
}
