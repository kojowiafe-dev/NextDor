"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, Check, Plus, Minus, Clock } from "lucide-react";
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

  const isBackorder = product.stockStatus === "BACKORDER" || (!product.inStock && Boolean(product.allowBackorder));
  const canPurchase = product.inStock || isBackorder;

  // Maximum physical units available (null = unlimited or external sync)
  const maxStock = !isBackorder && product.stockQty !== null && product.stockQty !== undefined
    ? product.stockQty
    : null;

  const isAtMaxQuantity = maxStock !== null && quantity >= maxStock;

  function handleAddToCart() {
    if (!canPurchase) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.src ?? "",
        price: product.price,
        currency: product.currency,
        maxQty: maxStock,
        isBackorder,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  }

  function handleBuyNow() {
    if (!canPurchase) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.src ?? "",
        price: product.price,
        currency: product.currency,
        maxQty: maxStock,
        isBackorder,
      },
      quantity
    );
    router.push("/checkout");
  }

  return (
    <div className="space-y-4">
      {canPurchase && (
        <div className="space-y-2">
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
                onClick={() => setQuantity((q) => (maxStock !== null ? Math.min(q + 1, maxStock) : q + 1))}
                disabled={isAtMaxQuantity}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-700 shadow-2xs hover:bg-zinc-100 disabled:opacity-40 transition"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {isAtMaxQuantity && maxStock !== null && (
              <span className="text-[11px] font-medium text-amber-700">
                Max available limit ({maxStock})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons: Add to Cart + Buy Now */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canPurchase}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all duration-200 shadow-xs active:scale-[0.98] ${
            justAdded
              ? "bg-emerald-600 text-white"
              : product.inStock
              ? "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804] cursor-pointer"
              : isBackorder
              ? "bg-amber-600 text-white hover:bg-amber-500 cursor-pointer shadow-sm"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Added to Cart!</span>
            </>
          ) : product.inStock ? (
            <>
              <ShoppingCart className="h-4 w-4" />
              <span>Add to Cart</span>
            </>
          ) : isBackorder ? (
            <>
              <Clock className="h-4 w-4" />
              <span>Backorder Now</span>
            </>
          ) : (
            <span>Out of Stock</span>
          )}
        </button>

        {canPurchase && (
          <button
            type="button"
            onClick={handleBuyNow}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffa41c] py-3 px-4 text-sm font-bold text-zinc-950 shadow-xs hover:bg-[#fa8900] transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 fill-zinc-950" />
            <span>{isBackorder ? "Pre-Order Now" : "Buy Now"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
