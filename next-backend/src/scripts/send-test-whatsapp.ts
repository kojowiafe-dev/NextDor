/**
 * NextDor WhatsApp Diagnostic & Test Dispatcher.
 * Supports both WATI Gateway and Meta WhatsApp Cloud API.
 *
 * Usage:
 *   npx tsx src/scripts/send-test-whatsapp.ts [phone] [--template]
 * Example:
 *   npx tsx src/scripts/send-test-whatsapp.ts 0547226840
 */

import { config } from "../config/env.js";
import { normalizeGhanaWhatsAppNumber, WhatsAppService, normalizeWatiBaseUrl } from "../lib/whatsapp.js";

async function run() {
  const targetPhone = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) || "0547226840";
  const normalized = normalizeGhanaWhatsAppNumber(targetPhone);
  const provider = WhatsAppService.getProvider();

  console.log("=================================================");
  console.log("  NextDor WhatsApp Live Diagnostic & Dispatcher");
  console.log("=================================================");
  console.log(`Target Phone:        ${targetPhone} -> ${normalized}`);
  console.log(`Active Provider:     ${provider.toUpperCase()}`);

  if (provider === "mock") {
    console.warn("⚠️ No production WhatsApp credentials configured (neither WATI nor Meta).");
    console.warn("   Messages will run in simulated Developer Terminal mode with automatic Email fallback.");
    console.warn("   To configure WATI, set WATI_API_ENDPOINT and WATI_ACCESS_TOKEN in .env.");
    console.warn("   To configure Meta, set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env.");
    process.exit(0);
  }

  // ── WATI Diagnostic ────────────────────────────────────────────────────────
  if (provider === "wati") {
    const baseUrl = normalizeWatiBaseUrl(config.WATI_API_ENDPOINT);
    const token = config.WATI_ACCESS_TOKEN || "";
    console.log(`WATI Base URL:       ${baseUrl}`);
    console.log(`Token Prefix:        ${token.substring(0, 15)}... (length: ${token.length})`);
    console.log("-------------------------------------------------");

    console.log("1. Validating WATI API Connection...");
    try {
      const probeRes = await fetch(`${baseUrl}/api/v1/getMessageTemplates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const probeData: any = await probeRes.json().catch(() => ({}));

      if (!probeRes.ok) {
        console.error("\n❌ WATI Token / Endpoint Validation Failed!");
        console.error("HTTP Status:", probeRes.status);
        console.error("Response:", probeData);
        process.exit(1);
      }

      console.log("✅ WATI API is connected! Templates count:", Array.isArray(probeData.messageTemplates) ? probeData.messageTemplates.length : "OK");
    } catch (err: any) {
      console.error("❌ Network error contacting WATI API:", err.message);
      process.exit(1);
    }

    console.log("\n2. Sending Live Test Message via WATI to", normalized, "...");
    const testMessage = [
      `🔔 *NextDor WhatsApp Notification Test (WATI)*`,
      `────────────────────────────`,
      `Hello! This is a test message from your NextDor Marketplace deployment.`,
      ``,
      `📅 Time: ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" })}`,
      `🚀 Gateway: *WATI WhatsApp BSP*`,
      ``,
      `_Shop More, Wait Less_`,
      `https://nextdor.online`,
    ].join("\n");

    const result = await WhatsAppService.sendOtp(
      targetPhone,
      "998877",
      "verification"
    );

    if (result) {
      console.log("\n🎉 SUCCESS! Message dispatched successfully via WATI!");
      console.log("Check your WhatsApp on", targetPhone, "now!");
    } else {
      console.error("\n❌ Message dispatch via WATI failed. Check notification logs.");
    }

    process.exit(0);
  }

  // ── Meta WhatsApp Cloud API Diagnostic ─────────────────────────────────────
  if (provider === "meta") {
    console.log(`Phone Number ID:     ${config.WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`WABA ID:             ${config.WHATSAPP_BUSINESS_ACCOUNT_ID}`);
    console.log(`API Version:         ${config.WHATSAPP_API_VERSION}`);
    const token = config.WHATSAPP_ACCESS_TOKEN || "";
    console.log(`Token Prefix:        ${token.substring(0, 20)}... (length: ${token.length})`);
    console.log("-------------------------------------------------");

    console.log("1. Validating Access Token with Meta Graph API...");
    try {
      const probeRes = await fetch(
        `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}`,
        {
          headers: { Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}` },
        }
      );
      const probeData: any = await probeRes.json();

      if (!probeRes.ok) {
        console.error("\n❌ Meta Token Validation Failed!");
        console.error("HTTP Status:", probeRes.status);
        console.error("Error Code:", probeData.error?.code);
        console.error("Error Message:", probeData.error?.message);

        if (probeData.error?.code === 190) {
          console.error("\n👉 ACTION REQUIRED: Your Meta Access Token has expired.");
        }
        process.exit(1);
      }

      console.log("✅ Token is valid! Registered phone details:", probeData.display_phone_number || probeData.id);
    } catch (err: any) {
      console.error("❌ Network error contacting Meta API:", err.message);
      process.exit(1);
    }

    console.log("\n2. Sending Live Test Message to", normalized, "...");
    const testMessage = [
      `🔔 *NextDor WhatsApp Notification Test*`,
      `────────────────────────────`,
      `Hello! This is a test message from your NextDor Marketplace deployment.`,
      ``,
      `📅 Time: ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" })}`,
      `🚀 Meta Cloud API Status: *CONNECTED*`,
      ``,
      `_Shop More, Wait Less_`,
      `https://nextdor.online`,
    ].join("\n");

    try {
      const isTemplate = process.argv.includes("--template");
      const sendRes = await fetch(
        `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isTemplate
              ? {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: normalized,
                  type: "template",
                  template: {
                    name: "hello_world",
                    language: { code: "en_US" },
                  },
                }
              : {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: normalized,
                  type: "text",
                  text: {
                    preview_url: true,
                    body: testMessage,
                  },
                }
          ),
        }
      );

      const sendData: any = await sendRes.json();

      if (!sendRes.ok) {
        console.error("\n❌ Meta WhatsApp Message Dispatch Failed!");
        console.error("HTTP Status:", sendRes.status);
        console.error("Meta Error:", JSON.stringify(sendData, null, 2));
        process.exit(1);
      }

      const msgId = sendData.messages?.[0]?.id;
      console.log("\n🎉 SUCCESS! Message accepted by Meta WhatsApp Cloud API!");
      console.log("Message ID (WAMID):", msgId);
      console.log("Check your WhatsApp on", targetPhone, "now!");
      process.exit(0);
    } catch (err: any) {
      console.error("❌ Network error sending message:", err.message);
      process.exit(1);
    }
  }
}

run();
