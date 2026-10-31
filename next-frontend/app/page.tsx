import {
  getCategories,
  getDealOfTheDay,
  getAllProducts,
} from "@/lib/catalog";
import { StreamlinedStorefront } from "@/components/home/StreamlinedStorefront";
import { HeroCarousel } from "@/components/home/HeroCarousel";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function HomePage() {
  const [categories, dealProduct, products] = await Promise.all([
    getCategories(),
    getDealOfTheDay(),
    getAllProducts(),
  ]);

  return (
    <main className="space-y-4">
      <HeroCarousel />
      <StreamlinedStorefront
        products={products}
        categories={categories}
        dealProduct={dealProduct}
      />
    </main>
  );
}
