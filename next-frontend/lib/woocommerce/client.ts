import type { WCProduct, WCCategoryFull } from "./types";

const REVALIDATE_SECONDS = 300;

const FALLBACK_STORE_URLS = [
  process.env.WOOCOMMERCE_STORE_URL,
  "https://nextdor.online/wp-json/wc/store/v1",
  "https://www.nextdor.online/wp-json/wc/store/v1",
].filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);

type FetchOptions = {
  searchParams?: Record<string, string | number | undefined>;
};

type FetchWithMeta<T> = {
  data: T;
  total: number;
  totalPages: number;
};

// Builds the URL with search params (shared by both fetch helpers)
function buildUrl(
  baseUrl: string,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): URL {
  const url = new URL(`${baseUrl}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url;
}

// Plain fetch — returns JSON body only (existing behaviour)
async function storeFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (const baseUrl of FALLBACK_STORE_URLS) {
    const url = buildUrl(baseUrl, path, options.searchParams);
    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${path}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      console.warn(
        `[WooCommerce] Failed to fetch ${url.toString()}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("WooCommerce API unavailable");
}

// Paginated fetch — returns JSON body + X-WP-Total / X-WP-TotalPages headers
async function storeFetchWithMeta<T>(
  path: string,
  options: FetchOptions = {},
): Promise<FetchWithMeta<T>> {
  let lastError: unknown;

  for (const baseUrl of FALLBACK_STORE_URLS) {
    const url = buildUrl(baseUrl, path, options.searchParams);
    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${path}`);
      }
      const data = (await response.json()) as T;
      const total = Number(response.headers.get("X-WP-Total") ?? 0);
      const totalPages = Number(response.headers.get("X-WP-TotalPages") ?? 1);
      return { data, total, totalPages };
    } catch (error) {
      lastError = error;
      console.warn(
        `[WooCommerce] Failed to fetch ${url.toString()}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("WooCommerce API unavailable");
}

export async function fetchWCProducts(
  searchParams: Record<string, string | number | undefined> = {},
): Promise<WCProduct[]> {
  try {
    return await storeFetch<WCProduct[]>("/products", { searchParams });
  } catch {
    return [];
  }
}

export type WCProductsWithMeta = {
  products: WCProduct[];
  total: number;
  totalPages: number;
};

export async function fetchWCProductsWithMeta(
  searchParams: Record<string, string | number | undefined> = {},
): Promise<WCProductsWithMeta> {
  try {
    const { data, total, totalPages } = await storeFetchWithMeta<WCProduct[]>(
      "/products",
      { searchParams },
    );
    return { products: data, total, totalPages };
  } catch {
    return { products: [], total: 0, totalPages: 1 };
  }
}

export async function fetchWCProductById(id: number): Promise<WCProduct | null> {
  try {
    return await storeFetch<WCProduct>(`/products/${id}`);
  } catch {
    return null;
  }
}

export async function fetchWCCategories(): Promise<WCCategoryFull[]> {
  try {
    return await storeFetch<WCCategoryFull[]>("/products/categories", {
      searchParams: { per_page: 100 },
    });
  } catch {
    return [];
  }
}

export async function fetchWCRelatedProducts(
  productId: number,
  perPage = 10,
): Promise<WCProduct[]> {
  try {
    return await storeFetch<WCProduct[]>("/products", {
      searchParams: { related: productId, per_page: perPage },
    });
  } catch {
    return [];
  }
}

export { REVALIDATE_SECONDS };
