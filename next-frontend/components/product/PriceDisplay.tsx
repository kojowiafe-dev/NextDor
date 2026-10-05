import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";

type PriceDisplayProps = {
  product: Pick<Product, "price" | "regularPrice" | "currency" | "onSale">;
  size?: "sm" | "md" | "lg";
  showDiscountBadge?: boolean;
};

const sizeClasses = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export function PriceDisplay({
  product,
  size = "md",
  showDiscountBadge = true,
}: PriceDisplayProps) {
  // A product is on discount only if regularPrice exists and is strictly greater than current price
  const hasPreviousPrice = Boolean(
    product.regularPrice &&
    Number(product.regularPrice) > Number(product.price)
  );

  const discountPercentage = hasPreviousPrice
    ? Math.round(
        ((Number(product.regularPrice) - Number(product.price)) /
          Number(product.regularPrice)) *
          100
      )
    : 0;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${sizeClasses[size]}`}>
      {/* Current selling price */}
      <span className="font-bold text-[#b12704]">
        {formatPrice(product.price, product.currency)}
      </span>

      {/* Cancelled / Strikethrough Previous Price & Percentage Change */}
      {hasPreviousPrice && (
        <>
          <span className="text-xs sm:text-sm font-normal text-zinc-400 line-through">
            {formatPrice(product.regularPrice!, product.currency)}
          </span>
          {showDiscountBadge && discountPercentage > 0 && (
            <span className="inline-flex items-center rounded-md bg-red-50 border border-red-200/80 px-1.5 py-0.5 text-[11px] font-extrabold text-red-600 shadow-2xs">
              -{discountPercentage}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
