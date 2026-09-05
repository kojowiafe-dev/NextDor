import { headers } from "next/headers";
import { getCategories } from "@/lib/catalog";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { StorefrontShell } from "@/components/layout/StorefrontShell";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin and Vendor portal routes are tagged by middleware — skip the storefront shell for them
  const headersList = await headers();
  const isPortalRoute =
    headersList.get("x-is-portal-route") === "true" ||
    headersList.get("x-is-admin-route") === "true";

  if (isPortalRoute) {
    // Providers still needed (AuthContext used by AdminGuard and Vendor Dashboard)
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
        <StorefrontShell categories={categories}>
          {children}
        </StorefrontShell>
      </CartProvider>
    </AuthProvider>
  );
}
