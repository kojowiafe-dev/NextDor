import { API_BASE } from "../api-config";

export type ReturnReason =
  | "DAMAGED_ITEM"
  | "DEFECTIVE_PRODUCT"
  | "WRONG_ITEM_SENT"
  | "NOT_AS_DESCRIBED"
  | "MISSING_PARTS"
  | "OTHER";

export type ReturnStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REFUNDED";

export interface ReturnRequestItem {
  orderItemId: string;
  productId?: string;
  productName?: string;
  quantity: number;
  refundAmount?: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId?: string;
  vendorId?: string;
  reason: ReturnReason;
  details?: string;
  evidenceUrls: string[];
  status: ReturnStatus;
  isDisputed: boolean;
  disputeNotes?: string;
  items: ReturnRequestItem[];
  refundAmount: number;
  adminNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    number: string;
    total: number | string;
    currency: string;
  };
  refunds?: Array<{
    id: string;
    amount: number | string;
    status: string;
    paystackRef?: string;
    processedAt?: string;
  }>;
}

export interface CreateReturnInput {
  reason: ReturnReason;
  details: string;
  evidenceUrls?: string[];
  items: Array<{
    orderItemId: string;
    quantity: number;
  }>;
}

/**
 * Submit a customer return or refund request for a delivered order.
 */
export async function submitReturnRequest(
  orderNumber: string,
  input: CreateReturnInput,
  token: string
): Promise<ReturnRequest> {
  const res = await fetch(`${API_BASE}/returns/orders/${encodeURIComponent(orderNumber)}/returns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to submit return request");
  }
  return json.data;
}

/**
 * Fetch list of return requests for current logged-in customer.
 */
export async function fetchCustomerReturns(
  token: string,
  page = 1,
  limit = 20
): Promise<{ returns: ReturnRequest[]; total: number }> {
  const res = await fetch(`${API_BASE}/returns/my-returns?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch returns history");
  }
  return json.data;
}

/**
 * Escalate a rejected or disputed return to super-admin arbitration.
 */
export async function disputeReturnRequest(
  returnId: string,
  disputeNotes: string,
  token: string
): Promise<ReturnRequest> {
  const res = await fetch(`${API_BASE}/returns/${encodeURIComponent(returnId)}/dispute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ disputeNotes }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to escalate return dispute");
  }
  return json.data;
}

/**
 * Vendor: review and approve or reject a customer return.
 */
export async function reviewVendorReturn(
  returnId: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  token: string
): Promise<ReturnRequest> {
  const res = await fetch(`${API_BASE}/vendors/returns/${encodeURIComponent(returnId)}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ decision, note }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to review return claim");
  }
  return json.data;
}
