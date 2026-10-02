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
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const coreNavItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Merchants", href: "/admin/merchants", icon: Store },
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
      className={`flex h-full flex-col justify-between bg-[#0d1117] transition-all ${
        onClose ? "overflow-y-auto w-64 shadow-2xl" : "overflow-hidden " + (collapsed ? "w-16" : "w-60")
      }`}
    >
      {/* Top Section: Logo + Navigation */}
      <div className={`flex flex-col min-h-0 flex-1 ${onClose ? "" : "overflow-hidden"}`}>
        {/* Logo Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-4 py-2">
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-2 overflow-hidden"
          >
            {collapsed ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9900] text-sm font-bold text-zinc-900 shadow-sm">
                N
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Image
                  src="/logo.png"
                  alt="NextDor Admin"
                  width={125}
                  height={30}
                  className="h-6.5 w-auto object-contain"
                  priority
                />
                <span
                  className={`w-fit rounded px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider ${
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

        {/* Nav list */}
        <nav className={`flex-1 px-2.5 py-2 ${onClose ? "" : "overflow-hidden"}`}>
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
                        ? "bg-[#ff9900]/15 text-[#ff9900]"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <item.icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-[#ff9900]" : "text-zinc-400 group-hover:text-white"}`}
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

      {/* Bottom Section: User Profile + Actions with Full Text */}
      <div className="shrink-0 border-t border-white/5 p-2.5">
        {!collapsed && (
          <div className="mb-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 bg-white/[0.02]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-xs font-bold text-[#ff9900]">
              {user?.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
              <p className="truncate text-[9.5px] text-zinc-400">
                {user?.role === "super_admin" ? "Platform Root (Super Admin)" : "Operations Administrator"}
              </p>
            </div>
          </div>
        )}
        <Link
          href="/"
          onClick={onClose}
          title={collapsed ? "Back to Storefront" : undefined}
          className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-[#ff9900]" />
          {!collapsed && <span>Back to Storefront</span>}
        </Link>
        <button
          type="button"
          onClick={() => {
            onClose?.();
            logout();
          }}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
