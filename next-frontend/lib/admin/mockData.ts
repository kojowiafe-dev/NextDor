// Central mock data for the admin panel.
// Replace each section with real API calls when the backend is ready.

export type AdminOrder = {
  id: string;
  customer: { name: string; email: string };
  date: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  currency: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
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

// ─── Orders ───────────────────────────────────────────────────────────────────

export const MOCK_ORDERS: AdminOrder[] = [
  {
    id: "ND-00130",
    customer: { name: "Kofi Asante", email: "kofi@example.com" },
    date: "Aug 30, 2026",
    items: [{ name: "Samsung 4K Smart TV 43\"", quantity: 1, price: 2800 }],
    total: 2800,
    currency: "GHS",
    status: "processing",
    shippingAddress: { street: "45 Liberation Road", city: "Accra", region: "Greater Accra" },
  },
  {
    id: "ND-00129",
    customer: { name: "Ama Owusu", email: "ama.owusu@gmail.com" },
    date: "Aug 29, 2026",
    items: [
      { name: "Nivea Body Lotion 400ml", quantity: 3, price: 45 },
      { name: "Dove Shampoo 250ml", quantity: 2, price: 28 },
    ],
    total: 191,
    currency: "GHS",
    status: "shipped",
    shippingAddress: { street: "12 Tema Station Road", city: "Tema", region: "Greater Accra" },
  },
  {
    id: "ND-00128",
    customer: { name: "Kwame Mensah", email: "kwame@nextdor.online" },
    date: "Aug 28, 2026",
    items: [{ name: "HP Laptop 15 i5", quantity: 1, price: 3800 }],
    total: 3800,
    currency: "GHS",
    status: "delivered",
    shippingAddress: { street: "22 Independence Ave", city: "Accra", region: "Greater Accra" },
  },
  {
    id: "ND-00127",
    customer: { name: "Abena Darko", email: "abena.d@yahoo.com" },
    date: "Aug 27, 2026",
    items: [{ name: "JBL Flip 6 Speaker", quantity: 2, price: 450 }],
    total: 900,
    currency: "GHS",
    status: "delivered",
    shippingAddress: { street: "7 Ring Road", city: "Kumasi", region: "Ashanti" },
  },
  {
    id: "ND-00126",
    customer: { name: "Yaw Boateng", email: "yaw.b@hotmail.com" },
    date: "Aug 26, 2026",
    items: [{ name: "Sony Headphones WH-1000XM5", quantity: 1, price: 1200 }],
    total: 1200,
    currency: "GHS",
    status: "cancelled",
    shippingAddress: { street: "3 University Road", city: "Cape Coast", region: "Central" },
  },
  {
    id: "ND-00125",
    customer: { name: "Efua Mensah", email: "efua.m@gmail.com" },
    date: "Aug 25, 2026",
    items: [
      { name: "iPhone 15 Case", quantity: 1, price: 80 },
      { name: "USB-C Cable 2m", quantity: 2, price: 35 },
    ],
    total: 150,
    currency: "GHS",
    status: "delivered",
    shippingAddress: { street: "18 Asylum Down", city: "Accra", region: "Greater Accra" },
  },
  {
    id: "ND-00124",
    customer: { name: "Nana Osei", email: "nana.osei@company.com" },
    date: "Aug 24, 2026",
    items: [{ name: "Lenovo ThinkPad E15", quantity: 1, price: 4200 }],
    total: 4200,
    currency: "GHS",
    status: "shipped",
    shippingAddress: { street: "56 Spintex Road", city: "Accra", region: "Greater Accra" },
  },
  {
    id: "ND-00123",
    customer: { name: "Akosua Amoah", email: "akosua.a@gmail.com" },
    date: "Aug 23, 2026",
    items: [{ name: "Sandwich Maker Electric", quantity: 1, price: 220 }],
    total: 220,
    currency: "GHS",
    status: "delivered",
    shippingAddress: { street: "9 Dansoman Highway", city: "Accra", region: "Greater Accra" },
  },
];

// ─── Products (Admin-managed, editable) ───────────────────────────────────────

export const MOCK_PRODUCTS: AdminProduct[] = [
  { id: "p1", slug: "samsung-4k-tv-43", name: "Samsung 4K Smart TV 43\"", category: "Electronics", price: 2800, currency: "GHS", stock: "in_stock", image: "", description: "43-inch 4K UHD Smart TV with built-in Wi-Fi and streaming apps." },
  { id: "p2", slug: "hp-laptop-15-i5", name: "HP Laptop 15 i5", category: "Laptops", price: 3800, salePrice: 3500, currency: "GHS", stock: "low_stock", image: "", description: "15.6-inch laptop with Intel Core i5, 8GB RAM, 512GB SSD." },
  { id: "p3", slug: "jbl-flip-6", name: "JBL Flip 6 Speaker", category: "Electronics", price: 450, currency: "GHS", stock: "in_stock", image: "", description: "Portable waterproof Bluetooth speaker with 12h battery." },
  { id: "p4", slug: "nivea-body-lotion-400ml", name: "Nivea Body Lotion 400ml", category: "Beauty & Personal Care", price: 45, currency: "GHS", stock: "in_stock", image: "", description: "Moisturising body lotion for all skin types." },
  { id: "p5", slug: "sony-wh1000xm5", name: "Sony WH-1000XM5 Headphones", category: "Electronics", price: 1200, salePrice: 1050, currency: "GHS", stock: "in_stock", image: "", description: "Industry-leading noise cancelling wireless headphones." },
  { id: "p6", slug: "lenovo-thinkpad-e15", name: "Lenovo ThinkPad E15", category: "Laptops", price: 4200, currency: "GHS", stock: "out_of_stock", image: "", description: "Business laptop with AMD Ryzen 5, 16GB RAM, 512GB SSD." },
  { id: "p7", slug: "dove-shampoo-250ml", name: "Dove Shampoo 250ml", category: "Beauty & Personal Care", price: 28, currency: "GHS", stock: "in_stock", image: "", description: "Nourishing shampoo for damaged hair." },
  { id: "p8", slug: "chocolate-layer-cake", name: "Chocolate Layer Cake", category: "Bakery", price: 180, currency: "GHS", stock: "in_stock", image: "", description: "Rich three-layer chocolate cake, serves 12." },
];

// ─── Customers ────────────────────────────────────────────────────────────────

export const MOCK_CUSTOMERS: AdminCustomer[] = [
  { id: "c1", name: "Kofi Asante", email: "kofi@example.com", phone: "+233 24 123 4567", joined: "Jan 12, 2026", totalOrders: 5, totalSpent: 8200, currency: "GHS", status: "active" },
  { id: "c2", name: "Ama Owusu", email: "ama.owusu@gmail.com", phone: "+233 20 987 6543", joined: "Feb 3, 2026", totalOrders: 12, totalSpent: 1450, currency: "GHS", status: "active" },
  { id: "c3", name: "Kwame Mensah", email: "kwame@nextdor.online", joined: "Mar 18, 2026", totalOrders: 3, totalSpent: 3800, currency: "GHS", status: "active" },
  { id: "c4", name: "Abena Darko", email: "abena.d@yahoo.com", phone: "+233 26 555 7890", joined: "Apr 5, 2026", totalOrders: 8, totalSpent: 5600, currency: "GHS", status: "active" },
  { id: "c5", name: "Yaw Boateng", email: "yaw.b@hotmail.com", joined: "Apr 22, 2026", totalOrders: 2, totalSpent: 1200, currency: "GHS", status: "inactive" },
  { id: "c6", name: "Efua Mensah", email: "efua.m@gmail.com", phone: "+233 27 333 4444", joined: "May 10, 2026", totalOrders: 7, totalSpent: 920, currency: "GHS", status: "active" },
  { id: "c7", name: "Nana Osei", email: "nana.osei@company.com", joined: "Jun 1, 2026", totalOrders: 4, totalSpent: 9800, currency: "GHS", status: "active" },
  { id: "c8", name: "Akosua Amoah", email: "akosua.a@gmail.com", phone: "+233 24 888 2222", joined: "Jul 14, 2026", totalOrders: 6, totalSpent: 2100, currency: "GHS", status: "active" },
];

// ─── Analytics ────────────────────────────────────────────────────────────────

// 30-day daily revenue (GHS)
export const REVENUE_DATA = [
  820, 1200, 950, 1800, 2200, 1600, 900,
  1400, 1100, 2800, 3200, 2100, 1700, 1300,
  1900, 2400, 2000, 1500, 1800, 3500, 2900,
  2100, 1600, 2200, 2700, 3100, 2400, 1900,
  2800, 4200,
];

// Last 7 days for the dashboard chart
export const WEEKLY_REVENUE = REVENUE_DATA.slice(-7);

export const ORDERS_BY_STATUS = {
  delivered: 4,
  shipped: 2,
  processing: 1,
  cancelled: 1,
};

export const TOP_PRODUCTS = [
  { name: "Lenovo ThinkPad E15", revenue: 4200 },
  { name: "Samsung 4K TV 43\"", revenue: 2800 },
  { name: "HP Laptop 15 i5", revenue: 3500 },
  { name: "Sony WH-1000XM5", revenue: 1050 },
  { name: "JBL Flip 6 Speaker", revenue: 900 },
];

export const SALES_BY_CATEGORY = [
  { name: "Laptops", revenue: 7700 },
  { name: "Electronics", revenue: 5550 },
  { name: "Beauty & Personal Care", revenue: 341 },
  { name: "Bakery", revenue: 220 },
];
