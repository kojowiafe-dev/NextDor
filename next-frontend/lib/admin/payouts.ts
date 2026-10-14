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
  if (!json.success || !json.data) return null;

  const d = json.data;
  // If already in structured quadrant format
  if (d.reconciliation && d.inflow && d.liabilities) {
    return d as FinancialLedgerReport;
  }

  // If summary format, adapt seamlessly
  const s = d.summary || {};
  return {
    asOf: d.asOf || new Date().toISOString(),
    inflow: {
      totalCustomerPaymentsGhs: s.totalGatewayInflow ?? 0,
      totalCustomerPaymentsPesewas: Math.round((s.totalGatewayInflow ?? 0) * 100),
      successfulPaymentsCount: s.totalCustomerTransactions ?? 0,
    },
    liabilities: {
      vendorEscrowPendingGhs: s.activeEscrowLiabilities ?? 0,
      vendorEscrowPendingPesewas: Math.round((s.activeEscrowLiabilities ?? 0) * 100),
      vendorEscrowOrdersCount: s.activeEscrowOrdersCount ?? 0,
      vendorAvailablePayoutGhs: s.unclaimedAvailableBalances ?? 0,
      vendorAvailablePayoutPesewas: Math.round((s.unclaimedAvailableBalances ?? 0) * 100),
      vendorAvailableOrdersCount: s.unclaimedAvailableOrdersCount ?? 0,
      totalMerchantLiabilityGhs:
        (s.disbursedToVendors ?? 0) +
        (s.inFlightDisbursements ?? 0) +
        (s.activeEscrowLiabilities ?? 0) +
        (s.unclaimedAvailableBalances ?? 0),
      totalMerchantLiabilityPesewas: Math.round(
        ((s.disbursedToVendors ?? 0) +
          (s.inFlightDisbursements ?? 0) +
          (s.activeEscrowLiabilities ?? 0) +
          (s.unclaimedAvailableBalances ?? 0)) *
          100
      ),
    },
    equity: {
      earnedPlatformCommissionGhs: s.platformCommissionEarned ?? 0,
      earnedPlatformCommissionPesewas: Math.round((s.platformCommissionEarned ?? 0) * 100),
      potentialPlatformCommissionGhs: 0,
      potentialPlatformCommissionPesewas: 0,
      totalCommissionGhs: s.totalPlatformRevenue ?? 0,
      totalCommissionPesewas: Math.round((s.totalPlatformRevenue ?? 0) * 100),
    },
    disbursements: {
      totalPaidOutGhs: s.disbursedToVendors ?? 0,
      totalPaidOutPesewas: Math.round((s.disbursedToVendors ?? 0) * 100),
      paidOutBatchesCount: s.disbursedTransactionsCount ?? 0,
      refundedGhs: s.customerRefundsSettled ?? 0,
      refundedPesewas: Math.round((s.customerRefundsSettled ?? 0) * 100),
    },
    reconciliation: {
      expectedInflowGhs: s.totalAccounted ?? 0,
      expectedInflowPesewas: Math.round((s.totalAccounted ?? 0) * 100),
      actualInflowGhs: s.totalGatewayInflow ?? 0,
      actualInflowPesewas: Math.round((s.totalGatewayInflow ?? 0) * 100),
      varianceGhs: s.variance ?? 0,
      variancePesewas: Math.round((s.variance ?? 0) * 100),
      isReconciled: s.isBalanced ?? true,
    },
    dailyBreakdown: Array.isArray(d.dailyTrends)
      ? d.dailyTrends.map((t: any) => ({
          date: t.date,
          customerPaymentsGhs: t.inflow ?? 0,
          vendorLiabilitiesGhs: 0,
          earnedCommissionGhs: 0,
          payoutDisbursementsGhs: t.outflow ?? 0,
        }))
      : [],
  };
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
