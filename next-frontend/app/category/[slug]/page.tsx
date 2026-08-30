import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return {
    title: category?.name ?? "Category",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const { products } = await getProducts({
    category: slug,
    perPage: 24,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] hover:underline">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-zinc-900">{category.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {category.name}
        </h1>
        <p className="text-sm text-zinc-500">{category.count} products</p>
      </div>

      <ProductGrid
        products={products}
        emptyMessage={`No products found in ${category.name}.`}
      />
    </div>
  );
}
