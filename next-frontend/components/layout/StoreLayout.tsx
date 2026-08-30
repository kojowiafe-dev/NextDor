import { getCategories } from "@/lib/catalog";
import { CartProvider } from "@/context/CartContext";
import { CategoryNav } from "@/components/layout/CategoryNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getCategories();

  return (
    <CartProvider>
      <div id="top" className="flex min-h-screen flex-col bg-[#eaeded]">
        <Header />
        <CategoryNav categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  );
}
