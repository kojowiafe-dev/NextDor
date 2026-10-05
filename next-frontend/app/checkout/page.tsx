"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ShieldCheck,
  Truck,
  Zap,
  CreditCard,
  Smartphone,
  Banknote,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/utils";
import { placeOrder, ordersCache, initializePayment, verifyPayment } from "@/lib/orders/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryMethod = "standard" | "express" | "pickup";
type PaymentMethod = "momo" | "card" | "cod";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  momoNumber: string;
  momoNetwork: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
};

const REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern",
  "Northern", "Upper East", "Upper West", "Volta", "Bono",
  "Western North", "Ahafo", "Bono East", "Oti", "Savannah", "North East",
];

const DELIVERY_OPTIONS: {
  id: DeliveryMethod;
  label: string;
  sub: string;
  price: number;
  icon: typeof Truck;
}[] = [
  { id: "standard", label: "Standard Delivery", sub: "2–4 business days across Greater Accra & major hubs", price: 25, icon: Truck },
  { id: "express", label: "Express Priority", sub: "Same day / next day morning expedited dispatch", price: 50, icon: Zap },
  { id: "pickup", label: "Pickup Station / Hub", sub: "Accra Digital Centre Hub (Mon-Sat, 8am-7pm)", price: 0, icon: ShieldCheck },
];

const MOMO_NETWORKS = ["MTN MoMo", "Vodafone Cash", "AirtelTigo Money"];

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#232f3e] text-xs font-bold text-white">
          {number}
        </span>
        <h2 className="font-semibold text-zinc-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20";

