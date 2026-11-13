"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Flame,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";
import type { Category, Product } from "@/lib/catalog/types";

interface HeroCarouselProps {
  products?: Product[];
  categories?: Category[];
  dealProduct?: Product | null;
}

// Curated high-resolution commercial e-commerce banners (Amazon-style editorial photography)
const HERO_BANNERS = [
  {
    id: "tech-deals",
    badge: "Flash Tech Event",
    title: "Next-Gen Electronics & Gadgets",
    highlight: "Up to 40% Off",
    subtitle: "Shop laptops, smartwatches, wireless audio & accessories from verified stores.",
    ctaText: "Shop Electronics",
    ctaHref: "/category/electronics",
    secondaryText: "Today's Deals",
    secondaryHref: "/deals",
    bgImage:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1800&q=85",
    accentCards: [
      {
        label: "Pro Laptops",
        image:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
        href: "/category/electronics",
      },
      {
        label: "Audio & Watches",
        image:
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80",
        href: "/category/accessories",
      },
    ],
  },
  {
    id: "home-living",
    badge: "Home & Living Upgrade",
    title: "Modern Home & Kitchen Appliances",
    highlight: "Built to Last",
    subtitle: "4K Smart TVs, air conditioners, refrigerators & everyday home essentials.",
    ctaText: "Explore Appliances",
    ctaHref: "/category/home-appliances",
    secondaryText: "Browse All",
    secondaryHref: "/shop",
    bgImage:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1800&q=85",
    accentCards: [
      {
        label: "Kitchen & Cooling",
        image:
          "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=600&q=80",
        href: "/category/home-appliances",
      },
      {
        label: "Smart Entertainment",
        image:
          "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=80",
        href: "/category/home-appliances",
      },
    ],
  },
  {
    id: "fashion-beauty",
    badge: "Trending Collections",
    title: "Signature Style, Beauty & Self-Care",
    highlight: "New Arrivals",
    subtitle: "Discover luxury fragrances, skincare, apparel & everyday bags across Ghana.",
    ctaText: "Shop Beauty & Care",
    ctaHref: "/category/beauty-personal-care",
    secondaryText: "Fashion & Apparel",
    secondaryHref: "/category/fashion-apparel",
    bgImage:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85",
    accentCards: [
      {
        label: "Luxury Perfumes",
        image:
          "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80",
        href: "/category/beauty-personal-care",
      },
      {
        label: "Apparel & Bags",
        image:
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80",
        href: "/category/fashion-apparel",
      },
    ],
  },
  {
    id: "groceries-bakery",
    badge: "Fast Doorstep Delivery",
    title: "",
    // title: "Fresh Bakery, Honey & Daily Groceries",
    highlight: "",
    // highlight: "Delivered Fast",
    subtitle: "Order fresh cakes, biscuits, organic honey & pantry staples with instant MoMo.",
    ctaText: "Shop Groceries",
    ctaHref: "/category/bakery-groceries",
    secondaryText: "View Deals",
    secondaryHref: "/deals",
    bgImage:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85",
    accentCards: [
      {
        label: "Fresh Bakery",
        image:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
        href: "/category/bakery-groceries",
      },
      {
        label: "Organic Pantry",
        image:
          "https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=600&q=80",
        href: "/category/bakery-groceries",
      },
    ],
  },
];

// Curated visual department & promo cards (Amazon-style visual cards without raw product price clutter)
const VISUAL_DEPARTMENT_CARDS = [
  {
    title: "Laptops & Computing",
    tag: "Work & Study",
    href: "/category/electronics",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Home & Kitchen Appliances",
    tag: "Modern Living",
    href: "/category/home-appliances",
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Smartwatches & Audio",
    tag: "Top Accessories",
    href: "/category/accessories",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Today's Flash Deals",
    tag: "Up to 40% Off",
    href: "/deals",
    image:
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Beauty & Fragrances",
    tag: "Self-Care",
    href: "/category/beauty-personal-care",
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Fashion & Everyday Bags",
    tag: "Trending Style",
    href: "/category/fashion-apparel",
    image:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Bakery & Groceries",
    tag: "Fresh Daily",
    href: "/category/bakery-groceries",
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Books & Bestsellers",
    tag: "Mind & Growth",
    href: "/category/books",
    image:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80",
  },
];

