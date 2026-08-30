import type { Category, Product } from "@/lib/catalog/types";
import type { WCCategoryFull, WCProduct } from "./types";

const INTERNAL_PRODUCT_SLUGS = new Set(["reverse-withdrawal-payment"]);

function parsePrice(
  value: string,
  minorUnit: number,
): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed / 10 ** minorUnit;
}

export function isValidProduct(product: WCProduct): boolean {
  if (INTERNAL_PRODUCT_SLUGS.has(product.slug)) {
    return false;
  }

  const price = parsePrice(
    product.prices.price,
    product.prices.currency_minor_unit,
  );

  return product.is_purchasable && price > 0;
}

export function mapWCProduct(product: WCProduct): Product {
  const minorUnit = product.prices.currency_minor_unit;
  const price = parsePrice(product.prices.price, minorUnit);
  const regularPrice = parsePrice(product.prices.regular_price, minorUnit);
  const salePrice = parsePrice(product.prices.sale_price, minorUnit);

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    description: product.description,
    shortDescription: product.short_description,
    price,
    regularPrice:
      product.on_sale && regularPrice > price ? regularPrice : null,
    currency: product.prices.currency_code,
    onSale: product.on_sale && salePrice > 0 && salePrice < regularPrice,
    images: product.images.map((image) => ({
      src: image.src,
      alt: image.alt || image.name || product.name,
    })),
    categories: product.categories.map((category) => ({
      slug: category.slug,
      name: category.name,
    })),
    rating: Number(product.average_rating) || 0,
    reviewCount: product.review_count,
    inStock: product.is_in_stock,
  };
}

export function mapWCCategory(category: WCCategoryFull): Category {
  return {
    id: String(category.id),
    slug: category.slug,
    name: category.name,
    description: category.description,
    parentId: category.parent ? String(category.parent) : null,
    count: category.count,
  };
}

export function mapWCProducts(products: WCProduct[]): Product[] {
  return products.filter(isValidProduct).map(mapWCProduct);
}

export function getDiscountPercent(product: Product): number {
  if (!product.onSale || !product.regularPrice || product.regularPrice <= 0) {
    return 0;
  }

  return Math.round(
    ((product.regularPrice - product.price) / product.regularPrice) * 100,
  );
}
