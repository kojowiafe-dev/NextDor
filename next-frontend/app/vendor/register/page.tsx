"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Store,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Truck,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function VendorRegisterPage() {
  const router = useRouter();
  const { user, isAuthenticated, isVendor, isAdmin, isLoading } = useAuth();

  // If already authenticated as vendor or admin, redirect immediately
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (isVendor) {
      router.replace("/vendor/dashboard");
    } else if (isAdmin) {
      router.replace("/admin");
    }
  }, [isLoading, isAuthenticated, isVendor, isAdmin, user, router]);

  // Form State
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [momoNumber, setMomoNumber] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1";

  // Real-time Slug Generator
  const previewSlug = storeName
    ? storeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : "your-store-name";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg("Please accept the Nextdor Merchant Terms of Service.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/vendors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          email: email.toLowerCase().trim(),
          password,
          phone: phone.trim(),
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim() || undefined,
          momoNetwork,
          momoNumber: momoNumber.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || "Failed to register merchant account. Please verify your details.");
        return;
      }

      // Save tokens and session
      const { tokens, user, vendor } = json.data;
      if (typeof window !== "undefined") {
        if (tokens?.accessToken) {
          localStorage.setItem("nextdor-token", tokens.accessToken);
          localStorage.setItem("vendor_token", tokens.accessToken);
        }
        if (user) {
          localStorage.setItem(
            "nextdor-auth",
            JSON.stringify({
              id: user.id,
              email: user.email,
              name: user.name,
              role: "vendor_owner",
              vendorId: vendor?.id || user.vendorId,
              avatarInitials: user.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2),
            })
          );
        }
      }

      // Direct redirection into the merchant portal
      router.push("/vendor/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please ensure the backend service is reachable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white selection:bg-purple-600 selection:text-white pb-20">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#161b22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="NextDor"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 border border-purple-500/30">
              Merchant Partner
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-zinc-400">Already registered?</span>
            <Link
              href="/login?redirect=/vendor/dashboard"
              className="rounded-lg border border-white/20 bg-white/5 px-3.5 py-1.5 font-semibold text-white hover:bg-white/10 transition"
            >
              Sign In to Store
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#161b22] to-[#0d1117] py-12 px-4 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-300 mb-4">
            <Store className="h-3.5 w-3.5" />
            <span>Multi-Vendor Merchant Registration</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Open Your Store on Nextdor
          </h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Sell directly to thousands of customers across Ghana. Enjoy automated 48-hour Mobile Money payouts, zero setup fees, and built-in dispatch logistics.
          </p>

          {/* Value Pillars */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CreditCard className="h-4 w-4" />
                <span>Automated MoMo Payouts</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                Earnings disbursed directly to MTN, Telecel, or AT Money 48 hours post-delivery.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <ShieldCheck className="h-4 w-4" />
                <span>Guided Staging Safeguard</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                Pre-load your inventory safely in private staging before your public storefront opens.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Truck className="h-4 w-4" />
                <span>Nationwide Reach</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                We handle discovery and checkout while you fulfill orders with our courier network.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#161b22] p-6 sm:p-8 shadow-xl">
          {errorMsg && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            {/* 1. STORE IDENTITY */}
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <Store className="h-4 w-4 text-purple-400" />
                <span>1. Store Identity & Branding</span>
              </h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="font-semibold text-zinc-300">Store / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sweet Bakes Bakery"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  {/* Live URL Preview */}
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
                    <span>Your store URL:</span>
                    <span className="font-mono text-purple-300">
                      nextdor.online/store/<strong className="text-white">{previewSlug}</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300">Store Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Tell shoppers what products or specialties your store offers..."
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. MERCHANT OWNER ACCOUNT */}
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>2. Store Owner Credentials</span>
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-zinc-300">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ama Serwaa"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-300">Contact Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 024 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-zinc-300">Business / Owner Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ama@sweetbakes.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    This will be used to log in to your merchant portal.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-zinc-300">Portal Password *</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. MOBILE MONEY PAYOUT ACCOUNT */}
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <CreditCard className="h-4 w-4 text-amber-400" />
                <span>3. Mobile Money Settlement Account</span>
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-zinc-300">MoMo Network *</label>
                  <select
                    value={momoNetwork}
                    onChange={(e) => setMomoNetwork(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="TELECEL">Telecel Cash (Vodafone)</option>
                    <option value="AT">AT Money (AirtelTigo)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300">MoMo Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 024 123 4567"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Your store earnings are automatically transferred to this Mobile Money wallet 48 hours following verified customer delivery.
              </p>
            </div>

            {/* 4. TERMS & SUBMIT */}
            <div className="pt-2 border-t border-white/10 space-y-4">
              <label className="flex items-start gap-2.5 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-zinc-900 accent-purple-600"
                />
                <span className="text-[11px] leading-relaxed">
                  I agree to the <Link href="/returns" className="text-purple-400 hover:underline">Nextdor Merchant Terms</Link> and understand the platform applies a standard 10% commission on completed orders.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/30 hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <span>Registering Store...</span>
                ) : (
                  <>
                    <span>Create Merchant Store & Open Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Cross-Link */}
          <div className="mt-6 text-center text-xs text-zinc-400">
            Looking to buy instead of sell?{" "}
            <Link href="/register" className="font-semibold text-purple-400 hover:underline">
              Create a Shopper Account
            </Link>
          </div>
        </div>
      </div>

      {/* Merchant Registration Footer */}
      <footer className="mt-16 border-t border-white/10 py-8 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Nextdor Merchant Onboarding • Multi-Vendor Infrastructure</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-300 transition">
              Customer Storefront
            </Link>
            <Link href="/login" className="hover:text-zinc-300 transition">
              Customer Login
            </Link>
            <Link href="/contact" className="hover:text-zinc-300 transition">
              Contact Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
