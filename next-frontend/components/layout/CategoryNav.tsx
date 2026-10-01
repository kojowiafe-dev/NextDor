import Link from "next/link";
import type { Category } from "@/lib/catalog/types";

type CategoryNavProps = {
  categories: Category[];
};

export function CategoryNav({ categories }: CategoryNavProps) {
  const topCategories = categories.slice(0, 8);

  return (
    <nav className="hidden bg-[#232f3e] text-sm text-white md:block">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-2">
        <Link
          href="/shop"
          className="shrink-0 font-semibold hover:text-[#ff9900]"
        >
          All
        </Link>
        {topCategories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="shrink-0 whitespace-nowrap hover:text-[#ff9900]"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
