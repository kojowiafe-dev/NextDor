import type {
  Category,
  GetProductsOptions,
  PaginatedProducts,
  Product,
  ProductSort,
  TrendingProduct,
  OtherSellerOffer,
  MerchantGroup,
  ConsolidatedProduct,
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

/**
 * Fetches real-time trending products based on 7-day sales velocity and rating acceleration.
 */
export async function getTrendingProducts(limit = 8): Promise<TrendingProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/products/trending?limit=${limit}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.products) && json.data.products.length > 0) {
        return json.data.products.map((p: any): TrendingProduct => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description || "",
          shortDescription: p.shortDesc || "",
          price: Number(p.salePrice ?? p.price),
          regularPrice: p.salePrice ? Number(p.price) : null,
          currency: p.currency || "GHS",
          onSale: Boolean(p.salePrice),
          images: p.images?.length > 0
            ? p.images.map((img: any) => ({ src: img.url, alt: img.alt || p.name }))
            : [{ src: "", alt: p.name }],
          categories: p.categories?.map((c: any) => ({ slug: c.slug, name: c.name })) || [],
          rating: Number(p.averageRating || 0),
          reviewCount: p.reviewCount || 0,
          inStock: p.stockStatus === "IN_STOCK",
          recentSales: p.recentSales || 1,
          trendingBadge: p.trendingBadge || "🔥 Trending Fast",
          vendor: p.vendor ? {
            id: p.vendor.id,
            name: p.vendor.name,
            slug: p.vendor.slug,
            logoUrl: p.vendor.logoUrl,
          } : undefined,
        }));
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live trending products, falling back to popular:", err);
  }

  // Graceful fallback to catalog popular products if backend is warming up
  const fallback = await getPopularProducts(limit);
  return fallback.map((p) => ({
    ...p,
    trendingBadge: "🔥 Trending Fast",
    recentSales: Math.max(1, p.reviewCount * 3),
    vendor: { name: "Nextdor Direct", slug: "nextdor" },
  }));
}

/**
 * Fetches verified merchants with their top preview products.
 */
export async function getGroupedByMerchant(limitMerchants = 6, productsPerMerchant = 4): Promise<MerchantGroup[]> {
  try {
    const res = await fetch(
      `${API_BASE}/products/grouped-by-merchant?limitMerchants=${limitMerchants}&productsPerMerchant=${productsPerMerchant}`,
      { next: { revalidate: 120 } }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.merchants) && json.data.merchants.length > 0) {
        return json.data.merchants;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live grouped by merchant:", err);
  }
  return [];
}

/**
 * Finds alternative sellers offering the same product name.
 */
export async function getOtherSellers(productName: string, excludeSlug?: string): Promise<OtherSellerOffer[]> {
  try {
    const cleanName = encodeURIComponent(productName.trim());
    const excludeParam = excludeSlug ? `&excludeSlug=${encodeURIComponent(excludeSlug)}` : "";
    const res = await fetch(`${API_BASE}/products/sellers?name=${cleanName}${excludeParam}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.sellers)) {
        return json.data.sellers;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch other sellers:", err);
  }
  return [];
}

/**
 * Client/server helper that groups multi-seller products by normalized title.
 */
export function groupProductsByName(products: Product[]): ConsolidatedProduct[] {
  const map = new Map<string, ConsolidatedProduct>();

  for (const prod of products) {
    const key = prod.name.trim().toLowerCase();
    const price = prod.price;

    if (!map.has(key)) {
      map.set(key, {
        normalizedName: key,
        displayName: prod.name,
        minPrice: price,
        maxPrice: price,
        currency: prod.currency,
        image: prod.images[0]?.src || "",
        sellerCount: 1,
        primarySlug: prod.slug,
        offers: [
          {
            id: prod.id,
            slug: prod.slug,
            name: prod.name,
            price,
            currency: prod.currency,
            stockStatus: prod.inStock ? "IN_STOCK" : "OUT_OF_STOCK",
            vendor: {
              name: "Nextdor Direct",
              slug: "nextdor",
            },
          },
        ],
      });
    } else {
      const existing = map.get(key)!;
      existing.sellerCount += 1;
      existing.minPrice = Math.min(existing.minPrice, price);
      existing.maxPrice = Math.max(existing.maxPrice, price);
      existing.offers.push({
        id: prod.id,
        slug: prod.slug,
        name: prod.name,
        price,
        currency: prod.currency,
        stockStatus: prod.inStock ? "IN_STOCK" : "OUT_OF_STOCK",
        vendor: {
          name: "Nextdor Direct",
          slug: "nextdor",
        },
      });
      existing.offers.sort((a, b) => a.price - b.price);
    }
  }

  return Array.from(map.values());
}

export type {
  Category,
  Product,
  GetProductsOptions,
  PaginatedProducts,
  ProductSort,
  TrendingProduct,
  OtherSellerOffer,
  MerchantGroup,
  ConsolidatedProduct,
};
