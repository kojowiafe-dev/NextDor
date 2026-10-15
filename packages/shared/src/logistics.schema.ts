import { z } from "zod";

export const DeliveryMethodEnum = z.enum(["STANDARD", "EXPRESS", "PICKUP"]);
export type DeliveryMethod = z.infer<typeof DeliveryMethodEnum>;

export const ShipmentStatusEnum = z.enum([
  "LABEL_CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_ATTEMPT",
  "RETURNED",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusEnum>;

// Delivery quote calculation schema
export const DeliveryQuoteRequestSchema = z.object({
  region: z.string().trim().min(2, "Region is required"),
  district: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  digitalAddress: z.string().trim().optional(), // e.g. GA-183-9281
  weightKg: z.number().nonnegative().default(1),
  method: DeliveryMethodEnum.optional(),
});
export type DeliveryQuoteRequest = z.infer<typeof DeliveryQuoteRequestSchema>;

export const DeliveryQuoteOptionSchema = z.object({
  method: DeliveryMethodEnum,
  baseFee: z.number(),
  weightFee: z.number(),
  totalFee: z.number(),
  minDays: z.number(),
  maxDays: z.number(),
  zoneCode: z.string(),
  zoneName: z.string(),
});
export type DeliveryQuoteOption = z.infer<typeof DeliveryQuoteOptionSchema>;

// Admin Delivery Zone & Rate Schemas
export const DeliveryRateInputSchema = z.object({
  deliveryMethod: DeliveryMethodEnum,
  baseFee: z.number().min(0, "Base fee must be non-negative"),
  perKgFee: z.number().min(0).default(0),
  minDays: z.number().int().min(0).default(1),
  maxDays: z.number().int().min(1).default(3),
  isActive: z.boolean().default(true),
});
export type DeliveryRateInput = z.infer<typeof DeliveryRateInputSchema>;

export const CreateDeliveryZoneSchema = z.object({
  name: z.string().trim().min(2, "Zone name must be at least 2 characters"),
  code: z.string().trim().min(2, "Zone code must be unique identifier").toUpperCase(),
  region: z.string().trim().min(2, "Region is required"),
  districts: z.array(z.string().trim()).default([]),
  postCodePrefixes: z.array(z.string().trim().toUpperCase()).default([]),
  isActive: z.boolean().default(true),
  rates: z.array(DeliveryRateInputSchema).optional(),
});
export type CreateDeliveryZoneInput = z.infer<typeof CreateDeliveryZoneSchema>;

export const UpdateDeliveryZoneSchema = CreateDeliveryZoneSchema.partial();
export type UpdateDeliveryZoneInput = z.infer<typeof UpdateDeliveryZoneSchema>;

// Courier Dispatch & Tracking Schemas
export const CreateShipmentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  vendorOrderId: z.string().uuid("Invalid vendor order ID").optional(),
  vendorId: z.string().uuid("Invalid vendor ID").optional(),
  carrier: z.string().trim().min(2, "Carrier name is required"),
  trackingNumber: z.string().trim().min(3, "Tracking number is required"),
  trackingUrl: z.string().url("Invalid tracking URL").optional().or(z.literal("")),
  courierName: z.string().trim().optional(),
  courierPhone: z.string().trim().optional(),
  dispatchNotes: z.string().trim().optional(),
  estimatedDelivery: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;

// Inbound Courier Webhook Payload Schema
export const CourierWebhookPayloadSchema = z.object({
  carrier: z.string().trim().min(1),
  trackingNumber: z.string().trim().min(1),
  status: ShipmentStatusEnum,
  location: z.string().trim().optional(),
  description: z.string().trim().optional(),
  timestamp: z.string().datetime().optional(),
  courierName: z.string().trim().optional(),
  courierPhone: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CourierWebhookPayload = z.infer<typeof CourierWebhookPayloadSchema>;
