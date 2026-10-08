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
  AutocompleteResult,
  AutocompleteProduct,
  AutocompleteCategory,
} from "./types";
import { API_BASE } from "@/lib/api-config";

export function getDiscountPercent(product: { price: number; regularPrice?: number | null }): number {
  if (!product.regularPrice || product.regularPrice <= product.price) return 0;
  return Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100);
}

function sortToBackendParam(sort?: ProductSort): string {
  switch (sort) {
    case "price-asc":
      return "price_asc";
    case "price-desc":
      return "price_desc";
    case "rating":
      return "rating";
    case "date":
      return "newest";
    case "popularity":
    default:
      return "popular";
  }
}

function mapBackendProduct(p: any): Product {
  const price = Number(p.salePrice ?? p.price ?? 0);
  const regularPrice = p.salePrice ? Number(p.price) : null;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description || "",
    shortDescription: p.shortDesc || "",
    price,
    regularPrice,
    currency: p.currency || "GHS",
    onSale: Boolean(p.salePrice && p.salePrice < p.price),
    images: Array.isArray(p.images) && p.images.length > 0
      ? p.images.map((img: any) => ({
          src: typeof img === "string" ? img : img.url || img.src || "",
          alt: typeof img === "object" ? img.alt || p.name : p.name,
        }))
      : [{ src: "", alt: p.name }],
    categories: Array.isArray(p.categories)
      ? p.categories.map((c: any) => ({ slug: c.slug, name: c.name }))
      : [],
    rating: Number(p.averageRating || 0),
    reviewCount: p.reviewCount || 0,
    inStock: p.stockStatus === "IN_STOCK",
    vendor: p.vendor
      ? {
          id: p.vendor.id,
          name: p.vendor.name,
          slug: p.vendor.slug,
          isVerified: p.vendor.status === "ACTIVE",
          logoUrl: p.vendor.logoUrl ?? null,
        }
      : undefined,
  };
}

/**
 * Fetches paginated products from the NextDor marketplace catalog.
 */
