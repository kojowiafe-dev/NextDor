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

async function storeFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (const baseUrl of FALLBACK_STORE_URLS) {
    const url = new URL(`${baseUrl}${path}`);

    if (options.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

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

export async function fetchWCProducts(
  searchParams: Record<string, string | number | undefined> = {},
): Promise<WCProduct[]> {
  try {
    return await storeFetch<WCProduct[]>("/products", { searchParams });
  } catch {
    return [];
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
