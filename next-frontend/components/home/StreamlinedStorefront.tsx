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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.shortDescription?.toLowerCase().includes(q),
      );
    }

    if (activeTab === "in-stock") {
      result = result.filter((p) => p.inStock);
    } else if (activeTab === "deals") {
      result = result.filter((p) => p.onSale);
    }

    if (selectedCategory) {
      result = result.filter((p) =>
        p.categories?.some((c) => c.slug === selectedCategory),
      );
    }

    return result;
  }, [products, searchQuery, activeTab, selectedCategory]);

  // Rhythmic chunking: Batch 1 (0..6), Batch 2 (6..12), Batch 3 (12..18)
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
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-1 sm:py-3">
      {/* ─── 1. SLEEK, NON-INTRUSIVE FILTER BAR ────────────────────────── */}
      <section className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3.5 shadow-xs ring-1 ring-zinc-200/80">
        <div className="flex items-center justify-between gap-2">
          {/* Main Filter Tabs - Horizontal Scroll on Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`shrink-0 rounded-lg px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#131921] text-white shadow-2xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All ({products.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("in-stock")}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === "in-stock"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>In Stock ({totalInStock})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deals")}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === "deals"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <Flame className="h-3 w-3" />
              <span>Deals ({totalOnSale})</span>
            </button>
          </div>

          {/* Active status counter */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500 shrink-0">
            <span>
              Showing{" "}
              <strong className="text-zinc-900 font-bold">
                {filteredProducts.length}
              </strong>{" "}
              items
            </span>
            {(selectedCategory || searchQuery || activeTab !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[#007185] hover:text-[#c7511f] font-semibold underline text-xs ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category Pills (Compact Horizontal Scroll) */}
        {categories.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-zinc-100 no-scrollbar">
            <span className="hidden sm:flex text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 items-center gap-1">
              <Filter className="h-3 w-3" /> Dept:
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === null
                  ? "bg-[#ff9900] text-zinc-950 font-bold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Departments
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
                className={`rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat.slug
                    ? "bg-[#ff9900] text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── 2. EMPTY STATE IF NO PRODUCTS MATCH FILTERS ─────────────── */}
      {filteredProducts.length === 0 && (
        <div className="my-8 flex flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3e0] text-[#ff9900]">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-base font-bold text-zinc-900">
            No items match your selected filter
          </h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Switch back to &ldquo;All&rdquo; to browse available stock across Ghana.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl bg-[#ff9900] px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-[#f08804] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ─── 3. STREAMLINED RHYTHMIC FEED ────────────────────────────── */}
      {filteredProducts.length > 0 && (
        <div className="space-y-4">
          {/* ── BATCH 1: TOP AVAILABLE PICKS ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : activeTab === "deals"
                    ? "Special Deals & Discounts"
                    : activeTab === "in-stock"
                    ? "In Stock & Ready to Ship"
                    : "Featured Picks For You"}
                </h2>
              </div>

              <Link
                href="/shop"
                className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline shrink-0"
              >
                See all &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900">
                  Trending in Ghana Right Now
                </h2>
                <Link
                  href="/shop?sort=popularity"
                  className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline shrink-0"
                >
                  See more &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900">
                  More Recommended Finds
                </h2>
                <Link
                  href="/shop"
                  className="text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline shrink-0"
                >
                  Explore catalog &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
