import Link from "next/link";
import { Menu } from "lucide-react";
import type { Category } from "@/lib/catalog/types";

type CategoryNavProps = {
  categories: Category[];
};

export function CategoryNav({ categories }: CategoryNavProps) {
  const topCategories = categories.slice(0, 8);

  return (
    <nav className="bg-[#232f3e] text-sm text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-2">
        <Link
          href="/shop"
          className="flex shrink-0 items-center gap-1 font-semibold hover:text-[#febd69]"
        >
          <Menu className="h-4 w-4" />
          All
        </Link>
        {topCategories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="shrink-0 whitespace-nowrap hover:text-[#febd69]"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
