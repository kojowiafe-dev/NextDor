import Link from "next/link";
import { CheckCircle, ShoppingBag, Home, Package } from "lucide-react";

type SuccessPageProps = {
  searchParams: Promise<{
    order?: string;
    total?: string;
    currency?: string;
    status?: string;
    payment?: string;
    method?: string;
    reference?: string;
    trxref?: string;
  }>;
};

export const metadata = {
  title: "Order Confirmed | Nextdor",
};

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const orderNumber = params.order ?? "ND-00001";
  const total = params.total ? Number(params.total) : null;
  const currency = params.currency ?? "GHS";
  const ref = params.reference || params.trxref;
  const isPaid = params.status === "PAID" || Boolean(ref);
  const isCod = params.method === "cod" || params.payment === "cod";

  // Format total
  let formattedTotal: string | null = null;
  if (total !== null) {
    formattedTotal = new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(total);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {/* Success icon */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
        <CheckCircle className="h-10 w-10 text-emerald-600" />
      </div>

      <h1 className="text-3xl font-black text-zinc-900">
        {isPaid ? "Payment Received & Order Confirmed!" : "Order Successfully Placed!"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Thank you for shopping with Nextdor. Your order has been registered and is being prepared for dispatch.
      </p>

      {/* Order card */}
      <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-xs ring-1 ring-zinc-200">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3e0]">
              <Package className="h-5 w-5 text-[#ff9900]" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Order Number</p>
              <p className="font-mono text-lg font-bold text-zinc-900">{orderNumber}</p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPaid
                ? "bg-emerald-100 text-emerald-800"
                : isCod
                ? "bg-amber-100 text-amber-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {isPaid ? "PAID & VERIFIED" : isCod ? "CASH ON DELIVERY" : "CONFIRMED"}
          </span>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Fulfillment Status</dt>
            <dd>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Seller Confirmed
              </span>
            </dd>
          </div>
          {formattedTotal && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Final Order Total</dt>
              <dd className="font-bold text-zinc-900">{formattedTotal}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">Estimated Delivery Window</dt>
            <dd className="font-medium text-zinc-900">2 – 4 business days</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 space-y-1">
          <p>📧 A confirmation invoice and delivery tracking link have been dispatched to your email.</p>
          <p>📦 You can monitor real-time courier dispatch progress at any moment on our tracking portal.</p>
        </div>
      </div>

      {/* What's next steps */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          { icon: Package, label: "1. Store Preparing", sub: "Merchant packages item" },
          { icon: ShoppingBag, label: "2. Courier Dispatch", sub: "Rider collects order" },
          { icon: Home, label: "3. Doorstep Delivery", sub: "Direct to your address" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-zinc-200">
            <Icon className="mx-auto mb-2 h-6 w-6 text-[#ff9900]" />
            <p className="text-xs font-bold text-zinc-900">{label}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* CTA buttons (Item #31: Fix tracking button) */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/track?order=${orderNumber}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#232f3e] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#37475a]"
        >
          <Package className="h-4 w-4 text-[#ff9900]" />
          Track Order #{orderNumber}
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <ShoppingBag className="h-4 w-4" />
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
