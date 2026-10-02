"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { Category } from "@/lib/catalog/types";

type CategoryNavProps = {
  categories: Category[];
};

export function CategoryNav({ categories }: CategoryNavProps) {
  const pathname = usePathname();
  const topCategories = categories.slice(0, 10);

  return (
    <>
      {/* Desktop Category Bar */}
      <nav className="hidden bg-[#232f3e] text-sm text-white md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-2">
          <Link
            href="/shop"
            className="shrink-0 font-semibold hover:text-[#ff9900] transition-colors"
          >
            All Products
          </Link>
          {topCategories.map((category) => {
            const isActive = pathname === `/category/${category.slug}`;
            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className={`shrink-0 whitespace-nowrap transition-colors ${
                  isActive ? "text-[#ff9900] font-semibold" : "hover:text-[#ff9900]"
                }`}
              >
                {category.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Horizontal Quick Category Pills */}
      <nav
        aria-label="Categories"
        className="block md:hidden bg-[#1b222d] border-b border-white/10 text-white overflow-x-auto scrollbar-none"
      >
        <div className="flex items-center gap-1.5 px-3 py-2">
          <Link
            href="/shop"
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
              pathname === "/shop"
                ? "bg-[#ff9900] text-zinc-950 shadow-sm"
                : "bg-white/10 text-zinc-200 hover:bg-white/20 active:scale-95"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>All</span>
          </Link>
          {topCategories.map((category) => {
            const isActive = pathname === `/category/${category.slug}`;
            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#ff9900] text-zinc-950 font-bold shadow-sm"
                    : "bg-white/10 text-zinc-200 hover:bg-white/20 active:scale-95"
                }`}
              >
                {category.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
