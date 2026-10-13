/**
 * NextDor Ghana SMS Service — powered by Arkesel SMS API v2.
 *
 * Provides transactional SMS updates for:
 * 1. Order Confirmation (Order placed / paid)
 * 2. Order Shipped (Courier dispatch notification)
 * 3. Order Delivered (Confirmation of delivery)
 *
 * In development or when using placeholder keys, cleanly logs SMS messages to the terminal.
 */

import { config } from "../config/env.js";
import { logger } from "./logger.js";

function normalizeGhanaPhoneNumber(rawPhone: string): string | null {
  if (!rawPhone) return null;
  // Remove spaces, dashes, parentheses, pluses
  let cleaned = rawPhone.replace(/[\s\-\(\)\+]/g, "").trim();

  // If starts with 0 (e.g. 0244123456), convert to 233244123456
  if (/^0[235][0-9]{8}$/.test(cleaned)) {
    cleaned = "233" + cleaned.slice(1);
  }

  // If already starts with 233 (e.g. 233244123456)
  if (/^233[235][0-9]{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Fallback for general 9-15 digit numbers
  if (/^[0-9]{9,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export class SmsService {
  private static isConfigured(): boolean {
    return Boolean(
      config.ARKESEL_API_KEY &&
      !config.ARKESEL_API_KEY.includes("placeholder") &&
      !config.ARKESEL_API_KEY.startsWith("dev_")
    );
  }

  /**
   * Dispatches an SMS via Arkesel v2 API.
   */
  static async sendSms(to: string, message: string): Promise<boolean> {
    const isDev = config.NODE_ENV === "development";
    const recipient = normalizeGhanaPhoneNumber(to);

    if (!recipient) {
      logger.warn({ rawPhone: to }, "SmsService: invalid phone number format, skipping SMS dispatch");
      return false;
    }

    if (!this.isConfigured()) {
      logger.info(
        { recipient, message, sender: config.SMS_FROM },
        `📱 [DEV SMS] Message to ${recipient}: "${message}"`
      );
      return true;
    }

    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": config.ARKESEL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: config.SMS_FROM || "NextDor",
          message,
          recipients: [recipient],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const resJson = (await response.json()) as any;
      if (!response.ok || resJson.status === "error") {
        logger.error({ status: response.status, resJson, recipient }, "Arkesel SMS dispatch failed");
        return isDev;
      }

      logger.info({ recipient }, "Arkesel SMS dispatched successfully");
      return true;
    } catch (err) {
      logger.error({ err, recipient }, "Network error during Arkesel SMS dispatch");
      return isDev;
    }
  }

  /**
   * Triggered when an order is placed (before payment is necessarily complete).
   */
  static async sendOrderReceived(phone: string, orderNumber: string, total: number): Promise<boolean> {
    const formattedTotal = `GH₵${total.toFixed(2)}`;
    const msg = `NextDor: We received your order #${orderNumber} (${formattedTotal}). Track it at https://nextdor.online/track?order=${orderNumber}`;
    return this.sendSms(phone, msg);
  }

  /**
   * Triggered when an order is confirmed (payment settled).
   */
  static async sendOrderConfirmed(phone: string, orderNumber: string, total: number): Promise<boolean> {
    const formattedTotal = `GH₵${total.toFixed(2)}`;
    const msg = `NextDor: Your order #${orderNumber} (${formattedTotal}) is confirmed! We are preparing it for delivery. Track at https://nextdor.online/track?order=${orderNumber}`;
    return this.sendSms(phone, msg);
  }

  /**
   * Triggered when order is marked as SHIPPED.
   */
  static async sendOrderShipped(phone: string, orderNumber: string): Promise<boolean> {
    const msg = `NextDor: Great news! Order #${orderNumber} has been dispatched with our courier and is on its way to you. Track live at https://nextdor.online/track?order=${orderNumber}`;
    return this.sendSms(phone, msg);
  }

  /**
   * Triggered when order is marked as DELIVERED.
   */
  static async sendOrderDelivered(phone: string, orderNumber: string): Promise<boolean> {
    const msg = `NextDor: Order #${orderNumber} has been delivered! Thank you for shopping with us. For inquiries or support, visit https://nextdor.online/contact`;
    return this.sendSms(phone, msg);
  }
}
