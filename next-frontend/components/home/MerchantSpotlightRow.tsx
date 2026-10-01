import Link from "next/link";
import { Store, ShieldCheck, ArrowRight, Star, ChevronRight } from "lucide-react";
import type { MerchantGroup } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";

type MerchantSpotlightRowProps = {
  merchants: MerchantGroup[];
};

export function MerchantSpotlightRow({ merchants }: MerchantSpotlightRowProps) {
  if (!merchants || merchants.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 my-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/20">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900">
                Shop by Verified Merchants
              </h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                Multi-Tenant Stores
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Browse authentic inventories directly from accredited Ghanaian sellers and flagship outlets
            </p>
          </div>
        </div>

        <Link
          href="/shop"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
        >
          <span>View all stores & products</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Merchant Spotlight Cards Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {merchants.map((merchant) => {
          return (
            <div
              key={merchant.id}
              className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md"
            >
              {/* Store Header Banner */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 font-bold text-zinc-600 ring-1 ring-zinc-200">
                    {merchant.logoUrl ? (
                      <img src={merchant.logoUrl} alt={merchant.name} className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-6 w-6 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
                        {merchant.name}
                      </h3>
                      {merchant.isOfficial ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.2 text-[10px] font-bold text-amber-700 border border-amber-200">
                          <ShieldCheck className="h-3 w-3 text-[#ff9900]" />
                          Official Flagship
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Verified Seller
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-[#ff9900] text-[#ff9900]" />
                        <span className="font-semibold text-zinc-800">
                          {merchant.rating ? merchant.rating.toFixed(1) : "4.8"}
                        </span>
                      </div>
                      <span>•</span>
                      <span>{merchant.totalProducts} Products listed</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/store/${merchant.slug}`}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                >
                  <span>Visit Store</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </Link>
              </div>

              {/* Preview Products Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {merchant.products.slice(0, 4).map((p: any) => {
                  const imgUrl = p.images?.[0]?.url || "";
                  return (
                    <Link
                      key={p.id}
                      href={`/product/${p.slug}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50/50 p-2 transition hover:bg-white hover:shadow-sm"
                    >
                      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-white">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="h-full w-full object-contain p-1 transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                            No photo
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-1 text-xs font-semibold text-zinc-800 group-hover:text-[#c7511f]">
                        {p.name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-zinc-900">
                        {formatPrice(Number(p.salePrice ?? p.price), p.currency || "GHS")}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
