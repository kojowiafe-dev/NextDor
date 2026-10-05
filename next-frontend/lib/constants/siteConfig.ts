/**
 * Centralized Site Configuration & Official Brand Details for NextDor.
 *
 * Configurable via environment variables with production defaults.
 */

export const SITE_CONFIG = {
  name: "NextDor",
  legalName: "NextDor E-Commerce Marketplace Ltd.",
  tagline: "Shop More, Wait Less",
  domain: "https://www.nextdor.online",
  
  // ─── Contact & Customer Support ─────────────────────────────────────────────
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+233 24 123 4567",
  phoneDisplay: process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY || "+233 24 123 4567",
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+233241234567",
  whatsappUrl: `https://wa.me/${(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+233241234567").replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hello NextDor Support, I have an inquiry about an order / product.")}`,
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@nextdor.online",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@nextdor.online",

  // ─── Physical Address ───────────────────────────────────────────────────────
  address: "Accra Digital Centre, Ring Road West",
  city: "Accra",
  region: "Greater Accra",
  country: "Ghana",
  postalCode: "GA-123-4567",
  hours: "Mon – Sat: 8:00 AM – 6:00 PM GMT (Sunday: Closed)",

  // ─── Delivery Standard Rates (Ghana) ────────────────────────────────────────
  deliveryRates: {
    accraStandard: { price: 20, time: "24–48 hours", label: "Greater Accra" },
    kumasiStandard: { price: 35, time: "2–3 business days", label: "Ashanti Region" },
    nationwideStandard: { price: 45, time: "3–5 business days", label: "Other Regions (Nationwide)" },
    expressAccra: { price: 45, time: "Same-Day / Next-Day", label: "Accra Express" },
    pickup: { price: 0, time: "Ready in 2 hours", label: "Hub Pickup (Free)" },
  },
} as const;
