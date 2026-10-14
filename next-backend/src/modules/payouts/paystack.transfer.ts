import { config } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { toPesewas } from "../payments/paystack.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_TIMEOUT_MS = 12_000;

export type MobileMoneyNetwork = "MTN" | "TELECEL" | "VODAFONE" | "AT" | "AIRTELTIGO";

/**
 * Maps Ghanaian mobile money network names to official Paystack Ghana bank codes.
 */
export function getMomoBankCode(network?: string | null): string {
  const norm = (network ?? "").trim().toUpperCase();
  if (norm.includes("MTN")) return "MTN";
  if (norm.includes("TELECEL") || norm.includes("VODAFONE") || norm.includes("VOD")) return "VOD";
  if (norm.includes("AT") || norm.includes("AIRTEL") || norm.includes("TIGO")) return "ATL";
  return "MTN"; // Default in Ghana
}

export interface PaystackTransferRecipientResponse {
  status: boolean;
  message: string;
  data?: {
    recipient_code: string;
    type: string;
    name: string;
    details: {
      account_number: string;
      bank_code: string;
      bank_name: string;
    };
  };
}

export interface PaystackTransferInitiateResponse {
  status: boolean;
  message: string;
  data?: {
    transfer_code: string;
    reference: string;
    amount: number;
    status: string; // "pending", "success", "failed"
    transferred_at?: string;
  };
}

export class PaystackTransferClient {
  private static async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
    });
    return (await res.json()) as T;
  }

  /**
   * Creates or resolves a Paystack Transfer Recipient for a Ghanaian mobile money wallet.
   */
  static async createMomoRecipient(params: {
    vendorName: string;
    momoNumber: string;
    momoNetwork?: string | null;
  }): Promise<string> {
    const isDev = config.NODE_ENV !== "production";
    const isMock =
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY.includes("placeholder") ||
      config.PAYSTACK_SECRET_KEY.startsWith("sk_test_");

    const bankCode = getMomoBankCode(params.momoNetwork);

    try {
      const response = await this.request<PaystackTransferRecipientResponse>("/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
          type: "mobile_money",
          name: params.vendorName,
          account_number: params.momoNumber.replace(/\D/g, ""),
          bank_code: bankCode,
          currency: "GHS",
          description: `Vendor payout recipient for ${params.vendorName}`,
        }),
      });

      if (response.status && response.data?.recipient_code) {
        return response.data.recipient_code;
      }

      if (isDev || isMock) {
        logger.info(
          { vendor: params.vendorName, bankCode },
          "[DEV/MOCK] Paystack transfer recipient generated locally"
        );
        return `RCP_DEV_${Date.now().toString(36)}`;
      }

      throw new Error(response.message || "Failed to create Paystack transfer recipient");
    } catch (err: any) {
      if (isDev || isMock) {
        logger.warn({ err: err?.message }, "[DEV/MOCK] Transfer recipient fallback used in dev");
        return `RCP_DEV_${Date.now().toString(36)}`;
      }
      throw err;
    }
  }

  /**
   * Initiates a single Mobile Money transfer via Paystack.
   */
  static async initiateTransfer(params: {
    recipientCode: string;
    amountGhs: number;
    reference: string;
    reason: string;
  }): Promise<PaystackTransferInitiateResponse> {
    const isDev = config.NODE_ENV !== "production";
    const isMock =
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY.includes("placeholder") ||
      config.PAYSTACK_SECRET_KEY.startsWith("sk_test_");

    const amountPesewas = toPesewas(params.amountGhs);

    try {
      const response = await this.request<PaystackTransferInitiateResponse>("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: amountPesewas,
          recipient: params.recipientCode,
          reference: params.reference,
          reason: params.reason,
          currency: "GHS",
        }),
      });

      if (response.status && response.data) {
        return response;
      }

      if (isDev || isMock) {
        return {
          status: true,
          message: "Simulated transfer successful in test environment",
          data: {
            transfer_code: `TRF_DEV_${Date.now().toString(36)}`,
            reference: params.reference,
            amount: amountPesewas,
            status: "success",
            transferred_at: new Date().toISOString(),
          },
        };
      }

      throw new Error(response.message || "Failed to initiate transfer via Paystack");
    } catch (err: any) {
      if (isDev || isMock) {
        logger.info({ reference: params.reference }, "[DEV] Simulated payout transfer completed");
        return {
          status: true,
          message: "Transfer simulated in dev mode",
          data: {
            transfer_code: `TRF_DEV_${Date.now().toString(36)}`,
            reference: params.reference,
            amount: amountPesewas,
            status: "success",
            transferred_at: new Date().toISOString(),
          },
        };
      }
      throw err;
    }
  }
}
