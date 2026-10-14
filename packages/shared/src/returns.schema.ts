import { z } from "zod";

export const ReturnReasonEnum = z.enum([
  "DAMAGED_ITEM",
  "DEFECTIVE_PRODUCT",
  "WRONG_ITEM_SENT",
  "NOT_AS_DESCRIBED",
  "MISSING_PARTS",
  "OTHER",
]);

export type ReturnReason = z.infer<typeof ReturnReasonEnum>;

export const ReturnStatusEnum = z.enum([
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REFUNDED",
]);

export type ReturnStatus = z.infer<typeof ReturnStatusEnum>;

export const CreateReturnRequestSchema = z.object({
  reason: ReturnReasonEnum,
  details: z.string().trim().min(5, "Please provide more details about why you are requesting a return").max(1000),
  evidenceUrls: z.array(z.string().url()).max(5).default([]),
  items: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ).min(1, "At least one item must be selected for return"),
});

export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestSchema>;

export const ReviewReturnRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional(),
});

export type ReviewReturnRequestInput = z.infer<typeof ReviewReturnRequestSchema>;

export const DisputeReturnRequestSchema = z.object({
  disputeNotes: z.string().trim().min(5, "Please explain the reason for dispute").max(1000),
});

export type DisputeReturnRequestInput = z.infer<typeof DisputeReturnRequestSchema>;
