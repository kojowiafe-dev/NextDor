"use client";

import { usePathname } from "next/navigation";
import { CategoryNav } from "@/components/layout/CategoryNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingSupportButton } from "@/components/layout/FloatingSupportButton";
import type { Category } from "@/lib/catalog";

interface StorefrontShellProps {
  categories: Category[];
  children: React.ReactNode;
}

export function StorefrontShell({ categories, children }: StorefrontShellProps) {
  const pathname = usePathname();

  // Exclude /admin and /vendor back-office portals from the public consumer storefront header and footer
  const isPortalRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/vendor");

  if (isPortalRoute) {
    return <>{children}</>;
  }

  return (
    <div id="top" className="flex min-h-screen flex-col bg-[#eaeded] pb-16 md:pb-0">
      <Header categories={categories} />
      <CategoryNav categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingSupportButton />
      <BottomNav />
    </div>
  );
}
