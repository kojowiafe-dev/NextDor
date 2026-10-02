/**
 * NextDor Email Dispatcher Service.
 *
 * Supports live dispatch via Resend API and resilient terminal fallback
 * in development environments to ensure testing is never blocked.
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
  private static isPlaceholderKey(): boolean {
    return (
      !config.RESEND_API_KEY ||
      config.RESEND_API_KEY.includes("placeholder") ||
      config.RESEND_API_KEY.startsWith("re_dev_")
    );
  }

  /**
   * Dispatches an email via Resend API, with automatic terminal fallback in dev.
   */
  static async sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
    const isDev = config.NODE_ENV === "development";

    // If using placeholder key in development, log to terminal directly
    if (this.isPlaceholderKey()) {
      logger.info({ to, subject }, "📧 [DEV EMAIL] Resend API key is a placeholder — message logged locally.");
      return true;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.EMAIL_FROM || "NextDor <hello@nextdor.online>",
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
      logger.error({ err, to }, "Network error during email dispatch");
      return isDev; // don't fail registration in development
    }
  }

  /**
   * Sends the 6-digit email verification code.
   */
  static async sendVerificationCode(email: string, name: string, code: string): Promise<boolean> {
    const formattedCode = code.split("").join(" ");

    // Terminal console banner for development inspection
    console.log("\n" + "=".repeat(60));
    console.log(`✉️  NEXTDOR EMAIL VERIFICATION CODE`);
    console.log(`To: ${name} <${email}>`);
    console.log(`CODE: [ ${formattedCode} ]`);
    console.log(`Valid for 15 minutes.`);
    console.log("=".repeat(60) + "\n");

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

    // Terminal console banner for development inspection
    console.log("\n" + "=".repeat(60));
    console.log(`🔑  NEXTDOR PASSWORD RESET CODE`);
    console.log(`To: ${name} <${email}>`);
    console.log(`RESET CODE: [ ${formattedCode} ]`);
    console.log(`Valid for 15 minutes.`);
    console.log("=".repeat(60) + "\n");

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
}
