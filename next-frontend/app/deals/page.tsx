import type { Metadata } from "next";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { DealsClient } from "./DealsClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Today's Deals & Flash Discounts | NextDor Ghana",
  description:
    "Discover verified daily deals, price drops, and flash discounts across electronics, computing, fashion, and home goods in Ghana. Backed by 48-hour buyer escrow.",
  alternates: {
    canonical: "https://nextdor.online/deals",
  },
  openGraph: {
    title: "Today's Deals & Flash Discounts | NextDor Ghana",
    description:
      "Save big on verified Ghanaian electronics, fashion, groceries, and home appliances. Fast nationwide delivery.",
    url: "https://nextdor.online/deals",
    siteName: "NextDor Ghana",
    type: "website",
  },
};

export default async function DealsPage() {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getCategories(),
  ]);

  return <DealsClient initialProducts={products} categories={categories} />;
}
