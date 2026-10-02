import Link from "next/link";
import { notFound } from "next/navigation";
import { Store, CheckCircle, MapPin, Phone, Mail, ArrowLeft, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface VendorDetails {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: string;
  _count: { products: number };
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  salePrice?: string | number | null;
  currency: string;
  stockStatus: string;
  images?: { id: string; url: string; alt?: string }[];
  categories?: { id: string; name: string; slug: string }[];
}
import { API_BASE } from "@/lib/api-config";

async function getVendorData(slug: string): Promise<{ vendor: VendorDetails; products: ProductItem[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/vendors/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data) return null;
    return {
      vendor: json.data.vendor,
      products: json.data.catalog?.products || [],
    };
  } catch (err) {
    console.error("Failed to fetch vendor storefront data:", err);
    return null;
  }
}

export default async function VendorStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getVendorData(slug);

  if (!data) {
    notFound();
  }

  const { vendor, products } = data;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Top Breadcrumb */}
      <div className="bg-white border-b border-zinc-200">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Marketplace Products</span>
          </Link>
        </div>
      </div>

      {/* Merchant Hero Banner */}
      <div className="relative border-b border-zinc-200 bg-white">
        <div className="h-44 w-full bg-gradient-to-r from-purple-800 via-indigo-800 to-zinc-900 object-cover" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 flex flex-col items-start gap-4 pb-6 sm:flex-row sm:items-end sm:gap-6">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden font-bold text-2xl text-purple-700">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-12 w-12 text-purple-600" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">
                  {vendor.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Verified Merchant</span>
                </span>
              </div>

              <p className="mt-1.5 max-w-3xl text-sm text-zinc-600">
                {vendor.description || "Official seller store on Nextdor Ghana Marketplace."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                {vendor.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-zinc-400" />
                    {vendor.phone}
                  </span>
                )}
                {vendor.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-zinc-400" />
                    {vendor.email}
                  </span>
                )}
                <span className="flex items-center gap-1 font-semibold text-purple-700">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {products.length} {products.length === 1 ? "Product" : "Products"} in Store
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merchant Products Catalog */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Products from {vendor.name}</h2>
            <p className="text-xs text-zinc-500">
              Direct from the vendor • Protected by Nextdor 48-Hour Buyer Protection
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500">
            <ShoppingBag className="mx-auto h-12 w-12 text-zinc-300" />
            <p className="mt-3 font-semibold text-zinc-800">No active products currently listed.</p>
            <p className="text-xs text-zinc-400">Check back soon for new arrivals from this store!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((prod) => {
              const primaryImg = prod.images?.[0]?.url;
              return (
                <div
                  key={prod.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md hover:border-purple-200"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                    {primaryImg ? (
                      <img
                        src={primaryImg}
                        alt={prod.name}
                        className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-zinc-300 text-3xl">
                        {prod.name.charAt(0)}
                      </div>
                    )}
                    {prod.salePrice && (
                      <span className="absolute top-2.5 left-2.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                        SALE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-xs font-semibold text-purple-600">
                      {prod.categories?.[0]?.name || "Catalog"}
                    </p>
                    <h3 className="mt-1 font-bold text-zinc-900 line-clamp-1 group-hover:text-purple-600 transition">
                      <Link href={`/product/${prod.slug}`}>{prod.name}</Link>
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{prod.description}</p>

                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <div>
                        <span className="text-base font-extrabold text-zinc-900">
                          {formatPrice(Number(prod.salePrice ?? prod.price), prod.currency || "GHS")}
                        </span>
                        {prod.salePrice && (
                          <span className="ml-2 text-xs text-zinc-400 line-through">
                            {formatPrice(Number(prod.price), prod.currency || "GHS")}
                          </span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          prod.stockStatus === "IN_STOCK"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {prod.stockStatus === "IN_STOCK" ? "In Stock" : "Sold Out"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
