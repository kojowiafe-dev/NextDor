import { z } from "zod";

export const PayoutStatusEnum = z.enum(["PENDING", "PROCESSING", "PAID", "FAILED"]);
export type PayoutStatus = z.infer<typeof PayoutStatusEnum>;

export const PayoutBatchStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "PARTIAL",
  "FAILED",
]);
export type PayoutBatchStatus = z.infer<typeof PayoutBatchStatusEnum>;

// Payout Batch Generation & Execution Schemas
export const CreatePayoutBatchSchema = z.object({
  vendorIds: z.array(z.string().uuid("Invalid vendor ID")).optional(),
  minThreshold: z.number().min(0).default(5), // Minimum GHS 5 balance for automatic disbursement
  notes: z.string().trim().max(500).optional(),
});
export type CreatePayoutBatchInput = z.infer<typeof CreatePayoutBatchSchema>;

export const ExecutePayoutBatchSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  notes: z.string().trim().optional(),
});
export type ExecutePayoutBatchInput = z.infer<typeof ExecutePayoutBatchSchema>;

// Paystack Transfer Webhook Event Schema
export const PaystackTransferWebhookSchema = z.object({
  event: z.enum([
    "transfer.success",
    "transfer.failed",
    "transfer.reversed",
  ]),
  data: z.object({
    amount: z.number(),
    currency: z.string().default("GHS"),
    reference: z.string(),
    transfer_code: z.string().optional(),
    transferred_at: z.string().optional(),
    failures: z.any().optional(),
    recipient: z
      .object({
        recipient_code: z.string().optional(),
        name: z.string().optional(),
        details: z
          .object({
            account_number: z.string().optional(),
            bank_code: z.string().optional(),
            bank_name: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});
export type PaystackTransferWebhook = z.infer<typeof PaystackTransferWebhookSchema>;

// Financial Ledger & Reconciliation Query
export const LedgerQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
export type LedgerQuery = z.infer<typeof LedgerQuerySchema>;

// Merchant Performance Analytics Query
export const MerchantAnalyticsQuerySchema = z.object({
  timeRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  vendorId: z.string().uuid().optional(),
});
export type MerchantAnalyticsQuery = z.infer<typeof MerchantAnalyticsQuerySchema>;
