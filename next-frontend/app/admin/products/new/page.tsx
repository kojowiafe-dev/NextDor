"use client";

import { ProductForm } from "@/components/admin/ProductForm";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api-config";
import { invalidateProductsCache } from "@/lib/cache/adminCache";

export default function NewProductPage() {
  const { token } = useAuth();

  async function handleSave(data: any) {
    const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("nextdor-token") : null);
    if (!activeToken) {
      throw new Error("Authentication required. Please sign in as an administrator.");
    }

    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        price: Number(data.price),
        salePrice: data.salePrice ? Number(data.salePrice) : null,
        currency: data.currency || "GHS",
        stockStatus: (data.stock || "in_stock").toUpperCase(),
        category: data.category,
        image: data.image,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || "Failed to create product");
    }

    // Invalidate local client cache so admin products table fetches fresh data immediately
    invalidateProductsCache();
  }

  return <ProductForm title="Add Product" onSave={handleSave} />;
}
