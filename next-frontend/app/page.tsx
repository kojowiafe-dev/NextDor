import {
  getCategories,
  getDealOfTheDay,
  getFeaturedProducts,
  getPopularProducts,
  getTrendingProducts,
  getGroupedByMerchant,
} from "@/lib/catalog";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ProductRow } from "@/components/home/ProductRow";
import { TrendingRow } from "@/components/home/TrendingRow";
import { MerchantSpotlightRow } from "@/components/home/MerchantSpotlightRow";

export default async function HomePage() {
  const [categories, dealProduct, trendingProducts, merchants, featured, popular] =
    await Promise.all([
      getCategories(),
      getDealOfTheDay(),
      getTrendingProducts(5),
      getGroupedByMerchant(4, 4),
      getFeaturedProducts(5),
      getPopularProducts(5),
    ]);

  const dealProducts = dealProduct ? [dealProduct] : [];

  return (
    <>
      <HeroCarousel dealProduct={dealProduct} />
      <CategoryTiles categories={categories} />

      {/* 1. Real-Time Trending Section (Sales Velocity & Urgency) */}
      {trendingProducts.length > 0 && (
        <TrendingRow products={trendingProducts} />
      )}

      {dealProducts.length > 0 && (
        <ProductRow
          title="Deal of the Day"
          products={dealProducts}
          viewAllHref="/shop?sort=price-desc"
        />
      )}

      {/* 2. Group Products by Verified Merchant (Multi-Tenant Marketplace Spotlight) */}
      {merchants.length > 0 && (
        <MerchantSpotlightRow merchants={merchants} />
      )}

      <ProductRow
        title="Featured Products"
        products={featured}
        viewAllHref="/shop"
      />

      <ProductRow
        title="Popular Products"
        products={popular}
        viewAllHref="/shop?sort=popularity"
      />
    </>
  );
}
