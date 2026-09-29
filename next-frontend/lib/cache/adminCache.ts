/**
 * Shared SWR Cache instances for Operations Admin Portal.
 */

import { createSWRCache } from "@/lib/cache/clientCache";
import type { AdminOrder, AdminCustomer } from "@/lib/admin/mockData";
import type { ProductItem } from "@/app/admin/products/page";

// 1. Orders Cache (sub-keyed by status filter: all, processing, shipped, etc.)
export const adminOrdersCache = createSWRCache<AdminOrder[]>("nextdor_admin_orders", 2 * 60_000);

// 2. Products Catalog Cache
export const adminProductsCache = createSWRCache<ProductItem[]>("nextdor_admin_products", 5 * 60_000);

// 3. Customers Cache
export const adminCustomersCache = createSWRCache<AdminCustomer[]>("nextdor_admin_customers", 5 * 60_000);

// Legacy helpers for backwards compatibility
export function getCachedProducts(): ProductItem[] | null {
  return adminProductsCache.get();
}

export function isProductsCacheStale(): boolean {
  return adminProductsCache.isStale();
}

export function setCachedProducts(products: ProductItem[]): void {
  adminProductsCache.set(products);
}

export function invalidateProductsCache(): void {
  adminProductsCache.invalidateAll();
}