// ─── Checkout Page ─────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth();
  const currency = items[0]?.currency ?? "GHS";

  const [form, setForm] = useState<FormData>({
    firstName: user?.name.split(" ")[0] ?? "",
    lastName: user?.name.split(" ").slice(1).join(" ") ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: "",
    city: "",
    region: "",
    delivery: "standard",
    payment: "momo",
    momoNumber: "",
    momoNetwork: "MTN MoMo",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardName: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  // Pre-fill from auth when it hydrates
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        firstName: user.name.split(" ")[0] ?? f.firstName,
        lastName: user.name.split(" ").slice(1).join(" ") ?? f.lastName,
        email: user.email ?? f.email,
        phone: user.phone ?? f.phone,
      }));
    }
  }, [user]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const deliveryFee =
    DELIVERY_OPTIONS.find((d) => d.id === form.delivery)?.price ?? 20;
  const total = subtotal + deliveryFee;

  function validate() {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Invalid email format";
    }
    if (!form.phone.trim()) errs.phone = "Required";
    if (!form.address.trim()) errs.address = "Required";
    if (!form.city.trim()) errs.city = "Required";
    if (!form.region) errs.region = "Required";

    if (form.payment === "momo" && !form.momoNumber.trim()) {
      errs.momoNumber = "Enter your MoMo number";
    }
    if (form.payment === "card") {
      if (!form.cardNumber.trim()) errs.cardNumber = "Required";
      if (!form.cardExpiry.trim()) errs.cardExpiry = "Required";
      if (!form.cardCvv.trim()) errs.cardCvv = "Required";
      if (!form.cardName.trim()) errs.cardName = "Required";
    }
    return errs;
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitError(null);
    setIsPlacing(true);

    try {
      const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("nextdor-token") : null);

      // Send order to backend API (supports authenticated customer or guest checkout)
      const result = await placeOrder(
        {
          guestEmail: !user ? form.email.trim() : undefined,
          cart: items.map((i) => ({
            productId: String(i.productId),
            quantity: Number(i.quantity) || 1,
            name: i.name,
            price: Number(i.price) || 0,
            slug: i.slug,
            image: i.image,
          })),
          shippingAddress: {
            street: form.address.trim(),
            city: form.city.trim(),
            region: form.region.trim(),
            recipientName: `${form.firstName} ${form.lastName}`.trim(),
            recipientPhone: form.phone.trim(),
          },
          deliveryMethod: form.delivery.toUpperCase() as any,
          notes: `Payment method: ${form.payment}${
            form.payment === "momo" ? ` (${form.momoNetwork} - ${form.momoNumber})` : ""
          }`,
        },
        activeToken,
      );

      if (!result?.orderNumber) {
        throw new Error("Unable to confirm your order. Please try again.");
      }

      const orderNumber = result.orderNumber;
      ordersCache.invalidateAll();

      if (form.payment === "cod") {
        clearCart();
        router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}&payment=cod&status=PENDING`);
        return;
      }

      // Online payment (MoMo or Card via Paystack gateway)
      try {
        const payInit = await initializePayment(orderNumber, {
          email: form.email.trim(),
          token: activeToken,
        });

        // 1. If Paystack inline popup is available in window
        if (typeof window !== "undefined" && (window as any).PaystackPop && payInit.publicKey) {
          const handler = (window as any).PaystackPop.setup({
            key: payInit.publicKey,
            email: form.email.trim(),
            amount: Math.round(total * 100),
            currency: "GHS",
            ref: payInit.reference,
            callback: async (response: { reference: string }) => {
              try {
                await verifyPayment(orderNumber, response.reference, activeToken);
              } catch (verifyErr) {
                console.warn("Payment verification status:", verifyErr);
              }
              clearCart();
              router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}&status=PAID`);
            },
            onClose: () => {
              clearCart();
              router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}&status=PENDING`);
            },
          });
          handler.openIframe();
          return;
        }

        // 2. If Paystack returned a redirect authorization URL
        if (payInit.authorizationUrl) {
          clearCart();
          window.location.href = payInit.authorizationUrl;
          return;
        }

        // 3. Fallback / sandbox direct verification
        await verifyPayment(orderNumber, payInit.reference, activeToken);
        clearCart();
        router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}&status=PAID`);
      } catch (payErr: any) {
        console.warn("Payment gateway notice:", payErr);
        clearCart();
        router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}&status=PENDING`);
      }
    } catch (orderApiError: any) {
      console.error("Order placement failed:", orderApiError);
      setSubmitError(orderApiError?.message || "Failed to place order. Please check your details and try again.");
      setIsPlacing(false);
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#ff9900]" />
          <p className="text-sm font-medium text-zinc-600">Preparing secure checkout...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Your cart is empty</h1>
        <p className="mt-2 text-zinc-500">Add items to your cart before checking out.</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-[#f08804]"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/cart" className="hover:text-[#c7511f] hover:underline">Cart</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-zinc-900">Checkout</span>
      </div>

      {/* Account Verification & Tracking Assurance Banner */}
      {user ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-white p-4 ring-1 ring-emerald-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-950">
                Verified Account · <span className="font-bold">{user.name}</span> ({user.email})
              </p>
              <p className="text-[11px] text-emerald-700">
                Your order and courier dispatch timeline will be permanently linked to your dashboard.
              </p>
            </div>
          </div>
          <Link
            href="/login?redirect=/checkout"
            className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
          >
            Switch account
          </Link>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/60 to-white p-4 ring-1 ring-amber-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-950">
                Fast Guest Checkout · No Account Required
              </p>
              <p className="text-[11px] text-amber-700">
                You can complete your purchase in 60 seconds without creating a password. Order tracking will be emailed to you.
              </p>
            </div>
          </div>
          <Link
            href="/login?redirect=/checkout"
            className="text-xs font-semibold text-amber-800 underline hover:text-amber-950"
          >
            Already have an account? Sign In
          </Link>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} noValidate>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Left column ─────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">

            {/* 1. Contact info */}
            <Section number="1" title="Contact Information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" id="chk-first" required>
                  <input
                    id="chk-first"
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    data-error={errors.firstName ? true : undefined}
                    className={`${inputCls} ${errors.firstName ? "border-red-400" : ""}`}
                    placeholder="Kofi"
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </Field>
                <Field label="Last name" id="chk-last" required>
                  <input
                    id="chk-last"
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className={`${inputCls} ${errors.lastName ? "border-red-400" : ""}`}
                    placeholder="Mensah"
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </Field>
                <Field label="Email address" id="chk-email" required>
                  <input
                    id="chk-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={`${inputCls} ${errors.email ? "border-red-400" : ""}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </Field>
                <Field label="Phone number" id="chk-phone" required>
                  <input
                    id="chk-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className={`${inputCls} ${errors.phone ? "border-red-400" : ""}`}
                    placeholder="+233 24 000 0000"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </Field>
              </div>
            </Section>

            {/* 2. Shipping address */}
            <Section number="2" title="Delivery Address">
              <div className="space-y-4">
                <Field label="Street address" id="chk-address" required>
                  <input
                    id="chk-address"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    className={`${inputCls} ${errors.address ? "border-red-400" : ""}`}
                    placeholder="14 Independence Avenue"
                  />
                  {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City / Town" id="chk-city" required>
                    <input
                      id="chk-city"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      className={`${inputCls} ${errors.city ? "border-red-400" : ""}`}
                      placeholder="Accra"
                    />
                    {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
                  </Field>
                  <Field label="Region" id="chk-region" required>
                    <select
                      id="chk-region"
                      value={form.region}
                      onChange={(e) => set("region", e.target.value)}
                      className={`${inputCls} ${errors.region ? "border-red-400" : ""}`}
                    >
                      <option value="">Select region</option>
                      {REGIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    {errors.region && <p className="mt-1 text-xs text-red-600">{errors.region}</p>}
                  </Field>
                </div>
              </div>
            </Section>

            {/* 3. Delivery method */}
            <Section number="3" title="Delivery Method">
              <div className="space-y-3">
                {DELIVERY_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                      form.delivery === opt.id
                        ? "border-[#ff9900]/60 bg-[#fff8ee]"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={opt.id}
                      checked={form.delivery === opt.id}
                      onChange={() => set("delivery", opt.id)}
                      className="accent-[#ff9900]"
                    />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff3e0]">
                      <opt.icon className="h-5 w-5 text-[#ff9900]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900">{opt.label}</p>
                      <p className="text-sm text-zinc-500">{opt.sub}</p>
                    </div>
                    <span className="shrink-0 font-semibold text-zinc-900">
                      {opt.price === 0 ? "Free" : formatPrice(opt.price, currency)}
                    </span>
                  </label>
                ))}
              </div>
            </Section>

            {/* 4. Payment */}
            <Section number="4" title="Payment Method">
              {/* Tabs */}
              <div className="mb-4 flex gap-2">
                {(
                  [
                    { id: "momo", label: "Mobile Money", icon: Smartphone },
                    { id: "card", label: "Card", icon: CreditCard },
                    { id: "cod", label: "Cash on Delivery", icon: Banknote },
                  ] as { id: PaymentMethod; label: string; icon: typeof Smartphone }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("payment", m.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                      form.payment === m.id
                        ? "border-[#ff9900] bg-[#fff8ee] text-[#ff9900]"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <m.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              {/* MoMo */}
              {form.payment === "momo" && (
                <div className="space-y-3">
                  <Field label="Mobile network" id="chk-momo-network">
                    <select
                      id="chk-momo-network"
                      value={form.momoNetwork}
                      onChange={(e) => set("momoNetwork", e.target.value)}
                      className={inputCls}
                    >
                      {MOMO_NETWORKS.map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="MoMo number" id="chk-momo-number" required>
                    <input
                      id="chk-momo-number"
                      type="tel"
                      value={form.momoNumber}
                      onChange={(e) => set("momoNumber", e.target.value)}
                      className={`${inputCls} ${errors.momoNumber ? "border-red-400" : ""}`}
                      placeholder="024 000 0000"
                    />
                    {errors.momoNumber && <p className="mt-1 text-xs text-red-600">{errors.momoNumber}</p>}
                  </Field>
                  <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                    You will receive a payment prompt on your phone after placing your order.
                  </p>
                </div>
              )}

              {/* Card */}
              {form.payment === "card" && (
                <div className="space-y-3">
                  <Field label="Cardholder name" id="chk-card-name" required>
                    <input
                      id="chk-card-name"
                      value={form.cardName}
                      onChange={(e) => set("cardName", e.target.value)}
                      className={`${inputCls} ${errors.cardName ? "border-red-400" : ""}`}
                      placeholder="KOFI MENSAH"
                    />
                    {errors.cardName && <p className="mt-1 text-xs text-red-600">{errors.cardName}</p>}
                  </Field>
                  <Field label="Card number" id="chk-card-num" required>
                    <input
                      id="chk-card-num"
                      value={form.cardNumber}
                      onChange={(e) => set("cardNumber", e.target.value)}
                      className={`${inputCls} ${errors.cardNumber ? "border-red-400" : ""}`}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                    {errors.cardNumber && <p className="mt-1 text-xs text-red-600">{errors.cardNumber}</p>}
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry" id="chk-expiry" required>
                      <input
                        id="chk-expiry"
                        value={form.cardExpiry}
                        onChange={(e) => set("cardExpiry", e.target.value)}
                        className={`${inputCls} ${errors.cardExpiry ? "border-red-400" : ""}`}
                        placeholder="MM / YY"
                        maxLength={7}
                      />
                      {errors.cardExpiry && <p className="mt-1 text-xs text-red-600">{errors.cardExpiry}</p>}
                    </Field>
                    <Field label="CVV" id="chk-cvv" required>
                      <input
                        id="chk-cvv"
                        type="password"
                        value={form.cardCvv}
                        onChange={(e) => set("cardCvv", e.target.value)}
                        className={`${inputCls} ${errors.cardCvv ? "border-red-400" : ""}`}
                        placeholder="•••"
                        maxLength={4}
                      />
                      {errors.cardCvv && <p className="mt-1 text-xs text-red-600">{errors.cardCvv}</p>}
                    </Field>
                  </div>
                </div>
              )}

              {/* COD */}
              {form.payment === "cod" && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Pay in cash when your order is delivered. Please have the exact amount ready.
                </p>
              )}
            </Section>
          </div>

          {/* ── Right column — Order summary ──────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <h2 className="mb-4 font-semibold text-zinc-900">Order Summary</h2>

              {/* Items */}
              <ul className="space-y-3 divide-y divide-zinc-50">
                {items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 pt-3 first:pt-0">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="56px"
                          className="object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                          No img
                        </div>
                      )}
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-500 text-[10px] font-bold text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-900">
                      {formatPrice(item.price * item.quantity, item.currency)}
                    </p>
                  </li>
                ))}
              </ul>

              <hr className="my-4 border-zinc-100" />

              {/* Totals Breakdown (Item #8) */}
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <dt>Items Subtotal</dt>
                  <dd className="font-semibold text-zinc-900">{formatPrice(subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <dt className="flex items-center gap-1.5">
                    <span>Delivery ({DELIVERY_OPTIONS.find((d) => d.id === form.delivery)?.label})</span>
                  </dt>
                  <dd className="font-semibold text-zinc-900">
                    {deliveryFee === 0 ? (
                      <span className="font-bold text-emerald-600">FREE</span>
                    ) : (
                      formatPrice(deliveryFee, currency)
                    )}
                  </dd>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <dt className="flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="h-4 w-4" /> Escrow Buyer Protection
                  </dt>
                  <dd className="font-semibold text-emerald-700">Free</dd>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold text-zinc-900">
                  <dt>Grand Total</dt>
                  <dd className="text-lg font-extrabold text-zinc-950">{formatPrice(total, currency)}</dd>
                </div>
              </dl>
            </div>

            {/* Error display */}
            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Unable to place order</p>
                <p className="mt-0.5">{submitError}</p>
              </div>
            )}

            {/* Place order */}
            <button
              type="submit"
              disabled={isPlacing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-6 py-4 text-base font-bold text-zinc-900 shadow-sm transition-colors hover:bg-[#f08804] disabled:opacity-70"
            >
              {isPlacing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-3 border-zinc-900/30 border-t-zinc-900" />
                  Processing Order & Payment...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {form.payment === "cod" ? "Confirm Order · " : "Pay Securely · "}
                  {formatPrice(total, currency)}
                </>
              )}
            </button>

            <div className="space-y-1.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                48-Hour NextDor Buyer Escrow Guarantee
              </p>
              <p className="text-[11px] text-zinc-400">
                Encrypted with 256-bit SSL · Paystack Certified Gateway
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* Paystack Inline Popup SDK */}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
    </div>
  );
}
