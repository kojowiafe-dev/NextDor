# NextDor — Master Phased Implementation Roadmap
> **Platform Motto:** *"Shop More, Wait Less"*  
> **Status:** Enterprise Multi-Vendor Marketplace (Ghana)  
> **Architecture:** Next.js 16 (App Router + React 19) + Fastify v5 + Prisma ORM (Neon PostgreSQL)  
> **Currency:** Ghanaian Cedis (GH₵ / GHS)  
> **Updated:** October 2026  

---

## 🧭 Executive Overview

This master document groups all **38 client recommendations** and core business requirements into **7 structured, enterprise-ready phases**. Each phase defines its scope, deliverables, verification criteria, and current completion status.

```mermaid
graph TD
    P1[Phase 1: Brand Trust & Storefront Foundation] --> P2[Phase 2: Checkout, Pricing & Payments]
    P2 --> P3[Phase 3: Order Lifecycle & Tracking]
    P3 --> P4[Phase 4: Customer Delight, Deals & Emailing]
    P4 --> P5[Phase 5: Multi-Vendor Ingestion & Governance]
    P5 --> P6[Phase 6: Search & Category Taxonomy]
    P6 --> P7[Phase 7: Mobile Optimization & Security]
    
    style P1 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P2 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P4 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P5 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P6 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style P7 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## 🟢 Phase 1: Brand Trust, Buyer Confidence & Storefront Foundation
**Status: COMPLETED (100%)**

| ID | Item | Implementation & Verification |
| :--- | :--- | :--- |
| **#1** | **Review Count & Rating Consistency** | Standardized across all `ProductCard`, `ProductRow`, and product detail pages (`reviewCount`, `rating`). |
| **#2 & #3** | **NextDor Ghana Contact & Address** | Replaced placeholders with real Accra, Ghana physical address and contact phone number (`+233 55 123 4567`). |
| **#6** | **"Buy Now" Button** | Direct 1-click purchase button added alongside "Add to Cart", routing straight to checkout. |
| **#9 & #10** | **Delivery Cost & Time on Product Pages** | `ProductDeliveryInfo.tsx` displays regional delivery costs (Accra: GH₵25, Kumasi: GH₵35, Nationwide: GH₵45) and delivery windows (1–2 days Accra, 2–4 days nationwide). |
| **#22 & #23** | **Rich Product Specifications & Gallery** | Multi-image zoom gallery (`ProductGallery.tsx`), specifications tab (`ProductSpecifications.tsx`), and warranty details. |
| **#25 & #26** | **Seller Storefront Cards & Verified Badges** | Vendor store cards on PDP with verified merchant badges and rating metrics. |
| **#32** | **Buyer Protection Escrow Guarantee** | 48-Hour Escrow Guarantee banner and trust markers across storefront, PDP, and checkout. |
| **#33** | **Floating Customer Support Button** | Bottom-right hovering support widget (`FloatingSupportButton.tsx`) with WhatsApp, direct phone call, email, and quick track order modal. |

---

## 🟢 Phase 2: Checkout, Pricing Integrity & Payment Gateways
**Status: COMPLETED (100%)**

| ID | Item | Implementation & Verification |
| :--- | :--- | :--- |
| **#4 & #5** | **Complete Checkout & Server-Side Paystack** | Full checkout pipeline (`/cart` $\rightarrow$ `/checkout` $\rightarrow$ Paystack modal $\rightarrow$ `/checkout/success`). Payments verified server-side (`POST /api/v1/orders/verify-payment`) with Paystack API HMAC validation. |
| **#7** | **Guest Checkout** | Frictionless guest checkout supporting instant purchase with only email and phone number; no mandatory account barrier. |
| **#8** | **Transparent Fee Breakdown** | Order summary card displaying Subtotal, Delivery Fee, Buyer Protection, and Grand Total in GH₵ before payment. |
| **#11** | **Dynamic Delivery Region Selection** | Interactive Ghana region selector (Greater Accra, Ashanti, Central, Western, Eastern, Northern) with auto-recalculated delivery fees. |
| **#18 & #19** | **Atomic Stock Management** | Database transaction decrements stock on payment confirmation; out-of-stock items blocked from purchase. |
| **#35** | **Dynamic Price Display & Discount %** | Compare-at strikethrough price shown only when regular price exceeds current price; dynamic `-XX% OFF` badge calculated automatically; duplicate price rendering removed. |
| **Rule** | **Financial Revenue & Escrow Invariant** | Excluded `CANCELLED` and `REFUNDED` orders from super-admin gross revenue, platform GMV, and merchant escrow totals. |

---

## 🟢 Phase 3: Order Lifecycle, Sequential Numbers & Logistics Tracking
**Status: COMPLETED (100%)**

| ID | Item | Implementation & Verification |
| :--- | :--- | :--- |
| **#12** | **7-Stage Order Status Stepper** | Visual progression: `Pending` $\rightarrow$ `Paid` $\rightarrow$ `Seller Confirmed` $\rightarrow$ `Preparing` $\rightarrow$ `Picked Up` $\rightarrow$ `Out for Delivery` $\rightarrow$ `Delivered`. |
| **#13 & #31** | **Returns, Refunds & Cancellations** | Dedicated handling for cancelled and returned orders; customer self-service `/returns` policy and forms. |
| **#14** | **Clean Sequential Order Numbering** | `ND-00001`, `ND-00002` generated via PostgreSQL sequence `order_number_seq` with zero-entropy fallback. |
| **#15 & #30** | **Public & Customer Order Tracking** | Public order tracking portal at `/track?order=ND-XXXXX` with audit timeline and multi-vendor fulfillment cards; authenticated customer history at `/account/orders`. |

---

## 🟢 Phase 4: Customer Delight, Dedicated Deals & Automated Communications
**Status: COMPLETED (100%)**

| ID | Item | Implementation & Verification |
| :--- | :--- | :--- |
| **#23** | **Dedicated Deals Hub (`/deals`)** | Brand new `/deals` page with discount tier filtering (🔥 50%+ OFF, ⚡ 30%+ OFF, 15%+ OFF, Under GH₵100), category pills, and sorting by savings. Prominent "⚡ Today's Deals" button added to desktop and mobile navigation. |
| **#34** | **Automated Customer & Vendor Emailing** | Implemented `sendOrderConfirmation`, `sendVendorNewOrderNotification`, and `sendOrderStatusUpdate` in `EmailService`. Dispatched automatically upon checkout, Paystack payment verification, and status updates. |
| **#35** | **Schema.org Product JSON-LD & SEO** | OpenGraph tags, Twitter cards, canonical URLs, and Schema.org `Product` JSON-LD structured data on all product pages for Google Rich Snippets. |
| **UX** | **NextDor Page Transition Loader** | Top progress bar (`NavigationProgressBar.tsx`) triggers immediately on click; branded NextDor spinner (`NextDorPageLoader.tsx` & `app/loading.tsx`) animates during data fetching and route changes. |
| **Fix** | **Duplicate Price Elimination** | Removed redundant price display from `AddToCartButton.tsx`; prices now render once and only once across the product detail page. |

---

## 🟢 Phase 5: Multi-Vendor Catalog Ingestion, Moderation & Payouts
**Status: COMPLETED (100%)**

| ID | Item | Implementation Details |
| :--- | :--- | :--- |
| **#16 & #17**| **Vendor Order & Stock Management** | Complete merchant portal (`/vendor/dashboard`) with tenant-isolated sub-orders (`VendorOrder`), line items, dispatch progressor, and OCC optimistic concurrency stock editing. |
| **#20** | **Unique SKU Generation** | Automated SKU assignment (`ND-XXXXX` / `SKU-XXXXX`) per product variation, displayed on product specification sheets. |
| **#24** | **Product Moderation Queue** | Admin moderation workflow (`/admin/merchants`) managing `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED` queues. Products from unapproved vendors are automatically staged and withheld from public catalog until approved. |
| **#27** | **Vendor Commission & MoMo Payouts** | `CommissionCalculator.ts` handles platform fees (default 10%), 48-hour customer verification escrow retention, and Mobile Money payout ledger via `GET /api/v1/vendors/portal/payouts`. |
| **#38** | **3-Tier Product Ingestion Pipeline** | 1. Single product entry with OCC locking.<br/>2. Bulk RFC 4180 CSV/Excel upload via `BulkUploadModal.tsx` with downloadable template and row validation.<br/>3. External WooCommerce store synchronization via `StoreSyncModal.tsx` with Redis locks. |

---

## 🟢 Phase 6: Search Intelligence, Faceted Filtering & Taxonomy Refinement
**Status: COMPLETED (100%)**

| ID | Item | Scope & Implementation |
| :--- | :--- | :--- |
| **#21** | **Category & Subcategory Hierarchy** | Enhanced `/category/[slug]` with category hero showcase banners, sibling category navigation pills, breadcrumbs, and live faceted filters. |
| **#28** | **Intelligent Autocomplete Search** | Server search endpoint (`GET /api/v1/products/autocomplete`) paired with debounced live dropdown (`SearchBar.tsx`) featuring category suggestions, product preview cards (images, prices, vendor, in-stock badge), keyboard navigation, and trending search tags. |
| **#29** | **Multi-Facet Catalog Filters** | Reusable `ShopFilters.tsx`, `ActiveFilterChips.tsx`, and `MobileFilterDrawer.tsx` on `/shop` and `/search` supporting price range presets & custom Min/Max inputs, "In Stock Only" toggle, "⚡ Deals & Discounts Only" toggle, 4★/3★ customer rating filters, category tree with counts, and dynamic sorting. |

---

## 🟢 Phase 7: Mobile Performance, Low-End Android Optimization & Security
**Status: COMPLETED (100%)**

| ID | Item | Implementation & Verification |
| :--- | :--- | :--- |
| **#36** | **Performance & Asset Optimization** | Configured `next.config.ts` for AVIF & WebP automatic transcoding, `compress: true`, Turbopack tree-shaking, and multi-tier SWR client caching with Redis caching for API endpoints. |
| **#37** | **Low-End Android Device Polish** | Minimum touch targets $\ge 48\text{px}$, persistent thumb navigation (`BottomNav.tsx`), Safe-Area inset support, `touch-action: manipulation` tap delay elimination, zero horizontal overflow (`overflow-x: hidden`), and responsive stacked cards (`< md`). |
| **#38** | **Comprehensive Platform Security** | Refresh token SHA-256 indexed lookup (O(1)), Redis distributed rate limiting (200 req/min), Helmet HSTS security headers, CORS origin whitelist, constant-time token comparison, and full session revocation on password reset. |

---

## 📅 Implementation Summary

```
Week 1 (COMPLETED):
  ├── Phase 1: Brand Trust & Storefront Foundation
  ├── Phase 2: Checkout, Pricing Integrity & Payments
  └── Phase 3: Order Lifecycle, Sequential Numbers & Logistics

Week 2 (COMPLETED):
  ├── Phase 4: Deals Hub, Page Loaders, Emailing & SEO
  ├── Phase 5: Multi-Vendor Moderation, Payouts & Bulk Ingestion
  └── Phase 6: Search Intelligence, Faceted Taxonomy & Autocomplete

Week 3 (COMPLETED):
  └── Phase 7: Mobile Optimization, Low-End Android Polish, Security Hardening & Launch Readiness
```


