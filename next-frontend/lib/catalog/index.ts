import type {
  Category,
  GetProductsOptions,
  PaginatedProducts,
  Product,
  ProductSort,
} from "./types";
import {
  fetchWCCategories,
  fetchWCProductById,
  fetchWCProducts,
  fetchWCProductsWithMeta,
  fetchWCRelatedProducts,
} from "@/lib/woocommerce/client";
import {
  getDiscountPercent,
  mapWCCategory,
  mapWCProduct,
  mapWCProducts,
} from "@/lib/woocommerce/mappers";

function sortToWCParams(sort?: ProductSort): {
  orderby?: string;
  order?: string;
} {
  switch (sort) {
    case "popularity":
      return { orderby: "popularity", order: "desc" };
    case "rating":
      return { orderby: "rating", order: "desc" };
    case "date":
      return { orderby: "date", order: "desc" };
    case "price-asc":
      return { orderby: "price", order: "asc" };
    case "price-desc":
      return { orderby: "price", order: "desc" };
    default:
      return {};
  }
}

export async function getProducts(
  options: GetProductsOptions = {},
): Promise<PaginatedProducts> {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 12;

  const params: Record<string, string | number | undefined> = {
    page,
    per_page: perPage,
    ...sortToWCParams(options.sort),
  };

  if (options.search) {
    params.search = options.search;
  }

  if (options.category) {
    const category = await getCategoryBySlug(options.category);
    if (category) {
      params.category = category.id;
    }
  }

  const { products: rawProducts, total, totalPages } =
    await fetchWCProductsWithMeta(params);
  let products = mapWCProducts(rawProducts);

  if (options.onSale) {
    products = products.filter((product) => product.onSale);
  }

  return {
    products,
    total,
    // Fall back to local calculation only when onSale filter reduces the count
    totalPages: options.onSale
      ? Math.max(1, Math.ceil(products.length / perPage))
      : Math.max(1, totalPages),
    page,
  };
}

export async function getAllProducts(
  options: Omit<GetProductsOptions, "page" | "perPage"> = {},
): Promise<Product[]> {
  const params: Record<string, string | number | undefined> = {
    per_page: 100,
    ...sortToWCParams(options.sort),
  };

  if (options.search) {
    params.search = options.search;
  }

  if (options.category) {
    const category = await getCategoryBySlug(options.category);
    if (category) {
      params.category = category.id;
    }
  }

  const rawProducts = await fetchWCProducts(params);
  let products = mapWCProducts(rawProducts);

  if (options.onSale) {
    products = products.filter((product) => product.onSale);
  }

  return products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const rawProducts = await fetchWCProducts({ per_page: 100 });
  const product = mapWCProducts(rawProducts).find(
    (entry) => entry.slug === slug,
  );
  return product ?? null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const rawProduct = await fetchWCProductById(Number(id));
  if (!rawProduct) {
    return null;
  }

  const product = mapWCProduct(rawProduct);
  return product.price > 0 ? product : null;
}

export async function getCategories(): Promise<Category[]> {
  const rawCategories = await fetchWCCategories();
  return rawCategories
    .map(mapWCCategory)
    .filter(
      (category) =>
        category.count > 0 &&
        category.slug !== "uncategorized" &&
        category.parentId === null,
    )
    .sort((a, b) => b.count - a.count);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const categories = await fetchWCCategories();
  const match = categories.find((category) => category.slug === slug);
  return match ? mapWCCategory(match) : null;
}

export async function getRelatedProducts(
  productId: string,
  limit = 8,
): Promise<Product[]> {
  const rawProducts = await fetchWCRelatedProducts(Number(productId), limit);
  return mapWCProducts(rawProducts);
}

export async function getDealOfTheDay(): Promise<Product | null> {
  const products = await getAllProducts({ onSale: true });
  if (products.length === 0) {
    return null;
  }

  return products.reduce((best, current) =>
    getDiscountPercent(current) > getDiscountPercent(best) ? current : best,
  );
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const products = await getAllProducts({ sort: "date" });
  return products.slice(0, limit);
}

export async function getPopularProducts(limit = 8): Promise<Product[]> {
  const products = await getAllProducts({ sort: "popularity" });
  return products.slice(0, limit);
}

export type { Category, Product, GetProductsOptions, PaginatedProducts, ProductSort };
