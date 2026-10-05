"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Flame,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
  Percent,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";

type SpecialDealsSectionProps = {
  dealProduct?: Product | null;
};

export function SpecialDealsSection({ dealProduct }: SpecialDealsSectionProps) {
  // Live countdown to midnight (GMT/Ghana time)
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

  const discount = dealProduct ? getDiscountPercent(dealProduct) : 65;
  const dealHref = dealProduct ? `/product/${dealProduct.slug}` : "/shop?onSale=true";

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ── CARD 1: PRIMARY "DEAL OF THE DAY" FEATURE CARD (Span 7 cols) ── */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#131921] via-[#1a2332] to-[#232f3e] p-6 text-white shadow-xl ring-1 ring-white/10 sm:p-8 lg:col-span-7">
          {/* Subtle background ambient glows */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#ff9900]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />

          {/* Top row: Badges & Live Countdown */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ff9900]">
              <Zap className="h-3.5 w-3.5 fill-[#ff9900]" />
              Deal of the Day!
            </div>

            {/* Countdown timer pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3.5 py-1 text-xs text-zinc-300 backdrop-blur-sm">
              <Clock className="h-3.5 w-3.5 text-[#ff9900] animate-pulse" />
              <span className="font-mono font-bold text-white tracking-widest">
                {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
              </span>
              <span className="text-[11px] text-zinc-400">remaining</span>
            </div>
          </div>

          {/* Middle row: Content and Product Preview */}
          <div className="relative z-10 my-6 flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl text-white">
                Deal of the Day!
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-100 sm:text-base font-normal">
                Enjoy unbeatable discounts on our top-selling items — valid today
                only! Don’t miss out on big savings while they last
              </p>

              {/* Deal Product Info if available */}
              {dealProduct && (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-2.5 border border-white/10">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">
                    <Image
                      src={dealProduct.images[0]?.src || "/file.svg"}
                      alt={dealProduct.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {dealProduct.name}
                    </p>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-sm font-extrabold text-[#ff9900]">
                        {formatPrice(dealProduct.price, dealProduct.currency)}
                      </span>
                      {dealProduct.regularPrice && dealProduct.regularPrice > dealProduct.price && (
                        <>
                          <span className="text-xs text-zinc-400 line-through">
                            {formatPrice(dealProduct.regularPrice, dealProduct.currency)}
                          </span>
                          <span className="rounded bg-red-500/20 text-red-300 border border-red-500/30 px-1 py-0.2 text-[10px] font-bold">
                            -{Math.round(((dealProduct.regularPrice - dealProduct.price) / dealProduct.regularPrice) * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Key Trust Highlights */}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Same-Day Dispatch
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Verified Authentic
                </span>
              </div>
            </div>

            {/* Discount Badge Visual */}
            <div className="relative flex shrink-0 items-center justify-center">
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl bg-gradient-to-tr from-[#ff9900] to-[#f08804] p-3 text-center text-[#131921] shadow-2xl shadow-[#ff9900]/25 transition-transform hover:scale-105 sm:h-32 sm:w-32">
                <Percent className="h-5 w-5 mb-0.5" />
                <span className="text-2xl font-black tracking-tighter sm:text-3xl">
                  {discount}%
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  Discount
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row: Action CTA Button */}
          <div className="relative z-10 pt-2">
            <Link
              href={dealHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff9900] px-7 py-3.5 text-sm font-extrabold text-[#131921] shadow-lg shadow-[#ff9900]/20 transition-all hover:bg-[#f08804] hover:shadow-[#ff9900]/40 active:scale-[0.98]"
            >
              <span>Grab The Deal Now</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* ── SECONDARY DEALS COLUMN (Span 5 cols) ── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {/* ── CARD 2: FRIDAY BONANZA DEALS ── */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#191128] border border-purple-500/30 p-6 text-white shadow-xl">
            {/* Subtle dark ambient glow inside card */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-purple-600/30 blur-2xl" />

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-900/80 border border-purple-400/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-100">
                  <Flame className="h-3.5 w-3.5 text-[#ff9900] fill-[#ff9900]" />
                  Friday Bonanza Deals
                </span>
                <span className="rounded-full bg-[#ff9900] px-2.5 py-0.5 text-[11px] font-extrabold text-zinc-950 shadow-sm">
                  Weekend Special
                </span>
              </div>

              <h3 className="mt-4 text-xl font-extrabold text-white sm:text-2xl tracking-tight">
                Friday Bonanza Mega Savings
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                Get massive price drops on Electronics, Preowned Laptops, Fragrances, and Bakery favorites across Ghana.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-xs font-bold text-[#ff9900]">
                ⚡ Up to 50% Off Top Brands
              </span>
              <Link
                href="/shop?sort=price-desc"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff9900] px-4 py-2 text-xs font-extrabold text-zinc-950 transition-all hover:bg-[#f08804] active:scale-95 shadow-md"
              >
                <span>Explore Bonanza</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* ── CARD 3: NEXTDOR DIRECT & FLASH BONANZA ── */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0c1c16] border border-emerald-500/30 p-6 text-white shadow-xl">
            {/* Subtle dark ambient glow inside card */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-emerald-600/25 blur-2xl" />

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Daily Flash Deals
                </span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                  Limited Quantities
                </span>
              </div>

              <h3 className="mt-4 text-xl font-extrabold text-white sm:text-2xl tracking-tight">
                NextDor Direct Flash Steals
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                Order directly from verified merchants. Enjoy fast doorstep delivery and seamless mobile money payment.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Ghana Express Dispatch
              </span>
              <Link
                href="/shop?onSale=true"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95 shadow-md"
              >
                <span>Shop Flash Deals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
