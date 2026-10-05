/**
 * WooCommerce Catalog Ingestion Service.
 *
 * DESIGN DECISION: Asynchronous Background Ingestion (RFC 7240 Pattern)
 * ─────────────────────────────────────────────────────────────────────
 * Pulling products, categories, and images over cloud networks can take
 * 1-3 minutes. Holding an HTTP connection open causes browser / proxy timeouts.
 *
 * We decouple the HTTP request from the job execution:
 * 1. POST /sync/wc triggers the job and responds in ~5ms.
 * 2. GET /sync/status allows the client to poll live progress.
 * 3. Idempotent upserts ensure safety even if re-triggered.
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { config } from "../../config/env.js";
import { redis, CacheKey } from "../../lib/redis.js";

interface WcImage {
  id: number;
  src: string;
  alt?: string;
  name?: string;
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
  link?: string;
}

interface WcPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_minor_unit: number;
}

interface WcProduct {
  id: number;
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  on_sale: boolean;
  prices: WcPrices;
  images: WcImage[];
  categories: WcCategory[];
  is_in_stock: boolean;
  low_stock_remaining?: number | null;
}

export interface SyncResult {
  success: boolean;
  totalFetched: number;
  productsCreated: number;
  productsUpdated: number;
  categoriesCreated: number;
  durationMs: number;
  errors: string[];
}

export interface SyncStatus {
  isSyncing: boolean;
  progress: string;
  totalFetched: number;
  lastResult: SyncResult | null;
  lastError: string | null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, "").trim();
}

function parsePrice(rawMinor: string, minorUnit: number): string {
  const parsed = parseInt(rawMinor || "0", 10);
  if (isNaN(parsed) || parsed <= 0) return "0.00";
  return (parsed / Math.pow(10, minorUnit)).toFixed(2);
}

export class SyncService {
  private static status: SyncStatus = {
    isSyncing: false,
    progress: "Idle",
    totalFetched: 0,
    lastResult: null,
    lastError: null,
  };

  static getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Triggers the sync process in the background without blocking the HTTP thread.
   * FIX #9: Distributed lock via Redis (`lock:wc-sync`) prevents multiple server instances
   * from concurrently running overlapping sync tasks.
   */
  static async startBackgroundSync(): Promise<{ started: boolean; message: string }> {
    try {
      const lockAcquired = await redis.set(CacheKey.syncLock(), "1", "EX", 300, "NX");
      if (!lockAcquired) {
        return { started: false, message: "Sync is already in progress on another server instance." };
      }
    } catch {
      // In-memory fallback if Redis is down
      if (this.status.isSyncing) {
        return { started: false, message: "Sync is already in progress." };
      }
    }

    this.status.isSyncing = true;

    // Launch without await so caller gets instant response
    this.syncFromWooCommerce()
      .catch((err) => {
        logger.error({ err }, "Background sync encountered an unexpected error");
        this.status.isSyncing = false;
        this.status.lastError = err.message;
      })
      .finally(async () => {
        try {
          await redis.del(CacheKey.syncLock());
        } catch {
          // ignore
        }
      });

    return { started: true, message: "Synchronization started in background." };
  }

  /**
   * Syncs all products and categories from WooCommerce Store API into PostgreSQL.
   */
  static async syncFromWooCommerce(): Promise<SyncResult> {
    const startTime = Date.now();
    const baseUrl = config.WOOCOMMERCE_STORE_URL.replace(/\/$/, "");
    const endpoint = `${baseUrl}/products`;

    this.status.isSyncing = true;
    this.status.progress = "Connecting to WooCommerce...";
    this.status.lastError = null;

    logger.info({ endpoint }, "Starting WooCommerce catalog synchronization");

    // Resolve NextDor Flagship Vendor
    const flagshipVendor = await prisma.vendor.findUnique({
      where: { slug: "nextdor" },
      select: { id: true },
    });

    let page = 1;
    const perPage = 50;
    let totalFetched = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    const syncedCategoryIds = new Set<string>();
    const errors: string[] = [];

    try {
      while (true) {
        const url = `${endpoint}?per_page=${perPage}&page=${page}`;
        this.status.progress = `Fetching page ${page} from WooCommerce...`;
        logger.info({ page, url }, "Fetching products page from WooCommerce");

        let response: Response;
        // FIX #17: 30-second timeout via AbortController prevents hanging indefinitely on network failure
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        try {
          response = await fetch(url, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "NextDor-SyncService/1.0",
            },
            signal: controller.signal,
          });
        } catch (err: any) {
          const isAbort = err.name === "AbortError";
          const msg = isAbort
            ? `WooCommerce request timed out on page ${page} after 30s`
            : `Failed to connect to WooCommerce on page ${page}: ${err.message}`;
          logger.error({ err }, msg);
          errors.push(msg);
          break;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          if (response.status === 400 && page > 1) {
            // WooCommerce returns 400 when page out of bounds — end of pagination
            break;
          }
          const msg = `WooCommerce responded with HTTP ${response.status} on page ${page}`;
          logger.warn(msg);
          errors.push(msg);
          break;
        }

        const products = (await response.json()) as WcProduct[];
        if (!Array.isArray(products) || products.length === 0) {
          logger.info({ page }, "Reached end of WooCommerce product catalog");
          break;
        }

        totalFetched += products.length;
        this.status.totalFetched = totalFetched;

        for (const wcProd of products) {
          try {
            this.status.progress = `Saving ${wcProd.name}...`;

            // 1. Process and upsert categories
            const categoryIds: string[] = [];
            if (Array.isArray(wcProd.categories)) {
              for (const cat of wcProd.categories) {
                const categoryRecord = await prisma.category.upsert({
                  where: { slug: cat.slug },
                  update: {
                    name: cat.name,
                    wcId: cat.id,
                  },
                  create: {
                    wcId: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                  },
                });
                categoryIds.push(categoryRecord.id);
                syncedCategoryIds.add(categoryRecord.id);
              }
            }

            // 2. Parse money
            const minorUnit = wcProd.prices?.currency_minor_unit ?? 2;
            const price = parsePrice(wcProd.prices?.price, minorUnit);
            let salePrice: string | null = null;

            if (
              wcProd.on_sale &&
              wcProd.prices?.sale_price &&
              wcProd.prices.sale_price !== wcProd.prices.regular_price
            ) {
              salePrice = parsePrice(wcProd.prices.sale_price, minorUnit);
            }

            const currency = wcProd.prices?.currency_code || "GHS";
            const stockStatus = wcProd.is_in_stock ? "IN_STOCK" : "OUT_OF_STOCK";
            const shortDesc = wcProd.short_description ? stripHtml(wcProd.short_description) : null;
            const description = wcProd.description?.trim() || wcProd.name;

            // 3. Upsert Product
            const existing = await prisma.product.findUnique({
              where: { wcId: wcProd.id },
              select: { id: true },
            });

            const product = await prisma.product.upsert({
              where: { wcId: wcProd.id },
              update: {
                name: wcProd.name,
                slug: wcProd.slug || `product-${wcProd.id}`,
                description,
                shortDesc,
                price,
                salePrice,
                currency,
                stockStatus,
                stockQty: wcProd.low_stock_remaining ?? null,
                categories: {
                  set: categoryIds.map((id) => ({ id })),
                },
              },
              create: {
                wcId: wcProd.id,
                name: wcProd.name,
                slug: wcProd.slug || `product-${wcProd.id}`,
                description,
                shortDesc,
                price,
                salePrice,
                currency,
                stockStatus,
                stockQty: wcProd.low_stock_remaining ?? null,
                vendorId: flagshipVendor?.id,
                categories: {
                  connect: categoryIds.map((id) => ({ id })),
                },
              },
            });

            if (existing) {
              productsUpdated++;
            } else {
              productsCreated++;
            }

            // 4. Upsert Images
            if (Array.isArray(wcProd.images) && wcProd.images.length > 0) {
              await prisma.productImage.deleteMany({ where: { productId: product.id } });
              await prisma.productImage.createMany({
                data: wcProd.images.map((img, idx) => ({
                  productId: product.id,
                  url: img.src,
                  alt: img.alt || wcProd.name,
                  sortOrder: idx,
                })),
              });
            }
          } catch (itemErr: any) {
            const itemMsg = `Error syncing product ID ${wcProd.id} (${wcProd.name}): ${itemErr.message}`;
            logger.error({ err: itemErr, productId: wcProd.id }, itemMsg);
            errors.push(itemMsg);
          }
        }

        if (products.length < perPage) {
          break; // Last page reached
        }

        page++;
      }
    } catch (err: any) {
      logger.error({ err }, "Fatal sync failure");
      errors.push(err.message);
    } finally {
      const durationMs = Date.now() - startTime;
      const result: SyncResult = {
        success: errors.length === 0,
        totalFetched,
        productsCreated,
        productsUpdated,
        categoriesCreated: syncedCategoryIds.size,
        durationMs,
        errors,
      };

      this.status.isSyncing = false;
      this.status.progress = `Completed in ${Math.round(durationMs / 1000)}s`;
      this.status.lastResult = result;

      logger.info(
        {
          totalFetched,
          productsCreated,
          productsUpdated,
          categoriesCreated: syncedCategoryIds.size,
          durationMs,
        },
        "WooCommerce catalog sync complete",
      );

      return result;
    }
  }
}
