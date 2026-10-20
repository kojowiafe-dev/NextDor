# NextDor — Enterprise Multi-Vendor Marketplace

> **"Shop More, Wait Less"** — An enterprise-grade, high-performance Ghanaian E-Commerce and Multi-Vendor Marketplace platform built with Next.js 16 (App Router + Turbopack), Fastify, TypeScript, Prisma ORM, Cloud PostgreSQL (Neon), and Cloudinary media infrastructure.

---

## 📚 Essential Documentation

| Document | Purpose |
| :--- | :--- |
| 🗺️ **[Master Project Overview & Navigation Map](./PROJECT_OVERVIEW.md)** | **Start here!** Full sitemap, "If I want this, where do I go?" cheat sheet, routing index, and environment setup. |
| 🎯 **[Master Phased Implementation Roadmap](./PROJECT_PHASES_AND_ROADMAP.md)** | All 12 completed enterprise roadmap phases, system audit findings, and milestone tracking. |
| 🔍 **[Codebase Analysis & System Architecture](./codebase_analysis.md)** | Full monorepo breakdown, tech stack, 41 active routes, domain logic, and security verification. |
| 🏛️ **[Multi-Vendor OOD Architecture](./MULTI_VENDOR_OOD_ARCHITECTURE.md)** | Comprehensive function-by-function architectural breakdown, SOLID principles, Tenant Isolation, and Optimistic Concurrency Control (OCC). |
| ⚡ **[Frontend Caching & Performance Architecture](./FRONTEND_CACHING_ARCHITECTURE.md)** | Client-side SWR caching engine, in-flight request deduplication, navigation latency elimination, and audit. |
| ⚙️ **[Backend Architecture & Database Design](./BACKEND_ARCHITECTURE.md)** | Complete database ERD, 20+ models, security specifications, Paystack/MoMo settlement, and RFC 7240 async sync mechanics. |
| 💻 **[Frontend Application Guide](./next-frontend/README.md)** | Next.js 16 App Router setup, portals, component design system, and Cloudinary uploads. |
| 🖥️ **[Backend API Server Guide](./next-backend/README.md)** | Fastify v5 setup, Prisma migrations, Clean Architecture modules, and API route index. |
| 📖 **[Recommended Books & Architecture Pillars](./RECOMMENDED_BOOKS_AND_ARCHITECTURE_PILLARS.md)** | Curated reading list of industry-standard textbooks on DDD, Concurrency, Distributed Systems, Multi-Tenancy, and Marketplace Economics. |

---

## 🚀 Quick Start

### 1. Backend (`next-backend`)
```bash
cd next-backend
npm install
npm run dev           # API Server at http://127.0.0.1:4000
npm test              # Run 15 automated test suites (92 tests)
npm run verify:services # Live diagnostics (DB, Redis, Paystack, Cloudinary, Invariants)
```
- API Server: `http://127.0.0.1:4000`
- Interactive OpenAPI / Swagger Docs: `http://127.0.0.1:4000/docs`

### 2. Frontend (`next-frontend`)
```bash
cd next-frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`
- Customer Storefront: `http://localhost:3000/`
- Customer Returns Hub: `http://localhost:3000/returns`
- Vendor Portal Dashboard: `http://localhost:3000/vendor/dashboard`
- Admin Management Portal: `http://localhost:3000/admin`
- Interactive Cloudinary Image Upload API: `http://localhost:3000/api/upload`

---

## 🌟 Core System Pillars

1. **3-Tier Multi-Vendor Catalog Ingestion**: Supports flexible onboarding for solo vendors to high-volume merchants via:
   - *Single Product Ingestion:* Interactive forms with signed Cloudinary drag-and-drop media upload and OCC concurrency protection.
   - *Bulk CSV/Excel Upload:* Batch ingestion supporting up to 500 products with RFC 4180 parsing, delimiter autodetection, row validation, and downloadable sample templates.
   - *WooCommerce Store Connector:* Per-vendor live store synchronization (`/wp-json/wc/v3/products`) with credential encryption, background pagination, and Redis distributed locking (`lock:wc-sync:vendor:${id}`) to prevent race conditions.
