import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";

describe("E2E: Multi-Warehouse Inventory, Stock Transfers & Audit Sweep", { timeout: 35000 }, () => {
  let app: FastifyInstance;

  const testId = Date.now();
  const testAdminEmail = `wh_admin_${testId}@nextdor.test`;

  let adminUserId = "";
  let adminToken = "";
  let testProductId = "";
  let warehouseAId = "";
  let warehouseBId = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create an admin user
    const admin = await prisma.user.create({
      data: {
        name: "Warehouse Logistics Manager",
        email: testAdminEmail,
        passwordHash: "bcrypt_hashed_dummy_pw",
        role: "ADMIN",
        emailVerified: true,
      },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign(
      { sub: admin.id, role: "ADMIN", email: admin.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Find an existing product or create one
    let product = await prisma.product.findFirst({
      where: { deletedAt: null, stockStatus: "IN_STOCK" },
    });

    if (!product) {
      const vendor = await prisma.vendor.create({
        data: {
          name: `Logistics Vendor ${testId}`,
          slug: `logistics-vendor-${testId}`,
          email: `log_vendor_${testId}@nextdor.test`,
          phone: "+233209998877",
          status: "APPROVED",
        },
      });

      product = await prisma.product.create({
        data: {
          name: `Handwoven Kente Cloth ${testId}`,
          description: "Authentic Bonwire handwoven Kente strips",
          slug: `kente-cloth-${testId}`,
          price: 350.0,
          stockQty: 100,
          stockStatus: "IN_STOCK",
          vendorId: vendor.id,
        },
      });
    }

    testProductId = product.id;
  });

  afterAll(async () => {
    try {
      // Clean up stock movements, stock alerts, warehouse stocks, and warehouses
      if (warehouseAId || warehouseBId) {
        const whIds = [warehouseAId, warehouseBId].filter(Boolean);
        await prisma.stockMovement.deleteMany({
          where: { warehouseId: { in: whIds } },
        });
        await prisma.stockAlert.deleteMany({ where: { warehouseId: { in: whIds } } });
        await prisma.warehouseStock.deleteMany({ where: { warehouseId: { in: whIds } } });
        await prisma.warehouse.deleteMany({ where: { id: { in: whIds } } });
      }

      if (adminUserId) {
        await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
      }
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it("creates primary fulfillment hub and regional distribution depot via POST /api/v1/inventory/warehouses", async () => {
    // 1. Create Warehouse A (Accra Hub)
    const resA = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/warehouses",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: `Accra Central Fulfillment Hub ${testId}`,
        code: `WH-ACC-${testId.toString().slice(-4)}`,
        address: "Plot 12, Spintex Road Industrial Area",
        city: "Accra",
        region: "Greater Accra",
        contactName: "Kwesi Appiah",
        contactPhone: "+233241112233",
        isDefault: true,
        isActive: true,
      },
    });

    expect(resA.statusCode).toBe(201);
    const bodyA = JSON.parse(resA.payload);
    expect(bodyA.success).toBe(true);
    expect(bodyA.data.warehouse.id).toBeDefined();
    warehouseAId = bodyA.data.warehouse.id;

    // 2. Create Warehouse B (Kumasi Depot)
    const resB = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/warehouses",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: `Kumasi Regional Logistics Depot ${testId}`,
        code: `WH-KMS-${testId.toString().slice(-4)}`,
        address: "Asokwa Commercial Zone, Plot 5",
        city: "Kumasi",
        region: "Ashanti",
        contactName: "Yaw Boateng",
        contactPhone: "+233202223344",
        isDefault: false,
        isActive: true,
      },
    });

    expect(resB.statusCode).toBe(201);
    const bodyB = JSON.parse(resB.payload);
    expect(bodyB.success).toBe(true);
    expect(bodyB.data.warehouse.id).toBeDefined();
    warehouseBId = bodyB.data.warehouse.id;
  });

  it("initializes on-shelf inventory levels at Accra Hub via POST /api/v1/inventory/stock/set", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/stock/set",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        warehouseId: warehouseAId,
        productId: testProductId,
        quantity: 50,
        lowStockThreshold: 10,
        binLocation: "AISLE-3-SHELF-B",
        reason: "Initial physical inventory intake at central warehouse",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.stock.quantity).toBe(50);
  });

  it("executes inter-warehouse stock transfer preserving unit conservation invariant", async () => {
    const transferQty = 20;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/stock/transfer",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sourceWarehouseId: warehouseAId,
        destinationWarehouseId: warehouseBId,
        productId: testProductId,
        quantity: transferQty,
        notes: "Restocking Ashanti regional distribution depot for weekend surge",
        transferReference: `XFER-${testId.toString().slice(-6)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // Verify stock at source is decremented by 20 (50 - 20 = 30)
    const sourceStock = await prisma.warehouseStock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: warehouseAId,
          productId: testProductId,
        },
      },
    });
    expect(sourceStock?.quantity).toBe(30);

    // Verify stock at destination is incremented by 20 (0 + 20 = 20)
    const destStock = await prisma.warehouseStock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: warehouseBId,
          productId: testProductId,
        },
      },
    });
    expect(destStock?.quantity).toBe(20);

    // UNIT CONSERVATION INVARIANT: Total units across warehouses remains exactly 50
    expect((sourceStock?.quantity ?? 0) + (destStock?.quantity ?? 0)).toBe(50);
  });

  it("manually adjusts inventory with immutable audit logging via POST /api/v1/inventory/stock/adjust", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/stock/adjust",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        warehouseId: warehouseBId,
        productId: testProductId,
        delta: 5,
        reason: "Received supplementary shipment from artisan workshop",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.stock.quantity).toBe(25);
  });

  it("triggers automated low-stock audit sweep webhook across active warehouses", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/webhooks/trigger-audit",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.auditedLocationsCount).toBe("number");
    expect(typeof body.data.triggeredAlertsCount).toBe("number");
  });
});
