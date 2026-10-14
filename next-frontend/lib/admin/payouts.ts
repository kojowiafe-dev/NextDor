import { API_BASE } from "@/lib/api-config";

export interface LedgerInflow {
  totalCustomerPaymentsPesewas: number;
  totalCustomerPaymentsGhs: number;
  successfulPaymentsCount: number;
}

export interface LedgerLiabilities {
  vendorEscrowPendingPesewas: number;
  vendorEscrowPendingGhs: number;
  vendorEscrowOrdersCount: number;
  vendorAvailablePayoutPesewas: number;
  vendorAvailablePayoutGhs: number;
  vendorAvailableOrdersCount: number;
  totalMerchantLiabilityPesewas: number;
  totalMerchantLiabilityGhs: number;
}

export interface LedgerEquity {
  earnedPlatformCommissionPesewas: number;
  earnedPlatformCommissionGhs: number;
  potentialPlatformCommissionPesewas: number;
  potentialPlatformCommissionGhs: number;
  totalCommissionPesewas: number;
  totalCommissionGhs: number;
}

export interface LedgerDisbursements {
  totalPaidOutPesewas: number;
  totalPaidOutGhs: number;
  paidOutBatchesCount: number;
  refundedPesewas: number;
  refundedGhs: number;
}

export interface LedgerReconciliation {
  expectedInflowPesewas: number;
  expectedInflowGhs: number;
  actualInflowPesewas: number;
  actualInflowGhs: number;
  variancePesewas: number;
  varianceGhs: number;
  isReconciled: boolean;
}

export interface LedgerDailyBreakdown {
  date: string;
  customerPaymentsGhs: number;
  vendorLiabilitiesGhs: number;
  earnedCommissionGhs: number;
  payoutDisbursementsGhs: number;
}

export interface FinancialLedgerReport {
  asOf: string;
  inflow: LedgerInflow;
  liabilities: LedgerLiabilities;
  equity: LedgerEquity;
  disbursements: LedgerDisbursements;
  reconciliation: LedgerReconciliation;
  dailyBreakdown: LedgerDailyBreakdown[];
}

export interface PayoutBatchItem {
  id: string;
  batchReference: string;
  totalAmount: number | string;
  currency: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  totalVendors: number;
  totalOrders: number;
  paystackTransferCode?: string | null;
  paystackStatus?: string | null;
  failureReason?: string | null;
  executedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  notes?: string | null;
  orders?: any[];
  vendorBreakdown?: {
    vendorId: string;
    vendorName: string;
    momoNetwork: string;
    momoNumber: string;
    recipientCode: string;
    totalEarnings: number;
    ordersCount: number;
  }[];
}

export interface MerchantLeaderboardItem {
  vendorId: string;
  vendorName: string;
  slug: string;
  logoUrl: string | null;
  commissionRate: number;
  kpis: {
    grossMerchandiseValue: number;
    netMerchantEarnings: number;
    totalOrders: number;
    averageOrderValue: number;
    deliveredOrdersCount: number;
    repeatCustomerRatePercent: number;
    returnCount: number;
    returnRatePercent: number;
    avgFulfillmentHours: number;
  };
  topProduct: {
    productId: string;
    name: string;
    slug: string;
    totalQuantitySold: number;
    totalRevenue: number;
  } | null;
}

export interface MerchantLeaderboardResponse {
  asOf: string;
  merchantsCount: number;
  leaderboard: MerchantLeaderboardItem[];
}

export interface VendorAnalyticsResponse {
  timeRange: string;
  kpis: {
    grossMerchandiseValue: number;
    netMerchantEarnings: number;
    totalOrders: number;
    averageOrderValue: number;
    deliveredOrdersCount: number;
    repeatCustomerRatePercent: number;
    returnCount: number;
    returnRatePercent: number;
    avgFulfillmentHours: number;
  };
  topProducts: {
    productId: string;
    name: string;
    slug: string;
    totalQuantitySold: number;
    totalRevenue: number;
  }[];
  statusDistribution: {
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
}

/**
 * Fetch the double-entry accounting ledger & reconciliation balance sheet.
 */
export async function getFinancialLedger(token: string): Promise<FinancialLedgerReport | null> {
  const res = await fetch(`${API_BASE}/admin/reconciliation/ledger`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}

/**
 * Fetch paginated payout batches.
 */
export async function getPayoutBatches(
  token: string,
  page = 1,
  limit = 20
): Promise<{ batches: PayoutBatchItem[]; total: number } | null> {
  const res = await fetch(`${API_BASE}/payouts/batches?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? { batches: json.batches, total: json.total } : null;
}

/**
 * Generate a new payout batch aggregating all cleared vendor escrow balances.
 */
export async function generatePayoutBatch(
  token: string,
  options?: { minPayoutAmount?: number; notes?: string }
): Promise<PayoutBatchItem | null> {
  const res = await fetch(`${API_BASE}/payouts/batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options ?? {}),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to generate payout batch");
  }
  return json.data;
}

/**
 * Execute a pending payout batch via Paystack Transfers API.
 */
export async function executePayoutBatch(
  token: string,
  batchId: string
): Promise<{ message: string; batch: PayoutBatchItem }> {
  const res = await fetch(`${API_BASE}/payouts/batches/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ batchId }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to execute payout batch");
  }
  return json.data;
}

/**
 * Super-Admin merchant performance benchmarking leaderboard.
 */
export async function getMerchantLeaderboard(
  token: string,
  limit = 15
): Promise<MerchantLeaderboardResponse | null> {
  const res = await fetch(`${API_BASE}/admin/analytics/merchants?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}

/**
 * Fetch vendor-specific analytics for merchant dashboard.
 */
export async function getVendorPortalAnalytics(
  token: string,
  timeRange = "30d"
): Promise<VendorAnalyticsResponse | null> {
  const res = await fetch(`${API_BASE}/vendors/portal/analytics?timeRange=${timeRange}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}
