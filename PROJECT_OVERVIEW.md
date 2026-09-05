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
5. [Environment Variables Reference](#-5-environment-variables-reference)
6. [Daily Development Commands](#-6-daily-development-commands)
7. [Troubleshooting & Operational Runbook](#-7-troubleshooting--operational-runbook)

---

## 🎯 1. What is NextDor?

NextDor is a hybrid e-commerce ecosystem specifically tailored for the Ghanaian retail market:
- **Flagship Catalog with Live WooCommerce Sync:** Imports, updates, and synchronizes products in real-time from an existing WordPress/WooCommerce installation via an asynchronous RFC 7240 background worker.
- **Multi-Vendor Marketplace:** Independent Ghanaian vendors (bakeries, fashion designers, electronics stores) can register their own stores, manage private inventory, and receive mobile money payouts (MTN MoMo, Telecel Cash).
- **Concurrency & Race Condition Prevention:** Built with **Optimistic Concurrency Control (OCC)** so multiple store managers updating the same product never overwrite each other's stock.
- **Accurate Financial Engine:** Implements Martin Fowler's **Value Object Pattern** with fixed minor-unit integer arithmetic (pesewas), completely eliminating floating-point rounding errors.

---

## ⚡ 2. High-Level Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                          CLIENT BROWSERS                               │
   └───────────────┬────────────────────────────────────────┬───────────────┘
                   │ Port 3000                              │ Port 4000
   ┌───────────────▼────────────────┐       ┌───────────────▼───────────────┐
   │         next-frontend          │       │         next-backend          │
   │  - Next.js 14 App Router       │       │  - Fastify (High-throughput)  │
   │  - React 18, TypeScript        │       │  - Class-based 3-Tier Layering│
   │  - Lucide Icons & Responsive   │       │  - OpenAPI / Swagger Docs     │
   └────────────────────────────────┘       └───────────────┬───────────────┘
                                                            │ Prisma ORM
                                            ┌───────────────▼───────────────┐
                                            │        Neon PostgreSQL        │
                                            │  - Cloud Serverless Postgres  │
                                            │  - 14 Normalized Relational   │
                                            │    Data Models                │
                                            └───────────────────────────────┘
```

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, TailwindCSS utilities.
- **Backend:** Node.js 20+, Fastify, TypeScript, Prisma ORM, Pino logger.
- **Database:** Serverless Cloud PostgreSQL hosted on Neon (AWS `us-east-2`).
- **Security:** Argon2 / Bcrypt password hashing, JWT Access Tokens, RFC 6749 Opaque Refresh Token Family Rotation, Helmet security headers, IP Rate Limiting.

---

## 📁 3. Repository Directory Structure

```
NextDor/
├── next-backend/                     # Fastify REST API server
│   ├── prisma/
│   │   ├── schema.prisma             # Complete PostgreSQL database schema (14 models)
│   │   └── seed.ts                   # Seeds Super Admin, Flagship store, & demo vendor
│   ├── src/
│   │   ├── config/env.ts             # Zod environment variable validation
│   │   ├── domain/                   # Domain Layer (Money & CommissionCalculator)
│   │   ├── lib/                      # Prisma, Redis, Logger, Errors, Encryption
│   │   ├── modules/                  # 3-Tier Modules (Routes, Services, Repositories)
│   │   │   ├── auth/                 # Authentication, JWT, and Token Rotation
│   │   │   ├── health/               # /health liveness and database ping check
│   │   │   ├── products/             # Public catalog, categories, search, slug lookup
│   │   │   ├── sync/                 # Background WooCommerce sync engine
│   │   │   └── vendors/              # Multi-vendor portal, onboarding, & OCC inventory
│   │   ├── app.ts                    # Fastify application factory & plugin registry
│   │   └── server.ts                 # Server entry point & graceful shutdown handlers
│   └── tsconfig.json
│
├── next-frontend/                    # Next.js 14 Web Application
│   ├── app/                          # Next.js App Router directory
│   │   ├── account/                  # Customer profile & order history
│   │   ├── admin/products/           # Admin product table & WooCommerce Sync UI
│   │   ├── cart/                     # Shopping cart page
│   │   ├── category/[slug]/          # Category browsing page
│   │   ├── checkout/                 # Checkout flow with Paystack / MoMo mock
│   │   ├── login/ & register/        # Authentication pages
│   │   ├── product/[slug]/           # Dynamic product detail page
│   │   ├── search/                   # Search results page
│   │   ├── shop/                     # Master catalog browsing
│   │   ├── store/[slug]/             # Public vendor storefront profile
│   │   ├── vendor/dashboard/         # Private merchant portal with inline OCC editor
│   │   ├── layout.tsx & page.tsx     # Root layout and homepage
│   │   └── globals.css               # Global theme tokens
│   ├── components/                   # Reusable UI components (Navbar, Footer, Modals)
│   └── lib/utils.ts                  # Price formatters (GH₵) and date helpers
│
├── packages/shared/                  # Shared TypeScript interfaces across front & back
├── MULTI_VENDOR_OOD_ARCHITECTURE.md  # Deep-dive code and SOLID explanation
└── PROJECT_OVERVIEW.md               # This master document
```

---

## 🧭 4. "If I Want This, Where Do I Go?"

Use this reference whenever you need to find, edit, or extend a feature.

### Frontend Routes & UI Pages (`next-frontend`)

| If you want to view or edit... | Go to this file / directory | URL in Browser |
| :--- | :--- | :--- |
| **Homepage & Hero Banners** | `next-frontend/app/page.tsx` | `http://localhost:3000/` |
| **Product Detail Page (PDP)** | `next-frontend/app/product/[slug]/page.tsx` | `http://localhost:3000/product/chocolate-fudge-cake` |
| **Storewide Catalog Browsing** | `next-frontend/app/shop/page.tsx` | `http://localhost:3000/shop` |
| **Category Filtered View** | `next-frontend/app/category/[slug]/page.tsx` | `http://localhost:3000/category/cakes` |
| **Search Results & Filters** | `next-frontend/app/search/page.tsx` | `http://localhost:3000/search?q=cake` |
| **Customer Shopping Cart** | `next-frontend/app/cart/page.tsx` | `http://localhost:3000/cart` |
| **Checkout & Payment Form** | `next-frontend/app/checkout/page.tsx` | `http://localhost:3000/checkout` |
| **Order Confirmation Page** | `next-frontend/app/checkout/success/page.tsx` | `http://localhost:3000/checkout/success` |
| **Customer Login** | `next-frontend/app/login/page.tsx` | `http://localhost:3000/login` |
| **Customer Registration** | `next-frontend/app/register/page.tsx` | `http://localhost:3000/register` |
| **User Account & Orders** | `next-frontend/app/account/page.tsx` | `http://localhost:3000/account` |
| **Vendor Management Portal** | `next-frontend/app/vendor/dashboard/page.tsx` | `http://localhost:3000/vendor/dashboard`<br>(4 Tabs: Inventory & OCC, Store Orders & Dispatch, MoMo Payouts & 48h Escrow, Store Settings) |
| **Merchant Onboarding** | `next-frontend/app/vendor/register/page.tsx` | `http://localhost:3000/vendor/register` |
| **Super Admin Governance** | `next-frontend/app/admin/page.tsx` | `http://localhost:3000/admin` |
| **Admin Merchant Approvals** | `next-frontend/app/admin/merchants/page.tsx` | `http://localhost:3000/admin/merchants` |
| **Platform Audit Trail** | `next-frontend/app/admin/audit-logs/page.tsx` | `http://localhost:3000/admin/audit-logs` |
| **Public Merchant Storefront** | `next-frontend/app/store/[slug]/page.tsx` | `http://localhost:3000/store/sweet-bakes` |
| **Global Navigation Bar** | `next-frontend/components/Navbar.tsx` | Rendered on all pages |
| **Global Footer & Socials** | `next-frontend/components/Footer.tsx` | Rendered on all pages |

---

### Backend API Endpoints & Services (`next-backend`)

The backend runs on **`http://127.0.0.1:4000`**. All endpoints are prefixed with `/api/v1`.

| If you want to inspect or modify... | Layer | File Location | Key Endpoints |
| :--- | :--- | :--- | :--- |
| **Interactive API Documentation** | OpenAPI UI | `next-backend/src/app.ts` | `GET http://127.0.0.1:4000/docs` |
| **Server Health & DB Ping** | Health | `src/modules/health/health.routes.ts` | `GET /health` |
| **User Registration & Login** | Auth Controller | `src/modules/auth/auth.routes.ts` | `POST /api/v1/auth/register`<br>`POST /api/v1/auth/login` |
| **Token Refresh & Logout** | Auth Service | `src/modules/auth/auth.service.ts` | `POST /api/v1/auth/refresh`<br>`POST /api/v1/auth/logout` |
| **User Database Queries** | User Repo | `src/modules/auth/user.repository.ts` | Queries `User` & `RefreshToken` |
| **Public Catalog & Search** | Products Controller | `src/modules/products/product.routes.ts` | `GET /api/v1/products`<br>`GET /api/v1/products/:slug` |
| **Product Categories** | Products Service | `src/modules/products/product.service.ts` | `GET /api/v1/products/categories` |
| **Product Database Queries** | Products Repo | `src/modules/products/product.repository.ts` | Paginated search, eager loading |
| **WooCommerce Sync Engine** | Sync Service | `src/modules/sync/sync.service.ts` | `POST /api/v1/sync/products`<br>`GET /api/v1/sync/status/:jobId` |
| **WooCommerce REST Client** | Sync Client | `src/modules/sync/sync.client.ts` | Consumes WooCommerce API v3 |
| **Public Marketplace Directory** | Vendor Controller | `src/modules/vendors/vendor.routes.ts` | `GET /api/v1/vendors` |
| **Public Vendor Storefront** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/:slug` |
| **Self-Serve Vendor Onboarding**| Vendor Service | `src/modules/vendors/vendor.service.ts` | `POST /api/v1/vendors/register` |
| **Vendor Private Dashboard** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/me` |
| **Vendor Store Settings** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `PATCH /api/v1/vendors/portal/me` |
| **Vendor Product Inventory** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/products` |
| **Vendor Product Creation** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `POST /api/v1/vendors/portal/products` |
| **Vendor Stock / Price (OCC)** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `PATCH /api/v1/vendors/portal/products/:id` |
| **Vendor Orders & Dispatch** | Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/orders`<br>`PATCH /api/v1/vendors/portal/orders/:id/status` |
| **Vendor MoMo Payouts & Escrow**| Vendor Service | `src/modules/vendors/vendor.service.ts` | `GET /api/v1/vendors/portal/payouts` |
| **Admin Merchant Governance** | Vendor Service | `src/modules/vendors/vendor.routes.ts` | `GET /api/v1/vendors/admin/list`<br>`PATCH /api/v1/vendors/admin/:id/approve`<br>`PATCH /api/v1/vendors/admin/:id/status` |
| **Platform Audit Trail Logs** | Audit Service | `src/modules/audit/audit.routes.ts` | `GET /api/v1/audit/logs` |
| **Vendor Database Queries** | Vendor Repo | `src/modules/vendors/vendor.repository.ts` | Isolated tenant queries, sub-orders, escrow |

---

### Database Models & Migrations

All models are defined in [`next-backend/prisma/schema.prisma`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/prisma/schema.prisma):

- **`User`**: Accounts for customers, vendors, and admins (`role`: `CUSTOMER`, `VENDOR_OWNER`, `VENDOR_STAFF`, `ADMIN`, `SUPER_ADMIN`).
- **`RefreshToken`**: Opaque session tokens tracked by `family` for replay attack detection.
- **`Vendor`**: Merchant entity with `name`, `slug`, `logoUrl`, `momoNumber`, and `commissionRate`.
- **`Product`**: Catalog item with price, stock, `vendorId` (tenant key), and `version` (OCC counter).
- **`ProductImage`**: Multi-image gallery with sort order.
- **`Category`**: Hierarchical category tree.
- **`Order` & `OrderItem`**: Master customer checkout receipts.
- **`VendorOrder`**: Sub-order split allocating line-items to their specific merchant.
- **`VendorPayout`**: Escrow holds and mobile money disbursement records.
- **`Review`**: Customer ratings and moderation flags.

---

### Domain Rules & Financial Logic

- **Exact Minor Currency Arithmetic:** [`next-backend/src/domain/Money.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/domain/Money.ts)
  - Enforces integer pesewa calculations.
  - Immutably prevents floating point drift.
- **Platform vs. Vendor Revenue Splits:** [`next-backend/src/domain/CommissionCalculator.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/domain/CommissionCalculator.ts)
  - Computes platform fee and derives merchant net by direct subtraction.
  - Guarantees $platformFee + vendorNet \equiv subtotal$ with zero penny leakage.

---

## 🔐 5. Environment Variables Reference

### Backend (`next-backend/.env`)
```env
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://neondb_owner:npg_xJ70zPqVdMoe@ep-tiny-water-a4q8h601.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long-12345
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
WOOCOMMERCE_URL=https://nextdor.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

### Frontend (`next-frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000/api/v1
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
cd next-frontend && npx tsc --noEmit
```

---

## 🛠️ 7. Troubleshooting & Operational Runbook

### Issue 1: `EADDRINUSE: address already in use 0.0.0.0:4000`
- **Cause**: An orphan background Node.js process (from a previous `npm run dev` or `tsx watch` session) is still running and occupying port 4000.
- **Fix (Windows PowerShell One-Liner)**:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
- **Manual Step-by-Step**:
  ```powershell
  # 1. Identify the process ID (PID) holding port 4000
  Get-NetTCPConnection -LocalPort 4000 | Select-Object LocalAddress, LocalPort, OwningProcess, State

  # 2. Force kill the process by PID
  Stop-Process -Id <PID> -Force
  ```

### Issue 2: `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`
- **Cause**: On Windows, running dev servers lock Prisma's query engine DLL binary. Running `npx prisma generate` while the server is active causes an `EPERM` rename error.
- **Fix**:
  1. Stop the backend server in the terminal (`Ctrl + C`).
  2. Run `npx prisma generate`.
  3. Restart the server (`npm run dev`).

### Issue 3: Stale Types in IDE (e.g. `Property 'version' does not exist on type 'Product'`)
- **Cause**: The IDE's in-memory TypeScript Language Server (TSServer) aggressively caches declaration files (`.d.ts`) inside `node_modules` and does not automatically reload them when Prisma regenerates types.
- **Fix**:
  1. Open Command Palette: `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac).
  2. Search and select: **`TypeScript: Restart TS Server`**.
  3. The error squiggles will immediately clear.
