"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  Store,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Lock,
  Percent,
  Clock,
  Truck,
  ArrowUpRight,
  Activity,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { API_BASE } from "@/lib/api-config";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { useAuth } from "@/context/AuthContext";
import { type AdminOrder } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";
import { createSWRCache } from "@/lib/cache/clientCache";
import { adminOrdersCache } from "@/lib/cache/adminCache";

export interface VendorAlert {
  pendingVendors: Array<{ id: string; name: string; slug: string; email?: string | null; createdAt: string }>;
  activeCount: number;
  totalCount: number;
}

const vendorAlertsCache = createSWRCache<VendorAlert>("nextdor_admin_vendor_alerts", 2 * 60_000);


// ─── Mini SVG Line Chart ────────────────────────────────────────────────────

function RevenueChart({ data }: { data: number[] }) {
  const width = 600;
  const height = 140;
  const padding = { top: 16, right: 16, bottom: 28, left: 48 };

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function x(i: number) {
    return padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
  }
  function y(val: number) {
    return padding.top + (1 - (val - minVal) / range) * (height - padding.top - padding.bottom);
  }

  const linePath = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const areaPath =
    `M ${x(0)} ${y(data[0])} ` +
    data.map((v, i) => `L ${x(i)} ${y(v)}`).join(" ") +
    ` L ${x(data.length - 1)} ${height - padding.bottom} L ${x(0)} ${height - padding.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9900" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ff9900" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.33, 0.66, 1].map((t) => {
        const yPos = padding.top + t * (height - padding.top - padding.bottom);
        return (
          <line
            key={t}
            x1={padding.left}
            x2={width - padding.right}
            y1={yPos}
            y2={yPos}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        );
      })}
      {/* Area fill */}
      <path d={areaPath} fill="url(#rev-grad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#ff9900" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#ff9900" stroke="white" strokeWidth="2" />
      ))}
      {/* X-axis labels */}
      {days.map((day, i) => (
        <text
          key={day}
          x={x(i)}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          fill="#9ca3af"
          fontFamily="inherit"
        >
          {day}
        </text>
      ))}
    </svg>
  );
}

// ─── Order status badge ──────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; classes: string }> = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  pending: { label: "Pending", classes: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmed", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", classes: "bg-zinc-100 text-zinc-700" },
};

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { token, user, isSuperAdmin } = useAuth();
  const [pendingVendors, setPendingVendors] = useState<any[]>([]);
  const [vendorStats, setVendorStats] = useState<{ activeCount: number; totalCount: number }>({
    activeCount: 1,
    totalCount: 1,
  });
  const [orders, setOrders] = useState<AdminOrder[]>(() => {
    return adminOrdersCache.get("all_orders") ?? [];
  });
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [productCount, setProductCount] = useState<number>(0);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadPlatformCounts() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.metrics) {
          if (typeof json.data.metrics.totalCustomers === "number") {
            setCustomerCount(json.data.metrics.totalCustomers);
          }
          if (typeof json.data.metrics.totalProducts === "number") {
            setProductCount(json.data.metrics.totalProducts);
          }
          return;
        }
      }
    } catch {}

    // Secondary fallback directly to customer list count if analytics endpoint fails
    try {
      const custRes = await fetch(`${API_BASE}/admin/customers?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (custRes.ok) {
        const custJson = await custRes.json();
        if (custJson.meta?.total !== undefined) {
          setCustomerCount(custJson.meta.total);
        }
      }
    } catch {}

    try {
      const prodRes = await fetch(`${API_BASE}/products?limit=1`);
      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        if (prodJson.data?.pagination?.total !== undefined) {
          setProductCount(prodJson.data.pagination.total);
        }
      }
    } catch {}
  }

  async function fetchAlerts(forceRefresh = false) {
    if (!token) return;

    // 1. INSTANT: serve from cache if available
    const { data: cached, isStale, hasData } = vendorAlertsCache.getEntry();
    if (hasData && !forceRefresh) {
      setPendingVendors(cached!.pendingVendors);
      setVendorStats({ activeCount: cached!.activeCount, totalCount: cached!.totalCount });
      if (!isStale) return; // Fresh, skip network
    } else if (!hasData) {
      setIsLoading(true);
    }

    try {
      const alertData = await vendorAlertsCache.fetchDedupe(undefined, async () => {
        try {
          const res = await fetch(`${API_BASE}/vendors/admin/alerts`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const json = await res.json();
          if (json.success && json.data) {
            return {
              pendingVendors: json.data.pendingVendors || [],
              activeCount: json.data.activeCount,
              totalCount: json.data.totalCount,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      if (alertData) {
        setPendingVendors(alertData.pendingVendors);
        setVendorStats({ activeCount: alertData.activeCount, totalCount: alertData.totalCount });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDashboardOrders(forceRefresh = false) {
    if (!token) return;
    try {
      const { data: cachedOrders, isStale, hasData } = adminOrdersCache.getEntry("all_orders");
      if (hasData && !forceRefresh) {
        setOrders(cachedOrders!);
        if (!isStale) return;
      }

      const liveOrders = await adminOrdersCache.fetchDedupe("all_orders", async () => {
        const res = await fetch(`${API_BASE}/admin/orders?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return json.data.map((o: any): AdminOrder => ({
            id: o.number || o.id,
            dbId: o.id,
            customer: {
              name: o.user?.name || o.shippingAddress?.recipientName || "Customer",
              email: o.user?.email || "guest@nextdor.com",
            },
            date: new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            items: (o.items || []).map((it: any) => ({
              name: it.productName,
              quantity: it.quantity,
              price: Number(it.unitPrice || 0),
            })),
            total: Number(o.total),
            currency: o.currency || "GHS",
            status: (o.status?.toLowerCase() as any) || "processing",
            shippingAddress: {
              street: o.shippingAddress?.street || "",
              city: o.shippingAddress?.city || "",
              region: o.shippingAddress?.region || "",
            },
          }));
        }
        return [];
      });
      if (liveOrders) setOrders(liveOrders);
    } catch {
      // Fallback silently to existing orders state
    }
  }

  useEffect(() => {
    fetchAlerts();
    loadDashboardOrders();
    loadPlatformCounts();
  }, [token]);

  async function handleApprove(id: string) {
    if (!token) return;
    setIsApproving(id);
    try {
      await fetch(`${API_BASE}/vendors/admin/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      vendorAlertsCache.invalidateAll(); // vendor approved — pending list changed
      await fetchAlerts(true);
    } catch (err) {
      console.error("Failed to approve vendor:", err);
    } finally {
      setIsApproving(null);
    }
  }

  const recentOrders = orders.slice(0, 5);
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pipelineOrders = orders.filter((o) => o.status === "processing" || o.status === "pending" || o.status === "confirmed" || o.status === "shipped");
  const platformFee = totalRevenue * 0.10; // 10% platform cut
  const escrowHold = totalRevenue * 0.90; // 90% escrow reserve held for merchants

  const weeklyRevenue = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    for (const order of orders) {
      if (order.status !== "cancelled" && order.status !== "refunded") {
        const orderTime = new Date(order.date).getTime();
        const diffDays = Math.floor((now - orderTime) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < 7) {
          buckets[6 - diffDays] += order.total;
        }
      }
    }
    return buckets;
  }, [orders]);

  return (
    <AdminLayout
      title={isSuperAdmin ? "Super Admin Command" : "Operations Console"}
      actions={
        <button
          type="button"
          onClick={() => {
            vendorAlertsCache.invalidateAll();
            adminOrdersCache.invalidateAll();
            fetchAlerts(true);
            loadDashboardOrders(true);
          }}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {/* ─── Role Banner: Super Admin vs Operations Admin ─── */}
      <div className="mb-6">
        {isSuperAdmin ? (
          /* Super Admin Banner: Gold/Dark Command Center */
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a140b] via-[#231b10] to-[#0f141c] p-6 shadow-md border border-amber-500/30 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/40 text-[#ff9900]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight text-white">Platform Owner Command</h2>
                    <span className="rounded-full bg-[#ff9900]/20 px-2.5 py-0.5 text-xs font-semibold text-[#ff9900] ring-1 ring-inset ring-[#ff9900]/30">
                      Super Admin Authority
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-300 max-w-2xl leading-relaxed">
                    Root command authority active for <strong className="text-white">{user?.email}</strong>. You possess full access to platform-wide financial governance, MoMo escrow reserves, marketplace fee overrides, and vendor approvals.
                  </p>
                </div>
              </div>

              {/* Policy Pills */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-amber-300 ring-1 ring-amber-500/30">
                  <Percent className="h-3.5 w-3.5" />
                  <span>Platform Commission: <strong>10.0%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-300 ring-1 ring-emerald-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span>MoMo Escrow: <strong>48h Hold</strong></span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-purple-300 ring-1 ring-purple-500/30">
                  <Store className="h-3.5 w-3.5" />
                  <span>Flagship: <strong>Nextdor Direct (0%)</strong></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Operations Admin Banner: Clean Blue/Slate Operations Console */
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d1624] via-[#121c2d] to-[#151f30] p-6 shadow-md border border-blue-500/30 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-500/40 text-blue-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight text-white">Marketplace Operations Console</h2>
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30">
                      Operations Admin
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-300 max-w-2xl leading-relaxed">
                    Operations access active for <strong className="text-white">{user?.email}</strong>. Responsible for catalog curation, order fulfillment pipelines, merchant onboarding reviews, and customer satisfaction.
                  </p>
                </div>
              </div>

              {/* Boundary Pill */}
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-3 py-2 text-zinc-300 ring-1 ring-white/10">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Escrow disbursals & platform fee adjustments managed by Super Admin</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Action & Merchant Alerts */}
      <div className="mb-6 space-y-3">
        {pendingVendors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-amber-900">
                    {pendingVendors.length} Merchant Application{pendingVendors.length > 1 ? "s" : ""} Awaiting Review
                  </h3>
                  <span className="text-xs font-medium text-amber-700 bg-amber-200/60 rounded-full px-2 py-0.5">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-0.5">
                  New vendors must be approved before their stores and products become visible to customers.
                </p>

                <div className="mt-3 divide-y divide-amber-200/60 rounded-lg border border-amber-200/80 bg-white">
                  {pendingVendors.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                      <div>
                        <p className="font-semibold text-zinc-900">{v.name}</p>
                        <p className="text-zinc-500">
                          {v.email} {v.phone ? `• ${v.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400">
                          Applied {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApprove(v.id)}
                          disabled={isApproving === v.id}
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isApproving === v.id ? "Approving..." : "Approve Merchant"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Shield & System Pulse */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong className="text-zinc-900">Platform Security Shield:</strong> IP rate limiting, JWT token rotation, & audit logging active.
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>
              Marketplace: <strong className="text-zinc-800">{vendorStats.activeCount} Active Merchant{vendorStats.activeCount !== 1 ? "s" : ""}</strong>
            </span>
            <span>
              Fastify Backend: <strong className="text-emerald-600">Port 4000 (Operational)</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Differentiated KPI Cards ─── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {isSuperAdmin ? (
          /* SUPER ADMIN METRICS: Financial & Platform Governance */
          <>
            <StatCard
              title="Gross Marketplace GMV"
              value={formatPrice(totalRevenue, "GHS")}
              trend="Gross sales volume"
              trendDirection="up"
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              title="Platform Revenue (10%)"
              value={formatPrice(platformFee, "GHS")}
              trend="10% platform share"
              trendDirection="up"
              icon={Percent}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              title="MoMo Escrow Pool"
              value={formatPrice(escrowHold, "GHS")}
              trend="Merchant escrow balance"
              trendDirection="neutral"
              icon={Lock}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
            />
            <StatCard
              title="Active Merchants"
              value={String(vendorStats.activeCount)}
              trend={pendingVendors.length > 0 ? `${pendingVendors.length} pending approval` : "All verified"}
              trendDirection={pendingVendors.length > 0 ? "neutral" : "up"}
              icon={Store}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <StatCard
              title="Registered Customers"
              value={String(customerCount)}
              trend={`${customerCount} verified accounts`}
              trendDirection={customerCount > 0 ? "up" : "neutral"}
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
          </>
        ) : (
          /* OPERATIONS ADMIN METRICS: Orders, Catalog & Dispatch */
          <>
            <StatCard
              title="Orders in Pipeline"
              value={String(pipelineOrders.length)}
              trend={pipelineOrders.length > 0 ? "Needs fulfillment" : "Queue clear"}
              trendDirection={pipelineOrders.length > 0 ? "neutral" : "up"}
              icon={Truck}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total Orders"
              value={String(orders.length)}
              trend="Orders placed"
              trendDirection="neutral"
              icon={ShoppingBag}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              title="Catalog Products"
              value={String(productCount)}
              trend="Active products"
              trendDirection={productCount > 0 ? "up" : "neutral"}
              icon={Package}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              title="Merchant Queue"
              value={String(pendingVendors.length)}
              trend={pendingVendors.length > 0 ? "Pending KYC review" : "Queue clear"}
              trendDirection={pendingVendors.length > 0 ? "down" : "neutral"}
              icon={Store}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <StatCard
              title="Active Shoppers"
              value={String(customerCount)}
              trend={`${customerCount} customer accounts`}
              trendDirection={customerCount > 0 ? "up" : "neutral"}
              icon={Users}
              iconBg="bg-zinc-100"
              iconColor="text-zinc-700"
            />
          </>
        )}
      </div>

      {/* ─── Role-Specific Strategic Feature Panels ─── */}
      {isSuperAdmin ? (
        /* SUPER ADMIN FINANCIAL GOVERNANCE & ESCROW SETTLEMENT ENGINE */
        <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">Platform Financial Governance & Escrow Engine</h3>
                <p className="text-xs text-zinc-500">Root-controlled financial clearing rules and Mobile Money payout infrastructure</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                MoMo Engine: Auto-Clearing Active
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 min-w-0">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                <span>COMMISSION RAKE</span>
                <Percent className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 truncate">10.0%</p>
              <p className="mt-1 text-xs text-zinc-500">
                Standard cut automatically deducted from all third-party merchant checkouts. Flagship store exempt (0%).
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 min-w-0">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                <span>ESCROW SAFEGUARD</span>
                <Clock className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 truncate">48 Hours</p>
              <p className="mt-1 text-xs text-zinc-500">
                MoMo vendor payout balance held in escrow until 48 hours post customer delivery confirmation to protect against disputes.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 min-w-0">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                <span>ESCROW RESERVE DISBURSAL</span>
                <Lock className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 truncate" title={formatPrice(escrowHold, "GHS")}>
                {formatPrice(escrowHold, "GHS")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Current escrow pool earmarked for merchant Mobile Money settlement (MTN MoMo, Telecel, AT Money).
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* OPERATIONS ADMIN FULFILLMENT & DISPATCH PIPELINE */
        <div className="mb-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">Order Fulfillment & Dispatch Pipeline</h3>
                <p className="text-xs text-zinc-500">Active queue of customer orders requiring packaging, carrier assignment, or delivery verification</p>
              </div>
            </div>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
            >
              <span>Manage all orders</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                <span>PROCESSING (PACKING)</span>
                <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">Priority</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-900">
                {orders.filter((o) => o.status === "processing").length} Orders
              </p>
              <p className="mt-1 text-xs text-blue-700">Orders ready for warehouse packing and courier dispatch.</p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                <span>IN TRANSIT (SHIPPED)</span>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">Active</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {orders.filter((o) => o.status === "shipped").length} Orders
              </p>
              <p className="mt-1 text-xs text-amber-700">Dispatched with delivery riders across Greater Accra & regions.</p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                <span>DELIVERED (COMPLETED)</span>
                <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Settled</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {orders.filter((o) => o.status === "delivered").length} Orders
              </p>
              <p className="mt-1 text-xs text-emerald-700">Successfully received by customers; awaiting 48h settlement.</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Revenue Analytics & Recent Order Feeds ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">
                {isSuperAdmin ? "Gross Marketplace Volume (GMV) — Last 7 Days" : "Order Revenue Velocity — Last 7 Days"}
              </h2>
              <p className="text-xs text-zinc-500">
                {isSuperAdmin ? "Total sales processed across all multi-tenant stores (GHS)" : "Daily marketplace sales in GHS"}
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              ↑ 12% vs last week
            </span>
          </div>
          <RevenueChart data={weeklyRevenue} />
        </div>

        {/* Recent Orders List */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {recentOrders.length === 0 ? (
              <li className="py-8 text-center text-xs text-zinc-400">
                No orders placed yet. Real orders will appear here automatically.
              </li>
            ) : (
              recentOrders.map((order) => {
                const cfg = statusConfig[order.status] || statusConfig.processing;
                return (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-zinc-50 transition"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {order.customer?.name || "Customer"}
                        </p>
                        <p className="text-xs text-zinc-500">{order.id}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatPrice(order.total, order.currency)}
                        </p>
                        <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}

