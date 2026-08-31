"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MOCK_ORDERS } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

const statusConfig: Record<string, { label: string; classes: string }> = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
};

const STATUSES = ["processing", "shipped", "delivered", "cancelled"] as const;

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const order = MOCK_ORDERS.find((o) => o.id === params.id);
  const [status, setStatus] = useState(order?.status ?? "processing");
  const [saved, setSaved] = useState(false);

  if (!order) {
    return (
      <AdminLayout title="Order Not Found">
        <p className="text-zinc-500">Order {params.id} was not found.</p>
        <Link href="/admin/orders" className="mt-4 inline-flex items-center gap-1 text-sm text-[#007185] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </AdminLayout>
    );
  }

  const cfg = statusConfig[status];

  async function handleSaveStatus() {
    setSaved(false);
    await new Promise((r) => setTimeout(r, 500));
    setSaved(true);
  }

  return (
    <AdminLayout title={`Order ${order.id}`}>
      <div className="mb-4">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="space-y-4 lg:col-span-2">
          {/* Items */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-4 font-semibold text-zinc-900">Items Ordered</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 text-left">Product</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {order.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 font-medium text-zinc-900">{item.name}</td>
                    <td className="py-3 text-center text-zinc-500">{item.quantity}</td>
                    <td className="py-3 text-right text-zinc-500">
                      {formatPrice(item.price, order.currency)}
                    </td>
                    <td className="py-3 text-right font-semibold text-zinc-900">
                      {formatPrice(item.price * item.quantity, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200">
                  <td colSpan={3} className="pt-3 text-right font-semibold text-zinc-700">
                    Total
                  </td>
                  <td className="pt-3 text-right text-lg font-bold text-zinc-900">
                    {formatPrice(order.total, order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Shipping address */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-3 font-semibold text-zinc-900">Shipping Address</h2>
            <p className="text-sm text-zinc-700">{order.customer.name}</p>
            <p className="text-sm text-zinc-500">{order.shippingAddress.street}</p>
            <p className="text-sm text-zinc-500">
              {order.shippingAddress.city}, {order.shippingAddress.region}
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-3 font-semibold text-zinc-900">Customer</h2>
            <p className="text-sm font-medium text-zinc-900">{order.customer.name}</p>
            <p className="text-sm text-zinc-500">{order.customer.email}</p>
            <Link
              href={`/admin/customers`}
              className="mt-2 inline-block text-xs text-[#007185] hover:underline"
            >
              View customer profile →
            </Link>
          </div>

          {/* Status management */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-3 font-semibold text-zinc-900">Order Status</h2>
            <div className="mb-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.classes}`}>
                {cfg.label}
              </span>
            </div>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as typeof status); setSaved(false); }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusConfig[s].label}
                </option>
              ))}
            </select>

            {saved && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" /> Status updated
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveStatus}
              className="mt-3 w-full rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
            >
              Update Status
            </button>
          </div>

          {/* Meta */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-3 font-semibold text-zinc-900">Order Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Order ID</dt>
                <dd className="font-mono font-semibold text-zinc-700">{order.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Date</dt>
                <dd className="text-zinc-700">{order.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Currency</dt>
                <dd className="text-zinc-700">{order.currency}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
