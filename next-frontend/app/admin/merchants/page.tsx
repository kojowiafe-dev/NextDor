"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Percent,
  Phone,
  Mail,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";

interface MerchantItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
  commissionRate: string | number;
  payoutMethod: string;
  momoNumber?: string | null;
  momoNetwork?: string | null;
  createdAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  _count?: {
    products: number;
    vendorOrders: number;
  };
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  ACTIVE: { label: "Active & Live", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  PENDING_APPROVAL: { label: "Pending Approval", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  SUSPENDED: { label: "Suspended", classes: "bg-red-100 text-red-800 border-red-200" },
};

export default function AdminMerchantsPage() {
  const { token, isSuperAdmin } = useAuth();
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Commission Edit Modal State
  const [editingMerchant, setEditingMerchant] = useState<MerchantItem | null>(null);
  const [newCommissionRate, setNewCommissionRate] = useState<string>("10.0");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

  async function loadMerchants() {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vendors/admin/list?status=${statusFilter}&search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.vendors)) {
        setMerchants(json.data.vendors);
      }
    } catch (err) {
      console.error("Failed to load merchants:", err);
      setNotice({ type: "error", message: "Failed to connect to backend server." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMerchants();
  }, [token, statusFilter]);

  async function handleStatusChange(id: string, newStatus: "ACTIVE" | "SUSPENDED" | "PENDING_APPROVAL") {
    if (!token) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/vendors/admin/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotice({
          type: "success",
          message: `Merchant status updated to ${newStatus.replace("_", " ")}.`,
        });
        await loadMerchants();
      } else {
        setNotice({ type: "error", message: json.error?.message || "Status update failed." });
      }
    } catch {
      setNotice({ type: "error", message: "Network error updating merchant." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSaveCommission(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editingMerchant) return;
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setNotice({ type: "error", message: "Please enter a valid percentage between 0 and 100." });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/vendors/admin/${editingMerchant.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commissionRate: rate }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotice({
          type: "success",
          message: `Commission for "${editingMerchant.name}" set to ${rate}%.`,
        });
        setEditingMerchant(null);
        await loadMerchants();
      } else {
        setNotice({ type: "error", message: json.error?.message || "Failed to update commission rate." });
      }
    } catch {
      setNotice({ type: "error", message: "Error updating commission policy." });
    }
  }

  const pendingCount = merchants.filter((m) => m.status === "PENDING_APPROVAL").length;

  return (
    <AdminLayout
      title="Merchant Management"
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadMerchants}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/vendor/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100"
          >
            <Store className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <span>Open Vendor Portal</span>
          </Link>
        </div>
      }
    >
      {/* Toast Notice */}
      {notice && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl p-3.5 text-xs font-medium border shadow-sm ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Metric Bar */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>ACTIVE MERCHANTS</span>
            <Store className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-zinc-900">
            {merchants.filter((m) => m.status === "ACTIVE").length} Stores
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Approved & selling across Ghana</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>PENDING ONBOARDING REVIEW</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900">{pendingCount} Applications</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Awaiting KYC & catalog signoff</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>DEFAULT COMMISSION POLICY</span>
            <Percent className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-zinc-900">10.0% Rake</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Standard marketplace rate</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: "All Merchants" },
            { id: "PENDING_APPROVAL", label: `Pending (${pendingCount})` },
            { id: "ACTIVE", label: "Active & Live" },
            { id: "SUSPENDED", label: "Suspended" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadMerchants()}
            placeholder="Search store, email, MoMo..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
          />
        </div>
      </div>

      {/* Merchants Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Store Name & Slug</th>
                <th className="px-4 py-3">Merchant Owner</th>
                <th className="px-4 py-3">MoMo Settlement</th>
                <th className="px-4 py-3">Catalog & Sales</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#ff9900]" />
                      <span>Loading registered merchants...</span>
                    </div>
                  </td>
                </tr>
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No merchants found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                merchants.map((v) => {
                  const cfg = statusConfig[v.status] || statusConfig.PENDING_APPROVAL;
                  return (
                    <tr key={v.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-zinc-900">{v.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <span>/store/{v.slug}</span>
                          <Link
                            href={`/store/${v.slug}`}
                            target="_blank"
                            className="text-purple-600 hover:text-purple-800"
                            title="Open public storefront"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-zinc-800">{v.owner?.name || "Unassigned"}</div>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Mail className="h-3 w-3 text-zinc-400 shrink-0" />
                          <span>{v.owner?.email || v.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-zinc-900">
                          {v.momoNetwork || "MTN"} {v.momoNumber || "—"}
                        </div>
                        <div className="text-[10px] text-zinc-400">Automated 48h MoMo</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-zinc-900">{v._count?.products ?? 0} Products</div>
                        <div className="text-[10px] text-zinc-400">{v._count?.vendorOrders ?? 0} Orders handled</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
                          <span>{Number(v.commissionRate)}%</span>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMerchant(v);
                                setNewCommissionRate(String(v.commissionRate));
                              }}
                              className="text-zinc-400 hover:text-purple-600"
                              title="Override commission policy"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {v.status === "PENDING_APPROVAL" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(v.id, "ACTIVE")}
                              disabled={actionLoadingId === v.id}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{actionLoadingId === v.id ? "Approving..." : "Approve Store"}</span>
                            </button>
                          )}

                          {v.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(v.id, "SUSPENDED")}
                              disabled={actionLoadingId === v.id}
                              className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                            >
                              <span>Suspend</span>
                            </button>
                          )}

                          {v.status === "SUSPENDED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(v.id, "ACTIVE")}
                              disabled={actionLoadingId === v.id}
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                            >
                              <span>Reactivate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Rate Override Modal */}
      {editingMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-zinc-900">Custom Commission Rate</h3>
              <button
                type="button"
                onClick={() => setEditingMerchant(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCommission} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700">Store Name</label>
                <p className="mt-0.5 text-zinc-500">{editingMerchant.name}</p>
              </div>
              <div>
                <label className="font-semibold text-zinc-700">Commission Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={newCommissionRate}
                  onChange={(e) => setNewCommissionRate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Standard platform rate is 10.0%. NextDor Direct flagship is 0%.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingMerchant(null)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-600 px-3.5 py-1.5 font-semibold text-white hover:bg-purple-700 shadow-sm"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
