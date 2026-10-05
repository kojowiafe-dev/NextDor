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
import crypto from "node:crypto";
import { CommissionCalculator } from "../../domain/CommissionCalculator.js";
import { authService } from "../auth/auth.service.js";
import {
  ConflictError,
  NotFoundError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { AuditService } from "../audit/audit.service.js";
import { prisma } from "../../lib/prisma.js";
import { EmailService } from "../../lib/email.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import { slugify } from "../../lib/slugify.js";
import type { UserRole, VendorOrderStatus, PayoutStatus } from "@prisma/client";

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
        emailVerified: false, // FIX #6: Enforce email verification for vendor accounts
      },
      vendor: {
        name: dto.storeName.trim(),
        slug,
        description: dto.storeDescription?.trim() || null,
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone?.trim() || null,
        status: "PENDING_APPROVAL",
        commissionRate: 10.0,
        payoutMethod: "MOMO",
        momoNumber: dto.momoNumber?.trim() || null,
        momoNetwork: dto.momoNetwork?.trim() || "MTN",
      },
    });

    logger.info({ vendorId: vendor.id, slug: vendor.slug }, "Marketplace vendor registered successfully (pending admin approval)");

    // Record registration in platform Audit Trail
    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      action: "VENDOR_REGISTERED",
      entity: "Vendor",
      entityId: vendor.id,
      details: {
        storeName: vendor.name,
        slug: vendor.slug,
        ownerEmail: user.email,
        phone: user.phone,
        momoNetwork: vendor.momoNetwork,
        momoNumber: vendor.momoNumber,
        status: "PENDING_APPROVAL",
      },
      ipAddress: "Self-Serve Onboarding",
    });

    // Generate 6-digit OTP verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.authCode.create({
      data: {
        email: user.email,
        codeHash,
        type: "VERIFY_EMAIL",
        expiresAt,
      },
    });

    // FIX #13: Send email asynchronously via BullMQ / non-blocking queue
    await dispatchEmailAsync({
      type: "verification",
      email: user.email,
      name: user.name,
      code,
    });
    logger.info({ vendorId: vendor.id, email: user.email }, "auth: verification code dispatched for new vendor");

    return {
      vendor,
      user: authService._safeUser(user),
      requiresVerification: true,
      email: user.email,
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
      images: dto.imageUrl?.trim()
        ? {
            deleteMany: {},
            create: [
              {
                url: dto.imageUrl.trim(),
                alt: dto.name?.trim() || product.name,
                sortOrder: 0,
              },
            ],
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
   * Vendor soft-deletes a product they own.
   * Strictly enforces Tenant Isolation: WHERE id = productId AND vendorId = currentVendorId
   */
  async deleteVendorProduct(vendorId: string, productId: string) {
    const product = await this.vendorRepo.findVendorProductById(vendorId, productId);
    if (!product) {
      throw new NotFoundError("Product not found or you do not have permission to delete it.");
    }
    await this.vendorRepo.softDeleteProduct(productId);
    logger.info({ productId, vendorId }, "Vendor product soft-deleted");
    return { success: true };
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

  /**
   * List customer sub-orders for this vendor (Tenant-isolated).
   */
  async listVendorOrders(vendorId: string, page = 1, limit = 20, status?: string) {
    return this.vendorRepo.findVendorOrders(vendorId, { page, limit, status });
  }

  /**
   * Update sub-order dispatch status (e.g. PROCESSING -> SHIPPED -> DELIVERED).
   * Automatically initiates 48h escrow clearance timer when marked DELIVERED.
   * Emits an immutable audit log entry.
   */
  async updateVendorOrderStatus(
    vendorId: string,
    vendorOrderId: string,
    status: VendorOrderStatus,
    notes?: string,
    auditContext?: {
      userId?: string;
      userEmail?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    const existing = await this.vendorRepo.findVendorOrderById(vendorId, vendorOrderId);
    if (!existing) {
      throw new NotFoundError("Sub-order not found or does not belong to your store.");
    }

    const previousStatus = existing.status;
    const updated = await this.vendorRepo.updateVendorOrderStatus(vendorId, vendorOrderId, status, notes);

    // Record in immutable Audit Trail
    await AuditService.log({
      userId: auditContext?.userId,
      userEmail: auditContext?.userEmail,
      action: "ORDER_DISPATCH_UPDATED",
      entity: "VendorOrder",
      entityId: vendorOrderId,
      details: {
        orderNumber: existing.order.number,
        previousStatus,
        newStatus: status,
        notes: notes || null,
        clearedAt: updated.clearedAt,
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    });

    logger.info(
      { vendorOrderId, vendorId, previousStatus, newStatus: status },
      "Merchant updated sub-order dispatch status"
    );

    return updated;
  }

  /**
   * Get vendor payout ledger and 48-hour escrow settlement breakdown.
   */
  async getVendorPayoutsAndEscrow(vendorId: string, page = 1, limit = 20, status?: string) {
    return this.vendorRepo.findVendorPayouts(vendorId, { page, limit, status });
  }
}
