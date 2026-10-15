"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Truck, Plus, ExternalLink, Phone, AlertCircle, X } from "lucide-react";
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

const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

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

  // Shipments & Courier Dispatch State (Priority 4 / Loophole 4)
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [carrier, setCarrier] = useState<string>("INTERNAL_COURIER");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [courierName, setCourierName] = useState<string>("");
  const [courierPhone, setCourierPhone] = useState<string>("");
  const [dispatchNotes, setDispatchNotes] = useState<string>("");
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  async function loadShipments(dbId: string) {
    if (!token || !dbId) return;
    setIsLoadingShipments(true);
    try {
      const res = await fetch(`${API_BASE}/logistics/orders/${dbId}/shipments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setShipments(json.data);
        }
      }
    } catch (err) {
      console.warn("Failed to load order shipments:", err);
    } finally {
      setIsLoadingShipments(false);
    }
  }

  function handleGenerateTracking() {
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setTrackingNumber(`ND-${randomHex}-${randomNum}`);
  }

  async function handleDispatchShipment(e: React.FormEvent) {
    e.preventDefault();
    if (!order?.dbId || !token) return;
    if (!trackingNumber.trim()) {
      setDispatchError("Tracking number is required");
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);
    setDispatchSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/logistics/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.dbId,
          carrier: carrier.toUpperCase(),
          trackingNumber: trackingNumber.trim(),
          courierName: courierName.trim() || undefined,
          courierPhone: courierPhone.trim() || undefined,
          dispatchNotes: dispatchNotes.trim() || undefined,
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "Failed to dispatch shipment");
      }

      setDispatchSuccess(`Shipment dispatched successfully via ${carrier.toUpperCase()} (Tracking: ${trackingNumber.trim()})`);
      setStatus("shipped");
      setTrackingNumber("");
      setCourierName("");
      setCourierPhone("");
      setDispatchNotes("");
      setEstimatedDelivery("");
      setShowDispatchForm(false);
      adminOrdersCache.invalidateAll();
      await loadShipments(order.dbId);
    } catch (err: any) {
      setDispatchError(err?.message || "Courier dispatch failed. Please try again.");
    } finally {
      setIsDispatching(false);
    }
  }

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      if (order.dbId) loadShipments(order.dbId);
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
            if (mappedOrder.dbId) loadShipments(mappedOrder.dbId);
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

          {/* Courier Dispatch & Shipment Tracking Management (Priority 4 / Loophole 4 Fix) */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[#ff9900]">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900">Courier Dispatch & Tracking</h2>
                  <p className="text-xs text-zinc-500">Assign courier partners and monitor parcel milestones</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDispatchForm(!showDispatchForm);
                  if (!trackingNumber) handleGenerateTracking();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
              >
                {showDispatchForm ? (
                  <>
                    <X className="h-3.5 w-3.5" /> Close Form
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Dispatch Package
                  </>
                )}
              </button>
            </div>

            {/* Success / Error Alerts */}
            {dispatchSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{dispatchSuccess}</span>
              </div>
            )}
            {dispatchError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800 ring-1 ring-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{dispatchError}</span>
              </div>
            )}

            {/* Active Shipments List */}
            {isLoadingShipments ? (
              <div className="flex items-center justify-center py-6 text-xs text-zinc-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#ff9900]" />
                Loading courier records...
              </div>
            ) : shipments.length > 0 ? (
              <div className="space-y-3">
                {shipments.map((s) => (
                  <div key={s.id} className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          {s.carrier}
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-900">
                          {s.trackingNumber}
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase">
                        {s.status}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                      {s.courierName && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400">Driver:</span>
                          <span className="font-medium text-zinc-800">{s.courierName}</span>
                          {s.courierPhone && (
                            <a href={`tel:${s.courierPhone}`} className="text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {s.courierPhone}
                            </a>
                          )}
                        </div>
                      )}
                      {s.estimatedDelivery && (
                        <div>
                          <span className="text-zinc-400">Est. Delivery:</span>{" "}
                          <span className="font-medium text-zinc-800">
                            {new Date(s.estimatedDelivery).toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      )}
                    </div>

                    {s.dispatchNotes && (
                      <p className="mt-1.5 text-[11px] text-zinc-500 italic">
                        Notes: {s.dispatchNotes}
                      </p>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">
                        Dispatched {new Date(s.createdAt).toLocaleString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Link
                        href={`/track?order=${order.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#007185] hover:underline"
                      >
                        Public Tracking Page <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !showDispatchForm && (
                <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500">
                  <p>No courier package has been dispatched for this order yet.</p>
                  <p className="mt-1 text-zinc-400">Click &ldquo;Dispatch Package&rdquo; above to assign a carrier and tracking number.</p>
                </div>
              )
            )}

            {/* Dispatch Form Inline Box */}
            {showDispatchForm && (
              <form onSubmit={handleDispatchShipment} className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 ring-1 ring-amber-200/60">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-800">New Courier Dispatch</h3>
                
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Logistics Carrier</label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    >
                      <option value="INTERNAL_COURIER">NextDor Dedicated Driver (Internal)</option>
                      <option value="FEZ">Fez Delivery Ghana</option>
                      <option value="KWIK">Kwik Delivery</option>
                      <option value="DHL">DHL Express Ghana</option>
                      <option value="OTHER">Other Local Courier</option>
                    </select>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-700">Tracking Number *</label>
                      <button
                        type="button"
                        onClick={handleGenerateTracking}
                        className="text-[10px] text-[#007185] underline hover:text-zinc-900"
                      >
                        Generate Random
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. ND-AB12-9901"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Courier Driver Name</label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. Kwesi Mensah"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Courier Phone</label>
                    <input
                      type="tel"
                      value={courierPhone}
                      onChange={(e) => setCourierPhone(e.target.value)}
                      placeholder="e.g. +233 24 123 4567"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Est. Delivery Date</label>
                    <input
                      type="date"
                      value={estimatedDelivery}
                      onChange={(e) => setEstimatedDelivery(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Dispatch Notes</label>
                    <input
                      type="text"
                      value={dispatchNotes}
                      onChange={(e) => setDispatchNotes(e.target.value)}
                      placeholder="e.g. Fragile items, deliver before 5pm"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#ff9900]"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDispatchForm(false)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDispatching}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-4 py-1.5 text-xs font-bold text-zinc-900 hover:bg-[#f08804] disabled:opacity-60 transition"
                  >
                    {isDispatching && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Confirm & Dispatch</span>
                  </button>
                </div>
              </form>
            )}
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
