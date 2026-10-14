-- AlterEnum
ALTER TYPE "StockStatus" ADD VALUE IF NOT EXISTS 'BACKORDER';
ALTER TYPE "StockStatus" ADD VALUE IF NOT EXISTS 'PRE_ORDER';

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIVE', 'ORDER_RESERVED', 'ORDER_FULFILLED', 'ORDER_CANCELLED', 'RESTOCK', 'RETURN_RESTOCK', 'TRANSFER_IN', 'TRANSFER_OUT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockAlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'BACKORDER_THRESHOLD');

-- CreateEnum
CREATE TYPE "StockAlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN "lowStockAlertEmail" TEXT,
ADD COLUMN "lowStockAlertPhone" TEXT,
ADD COLUMN "enableLowStockAlerts" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "backorderLimit" INTEGER,
ADD COLUMN "backorderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "expectedRestockDate" TIMESTAMP(3),
ADD COLUMN "isPreOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preOrderReleaseDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "warehouseId" UUID,
ADD COLUMN "isBackorder" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendorId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "reorderPoint" INTEGER,
    "reorderQuantity" INTEGER,
    "binLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "performedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "vendorId" UUID,
    "alertType" "StockAlertType" NOT NULL DEFAULT 'LOW_STOCK',
    "threshold" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "status" "StockAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "channel" TEXT NOT NULL DEFAULT 'EMAIL_AND_SMS',
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");
CREATE INDEX "warehouses_vendorId_idx" ON "warehouses"("vendorId");
CREATE INDEX "warehouses_city_idx" ON "warehouses"("city");
CREATE INDEX "warehouses_region_idx" ON "warehouses"("region");
CREATE INDEX "warehouses_code_idx" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stocks_warehouseId_productId_key" ON "warehouse_stocks"("warehouseId", "productId");
CREATE INDEX "warehouse_stocks_warehouseId_idx" ON "warehouse_stocks"("warehouseId");
CREATE INDEX "warehouse_stocks_productId_idx" ON "warehouse_stocks"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "stock_alerts_warehouseId_idx" ON "stock_alerts"("warehouseId");
CREATE INDEX "stock_alerts_productId_idx" ON "stock_alerts"("productId");
CREATE INDEX "stock_alerts_vendorId_idx" ON "stock_alerts"("vendorId");
CREATE INDEX "stock_alerts_status_idx" ON "stock_alerts"("status");

-- CreateIndex
CREATE INDEX "order_items_warehouseId_idx" ON "order_items"("warehouseId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
