import { headers } from "next/headers";
import { getCategories } from "@/lib/catalog";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CategoryNav } from "@/components/layout/CategoryNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin routes are tagged by middleware — skip the storefront shell for them
  const headersList = await headers();
  const isAdminRoute = headersList.get("x-is-admin-route") === "true";

  if (isAdminRoute) {
    // Providers still needed (AuthContext used by AdminGuard)
    return (
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    );
  }

  const categories = await getCategories();

  return (
    <AuthProvider>
      <CartProvider>
        <div id="top" className="flex min-h-screen flex-col bg-[#eaeded]">
          <Header categories={categories} />
          <CategoryNav categories={categories} />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
