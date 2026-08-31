"use client";

import { DollarSign, ShoppingBag, Package, Users } from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { MOCK_ORDERS, WEEKLY_REVENUE } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

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
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
};

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const recentOrders = MOCK_ORDERS.slice(0, 5);
  const totalRevenue = MOCK_ORDERS.reduce((s, o) => s + o.total, 0);

  return (
    <AdminLayout title="Dashboard">
      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Revenue (MTD)"
          value={formatPrice(totalRevenue, "GHS")}
          trend="12% vs last month"
          trendDirection="up"
          icon={DollarSign}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          title="Orders This Month"
          value={String(MOCK_ORDERS.length)}
          trend="8% vs last month"
          trendDirection="up"
          icon={ShoppingBag}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Total Products"
          value="48"
          trend="3 new this month"
          trendDirection="up"
          icon={Package}
        />
        <StatCard
          title="Total Customers"
          value="186"
          trend="14 new this month"
          trendDirection="up"
          icon={Users}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Revenue — Last 7 Days</h2>
              <p className="text-xs text-zinc-500">Daily sales in GHS</p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              ↑ 12%
            </span>
          </div>
          <RevenueChart data={WEEKLY_REVENUE} />
        </div>

        {/* Recent orders */}
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
            {recentOrders.map((order) => {
              const cfg = statusConfig[order.status];
              return (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {order.customer.name}
                      </p>
                      <p className="text-xs text-zinc-500">{order.id}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-semibold text-zinc-900">
                        {formatPrice(order.total, order.currency)}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
