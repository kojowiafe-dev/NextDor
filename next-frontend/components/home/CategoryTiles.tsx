import Link from "next/link";
import type { Category } from "@/lib/catalog/types";

type CategoryTilesProps = {
  categories: Category[];
};

export function CategoryTiles({ categories }: CategoryTilesProps) {
  const tiles = categories.slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <h2 className="mb-4 text-xl font-semibold text-zinc-900">
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="flex flex-col items-center justify-center rounded-lg bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#232f3e] text-2xl font-bold text-[#ff9900]">
              {category.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-zinc-900">
              {category.name}
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              {category.count} items
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
