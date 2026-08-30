export type WCPrice = {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_minor_unit: number;
};

export type WCImage = {
  id: number;
  src: string;
  thumbnail: string;
  name: string;
  alt: string;
};

export type WCCategory = {
  id: number;
  name: string;
  slug: string;
  link: string;
};

export type WCProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  on_sale: boolean;
  prices: WCPrice;
  average_rating: string;
  review_count: number;
  images: WCImage[];
  categories: WCCategory[];
  is_in_stock: boolean;
  is_purchasable: boolean;
};

export type WCCategoryFull = {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  permalink: string;
};

export type WCProductsResponse = WCProduct[];
