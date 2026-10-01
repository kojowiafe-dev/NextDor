"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Check, CheckCircle2, AlertCircle } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { stripHtml } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";
import { useCart } from "@/context/CartContext";
import { PriceDisplay } from "./PriceDisplay";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const cartItem = items.find((entry) => entry.productId === product.id);
  const inCartQty = cartItem ? cartItem.quantity : 0;
  const discount = getDiscountPercent(product);

  const image = product.images?.[0];
  const description = stripHtml(
    product.shortDescription || product.description || "",
  ).slice(0, 80);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) return;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: image?.src || "/file.svg",
      price: product.price,
      currency: product.currency,
    });

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1400);
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-amber-500/30">
      {/* Top Badges: Sale Discount & In-Stock Availability */}
      <div className="mb-2 flex items-center justify-between gap-1.5">
        {product.onSale ? (
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
            {discount > 0 ? `-${discount}%` : "SALE"}
          </span>
        ) : (
          <span />
        )}
        <div className="ml-auto">
          {product.inStock ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              In Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              <AlertCircle className="h-3 w-3 text-zinc-400" />
              Out of Stock
            </span>
          )}
        </div>
      </div>

      {/* Product Image Clickable Link */}
      <Link
        href={`/product/${product.slug}`}
        className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-zinc-50 transition-colors group-hover:bg-amber-500/5 block"
      >
        {image && image.src ? (
          <Image
            src={image.src}
            alt={image.alt || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium text-zinc-400">
            No image
          </div>
        )}
      </Link>

      {/* Title & Description */}
      <div className="flex flex-1 flex-col">
        <Link
          href={`/product/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold text-zinc-900 transition-colors hover:text-[#c7511f]"
          title={product.name}
        >
          {product.name}
        </Link>

        {description && (
          <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{description}</p>
        )}

        {/* Rating */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
          <div className="flex text-[#ff9900]">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-3 w-3 ${
                  index < Math.round(product.rating || 4.5)
                    ? "fill-current"
                    : "fill-zinc-200 text-zinc-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px]">({product.reviewCount || 12})</span>
        </div>

        {/* Price */}
        <div className="mt-3">
          <PriceDisplay product={product} size="sm" />
        </div>
      </div>

      {/* 1-Click Purchase / Add to Cart Action */}
      <div className="mt-4 pt-2.5 border-t border-zinc-100">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-95 shadow-xs ${
            justAdded
              ? "bg-emerald-600 text-white"
              : product.inStock
              ? "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804] hover:shadow-amber-500/25 cursor-pointer"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Added to Cart!</span>
            </>
          ) : product.inStock ? (
            <>
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>
                {inCartQty > 0 ? `Add Another (${inCartQty})` : "Add to Cart"}
              </span>
            </>
          ) : (
            <span>Out of Stock</span>
          )}
        </button>
      </div>
    </div>
  );
}
