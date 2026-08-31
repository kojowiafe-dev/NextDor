"use client";

import { useState } from "react";
import { Menu, Bell, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminGuard } from "./AdminGuard";
import { AdminSidebar } from "./AdminSidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
};

export function AdminLayout({ children, title, actions }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:shrink-0">
          <AdminSidebar collapsed={sidebarCollapsed} />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="relative h-full">
              <AdminSidebar />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              {/* Desktop collapse toggle */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 md:flex"
              >
                <Menu className="h-5 w-5" />
              </button>
              {title && (
                <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <button
                type="button"
                className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff9900]" />
              </button>
              <Link
                href="/"
                target="_blank"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Store
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
