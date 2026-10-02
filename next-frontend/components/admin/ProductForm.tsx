"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthFormField } from "@/components/account/AuthFormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { API_BASE } from "@/lib/api-config";
import type { AdminProduct } from "@/lib/admin/mockData";

type ProductFormData = Omit<AdminProduct, "id" | "slug">;

const CATEGORIES = [
  "Electronics", "Laptops", "Beauty & Personal Care", "Bakery", "Fashion", "Home & Kitchen",
];

const EMPTY_FORM: ProductFormData = {
  name: "", category: "", price: 0, currency: "GHS",
  salePrice: undefined, stock: "in_stock", image: "", description: "",
};

type ProductFormProps = {
  initial?: Partial<ProductFormData>;
  onSave: (data: ProductFormData) => Promise<void>;
  title: string;
};

export function ProductForm({ initial, onSave, title }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE}/products/categories`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            const names = json.data.map((c: any) => c.name).filter(Boolean);
            const combined = Array.from(new Set([...CATEGORIES, ...names]));
            setCategories(combined);
          }
        }
      } catch {
        // fallback to default categories
      }
    }
    loadCategories();
  }, []);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  }

  function validate() {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Product name is required.";
    if (!form.category) errs.category = "Category is required.";
    if (!form.price || form.price <= 0) errs.price = "Price must be greater than 0.";
    if (!form.description.trim()) errs.description = "Description is required.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    setSaved(false);
    setServerError(null);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => router.push("/admin/products"), 1000);
    } catch (err: any) {
      setServerError(err?.message || "Failed to save product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout title={title}>
      <div className="mb-4">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Products
        </Link>
      </div>

      {serverError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {serverError}
        </div>
      )}

      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle className="h-5 w-5 shrink-0" />
          Product saved! Redirecting...
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main fields */}
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
              <h2 className="mb-4 font-semibold text-zinc-900">Product Details</h2>
              <div className="space-y-4">
                <AuthFormField
                  label="Product name"
                  id="prod-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  error={errors.name}
                  placeholder="e.g. Samsung 4K Smart TV 43&quot;"
                  required
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={4}
                    placeholder="Brief product description..."
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 resize-none ${
                      errors.description ? "border-red-400 bg-red-50" : "border-zinc-300"
                    }`}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-600">{errors.description}</p>
                  )}
                </div>
                <ImageUpload
                  label="Product Image"
                  value={form.image}
                  onChange={(url) => set("image", url)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Sidebar fields */}
          <div className="space-y-5">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
              <h2 className="mb-4 font-semibold text-zinc-900">Pricing</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">
                    Price (GHS) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price || ""}
                    onChange={(e) => set("price", Number(e.target.value))}
                    placeholder="0.00"
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                      errors.price ? "border-red-400 bg-red-50" : "border-zinc-300"
                    }`}
                  />
                  {errors.price && <p className="text-xs text-red-600">{errors.price}</p>}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Sale Price (GHS)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.salePrice ?? ""}
                    onChange={(e) => set("salePrice", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Leave blank if no sale"
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
              <h2 className="mb-4 font-semibold text-zinc-900">Organisation</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
                      errors.category ? "border-red-400 bg-red-50" : "border-zinc-300"
                    }`}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-700">Stock Status</label>
                  <select
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value as AdminProduct["stock"])}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-6 py-3 font-semibold text-zinc-900 hover:bg-[#f08804] disabled:opacity-70"
            >
              {isSaving && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {isSaving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
