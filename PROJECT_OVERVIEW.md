# NextDor: Master Project Blueprint & Navigation Map

Welcome to **NextDor** — an enterprise-grade Ghanaian E-Commerce & Multi-Vendor Marketplace platform. This document serves as the master guide to the entire codebase: explaining what the system does, where every feature lives, and providing an instant **"If I want this, where do I go?"** navigation index.

---

## 🧭 Table of Contents
1. [What is NextDor?](#-1-what-is-nextdor)
2. [High-Level Architecture & Tech Stack](#-2-high-level-architecture--tech-stack)
3. [Repository Directory Structure](#-3-repository-directory-structure)
4. ["If I Want This, Where Do I Go?" (Navigation Cheat Sheet)](#-4-if-i-want-this-where-do-i-go)
   - [Frontend Routes & Pages](#frontend-routes--ui-pages-next-frontend)
   - [Backend API Endpoints & Modules](#backend-api-endpoints--services-next-backend)
   - [Database & Data Modeling](#database-models--migrations)
   - [Domain Rules & Financial Logic](#domain-rules--financial-logic)
   - [Media & Cloudinary Asset Storage](#media--asset-infrastructure)
5. [Environment Variables Reference](#-5-environment-variables-reference)
6. [Daily Development Commands](#-6-daily-development-commands)
7. [Troubleshooting & Operational Runbook](#-7-troubleshooting--operational-runbook)
8. [Architecture Books & Advanced Reading](#-8-architecture-books--advanced-reading)

---

## 🎯 1. What is NextDor?

NextDor is a hybrid e-commerce ecosystem specifically tailored for the Ghanaian retail market:
- **3-Tier Catalog Ingestion:** Multi-channel product onboarding designed for solo artisans, high-volume merchants, and existing store owners:
  1. *Single Product Ingestion:* Interactive form with drag-and-drop Cloudinary media upload, category mapping, and Optimistic Concurrency Control (OCC).
  2. *Bulk CSV/Excel Upload:* High-speed batch ingestion with RFC 4180 parsing, delimiter auto-detection, row-by-row error validation, and one-click template download.
  3. *Per-Vendor WooCommerce Sync:* Live REST API connector (`/wp-json/wc/v3/products`) with credential encryption, background pagination, and Redis distributed locking (`lock:wc-sync:vendor:${id}`) to prevent overlapping sync workers.
- **Previous Price & Dynamic Discount Engine:** Native support for compare-at pricing. When a product has a previous price (`regularPrice`) greater than its current price (`price`), the UI dynamically renders the current price, a strikethrough cancelled price, and a calculated percentage discount badge (`-X%` / `X% OFF`). If no previous price exists, only the current price is shown without strikethrough.
- **Mobile-First Uncongested Commerce:** Designed for effortless one-handed smartphone usage in Ghana. Dense 7-column desktop tables cleanly collapse into stacked mobile product cards with badge indicators, bottom-sheet catalog ingestion modals, touch-friendly filter chips, and slide-over OCC edit drawers.
- **Multi-Vendor Marketplace & Sub-Orders:** Independent Ghanaian vendors (bakeries, fashion designers, electronics stores) can register their own stores, manage private inventory, and receive mobile money payouts (MTN MoMo, Telecel Cash). Multi-vendor checkouts are partitioned into independent `VendorOrder` records so vendors only see and fulfill their own line items.
- **Financial & Revenue Integrity:** Strict financial accounting standards ensure `CANCELLED` and `REFUNDED` orders are excluded from Gross Marketplace Volume (GMV), platform take-rate revenue (10%), merchant escrow balances (90%), and sales analytics.
- **Concurrency & Race Condition Prevention:** Built with **Optimistic Concurrency Control (OCC)** so multiple store managers updating the same product never overwrite each other's stock.
- **Accurate Financial Engine:** Implements Martin Fowler's **Value Object Pattern** with fixed minor-unit integer arithmetic (pesewas), completely eliminating floating-point rounding errors and guaranteeing 100% mathematical conservation on 90% merchant / 10% platform splits.
- **High-Performance Cloud Media:** Integrated with **Cloudinary** for signed, fast image uploads and responsive edge CDN delivery.
- **Brand Consistency:** Standardized around the Amazon/NextDor brand orange palette (`#ff9900` / `#f08804`) with the motto *"Shop More, Wait Less"*.

---

## ⚡ 2. High-Level Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                          CLIENT BROWSERS                               │
   └───────────────┬────────────────────────────────────────┬───────────────┘
                   │ Port 3000                              │ Port 4000
   ┌───────────────▼────────────────┐       ┌───────────────▼───────────────┐
   │         next-frontend          │       │         next-backend          │
   │  - Next.js 16 App Router       │       │  - Fastify (High-throughput)  │
   │  - React 19, Turbopack, TS     │       │  - Class-based 3-Tier Layering│
   │  - Cloudinary Media Route      │       │  - OpenAPI / Swagger Docs     │
   │  - Lucide Icons & Responsive   │       │  - Zod Config Validation      │
   └────────────────────────────────┘       └───────────────┬───────────────┘
                   │                                        │ Prisma ORM
                   │ Cloudinary API                         │
   ┌───────────────▼────────────────┐       ┌───────────────▼───────────────┐
   │         Cloudinary CDN         │       │        Neon PostgreSQL        │
   │  - Signed Asset Pipeline       │       │  - Cloud Serverless Postgres  │
   │  - Auto-format & Optimizations │       │  - 14 Normalized Relational   │
   │  - Direct Component Uploader   │       │    Data Models                │
   └────────────────────────────────┘       └───────────────────────────────┘
```

- **Frontend:** Next.js 16 (App Router + Turbopack), React 19, TypeScript, TailwindCSS utilities.
- **Frontend Performance & Caching:** Multi-Tier SWR (Stale-While-Revalidate) Cache Engine (`lib/cache/clientCache.ts`), sub-key parameterization, and in-flight request deduplication. Detailed in [`FRONTEND_CACHING_ARCHITECTURE.md`](./FRONTEND_CACHING_ARCHITECTURE.md).
- **Backend:** Node.js 20+, Fastify, TypeScript, Prisma ORM, Pino logger.
- **Database:** Serverless Cloud PostgreSQL hosted on Neon (AWS `us-east-2`).
- **Media Hosting:** Cloudinary CDN with dedicated server-side signing route (`/api/upload`) and drag-and-drop UI component (`components/ui/ImageUpload.tsx`).
- **Security:** Argon2 / Bcrypt password hashing, JWT Access Tokens, RFC 6749 Opaque Refresh Token Family Rotation, Helmet security headers, IP Rate Limiting, and strict Multi-Tenant Data Isolation.

---

## 📁 3. Repository Directory Structure

```
NextDor/
├── next-backend/                     # Fastify REST API server
│   ├── prisma/
│   │   ├── schema.prisma             # Complete PostgreSQL database schema (14 models)
│   │   └── seed.ts                   # Seeds Super Admin, Flagship store, & demo vendor
│   ├── src/
│   │   ├── config/env.ts             # Zod environment variable validation (includes Cloudinary)
│   │   ├── domain/                   # Domain Layer (Money & CommissionCalculator)
│   │   ├── lib/                      # Prisma, Redis, Logger, Errors, Cloudinary
│   │   ├── modules/                  # 3-Tier Modules (Routes, Services, Repositories)
│   │   │   ├── admin/                # Platform customer management and 30-day analytics engine
│   │   │   ├── audit/                # Immutable platform administrative governance audit trail
│   │   │   ├── auth/                 # Authentication, JWT, and Token Rotation
│   │   │   ├── health/               # /health liveness and database ping check
│   │   │   ├── orders/               # Master orders, multi-vendor sub-orders, checkout
│   │   │   ├── products/             # Public catalog, categories, search, slug lookup, product updates
│   │   │   ├── sync/                 # Background WooCommerce sync engine
│   │   │   └── vendors/              # Multi-vendor portal, OCC inventory, orders, escrow
│   │   ├── app.ts                    # Fastify application factory & plugin registry
│   │   └── server.ts                 # Server entry point & graceful shutdown handlers
│   └── tsconfig.json
│
├── next-frontend/                    # Next.js 16 Web Application (App Router + Turbopack)
│   ├── app/                          # Next.js App Router directory (34 routes)
│   │   ├── account/                  # Customer profile, orders, addresses, wishlists
│   │   ├── admin/                    # Admin portal (products, merchants, orders, audit logs)
│   │   ├── api/upload/               # Serverless Cloudinary streaming upload handler
│   │   ├── cart/                     # Shopping cart page
│   │   ├── category/[slug]/          # Category browsing page
│   │   ├── checkout/                 # Multi-vendor checkout flow with MoMo/Paystack mock
│   │   ├── login/ & register/        # Authentication pages
│   │   ├── product/[slug]/           # Dynamic product detail page with resilient gallery
│   │   ├── search/                   # Search results page
│   │   ├── shop/                     # Master catalog browsing
│   │   ├── store/[slug]/             # Public vendor storefront profile
│   │   ├── vendor/dashboard/         # Private merchant portal (inventory, OCC, orders, escrow)
│   │   ├── layout.tsx & page.tsx     # Root layout and homepage
│   │   └── globals.css               # Global theme tokens (brand orange #ff9900)
│   ├── components/                   # Reusable UI components
│   │   ├── ui/ImageUpload.tsx        # Drag-and-drop Cloudinary image upload component
│   │   ├── product/                  # Product cards, galleries, other sellers
│   │   ├── layout/                   # Header, Footer ("Shop More, Wait Less"), SearchBar
│   │   └── admin/                    # Admin forms and layouts
│   ├── lib/
│   │   ├── cache/clientCache.ts      # Multi-Tier SWR Cache Factory & Request Deduplication
│   │   ├── catalog/index.ts          # Unified catalog fetching & fallbacks
│   │   ├── cloudinary.ts             # Cloudinary server-side SDK configuration
│   │   └── utils.ts                  # Price formatters (GH₵) and date helpers
│   └── next.config.ts                # Next.js config with Cloudinary remote image patterns
│
├── packages/shared/                  # Shared TypeScript interfaces across front & back
├── FRONTEND_CACHING_ARCHITECTURE.md  # Client-side SWR caching & deduplication specification
├── MULTI_VENDOR_OOD_ARCHITECTURE.md  # Deep-dive code, SOLID, and tenant isolation explanation
├── BACKEND_ARCHITECTURE.md           # Database ERD, 14 models, security, and sync mechanics
├── RECOMMENDED_BOOKS_AND_ARCHITECTURE_PILLARS.md # Industry-standard reading curriculum
└── PROJECT_OVERVIEW.md               # This master document
```

---

## 🧭 4. "If I Want This, Where Do I Go?"

### Frontend Routes & UI Pages (`next-frontend`)

| If you want to view or edit... | Go to this file / directory | URL in Browser |
| :--- | :--- | :--- |
| **Homepage & Hero Banners** | `next-frontend/app/page.tsx` | `http://localhost:3000/` |
| **Product Detail Page (PDP)** | `next-frontend/app/product/[slug]/page.tsx` | `http://localhost:3000/product/[slug]` |
| **Storewide Catalog Browsing** | `next-frontend/app/shop/page.tsx` | `http://localhost:3000/shop` |
| **Category Filtered View** | `next-frontend/app/category/[slug]/page.tsx` | `http://localhost:3000/category/[slug]` |
| **Search Results & Filters** | `next-frontend/app/search/page.tsx` | `http://localhost:3000/search?q=cake` |
| **Customer Shopping Cart** | `next-frontend/app/cart/page.tsx` | `http://localhost:3000/cart` |
| **Checkout & Payment Form** | `next-frontend/app/checkout/page.tsx` | `http://localhost:3000/checkout` |
| **Order Confirmation Page** | `next-frontend/app/checkout/success/page.tsx` | `http://localhost:3000/checkout/success` |
| **Customer Login** | `next-frontend/app/login/page.tsx` | `http://localhost:3000/login` |
| **Customer Registration** | `next-frontend/app/register/page.tsx` | `http://localhost:3000/register` |
| **Email Verification (6-Digit OTP)** | `next-frontend/app/verify-email/page.tsx` | `http://localhost:3000/verify-email?email=...` |
| **Forgot Password Request** | `next-frontend/app/forgot-password/page.tsx` | `http://localhost:3000/forgot-password` |
| **Reset Password (OTP + New Password)**| `next-frontend/app/reset-password/page.tsx` | `http://localhost:3000/reset-password?email=...` |
| **User Account Overview** | `next-frontend/app/account/page.tsx` | `http://localhost:3000/account` |
| **User Saved Delivery Addresses** | `next-frontend/app/account/addresses/page.tsx` | `http://localhost:3000/account/addresses` |
| **User Wishlist** | `next-frontend/app/account/wishlist/page.tsx` | `http://localhost:3000/account/wishlist` |
| **User Order History List** | `next-frontend/app/account/orders/page.tsx` | `http://localhost:3000/account/orders` |
| **Order Tracking & Timeline** | `next-frontend/app/account/orders/[number]/page.tsx` | `http://localhost:3000/account/orders/[number]` |
| **Vendor Management Portal** | `next-frontend/app/vendor/dashboard/page.tsx` | `http://localhost:3000/vendor/dashboard`<br>(4 Tabs: Inventory & OCC, Store Orders & Dispatch, MoMo Payouts & 48h Escrow, Store Settings; responsive mobile cards on `< md`) |
| **Vendor Bulk Upload Modal** | `next-frontend/components/vendor/BulkUploadModal.tsx` | High-speed RFC 4180 CSV/Excel bulk product upload modal with delimiter autodetection, downloadable template, and row validation |
| **Vendor Store Sync Modal** | `next-frontend/components/vendor/StoreSyncModal.tsx` | Per-vendor WooCommerce REST API connector modal for syncing external store catalogs with Redis locking |
| **Cloudinary Image Uploader** | `next-frontend/components/ui/ImageUpload.tsx` | Embedded in Vendor Dashboard & Admin forms |
| **Cloudinary Upload API** | `next-frontend/app/api/upload/route.ts` | `POST http://localhost:3000/api/upload` |
| **Merchant Onboarding** | `next-frontend/app/vendor/register/page.tsx` | `http://localhost:3000/vendor/register` |
| **Super Admin Command Console** | `next-frontend/app/admin/page.tsx` | `http://localhost:3000/admin` |
| **Admin Orders Management** | `next-frontend/app/admin/orders/page.tsx` | `http://localhost:3000/admin/orders` |
| **Admin Order Detail & Transitions** | `next-frontend/app/admin/orders/[id]/page.tsx` | `http://localhost:3000/admin/orders/[id]` |
| **Admin Product Catalog & Sync** | `next-frontend/app/admin/products/page.tsx` | `http://localhost:3000/admin/products` |
| **Admin Product Create Form** | `next-frontend/app/admin/products/new/page.tsx` | `http://localhost:3000/admin/products/new` |
| **Admin Product Edit Form** | `next-frontend/app/admin/products/[id]/page.tsx` | `http://localhost:3000/admin/products/[id]` |
| **Admin Customer Directory** | `next-frontend/app/admin/customers/page.tsx` | `http://localhost:3000/admin/customers` |
| **Admin Customer Profile & Orders** | `next-frontend/app/admin/customers/[id]/page.tsx` | `http://localhost:3000/admin/customers/[id]` |
| **Admin Platform Analytics** | `next-frontend/app/admin/analytics/page.tsx` | `http://localhost:3000/admin/analytics` |
| **Admin Merchant Approvals** | `next-frontend/app/admin/merchants/page.tsx` | `http://localhost:3000/admin/merchants` |
| **Admin Team Management** | `next-frontend/app/admin/admins/page.tsx` | `http://localhost:3000/admin/admins` |
| **Platform Audit Trail Logs** | `next-frontend/app/admin/audit-logs/page.tsx` | `http://localhost:3000/admin/audit-logs` |
| **Platform Settings Console** | `next-frontend/app/admin/settings/page.tsx` | `http://localhost:3000/admin/settings` |
| **Public Merchant Storefront** | `next-frontend/app/store/[slug]/page.tsx` | `http://localhost:3000/store/[slug]` |
| **Global Navigation & Search** | `next-frontend/components/layout/Header.tsx` | Rendered on all pages |
| **Mobile Thumb Navigation Bar** | `next-frontend/components/layout/BottomNav.tsx` | Fixed bottom bar on mobile (Home, Shop, Search, Cart, Account) |
| **Swipeable Category Pills** | `next-frontend/components/layout/CategoryNav.tsx` | Instant horizontal touch category navigation on mobile + desktop bar |
| **Mobile Drawer Navigation** | `next-frontend/components/layout/MobileNav.tsx` | Responsive slide-out drawer with quick portal shortcuts & categories |
| **Interactive Search Input** | `next-frontend/components/layout/SearchBar.tsx` | High-contrast search with instant one-tap clear button |
| **Admin Notifications Center** | `next-frontend/components/admin/AdminNotificationsPopover.tsx` | Real-time bell popover with unread badge, "Mark read" (zero unread), "Clear all" (empty state), and individual item dismissal |
| **Admin Operations Sidebar** | `next-frontend/components/admin/AdminSidebar.tsx` | Zero-scrollbar non-scrollable desktop sidebar + auto-closing mobile drawer |
| **Global Footer & Auth Status** | `next-frontend/components/layout/Footer.tsx` | Rendered on all pages ("Shop More, Wait Less") |

---

### Backend API Endpoints & Services (`next-backend`)

The backend runs on **`http://127.0.0.1:4000`**. All endpoints are prefixed with `/api/v1`.

| If you want to inspect or modify... | Layer | File Location | Key Endpoints |
| :--- | :--- | :--- | :--- |
| **Interactive API Documentation** | OpenAPI UI | `next-backend/src/app.ts` | `GET http://127.0.0.1:4000/docs` |
| **Server Health & DB Ping** | Health | `src/modules/health/health.routes.ts` | `GET /health` |
| **User Registration & Login** | Auth Controller | `src/modules/auth/auth.routes.ts` | `POST /api/v1/auth/register`<br>`POST /api/v1/auth/login` |
| **Email Verification & Resend**| Auth Controller | `src/modules/auth/auth.routes.ts` | `POST /api/v1/auth/verify-email`<br>`POST /api/v1/auth/resend-code` |
| **Forgot & Reset Password** | Auth Controller | `src/modules/auth/auth.routes.ts` | `POST /api/v1/auth/forgot-password`<br>`POST /api/v1/auth/reset-password` |
| **Token Refresh & Logout** | Auth Service | `src/modules/auth/auth.service.ts` | `POST /api/v1/auth/refresh`<br>`POST /api/v1/auth/logout` (O(1) `lookupHash` index) |
| **Customer Order Placement** | Orders Service | `src/modules/orders/order.service.ts` | `POST /api/v1/orders` (Splits into `VendorOrder` records) |
| **Customer Orders List** | Orders Service | `src/modules/orders/order.service.ts` | `GET /api/v1/orders?page=1&limit=10` |
| **Order Lookup (Polymorphic)** | Orders Repo | `src/modules/orders/order.repository.ts` | `GET /api/v1/orders/:idOrNumber` |
| **Admin Orders Queue** | Orders Service | `src/modules/orders/order.service.ts` | `GET /api/v1/admin/orders?limit=100`<br>`PATCH /api/v1/admin/orders/:id/status` |
| **Admin Customer Aggregates** | Admin Customer Service | `src/modules/admin/admin.customer.service.ts` | `GET /api/v1/admin/customers`<br>`GET /api/v1/admin/customers/:id` |
| **Admin Platform Analytics** | Admin Analytics Service | `src/modules/admin/admin.analytics.service.ts` | `GET /api/v1/admin/analytics/overview` (Excludes `CANCELLED`/`REFUNDED` from revenue; live counts for customers, products, orders) |
| **Public Catalog & Search** | Products Controller | `src/modules/products/product.routes.ts` | `GET /api/v1/products`<br>`GET /api/v1/products/:slugOrId` |
| **Admin Product Creation** | Products Service | `src/modules/products/product.service.ts` | `POST /api/v1/products` (Admin & Super Admin) |
| **Admin Bulk Product Creation**| Products Service | `src/modules/products/product.service.ts` | `POST /api/v1/products/bulk` (Admin batch catalog upload) |
| **Product Mutation & OCC** | Products Service | `src/modules/products/product.service.ts` | `PATCH /api/v1/products/:id` (Admin & Vendor Owner) |
| **Product Soft-Deletion** | Products Service | `src/modules/products/product.service.ts` | `DELETE /api/v1/products/:id` (Admin & Super Admin) |
| **Product Categories** | Products Service | `src/modules/products/product.service.ts` | `GET /api/v1/products/categories` |
| **WooCommerce Flagship Sync** | Sync Service | `src/modules/sync/sync.service.ts` | `POST /api/v1/sync/products`<br>`GET /api/v1/sync/status/:jobId` |
| **Public Marketplace Directory** | Vendor Controller | `src/modules/vendors/vendor.routes.ts` | `GET /api/v1/vendors` |
| **Public Vendor Storefront** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/:slug` |
| **Self-Serve Vendor Onboarding**| Vendor Service | `src/modules/vendors/vendor.service.ts` | `POST /api/v1/vendors/register` |
| **Vendor Private Dashboard** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/me` |
| **Vendor Store Settings** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `PATCH /api/v1/vendors/portal/me` |
| **Vendor Product Inventory** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/products` |
| **Vendor Product Creation** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `POST /api/v1/vendors/portal/products` (Locked to `req.vendorId`) |
| **Vendor Bulk Product Upload** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `POST /api/v1/vendors/portal/products/bulk` (Batch CSV/Excel ingestion) |
| **Vendor WooCommerce Sync** | Vendor Sync Service | `src/modules/vendors/vendor.routes.ts` | `GET /api/v1/vendors/portal/sync`<br>`PATCH /api/v1/vendors/portal/sync`<br>`POST /api/v1/vendors/portal/sync/trigger` |
| **Vendor Stock / Price (OCC)** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `PATCH /api/v1/vendors/portal/products/:id` (OCC version counter check) |
| **Vendor Product Soft-Deletion**| Vendor Service | `src/modules/vendors/vendor.service.ts` | `DELETE /api/v1/vendors/portal/products/:id` (Tenant-isolated soft-delete) |
| **Vendor Orders & Dispatch** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/orders`<br>`PATCH /api/v1/vendors/portal/orders/:id/status` |
| **Vendor MoMo Payouts & Escrow**| Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/payouts` |
| **Admin Merchant Governance** | Vendor Service | `src/modules/vendors/vendor.routes.ts` | `GET /api/v1/vendors/admin/list`<br>`PATCH /api/v1/vendors/admin/:id/approve`<br>`PATCH /api/v1/vendors/admin/:id/status` |
| **Platform Audit Trail Logs** | Audit Service | `src/modules/audit/audit.routes.ts` | `GET /api/v1/audit/logs` |

---

### Database Models & Migrations

All models are defined in [`next-backend/prisma/schema.prisma`](./next-backend/prisma/schema.prisma):

- **`User`**: Accounts for customers, vendors, and admins (`role`: `CUSTOMER`, `VENDOR_OWNER`, `VENDOR_STAFF`, `ADMIN`, `SUPER_ADMIN`), with `emailVerified` boolean gating access.
- **`AuthCode`**: Time-limited 6-digit OTP verification codes (`codeHash`, `type`: `VERIFY_EMAIL` / `RESET_PASSWORD`, `expiresAt`, `usedAt`, `attempts`) protecting registrations and password resets.
- **`RefreshToken`**: Opaque session tokens tracked by `family` for replay attack detection, indexed with SHA-256 `lookupHash` (`@db.VarChar(64)`) for O(1) rotation lookups. All active families are revoked on password reset.
- **`Vendor`**: Merchant entity with `name`, `slug`, `logoUrl`, `momoNumber`, `momoNetwork`, `commissionRate`, and WooCommerce sync parameters (`wcStoreUrl`, `wcConsumerKey`, `wcConsumerSecret`, `wcLastSyncAt`, `wcSyncStatus`).
- **`Product`**: Catalog item with `price`, `regularPrice` (previous/compare-at price for discount percentage calculations and strikethrough), `stockQty`, `vendorId` (tenant key), `version` (OCC counter), and `deletedAt` (soft-delete).
- **`ProductImage`**: Multi-image gallery with sort order.
- **`Category`**: Hierarchical category tree.
- **`Order` & `OrderItem`**: Master customer checkout receipts snapshotting price, quantity, and vendor ID.
- **`VendorOrder`**: Sub-order split allocating line-items to their specific merchant (`subtotal`, `commissionAmount`, `vendorEarnings`, `clearedAt`).
- **`VendorPayout`**: 48h escrow holds and mobile money disbursement records.
- **`Review`**: Customer ratings and moderation flags.

---

### Domain Rules & Financial Logic

- **Exact Minor Currency Arithmetic:** [`next-backend/src/domain/Money.ts`](./next-backend/src/domain/Money.ts)
  - Enforces integer pesewa calculations.
  - Immutably prevents floating point drift.
- **Platform vs. Vendor Revenue Splits:** [`next-backend/src/domain/CommissionCalculator.ts`](./next-backend/src/domain/CommissionCalculator.ts)
  - Computes platform fee and derives merchant net by direct subtraction: `vendorNet = subtotal.subtract(platformFee)`.
  - Guarantees $platformFee + vendorNet \equiv subtotal$ with zero penny leakage.
- **Financial & Revenue Integrity (Exclusion of Cancelled Orders):**
  - Strict GAAP/IFRS e-commerce standard: orders in `CANCELLED` or `REFUNDED` status are excluded from all revenue calculations.
  - Gross Marketplace Volume (GMV), 10% Platform Commission Revenue, 90% Merchant Escrow Balances, Top Products by Revenue, and Category Sales summaries calculate only over valid non-cancelled orders (`status NOT IN ('CANCELLED', 'REFUNDED')`).
- **Previous Price vs. Current Price & Dynamic Discount Engine:**
  - When a product's previous price (`regularPrice`) is greater than current selling price (`price`):
    - Current price is displayed as the primary purchase price.
    - Previous price is displayed with a strikethrough (`line-through`).
    - Percentage discount badge is calculated and rendered: `Math.round(((regularPrice - price) / regularPrice) * 100)% OFF` (or `-X%`).
  - When `regularPrice` is null, undefined, or $\le$ `price`, strikethrough price and percentage badges are omitted.

---

## 🔐 5. Environment Variables Reference

### Backend (`next-backend/.env`)
```env
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://neondb_owner:...@ep-tiny-water-a4q8h601.us-east-2.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:...@ep-tiny-water-a4q8h601.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=super-secret-jwt-key-minimum-64-chars-long...
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://nextdor.online,https://nextdor.onrender.com
WOOCOMMERCE_STORE_URL=https://www.nextdor.online/wp-json/wc/store/v1

# ─── Cloudinary Image Hosting ─────────────
CLOUDINARY_CLOUD_NAME=mq17etnb
CLOUDINARY_API_KEY=536664647454792
CLOUDINARY_API_SECRET=VzaEvbCJW8KHmd_IwCYAr3h34-U
CLOUDINARY_URL=cloudinary://536664647454792:VzaEvbCJW8KHmd_IwCYAr3h34-U@mq17etnb
```

### Frontend (`next-frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=https://nextdor.onrender.com/api/v1
WOOCOMMERCE_STORE_URL=https://www.nextdor.online/wp-json/wc/store/v1

# ─── Cloudinary Image Hosting ─────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mq17etnb
CLOUDINARY_CLOUD_NAME=mq17etnb
CLOUDINARY_API_KEY=536664647454792
CLOUDINARY_API_SECRET=VzaEvbCJW8KHmd_IwCYAr3h34-U
CLOUDINARY_URL=cloudinary://536664647454792:VzaEvbCJW8KHmd_IwCYAr3h34-U@mq17etnb
```

---

## 🚀 6. Daily Development Commands

### 1. Running the Services Locally
In two separate terminal windows:
```bash
# Terminal 1: Backend
cd next-backend
npm run dev           # Runs at http://127.0.0.1:4000

# Terminal 2: Frontend
cd next-frontend
npm run dev           # Runs at http://localhost:3000
```

### 2. Database Tasks
```bash
cd next-backend
npx prisma db push    # Push schema changes to Neon DB without manual SQL migrations
npx prisma generate   # Regenerate the TypeScript Prisma Client
npx prisma studio     # Open interactive Web UI for the database
npm run seed          # Re-run database seeding (Admin + Direct Store + Sample Vendor)
```

### 3. Code Integrity Checks
```bash
# Verify TypeScript compiles with 0 errors
cd next-backend && npx tsc --noEmit
cd next-frontend && npm run build
```

---

## 🛠️ 7. Troubleshooting & Operational Runbook

### Issue 1: `EADDRINUSE: address already in use 0.0.0.0:4000`
- **Cause**: An orphan background Node.js process (from a previous `npm run dev` or `tsx watch` session) is still running and occupying port 4000.
- **Fix (Windows PowerShell One-Liner)**:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
  ```

### Issue 2: `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`
- **Cause**: On Windows, running dev servers lock Prisma's query engine DLL binary. Running `npx prisma generate` while the server is active causes an `EPERM` rename error.
- **Fix**:
  1. Stop the backend server in the terminal (`Ctrl + C`).
  2. Run `npx prisma generate`.
  3. Restart the server (`npm run dev`).

### Issue 3: Stale Types in IDE
- **Cause**: The IDE's in-memory TypeScript Language Server (TSServer) aggressively caches declaration files (`.d.ts`) inside `node_modules` and does not automatically reload them when Prisma regenerates types.
- **Fix**:
  1. Open Command Palette: `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac).
  2. Search and select: **`TypeScript: Restart TS Server`**.
  3. The error squiggles will immediately clear.

---

## 📖 8. Architecture Books & Advanced Reading

To deepen your mastery over each core pillar implemented in NextDor (Domain-Driven Design, Financial Conservation, Multi-Tenant Isolation, Concurrency Control, and Marketplace Economics), consult our dedicated reading curriculum:

👉 **[Recommended Books on Core Architectural Pillars](./RECOMMENDED_BOOKS_AND_ARCHITECTURE_PILLARS.md)**
