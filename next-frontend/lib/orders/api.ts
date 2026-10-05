import { API_BASE } from "@/lib/api-config";
import { createSWRCache } from "@/lib/cache/clientCache";

// ─── Cache ────────────────────────────────────────────────────────────────────

export type OrdersPageCache = { orders: Order[]; meta: { total: number; pages: number } };
export const ordersCache = createSWRCache<OrdersPageCache>("nextdor_my_orders", 2 * 60_000);

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
  name?: string;
  price?: number;
  slug?: string;
  image?: string;
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

// ─── Token Helper ─────────────────────────────────────────────────────────────

function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("nextdor-token") ||
      localStorage.getItem("vendor_token") ||
      null
    );
  }
  return null;
}

// ─── API functions ────────────────────────────────────────────────────────────

async function authFetch(
  path: string,
  token?: string | null,
  options: RequestInit = {},
): Promise<Response> {
  const authToken = token || getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${API_BASE}${cleanPath}`, {
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
  const res = await authFetch("/orders", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Checkout failed. Please verify your details.");
  }
  return data.data;
}

/**
 * List the current user's orders (paginated).
 */
export async function fetchMyOrders(
  token?: string | null,
  page = 1,
  limit = 10,
): Promise<{ orders: Order[]; meta: { total: number; pages: number; page: number } }> {
  const res = await authFetch(
    `/orders?page=${page}&limit=${limit}`,
    token,
  );

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Failed to load orders");
  }
  return { orders: data.data, meta: data.meta };
}

/**
 * Get a single order by number, including tracking timeline.
 */
export async function fetchOrderByNumber(
  number: string,
  token?: string | null,
): Promise<Order> {
  const res = await authFetch(`/orders/${number}`, token);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Order not found");
  }
  return data.data;
}

/**
 * Cancel an order.
 */
export async function cancelOrder(
  number: string,
  token?: string | null,
): Promise<void> {
  const res = await authFetch(`/orders/${number}/cancel`, token, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Failed to cancel order");
  }
}

/**
 * Initialize Paystack payment for an order.
 */
export async function initializePayment(
  orderNumber: string,
  options?: { email?: string; callbackUrl?: string; token?: string | null },
): Promise<{
  authorizationUrl: string | null;
  accessCode: string | null;
  reference: string;
  publicKey: string;
}> {
  const res = await authFetch(`/orders/${orderNumber}/initialize-payment`, options?.token, {
    method: "POST",
    body: JSON.stringify({
      email: options?.email,
      callbackUrl: options?.callbackUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Failed to initialize payment gateway");
  }
  return data.data;
}

/**
 * Verify Paystack payment server-side (Item #5).
 */
export async function verifyPayment(
  orderNumber: string,
  reference: string,
  token?: string | null,
): Promise<{ orderNumber: string; status: string; paymentStatus: string; reference?: string }> {
  const res = await authFetch("/orders/verify-payment", token, {
    method: "POST",
    body: JSON.stringify({ orderNumber, reference }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Payment verification failed");
  }
  return data.data;
}

/**
 * Public order tracking for guests or quick lookups (Item #15, #31).
 */
export type PublicOrderTracking = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "REFUNDED";
  deliveryMethod: "STANDARD" | "EXPRESS" | "PICKUP";
  createdAt: string;
  destinationCity: string;
  destinationRegion: string;
  items: Array<{
    productName: string;
    productImage: string | null;
    quantity: number;
  }>;
  statusHistory: StatusHistoryEntry[];
  vendorOrders: Array<{
    id: string;
    vendorName: string;
    vendorSlug: string;
    vendorLogo: string | null;
    status: string;
  }>;
};

export async function fetchPublicOrderTracking(
  orderNumber: string,
): Promise<PublicOrderTracking> {
  const cleanNumber = orderNumber.trim();
  const res = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(cleanNumber)}`, {
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Order tracking details not found");
  }
  return data.data;
}
