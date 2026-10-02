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
  Trash2,
  X,
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

  // Read and dismissed state persisted across sessions
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nextdor_admin_last_read_notif");
      return stored ? Number(stored) : 0;
    }
    return 0;
  });

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("nextdor_admin_read_ids");
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("nextdor_admin_dismissed_ids");
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
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

      // 2. Fetch security audit logs for administrative events
      try {
        const auditRes = await fetch(`${API_BASE}/auth/audit-logs?limit=15`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (auditRes.ok) {
          const json = await auditRes.json();
          if (json.success && Array.isArray(json.data?.logs)) {
            for (const log of json.data.logs) {
              // Convert audit actions into notifications
              let title = "Platform Event";
              let description = log.action;
              let icon = ShieldCheck;
              let badgeLabel = "Security";
              let badgeColor = "bg-blue-100 text-blue-800 border-blue-200";

              if (log.action === "AUTH_LOGIN_SUCCESS") {
                title = "Administrator Sign-In";
                description = `Staff member signed in from IP ${log.ip || "unknown"}.`;
                icon = ShieldCheck;
                badgeLabel = "Login";
                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
              } else if (log.action === "AUTH_PASSWORD_FAILED") {
                title = "Failed Login Warning";
                description = `Suspicious authentication attempt recorded from ${log.ip || "unknown"}.`;
                icon = AlertTriangle;
                badgeLabel = "Warning";
                badgeColor = "bg-rose-100 text-rose-800 border-rose-200";
              } else if (log.action === "VENDOR_STATUS_CHANGE") {
                title = "Vendor Status Modified";
                description = `Merchant ${log.details?.vendorName || ""} updated to ${log.details?.newStatus || "updated"}.`;
                icon = Store;
                badgeLabel = "Merchant";
                badgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
              } else if (log.action === "ORDER_STATUS_UPDATE") {
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

      // Filter out dismissed items
      const activeItems = items.filter((it) => !dismissedIds.has(it.id));
      setNotifications(activeItems);

      // Calculate unread count (items not marked read and newer than lastReadTimestamp)
      const unread = activeItems.filter((it) => {
        if (readIds.has(it.id)) return false;
        if (it.isUrgent) return true;
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

  // Mark all notifications as read
  function handleMarkAllAsRead() {
    const now = Date.now();
    setLastReadTimestamp(now);

    const updatedReadIds = new Set(readIds);
    notifications.forEach((item) => updatedReadIds.add(item.id));
    setReadIds(updatedReadIds);

    if (typeof window !== "undefined") {
      localStorage.setItem("nextdor_admin_last_read_notif", String(now));
      localStorage.setItem("nextdor_admin_read_ids", JSON.stringify(Array.from(updatedReadIds)));
    }
    setUnreadCount(0);
  }

  // Clear / dismiss all current notifications from view
  function handleClearAll() {
    const updatedDismissedIds = new Set(dismissedIds);
    notifications.forEach((item) => updatedDismissedIds.add(item.id));
    setDismissedIds(updatedDismissedIds);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "nextdor_admin_dismissed_ids",
        JSON.stringify(Array.from(updatedDismissedIds))
      );
    }
    setNotifications([]);
    setUnreadCount(0);
  }

  // Dismiss a single notification
  function handleDismissItem(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    const updatedDismissedIds = new Set(dismissedIds);
    updatedDismissedIds.add(id);
    setDismissedIds(updatedDismissedIds);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "nextdor_admin_dismissed_ids",
        JSON.stringify(Array.from(updatedDismissedIds))
      );
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  // Mark single item read on click
  function handleItemClick(id: string) {
    if (!readIds.has(id)) {
      const updatedReadIds = new Set(readIds);
      updatedReadIds.add(id);
      setReadIds(updatedReadIds);
      if (typeof window !== "undefined") {
        localStorage.setItem("nextdor_admin_read_ids", JSON.stringify(Array.from(updatedReadIds)));
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
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
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 bg-zinc-50/80">
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

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 transition"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-[#ff9900]" />
                  <span>Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-600 transition"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear all</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => loadNotifications()}
                disabled={isLoading}
                title="Refresh notifications"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#ff9900]" : ""}`} />
              </button>
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
                const isRead = readIds.has(item.id);
                const isNew = !isRead && (item.isUrgent || new Date(item.timestamp).getTime() > lastReadTimestamp);

                return (
                  <div
                    key={item.id}
                    className={`group relative flex items-start gap-3 p-3.5 transition hover:bg-zinc-50 ${
                      isNew ? "bg-amber-50/25" : ""
                    }`}
                  >
                    <Link
                      href={item.href}
                      onClick={() => handleItemClick(item.id)}
                      className="flex flex-1 items-start gap-3 min-w-0"
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

                      <div className="min-w-0 flex-1 pr-6">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p
                            className={`text-xs truncate ${
                              isNew
                                ? "font-bold text-zinc-950"
                                : "font-medium text-zinc-700 group-hover:text-[#ff9900]"
                            }`}
                          >
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

                    {/* Single notification dismiss button */}
                    <button
                      type="button"
                      onClick={(e) => handleDismissItem(e, item.id)}
                      title="Dismiss notification"
                      className="absolute right-2.5 top-3.5 p-1 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-200/50 rounded transition"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
