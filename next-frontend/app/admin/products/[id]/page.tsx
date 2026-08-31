"use client";

import { useParams } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { MOCK_PRODUCTS } from "@/lib/admin/mockData";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = MOCK_PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return (
      <AdminLayout title="Product Not Found">
        <p className="text-zinc-500">No product with ID {id}.</p>
        <Link href="/admin/products" className="mt-4 inline-flex items-center gap-1 text-sm text-[#007185] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </AdminLayout>
    );
  }

  async function handleSave(data: Parameters<typeof ProductForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) {
    // TODO: PATCH to /api/admin/products/:id when backend is ready
    await new Promise((r) => setTimeout(r, 700));
    console.log("Updated product:", id, data);
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
