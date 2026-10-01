"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Zap,
  Clock,
  ArrowRight,
  ShoppingCart,
  Check,
  Tag,
  Copy,
  Truck,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";
import { useCart } from "@/context/CartContext";

// ─── 1. DEAL OF THE DAY CARD ────────────────────────────────────────────────
interface DealOfTheDayCardProps {
  dealProduct?: Product | null;
}

export function DealOfTheDayCard({ dealProduct }: DealOfTheDayCardProps) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: "08",
    minutes: "45",
    seconds: "20",
  });

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      const diff = Math.max(0, midnight.getTime() - now.getTime());

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        hours: String(h).padStart(2, "0"),
        minutes: String(m).padStart(2, "0"),
        seconds: String(s).padStart(2, "0"),
      });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const discount = dealProduct ? getDiscountPercent(dealProduct) : 40;
  const dealHref = dealProduct ? `/product/${dealProduct.slug}` : "/shop?onSale=true";

  function handleAddDeal(e: React.MouseEvent) {
    e.preventDefault();
    if (!dealProduct) return;
    addItem({
      productId: dealProduct.id,
      slug: dealProduct.slug,
      name: dealProduct.name,
      image: dealProduct.images?.[0]?.src || "/file.svg",
      price: dealProduct.price,
      currency: dealProduct.currency,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="relative my-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#131921] via-[#1a2434] to-[#232f3e] p-6 text-white shadow-xl ring-1 ring-white/10 sm:p-8">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ff9900]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Badges & Info */}
        <div className="max-w-xl space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#ff9900]">
              <Zap className="h-3.5 w-3.5 fill-[#ff9900]" />
              Deal of the Day
            </span>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3 py-1 text-xs text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-[#ff9900] animate-pulse" />
              <span className="font-mono font-bold tracking-widest text-white">
                {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
              </span>
              <span className="text-[11px] text-zinc-400">left today</span>
            </div>
          </div>

          <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Save Big With Today&apos;s Featured Deal
          </h3>

          <p className="text-sm leading-relaxed text-zinc-300">
            Enjoy exclusive price drops on genuine Ghanaian merchant inventory.
            Limited stock available with guaranteed same-day dispatch.
          </p>

          {dealProduct && (
            <div className="flex items-center gap-3.5 rounded-xl bg-white/10 p-3 backdrop-blur-sm border border-white/15">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/20">
                <Image
                  src={dealProduct.images?.[0]?.src || "/file.svg"}
                  alt={dealProduct.name}
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {dealProduct.name}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-[#ff9900]">
                    {formatPrice(dealProduct.price, dealProduct.currency)}
                  </span>
                  {dealProduct.regularPrice && (
                    <span className="text-xs text-zinc-400 line-through">
                      {formatPrice(dealProduct.regularPrice, dealProduct.currency)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddDeal}
                className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition-all active:scale-95 shadow-sm ${
                  justAdded
                    ? "bg-emerald-500 text-white"
                    : "bg-[#ff9900] text-zinc-950 hover:bg-[#f08804]"
                }`}
              >
                {justAdded ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" /> Added
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" /> Quick Add
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Discount Circle & CTA Link */}
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end">
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-tr from-[#ff9900] to-[#f08804] p-2 text-center text-[#131921] shadow-lg shadow-[#ff9900]/25 sm:h-28 sm:w-28">
            <span className="text-2xl font-black sm:text-3xl leading-none">
              {discount > 0 ? `${discount}%` : "HOT"}
            </span>
            <span className="mt-1 text-[10px] font-extrabold uppercase tracking-wider">
              OFF
            </span>
          </div>

          <Link
            href={dealHref}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 text-xs font-bold text-white transition-all active:scale-95"
          >
            <span>View All Deals</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#ff9900]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── 2. BONANZA SAVINGS CARD ────────────────────────────────────────────────
interface BonanzaPromoCardProps {
  onFilterDeals?: () => void;
}

export function BonanzaPromoCard({ onFilterDeals }: BonanzaPromoCardProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText("NEXTSAVE10");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#201030] via-[#2d1b46] to-[#1a152e] p-6 text-white shadow-xl ring-1 ring-purple-500/30 sm:p-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-[#ff9900]/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 border border-purple-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-200">
              <Sparkles className="h-3.5 w-3.5 text-[#ff9900]" />
              Special Bonanza Offer
            </span>
            <span className="rounded-full bg-[#ff9900] px-2 py-0.5 text-[10px] font-black uppercase text-zinc-950">
              Weekend Extra
            </span>
          </div>

          <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Weekend Mega Bonanza Savings
          </h3>

          <p className="text-sm leading-relaxed text-zinc-200">
            Get price drops across verified laptops, phones, fragrances, and
            essentials. Use code at checkout for extra savings!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl bg-black/40 border border-purple-400/30 px-3.5 py-1.5 text-xs">
              <Tag className="h-3.5 w-3.5 text-[#ff9900]" />
              <span className="font-mono font-bold tracking-wider text-[#ff9900]">
                NEXTSAVE10
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="ml-2 inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white transition"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <span className="text-xs text-zinc-300">
              Extra 10% off with Mobile Money
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href="/shop?onSale=true"
            onClick={onFilterDeals}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff9900] hover:bg-[#f08804] px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-[#ff9900]/20 transition-all active:scale-95"
          >
            <span>Explore Bonanza Deals</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── 3. BUYER CONVENIENCE & PERKS CARD ──────────────────────────────────────
export function BuyerConvenienceCard() {
  return (
    <div className="relative my-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c1c16] via-[#102a20] to-[#0c1c16] p-6 text-white shadow-xl ring-1 ring-emerald-500/30 sm:p-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-emerald-600/20 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            NextDor Buyer Convenience
          </span>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Shopping Made Simple, Fast & Secure
          </h3>
          <p className="mt-1 text-sm text-zinc-200">
            Experience effortless shopping with local Ghanaian payment and delivery.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Doorstep Dispatch</p>
                <p className="text-[11px] text-zinc-300">
                  Fast delivery in Accra, Kumasi & nationwide.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Instant MoMo & Card</p>
                <p className="text-[11px] text-zinc-300">
                  Pay smoothly via MTN MoMo, Telecel & Visa.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Verified Merchants</p>
                <p className="text-[11px] text-zinc-300">
                  100% genuine products with easy returns.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 pt-2 lg:pt-0">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
