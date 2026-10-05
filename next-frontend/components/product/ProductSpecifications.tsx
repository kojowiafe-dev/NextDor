import type { Product } from "@/lib/catalog/types";
import { Shield, RefreshCw, PackageCheck, Award, Tag } from "lucide-react";

type ProductSpecificationsProps = {
  product: Product;
};

export function ProductSpecifications({ product }: ProductSpecificationsProps) {
  // Generate human-friendly unique SKU if not provided directly
  const sku = `ND-${product.id.slice(0, 8).toUpperCase()}`;
  const categoryNames = product.categories.map((c) => c.name).join(", ") || "General Catalog";

  const specs = [
    { label: "SKU / Product ID", value: sku, icon: Tag },
    { label: "Category", value: categoryNames, icon: PackageCheck },
    { label: "Stock Availability", value: product.inStock ? "In Stock (Available for Instant Dispatch)" : "Currently Out of Stock", icon: PackageCheck },
    { label: "Condition", value: "100% Brand New & Factory Sealed", icon: Award },
    { label: "Warranty & Guarantee", value: "12 Months Manufacturer Warranty / NextDor 48h Escrow Guarantee", icon: Shield },
    { label: "Return Policy", value: "7-Day Hassle-Free Returns for Eligible Items", icon: RefreshCw },
    { label: "Delivery Method", value: "Courier Doorstep Delivery & Hub Pickup in Ghana", icon: PackageCheck },
  ];

  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow-sm border border-zinc-100">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
        <h2 className="text-lg font-bold text-zinc-900">
          Product Specifications & Guarantees
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
          SKU: {sku}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {specs.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#ff9900] shadow-2xs border border-zinc-100">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-zinc-900 break-words">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
