"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { ShopFilters } from "./ShopFilters";
import type { Category } from "@/lib/catalog/types";

interface MobileFilterDrawerProps {
  categories: Category[];
  totalProducts?: number;
}

export function MobileFilterDrawer({
  categories,
  totalProducts,
}: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();

  // Calculate active filter count
  const filterKeys = ["category", "minPrice", "maxPrice", "inStock", "onSale", "rating"];
  const activeCount = filterKeys.filter((key) => Boolean(searchParams.get(key))).length;

  return (
    <>
      {/* Mobile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-95 lg:hidden"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#ff9900]" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff9900] text-[10px] font-bold text-zinc-950">
            {activeCount}
          </span>
        )}
      </button>

      {/* Backdrop & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Slide-over */}
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#ff9900]" />
                <h2 className="text-sm font-bold text-zinc-900">Filters</h2>
                {activeCount > 0 && (
                  <span className="rounded bg-[#ff9900]/20 px-2 py-0.5 text-xs font-bold text-[#c7511f]">
                    {activeCount} active
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filters Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <ShopFilters
                categories={categories}
                totalProducts={totalProducts}
                isMobileModal={true}
                onApplyMobile={() => setIsOpen(false)}
              />
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-zinc-100 p-4 bg-zinc-50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full rounded-xl bg-[#ff9900] py-3 text-center text-sm font-bold text-zinc-950 hover:bg-[#f08804] active:scale-98 transition shadow-sm"
              >
                Show Results {totalProducts !== undefined ? `(${totalProducts})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
