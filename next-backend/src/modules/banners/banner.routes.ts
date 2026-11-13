import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/auth.guards.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { cacheGet, cacheSet, cacheDel } from "../../lib/redis.js";

const BANNERS_CACHE_KEY = "storefront:hero_banners";

/**
 * Public + Admin Hero Banner Routes.
 * Registered at /api/v1/banners
 */
export const bannerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/v1/banners
   * Public endpoint returning active hero banners + quick-featured products.
   */
  app.get(
    "/",
    {
      schema: {
        description: "List active homepage hero banners and banner-featured products",
        tags: ["Banners"],
      },
    },
    async (_req, reply) => {
      const cached = await cacheGet<any>(BANNERS_CACHE_KEY);
      if (cached) {
        return reply.send({ success: true, data: cached });
      }

      const [banners, featuredProducts] = await Promise.all([
        prisma.heroBanner.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                salePrice: true,
                currency: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
              },
            },
          },
        }),
        prisma.product.findMany({
          where: {
            isBannerFeatured: true,
            deletedAt: null,
            OR: [{ vendorId: null }, { vendor: { status: "ACTIVE", deletedAt: null } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            name: true,
            slug: true,
            shortDesc: true,
            price: true,
            salePrice: true,
            currency: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
            categories: { take: 1, select: { name: true, slug: true } },
          },
        }),
      ]);

      const payload = { banners, featuredProducts };
      await cacheSet(BANNERS_CACHE_KEY, payload, 60);
      return reply.send({ success: true, data: payload });
    }
  );

  /**
   * GET /api/v1/banners/admin
   * Admin list of all hero banners (active and inactive).
   */
  app.get(
    "/admin",
    {
      preHandler: requireAdmin,
      schema: {
        description: "List all hero banners for admin management",
        tags: ["Admin Banners"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      const banners = await prisma.heroBanner.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              salePrice: true,
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            },
          },
        },
      });
      return reply.send({ success: true, data: { banners } });
    }
  );

  /**
   * POST /api/v1/banners/admin
   * Admin creates a new hero banner slide.
   */
  app.post(
    "/admin",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Create a new homepage hero banner",
        tags: ["Admin Banners"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["subtitle", "bgImageUrl"],
          properties: {
            badge: { type: "string", maxLength: 60 },
            subtitle: { type: "string", minLength: 3, maxLength: 300 },
            bgImageUrl: { type: "string", minLength: 5 },
            ctaText: { type: "string", maxLength: 40 },
            ctaHref: { type: "string", maxLength: 300 },
            secondaryText: { type: "string", maxLength: 40 },
            secondaryHref: { type: "string", maxLength: 300 },
            productId: { type: "string", nullable: true },
            accentCards: {
              type: "array",
              maxItems: 2,
              items: {
                type: "object",
                required: ["label", "image", "href"],
                properties: {
                  label: { type: "string" },
                  image: { type: "string" },
                  href: { type: "string" },
                },
              },
            },
            sortOrder: { type: "integer" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;

      let resolvedCtaHref = body.ctaHref?.trim() || "/shop";
      if (body.productId) {
        const prod = await prisma.product.findUnique({
          where: { id: body.productId },
          select: { id: true, slug: true },
        });
        if (!prod) throw new BadRequestError("Selected product not found.");
        if (!body.ctaHref) {
          resolvedCtaHref = `/product/${prod.slug}`;
        }
      }

      const banner = await prisma.heroBanner.create({
        data: {
          badge: body.badge?.trim() || "Featured",
          subtitle: body.subtitle.trim(),
          bgImageUrl: body.bgImageUrl.trim(),
          ctaText: body.ctaText?.trim() || "Shop Now",
          ctaHref: resolvedCtaHref,
          secondaryText: body.secondaryText?.trim() || "View Deals",
          secondaryHref: body.secondaryHref?.trim() || "/deals",
          productId: body.productId || null,
          accentCards: Array.isArray(body.accentCards) && body.accentCards.length > 0 ? body.accentCards : undefined,
          sortOrder: Number(body.sortOrder) || 0,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            },
          },
        },
      });

      await cacheDel(BANNERS_CACHE_KEY);
      return reply.status(201).send({ success: true, data: { banner } });
    }
  );

  /**
   * PATCH /api/v1/banners/admin/:id
   * Admin updates a hero banner slide.
   */
  app.patch(
    "/admin/:id",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Update a homepage hero banner",
        tags: ["Admin Banners"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      const existing = await prisma.heroBanner.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Banner not found.");

      const data: any = {};
      if (body.badge !== undefined) data.badge = String(body.badge).trim() || "Featured";
      if (body.subtitle !== undefined) data.subtitle = String(body.subtitle).trim();
      if (body.bgImageUrl !== undefined) data.bgImageUrl = String(body.bgImageUrl).trim();
      if (body.ctaText !== undefined) data.ctaText = String(body.ctaText).trim() || "Shop Now";
      if (body.ctaHref !== undefined) data.ctaHref = String(body.ctaHref).trim() || "/shop";
      if (body.secondaryText !== undefined) data.secondaryText = body.secondaryText ? String(body.secondaryText).trim() : null;
      if (body.secondaryHref !== undefined) data.secondaryHref = body.secondaryHref ? String(body.secondaryHref).trim() : null;
      if (body.productId !== undefined) data.productId = body.productId || null;
      if (body.accentCards !== undefined) data.accentCards = body.accentCards;
      if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

      const banner = await prisma.heroBanner.update({
        where: { id },
        data,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            },
          },
        },
      });

      await cacheDel(BANNERS_CACHE_KEY);
      return reply.send({ success: true, data: { banner } });
    }
  );

  /**
   * DELETE /api/v1/banners/admin/:id
   * Admin deletes a hero banner slide.
   */
  app.delete(
    "/admin/:id",
    {
      preHandler: requireAdmin,
      schema: {
        description: "Delete a homepage hero banner",
        tags: ["Admin Banners"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.heroBanner.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Banner not found.");

      await prisma.heroBanner.delete({ where: { id } });
      await cacheDel(BANNERS_CACHE_KEY);
      return reply.send({ success: true, message: "Banner deleted." });
    }
  );
};

