"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createSWRCache } from "@/lib/cache/clientCache";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  Store,
  Package,
  ShoppingBag,
  CreditCard,
  Settings,
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
  Truck,
  Check,
  ChevronRight,
  ArrowUpRight,
  HelpCircle,
  MapPin,
  User,
  Calendar,
  Wallet,
  Building2,
  FileText,
  Trash2,
  Search,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { BulkUploadModal } from "@/components/vendor/BulkUploadModal";
import { StoreSyncModal } from "@/components/vendor/StoreSyncModal";

type DashboardTab = "inventory" | "orders" | "payouts" | "settings";

interface VendorInfo {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  commissionRate: string | number;
  payoutMethod: string;
  momoNumber?: string | null;
  momoNetwork?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
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

interface VendorOrderItem {
  id: string;
  productName: string;
  productImage: string | null;
  unitPrice: number | string;
  quantity: number;
  subtotal: number | string;
}

interface VendorOrder {
  id: string;
  orderId: string;
  vendorId: string;
  subtotal: number | string;
  commissionAmount: number | string;
  vendorEarnings: number | string;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  notes?: string | null;
  clearedAt?: string | null;
  createdAt: string;
  order: {
    id: string;
    number: string;
    paymentStatus: string;
    createdAt: string;
    shippingAddress: any;
    user?: {
      name: string;
      email: string;
      phone?: string | null;
    } | null;
    items: VendorOrderItem[];
  };
  payout?: {
    id: string;
    status: string;
    paidAt?: string | null;
    paystackTransferRef?: string | null;
  } | null;
}

interface EscrowSummary {
  lifetimeGrossSales: number;
  lifetimeNetEarnings: number;
  inEscrowAmount: number;
  inEscrowOrdersCount: number;
  availableForPayoutAmount: number;
  availableOrdersCount: number;
  totalPaidOut: number;
}

interface VendorPayout {
  id: string;
  vendorId: string;
  amount: number | string;
  currency: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  paystackTransferRef?: string | null;
  paidAt?: string | null;
  createdAt: string;
  vendorOrders?: {
    id: string;
    subtotal: number | string;
    commissionAmount: number | string;
    vendorEarnings: number | string;
    status: string;
    order: { number: string };
  }[];
}
import { API_BASE } from "@/lib/api-config";

interface VendorPortalSnapshot {
  vendor: VendorInfo;
  stats: VendorStats | null;
  products: VendorProduct[];
  orders: VendorOrder[];
  payouts: VendorPayout[];
  escrowSummary: EscrowSummary | null;
}

const vendorPortalCache = createSWRCache<VendorPortalSnapshot>("nextdor_vendor_portal", 3 * 60_000);

export default function VendorDashboardPage() {
  const router = useRouter();
  const { user, token: authToken, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>("inventory");

  // Core Data
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [escrowSummary, setEscrowSummary] = useState<EscrowSummary | null>(null);

  // Loading & Error States
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isNotVendor, setIsNotVendor] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Edit / OCC state per product
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editStock, setEditStock] = useState<string>("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Add product modal & Bulk Ingestion Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productStockFilter, setProductStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("10");
  const [newProdImage, setNewProdImage] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const filteredProducts = products.filter((p) => {
    if (productStockFilter !== "ALL" && p.stockStatus !== productStockFilter) {
      return false;
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Orders Tab Filters & Actions
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>("ALL");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Store Settings Form State
  const [settingName, setSettingName] = useState("");
  const [settingDesc, setSettingDesc] = useState("");
  const [settingPhone, setSettingPhone] = useState("");
  const [settingMomoNet, setSettingMomoNet] = useState("MTN");
  const [settingMomoNum, setSettingMomoNum] = useState("");
  const [settingLogo, setSettingLogo] = useState("");
  const [settingBanner, setSettingBanner] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Token storage helper: checks AuthContext, then localStorage
  function getValidToken(): string | null {
    if (authToken) return authToken;
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("nextdor-token") ||
        localStorage.getItem("vendor_token") ||
        null
      );
    }
    return null;
  }

  function handleVendorSignOut() {
    vendorPortalCache.invalidateAll();
    logout();
    if (typeof window !== "undefined") {
      localStorage.removeItem("vendor_token");
      localStorage.removeItem("nextdor-token");
      localStorage.removeItem("nextdor-auth");
    }
    setVendor(null);
    setProducts([]);
    setOrders([]);
    setPayouts([]);
    setStats(null);
    router.replace("/login?redirect=/vendor/dashboard");
  }

  function handleManualRefresh() {
    vendorPortalCache.invalidateAll();
    loadVendorData(true);
  }

  async function loadVendorData(forceRefresh = false) {
    setErrorNotice(null);
    setIsNotVendor(false);

    const token = getValidToken();
    if (!token) {
      router.replace("/login?redirect=/vendor/dashboard");
      return;
    }

    // 1. INSTANT: serve from cache if available
    const { data: cached, isStale, hasData } = vendorPortalCache.getEntry();
    if (hasData && !forceRefresh) {
      setVendor(cached!.vendor);
      setStats(cached!.stats);
      setProducts(cached!.products);
      setOrders(cached!.orders);
      setPayouts(cached!.payouts);
      setEscrowSummary(cached!.escrowSummary);

      setSettingName(cached!.vendor.name || "");
      setSettingDesc(cached!.vendor.description || "");
      setSettingPhone(cached!.vendor.phone || "");
      setSettingMomoNet(cached!.vendor.momoNetwork || "MTN");
      setSettingMomoNum(cached!.vendor.momoNumber || "");
      setSettingLogo(cached!.vendor.logoUrl || "");
      setSettingBanner(cached!.vendor.bannerUrl || "");

      setIsDataLoading(false);
      if (!isStale) return; // Completely fresh — background fetch skipped
    } else if (!hasData) {
      setIsDataLoading(true);
    }

    try {
      // 1. Fetch dashboard overview & stats
      const dashRes = await fetch(`${API_BASE}/vendors/portal/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashJson = await dashRes.json();

      if (
        dashRes.status === 403 ||
        dashJson.error?.code === "NO_VENDOR_STORE" ||
        dashJson.error?.code === "FORBIDDEN"
      ) {
        if (user && (user.role === "admin" || user.role === "super_admin")) {
          router.replace("/admin");
          return;
        }
        setIsNotVendor(true);
        setIsDataLoading(false);
        return;
      }

      if (dashRes.status === 401) {
        handleVendorSignOut();
        return;
      }

      let freshVendor: VendorInfo | null = null;
      let freshStats: VendorStats | null = null;

      if (dashJson.success && dashJson.data?.vendor) {
        const v = dashJson.data.vendor;
        freshVendor = v;
        freshStats = dashJson.data.stats || null;
        setVendor(v);
        setStats(freshStats);
        setIsNotVendor(false);

        // Pre-fill settings form
        setSettingName(v.name || "");
        setSettingDesc(v.description || "");
        setSettingPhone(v.phone || "");
        setSettingMomoNet(v.momoNetwork || "MTN");
        setSettingMomoNum(v.momoNumber || "");
        setSettingLogo(v.logoUrl || "");
        setSettingBanner(v.bannerUrl || "");

        if (typeof window !== "undefined") {
          localStorage.setItem("vendor_token", token);
        }
      } else {
        setErrorNotice(dashJson.error?.message || "Failed to load store information.");
      }

      // 2. Fetch products, orders, and payouts concurrently
      const [prodRes, ordersRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/vendors/portal/products?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/vendors/portal/orders?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/vendors/portal/payouts?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [prodJson, ordersJson, payoutsJson] = await Promise.all([
        prodRes.json(),
        ordersRes.json(),
        payoutsRes.json(),
      ]);

      let freshProducts: VendorProduct[] = [];
      let freshOrders: VendorOrder[] = [];
      let freshPayouts: VendorPayout[] = [];
      let freshEscrow: EscrowSummary | null = null;

      if (prodJson.success && prodJson.data?.products) {
        freshProducts = prodJson.data.products;
        setProducts(freshProducts);
      }

      if (ordersJson.success && ordersJson.data?.orders) {
        freshOrders = ordersJson.data.orders;
        setOrders(freshOrders);
      }

      if (payoutsJson.success && payoutsJson.data) {
        freshPayouts = payoutsJson.data.payouts || [];
        setPayouts(freshPayouts);
        if (payoutsJson.data.escrowSummary) {
          freshEscrow = payoutsJson.data.escrowSummary;
          setEscrowSummary(freshEscrow);
        }
      }

      if (freshVendor) {
        vendorPortalCache.set({
          vendor: freshVendor,
          stats: freshStats,
          products: freshProducts,
          orders: freshOrders,
          payouts: freshPayouts,
          escrowSummary: freshEscrow,
        });
      }
    } catch (err: any) {
      if (!hasData) {
        setErrorNotice(`Failed to connect to marketplace API: ${err.message}`);
      }
    } finally {
      setIsDataLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/vendor/dashboard");
      return;
    }
    if (user && (user.role === "admin" || user.role === "super_admin") && !user.vendorId) {
      router.replace("/admin");
      return;
    }
    loadVendorData();
  }, [authLoading, isAuthenticated, authToken, user]);

  // Product Inline Edit with OCC
  function startEditing(product: VendorProduct) {
    setEditingId(product.id);
    setEditPrice(String(product.price));
    setEditStock(String(product.stockQty ?? 0));
    setErrorNotice(null);
    setSuccessNotice(null);
  }

  async function saveProductChanges(product: VendorProduct) {
    setIsSavingProduct(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const token = getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: product.version,
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
      vendorPortalCache.invalidateAll();
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? json.data.product : p))
      );
    } catch (err: any) {
      setErrorNotice(`Network error: ${err.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  }

  // Create Product Modal
  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingProduct(true);
    setErrorNotice(null);

    try {
      const token = getValidToken();
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
      vendorPortalCache.invalidateAll();
      loadVendorData(true);
    } catch (err: any) {
      setErrorNotice(`Error creating product: ${err.message}`);
    } finally {
      setIsCreatingProduct(false);
    }
  }

  // Delete Product
  async function handleDeleteProduct(product: VendorProduct) {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }
    setErrorNotice(null);
    setSuccessNotice(null);
    try {
      const token = getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/products/${product.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorNotice(json.error?.message || "Failed to delete product.");
        return;
      }
      setSuccessNotice(`Deleted "${product.name}" successfully!`);
      vendorPortalCache.invalidateAll();
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err: any) {
      setErrorNotice(`Error deleting product: ${err.message}`);
    }
  }

  // Update Order Dispatch Status
  async function handleUpdateOrderStatus(orderId: string, newStatus: string, notes?: string) {
    setUpdatingOrderId(orderId);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const token = getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          notes,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorNotice(json.error?.message || "Failed to update order dispatch status.");
        return;
      }

      setSuccessNotice(
        `Order status successfully updated to ${newStatus}${
          newStatus === "DELIVERED" ? " • 48-Hour Escrow Protection Timer Started!" : ""
        }`
      );

      // Refresh orders and escrow metrics
      vendorPortalCache.invalidateAll();
      await loadVendorData(true);
    } catch (err: any) {
      setErrorNotice(`Network error: ${err.message}`);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Save Store Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingSettings(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const token = getValidToken();
      const res = await fetch(`${API_BASE}/vendors/portal/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: settingName,
          description: settingDesc,
          phone: settingPhone,
          momoNetwork: settingMomoNet,
          momoNumber: settingMomoNum,
          logoUrl: settingLogo || undefined,
          bannerUrl: settingBanner || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorNotice(json.error?.message || "Failed to save store settings.");
        return;
      }

      setVendor(json.data.vendor);
      vendorPortalCache.invalidateAll();
      setSuccessNotice("Store profile & Mobile Money payout settings updated successfully!");
    } catch (err: any) {
      setErrorNotice(`Error updating settings: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  }

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    if (selectedOrderStatus === "ALL") return true;
    return o.status === selectedOrderStatus;
  });

  if (authLoading || (isDataLoading && !vendor && !isNotVendor)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-zinc-50 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
        <p className="text-xs font-medium text-zinc-500">Loading your merchant dashboard...</p>
      </div>
    );
  }

  if (isNotVendor) {
    if (user && (user.role === "admin" || user.role === "super_admin")) {
      router.replace("/admin");
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center bg-zinc-50 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-[#ff9900]" />
          <p className="text-xs font-medium text-zinc-500">Redirecting to Admin Portal...</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Store className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Merchant Store Not Found</h2>
          <p className="mt-2 text-sm text-zinc-600">
            You are signed in as <span className="font-semibold text-zinc-900">{user?.email}</span> (Customer Account).
          </p>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Your account does not have an active merchant store registered. To start selling on Nextdor, register your store below or sign in with your vendor credentials.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/vendor/register"
              className="inline-flex w-full items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              Open a Merchant Store
            </Link>
            <button
              type="button"
              onClick={handleVendorSignOut}
              className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              Sign In with Merchant Account
            </button>
            <Link
              href="/"
              className="text-xs text-zinc-500 hover:text-zinc-800 hover:underline pt-1"
            >
              ← Return to Customer Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-zinc-50 px-4 py-12 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-zinc-900">Store Data Unavailable</h2>
          <p className="mt-2 text-xs text-zinc-500">
            {errorNotice || "Could not retrieve store information. Please check your network connection."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={handleVendorSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              <span>Sign In Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Top Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm overflow-hidden font-bold">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5" />
              )}
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
                Nextdor Multi-Vendor Marketplace • Platform Fee: {vendor?.commissionRate || 10}%
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
                <span>Storefront Offline (Pending Review)</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowAddChoiceModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Products</span>
            </button>

            <button
              type="button"
              onClick={handleVendorSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Tab Navigation Bar (Mobile Scrollable & Compact) */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 border-t border-zinc-100 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "inventory"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Inventory</span>
              <span className="hidden sm:inline">Inventory & Stock</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 font-bold">
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "orders"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Orders</span>
              <span className="hidden sm:inline">Store Orders & Dispatch</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700 font-bold">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("payouts")}
              className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "payouts"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Payouts</span>
              <span className="hidden sm:inline">MoMo Payouts & 48h Escrow</span>
              {escrowSummary?.inEscrowAmount ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 font-bold">
                  {formatPrice(escrowSummary.inEscrowAmount, "GHS")}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "settings"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Settings</span>
              <span className="hidden sm:inline">Store Profile & Settings</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Global Notices */}
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

        {/* Guided Staging Alert Banner (when Pending) */}
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
                      Catalog Staged Offline
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed max-w-3xl">
                    Your merchant application is currently pending admin verification. <strong>Under our Guided Staging policy, your public store page and catalog are safely hidden from shoppers</strong> to ensure buyer safety while you prepare your store.
                  </p>
                  <p className="text-xs text-amber-800/90 font-medium">
                    ✨ <strong>You have full operational access:</strong> Add products, test dispatch workflows, and configure MoMo payout lines below. The moment an admin approves your account on the Admin Portal, your storefront and staged products will automatically go live!
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: INVENTORY & STOCK                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Total Products
                  </span>
                  <Package className="h-4 w-4 text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-zinc-900">{stats?.totalProducts ?? products.length}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {vendor?.status === "PENDING_APPROVAL" ? "Staged (Goes live upon approval)" : "Active in marketplace"}
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
                <p className="mt-1 text-xs text-zinc-400">Available for customer checkout</p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Low Stock Alerts
                  </span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-amber-600">{stats?.lowStock ?? 0}</p>
                <p className="mt-1 text-xs text-zinc-400">Items with ≤ 3 units remaining</p>
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

            {/* Products Card Container with Search, Filters, Desktop Table & Mobile Cards */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              {/* Header Action Bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 px-4 sm:px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Store Inventory & Real-Time Stock</h2>
                  <p className="text-xs text-zinc-500">
                    Protected by Optimistic Concurrency Control (OCC) to prevent lost updates across multiple store managers.
                  </p>
                </div>

                {/* Desktop Quick Actions */}
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={handleManualRefresh}
                    disabled={isDataLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition"
                    title="Refresh inventory"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isDataLoading ? "animate-spin text-purple-600" : ""}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={() => setShowSyncModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-xs"
                    title="Sync catalog with your WooCommerce store"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Sync Store</span>
                  </button>

                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
                    title="Bulk upload products via CSV/Excel"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Bulk CSV</span>
                  </button>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Single</span>
                  </button>
                </div>

                {/* Mobile Single Action Button (Uncongested & Thumb-Friendly) */}
                <div className="flex sm:hidden items-center justify-between gap-2">
                  <button
                    onClick={handleManualRefresh}
                    disabled={isDataLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isDataLoading ? "animate-spin text-purple-600" : ""}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={() => setShowAddChoiceModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 active:scale-[0.98] transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Add Products</span>
                  </button>
                </div>
              </div>

              {/* Search & Stock Filter Toolbar */}
              <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search by name or description..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-8 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-purple-600 focus:outline-none"
                    />
                    {productSearch && (
                      <button
                        onClick={() => setProductSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Stock Filter Chips (Scrollable on small screens) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    {[
                      { key: "ALL", label: "All Items", count: products.length },
                      { key: "IN_STOCK", label: "In Stock", count: products.filter((p) => p.stockStatus === "IN_STOCK").length },
                      { key: "LOW_STOCK", label: "Low Stock", count: products.filter((p) => p.stockStatus === "LOW_STOCK").length },
                      { key: "OUT_OF_STOCK", label: "Out of Stock", count: products.filter((p) => p.stockStatus === "OUT_OF_STOCK").length },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setProductStockFilter(tab.key as any)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                          productStockFilter === tab.key
                            ? "bg-purple-600 text-white shadow-xs font-semibold"
                            : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        {tab.label}
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          productStockFilter === tab.key ? "bg-purple-700/60 text-white" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Status Line */}
                {(productSearch || productStockFilter !== "ALL") && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span>
                      Showing {filteredProducts.length} of {products.length} products
                    </span>
                    <button
                      onClick={() => {
                        setProductSearch("");
                        setProductStockFilter("ALL");
                      }}
                      className="text-purple-600 hover:text-purple-800 font-semibold"
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>

              {/* DESKTOP VIEW: Detailed OCC Table (Hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
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
                    {isDataLoading && products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                          Loading merchant inventory...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                          {products.length === 0 ? (
                            <div className="space-y-3">
                              <Package className="mx-auto h-8 w-8 text-zinc-300" />
                              <p className="font-semibold text-zinc-700">Your store catalog is empty</p>
                              <p className="text-xs text-zinc-400">Choose a method above to add your first products!</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium text-zinc-700">No products match your current search or filter.</p>
                              <button
                                onClick={() => {
                                  setProductSearch("");
                                  setProductStockFilter("ALL");
                                }}
                                className="mt-2 text-xs font-semibold text-purple-600 hover:underline"
                              >
                                Clear search & filters
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => {
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
                                <div className="min-w-0 max-w-xs">
                                  <p className="font-semibold text-zinc-900 truncate">{prod.name}</p>
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
                                className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
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
                                    disabled={isSavingProduct}
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
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => startEditing(prod)}
                                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition"
                                  >
                                    Edit Stock / Price
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(prod)}
                                    className="rounded-lg border border-red-200 p-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                                    title="Delete product"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW: Uncongested Touch-Friendly Product Cards (Shown on mobile < md) */}
              <div className="block md:hidden divide-y divide-zinc-100">
                {isDataLoading && products.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 text-xs">
                    Loading merchant inventory...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center">
                    {products.length === 0 ? (
                      <div className="space-y-3">
                        <Package className="mx-auto h-10 w-10 text-zinc-300" />
                        <h4 className="font-bold text-zinc-800 text-sm">No Products In Store</h4>
                        <p className="text-xs text-zinc-500">Tap "+ Add Products" above to stock your store catalog.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-zinc-600">No products match your search or filter.</p>
                        <button
                          onClick={() => {
                            setProductSearch("");
                            setProductStockFilter("ALL");
                          }}
                          className="text-xs font-bold text-purple-600 hover:underline"
                        >
                          Clear search & filters
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const isEditing = editingId === prod.id;
                    const primaryImg = prod.images?.[0]?.url;

                    return (
                      <div key={prod.id} className="p-4 space-y-3 bg-white">
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center font-bold text-zinc-400 text-sm">
                            {primaryImg ? (
                              <img src={primaryImg} alt={prod.name} className="h-full w-full object-cover" />
                            ) : (
                              prod.name.charAt(0)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-zinc-900 text-sm leading-tight truncate">{prod.name}</h3>
                              <span className="shrink-0 text-[10px] font-mono font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                v{prod.version}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{prod.description}</p>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-base font-bold text-zinc-900">
                                {formatPrice(Number(prod.price), "GHS")}
                              </span>
                              <span className="text-xs text-zinc-500">
                                • {prod.stockQty !== null ? `${prod.stockQty} in stock` : "Unlimited"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Visibility Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              prod.stockStatus === "IN_STOCK"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : prod.stockStatus === "LOW_STOCK"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {prod.stockStatus.replace("_", " ")}
                          </span>

                          {vendor?.status === "PENDING_APPROVAL" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                              <EyeOff className="h-3 w-3 text-amber-600" />
                              <span>Staged (Offline)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                              <Eye className="h-3 w-3 text-emerald-600" />
                              <span>Live</span>
                            </span>
                          )}
                        </div>

                        {/* In-place OCC Edit Drawer */}
                        {isEditing ? (
                          <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-3">
                            <p className="text-xs font-semibold text-purple-900">Update Stock & Price (OCC Protected)</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">Price (GHS)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-zinc-900 focus:border-purple-600 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">Stock Qty</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={editStock}
                                  onChange={(e) => setEditStock(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-zinc-900 focus:border-purple-600 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveProductChanges(prod)}
                                disabled={isSavingProduct}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Save className="h-3.5 w-3.5" />
                                <span>{isSavingProduct ? "Saving..." : "Save"}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                            <button
                              onClick={() => startEditing(prod)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 transition min-h-[38px]"
                            >
                              <span>Edit Stock / Price</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition min-h-[38px]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: STORE ORDERS & DISPATCH                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Orders Header & Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Customer Orders & Dispatch Pipeline</h2>
                <p className="text-xs text-zinc-500">
                  Partitioned sub-orders assigned to your store. Manage packaging, rider dispatch, and delivery confirmation.
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {(["ALL", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setSelectedOrderStatus(st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        selectedOrderStatus === st
                          ? "bg-purple-600 text-white shadow-xs"
                          : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {st === "ALL" ? "All Orders" : st}
                    </button>
                  )
                )}
                <button
                  onClick={handleManualRefresh}
                  disabled={isDataLoading}
                  className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50"
                  title="Refresh orders"
                >
                  <RefreshCw className={`h-4 w-4 ${isDataLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Orders Cards List */}
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-zinc-400" />
                <h3 className="mt-3 text-base font-bold text-zinc-900">No Orders Found</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedOrderStatus === "ALL"
                    ? "Your store has not received any customer orders yet."
                    : `No orders found with status '${selectedOrderStatus}'.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((vo) => {
                  const isUpdating = updatingOrderId === vo.id;
                  const addr = vo.order.shippingAddress || {};
                  const isCleared = vo.clearedAt && new Date(vo.clearedAt) <= new Date();

                  return (
                    <div
                      key={vo.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4 transition hover:border-zinc-300"
                    >
                      {/* Sub-order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-4 gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-zinc-900">
                                Order {vo.order.number}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  vo.status === "DELIVERED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : vo.status === "SHIPPED"
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : vo.status === "PROCESSING"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : vo.status === "PENDING"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {vo.status}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              <span>Placed {new Date(vo.createdAt).toLocaleString()}</span>
                            </p>
                          </div>
                        </div>

                        {/* Financial Net Split Pill */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              Your Net Earnings (90%)
                            </span>
                            <span className="text-base font-extrabold text-emerald-600">
                              {formatPrice(Number(vo.vendorEarnings), "GHS")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle Details Grid: Customer & Delivery Address */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-zinc-50/70 rounded-xl p-4 border border-zinc-100">
                        <div>
                          <p className="font-bold text-zinc-900 flex items-center gap-1.5 mb-1.5">
                            <User className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Customer Information</span>
                          </p>
                          <p className="text-zinc-700 font-medium">{vo.order.user?.name || addr.fullName || "Customer"}</p>
                          <p className="text-zinc-500">{vo.order.user?.email || addr.email || "No email"}</p>
                          <p className="text-zinc-500">{vo.order.user?.phone || addr.phone || "No phone"}</p>
                        </div>

                        <div>
                          <p className="font-bold text-zinc-900 flex items-center gap-1.5 mb-1.5">
                            <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Delivery Destination</span>
                          </p>
                          <p className="text-zinc-700">{addr.street || "Delivery address specified"}</p>
                          <p className="text-zinc-500">{[addr.city, addr.region, "Ghana"].filter(Boolean).join(", ")}</p>
                        </div>
                      </div>

                      {/* Items Purchased in this Sub-Order */}
                      <div>
                        <p className="text-xs font-bold text-zinc-800 mb-2">Items to Prepare & Dispatch:</p>
                        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 overflow-hidden">
                          {vo.order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-white text-xs">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 border border-zinc-200">
                                  {item.productImage ? (
                                    <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-zinc-400 font-bold">
                                      {item.productName.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">{item.productName}</p>
                                  <p className="text-zinc-500">
                                    Qty: <span className="font-bold text-zinc-800">{item.quantity}</span> × {formatPrice(Number(item.unitPrice), "GHS")}
                                  </p>
                                </div>
                              </div>
                              <span className="font-bold text-zinc-900">
                                {formatPrice(Number(item.subtotal), "GHS")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Footer: Commission & Dispatch Status Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-zinc-100 gap-3">
                        <div className="text-xs text-zinc-500 space-y-0.5">
                          <p>
                            Subtotal: <span className="font-semibold text-zinc-800">{formatPrice(Number(vo.subtotal), "GHS")}</span> • Platform Commission (10%):{" "}
                            <span className="text-red-500 font-semibold">-{formatPrice(Number(vo.commissionAmount), "GHS")}</span>
                          </p>
                          {vo.notes && (
                            <p className="text-zinc-600 italic">
                              Note: "{vo.notes}"
                            </p>
                          )}
                        </div>

                        {/* Dispatch Action Buttons */}
                        <div className="flex items-center gap-2">
                          {vo.status === "PENDING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(vo.id, "PROCESSING", "Order accepted by merchant kitchen")}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Accept & Prepare</span>
                            </button>
                          )}

                          {vo.status === "PROCESSING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(vo.id, "SHIPPED", "Dispatched with courier")}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              <span>Dispatch & Ship Order</span>
                            </button>
                          )}

                          {vo.status === "SHIPPED" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(vo.id, "DELIVERED", "Confirmed delivered to customer")}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Confirm Delivery (Start 48h Escrow)</span>
                            </button>
                          )}

                          {vo.status === "DELIVERED" && (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                              <Clock className="h-3.5 w-3.5 text-emerald-600" />
                              <span>
                                {isCleared
                                  ? "48h Escrow Cleared • Ready for MoMo Payout"
                                  : `In 48h Escrow (Clears ${vo.clearedAt ? new Date(vo.clearedAt).toLocaleDateString() : "in 48h"})`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: MOMO PAYOUTS & 48H ESCROW                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "payouts" && (
          <div className="space-y-6">
            {/* Escrow & Earnings Breakdown Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Lifetime Net Earnings
                  </span>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-zinc-900">
                  {formatPrice(escrowSummary?.lifetimeNetEarnings ?? 0, "GHS")}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Total 90% revenue across all completed orders</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    In 48h Escrow Protection
                  </span>
                  <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-amber-900">
                  {formatPrice(escrowSummary?.inEscrowAmount ?? 0, "GHS")}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {escrowSummary?.inEscrowOrdersCount ?? 0} orders in delivery verification window
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Available for Payout
                  </span>
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                  {formatPrice(escrowSummary?.availableForPayoutAmount ?? 0, "GHS")}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  Cleared funds ready for next MoMo settlement cycle
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Total Disbursed via MoMo
                  </span>
                  <Smartphone className="h-4 w-4 text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-zinc-900">
                  {formatPrice(escrowSummary?.totalPaidOut ?? 0, "GHS")}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Paid directly to {vendor?.momoNetwork || "MTN"} {vendor?.momoNumber || ""}
                </p>
              </div>
            </div>

            {/* Educational Escrow Architecture Banner */}
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-purple-50 p-6 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-sm">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">
                      How Nextdor's 48-Hour Escrow Settlement Protection Works
                    </h3>
                    <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                      To protect both Ghanaian buyers and marketplace sellers, customer payments are held in an automated escrow account when an order is placed. Here is how your money moves:
                    </p>
                  </div>

                  {/* 3-Step Flow Diagram */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Step 1</span>
                      <p className="font-semibold text-xs text-zinc-900 mt-1">Delivery Confirmation</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        You dispatch and deliver the item. Marking the order as DELIVERED initiates the 48-hour escrow safety clock.
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Step 2</span>
                      <p className="font-semibold text-xs text-amber-950 mt-1">48-Hour Inspection Window</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        The shopper has 48 hours to inspect goods. This completely prevents fraudulent chargebacks and builds buyer trust.
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Step 3</span>
                      <p className="font-semibold text-xs text-emerald-950 mt-1">Automated MoMo Disbursement</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        After 48 hours pass, funds unlock automatically and are transferred directly to your Mobile Money account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payouts Ledger Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">Mobile Money Settlement History</h3>
                  <p className="text-xs text-zinc-500">Record of electronic transfers sent to your registered Mobile Money wallet.</p>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={isDataLoading}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isDataLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50 text-xs font-semibold text-zinc-500">
                      <th className="px-6 py-3.5">Disbursement Date</th>
                      <th className="px-6 py-3.5">Net Amount (GHS)</th>
                      <th className="px-6 py-3.5">MoMo Destination</th>
                      <th className="px-6 py-3.5">Settlement Status</th>
                      <th className="px-6 py-3.5">Transfer Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-xs">
                          No mobile money payouts have been disbursed yet. Delivered orders will appear here once their 48-hour escrow clears!
                        </td>
                      </tr>
                    ) : (
                      payouts.map((po) => (
                        <tr key={po.id} className="hover:bg-zinc-50/70 transition">
                          <td className="px-6 py-4 text-xs font-medium text-zinc-700">
                            {new Date(po.paidAt || po.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600">
                            {formatPrice(Number(po.amount), "GHS")}
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-700">
                            <span className="font-semibold text-zinc-900">{vendor.momoNetwork || "MTN"}</span> • {vendor.momoNumber || "Registered line"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                po.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : po.status === "PROCESSING"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                            {po.paystackTransferRef || "Automated Escrow Clearance"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: STORE PROFILE & SETTINGS                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="max-w-4xl space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="border-b border-zinc-100 pb-4 mb-6">
                <h2 className="text-base font-bold text-zinc-900">Store Profile & Payout Settings</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Manage your public storefront branding, contact details, and Mobile Money payout lines.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* 1. Store Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    <span>Store Identity</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Store Display Name *</label>
                      <input
                        type="text"
                        required
                        value={settingName}
                        onChange={(e) => setSettingName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Business Phone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+233241234567"
                        value={settingPhone}
                        onChange={(e) => setSettingPhone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Store Bio / Description</label>
                    <textarea
                      rows={3}
                      placeholder="Tell customers about your products, specialties, and location..."
                      value={settingDesc}
                      onChange={(e) => setSettingDesc(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Mobile Money Settlement */}
                <div className="space-y-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4" />
                    <span>Mobile Money Settlement Account</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Mobile Money Network *</label>
                      <select
                        value={settingMomoNet}
                        onChange={(e) => setSettingMomoNet(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none bg-white"
                      >
                        <option value="MTN">MTN Mobile Money (MoMo)</option>
                        <option value="TELECEL">Telecel Cash (formerly Vodafone)</option>
                        <option value="AT">AT Money (AirtelTigo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">MoMo Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="0241234567"
                        value={settingMomoNum}
                        onChange={(e) => setSettingMomoNum(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 italic">
                    Note: Cleared escrow funds will be disbursed automatically to this registered Ghanaian Mobile Money wallet.
                  </p>
                </div>

                {/* 3. Visual Assets (Logo & Banner) */}
                <div className="space-y-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    <span>Visual Assets & Storefront Branding</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Store Logo Image URL</label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={settingLogo}
                        onChange={(e) => setSettingLogo(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                      />
                      {settingLogo && (
                        <div className="mt-2 flex items-center gap-2">
                          <img
                            src={settingLogo}
                            alt="Logo preview"
                            className="h-12 w-12 rounded-xl object-cover border border-zinc-200"
                          />
                          <span className="text-[11px] text-zinc-500">Logo preview</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Storefront Banner URL</label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={settingBanner}
                        onChange={(e) => setSettingBanner(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-purple-600 focus:outline-none"
                      />
                      {settingBanner && (
                        <div className="mt-2">
                          <img
                            src={settingBanner}
                            alt="Banner preview"
                            className="h-16 w-full rounded-xl object-cover border border-zinc-200"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Commission Platform Rate Info */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-zinc-900">Nextdor Marketplace Commission:</span>{" "}
                    Standard {vendor.commissionRate || 10}% fee deducted only upon successful customer checkout.
                  </div>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                    {vendor.commissionRate || 10}% Fixed
                  </span>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end pt-4 border-t border-zinc-100">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSavingSettings ? "Saving Settings..." : "Save Store Settings"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
                  <strong>Staging Mode Active:</strong> This product will be saved to your store catalog immediately, but will remain safely hidden from the public marketplace until your merchant application is approved by an administrator.
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

              <ImageUpload
                value={newProdImage}
                onChange={setNewProdImage}
                label="Product Photo"
                folder="nextdor/products"
                disabled={isCreatingProduct}
              />

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
                  disabled={isCreatingProduct}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isCreatingProduct ? "Publishing..." : "Publish Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Choice Modal for Adding Products (Mobile-First Sheet / Modal) */}
      {showAddChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Add Products to Store</h3>
                <p className="text-xs text-zinc-500">Select how you want to add or sync your inventory</p>
              </div>
              <button
                onClick={() => setShowAddChoiceModal(false)}
                className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 text-sm font-semibold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Single Product */}
              <button
                type="button"
                onClick={() => {
                  setShowAddChoiceModal(false);
                  setShowAddModal(true);
                }}
                className="w-full group flex items-start gap-4 rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-purple-500 hover:bg-purple-50/50 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-900 group-hover:text-purple-900">
                      Single Product Entry
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                      1-5 items
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    Manually enter product name, custom price, stock count, and upload photos one by one.
                  </p>
                </div>
              </button>

              {/* Option 2: Bulk CSV Upload */}
              <button
                type="button"
                onClick={() => {
                  setShowAddChoiceModal(false);
                  setShowBulkModal(true);
                }}
                className="w-full group flex items-start gap-4 rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-900 group-hover:text-emerald-900">
                      Bulk CSV / Excel Upload
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      10 - 1,000+ items
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    Download our ready-made CSV template, fill in your product list, and upload with instant validation.
                  </p>
                </div>
              </button>

              {/* Option 3: WooCommerce Sync */}
              <button
                type="button"
                onClick={() => {
                  setShowAddChoiceModal(false);
                  setShowSyncModal(true);
                }}
                className="w-full group flex items-start gap-4 rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-900 group-hover:text-blue-900">
                      WooCommerce Store Sync
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                      Automated Sync
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    Connect your existing WordPress store using API keys to sync products, categories, and stock automatically.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAddChoiceModal(false)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV / Excel Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={(count) => {
          setSuccessNotice(`Successfully imported ${count} products into your store!`);
          vendorPortalCache.invalidateAll();
          loadVendorData(true);
        }}
        authToken={getValidToken() || ""}
      />

      {/* WooCommerce Store Sync Modal */}
      <StoreSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        authToken={getValidToken() || ""}
        onSyncComplete={() => {
          vendorPortalCache.invalidateAll();
          loadVendorData(true);
        }}
      />

      {/* Merchant Back-Office Footer */}
      <footer className="mt-16 border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Nextdor Merchant Portal • Dedicated Seller Console</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-purple-600 transition">
              Customer Storefront
            </Link>
            <Link href="/contact" className="hover:text-purple-600 transition">
              Merchant Support
            </Link>
            <Link href="/vendor/register" className="hover:text-purple-600 transition">
              Merchant Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