2. **Previous Price & Dynamic Discount Engine**: Native compare-at pricing. When `regularPrice > price`, the storefront, cart, vendor dashboard, and admin tables display the current price, strikethrough previous price, and auto-computed percentage discount badge (`-X%` / `X% OFF`). If no previous price is configured, only current price renders without strikethrough.
3. **Search Intelligence & Instant Autocomplete**: 220ms debounced server search (`GET /api/v1/products/autocomplete`) via `SearchBar.tsx` delivering category suggestions, live product previews with thumbnail cards, prices, and vendor badges, full keyboard arrow navigation, and trending search tags.
4. **Multi-Facet Catalog Filters & Responsive Mobile Drawer**: Advanced filtering (`ShopFilters.tsx`) on `/shop` and `/search` supporting price presets & custom inputs, "In Stock Only" toggle, "⚡ Deals & Discounts Only" toggle, 4★/3★ customer rating filters, category tree with counts, removable active filter chips, and slide-over mobile drawer (`MobileFilterDrawer.tsx`).
5. **Mobile-First Optimization & AVIF/WebP Transcoding**: Tailored for Ghana's mobile-first market. Native Next.js AVIF/WebP image edge transcoding, `compress: true`, minimum touch targets $\ge 48\text{px}$, `touch-action: manipulation` tap delay elimination, safe-area inset bottom navigation (`BottomNav.tsx`), and zero horizontal overflow (`overflow-x: hidden`).
6. **Marketplace Order Partitioning**: Automated split of multi-vendor checkouts into distinct `VendorOrder` records with isolated tenant visibility.
7. **Deterministic Commission & Payouts**: 90% merchant / 10% platform split calculated with Martin Fowler's `Money` Value Object (pesewas/minor units) to prevent penny rounding leaks, with 48-hour customer verification escrow retention.
8. **Financial & Revenue Integrity**: Orders in `CANCELLED` and `REFUNDED` status are strictly excluded from Gross Marketplace Volume (GMV), 10% platform revenue, 90% merchant escrow reserves, top products by revenue, and category sales reports.
9. **Multi-Tenant Security & OCC**: Hardened tenant isolation (`WHERE id = productId AND vendorId = currentVendorId`) for viewing, editing, and soft-deleting products, paired with Optimistic Concurrency Control versioning.
10. **Platform Security & O(1) Token Indexing**: Refresh token SHA-256 indexed lookups (`lookupHash`) for microsecond O(1) queries before bcrypt verification, Redis-backed distributed rate limiting (200 req/min), Helmet HSTS headers, and strict CORS whitelisting.
11. **Cloudinary Asset Storage**: High-speed, signed media pipeline with client-side drag-and-drop uploads and edge CDN delivery.
12. **Brand Consistency**: Unified Amazon/NextDor orange theme (`#ff9900` / `#f08804`) and motto *"Shop More, Wait Less"*.
13. **Verified Email Onboarding & Recovery**: 6-digit OTP code email verification before account activation (`/verify-email`), 60-second cooldown protection, and full password recovery (`/forgot-password` $\rightarrow$ `/reset-password`) that invalidates all active sessions across devices upon password reset.
14. **Super Admin Operations Center**: Live PostgreSQL database metrics (`totalCustomers`, `totalProducts`, `totalOrders`), real-time notification popover (`AdminNotificationsPopover.tsx`) with 1-click "Mark read" and "Clear all", zero-scrollbar non-scrollable desktop sidebar with auto-dismissing mobile drawer, and complete product CRUD (`POST /api/v1/products`).
15. **Customer Returns & Dispute Resolution**: Self-serve customer returns within the 48-hour escrow window, merchant & admin review workflows, and automated Paystack/MoMo refund settlement with exact balance conservation.
16. **Dynamic Logistics & Real-Time Couriers**: GhanaPost GPS geo-pricing quote engine, vendor courier dispatch modals (`CourierDispatchModal.tsx`), printable packing slips (`PackingSlipModal.tsx`), and automated webhook tracking for third-party couriers (Fez, Kwik, DHL).
17. **Multi-Warehouse Physical Inventory**: Multi-location warehouse tracking (`Warehouse`, `WarehouseStock`), atomic cross-warehouse transfers, low-stock threshold alerts, and two-way stock synchronization on reservations and cancellation restocks.
18. **Cash on Delivery (COD) Invariants & Reconciliation**: COD orders are exempted from the 30-minute abandonment reaper, automatically settle to `PAID` upon physical delivery confirmation, enforce strict payout gating (`order.paymentStatus === 'PAID'`), and balance through a dual-inflow double-entry ledger ($\text{Gateway Receipts} + \text{COD Collections} = \text{Liabilities} + \text{Revenue} + \text{Refunds}$).

---

## 🛠️ Troubleshooting

If port 4000 is blocked (`EADDRINUSE: address already in use 0.0.0.0:4000`), kill the orphan process in PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

For complete runbooks on Prisma engine DLL locks (`EPERM`) and IDE TypeScript cache resets, see [Section 7 of the Project Overview](./PROJECT_OVERVIEW.md#-7-troubleshooting--operational-runbook).