"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ExternalLink,
  Store,
  ShieldCheck,
  FileText,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const coreNavItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Inventory & Hubs", href: "/admin/inventory", icon: Warehouse },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Merchants", href: "/admin/merchants", icon: Store },
  { label: "Payouts & Ledger", href: "/admin/payouts", icon: Wallet },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

const superAdminExtraItems = [
  { label: "Administrators", href: "/admin/admins", icon: ShieldCheck },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
  { label: "Platform Settings", href: "/admin/settings", icon: Settings },
];

type AdminSidebarProps = {
  collapsed?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ collapsed = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, isSuperAdmin, logout } = useAuth();

  const currentNavItems = isSuperAdmin
    ? [...coreNavItems, ...superAdminExtraItems]
    : coreNavItems;

  function isActive(item: (typeof coreNavItems)[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <aside
      className={`flex h-full flex-col justify-between bg-[#0d1117] transition-all duration-200 ${
        onClose ? "overflow-hidden w-64 shadow-2xl" : "overflow-hidden " + (collapsed ? "w-16" : "w-64")
      }`}
    >
      {/* Top Section: Logo + Navigation */}
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Logo Bar */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/5 ${
            collapsed ? "justify-center px-2 py-2.5" : "justify-between px-4 py-2.5"
          }`}
        >
          <Link
            href="/admin"
            onClick={onClose}
            className={`flex items-center gap-2.5 overflow-hidden ${
              collapsed ? "justify-center" : ""
            }`}
            title="NextDor Admin Command"
          >
            {collapsed ? (
              <div className="group/logo flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1c2333] to-[#121824] ring-1 ring-[#ff9900]/40 shadow-md hover:ring-[#ff9900] transition-all duration-200">
                <Image
                  src="/arrow-loader.png"
                  alt="NextDor Admin"
                  width={28}
                  height={28}
                  className="h-6 w-6 object-contain drop-shadow-[0_2px_6px_rgba(255,153,0,0.45)] group-hover/logo:scale-110 transition-transform duration-200"
                  priority
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Image
                  src="/logo.png"
                  alt="NextDor Admin"
                  width={155}
                  height={42}
                  className="h-8.5 w-auto object-contain drop-shadow-xs"
                  priority
                />
                <span
                  className={`w-fit rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${
                    user?.role === "super_admin"
                      ? "bg-[#ff9900]/20 text-[#ff9900] border border-[#ff9900]/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}
                >
                  {user?.role === "super_admin" ? "Super Admin" : "Operations"}
                </span>
              </div>
            )}
          </Link>

          {/* Close button in mobile drawer */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Nav list - scrollable on short screens so nothing is clipped */}
        <nav className="flex-1 min-h-0 px-2.5 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {!collapsed && (
            <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Main Menu
            </p>
          )}
          <ul className="space-y-0.5">
            {currentNavItems.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all ${
                      active
                        ? "bg-[#ff9900]/15 text-[#ff9900] shadow-xs"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <item.icon
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${active ? "text-[#ff9900]" : "text-zinc-400 group-hover:text-white"}`}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Bottom Section: Compact User Profile + Action Icons */}
      <div className="shrink-0 border-t border-white/5 p-2 bg-black/20">
        <div
          className={`flex items-center ${
            collapsed ? "flex-col gap-2 justify-center py-1" : "justify-between gap-2 px-1.5 py-1"
          }`}
        >
          {/* User Info */}
          <div className="flex items-center gap-2 min-w-0" title={user?.name ?? undefined}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-xs font-bold text-[#ff9900] ring-1 ring-[#ff9900]/30">
              {user?.avatarInitials ?? "A"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white leading-tight">{user?.name}</p>
                <p className="truncate text-[9.5px] text-zinc-400 leading-tight">
                  {user?.role === "super_admin" ? "Super Admin" : "Operations"}
                </p>
              </div>
            )}
          </div>

          {/* Action Icons: Back to Storefront & Sign Out */}
          <div className={`flex items-center gap-1 shrink-0 ${collapsed ? "flex-col" : ""}`}>
            <Link
              href="/"
              onClick={onClose}
              title="Back to Storefront"
              aria-label="Back to Storefront"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-[#ff9900] active:scale-95 transition"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                logout();
              }}
              title="Sign Out"
              aria-label="Sign Out"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/15 hover:text-red-400 active:scale-95 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
