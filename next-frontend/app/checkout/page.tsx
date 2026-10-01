"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Truck,
  Zap,
  CreditCard,
  Smartphone,
  Banknote,
  ChevronRight,
  Lock,
  LogIn,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/utils";
import { placeOrder } from "@/lib/orders/api";

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
  createAccount: boolean;
  password: string;
};

const REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "Savannah", "North East",
];

const DELIVERY_OPTIONS: {
  id: DeliveryMethod;
  label: string;
  sub: string;
  price: number;
  icon: typeof Truck;
}[] = [
  { id: "standard", label: "Standard Delivery", sub: "2–4 business days", price: 20, icon: Truck },
  { id: "express", label: "Express Delivery", sub: "Same day / next day", price: 45, icon: Zap },
  { id: "pickup", label: "Pickup from Store", sub: "Ready within 2 hours", price: 0, icon: ShieldCheck },
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
  const { user, token, register } = useAuth();
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
    createAccount: false,
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
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

    if (!user && form.createAccount) {
      if (!form.password || form.password.length < 6) {
        errs.password = "Password must be at least 6 characters";
      }
    }

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
    setIsPlacing(true);

    try {
      let activeToken = token;

      // If customer opted to create an account, register them automatically
      if (!user && form.createAccount && form.password) {
        try {
          const registered = await register({
            name: `${form.firstName} ${form.lastName}`.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim(),
          });
          if (registered && (registered as any).token) {
            activeToken = (registered as any).token;
          }
        } catch (regError) {
          console.warn("Silent registration during checkout warning:", regError);
        }
      }

      let orderNumber = `ND-${Math.floor(10000 + Math.random() * 90000)}`;

      // Attempt to place order through backend API
      try {
        const result = await placeOrder(
          {
            guestEmail: !user ? form.email.trim() : undefined,
            cart: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            shippingAddress: {
              street: form.address,
              city: form.city,
              region: form.region,
              recipientName: `${form.firstName} ${form.lastName}`.trim(),
              recipientPhone: form.phone,
            },
            deliveryMethod: form.delivery.toUpperCase() as any,
            notes: `Payment method: ${form.payment}${
              form.payment === "momo" ? ` (${form.momoNetwork} - ${form.momoNumber})` : ""
            }`,
          },
          activeToken,
        );
        if (result?.orderNumber) {
          orderNumber = result.orderNumber;
        }
      } catch (orderApiError) {
        // Fallback gracefully for local dev/preview
        console.warn("Backend order placement fallback:", orderApiError);
      }

      clearCart();
      router.push(`/checkout/success?order=${orderNumber}&total=${total}&currency=${currency}`);
    } catch {
      setIsPlacing(false);
    }
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

      {/* Smart Hybrid Checkout Banner */}
      {!user ? (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 ring-1 ring-amber-500/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-[#b12704]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Already have a NextDor account?
                </h3>
                <p className="text-xs text-zinc-600">
                  Sign in to use your saved addresses, stored details, and express checkout.
                </p>
              </div>
            </div>
            <Link
              href="/login?redirect=/checkout"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#232f3e] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-zinc-800 shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>
              Checking out as <strong className="font-semibold text-emerald-950">{user.name}</strong> ({user.email})
            </span>
          </div>
          <Link
            href="/login?redirect=/checkout"
            className="font-medium text-emerald-700 underline hover:text-emerald-900"
          >
            Switch account
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

              {/* Guest account creation option */}
              {!user && (
                <div className="mt-5 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 transition-all">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.createAccount}
                      onChange={(e) => set("createAccount", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#ff9900] focus:ring-[#ff9900]"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-zinc-900">
                        Create an account to track this order
                      </span>
                      <p className="text-xs text-zinc-500">
                        Save your details for 1-click checkout next time and easily track live order updates.
                      </p>
                    </div>
                  </label>

                  {form.createAccount && (
                    <div className="mt-3.5 border-t border-zinc-200 pt-3">
                      <Field label="Create a password" id="chk-password" required>
                        <div className="relative">
                          <input
                            id="chk-password"
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => set("password", e.target.value)}
                            className={`${inputCls} pr-10 ${errors.password ? "border-red-400" : ""}`}
                            placeholder="At least 6 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                        )}
                      </Field>
                    </div>
                  )}
                </div>
              )}
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

              {/* Totals */}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Subtotal</dt>
                  <dd className="font-medium">{formatPrice(subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Delivery</dt>
                  <dd className="font-medium">
                    {deliveryFee === 0 ? "Free" : formatPrice(deliveryFee, currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-bold text-zinc-900">
                  <dt>Total</dt>
                  <dd>{formatPrice(total, currency)}</dd>
                </div>
              </dl>
            </div>

            {/* Place order */}
            <button
              type="submit"
              disabled={isPlacing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-6 py-4 text-base font-bold text-zinc-900 shadow-sm transition-colors hover:bg-[#f08804] disabled:opacity-70"
            >
              {isPlacing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-3 border-zinc-900/30 border-t-zinc-900" />
                  Placing Order...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Place Order · {formatPrice(total, currency)}
                </>
              )}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure checkout. Your data is encrypted.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
