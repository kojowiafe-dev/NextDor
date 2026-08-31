import Link from "next/link";
import {
  getCategories,
  getProducts,
  type ProductSort,
} from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";

type ShopPageProps = {
  searchParams: Promise<{
    sort?: ProductSort;
    page?: string;
    category?: string;
  }>;
};

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "date", label: "Latest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Rating" },
];

export const metadata = {
  title: "Shop All Products",
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const sort = params.sort ?? "popularity";

  const [{ products, totalPages }, categories] = await Promise.all([
    getProducts({ page, perPage: 12, sort, category: params.category }),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">All Products</h1>
          <p className="text-sm text-zinc-500">
            Browse our full catalog of quality products
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-zinc-600">
            Sort by:
          </label>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <Link
                key={option.value}
                href={`/shop?sort=${option.value}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  sort === option.value
                    ? "bg-[#232f3e] text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/shop"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !params.category
              ? "bg-[#ff9900] text-zinc-900"
              : "bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/shop?category=${category.slug}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              params.category === category.slug
                ? "bg-[#ff9900] text-zinc-900"
                : "bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <ProductGrid products={products} />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/shop"
        searchParams={{
          sort: sort !== "popularity" ? sort : undefined,
          category: params.category,
        }}
      />
    </div>
  );
}
