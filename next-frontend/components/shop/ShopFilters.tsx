"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { Category } from "@/lib/catalog/types";
import {
  Tag,
  Star,
  CheckCircle2,
  Flame,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  DollarSign,
  ChevronDown,
} from "lucide-react";

interface ShopFiltersProps {
  categories: Category[];
  totalProducts?: number;
  isMobileModal?: boolean;
  onApplyMobile?: () => void;
}

const PRICE_PRESETS = [
  { label: "Under GH₵ 50", min: undefined, max: 50 },
  { label: "GH₵ 50 to GH₵ 150", min: 50, max: 150 },
  { label: "GH₵ 150 to GH₵ 500", min: 150, max: 500 },
  { label: "GH₵ 500 to GH₵ 1,500", min: 500, max: 1500 },
  { label: "Over GH₵ 1,500", min: 1500, max: undefined },
];

export function ShopFilters({
  categories,
  totalProducts,
  isMobileModal = false,
  onApplyMobile,
}: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Active query parameters
  const activeCategory = searchParams.get("category") || "";
  const activeMinPrice = searchParams.get("minPrice") || "";
  const activeMaxPrice = searchParams.get("maxPrice") || "";
  const activeInStock = searchParams.get("inStock") === "true";
  const activeOnSale = searchParams.get("onSale") === "true";
  const activeRating = searchParams.get("rating") || "";
  const activeSort = searchParams.get("sort") || "";

  // Custom price input local state
  const [customMin, setCustomMin] = useState(activeMinPrice);
  const [customMax, setCustomMax] = useState(activeMaxPrice);

  useEffect(() => {
    setCustomMin(activeMinPrice);
    setCustomMax(activeMaxPrice);
  }, [activeMinPrice, activeMaxPrice]);

  function updateFilters(updates: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    // Reset pagination to page 1 whenever any filter changes
    params.delete("page");

    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url);

    if (onApplyMobile) {
      onApplyMobile();
    }
  }

  function handleCategoryClick(slug: string) {
    if (activeCategory === slug) {
      updateFilters({ category: null });
    } else {
      updateFilters({ category: slug });
    }
  }

  function handlePricePreset(min?: number, max?: number) {
    updateFilters({
      minPrice: min !== undefined ? String(min) : null,
      maxPrice: max !== undefined ? String(max) : null,
    });
  }

  function handleCustomPriceSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilters({
      minPrice: customMin.trim() ? customMin.trim() : null,
      maxPrice: customMax.trim() ? customMax.trim() : null,
    });
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (activeSort) {
      params.set("sort", activeSort);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url);
    if (onApplyMobile) {
      onApplyMobile();
    }
  }

  const hasActiveFilters = Boolean(
    activeCategory ||
      activeMinPrice ||
      activeMaxPrice ||
      activeInStock ||
      activeOnSale ||
      activeRating
  );

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#ff9900]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Catalog Filters
          </h2>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs font-semibold text-[#c7511f] hover:text-[#ff9900] transition"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* 1. Category Tree Hierarchy */}
      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Categories
        </h3>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => updateFilters({ category: null })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              !activeCategory
                ? "bg-[#fff3e0] text-[#c7511f] font-bold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <span>All Categories</span>
            {totalProducts !== undefined && (
              <span className="text-[11px] text-zinc-400">({totalProducts})</span>
            )}
          </button>
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.slug)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                  isSelected
                    ? "bg-[#fff3e0] text-[#c7511f] font-bold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className="truncate text-left">{cat.name}</span>
                <span className="text-[11px] text-zinc-400 shrink-0 ml-1">
                  ({cat.count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Deals & Availability Toggles */}
      <div className="space-y-2.5 border-t border-zinc-100 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Special Offers & Stock
        </h3>

        {/* On Sale / Flash Deals */}
        <label className="flex items-center gap-2.5 cursor-pointer rounded-lg p-2 hover:bg-zinc-50 transition border border-transparent hover:border-zinc-200">
          <input
            type="checkbox"
            checked={activeOnSale}
            onChange={(e) =>
              updateFilters({ onSale: e.target.checked ? "true" : null })
            }
            className="h-4 w-4 rounded border-zinc-300 text-[#ff9900] focus:ring-[#ff9900]"
          />
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-800">
            <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
            <span>Discounted / Deals Only</span>
          </div>
        </label>

        {/* In Stock Only */}
        <label className="flex items-center gap-2.5 cursor-pointer rounded-lg p-2 hover:bg-zinc-50 transition border border-transparent hover:border-zinc-200">
          <input
            type="checkbox"
            checked={activeInStock}
            onChange={(e) =>
              updateFilters({ inStock: e.target.checked ? "true" : null })
            }
            className="h-4 w-4 rounded border-zinc-300 text-[#ff9900] focus:ring-[#ff9900]"
          />
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>In Stock Only</span>
          </div>
        </label>
      </div>

      {/* 3. Price Range Presets & Custom Input */}
      <div className="border-t border-zinc-100 pt-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Price (GH₵)
        </h3>

        {/* Presets */}
        <div className="space-y-1 mb-3">
          {PRICE_PRESETS.map((preset) => {
            const isPresetActive =
              (preset.min === undefined ? !activeMinPrice : activeMinPrice === String(preset.min)) &&
              (preset.max === undefined ? !activeMaxPrice : activeMaxPrice === String(preset.max));

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (isPresetActive) {
                    updateFilters({ minPrice: null, maxPrice: null });
                  } else {
                    handlePricePreset(preset.min, preset.max);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs transition ${
                  isPresetActive
                    ? "bg-[#fff3e0] text-[#c7511f] font-bold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span>{preset.label}</span>
                {isPresetActive && <span className="text-[10px] text-[#ff9900]">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Custom Min / Max Input Form */}
        <form onSubmit={handleCustomPriceSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                GH₵
              </span>
              <input
                type="number"
                placeholder="Min"
                min="0"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-full rounded-md border border-zinc-200 py-1.5 pl-9 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#ff9900] focus:ring-1 focus:ring-[#ff9900] outline-none"
              />
            </div>
            <span className="text-xs text-zinc-400">–</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                GH₵
              </span>
              <input
                type="number"
                placeholder="Max"
                min="0"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="w-full rounded-md border border-zinc-200 py-1.5 pl-9 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#ff9900] focus:ring-1 focus:ring-[#ff9900] outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
          >
            Apply Price Filter
          </button>
        </form>
      </div>

      {/* 4. Customer Rating Filter */}
      <div className="border-t border-zinc-100 pt-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Customer Rating
        </h3>
        <div className="space-y-1">
          {[4, 3, 2].map((stars) => {
            const isSelected = activeRating === String(stars);
            return (
              <button
                key={stars}
                type="button"
                onClick={() =>
                  updateFilters({ rating: isSelected ? null : String(stars) })
                }
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                  isSelected
                    ? "bg-[#fff3e0] text-[#c7511f] font-bold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < stars
                            ? "fill-amber-400 text-amber-400"
                            : "fill-zinc-200 text-zinc-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span>{stars}★ & above</span>
                </div>
                {isSelected && <span className="text-[10px] text-[#ff9900]">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
