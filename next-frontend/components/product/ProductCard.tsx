"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Check, CheckCircle2, AlertCircle, Heart } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { stripHtml } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { PriceDisplay } from "./PriceDisplay";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);

  const liked = isInWishlist(product.id);
  const cartItem = items.find((entry) => entry.productId === product.id);
  const inCartQty = cartItem ? cartItem.quantity : 0;
  const discount = getDiscountPercent(product);

  const image = product.images?.[0];
  const description = stripHtml(
    product.shortDescription || product.description || "",
  ).slice(0, 80);

  const isBackorder = product.stockStatus === "BACKORDER" || (!product.inStock && Boolean(product.allowBackorder));
  const canAddToCart = product.inStock || isBackorder;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canAddToCart) return;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: image?.src || "/file.svg",
      price: product.price,
      currency: product.currency,
      maxQty: !isBackorder && product.stockQty !== null && product.stockQty !== undefined ? product.stockQty : null,
      isBackorder,
    });

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1400);
  }

  function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: image?.src || "",
    });
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3.5 shadow-xs ring-1 ring-zinc-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[#ff9900]/30">
      {/* Top Badges: Sale Discount & In-Stock Availability */}
      <div className="mb-1.5 sm:mb-2 flex items-center justify-between gap-1">
        {product.onSale && discount > 0 ? (
          <span className="rounded-md bg-[#cc0c39] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white">
            -{discount}%
          </span>
        ) : (
          <span />
        )}
        <div className="ml-auto">
          {product.stockQty !== null && product.stockQty !== undefined && product.stockQty > 0 && product.stockQty <= 5 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-800 border border-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {product.stockQty} left
            </span>
          ) : product.inStock ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
              In Stock
            </span>
          ) : isBackorder ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-700 border border-amber-200/80">
              Backorder
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-zinc-500">
              <AlertCircle className="h-2.5 w-2.5 text-zinc-400" />
              Sold Out
            </span>
          )}
        </div>
      </div>

      {/* Product Image & Wishlist Button Container */}
      <div className="relative mb-2 sm:mb-3 aspect-square overflow-hidden rounded-lg sm:rounded-xl bg-zinc-50 transition-colors group-hover:bg-[#ff9900]/5">
        <Link
          href={`/product/${product.slug}`}
          className="block h-full w-full"
        >
          {image && image.src ? (
            <Image
              src={image.src}
              alt={image.alt || product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-medium text-zinc-400">
              No image
            </div>
          )}
        </Link>

        {/* Wishlist / Like Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          title={liked ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs shadow-2xs ring-1 transition-all duration-200 hover:scale-110 cursor-pointer touch-manipulation ${
            liked
              ? "text-rose-600 ring-rose-200 bg-rose-50/90"
              : "text-zinc-400 ring-zinc-200/80 hover:text-rose-600 hover:bg-white"
          }`}
        >
          <Heart
            className={`h-3.5 w-3.5 transition-transform ${
              liked ? "fill-rose-600 stroke-rose-600 scale-105" : "stroke-[2]"
            }`}
          />
        </button>
      </div>

      {/* Title & Description */}
      <div className="flex flex-1 flex-col">
        <Link
          href={`/product/${product.slug}`}
          className="line-clamp-2 text-xs sm:text-sm font-semibold text-zinc-900 leading-snug transition-colors hover:text-[#c7511f]"
          title={product.name}
        >
          {product.name}
        </Link>

        {description && (
          <p className="mt-1 hidden sm:line-clamp-1 text-xs text-zinc-500">{description}</p>
        )}

        {/* Rating */}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
          <div className="flex text-[#ff9900]">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-3 w-3 ${
                  product.reviewCount > 0 && index < Math.round(product.rating)
                    ? "fill-current"
                    : "fill-zinc-100 text-zinc-300"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] sm:text-[11px] text-zinc-400">
            ({product.reviewCount || 0})
          </span>
        </div>

        {/* Price */}
        <div className="mt-2 sm:mt-2.5">
          <PriceDisplay product={product} size="sm" />
        </div>
      </div>

      {/* 1-Click Purchase / Add to Cart Action */}
      <div className="mt-2.5 sm:mt-3.5 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-all duration-200 shadow-2xs touch-manipulation ${
            justAdded
              ? "bg-emerald-600 text-white"
              : product.inStock
              ? "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804] active:bg-[#e47911] cursor-pointer"
              : isBackorder
              ? "bg-amber-600 text-white hover:bg-amber-500 cursor-pointer"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Added!</span>
            </>
          ) : product.inStock ? (
            <>
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {inCartQty > 0 ? `Add More (${inCartQty})` : "Add to Cart"}
              </span>
            </>
          ) : isBackorder ? (
            <>
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span>Backorder</span>
            </>
          ) : (
            <span>Sold Out</span>
          )}
        </button>
      </div>
    </div>
  );
}
