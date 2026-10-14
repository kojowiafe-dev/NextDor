-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN "paystackRecipientCode" TEXT;

-- AlterTable
ALTER TABLE "vendor_payouts" ADD COLUMN "batchId" UUID,
ADD COLUMN "recipientCode" TEXT,
ADD COLUMN "failureReason" TEXT;

-- CreateTable
CREATE TABLE "payout_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batchReference" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'PENDING',
    "paystackBatchCode" TEXT,
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_batches_batchReference_key" ON "payout_batches"("batchReference");

-- CreateIndex
CREATE INDEX "payout_batches_status_idx" ON "payout_batches"("status");

-- CreateIndex
CREATE INDEX "payout_batches_batchReference_idx" ON "payout_batches"("batchReference");

-- CreateIndex
CREATE INDEX "vendor_payouts_batchId_idx" ON "vendor_payouts"("batchId");

-- AddForeignKey
ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payout_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
