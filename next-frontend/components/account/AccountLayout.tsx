"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AccountSidebar, AccountBottomNav } from "./AccountSidebar";

type AccountLayoutProps = {
  children: React.ReactNode;
  title?: string;
};

export function AccountLayout({ children, title }: AccountLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff3e0]">
            <svg
              className="h-8 w-8 text-[#ff9900]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Please sign in to access your account and manage your orders.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="block rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6">
        {title && (
          <h1 className="mb-6 text-2xl font-semibold text-zinc-900">{title}</h1>
        )}
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Sidebar — desktop */}
          <div className="hidden md:block">
            <AccountSidebar />
          </div>

          {/* Main content */}
          <div>{children}</div>
        </div>
      </div>

      {/* Bottom nav — mobile */}
      <AccountBottomNav />
    </>
  );
}
