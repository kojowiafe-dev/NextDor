/**
 * Orders API client — typed fetch wrappers for the order endpoints.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderItem = {
  productId: string;
  productName: string;
  productImage: string | null;
  unitPrice: string;
  quantity: number;
  subtotal: string;
  product?: { slug: string };
};

export type StatusHistoryEntry = {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type VendorOrder = {
  id: string;
  vendorId: string;
  subtotal: string;
  vendorEarnings: string;
  commissionAmount: string;
  status: string;
  vendor: { name: string; slug: string; logoUrl: string | null };
};

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "REFUNDED";
  deliveryMethod: "STANDARD" | "EXPRESS" | "PICKUP";
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  currency: string;
  notes: string | null;
  shippingAddress: {
    street: string;
    city: string;
    region: string;
    label?: string;
    recipientName?: string;
    recipientPhone?: string;
  };
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  statusHistory?: StatusHistoryEntry[];
  vendorOrders?: VendorOrder[];
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CheckoutPayload = {
  guestEmail?: string;
  cart: CartItem[];
  shippingAddress: {
    street: string;
    city: string;
    region: string;
    label?: string;
    recipientName?: string;
    recipientPhone?: string;
  };
  deliveryMethod?: "STANDARD" | "EXPRESS" | "PICKUP";
  notes?: string;
};

// ─── API functions ────────────────────────────────────────────────────────────

async function authFetch(
  path: string,
  token?: string | null,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Place a new order (checkout - supports authenticated or guest checkout).
 */
export async function placeOrder(
  payload: CheckoutPayload,
  token?: string | null,
): Promise<{ orderId: string; orderNumber: string; total: string; status: string }> {
  const res = await authFetch("/api/v1/orders", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Checkout failed");
  return data.data;
}

/**
 * List the current user's orders (paginated).
 */
export async function fetchMyOrders(
  token: string,
  page = 1,
  limit = 10,
): Promise<{ orders: Order[]; meta: { total: number; pages: number; page: number } }> {
  const res = await authFetch(
    `/api/v1/orders?page=${page}&limit=${limit}`,
    token,
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load orders");
  return { orders: data.data, meta: data.meta };
}

/**
 * Get a single order by number, including tracking timeline.
 */
export async function fetchOrderByNumber(
  number: string,
  token: string,
): Promise<Order> {
  const res = await authFetch(`/api/v1/orders/${number}`, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Order not found");
  return data.data;
}

/**
 * Cancel an order.
 */
export async function cancelOrder(
  number: string,
  token: string,
): Promise<void> {
  const res = await authFetch(`/api/v1/orders/${number}/cancel`, token, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to cancel order");
}
