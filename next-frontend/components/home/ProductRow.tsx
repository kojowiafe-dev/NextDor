import Link from "next/link";
import type { Product } from "@/lib/catalog/types";
import { ProductCard } from "@/components/product/ProductCard";

type ProductRowProps = {
  title: string;
  products: Product[];
  viewAllHref?: string;
};

export function ProductRow({ title, products, viewAllHref }: ProductRowProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            See more
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
