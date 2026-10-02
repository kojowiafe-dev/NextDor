"use client";

import { useState } from "react";
import { Menu, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminGuard } from "./AdminGuard";
import { AdminSidebar } from "./AdminSidebar";
import { AdminNotificationsPopover } from "./AdminNotificationsPopover";

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
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
            <button
              type="button"
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="relative h-full z-10 animate-in slide-in-from-left duration-200">
              <AdminSidebar onClose={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 sm:px-4 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 active:scale-95 md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              {/* Desktop collapse toggle */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 md:flex"
                aria-label="Toggle sidebar collapse"
              >
                <Menu className="h-5 w-5" />
              </button>
              {title && (
                <h1 className="text-sm sm:text-base font-semibold text-zinc-900 truncate">
                  {title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {actions}
              <AdminNotificationsPopover />
              <Link
                href="/"
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View Store</span>
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
