import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";

type PriceDisplayProps = {
  product: Pick<Product, "price" | "regularPrice" | "currency" | "onSale">;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export function PriceDisplay({
  product,
  size = "md",
}: PriceDisplayProps) {
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${sizeClasses[size]}`}>
      <span className="font-semibold text-[#b12704]">
        {formatPrice(product.price, product.currency)}
      </span>
      {product.onSale && product.regularPrice && (
        <span className="text-sm text-zinc-500 line-through">
          {formatPrice(product.regularPrice, product.currency)}
        </span>
      )}
    </div>
  );
}
