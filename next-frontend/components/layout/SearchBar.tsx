"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search, X } from "lucide-react";

export function SearchBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className={`relative flex flex-1 items-center ${className}`}>
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products, brands and categories..."
          aria-label="Search products"
          className="w-full rounded-l-lg bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none ring-1 ring-zinc-300 focus:ring-2 focus:ring-[#ff9900] transition"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 rounded-full"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <button
        type="submit"
        aria-label="Submit search"
        className="flex h-full items-center justify-center rounded-r-lg bg-[#ff9900] px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-[#f08804] active:scale-95"
      >
        <Search className="h-4.5 w-4.5" />
      </button>
    </form>
  );
}