export function HeroCarousel(_props: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRowRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);

  const totalSlides = HERO_BANNERS.length;

  const nextSlide = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 220) return;
    lastTriggerRef.current = now;
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 220) return;
    lastTriggerRef.current = now;
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Auto-advance every 6 seconds unless hovered/paused
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, totalSlides]);

  // Touch swipe handlers that ignore taps on buttons/links so mobile arrows work 100% reliably
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) {
      touchStartXRef.current = null;
      return;
    }
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartXRef.current = null;
  };

  // Horizontal category showcase scroll handlers
  const scrollRowLeft = () => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 180) return;
    lastTriggerRef.current = now;
    const el = scrollRowRef.current;
    if (!el) return;
    const step = Math.max(220, Math.round(el.clientWidth * 0.75));
    el.scrollTo({
      left: Math.max(0, el.scrollLeft - step),
      behavior: "smooth",
    });
  };

  const scrollRowRight = () => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 180) return;
    lastTriggerRef.current = now;
    const el = scrollRowRef.current;
    if (!el) return;
    const step = Math.max(220, Math.round(el.clientWidth * 0.75));
    el.scrollTo({
      left: el.scrollLeft + step,
      behavior: "smooth",
    });
  };

  const activeBanner = HERO_BANNERS[currentSlide];

  return (
    <section
      className="relative mx-auto max-w-7xl px-3 sm:px-4 pt-2 sm:pt-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* AMAZON-STYLE EDITORIAL E-COMMERCE HERO BANNER                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#131921] text-white shadow-xl ring-1 ring-black/10 h-[410px] sm:h-[360px] lg:h-[400px]"
      >
        {/* Full-Bleed Background Lifestyle Image with Smooth Transition */}
        {HERO_BANNERS.map((slide, idx) => (
          <div
            key={slide.id}
            className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 -z-10"
              }`}
          >
            <Image
              src={slide.bgImage}
              alt={slide.title}
              fill
              priority={idx === 0}
              sizes="(max-width: 768px) 100vw, 1280px"
              className="object-cover object-center"
            />
            {/* Multi-stop gradient overlay so typography is crisp while imagery shines */}
            {/* Dark covering removed as requested so the banner images display clearly */}
            {/* <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a]/95 via-[#0f172a]/70 to-[#0f172a]/25 sm:via-[#0f172a]/65 sm:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 via-[#0f172a]/20 to-transparent" /> */}
          </div>
        ))}

        {/* Slide Content Container */}
        <div className="relative z-10 h-full w-full px-11 sm:px-16 lg:px-20 pt-4 pb-9 sm:py-8 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-6">
          {/* Left Editorial Content */}
          <div className="flex flex-col justify-center space-y-1.5 sm:space-y-3 max-w-lg">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff9900] text-zinc-950 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-md border border-[#ff9900]/40">
                <Flame className="h-3.5 w-3.5 fill-current shrink-0" />
                {activeBanner.badge}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-zinc-950/75 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/25 shadow-md">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                48h Escrow Protection
              </span>
            </div>

            {/* <h1 className="text-lg sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight sm:leading-[1.15] drop-shadow-sm">
              {activeBanner.title}{" "}
              <span className="text-[#ff9900] block sm:inline">
                — {activeBanner.highlight}
              </span>
            </h1> */}

            <div className="max-w-md rounded-xl bg-zinc-950/70 backdrop-blur-md border border-white/20 p-2.5 sm:p-3 shadow-lg">
              <p className="text-xs sm:text-sm font-medium text-white line-clamp-2 leading-relaxed">
                {activeBanner.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Link
                href={activeBanner.ctaHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff9900] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-black text-zinc-950 shadow-xl shadow-black/40 transition hover:bg-[#f08804] active:scale-95 whitespace-nowrap"
              >
                <span>{activeBanner.ctaText}</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
              <Link
                href={activeBanner.secondaryHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/30 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-zinc-900 transition active:scale-95 shadow-xl shadow-black/40 whitespace-nowrap"
              >
                <span>{activeBanner.secondaryText}</span>
              </Link>
            </div>
          </div>

          {/* Visual Lifestyle Cards (Visible on Both Mobile & Desktop!) */}
          <div className="grid grid-cols-2 md:flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {activeBanner.accentCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="group relative h-28 sm:h-40 md:h-44 md:w-40 lg:h-52 lg:w-44 overflow-hidden rounded-xl sm:rounded-2xl border border-white/25 bg-zinc-900 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-[#ff9900]"
              >
                <Image
                  src={card.image}
                  alt={card.label}
                  fill
                  sizes="180px"
                  className="object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between text-white">
                  <span className="text-[11px] sm:text-xs font-bold tracking-tight group-hover:text-[#ff9900] transition truncate">
                    {card.label}
                  </span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-[#ff9900] transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── LEFT / RIGHT BANNER ARROWS (INSTANT TOUCH + CLICK) ─── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            prevSlide();
          }}
          aria-label="Previous slide"
          className="absolute left-1.5 sm:left-3.5 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/35 bg-black/65 text-white shadow-xl backdrop-blur-md transition hover:bg-black/85 active:bg-[#ff9900] active:text-zinc-950 touch-manipulation cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            nextSlide();
          }}
          aria-label="Next slide"
          className="absolute right-1.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/35 bg-black/65 text-white shadow-xl backdrop-blur-md transition hover:bg-black/85 active:bg-[#ff9900] active:text-zinc-950 touch-manipulation cursor-pointer"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 pointer-events-none" />
        </button>

        {/* Slide Indicator Dots */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 backdrop-blur-md border border-white/15">
          {HERO_BANNERS.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentSlide(idx);
              }}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 touch-manipulation cursor-pointer ${currentSlide === idx ? "w-6 bg-[#ff9900]" : "w-1.5 bg-white/50"
                }`}
            />
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* AMAZON-STYLE SWIPEABLE CATEGORY & PROMO SHOWCASE STRIP        */}
      {/* (Curated E-Commerce Photography — No Scrollbar)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="mt-3 sm:mt-4 rounded-2xl bg-white p-3 sm:p-4 shadow-xs border border-zinc-200/80">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ff9900]/15 text-[#ff9900]">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-zinc-900 truncate">
                Explore Departments &amp; Featured Collections
              </h2>
            </div>
          </div>

          {/* Mobile & Desktop Strip Navigation Arrows */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={scrollRowLeft}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollRowLeft();
              }}
              aria-label="Scroll collections left"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 shadow-2xs hover:bg-[#ff9900] hover:border-[#ff9900] hover:text-zinc-950 active:bg-[#ff9900] active:text-zinc-950 transition touch-manipulation cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 pointer-events-none" />
            </button>
            <button
              type="button"
              onClick={scrollRowRight}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollRowRight();
              }}
              aria-label="Scroll collections right"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 shadow-2xs hover:bg-[#ff9900] hover:border-[#ff9900] hover:text-zinc-950 active:bg-[#ff9900] active:text-zinc-950 transition touch-manipulation cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Swipeable Visual Category Cards (Hidden Scrollbar) */}
        <div
          ref={scrollRowRef}
          className="mt-3 flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar scroll-smooth pb-0.5"
        >
          {VISUAL_DEPARTMENT_CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group relative flex w-40 sm:w-52 shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 transition hover:-translate-y-0.5 hover:border-[#ff9900] hover:bg-white hover:shadow-md"
            >
              <div className="relative h-28 sm:h-36 w-full overflow-hidden bg-zinc-200">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="220px"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-[#ff9900]">
                  {card.tag}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 sm:p-3">
                <span className="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-[#c7511f] transition line-clamp-1">
                  {card.title}
                </span>
                <span className="text-[11px] font-bold text-[#007185] group-hover:text-[#c7511f] shrink-0 ml-1">
                  Shop &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
