import { API_BASE } from "@/lib/api-config";

export interface Warehouse {
  id: string;
  vendorId?: string | null;
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vendor?: { id: string; name: string; slug: string } | null;
  _count?: { stocks: number; alerts: number };
}

export interface WarehouseStockItem {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  binLocation?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
    city: string;
    region: string;
    isDefault: boolean;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number | string;
    stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER" | "PRE_ORDER";
    allowBackorder: boolean;
    expectedRestockDate?: string | null;
  };
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  type:
    | "RECEIVE"
    | "ORDER_RESERVED"
    | "ORDER_FULFILLED"
    | "ORDER_CANCELLED"
    | "RESTOCK"
    | "RETURN_RESTOCK"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "MANUAL_ADJUSTMENT";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceId?: string | null;
  notes?: string | null;
  performedBy?: string | null;
  createdAt: string;
  warehouse?: { id: string; name: string; code: string };
  product?: { id: string; name: string; slug: string };
}

export interface StockAlert {
  id: string;
  warehouseId: string;
  productId: string;
  vendorId?: string | null;
  alertType: "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER_THRESHOLD";
  threshold: number;
  currentStock: number;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  channel: string;
  notifiedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  warehouse?: { id: string; name: string; code: string; city: string };
  product?: { id: string; name: string; slug: string; price: number | string };
  vendor?: { id: string; name: string; slug: string };
}

export interface ProductStockBreakdown {
  product: {
    id: string;
    name: string;
    slug: string;
    price: string | number;
    stockStatus: string;
    stockQty: number | null;
    allowBackorder: boolean;
    backorderLimit: number | null;
    backorderCount: number;
    expectedRestockDate: string | null;
    isPreOrder: boolean;
    preOrderReleaseDate: string | null;
  };
  totalPhysical: number;
  totalReserved: number;
  availablePhysical: number;
  locations: WarehouseStockItem[];
}

// ─── API Client Methods ──────────────────────────────────────────────────────

export async function fetchWarehouses(token?: string, query?: { city?: string; region?: string; search?: string; isActive?: boolean }): Promise<Warehouse[]> {
  const params = new URLSearchParams();
  if (query?.city) params.set("city", query.city);
  if (query?.region) params.set("region", query.region);
  if (query?.search) params.set("search", query.search);
  if (query?.isActive !== undefined) params.set("isActive", String(query.isActive));

  const url = `${API_BASE}/inventory/warehouses${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch warehouses (${res.status})`);
  }
  const json = await res.json();
  return json.data.warehouses;
}

export async function fetchWarehouseDetails(id: string, token?: string): Promise<{ warehouse: Warehouse; stockSummary: { warehouse: Warehouse; totalItems: number; totalUnits: number; items: WarehouseStockItem[] } }> {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch warehouse details (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function createWarehouse(data: Partial<Warehouse>, token: string): Promise<Warehouse> {
  const res = await fetch(`${API_BASE}/inventory/warehouses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to create warehouse");
  }
  const json = await res.json();
  return json.data.warehouse;
}

export async function updateWarehouse(id: string, data: Partial<Warehouse>, token: string): Promise<Warehouse> {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to update warehouse");
  }
  const json = await res.json();
  return json.data.warehouse;
}

export async function fetchProductStockBreakdown(productId: string, token?: string): Promise<ProductStockBreakdown> {
  const res = await fetch(`${API_BASE}/inventory/products/${productId}/stock`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch product stock breakdown (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function setWarehouseStock(data: {
  warehouseId: string;
  productId: string;
  quantity: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  binLocation?: string;
  reason?: string;
}, token: string): Promise<WarehouseStockItem> {
  const res = await fetch(`${API_BASE}/inventory/stock/set`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to set warehouse stock");
  }
  const json = await res.json();
  return json.data.stock;
}

export async function adjustStock(data: {
  warehouseId: string;
  productId: string;
  delta: number;
  reason: string;
  type?: string;
}, token: string): Promise<WarehouseStockItem> {
  const res = await fetch(`${API_BASE}/inventory/stock/adjust`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to adjust stock");
  }
  const json = await res.json();
  return json.data.stock;
}

export async function transferStock(data: {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  productId: string;
  quantity: number;
  notes?: string;
}, token: string): Promise<{ reference: string; transferredQuantity: number }> {
  const res = await fetch(`${API_BASE}/inventory/stock/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to transfer stock");
  }
  const json = await res.json();
  return json.data;
}

export async function configureBackorders(productId: string, data: {
  allowBackorder: boolean;
  backorderLimit?: number | null;
  expectedRestockDate?: string | null;
  isPreOrder?: boolean;
  preOrderReleaseDate?: string | null;
}, token: string) {
  const res = await fetch(`${API_BASE}/inventory/products/${productId}/backorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to configure backorders");
  }
  const json = await res.json();
  return json.data.product;
}

export async function fetchStockAlerts(token: string, query?: { status?: string; alertType?: string; page?: number; limit?: number }): Promise<{ alerts: StockAlert[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.alertType) params.set("alertType", query.alertType);
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  const res = await fetch(`${API_BASE}/inventory/alerts?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stock alerts (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function resolveStockAlert(alertId: string, notes: string, token: string): Promise<StockAlert> {
  const res = await fetch(`${API_BASE}/inventory/alerts/${alertId}/resolve`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notes }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to resolve alert");
  }
  const json = await res.json();
  return json.data.alert;
}

export async function fetchStockMovements(token: string, query?: { warehouseId?: string; productId?: string; page?: number; limit?: number }): Promise<{ movements: StockMovement[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (query?.warehouseId) params.set("warehouseId", query.warehouseId);
  if (query?.productId) params.set("productId", query.productId);
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  const res = await fetch(`${API_BASE}/inventory/movements?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stock movements (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function triggerStockAuditSweep(token: string): Promise<{ auditedLocationsCount: number; triggeredAlertsCount: number }> {
  const res = await fetch(`${API_BASE}/inventory/webhooks/trigger-audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || "Failed to trigger stock audit");
  }
  const json = await res.json();
  return json.data;
}
