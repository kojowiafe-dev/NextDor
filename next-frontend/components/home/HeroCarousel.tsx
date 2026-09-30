import Link from "next/link";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";

export function HeroCarousel() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#131921] via-[#1a2332] to-[#232f3e] px-6 py-12 text-white shadow-lg sm:px-12 sm:py-16 ring-1 ring-white/10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ff9900]/20 border border-[#ff9900]/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ff9900] mb-4">
            <ShoppingBag className="h-3.5 w-3.5 fill-[#ff9900]" />
            <span>Nextdor Ghana Marketplace</span>
          </div>

          <h1 className="text-3xl font-extrabold sm:text-5xl tracking-tight text-white leading-tight">
            Style, Convenience, and Comfort
          </h1>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-zinc-300">
            Shop genuine electronics, laptops, beauty essentials, groceries, and bakery favorites from verified local sellers. Enjoy fast delivery across Ghana and secure Mobile Money checkout.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff9900] px-6 py-3.5 text-sm font-extrabold text-[#131921] shadow-lg shadow-[#ff9900]/25 transition hover:bg-[#f08804] active:scale-95"
            >
              <span>Explore All Products</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/vendor/register"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Store className="h-4 w-4 text-[#ff9900]" />
              <span>Sell on Nextdor</span>
            </Link>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-80 w-80 rounded-full bg-[#ff9900]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
      </div>
    </section>
  );
}
