"use client";

import Link from "next/link";
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const superAdminNavItems = [
  { label: "Platform Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Merchants", href: "/admin/merchants", icon: Store },
  { label: "Administrators", href: "/admin/admins", icon: ShieldCheck },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
  { label: "Platform Settings", href: "/admin/settings", icon: Settings },
];

const opsAdminNavItems = [
  { label: "Operations Console", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Merchant Review", href: "/admin/merchants", icon: Store },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

type AdminSidebarProps = {
  collapsed?: boolean;
};

export function AdminSidebar({ collapsed = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, isSuperAdmin, logout } = useAuth();

  const currentNavItems = isSuperAdmin ? superAdminNavItems : opsAdminNavItems;

  function isActive(item: (typeof superAdminNavItems)[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <aside
      className={`flex h-full flex-col bg-[#0d1117] transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/5 px-4">
        <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9900] text-xs font-bold text-zinc-900">
            N
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">NextDor</p>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  user?.role === "super_admin"
                    ? "bg-[#ff9900]/20 text-[#ff9900]"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {user?.role === "super_admin" ? "Super Admin" : "Operations"}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
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
                  title={collapsed ? item.label : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-[#ff9900]/15 text-[#ff9900]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <item.icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-[#ff9900]" : "text-zinc-500 group-hover:text-white"}`}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + logout */}
      <div className="shrink-0 border-t border-white/5 p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-xs font-bold text-[#ff9900]">
              {user?.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
              <p className="truncate text-[10px] text-zinc-400">
                {user?.role === "super_admin" ? "Platform Root (Super Admin)" : "Operations Administrator"}
              </p>
            </div>
          </div>
        )}
        <Link
          href="/"
          title={collapsed ? "Back to Storefront" : undefined}
          className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-[#ff9900]" />
          {!collapsed && "Back to Storefront"}
        </Link>
        <button
          type="button"
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  );
}
