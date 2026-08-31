"use client";

import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  async function handleSave(data: Parameters<typeof ProductForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) {
    // TODO: POST to /api/admin/products when backend is ready
    await new Promise((r) => setTimeout(r, 700));
    console.log("New product:", data);
  }

  return <ProductForm title="Add Product" onSave={handleSave} />;
}
