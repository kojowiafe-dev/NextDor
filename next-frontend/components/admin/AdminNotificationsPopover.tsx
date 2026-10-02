"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Store,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api-config";

interface NotificationItem {
  id: string;
  type: "MERCHANT_PENDING" | "AUDIT_EVENT" | "ORDER_STATUS";
  title: string;
  description: string;
  timestamp: string;
  href: string;
  badgeLabel: string;
  badgeColor: string;
  icon: any;
  isUrgent?: boolean;
}

export function AdminNotificationsPopover() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nextdor_admin_last_read_notif");
      return stored ? Number(stored) : 0;
    }
    return 0;
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function loadNotifications() {
    if (!token) return;
    setIsLoading(true);

    try {
      const items: NotificationItem[] = [];

      // 1. Fetch pending merchant reviews (highest operational priority)
      try {
        const vendorAlertsRes = await fetch(`${API_BASE}/vendors/admin/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (vendorAlertsRes.ok) {
          const json = await vendorAlertsRes.json();
          if (json.success && Array.isArray(json.data?.pendingVendors)) {
            for (const v of json.data.pendingVendors) {
              items.push({
                id: `pending-vendor-${v.id}`,
                type: "MERCHANT_PENDING",
                title: "Merchant KYC Review Pending",
                description: `${v.name} applied for store registration and awaits KYC verification.`,
                timestamp: v.createdAt || new Date().toISOString(),
                href: "/admin/merchants",
                badgeLabel: "Action Required",
                badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
                icon: Store,
                isUrgent: true,
              });
            }
          }
        }
      } catch (err) {
        console.warn("Could not load vendor alerts:", err);
      }

      // 2. Fetch recent real platform audit logs from the database
      try {
        const auditRes = await fetch(`${API_BASE}/auth/audit-logs?limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (auditRes.ok) {
          const json = await auditRes.json();
          if (json.success && Array.isArray(json.data?.logs)) {
            for (const log of json.data.logs) {
              let title = "Platform Security Event";
              let description = `Action ${log.action} logged by ${log.userEmail || "System"}.`;
              let icon = ShieldCheck;
              let badgeLabel = "System";
              let badgeColor = "bg-zinc-100 text-zinc-700 border-zinc-200";

              if (log.action === "VENDOR_REGISTERED") {
                title = "New Merchant Registered";
                description = `Store '${log.details?.storeName || log.entityId}' signed up on the platform.`;
                icon = Store;
                badgeLabel = "Merchant";
                badgeColor = "bg-blue-100 text-blue-800 border-blue-200";
              } else if (log.action === "MERCHANT_APPROVED") {
                title = "Merchant Store Approved";
                description = `Store '${log.details?.storeName || "Vendor"}' was approved and is now active.`;
                icon = CheckCircle2;
                badgeLabel = "Approval";
                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
              } else if (log.action === "MERCHANT_SUSPENDED") {
                title = "Merchant Suspended";
                description = `Store '${log.details?.storeName || "Vendor"}' was temporarily suspended.`;
                icon = AlertTriangle;
                badgeLabel = "Suspension";
                badgeColor = "bg-red-100 text-red-800 border-red-200";
              } else if (log.action === "ORDER_DISPATCH_UPDATED") {
                title = "Order Dispatch Transition";
                description = `Order ${log.details?.orderNumber || ""} status updated to ${log.details?.newStatus || "updated"}.`;
                icon = Truck;
                badgeLabel = "Dispatch";
                badgeColor = "bg-purple-100 text-purple-800 border-purple-200";
              }

              items.push({
                id: `audit-${log.id}`,
                type: "AUDIT_EVENT",
                title,
                description,
                timestamp: log.createdAt,
                href: "/admin/audit-logs",
                badgeLabel,
                badgeColor,
                icon,
                isUrgent: false,
              });
            }
          }
        }
      } catch (err) {
        console.warn("Could not load audit log notifications:", err);
      }

      // Sort by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(items);

      // Calculate unread count based on items newer than lastReadTimestamp
      const unread = items.filter((it) => {
        if (it.isUrgent) return true; // Urgent items always count until resolved
        return new Date(it.timestamp).getTime() > lastReadTimestamp;
      }).length;

      setUnreadCount(unread);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [token]);

  function handleMarkAllAsRead() {
    const now = Date.now();
    setLastReadTimestamp(now);
    if (typeof window !== "undefined") {
      localStorage.setItem("nextdor_admin_last_read_notif", String(now));
    }
    // Only urgent items remaining if any
    const urgentCount = notifications.filter((it) => it.isUrgent).length;
    setUnreadCount(urgentCount);
  }

  function formatTimeAgo(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative rounded-lg p-2 transition ${
          isOpen
            ? "bg-zinc-100 text-zinc-900"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        }`}
        aria-label="Notifications"
        title="Admin Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff9900] px-1 text-[10px] font-bold text-zinc-900 shadow-sm animate-in fade-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 bg-zinc-50/70">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-zinc-900">Notifications</h3>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {unreadCount} new
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                  All caught up
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadNotifications()}
                disabled={isLoading}
                title="Refresh notifications"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-400 gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#ff9900]" />
                <span>Checking notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-zinc-800">All caught up!</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  No pending merchant approvals or unhandled alerts right now.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const ItemIcon = item.icon;
                const isNew = item.isUrgent || new Date(item.timestamp).getTime() > lastReadTimestamp;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-start gap-3 p-3.5 transition hover:bg-zinc-50 group ${
                      isNew ? "bg-amber-50/20" : ""
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.isUrgent
                          ? "bg-amber-100 text-amber-700"
                          : "bg-zinc-100 text-zinc-600 group-hover:bg-[#ff9900]/10 group-hover:text-[#ff9900]"
                      }`}
                    >
                      <ItemIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-zinc-900 group-hover:text-[#ff9900] transition-colors truncate">
                          {item.title}
                        </p>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-semibold border ${item.badgeColor}`}
                        >
                          {item.badgeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer Navigation Shortcuts */}
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-xs font-medium text-zinc-600">
            <Link
              href="/admin/merchants"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#ff9900] transition flex items-center gap-1"
            >
              <span>Merchants Queue</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <Link
              href="/admin/audit-logs"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#ff9900] transition flex items-center gap-1"
            >
              <span>Audit Trail</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
