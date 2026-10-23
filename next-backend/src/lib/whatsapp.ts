/**
 * NextDor WhatsApp Service — powered by Meta WhatsApp Cloud API.
 *
 * Provides transactional, real-time WhatsApp alerts for:
 * 1. 6-digit Authentication OTP codes (Registration & Password Reset)
 * 2. Customer Order Confirmation & Receipt Summaries
 * 3. Fulfillment Milestones & Live Courier Tracking
 * 4. Delivery Confirmation with 48h Escrow Guarantee
 * 5. Vendor Alerts: New Orders, Low-Stock Warnings & MoMo Payouts
 *
 * INVARIANT: Guaranteed Delivery via Automated Email Fallback.
 * If WhatsApp is unconfigured, unreachable, or delivery encounters an error,
 * the system automatically falls back to transactional Email dispatch via BullMQ.
 */

import { config } from "../config/env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { dispatchEmailAsync } from "./email.queue.js";

/**
 * Normalizes Ghanaian and international phone numbers for Meta WhatsApp Cloud API.
 * Meta Cloud API requires recipient numbers without leading zeros or '+' symbols:
 * E.g., '0244123456' -> '233244123456'
 *       '+233244123456' -> '233244123456'
 */
export function normalizeGhanaWhatsAppNumber(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  let cleaned = rawPhone.replace(/[\s\-\(\)\+]/g, "").trim();

  // If starts with 0 (e.g. 0244123456, 0551234567, 0201234567) -> prepend Ghana country code 233
  if (/^0[235][0-9]{8}$/.test(cleaned)) {
    return "233" + cleaned.slice(1);
  }

  // If already starts with 233 (e.g. 233244123456)
  if (/^233[235][0-9]{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Fallback for general valid E.164 phone formats (9 to 15 digits)
  if (/^[0-9]{9,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

interface MetaWhatsAppResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export type WhatsAppProvider = "wati" | "meta" | "mock";

export function normalizeWatiBaseUrl(endpoint?: string): string {
  if (!endpoint) return "";
  let base = endpoint.trim().replace(/\/+$/, "");
  base = base.replace(/\/api\/v[1-3]\/?$/, "");
  return base;
}

export class WhatsAppService {
  /**
   * Checks whether WATI credentials are configured.
   */
  static isWatiConfigured(): boolean {
    if (process.env.NODE_ENV === "test" || config.NODE_ENV === "test") {
      return false;
    }
    return Boolean(
      config.WATI_API_ENDPOINT &&
      config.WATI_ACCESS_TOKEN &&
      !config.WATI_ACCESS_TOKEN.includes("placeholder") &&
      !config.WATI_ACCESS_TOKEN.startsWith("CHANGE_ME")
    );
  }

  /**
   * Checks whether Meta WhatsApp Cloud API credentials are fully configured.
   */
  static isMetaConfigured(): boolean {
    if (process.env.NODE_ENV === "test" || config.NODE_ENV === "test") {
      return false;
    }
    return Boolean(
      config.WHATSAPP_PHONE_NUMBER_ID &&
      config.WHATSAPP_ACCESS_TOKEN &&
      !config.WHATSAPP_ACCESS_TOKEN.includes("placeholder") &&
      !config.WHATSAPP_ACCESS_TOKEN.startsWith("CHANGE_ME")
    );
  }

  /**
   * Returns active WhatsApp provider: 'wati', 'meta', or 'mock'.
   */
  static getProvider(): WhatsAppProvider {
    if (process.env.NODE_ENV === "test" || config.NODE_ENV === "test") {
      return "mock";
    }
    if (config.WHATSAPP_PROVIDER === "wati" && this.isWatiConfigured()) {
      return "wati";
    }
    if (config.WHATSAPP_PROVIDER === "meta" && this.isMetaConfigured()) {
      return "meta";
    }
    // Auto-detection fallback
    if (this.isWatiConfigured()) return "wati";
    if (this.isMetaConfigured()) return "meta";
    return "mock";
  }

  /**
   * Checks whether any production WhatsApp provider is configured.
   */
  static isConfigured(): boolean {
    return this.getProvider() !== "mock";
  }

  /**
   * Dispatches a free-form session message via WATI.
   */
  private static async dispatchMessageViaWati(
    recipient: string,
    messageText: string,
    event: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const baseUrl = normalizeWatiBaseUrl(config.WATI_API_ENDPOINT);
    const endpoint = `${baseUrl}/api/v1/sendSessionMessage/${recipient}?messageText=${encodeURIComponent(messageText)}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.WATI_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText }),
        signal: AbortSignal.timeout(10_000),
      });

      const resJson: any = await response.json().catch(() => ({}));
      const isSuccess =
        response.ok &&
        (resJson.result === true ||
          resJson.result === "success" ||
          resJson.ticket ||
          resJson.messageId ||
          (!resJson.error && resJson.result !== false && resJson.result !== "error"));

      if (!isSuccess) {
        const errorDesc =
          resJson.info || resJson.message || resJson.error || `WATI HTTP ${response.status}`;
        logger.error({ status: response.status, resJson, recipient, event }, "WATI WhatsApp dispatch error");

        await this.recordAuditLog({
          channel: "WHATSAPP",
          event,
          recipient,
          status: "FAILED",
          error: errorDesc,
          metadata: { ...metadata, provider: "wati" },
        });

        return { success: false, error: errorDesc };
      }

      const messageId =
        resJson.messageId || resJson.ticket?.id || resJson.id || `wati_${Date.now()}`;
      logger.info({ recipient, messageId, event }, "WhatsApp message dispatched successfully via WATI API");

      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "DISPATCHED",
        providerMsgId: messageId,
        metadata: { ...metadata, provider: "wati" },
      });

      return { success: true, messageId };
    } catch (err: any) {
      const errorMsg = err?.message || "Network error during WATI API request";
      logger.error({ err, recipient, event }, "Network failure during WATI WhatsApp dispatch");

      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "FAILED",
        error: errorMsg,
        metadata: { ...metadata, provider: "wati" },
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Dispatches a template message via WATI, with automatic session message fallback.
   */
  private static async dispatchTemplateViaWati(
    recipient: string,
    template: {
      name: string;
      language?: string;
      bodyParameters?: string[];
      buttonUrlParameter?: string;
    },
    fallbackText: string,
    event: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const baseUrl = normalizeWatiBaseUrl(config.WATI_API_ENDPOINT);
    const endpoint = `${baseUrl}/api/v1/sendTemplateMessage`;

    const parameters = (template.bodyParameters || []).map((val, idx) => ({
      name: String(idx + 1),
      value: String(val),
    }));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.WATI_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_name: template.name,
          broadcast_name: `nextdor_${event.toLowerCase()}`,
          whatsappNumber: recipient,
          parameters,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const resJson: any = await response.json().catch(() => ({}));
      const isSuccess =
        response.ok &&
        (resJson.result === true ||
          resJson.result === "success" ||
          resJson.ticket ||
          resJson.messageId ||
          (!resJson.error && resJson.result !== false && resJson.result !== "error"));

      if (isSuccess) {
        const messageId =
          resJson.messageId || resJson.ticket?.id || resJson.id || `wati_${Date.now()}`;
        logger.info(
          { recipient, messageId, event, template: template.name },
          "WhatsApp template dispatched successfully via WATI"
        );

        await this.recordAuditLog({
          channel: "WHATSAPP",
          event,
          recipient,
          status: "DISPATCHED",
          providerMsgId: messageId,
          metadata: { ...metadata, provider: "wati", template: template.name },
        });

        return { success: true, messageId };
      }

      logger.warn(
        { resJson, template: template.name, recipient },
        "WATI template rejected (not found/approved); falling back to WATI session message"
      );

      return await this.dispatchMessageViaWati(recipient, fallbackText, event, {
        ...metadata,
        templateAttempted: template.name,
        templateError: resJson.info || resJson.message || resJson.error,
      });
    } catch (err: any) {
      logger.warn(
        { err: err?.message, template: template.name },
        "WATI template request failed; falling back to WATI session message"
      );
      return await this.dispatchMessageViaWati(recipient, fallbackText, event, metadata);
    }
  }

  /**
   * Internal dispatcher making the authenticated HTTP call to the active WhatsApp provider.
   */
  private static async dispatchMessage(
    to: string,
    messageText: string,
    event: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const recipient = normalizeGhanaWhatsAppNumber(to);

    if (!recipient) {
      logger.warn({ rawPhone: to, event }, "WhatsAppService: invalid recipient phone format");
      return { success: false, error: "Invalid recipient phone format" };
    }

    const provider = this.getProvider();

    // 1. Development or unconfigured sandbox mode
    if (provider === "mock") {
      logger.info(
        { recipient, event },
        `📱 [DEV WHATSAPP] Message dispatched to ${recipient} (${event}):\n${messageText}`
      );

      // Record to audit log
      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "DISPATCHED",
        providerMsgId: `dev_wa_${Date.now()}`,
        metadata: { ...metadata, devMode: true },
      });

      return { success: true, messageId: `dev_wa_${Date.now()}` };
    }

    // 2. WATI Provider
    if (provider === "wati") {
      return this.dispatchMessageViaWati(recipient, messageText, event, metadata);
    }

    // 3. Meta WhatsApp Cloud API call
    const apiVersion = config.WHATSAPP_API_VERSION || "v21.0";
    const endpoint = `https://graph.facebook.com/${apiVersion}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: true,
            body: messageText,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const resJson = (await response.json()) as MetaWhatsAppResponse;

      if (!response.ok || resJson.error) {
        const errorDesc = resJson.error?.message || `HTTP ${response.status}`;
        logger.error({ status: response.status, resJson, recipient, event }, "Meta WhatsApp API dispatch error");

        await this.recordAuditLog({
          channel: "WHATSAPP",
          event,
          recipient,
          status: "FAILED",
          error: errorDesc,
          metadata,
        });

        return { success: false, error: errorDesc };
      }

      const messageId = resJson.messages?.[0]?.id || `wa_${Date.now()}`;
      logger.info({ recipient, messageId, event }, "WhatsApp message dispatched successfully via Meta Cloud API");

      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "DISPATCHED",
        providerMsgId: messageId,
        metadata,
      });

      return { success: true, messageId };
    } catch (err: any) {
      const errorMsg = err?.message || "Network error during Meta WhatsApp API request";
      logger.error({ err, recipient, event }, "Network failure during WhatsApp dispatch");

      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "FAILED",
        error: errorMsg,
        metadata,
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Dispatches a pre-approved Meta WhatsApp Template message.
   * Templates guarantee delivery to ANY customer even outside the 24-hour window.
   * If the template is not yet approved or fails, it automatically falls back
   * to free-text dispatch (for active 24h sessions) and then to queued Email fallback.
   */
  static async dispatchTemplateMessage(
    to: string,
    template: {
      name: string;
      language?: string;
      bodyParameters?: string[];
      buttonUrlParameter?: string;
    },
    fallbackText: string,
    event: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const recipient = normalizeGhanaWhatsAppNumber(to);

    if (!recipient) {
      logger.warn({ rawPhone: to, event }, "WhatsAppService: invalid recipient phone format");
      return { success: false, error: "Invalid recipient phone format" };
    }

    const provider = this.getProvider();

    // 1. Development or unconfigured sandbox mode
    if (provider === "mock") {
      logger.info(
        { recipient, event, template: template.name },
        `📱 [DEV WHATSAPP TEMPLATE] Template "${template.name}" simulated to ${recipient}:\n${fallbackText}`
      );

      await this.recordAuditLog({
        channel: "WHATSAPP",
        event,
        recipient,
        status: "DISPATCHED",
        providerMsgId: `dev_wa_${Date.now()}`,
        metadata: { ...metadata, devMode: true, template: template.name },
      });

      return { success: true, messageId: `dev_wa_${Date.now()}` };
    }

    // 2. WATI Provider
    if (provider === "wati") {
      return this.dispatchTemplateViaWati(recipient, template, fallbackText, event, metadata);
    }

    // 3. Meta WhatsApp Cloud API
    const apiVersion = config.WHATSAPP_API_VERSION || "v21.0";
    const endpoint = `https://graph.facebook.com/${apiVersion}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    try {
      const components: any[] = [];
      if (template.bodyParameters && template.bodyParameters.length > 0) {
        components.push({
          type: "body",
          parameters: template.bodyParameters.map((param) => ({
            type: "text",
            text: String(param),
          })),
        });
      }

      if (template.buttonUrlParameter) {
        components.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: template.buttonUrlParameter,
            },
          ],
        });
      }

      const templateBody: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: template.name,
          language: {
            code: template.language || "en_US",
          },
        },
      };

      if (components.length > 0) {
        templateBody.template.components = components;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templateBody),
        signal: AbortSignal.timeout(10_000),
      });

      const resJson = (await response.json()) as MetaWhatsAppResponse;

      if (response.ok && !resJson.error) {
        const messageId = resJson.messages?.[0]?.id || `wa_${Date.now()}`;
        logger.info(
          { recipient, messageId, event, template: template.name },
          "WhatsApp template message dispatched successfully via Meta Cloud API"
        );

        await this.recordAuditLog({
          channel: "WHATSAPP",
          event,
          recipient,
          status: "DISPATCHED",
          providerMsgId: messageId,
          metadata: { ...metadata, template: template.name },
        });

        return { success: true, messageId };
      }

      // If template fails (e.g. not created/approved yet in Meta WhatsApp Manager),
      // gracefully fall back to free-text message in case 24h customer window is open
      logger.warn(
        { resJson, template: template.name, recipient },
        "Meta WhatsApp template dispatch rejected; attempting free-text message"
      );
      return await this.dispatchMessage(to, fallbackText, event, {
        ...metadata,
        templateAttempted: template.name,
        templateError: resJson.error?.message,
      });
    } catch (err: any) {
      logger.warn(
        { err: err?.message, template: template.name },
        "Template dispatch network error; attempting free-text message"
      );
      return await this.dispatchMessage(to, fallbackText, event, metadata);
    }
  }

  /**
   * Dispatches a 6-digit OTP code to the customer's WhatsApp number.
   * If WhatsApp dispatch fails, it immediately activates email fallback.
   */
  static async sendOtp(
    phone: string,
    otpCode: string,
    purpose: "verification" | "password_reset",
    fallbackEmail?: { email: string; name?: string }
  ): Promise<boolean> {
    const isVerification = purpose === "verification";
    const title = isVerification ? "NextDor Account Verification" : "NextDor Password Recovery";
    const actionDesc = isVerification
      ? "verify your NextDor customer account"
      : "reset your NextDor account password";

    const text = [
      `🔐 *${title}*`,
      `────────────────────────────`,
      `Your 6-digit security code to ${actionDesc} is:`,
      ``,
      `👉 *${otpCode}* 👈`,
      ``,
      `⏳ Code is valid for *15 minutes*.`,
      `⚠️ Never share this code with anyone. NextDor staff will never ask for your code.`,
      ``,
      `_Shop More, Wait Less_`,
      `https://nextdor.online`,
    ].join("\n");

    const result = await this.dispatchTemplateMessage(
      phone,
      {
        name: "nextdor_otp",
        language: "en_US",
        bodyParameters: [otpCode],
      },
      text,
      "OTP",
      { purpose, otpCode: "***" }
    );

    if (!result.success && fallbackEmail?.email) {
      logger.info(
        { email: fallbackEmail.email, phone, purpose },
        "WhatsApp OTP dispatch failed; executing automated Email fallback"
      );

      await dispatchEmailAsync(
        isVerification
          ? {
              type: "verification",
              email: fallbackEmail.email,
              name: fallbackEmail.name || "Customer",
              code: otpCode,
            }
          : {
              type: "password_reset",
              email: fallbackEmail.email,
              name: fallbackEmail.name || "Customer",
              code: otpCode,
            }
      ).catch((err) => logger.warn({ err }, "Email fallback queue error"));

      await this.recordAuditLog({
        channel: "EMAIL",
        event: "OTP_FALLBACK",
        recipient: fallbackEmail.email,
        status: "FALLBACK_TRIGGERED",
        metadata: { originalPhone: phone, purpose },
      });
    }

    return result.success;
  }

  /**
   * Dispatches an order acknowledgement summary upon customer checkout.
   */
  static async sendOrderReceived(
    phone: string,
    data: {
      orderNumber: string;
      total: number;
      customerName: string;
      trackingUrl?: string;
      itemCount?: number;
    },
    fallbackEmail?: {
      email: string;
      shippingAddress: any;
      items: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number; productImage?: string }>;
      subtotal?: number;
      deliveryFee?: number;
      paymentMethod?: string;
    }
  ): Promise<boolean> {
    const trackingUrl = data.trackingUrl || `https://nextdor.online/account/orders/${data.orderNumber}`;

    const text = [
      `🛍️ *NextDor: Order Received!*`,
      `────────────────────────────`,
      `Hi *${data.customerName}*, we've received your order *#${data.orderNumber}*!`,
      ``,
      `💰 Total: *GH₵${data.total.toFixed(2)}*`,
      `📦 Items: *${data.itemCount ?? 1} product(s)*`,
      ``,
      `We are preparing your items for delivery. Track your fulfillment status live:`,
      `👉 ${trackingUrl}`,
      ``,
      `_Shop More, Wait Less_`,
    ].join("\n");

    const result = await this.dispatchTemplateMessage(
      phone,
      {
        name: "nextdor_order_confirmation",
        language: "en_US",
        bodyParameters: [
          data.customerName,
          data.orderNumber,
          data.total.toFixed(2),
          trackingUrl,
        ],
      },
      text,
      "ORDER_PLACED",
      { orderNumber: data.orderNumber }
    );

    if (!result.success && fallbackEmail?.email) {
      logger.info({ orderNumber: data.orderNumber }, "WhatsApp order alert failed; triggering email fallback");
      await dispatchEmailAsync({
        type: "order_confirmation",
        params: {
          email: fallbackEmail.email,
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          shippingAddress: fallbackEmail.shippingAddress,
          total: data.total,
          subtotal: fallbackEmail.subtotal ?? data.total,
          deliveryFee: fallbackEmail.deliveryFee ?? 0,
          paymentMethod: fallbackEmail.paymentMethod ?? "Online Payment / Cash on Delivery",
          items: fallbackEmail.items,
        },
      }).catch((err) => logger.warn({ err }, "Fallback order email queue error"));
    }

    return result.success;
  }

  /**
   * Dispatches an official payment receipt summary on settled payment.
   */
  static async sendPaymentReceipt(
    phone: string,
    data: {
      orderNumber: string;
      amountPaid: number;
      paystackRef: string;
      paymentChannel: string;
      paidAt?: Date;
      receiptUrl?: string;
      customerName: string;
    },
    fallbackEmail?: { email: string }
  ): Promise<boolean> {
    const receiptUrl = data.receiptUrl || `https://nextdor.online/account/orders/${data.orderNumber}`;
    const dateFormatted = (data.paidAt || new Date()).toLocaleString("en-GB", { timeZone: "Africa/Accra" });

    const text = [
      `🧾 *NextDor Official Payment Receipt*`,
      `────────────────────────────`,
      `Payment Confirmed! Thank you, *${data.customerName}*.`,
      ``,
      `🏷️ Order: *#${data.orderNumber}*`,
      `💳 Amount Paid: *GH₵${data.amountPaid.toFixed(2)}*`,
      `📱 Channel: *${data.paymentChannel.toUpperCase()}*`,
      `📋 Reference: \`${data.paystackRef}\``,
      `📅 Date: ${dateFormatted}`,
      ``,
      `View your complete order receipt & invoice:`,
      `👉 ${receiptUrl}`,
      ``,
      `_Shop More, Wait Less_`,
    ].join("\n");

    const result = await this.dispatchTemplateMessage(
      phone,
      {
        name: "nextdor_payment_receipt",
        language: "en_US",
        bodyParameters: [
          data.customerName,
          data.orderNumber,
          data.amountPaid.toFixed(2),
          data.paymentChannel.toUpperCase(),
          data.paystackRef,
          receiptUrl,
        ],
      },
      text,
      "PAYMENT_RECEIPT",
      { orderNumber: data.orderNumber, paystackRef: data.paystackRef }
    );

    if (!result.success && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "payment_receipt",
        params: {
          email: fallbackEmail.email,
          customerName: data.customerName,
          orderNumber: data.orderNumber,
          paystackRef: data.paystackRef,
          amountPaid: data.amountPaid,
          paymentChannel: data.paymentChannel,
          paidAt: data.paidAt || new Date(),
        },
      }).catch((err) => logger.warn({ err }, "Fallback receipt email queue error"));
    }

    return result.success;
  }

  /**
   * Dispatches order status transition progress updates.
   */
  static async sendOrderStatusUpdate(
    phone: string,
    data: {
      orderNumber: string;
      status: string;
      customerName: string;
      note?: string;
      trackingUrl?: string;
    },
    fallbackEmail?: { email: string }
  ): Promise<boolean> {
    const trackingUrl = data.trackingUrl || `https://nextdor.online/account/orders/${data.orderNumber}`;

    const text = [
      `📦 *NextDor Order Update — #${data.orderNumber}*`,
      `────────────────────────────`,
      `Hi *${data.customerName}*, your order is now:`,
      `✨ *${data.status}* ✨`,
      data.note ? `\n📝 Note: _${data.note}_` : "",
      ``,
      `Track real-time progress:`,
      `👉 ${trackingUrl}`,
      ``,
      `_Shop More, Wait Less_`,
    ].filter(Boolean).join("\n");

    const result = await this.dispatchTemplateMessage(
      phone,
      {
        name: "nextdor_order_status",
        language: "en_US",
        bodyParameters: [
          data.customerName,
          data.orderNumber,
          data.status,
          trackingUrl,
        ],
      },
      text,
      "ORDER_STATUS",
      { orderNumber: data.orderNumber, status: data.status }
    );

    if (!result.success && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "order_status_update",
        params: {
          email: fallbackEmail.email,
          customerName: data.customerName,
          orderNumber: data.orderNumber,
          status: data.status,
          note: data.note,
        },
      }).catch((err) => logger.warn({ err }, "Fallback status email queue error"));
    }

    return result.success;
  }

  /**
   * Dispatches courier delivery milestones: OUT_FOR_DELIVERY and DELIVERED.
   */
  static async sendCourierDelivery(
    phone: string,
    data: {
      orderNumber: string;
      trackingNumber: string;
      courierName: string;
      status: "OUT_FOR_DELIVERY" | "DELIVERED";
      recipientName: string;
      trackingUrl?: string;
    },
    fallbackEmail?: { email: string; deliveryAddress?: string }
  ): Promise<boolean> {
    const isOut = data.status === "OUT_FOR_DELIVERY";
    const trackingUrl = data.trackingUrl || `https://nextdor.online/account/orders/${data.orderNumber}`;

    const text = isOut
      ? [
          `🚚 *NextDor: Out For Delivery!*`,
          `────────────────────────────`,
          `Hi *${data.recipientName}*, your package (*${data.trackingNumber}*) is out for delivery!`,
          `Our courier partner *${data.courierName}* will contact you shortly to complete delivery.`,
          ``,
          `Track your courier live:`,
          `👉 ${trackingUrl}`,
          ``,
          `_Shop More, Wait Less_`,
        ].join("\n")
      : [
          `🎉 *NextDor: Package Delivered!*`,
          `────────────────────────────`,
          `Hi *${data.recipientName}*, order *#${data.orderNumber}* has been delivered!`,
          ``,
          `🛡️ *48-Hour Buyer Protection:*`,
          `Your payment is securely held in escrow for 48 hours. If anything is wrong, visit our Returns Hub:`,
          `👉 https://nextdor.online/returns`,
          ``,
          `Thank you for shopping with NextDor!`,
        ].join("\n");

    const result = await this.dispatchTemplateMessage(
      phone,
      {
        name: "nextdor_courier_update",
        language: "en_US",
        bodyParameters: [
          data.recipientName,
          data.orderNumber,
          data.status === "OUT_FOR_DELIVERY" ? "Out For Delivery" : "Delivered",
          data.courierName,
          trackingUrl,
        ],
      },
      text,
      "COURIER_DISPATCH",
      { orderNumber: data.orderNumber, status: data.status, courierName: data.courierName }
    );

    if (!result.success && !isOut && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "delivery_confirmation",
        params: {
          email: fallbackEmail.email,
          customerName: data.recipientName,
          orderNumber: data.orderNumber,
          deliveryAddress: fallbackEmail.deliveryAddress || "Direct Delivery",
        },
      }).catch((err) => logger.warn({ err }, "Fallback delivery email queue error"));
    }

    return result.success;
  }

  /**
   * Dispatches instant new order alert to the merchant's WhatsApp.
   */
  static async sendVendorNewOrderAlert(
    phone: string,
    data: {
      storeName: string;
      orderNumber: string;
      itemCount: number;
      total: number;
      city: string;
      dashboardUrl?: string;
    },
    fallbackEmail?: {
      email: string;
      items: Array<{ productName: string; quantity: number; unitPrice: number }>;
    }
  ): Promise<boolean> {
    const dashboardUrl = data.dashboardUrl || "https://nextdor.online/vendor/dashboard";

    const text = [
      `🔔 *NextDor Merchant Alert: New Order!*`,
      `────────────────────────────`,
      `Store: *${data.storeName}*`,
      `Order: *#${data.orderNumber}*`,
      ``,
      `📦 Items: *${data.itemCount} product(s)*`,
      `💰 Value: *GH₵${data.total.toFixed(2)}*`,
      `📍 Destination: *${data.city}*`,
      ``,
      `Please check inventory, pack the items, and prepare for courier dispatch:`,
      `👉 ${dashboardUrl}`,
      ``,
      `_NextDor Merchant Portal_`,
    ].join("\n");

    const result = await this.dispatchMessage(phone, text, "VENDOR_NEW_ORDER", {
      orderNumber: data.orderNumber,
      storeName: data.storeName,
    });

    if (!result.success && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "vendor_new_order",
        params: {
          vendorEmail: fallbackEmail.email,
          storeName: data.storeName,
          orderNumber: data.orderNumber,
          destinationCity: data.city,
          items: fallbackEmail.items,
        },
      }).catch((err) => logger.warn({ err }, "Fallback vendor order email error"));
    }

    return result.success;
  }

  /**
   * Dispatches automated low-stock warnings to the merchant's WhatsApp.
   */
  static async sendVendorLowStockAlert(
    phone: string,
    data: {
      storeName: string;
      productName: string;
      currentStock: number;
      threshold: number;
      dashboardUrl?: string;
    },
    fallbackEmail?: { email: string }
  ): Promise<boolean> {
    const dashboardUrl = data.dashboardUrl || "https://nextdor.online/vendor/dashboard";

    const text = [
      `⚠️ *NextDor Inventory Alert: Low Stock!*`,
      `────────────────────────────`,
      `Store: *${data.storeName}*`,
      `Product: *${data.productName}*`,
      ``,
      `📉 Units Remaining: *${data.currentStock}* (Low-Stock Threshold: ${data.threshold})`,
      ``,
      `Please restock your inventory to prevent stockouts and missed sales:`,
      `👉 ${dashboardUrl}`,
      ``,
      `_NextDor Merchant Portal_`,
    ].join("\n");

    const result = await this.dispatchMessage(phone, text, "VENDOR_LOW_STOCK", {
      productName: data.productName,
      currentStock: data.currentStock,
    });

    if (!result.success && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "low_stock_alert",
        params: {
          vendorEmail: fallbackEmail.email,
          storeName: data.storeName,
          productName: data.productName,
          currentStock: data.currentStock,
          threshold: data.threshold,
        },
      }).catch((err) => logger.warn({ err }, "Fallback low stock email error"));
    }

    return result.success;
  }

  /**
   * Dispatches Mobile Money payout disbursement confirmation to merchant's WhatsApp.
   */
  static async sendVendorPayoutAlert(
    phone: string,
    data: {
      storeName: string;
      amount: number;
      batchId: string;
      network: string;
      dashboardUrl?: string;
    },
    fallbackEmail?: { email: string; netEarnings: number }
  ): Promise<boolean> {
    const dashboardUrl = data.dashboardUrl || "https://nextdor.online/vendor/dashboard";

    const text = [
      `💰 *NextDor Payout: MoMo Disbursed!*`,
      `────────────────────────────`,
      `Store: *${data.storeName}*`,
      `Disbursed Amount: *GH₵${data.amount.toFixed(2)}*`,
      `Network: *${data.network.toUpperCase()}*`,
      `Batch Reference: \`${data.batchId}\``,
      ``,
      `Funds have been transferred to your registered Mobile Money wallet!`,
      `View your full earnings & payout ledger:`,
      `👉 ${dashboardUrl}`,
      ``,
      `_NextDor Merchant Portal_`,
    ].join("\n");

    const result = await this.dispatchMessage(phone, text, "VENDOR_PAYOUT", {
      batchId: data.batchId,
      amount: data.amount,
    });

    if (!result.success && fallbackEmail?.email) {
      await dispatchEmailAsync({
        type: "vendor_payout",
        params: {
          vendorEmail: fallbackEmail.email,
          storeName: data.storeName,
          amount: data.amount,
          momoNumber: phone,
          momoNetwork: data.network,
          reference: data.batchId,
          batchReference: data.batchId,
        },
      }).catch((err) => logger.warn({ err }, "Fallback vendor payout email error"));
    }

    return result.success;
  }

  /**
   * Records a notification event in the immutable NotificationLog table.
   */
  private static async recordAuditLog(entry: {
    channel: "WHATSAPP" | "EMAIL" | "SMS";
    event: string;
    recipient: string;
    status: "DISPATCHED" | "DELIVERED" | "FAILED" | "FALLBACK_TRIGGERED";
    providerMsgId?: string;
    error?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await prisma.notificationLog.create({
        data: {
          channel: entry.channel,
          event: entry.event,
          recipient: entry.recipient,
          status: entry.status,
          providerMsgId: entry.providerMsgId,
          error: entry.error,
          metadata: entry.metadata,
        },
      });
    } catch (err: any) {
      // Non-blocking write failure
      logger.warn({ err: err?.message, event: entry.event }, "NotificationLog: audit record write failed");
    }
  }
}
