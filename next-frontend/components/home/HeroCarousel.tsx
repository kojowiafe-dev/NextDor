"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  Store,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  Truck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface SlideData {
  id: string;
  tag: string;
  tagIcon: any;
  title: string;
  highlight: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  featureBadge: string;
  badgeIcon: any;
  gradient: string;
  glowColor: string;
}

const slides: SlideData[] = [
  {
    id: "marketplace",
    tag: "Nextdor Ghana Marketplace",
    tagIcon: ShoppingBag,
    title: "Shop More,",
    highlight: "Wait Less",
    description:
      "Shop genuine electronics, laptops, fashion, beauty essentials, groceries, and bakery favorites from verified local sellers. Fast delivery across Ghana with secure Mobile Money checkout.",
    primaryCta: { label: "Explore All Products", href: "/shop" },
    secondaryCta: { label: "Sell on Nextdor", href: "/vendor/register" },
    featureBadge: "Instant MTN & Telecel MoMo Checkout",
    badgeIcon: Truck,
    gradient: "from-[#131921] via-[#1a2332] to-[#232f3e]",
    glowColor: "bg-[#ff9900]/20",
  },
  {
    id: "merchants",
    tag: "Verified Local Merchants",
    tagIcon: Store,
    title: "Authentic Ghanaian Stores,",
    highlight: "Direct to You",
    description:
      "Discover premier neighborhood artisans, specialty bakeries, and electronics distributors. Every single purchase is backed by Nextdor's 48-Hour Escrow Protection Guarantee.",
    primaryCta: { label: "Discover Local Stores", href: "/deals" },
    secondaryCta: { label: "Open Your Storefront", href: "/vendor/register" },
    featureBadge: "48-Hour Buyer Inspection Escrow",
    badgeIcon: ShieldCheck,
    gradient: "from-[#0f172a] via-[#1e1b4b] to-[#172554]",
    glowColor: "bg-purple-500/20",
  },
  {
    id: "deals",
    tag: "Daily Flash Offers",
    tagIcon: Zap,
    title: "Special Price Drops,",
    highlight: "Up to 40% OFF",
    description:
      "Save big on top brands with transparent compare-at discounts. Transparent pricing, zero hidden markups, and express doorstep delivery across Greater Accra, Kumasi, and nationwide.",
    primaryCta: { label: "View Flash Deals", href: "/deals" },
    secondaryCta: { label: "Browse Categories", href: "/category" },
    featureBadge: "Genuine Stock Guarantee",
    badgeIcon: Sparkles,
    gradient: "from-[#1c1917] via-[#292524] to-[#18181b]",
    glowColor: "bg-amber-500/25",
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  // Snappy auto-play interval (3.5 seconds)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 3500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const slide = slides[currentSlide];
  const TagIcon = slide.tagIcon;
  const BadgeIcon = slide.badgeIcon;

  return (
    <section
      className="relative mx-auto max-w-7xl px-4 pt-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${slide.gradient} px-6 py-8 sm:px-14 sm:py-10 text-white shadow-xl ring-1 ring-white/10 transition-colors duration-700 min-h-[500px] sm:min-h-[440px] flex flex-col justify-between`}
      >
        <div className="relative z-10 max-w-2xl flex-1 flex flex-col justify-center">
          {/* Top Pill / Badge - Fixed height container */}
          <div className="flex flex-wrap items-center gap-2 mb-3 min-h-[26px]">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ff9900]">
              <TagIcon className="h-3.5 w-3.5 fill-[#ff9900]" />
              <span>{slide.tag}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">
              <BadgeIcon className="h-3.5 w-3.5 text-[#ff9900]" />
              <span>{slide.featureBadge}</span>
            </div>
          </div>

          {/* Heading - Fixed minimum height to prevent layout shifts */}
          <div className="min-h-[5.5rem] sm:min-h-[6.5rem] flex items-center">
            <h1 className="text-3xl font-extrabold sm:text-5xl tracking-tight text-white leading-tight">
              {slide.title}{" "}
              <span className="text-[#ff9900] underline decoration-[#ff9900]/40 decoration-4 underline-offset-4">
                {slide.highlight}
              </span>
            </h1>
          </div>

          {/* Subtext - Fixed minimum height */}
          <div className="mt-2 min-h-[4.5rem] sm:min-h-[3.5rem] flex items-start">
            <p className="text-sm sm:text-base leading-relaxed text-zinc-300">
              {slide.description}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={slide.primaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff9900] px-6 py-3.5 text-sm font-extrabold text-[#131921] shadow-lg shadow-[#ff9900]/25 transition hover:bg-[#f08804] active:scale-95"
            >
              <span>{slide.primaryCta.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={slide.secondaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Store className="h-4 w-4 text-[#ff9900]" />
              <span>{slide.secondaryCta.label}</span>
            </Link>
          </div>

          {/* Trust Highlights inside Carousel */}
          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-zinc-300 sm:gap-6 border-t border-white/10 pt-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="h-4 w-4 text-emerald-400" />
              Ghana Doorstep Delivery
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-[#ff9900]" />
              100% Genuine Items
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              48h Buyer Protection
            </span>
          </div>
        </div>

        {/* Ambient background glows */}
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-96 w-96 rounded-full ${slide.glowColor} blur-3xl transition-all duration-700`}
        />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

        {/* Carousel Side Navigation Arrows */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md shadow-lg transition hover:bg-black/75 hover:scale-110 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md shadow-lg transition hover:bg-black/75 hover:scale-110 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Dot Indicators - Centered at the bottom */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/35 backdrop-blur-md px-3 py-1.5 border border-white/10 shadow-sm">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === idx
                  ? "w-6 bg-[#ff9900]"
                  : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
