import { getCategories } from "@/lib/catalog";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { StorefrontShell } from "@/components/layout/StorefrontShell";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getCategories();

  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <StorefrontShell categories={categories}>
            {children}
          </StorefrontShell>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
