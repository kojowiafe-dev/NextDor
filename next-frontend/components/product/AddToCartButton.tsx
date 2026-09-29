"use client";

import type { Product } from "@/lib/catalog/types";
import { useCart } from "@/context/CartContext";
import { PriceDisplay } from "./PriceDisplay";

type AddToCartButtonProps = {
  product: Product;
};

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart();

  function handleClick() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0]?.src ?? "",
      price: product.price,
      currency: product.currency,
    });
  }

  return (
    <div className="space-y-4">
      <PriceDisplay product={product} size="lg" />

      <button
        type="button"
        onClick={handleClick}
        disabled={!product.inStock}
        className="w-full whitespace-nowrap rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804] disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {product.inStock ? "Add to Cart" : "Out of Stock"}
      </button>
    </div>
  );
}
