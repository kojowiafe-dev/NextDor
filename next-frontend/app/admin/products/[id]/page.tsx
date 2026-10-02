"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api-config";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [product, setProduct] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      if (!params.id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/products/${params.id}`);
        if (res.ok) {
          const json = await res.json();
          const p = json.data?.product;
          if (p && isMounted) {
            setProduct({
              id: p.id,
              name: p.name,
              category: p.categories?.[0]?.name || p.categories?.[0]?.slug || "General",
              price: Number(p.price || 0),
              salePrice: p.salePrice ? Number(p.salePrice) : undefined,
              currency: p.currency || "GHS",
              stock: p.stockStatus?.toLowerCase() || "in_stock",
              image: p.images?.[0]?.url || "",
              description: p.description || "",
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch product:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [params.id]);

  if (isLoading) {
    return (
      <AdminLayout title="Edit Product">
        <div className="flex h-48 items-center justify-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#ff9900]" />
          <span>Loading product...</span>
        </div>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout title="Product Not Found">
        <p className="text-zinc-500">Product with identifier &quot;{params.id}&quot; was not found.</p>
        <Link href="/admin/products" className="mt-4 inline-flex items-center gap-1 text-sm text-[#007185] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </AdminLayout>
    );
  }

  async function handleSave(data: any) {
    if (!token) throw new Error("Authentication required");

    const res = await fetch(`${API_BASE}/products/${product.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        price: Number(data.price),
        salePrice: data.salePrice ? Number(data.salePrice) : null,
        currency: data.currency,
        stockStatus: (data.stock || "in_stock").toUpperCase(),
        category: data.category,
        image: data.image,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to update product");
    }
  }

  return (
    <ProductForm
      title={`Edit: ${product.name}`}
      initial={{
        name: product.name,
        category: product.category,
        price: product.price,
        salePrice: product.salePrice,
        currency: product.currency,
        stock: product.stock,
        image: product.image,
        description: product.description,
      }}
      onSave={handleSave}
    />
  );
}
