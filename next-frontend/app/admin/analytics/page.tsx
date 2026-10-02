"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/utils";
import { createSWRCache } from "@/lib/cache/clientCache";
import { API_BASE } from "@/lib/api-config";

export interface AnalyticsSnapshot {
  revenueData: number[];
  ordersByStatus: {
    delivered: number;
    shipped: number;
    processing: number;
    cancelled: number;
    pending?: number;
    confirmed?: number;
  };
  topProducts: { name: string; revenue: number; quantity?: number }[];
  salesByCategory: { name: string; revenue: number }[];
  conversionRate: string;
}

const DEFAULT_ANALYTICS: AnalyticsSnapshot = {
  revenueData: new Array(30).fill(0),
  ordersByStatus: {
    delivered: 0,
    shipped: 0,
    processing: 0,
    cancelled: 0,
  },
  topProducts: [],
  salesByCategory: [],
  conversionRate: "0.0%",
};

export const adminAnalyticsCache = createSWRCache<AnalyticsSnapshot>("nextdor_admin_analytics", 5 * 60_000);

// ─── 30-day Revenue Line Chart ───────────────────────────────────────────────

function RevenueLineChart({ data }: { data: number[] }) {
  const w = 700;
  const h = 180;
  const pad = { top: 16, right: 16, bottom: 28, left: 52 };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const x = (i: number) =>
    pad.left + (i / Math.max(1, data.length - 1)) * (w - pad.left - pad.right);
  const y = (v: number) =>
    pad.top + (1 - (v - min) / range) * (h - pad.top - pad.bottom);

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area =
    `M ${x(0)} ${y(data[0])} ` +
    data.map((v, i) => `L ${x(i)} ${y(v)}`).join(" ") +
    ` L ${x(data.length - 1)} ${h - pad.bottom} L ${x(0)} ${h - pad.bottom} Z`;

  const gridVals = [min, (min + max) / 2, max];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9900" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ff9900" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridVals.map((v, idx) => (
        <g key={idx}>
          <line x1={pad.left} x2={w - pad.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af" fontFamily="inherit">
            {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#area-grad)" />
      <path d={line} fill="none" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Week markers */}
      {[6, 13, 20, 27].map((i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="inherit">
          Day {i + 1}
        </text>
      ))}
    </svg>
  );
}

// ─── Orders by Status bar chart ───────────────────────────────────────────────

function OrdersBarChart({ data }: { data: AnalyticsSnapshot["ordersByStatus"] }) {
  const entries: [string, number][] = [
    ["delivered", data.delivered || 0],
    ["shipped", data.shipped || 0],
    ["processing", data.processing || 0],
    ["cancelled", data.cancelled || 0],
  ];
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const colors: Record<string, string> = {
    delivered: "#22c55e",
    shipped: "#f59e0b",
    processing: "#3b82f6",
    cancelled: "#ef4444",
  };
  const labels: Record<string, string> = {
    delivered: "Delivered",
    shipped: "Shipped",
    processing: "Processing",
    cancelled: "Cancelled",
  };

  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => (
        <div key={status}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700">{labels[status]}</span>
            <span className="text-zinc-500">{count}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(count / max) * 100}%`, backgroundColor: colors[status] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsSnapshot>(() => {
    return adminAnalyticsCache.get("overview") ?? DEFAULT_ANALYTICS;
  });
  const [isLoading, setIsLoading] = useState(!adminAnalyticsCache.get("overview"));
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadAnalytics(forceRefresh = false) {
    const cacheKey = "overview";
    const { data: cached, isStale, hasData } = adminAnalyticsCache.getEntry(cacheKey);

    if (hasData && !forceRefresh) {
      setData(cached!);
      setIsLoading(false);
      if (!isStale) return;
      setIsRefreshing(true);
    } else if (!hasData) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      if (!token) return;
      const res = await fetch(`${API_BASE}/admin/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const snapshot: AnalyticsSnapshot = {
            revenueData: json.data.revenueData || new Array(30).fill(0),
            ordersByStatus: json.data.ordersByStatus || DEFAULT_ANALYTICS.ordersByStatus,
            topProducts: json.data.topProducts || [],
            salesByCategory: json.data.salesByCategory || [],
            conversionRate: json.data.conversionRate || "0.0%",
          };
          adminAnalyticsCache.set(snapshot, cacheKey);
          setData(snapshot);
        }
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [token]);

  const totalRevenue = data.revenueData.reduce((s, v) => s + v, 0);
  const avgDaily = data.revenueData.length ? totalRevenue / data.revenueData.length : 0;
  const totalOrders = Object.values(data.ordersByStatus).reduce((s, v) => s + (v || 0), 0);

  return (
    <AdminLayout
      title="Analytics"
      actions={
        <button
          type="button"
          onClick={() => {
            adminAnalyticsCache.invalidateAll();
            loadAnalytics(true);
          }}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isRefreshing ? "animate-spin text-[#ff9900]" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {/* Summary KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Revenue (30d)", value: formatPrice(totalRevenue, "GHS") },
          { label: "Avg Daily Revenue", value: formatPrice(avgDaily, "GHS") },
          { label: "Total Orders", value: String(totalOrders) },
          { label: "Conversion Rate", value: data.conversionRate },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Revenue — Last 30 Days</h2>
              <p className="text-xs text-zinc-500">Daily revenue in GHS</p>
            </div>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin text-[#ff9900]" /> Updating...
              </span>
            )}
          </div>
          <RevenueLineChart data={data.revenueData} />
        </div>

        {/* Orders by status */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Orders by Status</h2>
          <OrdersBarChart data={data.ordersByStatus} />
        </div>

        {/* Top products */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Top Products by Revenue</h2>
          {data.topProducts.length > 0 ? (
            <ol className="space-y-3">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-zinc-700">
                    {formatPrice(p.revenue, "GHS")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-xs text-zinc-400">No product sales recorded yet.</p>
          )}
        </div>

        {/* Sales by category */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="mb-4 font-semibold text-zinc-900">Sales by Category</h2>
          {data.salesByCategory.length > 0 ? (
            <div className="space-y-4">
              {data.salesByCategory.map((cat) => {
                const max = Math.max(1, ...data.salesByCategory.map((c) => c.revenue));
                const pct = (cat.revenue / max) * 100;
                return (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900">{cat.name}</span>
                      <span className="text-zinc-500">{formatPrice(cat.revenue, "GHS")}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-[#ff9900]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-zinc-400">No category sales recorded yet.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
