import { z } from "zod";

export const StockMovementTypeEnum = z.enum([
  "RECEIVE",
  "ORDER_RESERVED",
  "ORDER_FULFILLED",
  "ORDER_CANCELLED",
  "RESTOCK",
  "RETURN_RESTOCK",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "MANUAL_ADJUSTMENT",
]);
export type StockMovementType = z.infer<typeof StockMovementTypeEnum>;

export const StockAlertTypeEnum = z.enum([
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "BACKORDER_THRESHOLD",
]);
export type StockAlertType = z.infer<typeof StockAlertTypeEnum>;

export const StockAlertStatusEnum = z.enum([
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
]);
export type StockAlertStatus = z.infer<typeof StockAlertStatusEnum>;

export const StockStatusEnum = z.enum([
  "IN_STOCK",
  "OUT_OF_STOCK",
  "LOW_STOCK",
  "BACKORDER",
  "PRE_ORDER",
]);
export type StockStatus = z.infer<typeof StockStatusEnum>;

// ─── Warehouse Schemas ───────────────────────────────────────────────────────

export const CreateWarehouseSchema = z.object({
  name: z.string().min(2, "Warehouse name must have at least 2 characters").max(100),
  code: z
    .string()
    .min(2, "Code must have at least 2 characters")
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase alphanumeric characters, dashes, and underscores"),
  address: z.string().min(3, "Address is required"),
  city: z.string().min(2, "City is required"),
  region: z.string().min(2, "Region is required"),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Invalid contact email").optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  vendorId: z.string().uuid("Invalid vendor UUID").optional(),
});
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;

export const WarehouseQuerySchema = z.object({
  city: z.string().optional(),
  region: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  search: z.string().optional(),
  vendorId: z.string().uuid().optional(),
});
export type WarehouseQuery = z.infer<typeof WarehouseQuerySchema>;

// ─── Stock Allocation & Adjustment Schemas ───────────────────────────────────

export const SetWarehouseStockSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse UUID"),
  productId: z.string().uuid("Invalid product UUID"),
  quantity: z.number().int().min(0, "Stock quantity cannot be negative"),
  lowStockThreshold: z.number().int().min(0).optional().default(5),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(1).optional(),
  binLocation: z.string().max(50).optional(),
  reason: z.string().optional(),
});
export type SetWarehouseStockInput = z.infer<typeof SetWarehouseStockSchema>;

export const AdjustStockSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse UUID"),
  productId: z.string().uuid("Invalid product UUID"),
  delta: z.number().int().refine((val) => val !== 0, "Delta cannot be zero"),
  type: StockMovementTypeEnum.optional().default("MANUAL_ADJUSTMENT"),
  reason: z.string().min(3, "Reason for stock adjustment is required"),
  referenceId: z.string().optional(),
});
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

export const StockTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid("Invalid source warehouse UUID"),
  destinationWarehouseId: z.string().uuid("Invalid destination warehouse UUID"),
  productId: z.string().uuid("Invalid product UUID"),
  quantity: z.number().int().positive("Transfer quantity must be greater than zero"),
  notes: z.string().optional(),
  transferReference: z.string().optional(),
}).refine(
  (data) => data.sourceWarehouseId !== data.destinationWarehouseId,
  { message: "Source and destination warehouses must be different", path: ["destinationWarehouseId"] }
);
export type StockTransferInput = z.infer<typeof StockTransferSchema>;

// ─── Backorder & Pre-Order Configuration Schema ──────────────────────────────

export const BackorderConfigSchema = z.object({
  productId: z.string().uuid("Invalid product UUID"),
  allowBackorder: z.boolean(),
  backorderLimit: z.number().int().min(0).nullable().optional(),
  expectedRestockDate: z.string().datetime().nullable().optional(),
  isPreOrder: z.boolean().optional().default(false),
  preOrderReleaseDate: z.string().datetime().nullable().optional(),
});
export type BackorderConfigInput = z.infer<typeof BackorderConfigSchema>;

// ─── Alert Schemas ───────────────────────────────────────────────────────────

export const StockAlertQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  status: StockAlertStatusEnum.optional(),
  alertType: StockAlertTypeEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type StockAlertQuery = z.infer<typeof StockAlertQuerySchema>;

export const ResolveAlertSchema = z.object({
  notes: z.string().min(2, "Notes are required to resolve an alert"),
});
export type ResolveAlertInput = z.infer<typeof ResolveAlertSchema>;

// ─── Stock Movement Ledger Query ─────────────────────────────────────────────

export const StockMovementQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  type: StockMovementTypeEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});
export type StockMovementQuery = z.infer<typeof StockMovementQuerySchema>;

// ─── Low-Stock Webhook Payload ───────────────────────────────────────────────

export const LowStockWebhookPayloadSchema = z.object({
  event: z.literal("inventory.low_stock"),
  alertId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  warehouseId: z.string().uuid(),
  warehouseName: z.string(),
  warehouseCode: z.string(),
  currentStock: z.number().int(),
  threshold: z.number().int(),
  vendorId: z.string().uuid().nullable().optional(),
  timestamp: z.string().datetime(),
});
export type LowStockWebhookPayload = z.infer<typeof LowStockWebhookPayloadSchema>;
