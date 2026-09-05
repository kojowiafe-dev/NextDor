/**
 * Vendor Service — Marketplace Merchant Business Operations.
 *
 * DESIGN PATTERN: Domain Service / Clean Architecture Use Case
 * ─────────────────────────────────────────────────────────────
 * Encapsulates all domain logic for multi-vendor operations:
 * - Multi-tenant isolation verification.
 * - Optimistic Concurrency Control (OCC) collision checks.
 * - Commission and net revenue calculations using the CommissionCalculator strategy.
 * - Merchant registration workflows.
 */

import bcrypt from "bcryptjs";
import { VendorRepository } from "./vendor.repository.js";
import { CommissionCalculator } from "../../domain/CommissionCalculator.js";
import { authService } from "../auth/auth.service.js";
import {
  ConflictError,
  NotFoundError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import type { UserRole } from "@prisma/client";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface RegisterVendorDto {
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  storeName: string;
  storeDescription?: string;
  momoNumber?: string;
  momoNetwork?: string;
}

export interface CreateVendorProductDto {
  name: string;
  description: string;
  shortDesc?: string;
  price: number;
  salePrice?: number;
  stockQty?: number;
  categoryIds?: string[];
  imageUrl?: string;
}

export interface UpdateVendorProductDto {
  name?: string;
  description?: string;
  shortDesc?: string;
  price?: number;
  salePrice?: number | null;
  stockQty?: number | null;
  stockStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK";
  categoryIds?: string[];
  imageUrl?: string;
}

export class VendorService {
  /**
   * Constructor injection enforces the Dependency Inversion Principle (SOLID - D).
   * VendorService depends on abstractions/classes, not direct database queries.
   */
  constructor(
    private readonly vendorRepo: VendorRepository,
    private readonly commissionCalc: CommissionCalculator
  ) {}

  /**
   * List active public vendors for the marketplace store directory.
   */
  async listPublicVendors() {
    return this.vendorRepo.findActiveVendors();
  }

  /**
   * Public vendor storefront profile and catalog by slug.
   */
  async getVendorBySlug(slug: string, page = 1, limit = 24) {
    const vendor = await this.vendorRepo.findBySlug(slug);

    if (!vendor || vendor.status !== "ACTIVE" || vendor.deletedAt) {
      throw new NotFoundError(`Vendor '${slug}' not found or inactive.`);
    }

    const result = await this.vendorRepo.findVendorProducts(vendor.id, { page, limit });

    return {
      vendor,
      catalog: {
        products: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      },
    };
  }

  /**
   * Self-serve registration for new marketplace merchants.
   */
  async registerVendor(dto: RegisterVendorDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw new ConflictError("An account with this email address already exists.");
    }

    let slug = slugify(dto.storeName);
    const existingSlug = await this.vendorRepo.findBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { user, vendor } = await this.vendorRepo.createVendorWithUser({
      user: {
        email: dto.email.toLowerCase().trim(),
        name: dto.ownerName.trim(),
        passwordHash,
        phone: dto.phone?.trim() || null,
        role: "VENDOR_OWNER" as UserRole,
        emailVerified: true,
      },
      vendor: {
        name: dto.storeName.trim(),
        slug,
        description: dto.storeDescription?.trim() || null,
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone?.trim() || null,
        status: "ACTIVE",
        commissionRate: 10.0,
        payoutMethod: "MOMO",
        momoNumber: dto.momoNumber?.trim() || null,
        momoNetwork: dto.momoNetwork?.trim() || "MTN",
      },
    });

    logger.info({ vendorId: vendor.id, slug: vendor.slug }, "Marketplace vendor registered successfully");

    const tokens = await authService._issueTokens(user.id);
    return {
      vendor,
      user: authService._safeUser(user),
      tokens,
    };
  }

  /**
   * Vendor private dashboard statistics.
   */
  async getVendorDashboard(vendorId: string) {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) throw new NotFoundError("Vendor not found.");

    const aggregates = await this.vendorRepo.getDashboardAggregates(vendorId);

    return {
      vendor,
      stats: {
        totalProducts: aggregates.totalProducts,
        inStock: aggregates.inStock,
        lowStock: aggregates.lowStock,
        grossSales: aggregates.grossSales,
        netEarnings: aggregates.netEarnings,
      },
      recentOrders: aggregates.recentSubOrders,
    };
  }

  /**
   * List all products for this vendor (Tenant-isolated).
   */
  async listVendorProducts(vendorId: string, page = 1, limit = 50, search?: string) {
    const result = await this.vendorRepo.findVendorProducts(vendorId, { page, limit, search });

    return {
      products: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Vendor creates a new product in their store.
   */
  async createVendorProduct(vendorId: string, dto: CreateVendorProductDto) {
    let slug = slugify(dto.name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const stockStatus =
      dto.stockQty !== undefined && dto.stockQty <= 0
        ? "OUT_OF_STOCK"
        : dto.stockQty !== undefined && dto.stockQty <= 3
        ? "LOW_STOCK"
        : "IN_STOCK";

    return this.vendorRepo.createProduct({
      name: dto.name.trim(),
      slug,
      description: dto.description.trim(),
      shortDesc: dto.shortDesc?.trim() || null,
      price: dto.price,
      salePrice: dto.salePrice ?? null,
      stockQty: dto.stockQty ?? null,
      stockStatus,
      version: 1,
      vendor: { connect: { id: vendorId } },
      categories:
        dto.categoryIds && dto.categoryIds.length > 0
          ? {
              connect: dto.categoryIds.map((id) => ({ id })),
            }
          : undefined,
      images: dto.imageUrl?.trim()
        ? {
            create: [
              {
                url: dto.imageUrl.trim(),
                alt: dto.name.trim(),
                sortOrder: 0,
              },
            ],
          }
        : undefined,
    });
  }

  /**
   * Vendor updates product with Optimistic Concurrency Control (OCC).
   *
   * IMPORTANT LINES EXPLAINED:
   * - `findVendorProductById`: Enforces Tenant Isolation — a vendor can NEVER update
   *   a product belonging to another merchant.
   * - `product.version !== expectedVersion`: Detects whether another store employee
   *   edited this product simultaneously. If so, rejects with 409 Conflict.
   * - `updateProductWithOcc`: Atomically increments `version` by 1.
   */
  async updateVendorProduct(
    vendorId: string,
    productId: string,
    dto: UpdateVendorProductDto,
    expectedVersion: number
  ) {
    // 1. Verify existence & tenant ownership
    const product = await this.vendorRepo.findVendorProductById(vendorId, productId);

    if (!product) {
      throw new NotFoundError("Product not found or you do not have permission to edit it.");
    }

    // 2. OCC Check: Reject stale updates to prevent lost updates
    if (product.version !== expectedVersion) {
      throw new ConflictError(
        `Optimistic lock conflict: This product was modified by another session (expected v${expectedVersion}, found v${product.version}). Please refresh and review before saving.`
      );
    }

    // 3. Determine stock status if stockQty is provided
    let stockStatus = dto.stockStatus;
    if (dto.stockQty !== undefined && dto.stockQty !== null && !stockStatus) {
      stockStatus =
        dto.stockQty <= 0
          ? "OUT_OF_STOCK"
          : dto.stockQty <= 3
          ? "LOW_STOCK"
          : "IN_STOCK";
    }

    // 4. Atomic update incrementing version
    const updated = await this.vendorRepo.updateProductWithOcc(productId, {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      shortDesc: dto.shortDesc?.trim(),
      price: dto.price,
      salePrice: dto.salePrice,
      stockQty: dto.stockQty,
      stockStatus,
      categories:
        dto.categoryIds && dto.categoryIds.length > 0
          ? {
              set: dto.categoryIds.map((id) => ({ id })),
            }
          : undefined,
    });

    logger.info(
      { productId, vendorId, newVersion: updated.version },
      "Vendor product updated with OCC increment"
    );

    return updated;
  }

  /**
   * Update vendor settings (MoMo, phone, description).
   */
  async updateVendorProfile(
    vendorId: string,
    data: {
      name?: string;
      description?: string;
      phone?: string;
      momoNumber?: string;
      momoNetwork?: string;
      logoUrl?: string;
      bannerUrl?: string;
    }
  ) {
    return this.vendorRepo.updateProfile(vendorId, {
      name: data.name?.trim(),
      description: data.description?.trim(),
      phone: data.phone?.trim(),
      momoNumber: data.momoNumber?.trim(),
      momoNetwork: data.momoNetwork?.trim(),
      logoUrl: data.logoUrl?.trim(),
      bannerUrl: data.bannerUrl?.trim(),
    });
  }
}
