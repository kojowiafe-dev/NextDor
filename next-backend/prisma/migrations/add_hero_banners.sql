ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isBannerFeatured" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "products_isBannerFeatured_idx" ON "products"("isBannerFeatured");

CREATE TABLE IF NOT EXISTS "hero_banners" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "badge" TEXT NOT NULL DEFAULT 'Featured',
  "subtitle" TEXT NOT NULL,
  "bgImageUrl" TEXT NOT NULL,
  "ctaText" TEXT NOT NULL DEFAULT 'Shop Now',
  "ctaHref" TEXT NOT NULL DEFAULT '/shop',
  "secondaryText" TEXT DEFAULT 'View Deals',
  "secondaryHref" TEXT DEFAULT '/deals',
  "productId" UUID,
  "accentCards" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hero_banners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hero_banners_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "hero_banners_isActive_sortOrder_idx" ON "hero_banners"("isActive", "sortOrder");

