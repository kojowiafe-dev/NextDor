/**
 * Administrative types and empty fallback defaults.
 * Real data is served from the NextDor backend API.
 */

export type AdminOrder = {
  id: string;
  dbId?: string;
  customer: { name: string; email: string };
  date: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  currency: string;
  status: "processing" | "shipped" | "delivered" | "cancelled" | "pending" | "confirmed" | "refunded";
  shippingAddress: {
    street: string;
    city: string;
    region: string;
  };
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  salePrice?: number;
  currency: string;
  stock: "in_stock" | "out_of_stock" | "low_stock";
  image: string;
  description: string;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  joined: string;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  status: "active" | "inactive";
};

// Deprecated empty fallbacks (real data is fetched from /api/v1/...)
export const MOCK_ORDERS: AdminOrder[] = [];
export const MOCK_PRODUCTS: AdminProduct[] = [];
export const MOCK_CUSTOMERS: AdminCustomer[] = [];
export const REVENUE_DATA: number[] = new Array(30).fill(0);
export const WEEKLY_REVENUE: number[] = new Array(7).fill(0);
export const ORDERS_BY_STATUS = {
  delivered: 0,
  shipped: 0,
  processing: 0,
  cancelled: 0,
};
export const TOP_PRODUCTS: Array<{ name: string; revenue: number }> = [];
export const SALES_BY_CATEGORY: Array<{ name: string; revenue: number }> = [];
