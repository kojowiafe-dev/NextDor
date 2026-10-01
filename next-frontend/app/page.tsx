import {
  getCategories,
  getDealOfTheDay,
  getAllProducts,
} from "@/lib/catalog";
import { StreamlinedStorefront } from "@/components/home/StreamlinedStorefront";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function HomePage() {
  const [categories, dealProduct, products] = await Promise.all([
    getCategories(),
    getDealOfTheDay(),
    getAllProducts(),
  ]);

  return (
    <StreamlinedStorefront
      products={products}
      categories={categories}
      dealProduct={dealProduct}
    />
  );
}
