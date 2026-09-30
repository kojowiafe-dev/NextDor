import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { Star } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
  getOtherSellers,
} from "@/lib/catalog";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductRow } from "@/components/home/ProductRow";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { OtherSellersSection } from "@/components/product/OtherSellersSection";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product?.name ?? "Product",
    description: product?.shortDescription,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [related, otherSellers] = await Promise.all([
    getRelatedProducts(product.id),
    getOtherSellers(product.name, product.slug),
  ]);
  const sanitizedDescription = DOMPurify.sanitize(product.description);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/" className="hover:text-[#c7511f] hover:underline">
          Home
        </Link>
        {product.categories[0] && (
          <>
            <span className="mx-2">›</span>
            <Link
              href={`/category/${product.categories[0].slug}`}
              className="hover:text-[#c7511f] hover:underline"
            >
              {product.categories[0].name}
            </Link>
          </>
        )}
        <span className="mx-2">›</span>
        <span className="text-zinc-900">{product.name}</span>
      </nav>

      <div className="grid gap-8 rounded-lg bg-white p-6 shadow-sm lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {product.name}
          </h1>

          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="flex text-[#ff9900]">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={`h-4 w-4 ${
                    index < Math.round(product.rating)
                      ? "fill-current"
                      : "fill-zinc-200 text-zinc-200"
                  }`}
                />
              ))}
            </div>
            <span>{product.reviewCount} reviews</span>
          </div>

          {product.onSale && (
            <span className="inline-block rounded bg-[#cc0c39] px-2 py-0.5 text-xs font-bold text-white">
              SALE
            </span>
          )}

          <p className="text-sm text-zinc-600">
            {product.inStock ? (
              <span className="font-medium text-green-700 whitespace-nowrap">In Stock</span>
            ) : (
              <span className="font-medium text-red-600 whitespace-nowrap">Out of Stock</span>
            )}
          </p>

          <AddToCartButton product={product} />
        </div>
      </div>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          Product Description
        </h2>
        <div
          className="prose prose-sm max-w-none text-zinc-700"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      </section>

      {/* Multi-Seller Grouping: Alternative Merchant Offers */}
      {otherSellers.length > 0 && (
        <OtherSellersSection
          sellers={otherSellers}
          currentPrice={product.price}
          productName={product.name}
        />
      )}

      <ReviewsSection
        productId={product.id}
        avgRating={product.rating}
        reviewCount={product.reviewCount}
      />

      {related.length > 0 && (
        <div className="mt-4">
          <ProductRow title="Related Products" products={related} />
        </div>
      )}
    </div>
  );
}
