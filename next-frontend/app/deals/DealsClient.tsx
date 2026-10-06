"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Sparkles,
  Percent,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Tag,
  Search,
  RotateCcw,
} from "lucide-react";
import type { Category, Product } from "@/lib/catalog/types";
import { ProductCard } from "@/components/product/ProductCard";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";

interface DealsClientProps {
  initialProducts: Product[];
  categories: Category[];
}

type DiscountFilter = "all" | "50plus" | "30plus" | "15plus" | "under100";
type SortOption = "discount-desc" | "price-asc" | "price-desc" | "rating-desc" | "newest";

export function DealsClient({ initialProducts, categories }: DealsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("discount-desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter only products that have a real deal / discount
  const dealProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      const discount = getDiscountPercent(product);
      const hasSaleFlag = product.onSale;
      const hasRegularPriceDrop =
        product.regularPrice !== null &&
        product.regularPrice !== undefined &&
        product.regularPrice > product.price;

      return hasSaleFlag || hasRegularPriceDrop || discount > 0;
    });
  }, [initialProducts]);

  // Compute category deal counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dealProducts.forEach((p) => {
      p.categories?.forEach((c) => {
        counts[c.slug] = (counts[c.slug] || 0) + 1;
      });
    });
    return counts;
  }, [dealProducts]);

  // Filter and sort
  const filteredDeals = useMemo(() => {
    let result = [...dealProducts];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.shortDescription?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter((p) =>
        p.categories?.some((c) => c.slug === selectedCategory)
      );
    }

    // Discount tier filter
    if (discountFilter === "50plus") {
      result = result.filter((p) => getDiscountPercent(p) >= 50);
    } else if (discountFilter === "30plus") {
      result = result.filter((p) => getDiscountPercent(p) >= 30);
    } else if (discountFilter === "15plus") {
      result = result.filter((p) => getDiscountPercent(p) >= 15);
    } else if (discountFilter === "under100") {
      result = result.filter((p) => p.price < 100);
    }

    // Sorting
    result.sort((a, b) => {
      const discountA = getDiscountPercent(a);
      const discountB = getDiscountPercent(b);

      switch (sortOption) {
        case "discount-desc":
          return discountB - discountA;
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "rating-desc":
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [dealProducts, searchQuery, selectedCategory, discountFilter, sortOption]);

  const maxDiscount = useMemo(() => {
    return dealProducts.reduce((max, p) => Math.max(max, getDiscountPercent(p)), 0);
  }, [dealProducts]);

  function resetFilters() {
    setSelectedCategory(null);
    setDiscountFilter("all");
    setSortOption("discount-desc");
    setSearchQuery("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
      {/* ─── 1. HERO BANNER ────────────────────────────────────────────── */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#131921] via-[#1a2536] to-[#2a1b18] p-6 text-white shadow-xl sm:p-10 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#cc0c39]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 bottom-0 h-60 w-60 rounded-full bg-[#ff9900]/15 blur-2xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#cc0c39] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md">
            <Flame className="h-4 w-4 animate-bounce" />
            <span>NextDor Flash Deals &amp; Discounts</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            Save Big with <span className="text-[#ff9900]">Ghana&apos;s Best</span> Verified Prices
          </h1>

          <p className="mt-3 text-sm text-zinc-300 sm:text-base leading-relaxed">
            Every deal is 100% genuine, fulfilled by verified merchants across Ghana, and backed by the{" "}
            <strong className="text-white font-semibold">NextDor 48-Hour Buyer Protection Escrow</strong>.
          </p>

          {/* Quick Metric Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xs px-3.5 py-2 ring-1 ring-white/15">
              <Tag className="h-4 w-4 text-[#ff9900]" />
              <span>
                <strong className="font-bold text-white">{dealProducts.length}</strong> Active Deals
              </span>
            </div>
            {maxDiscount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 backdrop-blur-xs px-3.5 py-2 ring-1 ring-rose-400/30 text-rose-200">
                <Percent className="h-4 w-4 text-rose-300" />
                <span>
                  Up to <strong className="font-bold text-white">{maxDiscount}% OFF</strong>
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xs px-3.5 py-2 ring-1 ring-white/15">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Escrow Protected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. CONTROLS & FILTER BAR ──────────────────────────────────── */}
      <div className="mb-6 space-y-4 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-zinc-200/80 sm:p-5">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter deals by product name or keyword..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-2.5 text-sm text-zinc-900 transition-colors focus:border-[#ff9900] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#ff9900]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
              <label htmlFor="deals-sort-select" className="shrink-0 text-zinc-500">Sort by:</label>
              <select
                id="deals-sort-select"
                aria-label="Sort deals by"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-transparent font-bold text-zinc-900 focus:outline-hidden cursor-pointer"
              >
                <option value="discount-desc">Highest Discount (%)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating-desc">Customer Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Discount Tiers (Pills) */}
        <div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-[#cc0c39]" /> Tier:
            </span>
            <button
              type="button"
              onClick={() => setDiscountFilter("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                discountFilter === "all"
                  ? "bg-[#131921] text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Deals ({dealProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setDiscountFilter("50plus")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                discountFilter === "50plus"
                  ? "bg-[#cc0c39] text-white shadow-xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 ring-1 ring-rose-200"
              }`}
            >
              🔥 50%+ OFF
            </button>
            <button
              type="button"
              onClick={() => setDiscountFilter("30plus")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                discountFilter === "30plus"
                  ? "bg-[#ff9900] text-zinc-950 shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 ring-1 ring-amber-200"
              }`}
            >
              ⚡ 30%+ OFF
            </button>
            <button
              type="button"
              onClick={() => setDiscountFilter("15plus")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                discountFilter === "15plus"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 ring-1 ring-blue-200"
              }`}
            >
              15%+ OFF
            </button>
            <button
              type="button"
              onClick={() => setDiscountFilter("under100")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                discountFilter === "under100"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-200"
              }`}
            >
              Under GH₵100
            </button>
          </div>
        </div>

        {/* Row 3: Categories with Deal Counts */}
        <div className="pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-zinc-400" /> Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === null
                  ? "bg-[#ff9900] text-zinc-950 font-bold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => {
              const count = categoryCounts[cat.slug] || 0;
              if (count === 0) return null;
              const isSelected = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat.slug)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#ff9900] text-zinc-950 font-bold"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 3. RESULTS HEADER ─────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl flex items-center gap-2">
            <span>Verified Deals</span>
            <span className="text-xs font-semibold text-zinc-500">
              ({filteredDeals.length} {filteredDeals.length === 1 ? "item" : "items"})
            </span>
          </h2>
          <p className="text-xs text-zinc-500">
            Click any deal for full specifications, delivery estimate, and seller warranty.
          </p>
        </div>

        {(selectedCategory !== null || discountFilter !== "all" || searchQuery.trim() !== "") && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#c7511f] hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* ─── 4. PRODUCTS GRID ──────────────────────────────────────────── */}
      {filteredDeals.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredDeals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="my-12 flex flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-xs ring-1 ring-zinc-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Flame className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900">
            No deals found matching your selected criteria
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-500">
            Try choosing a different discount tier or clearing your search keywords to view all discounted products.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#131921] px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>View All Deals</span>
          </button>
        </div>
      )}

      {/* ─── 5. BUYER PROTECTION FOOTER CARD ──────────────────────────── */}
      <div className="mt-12 rounded-2xl border border-zinc-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ff9900]/20 text-[#c7511f]">
              <ShieldCheck className="h-6 w-6 text-[#131921]" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 text-sm sm:text-base">
                100% NextDor Escrow Guarantee on All Deals
              </h4>
              <p className="mt-1 text-xs text-zinc-600 max-w-2xl leading-relaxed">
                When you purchase a discounted deal on NextDor, your payment is held securely in escrow for 48 hours after delivery. 
                If the item doesn&apos;t match the description or arrives defective, return it easily for a full refund.
              </p>
            </div>
          </div>
          <Link
            href="/returns"
            className="shrink-0 inline-flex items-center justify-center rounded-xl bg-[#131921] px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition shadow-xs"
          >
            Buyer Protection Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