export async function getProducts(
  options: GetProductsOptions = {},
): Promise<PaginatedProducts> {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 12;

  try {
    const queryParts = [
      `page=${page}`,
      `limit=${perPage}`,
      options.sort ? `sort=${sortToBackendParam(options.sort)}` : "",
      options.search ? `search=${encodeURIComponent(options.search)}` : "",
      options.category ? `category=${encodeURIComponent(options.category)}` : "",
      options.vendor ? `vendor=${encodeURIComponent(options.vendor)}` : "",
      options.minPrice != null ? `minPrice=${options.minPrice}` : "",
      options.maxPrice != null ? `maxPrice=${options.maxPrice}` : "",
      options.inStock ? `inStock=true` : "",
      options.onSale ? `onSale=true` : "",
      options.rating ? `rating=${options.rating}` : "",
    ].filter(Boolean).join("&");

    const res = await fetch(`${API_BASE}/products?${queryParts}`, {
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.products)) {
        let products: Product[] = json.data.products.map(mapBackendProduct);
        if (options.onSale) {
          products = products.filter((product) => product.onSale);
        }
        return {
          products,
          total: json.data.total ?? products.length,
          totalPages: json.data.totalPages ?? Math.max(1, Math.ceil((json.data.total ?? products.length) / perPage)),
          page,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to fetch products from backend:", err);
  }

  return {
    products: [],
    total: 0,
    totalPages: 1,
    page,
  };
}

/**
 * Fetches all products matching options from NextDor marketplace catalog.
 */
export async function getAllProducts(
  options: Omit<GetProductsOptions, "page" | "perPage"> = {},
): Promise<Product[]> {
  try {
    const queryParts = [
      `page=1`,
      `limit=100`,
      options.sort ? `sort=${sortToBackendParam(options.sort)}` : "",
      options.search ? `search=${encodeURIComponent(options.search)}` : "",
      options.category ? `category=${encodeURIComponent(options.category)}` : "",
      options.vendor ? `vendor=${encodeURIComponent(options.vendor)}` : "",
      options.minPrice != null ? `minPrice=${options.minPrice}` : "",
      options.maxPrice != null ? `maxPrice=${options.maxPrice}` : "",
      options.inStock ? `inStock=true` : "",
      options.onSale ? `onSale=true` : "",
      options.rating ? `rating=${options.rating}` : "",
    ].filter(Boolean).join("&");

    const res = await fetch(`${API_BASE}/products?${queryParts}`, {
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.products)) {
        let products: Product[] = json.data.products.map(mapBackendProduct);
        if (options.onSale) {
          products = products.filter((product) => product.onSale);
        }
        return products;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch all products from backend:", err);
  }

  return [];
}

/**
 * Single product lookup by slug from NextDor catalog.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.product) {
        return mapBackendProduct(json.data.product);
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch product '${slug}':`, err);
  }

  return null;
}

/**
 * Single product lookup by ID from NextDor catalog.
 */
export async function getProductById(id: string): Promise<Product | null> {
  return getProductBySlug(id);
}

/**
 * Fetches all product categories from NextDor catalog.
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE}/products/categories`, {
      next: { revalidate: 120 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.categories)) {
        return json.data.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || "",
          parentId: c.parentId ?? null,
          count: c._count?.products ?? c.count ?? 0,
        }));
      }
    }
  } catch (err) {
    console.warn("Failed to fetch categories from backend:", err);
  }

  return [];
}

/**
 * Retrieves a single category by slug from NextDor catalog.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

/**
 * Fetches related products from the same category or marketplace catalog.
 */
export async function getRelatedProducts(
  productId: string,
  limit = 8,
): Promise<Product[]> {
  try {
    const current = await getProductById(productId);
    const categorySlug = current?.categories[0]?.slug;

    const query = categorySlug ? `category=${encodeURIComponent(categorySlug)}&limit=${limit + 1}` : `limit=${limit + 1}`;
    const res = await fetch(`${API_BASE}/products?${query}`, {
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.products)) {
        return json.data.products
          .map(mapBackendProduct)
          .filter((p: Product) => p.id !== productId && p.slug !== productId)
          .slice(0, limit);
      }
    }
  } catch (err) {
    console.warn("Failed to fetch related products:", err);
  }

  return [];
}

export async function getDealOfTheDay(): Promise<Product | null> {
  const products = await getAllProducts({ onSale: true });
  if (products.length === 0) {
    const popular = await getPopularProducts(1);
    return popular[0] ?? null;
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
        return json.data.products.map((p: any): TrendingProduct => {
          const mapped = mapBackendProduct(p);
          return {
            ...mapped,
            recentSales: p.recentSales || 1,
            trendingBadge: p.trendingBadge || "🔥 Trending Fast",
            vendor: mapped.vendor
              ? {
                  id: mapped.vendor.id,
                  name: mapped.vendor.name,
                  slug: mapped.vendor.slug,
                  logoUrl: mapped.vendor.logoUrl ?? null,
                }
              : undefined,
          };
        });
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live trending products:", err);
  }

  const fallback = await getPopularProducts(limit);
  return fallback.map((p) => ({
    ...p,
    trendingBadge: "🔥 Trending Fast",
    recentSales: Math.max(1, p.reviewCount * 3),
    vendor: p.vendor || { name: "Nextdor Direct", slug: "nextdor" },
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
            vendor: prod.vendor || {
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
        vendor: prod.vendor || {
          name: "Nextdor Direct",
          slug: "nextdor",
        },
      });
      existing.offers.sort((a, b) => a.price - b.price);
    }
  }

  return Array.from(map.values());
}

/**
 * Client/Server function for real-time instant autocomplete search suggestions.
 */
export async function fetchAutocomplete(
  query: string,
  limit = 6
): Promise<AutocompleteResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { products: [], categories: [] };
  }

  try {
    const res = await fetch(
      `${API_BASE}/products/autocomplete?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
      { next: { revalidate: 30 } }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("Autocomplete fetch failed:", err);
  }

  return { products: [], categories: [] };
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
  AutocompleteResult,
  AutocompleteProduct,
  AutocompleteCategory,
};
