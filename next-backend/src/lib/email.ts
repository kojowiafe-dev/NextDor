/**
 * NextDor Email Dispatcher Service.
 *
 * Supports live dispatch via Cloudflare Email Sending API (with optional Resend fallback)
 * and resilient terminal fallback in development environments to ensure testing is never blocked.
 */

import { config } from "../config/env.js";
import { logger } from "./logger.js";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export class EmailService {
  private static isConfigured(): boolean {
    const hasCloudflare = Boolean(
      config.CLOUDFLARE_API_TOKEN &&
      config.CLOUDFLARE_ACCOUNT_ID &&
      !config.CLOUDFLARE_API_TOKEN.includes("placeholder")
    );
    const hasResend = Boolean(
      config.RESEND_API_KEY &&
      !config.RESEND_API_KEY.includes("placeholder") &&
      !config.RESEND_API_KEY.startsWith("re_dev_")
    );
    return hasCloudflare || hasResend;
  }

  /**
   * Dispatches an email via Cloudflare Email Sending API (or Resend fallback),
   * with automatic terminal fallback in dev.
   */
  static async sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
    const isDev = config.NODE_ENV === "development";

    // If using placeholder key or not configured in dev, log to terminal directly
    if (!this.isConfigured()) {
      logger.info({ to, subject }, "📧 [DEV EMAIL] Email service not configured or using placeholder — message logged locally.");
      return true;
    }

    // 1. Cloudflare Email Sending API (Primary)
    if (config.CLOUDFLARE_API_TOKEN && config.CLOUDFLARE_ACCOUNT_ID) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: config.EMAIL_FROM || "NextDor <nextdor@nextdor.online>",
              to,
              subject,
              html,
              text: text || subject,
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error({ status: response.status, body: errorBody, to }, "Failed to send email via Cloudflare Email Service");
          if (isDev) {
            logger.warn("Development mode active: continuing despite external email error.");
            return true;
          }
          return false;
        }

        logger.info({ to, subject }, "Email dispatched successfully via Cloudflare");
        return true;
      } catch (err) {
        logger.error({ err, to }, "Network error during Cloudflare email dispatch");
        return isDev;
      }
    }

    // 2. Resend API (Fallback if configured)
    if (config.RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.EMAIL_FROM || "NextDor <nextdor@nextdor.online>",
            to: [to],
            subject,
            html,
            text: text || subject,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error({ status: response.status, body: errorBody, to }, "Failed to send email via Resend");
          if (isDev) {
            logger.warn("Development mode active: continuing despite external email error.");
            return true;
          }
          return false;
        }

        logger.info({ to, subject }, "Email dispatched successfully via Resend");
        return true;
      } catch (err) {
        logger.error({ err, to }, "Network error during Resend email dispatch");
        return isDev;
      }
    }

    return true;
  }

  /**
   * Sends the 6-digit email verification code.
   */
  static async sendVerificationCode(email: string, name: string, code: string): Promise<boolean> {
    const formattedCode = code.split("").join(" ");

    // SECURITY: Only log OTP codes in development — NEVER in production.
    // In production, logs are accessible to anyone with server/log access.
    // Attacker with log access + this = instant account takeover on any email.
    if (config.NODE_ENV !== "production") {
      logger.debug({ to: email, code }, "[DEV] Verification code dispatched");
      console.log("\n" + "=".repeat(60));
      console.log(`✉️  NEXTDOR EMAIL VERIFICATION CODE`);
      console.log(`To: ${name} <${email}>`);
      console.log(`CODE: [ ${formattedCode} ]`);
      console.log(`Valid for 15 minutes.`);
      console.log("=".repeat(60) + "\n");
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
            .header { background: #131921; padding: 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .code-box { background: #fff8eb; border: 2px dashed #ff9900; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
            .code-number { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #131921; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 24px; letter-spacing: 1px;">NEXTDOR</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Shop More, Wait Less • Ghana</p>
            </div>
            <div class="content">
              <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Verify your email address</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">Hello ${name},</p>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">Thank you for registering on NextDor. Please use the 6-digit verification code below to activate your account and begin shopping:</p>
              
              <div class="code-box">
                <div class="code-number">${formattedCode}</div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #b45309; font-weight: 600;">Valid for 15 minutes</p>
              </div>

              <p style="color: #71717a; font-size: 13px; line-height: 1.5;">If you did not sign up for an account on NextDor, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `${code} is your NextDor verification code`,
      html,
      text: `Your NextDor verification code is: ${code}. It expires in 15 minutes.`,
    });
  }

  /**
   * Sends the 6-digit password reset recovery code.
   */
  static async sendPasswordResetCode(email: string, name: string, code: string): Promise<boolean> {
    const formattedCode = code.split("").join(" ");

    // SECURITY: Only log reset codes in development — NEVER in production.
    if (config.NODE_ENV !== "production") {
      logger.debug({ to: email, code }, "[DEV] Password reset code dispatched");
      console.log("\n" + "=".repeat(60));
      console.log(`🔑  NEXTDOR PASSWORD RESET CODE`);
      console.log(`To: ${name} <${email}>`);
      console.log(`RESET CODE: [ ${formattedCode} ]`);
      console.log(`Valid for 15 minutes.`);
      console.log("=".repeat(60) + "\n");
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
            .header { background: #131921; padding: 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .code-box { background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
            .code-number { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 24px; letter-spacing: 1px;">NEXTDOR</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Password Recovery</p>
            </div>
            <div class="content">
              <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Reset your password</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">Hello ${name},</p>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your NextDor account. Use the 6-digit recovery code below to choose a new password:</p>
              
              <div class="code-box">
                <div class="code-number">${formattedCode}</div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #1e40af; font-weight: 600;">Valid for 15 minutes</p>
              </div>

              <p style="color: #71717a; font-size: 13px; line-height: 1.5;">If you did not request a password reset, you can safely ignore this email. Your current password remains secure.</p>
            </div>
            <div class="footer">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `${code} is your NextDor password reset code`,
      html,
      text: `Your NextDor password reset code is: ${code}. It expires in 15 minutes.`,
    });
  }

  /**
   * Dispatches an order confirmation email to the buyer (customer or guest).
   */
  static async sendOrderConfirmation(params: {
    email: string;
    customerName: string;
    orderNumber: string;
    total: number | string;
    subtotal: number | string;
    deliveryFee: number | string;
    paymentMethod: string;
    shippingAddress: {
      recipientName?: string;
      recipientPhone?: string;
      street: string;
      city: string;
      region: string;
    };
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number | string;
      subtotal: number | string;
      productImage?: string | null;
    }>;
  }): Promise<boolean> {
    const {
      email,
      customerName,
      orderNumber,
      total,
      subtotal,
      deliveryFee,
      paymentMethod,
      shippingAddress,
      items,
    } = params;

    const itemsRowsHtml = items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #18181b;">
            <strong>${item.productName}</strong>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e4e4e7; font-size: 14px; text-align: center; color: #52525b;">
            ${item.quantity}
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e4e4e7; font-size: 14px; text-align: right; color: #18181b; font-weight: 600;">
            GH₵${Number(item.subtotal).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join("");

    const trackUrl = `https://nextdor.online/track?order=${encodeURIComponent(orderNumber)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #131921; padding: 28px 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .order-badge { display: inline-block; background: #fff7ed; border: 1px solid #ffedd5; color: #c2410c; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; }
            .section-title { font-size: 16px; font-weight: 700; color: #18181b; margin: 24px 0 12px 0; border-bottom: 2px solid #f4f4f5; padding-bottom: 6px; }
            .address-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; color: #334155; }
            .totals-table { width: 100%; margin-top: 16px; }
            .totals-table td { padding: 6px 0; font-size: 14px; }
            .grand-total { font-size: 18px; font-weight: 800; color: #09090b; border-top: 2px solid #e4e4e7; padding-top: 10px; }
            .btn-track { display: block; width: fit-content; margin: 28px auto 0 auto; background: #ff9900; color: #131921; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-align: center; box-shadow: 0 2px 8px rgba(255,153,0,0.3); }
            .escrow-callout { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; margin-top: 24px; font-size: 12px; color: #065f46; line-height: 1.5; }
            .footer { padding: 24px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 26px; letter-spacing: 1px;">NEXTDOR</h1>
              <p style="color: #cbd5e1; margin: 4px 0 0 0; font-size: 12px;">Shop More, Wait Less</p>
            </div>
            <div class="content">
              <div class="order-badge">✓ Order Received &amp; Confirmed</div>
              <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0; color: #09090b;">Thank you, ${customerName}!</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                We have received your order <strong style="color: #18181b;">${orderNumber}</strong>. Our verified merchants have been notified and are preparing your items for swift dispatch.
              </p>

              <div class="section-title">Order Items</div>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left;">
                    <th style="padding: 10px 8px; font-size: 12px; color: #64748b; font-weight: 700; border-bottom: 2px solid #e2e8f0;">Item</th>
                    <th style="padding: 10px 8px; font-size: 12px; color: #64748b; font-weight: 700; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                    <th style="padding: 10px 8px; font-size: 12px; color: #64748b; font-weight: 700; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHtml}
                </tbody>
              </table>

              <table class="totals-table">
                <tr>
                  <td style="color: #64748b;">Subtotal</td>
                  <td style="text-align: right; font-weight: 600;">GH₵${Number(subtotal).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Delivery Fee</td>
                  <td style="text-align: right; font-weight: 600;">GH₵${Number(deliveryFee).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Payment Method</td>
                  <td style="text-align: right; font-weight: 600;">${paymentMethod}</td>
                </tr>
                <tr class="grand-total">
                  <td><strong>Total Paid / Due</strong></td>
                  <td style="text-align: right;"><strong>GH₵${Number(total).toFixed(2)}</strong></td>
                </tr>
              </table>

              <div class="section-title">Delivery Destination</div>
              <div class="address-box">
                <strong>Recipient:</strong> ${shippingAddress.recipientName || customerName}<br />
                <strong>Phone:</strong> ${shippingAddress.recipientPhone || "Provided on checkout"}<br />
                <strong>Address:</strong> ${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.region}
              </div>

              <div class="escrow-callout">
                🛡️ <strong>NextDor 48-Hour Buyer Protection Escrow:</strong> Your funds are safely held until 48 hours after delivery. If your order does not arrive as described, you are protected with a full refund.
              </div>

              <a href="${trackUrl}" class="btn-track" style="color: #131921 !important;">
                Track Live Order Progress &rarr;
              </a>
            </div>
            <div class="footer">
              <p style="margin: 0 0 6px 0;">Need support? WhatsApp or call us at <strong>+233 55 750 7693</strong> or email support@nextdor.online.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Order Confirmed: ${orderNumber} — NextDor Ghana`,
      html,
      text: `Thank you for your order, ${customerName}! Order ${orderNumber} is confirmed. Total: GH₵${Number(total).toFixed(2)}. Track your order here: ${trackUrl}`,
    });
  }

  /**
   * Dispatches a new order alert to a vendor merchant.
   */
  static async sendVendorNewOrderNotification(params: {
    vendorEmail: string;
    storeName: string;
    orderNumber: string;
    destinationCity: string;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number | string;
    }>;
  }): Promise<boolean> {
    const { vendorEmail, storeName, orderNumber, destinationCity, items } = params;

    const itemsListHtml = items
      .map(
        (item) => `
        <li style="margin-bottom: 6px;">
          <strong>${item.productName}</strong> &times; ${item.quantity} (GH₵${Number(item.unitPrice).toFixed(2)} each)
        </li>
      `
      )
      .join("");

    const portalUrl = "https://nextdor.online/vendor/dashboard";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #131921; padding: 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .badge { display: inline-block; background: #ede9fe; color: #6d28d9; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; }
            .btn { display: block; width: fit-content; margin: 24px auto 0 auto; background: #8b5cf6; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-align: center; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 22px;">NEXTDOR MERCHANT PORTAL</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Store Order Notification</p>
            </div>
            <div class="content">
              <div class="badge">🔔 New Customer Order</div>
              <h2 style="font-size: 20px; font-weight: 700; margin: 12px 0 8px 0;">Hello ${storeName},</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
                You have received a new order (<strong style="color: #18181b;">${orderNumber}</strong>) delivering to <strong>${destinationCity}</strong>.
              </p>
              
              <h3 style="font-size: 15px; margin: 20px 0 8px 0; color: #09090b;">Items to prepare:</h3>
              <ul style="color: #334155; font-size: 14px; padding-left: 20px;">
                ${itemsListHtml}
              </ul>

              <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin-top: 20px;">
                Please log into your merchant dashboard to acknowledge the order, update fulfillment to <strong>PROCESSING</strong>, and arrange dispatch.
              </p>

              <a href="${portalUrl}" class="btn">
                Open Merchant Dashboard &rarr;
              </a>
            </div>
            <div class="footer">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. Merchant Fulfillment Services.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: vendorEmail,
      subject: `New Order Received: ${orderNumber} — ${storeName}`,
      html,
      text: `Hello ${storeName}, you have received a new order ${orderNumber} delivering to ${destinationCity}. Please log in to fulfill: ${portalUrl}`,
    });
  }

  /**
   * Dispatches order status update email to customer.
   */
  static async sendOrderStatusUpdate(params: {
    email: string;
    customerName: string;
    orderNumber: string;
    status: string;
    note?: string;
  }): Promise<boolean> {
    const { email, customerName, orderNumber, status, note } = params;
    const trackUrl = `https://nextdor.online/track?order=${encodeURIComponent(orderNumber)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #131921; padding: 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .btn { display: block; width: fit-content; margin: 24px auto 0 auto; background: #ff9900; color: #131921 !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-align: center; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 22px;">NEXTDOR</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Order Status Update</p>
            </div>
            <div class="content">
              <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Hi ${customerName},</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
                Your order <strong style="color: #18181b;">${orderNumber}</strong> has been updated to status: <strong style="color: #ff9900;">${status}</strong>.
              </p>
              ${
                note
                  ? `<p style="background: #f8fafc; border-left: 3px solid #ff9900; padding: 10px 14px; font-size: 13px; color: #475569;">${note}</p>`
                  : ""
              }
              <a href="${trackUrl}" class="btn">
                Track Order Live &rarr;
              </a>
            </div>
            <div class="footer">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Order Update: ${orderNumber} is now ${status} — NextDor`,
      html,
      text: `Hi ${customerName}, your order ${orderNumber} is now ${status}. Track it here: ${trackUrl}`,
    });
  }

  /**
   * Dispatches official Paystack payment receipt email to customer.
   */
  static async sendPaymentReceipt(params: {
    email: string;
    customerName: string;
    orderNumber: string;
    paystackRef: string;
    amountPaid: number | string | any;
    paymentChannel: string;
    paidAt?: Date | string;
  }): Promise<boolean> {
    const { email, customerName, orderNumber, paystackRef, amountPaid, paymentChannel, paidAt } = params;
    const trackUrl = `https://nextdor.online/track?order=${encodeURIComponent(orderNumber)}`;
    const dateFormatted = paidAt
      ? new Date(paidAt).toLocaleDateString("en-GH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleDateString("en-GH");

    const channelLabel =
      paymentChannel.toUpperCase() === "MOMO" || paymentChannel.toLowerCase().includes("momo")
        ? "Mobile Money (MoMo)"
        : "Debit / Credit Card (Paystack)";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #131921; padding: 28px 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .badge { display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 20px; margin-bottom: 16px; }
            .receipt-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 13px; }
            .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
            .receipt-row:last-child { border-bottom: none; }
            .btn { display: block; width: fit-content; margin: 28px auto 0 auto; background: #ff9900; color: #131921 !important; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 10px; text-align: center; box-shadow: 0 2px 8px rgba(255,153,0,0.3); }
            .escrow-callout { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin-top: 24px; font-size: 12px; color: #1e40af; line-height: 1.5; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 26px; letter-spacing: 1px;">NEXTDOR</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Official Payment Receipt</p>
            </div>
            <div class="content">
              <div class="badge">✓ Payment Verified &amp; Secured</div>
              <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0; color: #09090b;">Payment Received, ${customerName}!</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0;">
                Your online payment for Order <strong style="color: #18181b;">${orderNumber}</strong> has been successfully processed and verified via Paystack.
              </p>

              <div class="receipt-box">
                <table style="width: 100%; font-size: 13px; color: #334155;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Order Number:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${orderNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Paystack Reference:</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px; color: #0f172a;">${paystackRef}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Payment Method:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${channelLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Payment Date:</td>
                    <td style="padding: 6px 0; text-align: right; color: #0f172a;">${dateFormatted}</td>
                  </tr>
                  <tr style="border-top: 2px solid #cbd5e1;">
                    <td style="padding: 10px 0 4px 0; font-size: 15px; font-weight: 800; color: #0f172a;">Amount Paid:</td>
                    <td style="padding: 10px 0 4px 0; text-align: right; font-size: 17px; font-weight: 800; color: #047857;">GH₵${Number(amountPaid).toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              <div class="escrow-callout">
                🛡️ <strong>Buyer Escrow Assurance:</strong> Your money is held in 48-Hour NextDor Buyer Escrow until after your package is safely delivered and inspected.
              </div>

              <a href="${trackUrl}" class="btn">
                Track Live Order Progress &rarr;
              </a>
            </div>
            <div class="footer">
              <p style="margin: 0 0 6px 0;">Need help with this payment? WhatsApp or call us at <strong>+233 55 750 7693</strong>.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Payment Receipt: GH₵${Number(amountPaid).toFixed(2)} for Order ${orderNumber} — NextDor`,
      html,
      text: `Hello ${customerName}, your payment of GH₵${Number(amountPaid).toFixed(2)} for order ${orderNumber} has been successfully verified via Paystack (Ref: ${paystackRef}). Track your order here: ${trackUrl}`,
    });
  }

  /**
   * Alerts customer that package is packaged & ready / dispatched.
   */
  static async sendPackageReadyNotification(params: {
    email: string;
    customerName: string;
    orderNumber: string;
    destinationCity?: string;
    storeName?: string;
    isPickup?: boolean;
  }): Promise<boolean> {
    const { email, customerName, orderNumber, destinationCity, storeName, isPickup } = params;
    const trackUrl = `https://nextdor.online/track?order=${encodeURIComponent(orderNumber)}`;

    const titleText = isPickup
      ? "Your package is ready for hub pickup!"
      : "Your package is ready and on the way!";

    const subText = isPickup
      ? `Your order from <strong>${storeName || "NextDor Merchant"}</strong> has been prepared and is ready for collection at the Accra Digital Centre Pickup Hub.`
      : `Your order from <strong>${storeName || "NextDor Merchant"}</strong> has been securely packaged, inspected, and handed over to our dispatch courier delivering to <strong>${destinationCity || "your destination"}</strong>.`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #131921; padding: 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .badge { display: inline-block; background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 12px; padding: 4px 14px; border-radius: 20px; margin-bottom: 14px; }
            .btn { display: block; width: fit-content; margin: 24px auto 0 auto; background: #ff9900; color: #131921 !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-align: center; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ff9900; margin: 0; font-size: 24px;">NEXTDOR</h1>
              <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px;">Package Dispatch Alert</p>
            </div>
            <div class="content">
              <div class="badge">📦 Package Ready</div>
              <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">Hi ${customerName},</h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
                ${titleText}
              </p>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
                ${subText}
              </p>
              
              <div style="background: #f8fafc; border-left: 3px solid #ff9900; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #334155;">
                <strong>Order Reference:</strong> ${orderNumber}<br />
                <strong>Dispatch Status:</strong> ${isPickup ? "READY FOR PICKUP" : "DISPATCHED / OUT FOR DELIVERY"}
              </div>

              <a href="${trackUrl}" class="btn">
                Track Live Courier Progress &rarr;
              </a>
            </div>
            <div class="footer">
              <p style="margin: 0 0 6px 0;">Questions? Call/WhatsApp support at <strong>+233 55 750 7693</strong>.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} NextDor Marketplace Ghana. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Package Ready: ${orderNumber} is on the way! — NextDor`,
      html,
      text: `Hi ${customerName}, your package for order ${orderNumber} is ready and dispatched! Track live here: ${trackUrl}`,
    });
  }
}
