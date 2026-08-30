import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { stripHtml } from "@/lib/utils";
import { PriceDisplay } from "./PriceDisplay";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const image = product.images[0];
  const description = stripHtml(
    product.shortDescription || product.description,
  ).slice(0, 80);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-zinc-50">
        {product.onSale && (
          <span className="absolute left-2 top-2 z-10 rounded bg-[#cc0c39] px-2 py-0.5 text-xs font-bold text-white">
            SALE
          </span>
        )}
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-2 transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            No image
          </div>
        )}
      </div>

      <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 group-hover:text-[#c7511f]">
        {product.name}
      </h3>

      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{description}</p>
      )}

      <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
        <div className="flex text-[#ff9900]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-3 w-3 ${
                index < Math.round(product.rating)
                  ? "fill-current"
                  : "fill-zinc-200 text-zinc-200"
              }`}
            />
          ))}
        </div>
        <span>({product.reviewCount})</span>
      </div>

      <div className="mt-auto pt-2">
        <PriceDisplay product={product} size="sm" />
      </div>
    </Link>
  );
}
