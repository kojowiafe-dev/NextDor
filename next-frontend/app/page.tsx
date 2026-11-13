import {
  getCategories,
  getDealOfTheDay,
  getAllProducts,
  getHeroBanners,
} from "@/lib/catalog";
import { StreamlinedStorefront } from "@/components/home/StreamlinedStorefront";
import { HeroCarousel } from "@/components/home/HeroCarousel";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function HomePage() {
  const [categories, dealProduct, products, heroData] = await Promise.all([
    getCategories(),
    getDealOfTheDay(),
    getAllProducts(),
    getHeroBanners(),
  ]);

  return (
    <main className="space-y-4">
      <HeroCarousel
        products={products}
        categories={categories}
        dealProduct={dealProduct}
        banners={heroData.banners}
        featuredProducts={heroData.featuredProducts}
      />
      <StreamlinedStorefront
        products={products}
        categories={categories}
        dealProduct={dealProduct}
      />
    </main>
  );
}
