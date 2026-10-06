import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
  getOtherSellers,
} from "@/lib/catalog";
import { sanitizeHtml } from "@/lib/utils";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductRow } from "@/components/home/ProductRow";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { OtherSellersSection } from "@/components/product/OtherSellersSection";

import { ProductDeliveryInfo } from "@/components/product/ProductDeliveryInfo";
import { ProductSpecifications } from "@/components/product/ProductSpecifications";
import { PriceDisplay } from "@/components/product/PriceDisplay";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | NextDor Ghana",
    };
  }

  const title = `${product.name} — Buy Online in Ghana | NextDor`;
  const description =
    product.shortDescription ||
    `Buy ${product.name} at the best price in Ghana on NextDor. Verified sellers, fast delivery across Accra and nationwide, 48-hour buyer escrow guarantee.`;
  const canonicalUrl = `https://nextdor.online/product/${product.slug}`;
  const images = product.images?.[0]?.src ? [product.images[0].src] : [];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "NextDor Ghana",
      images: images.map((url) => ({ url, alt: product.name })),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
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
  const sanitizedDescription = sanitizeHtml(product.description || "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images?.map((img) => img.src) || [],
    description: product.shortDescription || product.description,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "NextDor",
    },
    offers: {
      "@type": "Offer",
      url: `https://nextdor.online/product/${product.slug}`,
      priceCurrency: "GHS",
      price: product.price,
      priceValidUntil: "2027-12-31",
      itemCondition: "https://schema.org/NewCondition",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: product.vendor?.name || "NextDor Verified Merchant",
      },
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Schema.org Structured Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
                    product.reviewCount > 0 && index < Math.round(product.rating)
                      ? "fill-current"
                      : "fill-zinc-100 text-zinc-300"
                  }`}
                />
              ))}
            </div>
            <span>
              {product.reviewCount > 0
                ? `${product.reviewCount} reviews`
                : "No reviews yet"}
            </span>
          </div>

          <div className="py-1">
            <PriceDisplay product={product} size="lg" />
          </div>

          <p className="text-sm text-zinc-600">
            {product.inStock ? (
              <span className="font-medium text-green-700 whitespace-nowrap">In Stock</span>
            ) : (
              <span className="font-medium text-red-600 whitespace-nowrap">Out of Stock</span>
            )}
          </p>

          <AddToCartButton product={product} />

          {/* Delivery & Trust Widget (Items #9, #10, #25, #26, #32) */}
          <div className="pt-2">
            <ProductDeliveryInfo
              vendor={product.vendor ? {
                name: product.vendor.name,
                slug: product.vendor.slug,
                isVerified: true,
              } : null}
              currency={product.currency}
            />
          </div>
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

      {/* Specifications, SKU & Warranty (Items #20 & #22) */}
      <ProductSpecifications product={product} />

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
