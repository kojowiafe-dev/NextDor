"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  UploadCloud,
  Sparkles,
  ExternalLink,
  Search,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { API_BASE } from "@/lib/api-config";

interface BannerProductSummary {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  salePrice?: string | number | null;
  images?: { url: string }[];
}

interface AccentCardInput {
  label: string;
  image: string;
  href: string;
}

interface HeroBannerItem {
  id: string;
  badge: string;
  subtitle: string;
  bgImageUrl: string;
  ctaText: string;
  ctaHref: string;
  secondaryText?: string | null;
  secondaryHref?: string | null;
  productId?: string | null;
  product?: BannerProductSummary | null;
  accentCards?: AccentCardInput[] | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM = {
  badge: "Featured Showcase",
  subtitle: "",
  bgImageUrl: "",
  ctaText: "Shop Now",
  ctaHref: "/shop",
  secondaryText: "View Deals",
  secondaryHref: "/deals",
  productId: "",
  accentCards: [
    { label: "", image: "", href: "" },
    { label: "", image: "", href: "" },
  ] as AccentCardInput[],
  sortOrder: 0,
  isActive: true,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HeroBannerItem[]>([]);
  const [products, setProducts] = useState<BannerProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [productSearch, setProductSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("nextdor-token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [bannersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/banners/admin`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${API_BASE}/products?limit=100`, { cache: "no-store" }),
      ]);

      if (bannersRes.ok) {
        const bj = await bannersRes.json();
        if (bj.success && Array.isArray(bj.data?.banners)) {
          setBanners(bj.data.banners);
        }
      }
      if (productsRes.ok) {
        const pj = await productsRes.json();
        if (pj.success && Array.isArray(pj.data?.products)) {
          setProducts(pj.data.products);
        }
      }
    } catch {
      setNotice({ type: "error", message: "Could not load banners from backend." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.productId) || null,
    [products, form.productId]
  );

  function openCreateModal() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: banners.length });
    setProductSearch("");
    setShowModal(true);
  }

  function openEditModal(b: HeroBannerItem) {
    setEditingId(b.id);
    const existingCards = Array.isArray(b.accentCards) ? b.accentCards : [];
    setForm({
      badge: b.badge || "Featured",
      subtitle: b.subtitle || "",
      bgImageUrl: b.bgImageUrl || "",
      ctaText: b.ctaText || "Shop Now",
      ctaHref: b.ctaHref || "/shop",
      secondaryText: b.secondaryText || "View Deals",
      secondaryHref: b.secondaryHref || "/deals",
      productId: b.productId || "",
      accentCards: [
        existingCards[0] || { label: "", image: "", href: "" },
        existingCards[1] || { label: "", image: "", href: "" },
      ],
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive,
    });
    setProductSearch("");
    setShowModal(true);
  }

  function handleAccentCardProduct(cardIndex: number, productId: string) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setForm((prev) => {
      const nextCards = [...prev.accentCards];
      nextCards[cardIndex] = {
        label: prod.name,
        image: prod.images?.[0]?.url || prev.bgImageUrl || "",
        href: `/product/${prod.slug}`,
      };
      return { ...prev, accentCards: nextCards };
    });
  }

  function updateAccentCardField(cardIndex: number, field: keyof AccentCardInput, value: string) {
    setForm((prev) => {
      const nextCards = [...prev.accentCards];
      nextCards[cardIndex] = { ...nextCards[cardIndex], [field]: value };
      return { ...prev, accentCards: nextCards };
    });
  }

  function handleSelectProduct(productId: string) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      setForm((prev) => ({ ...prev, productId: "" }));
      return;
    }
    const prodImage = prod.images?.[0]?.url || "";
    setForm((prev) => ({
      ...prev,
      productId: prod.id,
      ctaHref: `/product/${prod.slug}`,
      ctaText: prev.ctaText === "Shop Now" ? "Shop Product" : prev.ctaText,
      subtitle: prev.subtitle || `Check out ${prod.name} — available now with 48h Escrow protection.`,
      bgImageUrl: prev.bgImageUrl || prodImage,
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "nextdor/banners");

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setNotice({ type: "error", message: json.error || "Image upload failed." });
      } else {
        setForm((prev) => ({ ...prev, bgImageUrl: json.url }));
      }
    } catch {
      setNotice({ type: "error", message: "Image upload failed." });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subtitle.trim() || !form.bgImageUrl.trim()) {
      setNotice({ type: "error", message: "Banner image and subtitle are required." });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const url = editingId ? `${API_BASE}/banners/admin/${editingId}` : `${API_BASE}/banners/admin`;
      const method = editingId ? "PATCH" : "POST";

      const validAccentCards = form.accentCards.filter(
        (c) => c.label.trim() && c.image.trim() && c.href.trim()
      );

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...form,
          productId: form.productId || null,
          accentCards: validAccentCards.length > 0 ? validAccentCards : [],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setNotice({ type: "error", message: json.error?.message || "Failed to save banner." });
        return;
      }

      setShowModal(false);
      setNotice({
        type: "success",
        message: editingId ? "Hero banner updated!" : "Hero banner created and live on homepage!",
      });
      await loadData();
    } catch {
      setNotice({ type: "error", message: "Network error while saving banner." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(banner: HeroBannerItem) {
    try {
      const res = await fetch(`${API_BASE}/banners/admin/${banner.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) => (b.id === banner.id ? { ...b, isActive: !b.isActive } : b))
        );
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API_BASE}/banners/admin/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setBanners((prev) => prev.filter((b) => b.id !== id));
        setNotice({ type: "success", message: "Banner deleted." });
      }
    } catch {
      setNotice({ type: "error", message: "Could not delete banner." });
    }
  }

  return (
    <AdminLayout
      title="Hero Banners"
      actions={
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ff9900] px-4 py-2 text-xs sm:text-sm font-bold text-zinc-950 shadow-sm hover:bg-[#f08804] transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Banner</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Explainer Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-4 sm:p-5 text-white shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#ff9900] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>Homepage Showcase Control</span>
            </div>
            <p className="text-sm text-zinc-200">
              Create custom hero banners linked to specific products, or star any product on the{" "}
              <Link href="/admin/products" className="underline text-[#ff9900] font-semibold">
                Products page
              </Link>{" "}
              to feature it automatically.
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold text-white transition shrink-0 w-fit"
          >
            <span>Preview Storefront</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {notice && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3.5 text-sm font-medium ${
              notice.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        )}

        {/* Banner List */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-100">
            <ImageIcon className="mx-auto h-10 w-10 text-zinc-300" />
            <h3 className="mt-3 text-base font-bold text-zinc-900">No custom hero banners yet</h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
              Add a custom banner to showcase a featured product, seasonal sale, or brand campaign at the top of the homepage.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#ff9900] px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-[#f08804]"
            >
              <Plus className="h-4 w-4" />
              Create First Banner
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 flex flex-col"
              >
                <div className="relative h-44 bg-zinc-900">
                  <img
                    src={banner.bgImageUrl}
                    alt={banner.badge}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#ff9900] px-2.5 py-0.5 text-[11px] font-black uppercase text-zinc-950 shadow">
                      {banner.badge}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow ${
                        banner.isActive ? "bg-emerald-500 text-white" : "bg-zinc-700 text-zinc-200"
                      }`}
                    >
                      {banner.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 rounded-lg bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white">
                    Order #{banner.sortOrder}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 line-clamp-2">{banner.subtitle}</p>
                    {banner.product && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                        <Package className="h-3.5 w-3.5" />
                        <span>Showcasing: {banner.product.name}</span>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-zinc-400 truncate">
                      CTA: <span className="font-semibold text-zinc-600">{banner.ctaText}</span> → {banner.ctaHref}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                    >
                      {banner.isActive ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Activate</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(banner)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(banner.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                {editingId ? "Edit Hero Banner" : "Add Product / Promo Banner"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Optional Product Picker */}
              <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Link a Product to Showcase (Optional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Filter products by name..."
                    className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-[#ff9900] focus:outline-none"
                  />
                </div>
                <select
                  value={form.productId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-[#ff9900] focus:outline-none"
                >
                  <option value="">— No linked product (General promo banner) —</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedProduct && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Linked to <span className="font-bold">{selectedProduct.name}</span> (`/product/{selectedProduct.slug}`)
                  </p>
                )}
              </div>

              {/* Banner Background Image */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700">Banner Image URL *</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    required
                    value={form.bgImageUrl}
                    onChange={(e) => setForm((p) => ({ ...p, bgImageUrl: e.target.value }))}
                    placeholder="https://res.cloudinary.com/..."
                    className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 shrink-0">
                    <UploadCloud className="h-4 w-4 text-[#ff9900]" />
                    <span>{isUploading ? "Uploading..." : "Upload"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Badge Label</label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                    placeholder="Featured Showcase"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Subtitle / Description *</label>
                <textarea
                  rows={2}
                  required
                  value={form.subtitle}
                  onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="Short promotional copy shown on the banner..."
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={form.ctaText}
                    onChange={(e) => setForm((p) => ({ ...p, ctaText: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Button Link</label>
                  <input
                    type="text"
                    value={form.ctaHref}
                    onChange={(e) => setForm((p) => ({ ...p, ctaHref: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-[#ff9900] focus:outline-none"
                  />
                </div>
              </div>

              {/* 2 Overlay Cards on the Banner */}
              <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    2 Cards on the Banner (Optional)
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Customize the 2 small cards shown on the right/bottom of this banner slide.
                  </p>
                </div>
                {[0, 1].map((idx) => (
                  <div key={idx} className="rounded-lg bg-white p-3 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-700">Banner Card #{idx + 1}</span>
                      <select
                        value=""
                        onChange={(e) => handleAccentCardProduct(idx, e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 max-w-[200px]"
                      >
                        <option value="">Quick-fill from product...</option>
                        {filteredProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Pro Laptops)"
                        value={form.accentCards[idx]?.label || ""}
                        onChange={(e) => updateAccentCardField(idx, "label", e.target.value)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#ff9900] focus:outline-none"
                      />
                      <input
                        type="url"
                        placeholder="Image URL"
                        value={form.accentCards[idx]?.image || ""}
                        onChange={(e) => updateAccentCardField(idx, "image", e.target.value)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#ff9900] focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Link (e.g. /product/...)"
                        value={form.accentCards[idx]?.href || ""}
                        onChange={(e) => updateAccentCardField(idx, "href", e.target.value)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#ff9900] focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded accent-[#ff9900]"
                />
                <span>Active on homepage immediately</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="rounded-xl bg-[#ff9900] px-5 py-2 text-sm font-bold text-zinc-950 hover:bg-[#f08804] disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editingId ? "Save Changes" : "Publish Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

