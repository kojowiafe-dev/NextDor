"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { type AdminOrder } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";
import { adminOrdersCache } from "@/lib/cache/adminCache";
import { API_BASE } from "@/lib/api-config";

const statusConfig: Record<string, { label: string; classes: string }> = {
  delivered: { label: "Delivered", classes: "bg-green-100 text-green-700" },
  processing: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
  pending: { label: "Pending", classes: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmed", classes: "bg-blue-100 text-blue-700" },
  shipped: { label: "Shipped", classes: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", classes: "bg-zinc-100 text-zinc-700" },
};

const STATUSES = ["processing", "shipped", "delivered", "cancelled"] as const;

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<AdminOrder | null>(() => {
    const cached = adminOrdersCache.get("all_orders");
    return cached?.find((o) => o.id === params.id || o.dbId === params.id) ?? null;
  });
  const [status, setStatus] = useState<string>(order?.status ?? "processing");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(!order);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      return;
    }

    async function fetchOrderDetail() {
      if (!params.id) return;
      setIsLoading(true);
      try {
        if (!token) {
          setOrder(null);
          return;
        }

        const res = await fetch(`${API_BASE}/admin/orders/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const o = json.data;
            const mappedOrder: AdminOrder = {
              id: o.number || o.id,
              dbId: o.id,
              customer: {
                name: o.user?.name || o.shippingAddress?.recipientName || "Customer",
                email: o.user?.email || "guest@nextdor.com",
              },
              date: new Date(o.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
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
            };
            setOrder(mappedOrder);
            setStatus(mappedOrder.status);
            return;
          }
        }

        setOrder(null);
      } catch {
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrderDetail();
  }, [params.id, token]);

  if (isLoading) {
    return (
      <AdminLayout title="Order Details">
        <div className="flex h-48 items-center justify-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#ff9900]" />
          <span>Loading order details...</span>
        </div>
      </AdminLayout>
    );
  }

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

  const cfg = statusConfig[status] || statusConfig.processing;

  async function handleSaveStatus() {
    setIsSaving(true);
    setSaved(false);
    try {
      if (token && order?.dbId) {
        await fetch(`${API_BASE}/admin/orders/${order.dbId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: status.toUpperCase(),
            note: `Status updated by Admin to ${status.toUpperCase()}`,
          }),
        });
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setSaved(true);
      adminOrdersCache.invalidateAll();
    } finally {
      setIsSaving(false);
    }
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
            <p className="text-sm font-medium text-zinc-700">{order.customer.name}</p>
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
              href="/admin/customers"
              className="mt-2 inline-block text-xs text-[#007185] hover:underline"
            >
              View customer profile →
            </Link>
          </div>

          {/* Status management */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="mb-3 font-semibold text-zinc-900">Order Status</h2>
            <div className="mb-3">
              <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.classes}`}>
                {cfg.label}
              </span>
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusConfig[s]?.label ?? s}
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
              disabled={isSaving}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#f08804] disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Update Status</span>
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
