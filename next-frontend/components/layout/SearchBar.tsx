"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Loader2, ArrowRight, TrendingUp, Sparkles, Folder, CheckCircle } from "lucide-react";
import { fetchAutocomplete, type AutocompleteResult, type AutocompleteProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";

const POPULAR_SEARCHES = [
  "Smartphones",
  "Laptops",
  "Bluetooth Speaker",
  "Fashion & Shoes",
  "Supermarket Groceries",
  "Home Appliances",
];

export function SearchBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AutocompleteResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search autocomplete
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchAutocomplete(trimmed, 5);
        setResults(data);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn("Autocomplete error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  function executeSearch(searchQuery: string, categorySlug?: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed && !categorySlug) return;
    setIsOpen(false);
    inputRef.current?.blur();
    let url = `/search?q=${encodeURIComponent(trimmed || "")}`;
    if (categorySlug) {
      url += `&category=${encodeURIComponent(categorySlug)}`;
    }
    router.push(url);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIndex >= 0 && results?.products && results.products[selectedIndex]) {
      const selected = results.products[selectedIndex];
      setIsOpen(false);
      router.push(`/product/${selected.slug}`);
      return;
    }
    executeSearch(query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === "ArrowDown") setIsOpen(true);
      return;
    }

    const productCount = results?.products?.length || 0;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < productCount - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : productCount - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative flex flex-1 items-center ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex w-full items-center">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, brands and categories..."
            aria-label="Search products"
            autoComplete="off"
            className="w-full rounded-l-lg bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none ring-1 ring-zinc-300 focus:ring-2 focus:ring-[#ff9900] transition"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-[#ff9900]" />
            )}
            {query.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  inputRef.current?.focus();
                }}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-full"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <button
          type="submit"
          aria-label="Submit search"
          className="flex h-full items-center justify-center rounded-r-lg bg-[#ff9900] px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-[#f08804] active:scale-95"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[80vh] overflow-y-auto rounded-xl bg-white p-2 shadow-2xl ring-1 ring-black/10 text-left border border-zinc-100 animate-in fade-in-50 duration-150">
          {query.trim().length < 2 ? (
            /* Popular Searches State */
            <div className="p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                <TrendingUp className="h-3.5 w-3.5 text-[#ff9900]" />
                <span>Popular Searches in Ghana</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      executeSearch(term);
                    }}
                    className="rounded-full bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-[#fff3e0] hover:border-[#ff9900]/50 hover:text-[#c7511f] transition"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Search Results State */
            <div className="divide-y divide-zinc-100">
              {/* Category Suggestions */}
              {results?.categories && results.categories.length > 0 && (
                <div className="p-2 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-0.5">
                    <Folder className="h-3 w-3 text-zinc-400" />
                    <span>In Categories</span>
                  </div>
                  {results.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => executeSearch(query, cat.slug)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      <span>
                        Search &ldquo;<strong className="text-zinc-900">{query}</strong>&rdquo; in{" "}
                        <span className="font-semibold text-[#c7511f]">{cat.name}</span>
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {cat.count} product{cat.count === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Matching Products */}
              {results?.products && results.products.length > 0 ? (
                <div className="p-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    <Sparkles className="h-3 w-3 text-[#ff9900]" />
                    <span>Products ({results.products.length})</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {results.products.map((prod, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <Link
                          key={prod.id}
                          href={`/product/${prod.slug}`}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 rounded-lg p-2 transition ${
                            isSelected
                              ? "bg-[#fff3e0] ring-1 ring-[#ff9900]/50"
                              : "hover:bg-zinc-50"
                          }`}
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100 border border-zinc-200">
                            {prod.image ? (
                              <Image
                                src={prod.image}
                                alt={prod.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                NextDor
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-900">
                              {prod.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs">
                              <span className="font-bold text-zinc-900">
                                {formatPrice(prod.salePrice ?? prod.price, prod.currency)}
                              </span>
                              {prod.salePrice != null && prod.salePrice < prod.price && (
                                <span className="text-[11px] text-zinc-400 line-through">
                                  {formatPrice(prod.price, prod.currency)}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 truncate">
                                · {prod.vendorName}
                              </span>
                            </div>
                          </div>
                          {prod.stockStatus === "IN_STOCK" && (
                            <span className="shrink-0 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 hidden sm:inline-flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" />
                              In Stock
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : !isLoading && (
                <div className="py-4 text-center text-xs text-zinc-500">
                  No exact product matches found for &ldquo;{query}&rdquo;.
                </div>
              )}

              {/* View all search results button */}
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => executeSearch(query)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-50 hover:bg-[#ff9900]/10 hover:text-[#c7511f] py-2 text-xs font-semibold text-zinc-700 transition"
                >
                  <span>View all results for &ldquo;{query}&rdquo;</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
