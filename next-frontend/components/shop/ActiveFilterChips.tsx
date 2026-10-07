"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, RotateCcw } from "lucide-react";
import type { Category } from "@/lib/catalog/types";

interface ActiveFilterChipsProps {
  categories: Category[];
}

export function ActiveFilterChips({ categories }: ActiveFilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categorySlug = searchParams.get("category");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const inStock = searchParams.get("inStock") === "true";
  const onSale = searchParams.get("onSale") === "true";
  const rating = searchParams.get("rating");
  const query = searchParams.get("q");

  const categoryObj = categories.find((c) => c.slug === categorySlug);

  function removeParam(key: string, secondKey?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    if (secondKey) params.delete(secondKey);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const chips: { label: string; onRemove: () => void }[] = [];

  if (categorySlug) {
    chips.push({
      label: `Category: ${categoryObj?.name || categorySlug}`,
      onRemove: () => removeParam("category"),
    });
  }

  if (minPrice && maxPrice) {
    chips.push({
      label: `GH₵ ${minPrice} – GH₵ ${maxPrice}`,
      onRemove: () => removeParam("minPrice", "maxPrice"),
    });
  } else if (minPrice) {
    chips.push({
      label: `Over GH₵ ${minPrice}`,
      onRemove: () => removeParam("minPrice"),
    });
  } else if (maxPrice) {
    chips.push({
      label: `Under GH₵ ${maxPrice}`,
      onRemove: () => removeParam("maxPrice"),
    });
  }

  if (inStock) {
    chips.push({
      label: "In Stock Only",
      onRemove: () => removeParam("inStock"),
    });
  }

  if (onSale) {
    chips.push({
      label: "⚡ Deals Only",
      onRemove: () => removeParam("onSale"),
    });
  }

  if (rating) {
    chips.push({
      label: `${rating}★ & Above`,
      onRemove: () => removeParam("rating"),
    });
  }

  if (query) {
    chips.push({
      label: `Search: "${query}"`,
      onRemove: () => removeParam("q"),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs font-semibold text-zinc-500">Active filters:</span>
      {chips.map((chip, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 transition hover:bg-zinc-200"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="p-0.5 text-zinc-500 hover:text-zinc-900 rounded-full"
            aria-label={`Remove filter ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="flex items-center gap-1 text-xs font-semibold text-[#c7511f] hover:underline ml-1"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Clear all</span>
      </button>
    </div>
  );
}
