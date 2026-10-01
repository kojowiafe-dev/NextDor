"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Filter,
  X,
  Flame,
  Store,
  Truck,
  ShieldCheck,
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
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
      {/* ─── 1. CLEAN & WELCOMING STOREFRONT HERO ─────────────────────── */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#131921] via-[#1a2536] to-[#232f3e] p-6 text-white shadow-lg sm:p-10 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#ff9900]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ff9900]">
            <ShoppingBag className="h-3.5 w-3.5 fill-[#ff9900]" />
            <span>NextDor Public Storefront</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Shop Verified Essentials &amp; Big Savings in Ghana
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
            Easily check available products in stock and add items to your cart
            with 1-click. Enjoy fast doorstep delivery and seamless Mobile Money
            checkout.
          </p>

          {/* Quick Search on Storefront */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search available items (e.g., Laptop, Cake, Perfume)..."
                className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-400 backdrop-blur-sm focus:border-[#ff9900] focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-[#ff9900] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-5 py-3 text-sm font-extrabold text-[#131921] shadow-lg shadow-[#ff9900]/20 transition-all hover:bg-[#f08804] active:scale-95"
            >
              <span>Explore All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-300 sm:gap-6 border-t border-white/10 pt-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="h-4 w-4 text-emerald-400" />
              Ghana Doorstep Delivery
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-[#ff9900]" />
              100% Genuine Items
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              MTN / Telecel MoMo Protected
            </span>
          </div>
        </div>
      </section>

      {/* ─── 2. CONVENIENT FILTER & AVAILABILITY BAR ───────────────────── */}
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
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
