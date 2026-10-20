# NextDor Backend (`next-backend`)

> Enterprise-grade, high-throughput REST API for **NextDor** — Ghana's premier multi-vendor marketplace ("Shop More, Wait Less").

---

## ⚡ Tech Stack & Architecture

- **Runtime**: [Node.js](https://nodejs.org/) 20+ LTS
- **Framework**: [Fastify v5](https://fastify.dev/) (~76,000 requests/sec throughput)
- **Database & ORM**: [PostgreSQL 16](https://www.postgresql.org/) (Neon Serverless) via [Prisma ORM 5](https://www.prisma.io/)
- **Language**: TypeScript 5 with Clean Architecture
- **Validation**: [Zod](https://zod.dev/) for runtime environment and schema validation
- **Authentication**: JWT access tokens (15-min expiry) with RFC 6749 opaque refresh token family rotation (30-day expiry)
- **Payments**: [Paystack](https://paystack.com/) for Card and Mobile Money (MTN MoMo, Telecel Cash, AT Money)
- **Media**: [Cloudinary](https://cloudinary.com/) asset pipeline
- **API Documentation**: Interactive OpenAPI / Swagger UI at `/docs`

---

## 🚀 Getting Started

### 1. Installation

```bash
cd next-backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `next-backend` directory:

```env
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Database (PostgreSQL - Neon Serverless)
DATABASE_URL="postgresql://user:password@ep-sample.neon.tech/nextdor?sslmode=require"

# JWT Authentication
JWT_SECRET=super_secret_jwt_random_string_at_least_32_characters_long

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cloudinary Media
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Database Migration & Prisma Client

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes to Neon PostgreSQL
npm run db:push
```

### 4. Development Server

```bash
npm run dev
```

- API Server: `http://127.0.0.1:4000`
- Interactive OpenAPI / Swagger Docs: `http://127.0.0.1:4000/docs`
- Health Check: `http://127.0.0.1:4000/health`

### 5. Automated Tests & Live Service Diagnostics

```bash
# Run complete automated test suite (15 suites, 92 tests)
npm test

# Run live service verification suite (Neon DB, Redis, Paystack, Cloudinary, Invariants)
npm run verify:services

# Verify transactional email queue & live delivery
npm run email:check [recipient-email]
```

---

## 🏛️ Module & Directory Structure

The backend follows **Clean Architecture** organized into vertical feature slices in `src/modules/`:

```
src/
├── app.ts                          # Fastify app setup, plugins, and route registration
├── server.ts                       # Server listening entry point & graceful shutdown
├── config/                         # Zod-validated environment config
├── domain/                         # Domain Value Objects & arithmetic
│   ├── Money.ts                    # Martin Fowler Money Value Object (integer pesewas)
│   └── CommissionCalculator.ts     # Invariant 90/10 split with zero rounding leakage
├── lib/                            # Prisma, Redis, Email Queue, SMS, Logger, Errors, Guards
├── scripts/                        # verify-services.ts, check-email.ts
└── modules/
    ├── auth/                       # JWT tokens, refresh family rotation, RBAC guards
    ├── users/                      # User profile and address repository & service
    ├── products/                   # Product catalog, categories, OCC concurrency, soft delete
    ├── orders/                     # Checkout, multi-vendor sub-orders, COD lifecycle, stock reclamation
    ├── vendors/                    # Merchant onboarding, tenant-isolated inventory & payouts
    ├── returns/                    # 48-Hour escrow return claims, reviews, automated refunds
    ├── logistics/                  # GhanaPost GPS geo-pricing & courier dispatch webhooks
    ├── payouts/                    # Bulk MoMo payout batches & Paystack transfer engine
    ├── inventory/                  # Multi-warehouse tracking, stock transfers & low-stock alerts
    ├── admin/                      # Customer directory, analytics overview, reconciliation ledger
    ├── audit/                      # Immutable audit log service for governance tracking
    ├── health/                     # Health check endpoint with DB ping
    └── sync/                       # WooCommerce background migration sync worker
```

---

## 🌐 API Route Index

### 🔐 Authentication (`/api/v1/auth`)
- `POST /register`: Register a new customer account (dispatches 6-digit OTP verification code)
- `POST /verify-email`: Verify 6-digit OTP code, activate account, and issue session tokens
- `POST /resend-code`: Resend verification OTP code (protected by 60s cooldown)
- `POST /login`: Authenticate and receive access token + refresh cookie (intercepts unverified users with `EMAIL_NOT_VERIFIED`)
- `POST /forgot-password`: Request 6-digit recovery code sent via email (constant-time response)
- `POST /reset-password`: Validate recovery code, set new password, and invalidate all active session tokens
- `POST /refresh`: Rotate refresh token family and issue new access token
- `POST /logout`: Revoke active refresh token family

### 👤 Users & Addresses (`/api/v1/users`)
- `GET /me`: Authenticated profile details
- `PATCH /me`: Update profile name, phone
- `GET /me/addresses`: List customer delivery addresses
- `POST /me/addresses`: Add new address
- `PATCH /me/addresses/:id`: Edit address
- `DELETE /me/addresses/:id`: Remove address

### 📦 Products & Catalog (`/api/v1/products`)
- `GET /`: Paginated catalog with faceted filters (`minPrice`, `maxPrice`, `inStock`, `onSale`, `rating`, `category`, `vendor`, `search`, `sortBy`, `sortOrder`)
- `GET /autocomplete`: High-speed search autocomplete with prefix/infix matching, category aggregations, and 180-second Redis caching
- `GET /categories`: All product categories with product counts
- `GET /trending`: High sales velocity products
- `GET /sellers`: Multi-vendor product comparisons by name
- `GET /grouped-by-merchant`: Active merchant storefront preview groupings
- `GET /:slug`: Full product detail by URL slug
- `POST /`: Create new product (Admin or Super Admin only, assigns flagship vendor, invalidates Redis cache)
- `POST /bulk`: Batch catalog upload (Admin or Super Admin only)
- `PATCH /:id`: Update product details (Admin or Vendor with OCC version check)
- `DELETE /:id`: Soft-delete product (Admin only)

### 🛒 Orders & Checkout (`/api/v1/orders`)
- `POST /`: Atomic checkout supporting authenticated checkout (enforced customer identity, Paystack/MoMo/COD support)
- `GET /`: Paginated list of my orders
- `GET /:number`: Granular order tracking timeline (supports polymorphic lookup by order number `ND-XXXXX` or database UUID)
- `POST /:number/cancel`: Cancel an unfulfilled customer order (atomically restocks both WarehouseStock and Product)

### ↩️ Returns & Claims (`/api/v1/returns`)
- `POST /api/v1/orders/:number/returns`: Customer return claim creation within 48-hour escrow window
- `GET /api/v1/returns`: Paginated return requests list
- `GET /api/v1/returns/:id`: Return claim detail and tracking
- `POST /api/v1/vendors/returns/:id/review`: Merchant approval or rejection
- `POST /api/v1/admin/returns/:id/review`: Super-admin review and refund settlement
- `POST /api/v1/returns/:id/dispute`: Escalate return claim to dispute

### 🚚 Logistics & Couriers (`/api/v1/logistics`)
- `POST /quote`: GhanaPost GPS geo-pricing quote by delivery zone and parcel weight
- `POST /shipments`: Courier dispatch registration (Fez, Kwik, DHL) with tracking number generation
- `GET /shipments/:id/tracking`: Live milestone tracking events
- `POST /webhooks/courier`: Real-time third-party carrier webhook ingestion with customer SMS/email alerts

### 🏭 Multi-Warehouse Inventory (`/api/v1/inventory`)
- `GET /warehouses`: List fulfillment hubs (Accra Central, Kumasi Depot, Western Port)
- `GET /stock`: Warehouse-specific SKU stock levels
- `POST /stock/transfer`: Inter-warehouse stock transfer with atomic unit conservation
- `PATCH /stock/adjust`: Manual physical stock count adjustment
- `POST /webhooks/trigger-audit`: Trigger automated low-stock audit sweep and vendor notifications

### 💰 Payouts & Transfers (`/api/v1/payouts`)
- `GET /batches`: Historical merchant payout batches
- `POST /batches`: Create payout batch for eligible cleared orders (`paymentStatus === 'PAID'`, `clearedAt <= now`)
- `POST /batches/:id/process`: Execute automated bulk Mobile Money transfers via Paystack Transfers API

### 🏪 Vendors (`/api/v1/vendors`)
- `POST /register`: Public merchant onboarding application
- `GET /portal/me`: Merchant profile & MoMo payout info
- `PATCH /portal/me`: Update merchant settings
- `GET /portal/products`: Merchant's isolated inventory
- `POST /portal/products`: Publish new product
- `POST /portal/products/bulk`: Bulk CSV/Excel product upload with RFC 4180 parsing and row validation
- `GET /portal/sync`: Get vendor WooCommerce sync settings and last run status
- `PATCH /portal/sync`: Configure WooCommerce store URL and REST API keys
- `POST /portal/sync/trigger`: Trigger per-vendor catalog synchronization (Redis locked)
- `PATCH /portal/products/:id`: Edit vendor product with OCC concurrency lock
- `DELETE /portal/products/:id`: Tenant-isolated soft delete
- `GET /portal/orders`: Partitioned merchant sub-orders queue
- `PATCH /portal/orders/:id/status`: Update dispatch status (`PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`)
- `GET /portal/payouts`: Escrow balances and MoMo disbursement ledger
- `GET /admin/alerts`: Pending merchant KYC verification alerts for Admin notification popover

### 🛡️ Admin & Governance (`/api/v1/admin`)
- `GET /orders`: Global marketplace order management
- `GET /orders/:number`: View any order by number or UUID
- `PATCH /orders/:id/status`: Force-update order status with audit log note
- `POST /orders/reclaim-abandoned`: Trigger manual reclamation of abandoned unpaid orders
- `GET /customers`: Customer directory with order counts and spend totals
- `GET /customers/:id`: Customer detail with address and order history
- `GET /analytics/overview`: 30-day revenue metrics, daily trends, volume charts, and live database counts (`totalCustomers`, `totalProducts`, `totalOrders`; strictly excludes `CANCELLED` and `REFUNDED` orders from revenue)
- `GET /analytics/summary`: High-level dashboard summary metrics
- `GET /reconciliation/ledger`: Double-entry balance sheet verifying gateway + COD receipts against merchant liabilities, revenue, and refunds
- `GET /merchants`: Merchant verification queue
- `PATCH /merchants/:id/status`: Approve, suspend, or update commission rates

---

## 🔒 Security & Performance Highlights

1. **RFC 6749 Refresh Token Family Rotation**: Prevents replay attacks; re-using a revoked token invalidates the entire token family.
2. **O(1) SHA-256 Lookup Fingerprint**: Fast indexed `lookupHash` on refresh tokens prevents database table scans, combining microsecond lookups with bcrypt tamper-proof security.
3. **Tenant Isolation**: All vendor database queries strictly enforce `vendorId = req.authUser.vendorId`.
4. **Optimistic Concurrency Control (OCC)**: Version counters on product updates eliminate race conditions.
5. **Distributed Job Locking**: Redis locks (`lock:wc-sync:vendor:${id}`) prevent duplicate or overlapping WooCommerce synchronization workers.
6. **Paystack HMAC Verification**: Constant-time signature verification (`crypto.timingSafeEqual`) on all incoming payment webhooks.
7. **Integer Money Math**: Martin Fowler `Money` Value Object uses integer pesewas to eliminate floating point rounding leaks.
9. **Redis-Cached Search Autocomplete**: Sub-15ms prefix/infix product querying with 3-minute Redis cache TTL and SQL unaccent-insensitive indexing.
10. **Faceted Query Optimization**: Multi-facet catalog filtering with bounded offset pagination and concurrent count aggregation.
11. **Cash on Delivery (COD) Invariants**: COD checkouts are exempted from the 30-minute stock reclamation reaper, automatically settle to `PAID` upon physical courier delivery, and enforce strict payout gating (`order.paymentStatus === 'PAID'`).
12. **Multi-Warehouse Two-Way Stock Synchronization**: Order line item reservations decrement `WarehouseStock.quantity` and synchronize `Product.stockQty`. Cancellations and returns atomically restock both models and record immutable `StockMovement` audit logs.
13. **Dual-Inflow Double-Entry Ledger**: Financial reconciliation balances digital gateway receipts (Paystack) and physical cash collections (COD) against liabilities, platform revenue, and refunds with zero variance.
14. **BullMQ Resilient Asynchronous Queue**: Redis-backed background worker with concurrency-capped in-memory fallback for high-throughput non-blocking transactional emails and SMS notifications.

---

## 🔨 Building for Production

```bash
npm run build
npm start
```

