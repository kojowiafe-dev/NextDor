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

// ─── 1. DEAL OF THE DAY CARD (COMPACT & VISUAL) ─────────────────────────────
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

  const discount = dealProduct ? getDiscountPercent(dealProduct) : 25;
  const dealHref = dealProduct ? `/product/${dealProduct.slug}` : "/deals";

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
    <div className="relative my-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#131921] via-[#1a2434] to-[#232f3e] p-4 sm:p-5 text-white shadow-md ring-1 ring-white/10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#ff9900]/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
        {/* Left Side: Compact Badge & Title */}
        <div className="space-y-1.5 max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#ff9900]">
              <Zap className="h-3 w-3 fill-[#ff9900]" />
              Deal of the Day
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-2.5 py-0.5 text-[11px] text-zinc-300">
              <Clock className="h-3 w-3 text-[#ff9900]" />
              <span className="font-mono font-bold text-white">
                {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
              </span>
            </div>
          </div>

          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
            Today&apos;s Spotlight Offer{" "}
            {discount > 0 && (
              <span className="text-[#ff9900]">({discount}% OFF)</span>
            )}
          </h3>
          <p className="text-xs text-zinc-300 line-clamp-1">
            Limited-time price drop on verified stock with fast dispatch.
          </p>
        </div>

        {/* Center/Right: Featured Product Card + CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          {dealProduct && (
            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-2 sm:p-2.5 backdrop-blur-xs border border-white/15">
              <Link
                href={`/product/${dealProduct.slug}`}
                className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-lg bg-white"
              >
                <Image
                  src={dealProduct.images?.[0]?.src || "/file.svg"}
                  alt={dealProduct.name}
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              </Link>
              <div className="min-w-0 flex-1 sm:max-w-[180px]">
                <Link
                  href={`/product/${dealProduct.slug}`}
                  className="block truncate text-xs font-bold text-white hover:text-[#ff9900]"
                >
                  {dealProduct.name}
                </Link>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-[#ff9900]">
                    {formatPrice(dealProduct.price, dealProduct.currency)}
                  </span>
                  {dealProduct.regularPrice &&
                    dealProduct.regularPrice > dealProduct.price && (
                      <span className="text-[10px] text-zinc-400 line-through">
                        {formatPrice(
                          dealProduct.regularPrice,
                          dealProduct.currency
                        )}
                      </span>
                    )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddDeal}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
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
                    <ShoppingCart className="h-3.5 w-3.5" /> Add
                  </span>
                )}
              </button>
            </div>
          )}

          <Link
            href={dealHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2.5 text-xs font-bold text-white transition shrink-0"
          >
            <span>All Deals</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#ff9900]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── 2. BONANZA SAVINGS CARD (COMPACT) ──────────────────────────────────────
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
    <div className="relative my-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#201030] via-[#2d1b46] to-[#1a152e] p-4 sm:p-5 text-white shadow-md ring-1 ring-purple-500/30">
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 border border-purple-400/40 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-200">
              <Sparkles className="h-3 w-3 text-[#ff9900]" />
              Bonanza Promo
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 border border-purple-400/30 px-2.5 py-0.5 text-xs">
              <Tag className="h-3 w-3 text-[#ff9900]" />
              <span className="font-mono font-bold text-[#ff9900]">
                NEXTSAVE10
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="ml-1 inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white transition cursor-pointer"
              >
                {copied ? (
                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                ) : (
                  <Copy className="h-2.5 w-2.5" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
            Extra 10% Off Weekend Bonanza
          </h3>
          <p className="text-xs text-zinc-300 line-clamp-1">
            Apply code at checkout when paying with Mobile Money.
          </p>
        </div>

        <Link
          href="/deals"
          onClick={onFilterDeals}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#ff9900] hover:bg-[#f08804] px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-sm transition shrink-0 w-fit"
        >
          <span>Shop Bonanza</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ─── 3. BUYER CONVENIENCE & PERKS CARD (COMPACT STRIP) ──────────────────────
export function BuyerConvenienceCard() {
  return (
    <div className="relative my-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c1c16] via-[#102a20] to-[#0c1c16] p-4 sm:p-5 text-white shadow-md ring-1 ring-emerald-500/30">
      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            NextDor Buyer Protection
          </span>
          <h3 className="text-base sm:text-lg font-black text-white">
            Fast, Safe &amp; Escrow-Protected Shopping
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <Truck className="h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold text-white">Fast Delivery</p>
              <p className="text-[11px] text-zinc-300">Accra, Kumasi &amp; nationwide</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <Smartphone className="h-4 w-4 shrink-0 text-[#ff9900]" />
            <div>
              <p className="font-bold text-white">Instant MoMo</p>
              <p className="text-[11px] text-zinc-300">MTN, Telecel &amp; Visa</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold text-white">48-Hour Escrow</p>
              <p className="text-[11px] text-zinc-300">Inspect before payout</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
