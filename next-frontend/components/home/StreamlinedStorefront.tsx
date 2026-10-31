"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Filter,
  Flame,
  Search,
} from "lucide-react";
import type { Category, Product } from "@/lib/catalog/types";
import { ProductCard } from "@/components/product/ProductCard";
import {
  DealOfTheDayCard,
  BonanzaPromoCard,
  BuyerConvenienceCard,
} from "./DiscountCards";

interface StreamlinedStorefrontProps {
  products: Product[];
  categories: Category[];
  dealProduct?: Product | null;
}

type FilterTab = "all" | "in-stock" | "deals";

export function StreamlinedStorefront({
  products,
  categories,
  dealProduct,
}: StreamlinedStorefrontProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Clean, interactive filtering
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.shortDescription?.toLowerCase().includes(q),
      );
    }

    // Filter by tab
    if (activeTab === "in-stock") {
      result = result.filter((p) => p.inStock);
    } else if (activeTab === "deals") {
      result = result.filter((p) => p.onSale);
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((p) =>
        p.categories?.some((c) => c.slug === selectedCategory),
      );
    }

    return result;
  }, [products, searchQuery, activeTab, selectedCategory]);

  // Rhythmic chunking: Batch 1 (0..6), Batch 2 (6..12), Batch 3 (12+)
  const batch1 = filteredProducts.slice(0, 6);
  const batch2 = filteredProducts.slice(6, 12);
  const batch3 = filteredProducts.slice(12, 18);

  const totalInStock = useMemo(
    () => products.filter((p) => p.inStock).length,
    [products],
  );

  const totalOnSale = useMemo(
    () => products.filter((p) => p.onSale).length,
    [products],
  );

  function resetFilters() {
    setActiveTab("all");
    setSelectedCategory(null);
    setSearchQuery("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-2 sm:py-4">
      {/* ─── 1. CONVENIENT FILTER & AVAILABILITY BAR ───────────────────── */}
      <section className="sticky top-0 z-20 mb-6 rounded-2xl bg-white/95 p-3.5 shadow-sm backdrop-blur-md ring-1 ring-zinc-200/80 transition-all">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Main Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "all"
                  ? "bg-[#131921] text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All Items ({products.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("in-stock")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "in-stock"
                  ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/20"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              In Stock Only ({totalInStock})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deals")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "deals"
                  ? "bg-rose-600 text-white shadow-xs shadow-rose-600/20"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Deals &amp; Discounts ({totalOnSale})
            </button>
          </div>

          {/* Active status counter */}
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>
              Showing{" "}
              <strong className="text-zinc-900 font-bold">
                {filteredProducts.length}
              </strong>{" "}
              available items
            </span>
            {(selectedCategory || searchQuery || activeTab !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[#007185] hover:text-[#c7511f] font-semibold underline text-xs ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category Pills (Sub-row) */}
        {categories.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-zinc-100 no-scrollbar">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Categories:
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === null
                  ? "bg-[#ff9900] text-zinc-950 font-bold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Categories
            </button>

            {categories.slice(0, 10).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === cat.slug ? null : cat.slug,
                  )
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.slug
                    ? "bg-[#ff9900] text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── 3. EMPTY STATE IF NO PRODUCTS MATCH FILTERS ─────────────── */}
      {filteredProducts.length === 0 && (
        <div className="my-12 flex flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff3e0] text-[#ff9900]">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-zinc-900">
            No items match your selected filter
          </h3>
          <p className="mt-1 text-sm text-zinc-500 max-w-md">
            Try clearing your search or switching to &ldquo;All Items&rdquo; to
            see full available stock across Ghana.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-xl bg-[#ff9900] px-5 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-[#f08804]"
          >
            Reset Filters &amp; View All
          </button>
        </div>
      )}

      {/* ─── 4. STREAMLINED RHYTHMIC FEED ────────────────────────────── */}
      {filteredProducts.length > 0 && (
        <div className="space-y-2">
          {/* ── BATCH 1: TOP AVAILABLE PICKS ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : activeTab === "deals"
                    ? "Special Deals & Discounts"
                    : activeTab === "in-stock"
                    ? "In Stock & Ready to Ship"
                    : "Top Available Picks"}
                </h2>
                <p className="text-xs text-zinc-500">
                  Click Add to Cart for instant checkout or tap any product for
                  details.
                </p>
              </div>

              <Link
                href="/shop"
                className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {batch1.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          {/* ── INTERLEAVED DISCOUNT CARD 1: DEAL OF THE DAY ── */}
          <DealOfTheDayCard dealProduct={dealProduct} />

          {/* ── BATCH 2: TRENDING & ESSENTIALS ── */}
          {batch2.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    Trending in Ghana Right Now
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Popular choices with fast sales and verified stock.
                  </p>
                </div>
                <Link
                  href="/shop?sort=popularity"
                  className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  See more &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {batch2.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* ── INTERLEAVED DISCOUNT CARD 2: BONANZA SAVINGS ── */}
          <BonanzaPromoCard onFilterDeals={() => setActiveTab("deals")} />

          {/* ── BATCH 3: FRESH FINDS & CATALOG HIGHLIGHTS ── */}
          {batch3.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    More Recommended Finds
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Quality products from accredited merchants across Ghana.
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  Explore catalog &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {batch3.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* ── INTERLEAVED CARD 3: BUYER CONVENIENCE & PERKS ── */}
          <BuyerConvenienceCard />
        </div>
      )}
    </div>
  );
}
