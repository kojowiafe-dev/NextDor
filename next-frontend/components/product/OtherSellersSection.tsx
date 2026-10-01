import Link from "next/link";
import { Store, ShieldCheck, Star, ArrowRight, Tag } from "lucide-react";
import type { OtherSellerOffer } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";

type OtherSellersSectionProps = {
  sellers: OtherSellerOffer[];
  currentPrice: number;
  productName: string;
};

export function OtherSellersSection({
  sellers,
  currentPrice,
  productName,
}: OtherSellersSectionProps) {
  if (!sellers || sellers.length === 0) return null;

  return (
    <section className="my-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff3e0] text-[#ff9900] ring-1 ring-[#ff9900]/20">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
                Other Sellers on NextDor
              </h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                {sellers.length} alternative offer{sellers.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Multiple accredited merchants offer &quot;{productName}&quot; with localized delivery
            </p>
          </div>
        </div>
      </div>

      {/* Seller Offers Table / List */}
      <div className="divide-y divide-zinc-100">
        {sellers.map((seller) => {
          const priceDiff = currentPrice - seller.price;
          const isCheaper = priceDiff > 0;

          return (
            <div
              key={seller.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              {/* Seller details */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 font-bold">
                  {seller.vendor.logoUrl ? (
                    <img
                      src={seller.vendor.logoUrl}
                      alt={seller.vendor.name}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <Store className="h-5 w-5 text-zinc-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/store/${seller.vendor.slug}`}
                      className="font-semibold text-zinc-900 text-sm hover:text-[#007185] hover:underline"
                    >
                      {seller.vendor.name}
                    </Link>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Verified
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <div className="flex items-center gap-1 text-[#ff9900]">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="font-semibold text-zinc-700">
                        {seller.vendor.rating ? seller.vendor.rating.toFixed(1) : "4.9"}
                      </span>
                    </div>
                    <span>•</span>
                    <span className="inline-flex items-center shrink-0 whitespace-nowrap text-emerald-700 font-medium">
                      In Stock
                    </span>
                  </div>
                </div>
              </div>

              {/* Price comparison & action */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-base font-extrabold text-zinc-900">
                    {formatPrice(seller.price, seller.currency)}
                  </div>
                  {isCheaper ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
                      <Tag className="h-3 w-3" />
                      Save {formatPrice(priceDiff, seller.currency)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Standard Seller</span>
                  )}
                </div>

                <Link
                  href={`/product/${seller.slug}`}
                  className="flex items-center gap-1 rounded-lg bg-[#ff9900] px-3.5 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-[#f08804] transition"
                >
                  <span>View Offer</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
