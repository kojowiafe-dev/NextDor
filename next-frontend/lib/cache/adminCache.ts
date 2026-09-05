/**
 * Client-side in-memory & sessionStorage cache for Admin Catalog data.
 * 
 * DESIGN PATTERN: Stale-While-Revalidate (SWR) Caching Strategy
 * ───────────────────────────────────────────────────────────────
 * Eliminates screen-flickering loading spinners when navigating between
 * admin tabs (e.g. from /admin/products to /admin and back).
 * 
 * 1. Instant Render: Returns memory-cached products immediately if available.
 * 2. Background Revalidation: Allows the caller to quietly fetch updates in
 *    the background without blocking the UI.
 * 3. Cache Invalidation: Explicitly clears the cache upon product create,
 *    update, delete, or WooCommerce sync operations.
 */

import type { ProductItem } from "@/app/admin/products/page";

interface CacheStore {
  products: ProductItem[] | null;
  lastFetched: number;
}

const MEMORY_CACHE: CacheStore = {
  products: null,
  lastFetched: 0,
};

const CACHE_STORAGE_KEY = "nextdor_admin_products_cache";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh window

export function getCachedProducts(): ProductItem[] | null {
  // 1. Check in-memory cache first (instantaneous)
  if (MEMORY_CACHE.products && MEMORY_CACHE.products.length > 0) {
    return MEMORY_CACHE.products;
  }

  // 2. Check sessionStorage fallback (persists across same-tab navigations)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { data: ProductItem[]; timestamp: number };
        if (parsed?.data && Array.isArray(parsed.data)) {
          MEMORY_CACHE.products = parsed.data;
          MEMORY_CACHE.lastFetched = parsed.timestamp;
          return parsed.data;
        }
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }

  return null;
}

export function isProductsCacheStale(maxAgeMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - MEMORY_CACHE.lastFetched > maxAgeMs;
}

export function setCachedProducts(products: ProductItem[]): void {
  MEMORY_CACHE.products = products;
  MEMORY_CACHE.lastFetched = Date.now();

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        CACHE_STORAGE_KEY,
        JSON.stringify({
          data: products,
          timestamp: MEMORY_CACHE.lastFetched,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }
}

export function invalidateProductsCache(): void {
  MEMORY_CACHE.products = null;
  MEMORY_CACHE.lastFetched = 0;

  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
