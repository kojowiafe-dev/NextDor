import Link from "next/link";
import { Flame, Star, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import type { TrendingProduct } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";

type TrendingRowProps = {
  products: TrendingProduct[];
};

export function TrendingRow({ products }: TrendingRowProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="rounded-2xl bg-gradient-to-br from-[#ff9900]/[0.05] via-[#ff9900]/[0.02] to-transparent p-4 sm:p-6 ring-1 ring-[#ff9900]/15">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ff9900]/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff9900] to-[#f08804] text-white shadow-sm shadow-[#ff9900]/25">
              <Flame className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900">
                  Trending Now in Ghana
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                  Live Velocity
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                High-velocity products experiencing rapid orders across verified stores today
              </p>
            </div>
          </div>

          <Link
            href="/shop?sort=popularity"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            <span>Explore all trending</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
            const image = product.images?.[0];
            const badgeText = product.trendingBadge || "🔥 Trending Fast";

            return (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[#ff9900]/30"
              >
                {/* Badge */}
                <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
                  <span className="inline-flex items-center shrink-0 whitespace-nowrap rounded-md bg-[#ff9900] px-2 py-0.5 text-[10px] font-bold text-zinc-900 shadow-sm backdrop-blur-sm">
                    {badgeText}
                  </span>
                </div>

                {/* Product Image */}
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-50">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.src}
                      alt={image.alt || product.name}
                      className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <Sparkles className="h-8 w-8" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="mt-3 flex flex-1 flex-col justify-between">
                  <div>
                    {/* Merchant Attribution */}
                    {product.vendor && (
                      <div className="mb-1 flex items-center gap-1 text-[11px] text-zinc-500">
                        <span className="truncate font-medium text-zinc-700">
                          {product.vendor.name}
                        </span>
                        <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                      </div>
                    )}

                    {/* Product Name */}
                    <h3 className="line-clamp-2 text-xs sm:text-sm font-medium text-zinc-900 group-hover:text-[#c7511f]">
                      {product.name}
                    </h3>

                    {/* Rating */}
                    {product.rating > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="flex items-center text-[#ff9900]">
                          <Star className="h-3 w-3 fill-[#ff9900] text-[#ff9900]" />
                          <span className="ml-1 text-xs font-semibold text-zinc-800">
                            {product.rating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          ({product.reviewCount || 0})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price & Velocity Footer */}
                  <div className="mt-3 border-t border-zinc-100 pt-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm sm:text-base font-bold text-zinc-900">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      {product.regularPrice != null && product.regularPrice > product.price && (
                        <>
                          <span className="text-xs text-zinc-400 line-through">
                            {formatPrice(product.regularPrice, product.currency)}
                          </span>
                          <span className="rounded bg-red-50 border border-red-200 px-1 py-0.2 text-[10px] font-bold text-red-600">
                            -{Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100)}%
                          </span>
                        </>
                      )}
                    </div>

                    {/* Sales Velocity Pill */}
                    <div className="mt-1.5 flex items-center gap-1 rounded bg-[#fff3e0] px-1.5 py-0.5 text-[10px] font-medium text-zinc-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ff9900] animate-pulse" />
                      <span className="truncate">
                        {product.recentSales} sold in last 48h
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
