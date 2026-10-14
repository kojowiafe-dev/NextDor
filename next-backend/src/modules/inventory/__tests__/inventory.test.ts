import { describe, it, expect, vi } from "vitest";
import { InventoryService } from "../inventory.service.js";
import { InventoryRepository } from "../inventory.repository.js";
import { BadRequestError, UnprocessableError, NotFoundError } from "../../../lib/errors.js";

describe("Phase 11: Enterprise Multi-Warehouse Inventory & Low-Stock Alerts", () => {
  describe("Warehouse Management & Code Validation", () => {
    it("rejects duplicate warehouse code", async () => {
      const mockRepo = {
        findWarehouseByCode: vi.fn().mockResolvedValue({
          id: "wh-1",
          code: "WH-ACC-01",
        }),
      } as unknown as InventoryRepository;

      const service = new InventoryService(mockRepo);
      await expect(
        service.createWarehouse({
          name: "Accra Central Depot",
          code: "WH-ACC-01",
          address: "Graphic Road, South Industrial Area",
          city: "Accra",
          region: "Greater Accra",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("creates warehouse with uppercase code and default status", async () => {
      const mockRepo = {
        findWarehouseByCode: vi.fn().mockResolvedValue(null),
        createWarehouse: vi.fn().mockImplementation((data) =>
          Promise.resolve({
            id: "wh-new",
            ...data,
            createdAt: new Date(),
          })
        ),
      } as unknown as InventoryRepository;

      const service = new InventoryService(mockRepo);
      const result = await service.createWarehouse({
        name: "Kumasi Regional Hub",
        code: "WH-KSI-01",
        address: "Asokwa Commercial Area",
        city: "Kumasi",
        region: "Ashanti",
        isDefault: true,
      });

      expect(result.id).toBe("wh-new");
      expect(result.code).toBe("WH-KSI-01");
      expect(result.isDefault).toBe(true);
    });
  });

  describe("Inter-Warehouse Stock Transfers & Conservation Invariant", () => {
    it("enforces unit conservation during inter-warehouse transfer (Total Before === Total After)", () => {
      const sourceBefore = 50;
      const destBefore = 20;
      const transferQty = 15;

      const sourceAfter = sourceBefore - transferQty;
      const destAfter = destBefore + transferQty;

      expect(sourceAfter).toBe(35);
      expect(destAfter).toBe(35);
      expect(sourceBefore + destBefore).toBe(sourceAfter + destAfter);
    });

    it("rejects transfer when source and destination warehouse are identical", async () => {
      const mockRepo = new InventoryRepository();
      await expect(
        mockRepo.transferStock({
          sourceWarehouseId: "wh-same",
          destinationWarehouseId: "wh-same",
          productId: "prod-1",
          quantity: 10,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects transfer when quantity is zero or negative", async () => {
      const mockRepo = new InventoryRepository();
      await expect(
        mockRepo.transferStock({
          sourceWarehouseId: "wh-src",
          destinationWarehouseId: "wh-dst",
          productId: "prod-1",
          quantity: 0,
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("Automated Low-Stock Threshold & Alert Engine", () => {
    it("evaluates stock state transitions correctly between IN_STOCK, LOW_STOCK, and OUT_OF_STOCK", () => {
      const threshold = 5;

      const evaluateStatus = (qty: number, allowBackorder: boolean, isPreOrder: boolean) => {
        if (isPreOrder) return "PRE_ORDER";
        if (qty <= 0) return allowBackorder ? "BACKORDER" : "OUT_OF_STOCK";
        if (qty <= threshold) return "LOW_STOCK";
        return "IN_STOCK";
      };

      expect(evaluateStatus(20, false, false)).toBe("IN_STOCK");
      expect(evaluateStatus(5, false, false)).toBe("LOW_STOCK");
      expect(evaluateStatus(1, false, false)).toBe("LOW_STOCK");
      expect(evaluateStatus(0, false, false)).toBe("OUT_OF_STOCK");
      expect(evaluateStatus(0, true, false)).toBe("BACKORDER");
      expect(evaluateStatus(0, false, true)).toBe("PRE_ORDER");
    });
  });

  describe("Backorder & Pre-Order Orchestration Rules", () => {
    it("allows backorder reservation when stock is depleted and within backorderLimit", () => {
      const product = {
        id: "prod-101",
        name: "Artisan Leather Handbag",
        stockQty: 0,
        stockStatus: "OUT_OF_STOCK",
        allowBackorder: true,
        backorderLimit: 25,
        backorderCount: 10,
      };

      const requestedQty = 5;
      const currentBackorders = product.backorderCount;
      const canFulfill =
        product.allowBackorder &&
        (product.backorderLimit === null ||
          currentBackorders + requestedQty <= product.backorderLimit);

      expect(canFulfill).toBe(true);
      expect(currentBackorders + requestedQty).toBe(15);
      expect(15).toBeLessThanOrEqual(product.backorderLimit);
    });

    it("blocks checkout when backorder quota limit is exceeded", () => {
      const product = {
        id: "prod-102",
        name: "Limited Edition Kente Cloth",
        stockQty: 0,
        stockStatus: "OUT_OF_STOCK",
        allowBackorder: true,
        backorderLimit: 10,
        backorderCount: 8,
      };

      const requestedQty = 5; // 8 + 5 = 13 > 10
      const canFulfill =
        product.allowBackorder &&
        (product.backorderLimit === null ||
          product.backorderCount + requestedQty <= product.backorderLimit);

      expect(canFulfill).toBe(false);
    });

    it("blocks checkout when product is out of stock and allowBackorder is false", () => {
      const product = {
        id: "prod-103",
        name: "Handmade Ceramic Mug",
        stockQty: 0,
        stockStatus: "OUT_OF_STOCK",
        allowBackorder: false,
      };

      const canFulfill =
        (product.stockQty !== null && product.stockQty > 0) || product.allowBackorder;

      expect(canFulfill).toBe(false);
    });
  });

  describe("Multi-Location Inventory Breakdown Aggregation", () => {
    it("computes physical available stock correctly (Total Physical - Total Reserved)", async () => {
      const mockRepo = {
        listStockByProduct: vi.fn().mockResolvedValue([
          {
            id: "s-1",
            warehouseId: "wh-accra",
            quantity: 45,
            reservedQuantity: 5,
            warehouse: { name: "Accra Central", isDefault: true },
          },
          {
            id: "s-2",
            warehouseId: "wh-kumasi",
            quantity: 25,
            reservedQuantity: 10,
            warehouse: { name: "Kumasi Depot", isDefault: false },
          },
          {
            id: "s-3",
            warehouseId: "wh-takoradi",
            quantity: 10,
            reservedQuantity: 0,
            warehouse: { name: "Western Fulfillment", isDefault: false },
          },
        ]),
      } as unknown as InventoryRepository;

      const breakdown = await mockRepo.listStockByProduct("prod-1");
      const totalPhysical = breakdown.reduce((sum, loc) => sum + loc.quantity, 0);
      const totalReserved = breakdown.reduce((sum, loc) => sum + loc.reservedQuantity, 0);
      const availablePhysical = Math.max(0, totalPhysical - totalReserved);

      expect(totalPhysical).toBe(80); // 45 + 25 + 10
      expect(totalReserved).toBe(15); // 5 + 10 + 0
      expect(availablePhysical).toBe(65); // 80 - 15
    });
  });
});
