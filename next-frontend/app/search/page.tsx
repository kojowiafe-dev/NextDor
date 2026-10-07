import { Suspense } from "react";
import { getCategories, getProducts, type ProductSort } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { SearchPageBar } from "@/components/search/SearchPageBar";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ActiveFilterChips } from "@/components/shop/ActiveFilterChips";
import { MobileFilterDrawer } from "@/components/shop/MobileFilterDrawer";
import Link from "next/link";
import { SearchX, TrendingUp, ArrowUpDown } from "lucide-react";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: ProductSort;
    page?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    onSale?: string;
    rating?: string;
  }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search Results` : "Search NextDor Ghana" };
}

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "popularity", label: "Most Popular" },
  { value: "date", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

const popularSearches = [
  "Samsung TV", "Laptop", "Headphones", "Groceries", "Cake", "JBL Speaker", "Smartphones",
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const sort = params.sort ?? "popularity";
  const page = Math.max(1, Number(params.page) || 1);

  const minPriceNum = params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceNum = params.maxPrice ? Number(params.maxPrice) : undefined;
  const ratingNum = params.rating ? Number(params.rating) : undefined;
  const inStockBool = params.inStock === "true";
  const onSaleBool = params.onSale === "true";

  const [searchResult, categories] = await Promise.all([
    query
      ? getProducts({
          search: query,
          sort,
          page,
          perPage: 20,
          category: params.category,
          minPrice: minPriceNum,
          maxPrice: maxPriceNum,
          inStock: inStockBool,
          onSale: onSaleBool,
          rating: ratingNum,
        })
      : Promise.resolve({ products: [], total: 0, totalPages: 1, page: 1 }),
    getCategories(),
  ]);

  const { products, total, totalPages } = searchResult;

  const paginationParams: Record<string, string | undefined> = {
    q: query,
    sort: sort !== "popularity" ? sort : undefined,
    category: params.category,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    inStock: params.inStock,
    onSale: params.onSale,
    rating: params.rating,
  };

  function buildSortHref(newSort: ProductSort) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (newSort !== "popularity") p.set("sort", newSort);
    if (params.category) p.set("category", params.category);
    if (params.minPrice) p.set("minPrice", params.minPrice);
    if (params.maxPrice) p.set("maxPrice", params.maxPrice);
    if (params.inStock) p.set("inStock", params.inStock);
    if (params.onSale) p.set("onSale", params.onSale);
    if (params.rating) p.set("rating", params.rating);
    const qs = p.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Search bar */}
      <div className="mb-6 flex justify-center">
        <SearchPageBar initialQuery={query} />
      </div>

      {query ? (
        <>
          {/* Result header */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-4 shadow-xs border border-zinc-100">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">
                {total > 0 ? (
                  <>
                    <span className="text-zinc-500 font-normal">Results for </span>
                    &ldquo;{query}&rdquo;
                  </>
                ) : (
                  <>No results for &ldquo;{query}&rdquo;</>
                )}
              </h1>
              {total > 0 && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Found <strong className="text-zinc-900">{total}</strong> product{total === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {/* Sort & Mobile filter trigger */}
            <div className="flex items-center gap-2">
              <MobileFilterDrawer
                categories={categories}
                totalProducts={total}
              />
              {total > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sortOptions.map((opt) => (
                    <Link
                      key={opt.value}
                      href={buildSortHref(opt.value)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        sort === opt.value
                          ? "bg-[#232f3e] text-white shadow-xs"
                          : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Chips */}
          <ActiveFilterChips categories={categories} />

          {total > 0 ? (
            <div className="mt-4 flex items-start gap-8">
              {/* Left Column: Desktop Faceted Filter Sidebar */}
              <aside className="w-64 shrink-0 hidden lg:block sticky top-24 rounded-2xl bg-white p-5 shadow-xs border border-zinc-100">
                <ShopFilters
                  categories={categories}
                  totalProducts={total}
                />
              </aside>

              {/* Right Column: Search Product Grid */}
              <main className="flex-1 min-w-0">
                <ProductGrid products={products} />
                <div className="mt-8">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    basePath="/search"
                    searchParams={paginationParams}
                  />
                </div>
              </main>
            </div>
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
    <div className="py-16 text-center rounded-2xl bg-white border border-zinc-100 p-8 shadow-xs">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
        <SearchX className="h-8 w-8 text-zinc-400" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900">
        No results for &ldquo;{query}&rdquo;
      </h2>
      <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
        Try checking for typos, clearing filters, or searching using broader keywords like &ldquo;Phone&rdquo; or &ldquo;Electronics&rdquo;.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {popularSearches.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 hover:bg-[#fff3e0] hover:text-[#c7511f] transition"
          >
            {term}
          </Link>
        ))}
      </div>
      <Link
        href="/shop"
        className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#f08804] transition shadow-sm"
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
      <div className="mb-4 flex items-center gap-2 text-zinc-600 font-semibold text-sm">
        <TrendingUp className="h-4 w-4 text-[#ff9900]" />
        <span>Trending Searches in Ghana</span>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {popularSearches.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-2xs border border-zinc-200 hover:border-[#ff9900] hover:text-[#c7511f] transition"
          >
            {term}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-sm font-bold text-zinc-900">Explore by Department</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className="rounded-xl bg-white p-4 text-center text-xs font-bold text-zinc-800 shadow-xs border border-zinc-100 hover:border-[#ff9900]/60 hover:text-[#c7511f] hover:shadow-sm transition"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
