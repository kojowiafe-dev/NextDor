"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MOCK_PRODUCTS, type AdminProduct } from "@/lib/admin/mockData";
import { formatPrice } from "@/lib/utils";

const stockConfig = {
  in_stock: { label: "In Stock", classes: "bg-green-100 text-green-700" },
  low_stock: { label: "Low Stock", classes: "bg-amber-100 text-amber-700" },
  out_of_stock: { label: "Out of Stock", classes: "bg-red-100 text-red-700" },
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>(MOCK_PRODUCTS);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  return (
    <AdminLayout
      title="Products"
      actions={
        <Link
          href="/admin/products/new"
          className="flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
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
              placeholder="Search products..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-left">Stock</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((product) => {
                const stock = stockConfig[product.stock];
                return (
                  <tr key={product.id} className="group hover:bg-zinc-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-500">
                          {product.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{product.name}</p>
                          <p className="text-xs text-zinc-400 line-clamp-1">{product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div>
                        <p className="font-semibold text-zinc-900">
                          {formatPrice(product.salePrice ?? product.price, product.currency)}
                        </p>
                        {product.salePrice && (
                          <p className="text-xs text-zinc-400 line-through">
                            {formatPrice(product.price, product.currency)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stock.classes}`}>
                        {stock.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteId(product.id)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-zinc-400">
              No products found for &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Delete Product?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              This action cannot be undone. The product will be permanently removed.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
