"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MOCK_CUSTOMERS } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout title="Customers">
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

        {/* Table */}
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
                  <td className="px-5 py-3.5 text-zinc-500">{customer.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{customer.joined}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-zinc-700">
                    {customer.totalOrders}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                    {formatPrice(customer.totalSpent, customer.currency)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        customer.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {customer.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-xs font-medium text-[#007185] opacity-0 hover:underline group-hover:opacity-100"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-zinc-400">
              No customers found for &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
