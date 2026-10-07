import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getCategories, getProducts, type ProductSort } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ActiveFilterChips } from "@/components/shop/ActiveFilterChips";
import { MobileFilterDrawer } from "@/components/shop/MobileFilterDrawer";
import { Folder, ArrowUpDown, ChevronRight, Sparkles } from "lucide-react";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: ProductSort;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    onSale?: string;
    rating?: string;
  }>;
};

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "date", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return {
    title: category ? `${category.name} — Shop Ghana Marketplace` : "Category",
    description: category?.description || `Shop genuine ${category?.name || "products"} in Ghana with quick delivery and 48-hour escrow guarantee.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const page = Math.max(1, Number(queryParams.page) || 1);
  const sort = queryParams.sort ?? "popularity";

  const [category, allCategories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);

  if (!category) {
    notFound();
  }

  const minPriceNum = queryParams.minPrice ? Number(queryParams.minPrice) : undefined;
  const maxPriceNum = queryParams.maxPrice ? Number(queryParams.maxPrice) : undefined;
  const ratingNum = queryParams.rating ? Number(queryParams.rating) : undefined;
  const inStockBool = queryParams.inStock === "true";
  const onSaleBool = queryParams.onSale === "true";

  const { products, total, totalPages } = await getProducts({
    category: slug,
    page,
    perPage: 16,
    sort,
    minPrice: minPriceNum,
    maxPrice: maxPriceNum,
    inStock: inStockBool,
    onSale: onSaleBool,
    rating: ratingNum,
  });

  const paginationParams: Record<string, string | undefined> = {
    sort: sort !== "popularity" ? sort : undefined,
    minPrice: queryParams.minPrice,
    maxPrice: queryParams.maxPrice,
    inStock: queryParams.inStock,
    onSale: queryParams.onSale,
    rating: queryParams.rating,
  };

  function buildSortHref(newSort: ProductSort) {
    const p = new URLSearchParams();
    if (newSort !== "popularity") p.set("sort", newSort);
    if (queryParams.minPrice) p.set("minPrice", queryParams.minPrice);
    if (queryParams.maxPrice) p.set("maxPrice", queryParams.maxPrice);
    if (queryParams.inStock) p.set("inStock", queryParams.inStock);
    if (queryParams.onSale) p.set("onSale", queryParams.onSale);
    if (queryParams.rating) p.set("rating", queryParams.rating);
    const qs = p.toString();
    return qs ? `/category/${slug}?${qs}` : `/category/${slug}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] transition">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-zinc-400" />
        <Link href="/shop" className="hover:text-[#c7511f] transition">
          Shop
        </Link>
        <ChevronRight className="h-3 w-3 text-zinc-400" />
        <span className="font-semibold text-zinc-900">{category.name}</span>
      </nav>

      {/* Category Hero Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#232f3e] via-[#1f2b38] to-[#131921] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
              <Folder className="h-3.5 w-3.5" />
              <span>Category Showcase</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-300 max-w-2xl">
              {category.description || `Discover top-quality ${category.name} from verified merchants across Ghana.`}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur-xs border border-white/15 self-start sm:self-auto">
            <span className="block text-xl font-black text-[#ff9900]">{total}</span>
            <span className="text-[11px] text-zinc-300 uppercase tracking-wider">Available Products</span>
          </div>
        </div>

        {/* Sibling Categories Pills */}
        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/10">
          <Link
            href="/shop"
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-white/20 transition"
          >
            All Categories
          </Link>
          {allCategories.slice(0, 8).map((cat) => {
            const isCurrent = cat.slug === slug;
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  isCurrent
                    ? "bg-[#ff9900] text-zinc-950 font-bold"
                    : "bg-white/10 text-zinc-300 hover:bg-white/20"
                }`}
              >
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2-Column Catalog Layout */}
      <div className="flex items-start gap-8">
        {/* Left Column: Desktop Faceted Filter Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block sticky top-24 rounded-2xl bg-white p-5 shadow-xs border border-zinc-100">
          <ShopFilters
            categories={allCategories}
            totalProducts={total}
          />
        </aside>

        {/* Right Column: Catalog Grid & Top Controls */}
        <main className="flex-1 min-w-0">
          {/* Controls Bar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-3.5 shadow-xs border border-zinc-100">
            <div className="flex items-center gap-3">
              <MobileFilterDrawer
                categories={allCategories}
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
          <ActiveFilterChips categories={allCategories} />

          {/* Product Grid */}
          <div className="mt-2">
            <ProductGrid
              products={products}
              emptyMessage={`No products found in ${category.name} matching your filter criteria.`}
            />
          </div>

          {/* Pagination */}
          <div className="mt-8">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath={`/category/${slug}`}
              searchParams={paginationParams}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
