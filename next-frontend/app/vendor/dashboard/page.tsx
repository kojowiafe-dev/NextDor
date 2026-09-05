"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Store,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Save,
  DollarSign,
  Smartphone,
  ExternalLink,
  Layers,
  LogOut,
  Clock,
  Lock,
  ShieldAlert,
  EyeOff,
  Eye,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface VendorInfo {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  commissionRate: string | number;
  payoutMethod: string;
  momoNumber?: string | null;
  momoNetwork?: string | null;
}

interface VendorStats {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  grossSales: number;
  netEarnings: number;
}

interface VendorProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  salePrice?: number | string | null;
  stockQty?: number | null;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  version: number;
  images?: { id: string; url: string; alt?: string }[];
  categories?: { id: string; name: string; slug: string }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

export default function VendorDashboardPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Edit / OCC state per product
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editStock, setEditStock] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Add product modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("10");
  const [newProdImage, setNewProdImage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Token storage helper: retrieves vendor token from localStorage
  async function getValidToken(): Promise<string | null> {
    return typeof window !== "undefined" ? localStorage.getItem("vendor_token") : null;
  }

  // Demo testing helper: explicitly logs in as sample merchant on demand
  async function handleDemoLogin() {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "baker@sweetbakes.com",
          password: "Baker@NextDor2026!",
        }),
      });
      const loginJson = await loginRes.json();
      if (loginJson.success && loginJson.data?.accessToken) {
        localStorage.setItem("vendor_token", loginJson.data.accessToken);
        await loadVendorData();
      } else {
        setErrorNotice("Could not authenticate demo vendor account. Ensure backend is running.");
      }
    } catch (err: any) {
      setErrorNotice(`Demo login failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleVendorSignOut() {
    logout();
    if (typeof window !== "undefined") {
      localStorage.removeItem("vendor_token");
    }
    setVendor(null);
    setProducts([]);
    setStats(null);
    router.push("/login");
  }

  async function loadVendorData() {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const token = await getValidToken();
      if (!token) {
        setVendor(null);
        setProducts([]);
        setStats(null);
        setIsLoading(false);
        return;
      }

      // 1. Fetch dashboard stats
      const dashRes = await fetch(`${API_BASE}/vendors/portal/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const dashJson = await dashRes.json();

      if (dashJson.success && dashJson.data) {
        setVendor(dashJson.data.vendor);
        setStats(dashJson.data.stats);
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem("vendor_token");
        }
        setVendor(null);
        return;
      }

      // 2. Fetch vendor products with OCC versions
      const prodRes = await fetch(`${API_BASE}/vendors/portal/products?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const prodJson = await prodRes.json();

      if (prodJson.success && prodJson.data?.products) {
        setProducts(prodJson.data.products);
      }
    } catch (err: any) {
      setErrorNotice(`Failed to connect to marketplace API: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadVendorData();
  }, []);

  function startEditing(product: VendorProduct) {
    setEditingId(product.id);
    setEditPrice(String(product.price));
    setEditStock(String(product.stockQty ?? 0));
    setErrorNotice(null);
    setSuccessNotice(null);
  }

  async function saveProductChanges(product: VendorProduct) {
    setIsSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const token = await getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: product.version, // Required for Optimistic Concurrency Control
          price: parseFloat(editPrice),
          stockQty: parseInt(editStock, 10),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 409) {
          setErrorNotice(
            "⚠️ Concurrency Conflict (OCC): Another user modified this product simultaneously! Reloading current state..."
          );
          loadVendorData();
        } else {
          setErrorNotice(json.error?.message || "Failed to save product changes.");
        }
        return;
      }

      setSuccessNotice(`Successfully updated ${product.name} (OCC v${json.data.product.version})!`);
      setEditingId(null);
      // Update local product version and values
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? json.data.product : p))
      );
    } catch (err: any) {
      setErrorNotice(`Network error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setErrorNotice(null);

    try {
      const token = await getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProdName,
          description: newProdDesc,
          price: parseFloat(newProdPrice),
          stockQty: parseInt(newProdStock, 10),
          imageUrl: newProdImage || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorNotice(json.error?.message || "Failed to create product.");
        return;
      }

      setSuccessNotice(`Created "${json.data.product.name}" successfully!`);
      setShowAddModal(false);
      setNewProdName("");
      setNewProdDesc("");
      setNewProdPrice("");
      setNewProdImage("");
      loadVendorData();
    } catch (err: any) {
      setErrorNotice(`Error creating product: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Store className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Vendor Portal Sign In</h2>
          <p className="mt-2 text-sm text-zinc-500">
            You are currently signed out. Please sign in with your vendor account to manage your store products and orders.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login?redirect=/vendor/dashboard"
              className="inline-flex w-full items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              Sign In to Merchant Account
            </Link>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              Load Demo Merchant (Sweet Bakes)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Top Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900">
                  {vendor?.name || "Merchant Portal"}
                </h1>
                {vendor?.status === "PENDING_APPROVAL" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/30">
                    <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                    <span>Application Under Review</span>
                  </span>
                ) : vendor?.status === "ACTIVE" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Active & Live</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    <span>{vendor?.status}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                NextDor Multi-Vendor Marketplace • Platform Fee: {vendor?.commissionRate || 10}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {vendor?.slug && vendor?.status === "ACTIVE" ? (
              <Link
                href={`/store/${vendor.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                <span>View Public Storefront</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : vendor?.slug ? (
              <div
                title="Storefront is hidden from public shoppers until your merchant application is approved by an administrator."
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
              >
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Storefront Offline (Pending Approval)</span>
              </div>
            ) : null}
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Product</span>
            </button>
            <button
              type="button"
              onClick={handleVendorSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Alerts */}
        {errorNotice && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{errorNotice}</p>
          </div>
        )}

        {successNotice && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="font-medium">{successNotice}</p>
          </div>
        )}

        {/* Guided Staging Alert Banner (Approach A) */}
        {vendor?.status === "PENDING_APPROVAL" && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-950">
                      Guided Staging Mode — Store Under Compliance Review
                    </h3>
                    <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      Hidden From Public
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed max-w-3xl">
                    Your merchant application is currently pending admin verification. <strong>Under our Guided Staging policy, your public store page and catalog are completely hidden from shoppers and marketplace search</strong> to ensure buyer safety.
                  </p>
                  <p className="text-xs text-amber-800/90 font-medium">
                    ✨ <strong>You have full staging access:</strong> Add your products, set pricing, and verify stock below. The moment an administrator approves your account on the Admin Portal, your storefront and staged products will automatically go live to customers!
                  </p>
                </div>
              </div>
              <div className="shrink-0 self-start md:self-center">
                <div className="rounded-xl border border-amber-300/80 bg-white/90 backdrop-blur px-4 py-2.5 text-center shadow-xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700">Catalog Status</span>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                    <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                    Staged Offline
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total Products
              </span>
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{stats?.totalProducts ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {vendor?.status === "PENDING_APPROVAL" ? "Staged (Goes live upon approval)" : "Published in NextDor catalog"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                In Stock
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{stats?.inStock ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {vendor?.status === "PENDING_APPROVAL" ? "Staged inventory ready for release" : "Available for checkout"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Low Stock Alerts
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600">{stats?.lowStock ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-400">Items with ≤ 3 stock remaining</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Payout Mobile Money
              </span>
              <Smartphone className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-2 text-lg font-bold text-zinc-900">
              {vendor?.momoNumber || "Not configured"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {vendor?.momoNetwork || "MTN"} MoMo • Automated 48h Escrow
            </p>
          </div>
        </div>

        {/* Inventory Table with OCC Management */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Store Inventory & Real-Time Stock</h2>
              <p className="text-xs text-zinc-500">
                Protected by Optimistic Concurrency Control (OCC) to prevent lost updates across concurrent store managers.
              </p>
            </div>
            <button
              onClick={loadVendorData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-xs font-semibold text-zinc-500">
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Price (GHS)</th>
                  <th className="px-6 py-3.5">Stock Quantity</th>
                  <th className="px-6 py-3.5">Stock Status</th>
                  <th className="px-6 py-3.5">Storefront Visibility</th>
                  <th className="px-6 py-3.5 text-center">OCC Version</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading && products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                      Loading merchant inventory...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                      No products found. Click "Add New Product" to stock your store!
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const isEditing = editingId === prod.id;
                    const primaryImg = prod.images?.[0]?.url;

                    return (
                      <tr key={prod.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center font-bold text-zinc-400 text-xs">
                              {primaryImg ? (
                                <img src={primaryImg} alt={prod.name} className="h-full w-full object-cover" />
                              ) : (
                                prod.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-900">{prod.name}</p>
                              <p className="text-xs text-zinc-400 line-clamp-1">{prod.description}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-sm font-semibold text-zinc-900 focus:border-purple-600 focus:outline-none"
                            />
                          ) : (
                            <span className="font-bold text-zinc-900">
                              {formatPrice(Number(prod.price), "GHS")}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                              className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm font-semibold text-zinc-900 focus:border-purple-600 focus:outline-none"
                            />
                          ) : (
                            <span className="font-medium text-zinc-700">
                              {prod.stockQty !== null ? `${prod.stockQty} units` : "Unlimited"}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              prod.stockStatus === "IN_STOCK"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : prod.stockStatus === "LOW_STOCK"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {prod.stockStatus.replace("_", " ")}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {vendor?.status === "PENDING_APPROVAL" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                              <EyeOff className="h-3 w-3 text-amber-600" />
                              <span>Staged (Offline)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                              <Eye className="h-3 w-3 text-emerald-600" />
                              <span>Live on Storefront</span>
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono font-medium text-zinc-600 border border-zinc-200">
                            v{prod.version}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveProductChanges(prod)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Save className="h-3.5 w-3.5" />
                                <span>Save</span>
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(prod)}
                              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition"
                            >
                              Edit Stock / Price
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-900">Add New Product to Store</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg"
              >
                ✕
              </button>
            </div>

            {vendor?.status === "PENDING_APPROVAL" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Staging Mode Active:</strong> This product will be saved to your store catalog immediately, but will remain hidden from the public marketplace until your merchant account is approved by an admin.
                </p>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Ghana Meat Pies (Pack of 6)"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your product, ingredients, dimensions, etc."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Price (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    placeholder="120.00"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Initial Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="10"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Photo Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newProdImage}
                  onChange={(e) => setNewProdImage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isCreating ? "Publishing..." : "Publish Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
