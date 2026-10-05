"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Search, RefreshCw, CheckCircle2, AlertCircle, Store, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { formatPrice } from "@/lib/utils";
import {
  getCachedProducts,
  setCachedProducts,
  isProductsCacheStale,
  invalidateProductsCache,
} from "@/lib/cache/adminCache";
import { API_BASE } from "@/lib/api-config";
import { BulkUploadModal } from "@/components/vendor/BulkUploadModal";


interface ProductImage {
  id: string;
  url: string;
  alt?: string;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDesc?: string | null;
  price: string | number;
  salePrice?: string | number | null;
  currency: string;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  stockQty?: number | null;
  vendor?: {
    id: string;
    name: string;
    slug: string;
  };
  images?: ProductImage[];
  categories?: ProductCategory[];
}

const stockConfig = {
  IN_STOCK: { label: "In Stock", classes: "bg-green-100 text-green-700 whitespace-nowrap" },
  LOW_STOCK: { label: "Low Stock", classes: "bg-amber-100 text-amber-700 whitespace-nowrap" },
  OUT_OF_STOCK: { label: "Out of Stock", classes: "bg-red-100 text-red-700 whitespace-nowrap" },
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);


  async function loadProducts(forceRefresh = false) {
    // 1. Instant Cache Retrieval (Stale-While-Revalidate)
    const cached = getCachedProducts();

    if (cached && !forceRefresh) {
      setProducts(cached);
      setIsLoading(false);

      // If fresh within TTL, no background fetch needed
      if (!isProductsCacheStale()) {
        return;
      }
      setIsRefreshing(true);
    } else if (!cached) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    // 2. Network Fetch (runs quietly in background if cached data is already visible)
    try {
      const res = await fetch(`${API_BASE}/products?limit=100`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.products)) {
          setProducts(json.data.products);
          setCachedProducts(json.data.products);
        }
      }
    } catch (err) {
      console.warn("Could not reach NextDor API at", API_BASE, err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const [syncProgressText, setSyncProgressText] = useState<string>("");

  async function handleSync() {
    setIsSyncing(true);
    setSyncNotice(null);
    setSyncProgressText("Connecting to WooCommerce...");

    try {
      const res = await fetch(`${API_BASE}/sync/wc`, {
        method: "POST",
      });
      const json = await res.json();

      if (!json.success) {
        setSyncNotice({
          type: "error",
          message: json.error?.message || "Failed to start sync process.",
        });
        setIsSyncing(false);
        setSyncProgressText("");
        return;
      }

      // Decoupled polling: check progress every 1.5 seconds without keeping an HTTP socket open
      const pollTimer = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API_BASE}/sync/status`, { cache: "no-store" });
          if (!pollRes.ok) return;
          const pollJson = await pollRes.json();
          const status = pollJson.data;

          if (status) {
            setSyncProgressText(status.progress || "Syncing...");

            if (!status.isSyncing) {
              clearInterval(pollTimer);
              setIsSyncing(false);
              setSyncProgressText("");

              if (status.lastError) {
                setSyncNotice({
                  type: "error",
                  message: `Sync encountered an issue: ${status.lastError}`,
                });
              } else {
                const total = status.lastResult?.totalFetched ?? status.totalFetched;
                setSyncNotice({
                  type: "success",
                  message: `Successfully synchronized ${total} products from WooCommerce into Neon PostgreSQL!`,
                });
              }
              invalidateProductsCache();
              await loadProducts(true);
            }
          }
        } catch {
          // Poll network glitch — keep polling
        }
      }, 1500);
    } catch (err: any) {
      setSyncNotice({
        type: "error",
        message: "Failed to connect to backend server. Please verify the backend is running.",
      });
      setIsSyncing(false);
      setSyncProgressText("");
    }
  }

  const filtered = products.filter((p) => {
    const query = search.toLowerCase();
    const matchesName = p.name.toLowerCase().includes(query);
    const matchesCategory = p.categories?.some((c) => c.name.toLowerCase().includes(query));
    return matchesName || matchesCategory;
  });

  async function handleDelete(id: string) {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // Retrieve auth token from local storage (stored as "nextdor-token" by AuthContext)
      const token = typeof window !== "undefined" ? localStorage.getItem("nextdor-token") : null;
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDeleteError(json.error?.message || "Failed to delete product.");
        setIsDeleting(false);
        return;
      }
      // Optimistic update: remove from local state & cache
      setProducts((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        setCachedProducts(updated);
        return updated;
      });
      setDeleteId(null);
    } catch (err) {
      setDeleteError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }


  return (
    <AdminLayout
      title="Products"
      actions={
        <div className="flex items-center gap-3">
          {/* Refresh Catalog Button */}
          <button
            type="button"
            onClick={() => loadProducts(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
            title="Force refresh product catalog"
          >
            <RefreshCw className={`h-4 w-4 text-zinc-500 ${isRefreshing ? "animate-spin text-[#ff9900]" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Sync from WooCommerce Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
            title="Ingest products from WooCommerce store"
          >
            <RefreshCw className={`h-4 w-4 text-[#ff9900] ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isSyncing ? (syncProgressText || "Syncing...") : "Sync from WooCommerce"}</span>
          </button>

          {/* Bulk CSV Upload Button */}
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
            title="Bulk import products from CSV template"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span className="hidden sm:inline">Bulk Import</span>
          </button>

          <Link
            href="/vendor/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-sm font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100"
          >
            <Store className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="hidden md:inline">Vendor Portal</span>
          </Link>

          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-[#f08804]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Link>
        </div>
      }
    >
      {/* Sync Status Banner */}
      {syncNotice && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl p-4 text-sm font-medium ${
            syncNotice.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncNotice.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{syncNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
        {/* Search */}
        <div className="border-b border-zinc-100 p-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or categories..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
            />
          </div>
        </div>

        {/* Desktop Table — hidden on small screens */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-5 py-3 text-left">Store / Vendor</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-left">Stock</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((product) => {
                const stock = stockConfig[product.stockStatus] || stockConfig.IN_STOCK;
                const primaryImage = product.images?.[0]?.url;

                return (
                  <tr key={product.id} className="group hover:bg-zinc-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-xs font-bold text-zinc-500">
                          {primaryImage ? (
                            <img
                              src={primaryImage}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            product.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{product.name}</p>
                          <p className="text-xs text-zinc-400 line-clamp-1">{product.shortDesc || product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/store/${product.vendor?.slug || "nextdor"}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20 hover:bg-purple-100 transition"
                        title="View merchant storefront"
                      >
                        <Store className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>{product.vendor?.name || "Nextdor Direct"}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {product.categories && product.categories.length > 0 ? (
                          product.categories.map((cat) => (
                            <span
                              key={cat.id}
                              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
                            >
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">Uncategorized</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div>
                        <p className="font-semibold text-zinc-900">
                          {formatPrice(Number(product.salePrice ?? product.price), product.currency || "GHS")}
                        </p>
                        {product.salePrice && (
                          <p className="text-xs text-zinc-400 line-through">
                            {formatPrice(Number(product.price), product.currency || "GHS")}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${stock.classes}`}>
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
        </div>

        {/* Mobile Card List — shown only on xs screens */}
        <div className="sm:hidden divide-y divide-zinc-100">
          {filtered.map((product) => {
            const stock = stockConfig[product.stockStatus] || stockConfig.IN_STOCK;
            const primaryImage = product.images?.[0]?.url;
            return (
              <div key={product.id} className="flex items-start gap-3 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
                  {primaryImage ? (
                    <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    product.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900 text-sm">{product.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">{product.vendor?.name || "Nextdor Direct"}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${stock.classes}`}>
                      {stock.label}
                    </span>
                    <span className="text-xs font-semibold text-zinc-900">
                      {formatPrice(Number(product.salePrice ?? product.price), product.currency || "GHS")}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteId(product.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div className="py-12 text-center text-sm text-zinc-500">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#ff9900] mb-2" />
            Loading products from database...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-zinc-600">No products found in the database.</p>
            <p className="mt-1 text-xs text-zinc-400">Click &ldquo;Sync from WooCommerce&rdquo; above to import your live store catalog!</p>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Delete Product?</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  This action cannot be undone. The product will be permanently removed from the catalog.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteId(null); setDeleteError(null); }}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal for Administrators */}
      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        endpoint={`${API_BASE}/products/bulk`}
        authToken={typeof window !== "undefined" ? localStorage.getItem("nextdor-token") || "" : ""}
        onSuccess={(count) => {
          setSyncNotice({
            type: "success",
            message: `Successfully imported ${count} products into catalog!`,
          });
          invalidateProductsCache();
          loadProducts(true);
        }}
      />
    </AdminLayout>
  );
}
