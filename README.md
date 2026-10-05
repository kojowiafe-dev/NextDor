# NextDor — Enterprise Multi-Vendor Marketplace

> **"Shop More, Wait Less"** — An enterprise-grade, high-performance Ghanaian E-Commerce and Multi-Vendor Marketplace platform built with Next.js 16 (App Router + Turbopack), Fastify, TypeScript, Prisma ORM, Cloud PostgreSQL (Neon), and Cloudinary media infrastructure.

---

## 📚 Essential Documentation

| Document | Purpose |
| :--- | :--- |
| 🗺️ **[Master Project Overview & Navigation Map](./PROJECT_OVERVIEW.md)** | **Start here!** Full sitemap, "If I want this, where do I go?" cheat sheet, routing index, and environment setup. |
| 🔍 **[Codebase Analysis & System Architecture](./codebase_analysis.md)** | Full monorepo breakdown, tech stack, active routes, domain logic, and security verification. |
| 🏛️ **[Multi-Vendor OOD Architecture](./MULTI_VENDOR_OOD_ARCHITECTURE.md)** | Comprehensive function-by-function architectural breakdown, SOLID principles, Tenant Isolation, and Optimistic Concurrency Control (OCC). |
| ⚡ **[Frontend Caching & Performance Architecture](./FRONTEND_CACHING_ARCHITECTURE.md)** | Client-side SWR caching engine, in-flight request deduplication, navigation latency elimination, and audit. |
| ⚙️ **[Backend Architecture & Database Design](./BACKEND_ARCHITECTURE.md)** | Complete database ERD, 14 models, security specifications, Paystack/MoMo settlement, and RFC 7240 async sync mechanics. |
| 💻 **[Frontend Application Guide](./next-frontend/README.md)** | Next.js 16 App Router setup, portals, component design system, and Cloudinary uploads. |
| 🖥️ **[Backend API Server Guide](./next-backend/README.md)** | Fastify v5 setup, Prisma migrations, Clean Architecture modules, and API route index. |
| 📖 **[Recommended Books & Architecture Pillars](./RECOMMENDED_BOOKS_AND_ARCHITECTURE_PILLARS.md)** | Curated reading list of industry-standard textbooks on DDD, Concurrency, Distributed Systems, Multi-Tenancy, and Marketplace Economics. |

---

## 🚀 Quick Start

### 1. Backend (`next-backend`)
```bash
cd next-backend
npm install
npm run dev
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
3. **Mobile-First Uncongested Commerce**: Tailored for Ghana's mobile-first market. Replaces congested desktop tables on mobile viewports with stacked product cards, bottom-sheet catalog action modals, touch-friendly filter chips, persistent thumb bottom navigation (`BottomNav.tsx`), swipeable category chips (`CategoryNav.tsx`), and slide-over OCC edit drawers.
4. **Marketplace Order Partitioning**: Automated split of multi-vendor checkouts into distinct `VendorOrder` records with isolated tenant visibility.
5. **Deterministic Commission & Payouts**: 90% merchant / 10% platform split calculated with Martin Fowler's `Money` Value Object (pesewas/minor units) to prevent penny rounding leaks.
6. **Financial & Revenue Integrity**: Orders in `CANCELLED` and `REFUNDED` status are strictly excluded from Gross Marketplace Volume (GMV), 10% platform revenue, 90% merchant escrow reserves, top products by revenue, and category sales reports.
7. **Multi-Tenant Security & OCC**: Hardened tenant isolation (`WHERE id = productId AND vendorId = currentVendorId`) for viewing, editing, and soft-deleting products, paired with Optimistic Concurrency Control versioning.
8. **Cloudinary Asset Storage**: High-speed, signed media pipeline with client-side drag-and-drop uploads and edge CDN delivery.
9. **Brand Consistency**: Unified Amazon/NextDor orange theme (`#ff9900` / `#f08804`) and motto *"Shop More, Wait Less"*.
10. **Verified Email Onboarding & Recovery**: 6-digit OTP code email verification before account activation (`/verify-email`), 60-second cooldown protection, and full password recovery (`/forgot-password` $\rightarrow$ `/reset-password`) that invalidates all active sessions across devices upon password reset.
11. **Super Admin Operations Center**: Live PostgreSQL database metrics (`totalCustomers`, `totalProducts`, `totalOrders`), real-time notification popover (`AdminNotificationsPopover.tsx`) with 1-click "Mark read" and "Clear all", zero-scrollbar non-scrollable desktop sidebar with auto-dismissing mobile drawer, and complete product CRUD (`POST /api/v1/products`).

---

## 🛠️ Troubleshooting

If port 4000 is blocked (`EADDRINUSE: address already in use 0.0.0.0:4000`), kill the orphan process in PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

For complete runbooks on Prisma engine DLL locks (`EPERM`) and IDE TypeScript cache resets, see [Section 7 of the Project Overview](./PROJECT_OVERVIEW.md#-7-troubleshooting--operational-runbook).