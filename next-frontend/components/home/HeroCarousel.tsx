import Link from "next/link";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/woocommerce/mappers";

type HeroCarouselProps = {
  dealProduct: Product | null;
};

export function HeroCarousel({ dealProduct }: HeroCarouselProps) {
  const discount = dealProduct ? getDiscountPercent(dealProduct) : 70;

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-4">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#232f3e] to-[#37475a] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#febd69]">
            Hot Discount
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Up to {discount}% OFF
          </h1>
          <p className="mt-3 text-zinc-200">
            Enjoy amazing discounts on selected items. Shop quality products at
            unbeatable prices — delivered to you across Ghana.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-lg bg-[#ff9900] px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#f08804]"
            >
              Shop Now
            </Link>
            {dealProduct && (
              <Link
                href={`/product/${dealProduct.slug}`}
                className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                Deal of the Day — {formatPrice(dealProduct.price, dealProduct.currency)}
              </Link>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full bg-[#ff9900]/10" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-48 w-48 rounded-full bg-[#febd69]/10" />
      </div>
    </section>
  );
}
