import type { WCProduct, WCCategoryFull } from "./types";

const DEFAULT_STORE_URL =
  "https://www.nextdor.online/wp-json/wc/store/v1";

const REVALIDATE_SECONDS = 300;

function getStoreUrl(): string {
  return process.env.WOOCOMMERCE_STORE_URL ?? DEFAULT_STORE_URL;
}

type FetchOptions = {
  searchParams?: Record<string, string | number | undefined>;
};

async function storeFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const url = new URL(`${getStoreUrl()}${path}`);

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchWCProducts(
  searchParams: Record<string, string | number | undefined> = {},
): Promise<WCProduct[]> {
  return storeFetch<WCProduct[]>("/products", { searchParams });
}

export async function fetchWCProductById(id: number): Promise<WCProduct> {
  return storeFetch<WCProduct>(`/products/${id}`);
}

export async function fetchWCCategories(): Promise<WCCategoryFull[]> {
  return storeFetch<WCCategoryFull[]>("/products/categories", {
    searchParams: { per_page: 100 },
  });
}

export async function fetchWCRelatedProducts(
  productId: number,
  perPage = 10,
): Promise<WCProduct[]> {
  return storeFetch<WCProduct[]>("/products", {
    searchParams: { related: productId, per_page: perPage },
  });
}

export { REVALIDATE_SECONDS };
