import { Suspense } from "react";
import { getCategories, getProducts, type ProductSort } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { SearchPageBar } from "@/components/search/SearchPageBar";
import Link from "next/link";
import { SearchX, TrendingUp } from "lucide-react";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: ProductSort;
    page?: string;
    category?: string;
  }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search Results` : "Search" };
}

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "popularity", label: "Most Popular" },
  { value: "date", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

const popularSearches = [
  "Samsung TV", "Laptop", "Headphones", "Shampoo", "Cake", "JBL Speaker",
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const sort = params.sort ?? "popularity";
  const page = Math.max(1, Number(params.page) || 1);

  const [searchResult, categories] = await Promise.all([
    query
      ? getProducts({ search: query, sort, page, perPage: 20, category: params.category })
      : Promise.resolve({ products: [], total: 0, totalPages: 1, page: 1 }),
    getCategories(),
  ]);

  const { products, total, totalPages } = searchResult;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Search bar */}
      <div className="mb-6">
        <SearchPageBar initialQuery={query} />
      </div>

      {query ? (
        <>
          {/* Result header */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">
                {total > 0 ? (
                  <>
                    <span className="text-zinc-500">Results for </span>
                    &ldquo;{query}&rdquo;
                  </>
                ) : (
                  <>No results for &ldquo;{query}&rdquo;</>
                )}
              </h1>
              {total > 0 && (
                <p className="mt-0.5 text-sm text-zinc-500">
                  {total} product{total === 1 ? "" : "s"} found
                </p>
              )}
            </div>

            {/* Sort */}
            {total > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/search?q=${encodeURIComponent(query)}&sort=${opt.value}${params.category ? `&category=${params.category}` : ""}`}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      sort === opt.value
                        ? "bg-[#232f3e] text-white"
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Category filter chips */}
          {total > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              <Link
                href={`/search?q=${encodeURIComponent(query)}&sort=${sort}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !params.category
                    ? "bg-[#ff9900] text-zinc-900"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/search?q=${encodeURIComponent(query)}&sort=${sort}&category=${cat.slug}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    params.category === cat.slug
                      ? "bg-[#ff9900] text-zinc-900"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          {total > 0 ? (
            <>
              <ProductGrid products={products} />
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath="/search"
                searchParams={{
                  q: query,
                  sort: sort !== "popularity" ? sort : undefined,
                  category: params.category,
                }}
              />
            </>
          ) : (
            <NoResults query={query} />
          )}
        </>
      ) : (
        <EmptySearchState categories={categories} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NoResults({ query }: { query: string }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
        <SearchX className="h-8 w-8 text-zinc-400" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">
        No results for &ldquo;{query}&rdquo;
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Try a different keyword, check the spelling, or browse our categories.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {popularSearches.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {term}
          </Link>
        ))}
      </div>
      <Link
        href="/shop"
        className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
      >
        Browse All Products
      </Link>
    </div>
  );
}

function EmptySearchState({
  categories,
}: {
  categories: { id: string | number; name: string; slug: string }[];
}) {
  return (
    <div className="py-8">
      <div className="mb-6 flex items-center gap-2 text-zinc-500">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm font-medium">Popular searches</span>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {popularSearches.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {term}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-sm font-medium text-zinc-500">Browse by category</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className="rounded-xl bg-white px-4 py-4 text-center text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-100 hover:ring-[#ff9900]/50 transition-all"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
