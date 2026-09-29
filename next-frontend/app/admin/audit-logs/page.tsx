"use client";

import { useState, useEffect, Fragment } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Globe,
  Filter,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface AuditLogEntry {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

const actionBadgeConfig: Record<string, { label: string; classes: string }> = {
  VENDOR_REGISTERED: { label: "Merchant Registered", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  MERCHANT_APPROVED: { label: "Merchant Approved", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MERCHANT_SUSPENDED: { label: "Merchant Suspended", classes: "bg-red-100 text-red-800 border-red-200" },
  MERCHANT_REACTIVATED: { label: "Merchant Reactivated", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MERCHANT_UPDATED: { label: "Merchant Policy Updated", classes: "bg-purple-100 text-purple-800 border-purple-200" },
  ADMIN_CREATED: { label: "Operations Admin Created", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  ADMIN_DEACTIVATED: { label: "Admin Deactivated", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  ADMIN_REACTIVATED: { label: "Admin Reactivated", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  COMMISSION_UPDATED: { label: "Commission Updated", classes: "bg-purple-100 text-purple-800 border-purple-200" },
};

export default function AdminAuditLogsPage() {
  const { token, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

  useEffect(() => {
    if (!isSuperAdmin) {
      router.replace("/admin");
    }
  }, [isSuperAdmin, router]);

  async function loadLogs() {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/auth/audit-logs?action=${actionFilter}&search=${encodeURIComponent(search)}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.logs)) {
        setLogs(json.data.logs);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadLogs();
    }
  }, [token, isSuperAdmin, actionFilter]);

  function toggleExpand(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id));
  }

  return (
    <AdminLayout
      title="Platform Audit Logs"
      actions={
        <button
          type="button"
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {/* Header Info */}
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Immutable Governance Audit Trail</h2>
              <p className="mt-0.5 text-xs text-zinc-500 max-w-2xl leading-relaxed">
                Chronological record of <strong>who updated what</strong> across the Nextdor platform. Captures merchant approvals, administrative staff creation, policy overrides, and security events with IP addresses and before/after payloads.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 self-start sm:self-center">
            Audit Ledger Active
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {/* Action Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: "All Events" },
            { id: "MERCHANT_APPROVED", label: "Merchant Approvals" },
            { id: "MERCHANT_SUSPENDED", label: "Merchant Suspensions" },
            { id: "ADMIN_CREATED", label: "Admin Creation" },
            { id: "ADMIN_DEACTIVATED", label: "Admin Deactivations" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActionFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                actionFilter === tab.id
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
            onKeyDown={(e) => e.key === "Enter" && loadLogs()}
            placeholder="Search email, action, entity..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / Admin</th>
                <th className="px-4 py-3">Action Performed</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Client IP</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#ff9900]" />
                      <span>Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No audit records recorded yet. Any actions by Super Admin or Operations Admins will appear here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const cfg = actionBadgeConfig[log.action] || {
                    label: log.action.replace(/_/g, " "),
                    classes: "bg-zinc-100 text-zinc-800 border-zinc-200",
                  };
                  const isExpanded = expandedRow === log.id;
                  const dateObj = new Date(log.createdAt);

                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-zinc-50/70 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 text-zinc-400">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-zinc-900">{dateObj.toLocaleDateString()}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{dateObj.toLocaleTimeString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-800 flex items-center gap-1.5">
                            <User className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span>{log.userEmail || "System Engine"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${cfg.classes}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{log.entity}</div>
                          {log.entityId && (
                            <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
                              {log.entityId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-600">
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span>{log.ipAddress || "127.0.0.1"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400 font-medium">
                          {isExpanded ? "Collapse" : "View diff"}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr key={`${log.id}-details`} className="bg-zinc-50/80">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-inner text-xs">
                              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3 text-zinc-500 font-semibold">
                                <span>Event Payload & State Details</span>
                                <span className="font-mono text-[11px] text-zinc-400">ID: {log.id}</span>
                              </div>
                              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-[11px] text-emerald-400 leading-relaxed">
                                {JSON.stringify(log.details || {}, null, 2)}
                              </pre>
                              {log.userAgent && (
                                <div className="mt-2 text-[10px] text-zinc-400 truncate">
                                  <strong>User-Agent:</strong> {log.userAgent}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
