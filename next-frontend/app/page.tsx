import {
  getCategories,
  getDealOfTheDay,
  getFeaturedProducts,
  getPopularProducts,
} from "@/lib/catalog";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ProductRow } from "@/components/home/ProductRow";

export default async function HomePage() {
  const [categories, dealProduct, featured, popular] = await Promise.all([
    getCategories(),
    getDealOfTheDay(),
    getFeaturedProducts(5),
    getPopularProducts(5),
  ]);

  const dealProducts = dealProduct ? [dealProduct] : [];

  return (
    <>
      <HeroCarousel dealProduct={dealProduct} />
      <CategoryTiles categories={categories} />
      {dealProducts.length > 0 && (
        <ProductRow
          title="Deal of the Day"
          products={dealProducts}
          viewAllHref="/shop?sort=price-desc"
        />
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
