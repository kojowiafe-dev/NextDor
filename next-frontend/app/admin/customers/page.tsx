"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, RefreshCw, Users, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import type { AdminCustomer } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";
import { createSWRCache } from "@/lib/cache/clientCache";
import { API_BASE } from "@/lib/api-config";

export const adminCustomersCache = createSWRCache<AdminCustomer[]>("nextdor_admin_customers", 5 * 60_000);

export default function AdminCustomersPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>(() => {
    return adminCustomersCache.get("customers_list") ?? [];
  });
  const [isLoading, setIsLoading] = useState(!adminCustomersCache.get("customers_list"));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  async function loadCustomers(forceRefresh = false) {
    const cacheKey = "customers_list";
    const { data: cached, isStale, hasData } = adminCustomersCache.getEntry(cacheKey);

    if (hasData && !forceRefresh) {
      setCustomers(cached!);
      setIsLoading(false);
      if (!isStale) return;
      setIsRefreshing(true);
    } else if (!hasData) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      if (!token) {
        setCustomers([]);
        return;
      }
      const res = await fetch(`${API_BASE}/admin/customers?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data?.customers ?? [];
        adminCustomersCache.set(list, cacheKey);
        setCustomers(list);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
      setCustomers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [token, search]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout
      title="Customers"
      actions={
        <button
          type="button"
          onClick={() => {
            adminCustomersCache.invalidateAll();
            loadCustomers(true);
          }}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isRefreshing ? "animate-spin text-[#ff9900]" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
        {/* Search */}
        <div className="border-b border-zinc-100 p-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#ff9900]" />
            <span className="text-sm">Loading customers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
            <p className="font-semibold text-zinc-700">No customers found</p>
            <p className="mt-1 text-xs text-zinc-400">
              {search ? "No customers matched your search query." : "Registered customers will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Phone</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                  <th className="px-5 py-3 text-center">Orders</th>
                  <th className="px-5 py-3 text-right">Total Spent</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="group hover:bg-zinc-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-xs font-bold text-[#ff9900]">
                          {customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{customer.name}</p>
                          <p className="text-xs text-zinc-400">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{customer.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{customer.joined}</td>
                    <td className="px-5 py-3.5 text-center font-medium text-zinc-800">
                      {customer.totalOrders}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-zinc-800">
                      {formatPrice(customer.totalSpent, customer.currency)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          customer.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {customer.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
