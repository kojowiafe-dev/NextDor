"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

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
    <form onSubmit={handleSubmit} className={`flex flex-1 ${className}`}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search NextDor"
        className="w-full rounded-l-md border-0 border-r-0 px-4 py-2 text-sm text-white outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex items-center justify-center rounded-r-md bg-[#febd69] px-4 text-zinc-900 transition-colors hover:bg-[#f3a847]"
      >
        <Search className="h-5 w-5" />
      </button>
    </form>
  );
}
