import Link from "next/link";
import {
  getCategories,
  getProducts,
  type ProductSort,
} from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ActiveFilterChips } from "@/components/shop/ActiveFilterChips";
import { MobileFilterDrawer } from "@/components/shop/MobileFilterDrawer";
import { Sparkles, ArrowUpDown, ShieldCheck, Zap } from "lucide-react";

type ShopPageProps = {
  searchParams: Promise<{
    sort?: ProductSort;
    page?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    onSale?: string;
    rating?: string;
    q?: string;
  }>;
};

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "date", label: "Newest Arrivals" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Customer Rating" },
];

export const metadata = {
  title: "Shop All Marketplace Products — NextDor Ghana",
  description: "Browse verified electronics, fashion, groceries, and home essentials with instant MoMo checkout and fast nationwide delivery.",
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = params.sort ?? "popularity";

  const minPriceNum = params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceNum = params.maxPrice ? Number(params.maxPrice) : undefined;
  const ratingNum = params.rating ? Number(params.rating) : undefined;
  const inStockBool = params.inStock === "true";
  const onSaleBool = params.onSale === "true";

  const [{ products, total, totalPages }, categories] = await Promise.all([
    getProducts({
      page,
      perPage: 16,
      sort,
      category: params.category,
      search: params.q,
      minPrice: minPriceNum,
      maxPrice: maxPriceNum,
      inStock: inStockBool,
      onSale: onSaleBool,
      rating: ratingNum,
    }),
    getCategories(),
  ]);

  // Construct searchParams object to preserve across pagination links
  const paginationParams: Record<string, string | undefined> = {
    sort: sort !== "popularity" ? sort : undefined,
    category: params.category,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    inStock: params.inStock,
    onSale: params.onSale,
    rating: params.rating,
    q: params.q,
  };

  function buildSortHref(newSort: ProductSort) {
    const p = new URLSearchParams();
    if (newSort !== "popularity") p.set("sort", newSort);
    if (params.category) p.set("category", params.category);
    if (params.minPrice) p.set("minPrice", params.minPrice);
    if (params.maxPrice) p.set("maxPrice", params.maxPrice);
    if (params.inStock) p.set("inStock", params.inStock);
    if (params.onSale) p.set("onSale", params.onSale);
    if (params.rating) p.set("rating", params.rating);
    if (params.q) p.set("q", params.q);
    const qs = p.toString();
    return qs ? `/shop?${qs}` : "/shop";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Page Header Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#232f3e] via-[#1a222d] to-[#131921] p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>NextDor Marketplace Catalog</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              All Products in Ghana
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Explore thousands of authentic products backed by our 48-Hour Escrow Protection.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto rounded-xl bg-white/10 px-4 py-2 text-xs backdrop-blur-xs border border-white/15">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-zinc-200">100% Verified Sellers & Genuine Products</span>
          </div>
        </div>
      </div>

      {/* 2-Column Catalog Layout */}
      <div className="flex items-start gap-8">
        {/* Left Column: Desktop Faceted Filter Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block sticky top-24 rounded-2xl bg-white p-5 shadow-xs border border-zinc-100">
          <ShopFilters
            categories={categories}
            totalProducts={total}
          />
        </aside>

        {/* Right Column: Catalog Grid & Top Controls */}
        <main className="flex-1 min-w-0">
          {/* Controls Bar: Mobile filter drawer trigger, Active counts, Sort */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-3.5 shadow-xs border border-zinc-100">
            <div className="flex items-center gap-3">
              <MobileFilterDrawer
                categories={categories}
                totalProducts={total}
              />
              <div className="text-xs text-zinc-500 font-medium">
                Showing <strong className="text-zinc-900">{products.length}</strong> of{" "}
                <strong className="text-zinc-900">{total}</strong> products
              </div>
            </div>

            {/* Sort Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-zinc-400 shrink-0 hidden sm:inline flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
                Sort:
              </span>
              <div className="flex flex-wrap gap-1">
                {sortOptions.map((opt) => {
                  const isActive = sort === opt.value;
                  return (
                    <Link
                      key={opt.value}
                      href={buildSortHref(opt.value)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? "bg-[#232f3e] text-white shadow-xs"
                          : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          <ActiveFilterChips categories={categories} />

          {/* Product Grid */}
          <div className="mt-2">
            <ProductGrid
              products={products}
              emptyMessage="No products match your selected filter criteria. Try adjusting your price range, clearing category filters, or searching for other items."
            />
          </div>

          {/* Pagination */}
          <div className="mt-8">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/shop"
              searchParams={paginationParams}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
