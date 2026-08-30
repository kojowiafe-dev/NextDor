import { getProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export const metadata = {
  title: "Search Results",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const { products } = query
    ? await getProducts({ search: query, perPage: 24 })
    : { products: [] };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
        {query ? `Results for "${query}"` : "Search"}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {query
          ? `${products.length} product${products.length === 1 ? "" : "s"} found`
          : "Enter a search term in the header to find products."}
      </p>

      <ProductGrid
        products={products}
        emptyMessage={
          query
            ? `No products found for "${query}". Try a different search term.`
            : "No search query provided."
        }
      />
    </div>
  );
}
