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
