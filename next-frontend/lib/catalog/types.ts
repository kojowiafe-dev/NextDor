export type ProductImage = {
  src: string;
  alt: string;
};

export type ProductCategory = {
  slug: string;
  name: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  regularPrice: number | null;
  currency: string;
  onSale: boolean;
  images: ProductImage[];
  categories: ProductCategory[];
  rating: number;
  reviewCount: number;
  inStock: boolean;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  parentId: string | null;
  count: number;
};

export type ProductSort =
  | "popularity"
  | "rating"
  | "date"
  | "price-asc"
  | "price-desc";

export type GetProductsOptions = {
  page?: number;
  perPage?: number;
  category?: string;
  search?: string;
  sort?: ProductSort;
  onSale?: boolean;
};

export type PaginatedProducts = {
  products: Product[];
  total: number;
  totalPages: number;
  page: number;
};

export type TrendingProduct = Product & {
  recentSales?: number;
  trendingBadge?: string;
  vendor?: {
    id?: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };
};

export type OtherSellerOffer = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  stockStatus: string;
  stockQty?: number | null;
  vendor: {
    id?: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    rating?: number;
  };
};

export type MerchantGroup = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  rating?: number;
  totalProducts: number;
  isOfficial?: boolean;
  products: any[];
};

export type ConsolidatedProduct = {
  normalizedName: string;
  displayName: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  image: string;
  sellerCount: number;
  primarySlug: string;
  offers: OtherSellerOffer[];
};
