import Link from "next/link";
import { CheckCircle, ShoppingBag, Home, Package } from "lucide-react";

type SuccessPageProps = {
  searchParams: Promise<{
    order?: string;
    total?: string;
    currency?: string;
  }>;
};

export const metadata = {
  title: "Order Confirmed",
};

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const orderNumber = params.order ?? "ND-XXXXX";
  const total = params.total ? Number(params.total) : null;
  const currency = params.currency ?? "GHS";

  // Format total
  let formattedTotal: string | null = null;
  if (total !== null) {
    formattedTotal = new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(total / 1);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {/* Success icon */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>

      <h1 className="text-3xl font-bold text-zinc-900">Order Confirmed!</h1>
      <p className="mt-3 text-zinc-500">
        Thank you for shopping with NextDor. Your order has been received and
        is being processed.
      </p>

      {/* Order card */}
      <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3e0]">
            <Package className="h-5 w-5 text-[#ff9900]" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Order number</p>
            <p className="font-mono text-lg font-bold text-zinc-900">{orderNumber}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Status</dt>
            <dd>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                Processing
              </span>
            </dd>
          </div>
          {formattedTotal && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Order total</dt>
              <dd className="font-semibold text-zinc-900">{formattedTotal}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">Estimated delivery</dt>
            <dd className="font-medium text-zinc-900">2 – 4 business days</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
          📧 A confirmation email with your order details and tracking link will be
          sent to you shortly.
        </div>
      </div>

      {/* What's next steps */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          { icon: Package, label: "We're processing", sub: "Your order is confirmed" },
          { icon: ShoppingBag, label: "We'll pack it", sub: "Ready for dispatch" },
          { icon: Home, label: "We'll deliver", sub: "Right to your door" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
            <Icon className="mx-auto mb-2 h-6 w-6 text-[#ff9900]" />
            <p className="text-xs font-semibold text-zinc-900">{label}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/account/orders"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
        >
          <Package className="h-4 w-4" />
          Track My Order
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <ShoppingBag className="h-4 w-4" />
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
