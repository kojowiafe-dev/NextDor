# NextDor — Complete Codebase Analysis & System Architecture

## 1. Executive Summary

**NextDor** (`nextdor.online`) is an enterprise-grade Ghanaian multi-vendor e-commerce marketplace operating under the brand motto **"Shop More, Wait Less"**. The platform connects local customers with verified Ghanaian merchants across Accra, Kumasi, and regions nationwide, supporting electronics, computing, fashion, beauty, home goods, and supermarket essentials priced in **Ghanaian Cedis (GHS)**.

The system is architected as a high-performance monorepo:
1. **`next-frontend`**: Next.js 16 (App Router + Turbopack + React 19) delivering a lightning-fast customer storefront, authenticated customer account management, a merchant self-service portal, and a super admin console.
2. **`next-backend`**: Node.js 20 LTS + Fastify v5 high-throughput REST API with Prisma ORM 5 connecting to Neon Serverless Cloud PostgreSQL, Paystack payment integration, and Cloudinary media pipelines.
3. **`packages/shared`**: Shared TypeScript types, interfaces, and Zod schemas shared between frontend and backend to guarantee end-to-end type safety.

---

## 2. Technology Stack

| Layer | Technologies & Libraries | Key Responsibilities |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16.3 (App Router, Turbopack, React 19) | Server and Client Components, SSR, dynamic routing, metadata |
| **Frontend Styling** | Tailwind CSS v4, Lucide React, Google Outfit Font | Brand Amazon/NextDor palette (`#ff9900`, `#131921`), responsive layouts |
| **Frontend Caching** | Multi-Tier SWR (`clientCache.ts`, `adminCache.ts`), `fetchDedupe` | Instant navigation, memory + localStorage persistence, deduplication |
| **Backend Framework** | Fastify v5, `@fastify/cors`, `@fastify/helmet`, `@fastify/swagger` | High-throughput async HTTP server (~76k req/s), OpenAPI documentation |
| **Database & ORM** | PostgreSQL 16 (Neon Serverless), Prisma ORM 5 | 15 relational models (including `AuthCode`), migrations, ACID transactions, UUID v4 keys |
| **Authentication** | JWT (HS256), RFC 6749 Opaque Refresh Tokens, bcryptjs | 15-min access tokens, 30-day token family rotation, 6-digit OTP email verification, full session revocation on password reset |
| **Access Control (RBAC)**| 5-Tier Roles (`CUSTOMER`, `VENDOR_OWNER`, `VENDOR_STAFF`, `ADMIN`, `SUPER_ADMIN`) | Route guards, tenant isolation, admin oversight |
| **Payments & Escrow** | Paystack (Node SDK), Mobile Money (MTN, Telecel, AT), Cards | Webhooks with HMAC-SHA512 verification, 48-hour delivery escrow |
| **Media & CDN** | Cloudinary v2, Next.js Image Optimization | Serverless signed image uploads (`/api/upload`), edge transcoding |
| **Concurrency Control**| Optimistic Concurrency Control (OCC) | Version counters on products to prevent concurrent write collisions |
| **Catalog Ingestion**  | 3-Tier Pipeline (Single OCC, RFC 4180 Bulk CSV, WooCommerce Sync) | Flexible onboarding for solo artisans to bulk enterprise catalogs with Redis locking |
| **Pricing Engine**      | Compare-At Strikethrough & Dynamic Discount % | Dynamic badge computation (`-X%` / `X% OFF`) when `regularPrice > price` |
| **Search Intelligence** | Instant Server Autocomplete & Suggestions | 220ms debounce search (`GET /api/v1/products/autocomplete`) with category chips and product preview cards |
| **Faceted Catalog**     | Multi-Facet Filtering Engine | Price range presets & custom inputs, in-stock toggle, deals toggle, rating stars, and mobile drawer |
| **Financial Accounting**| GAAP/IFRS Revenue & Escrow Invariant | Excludes `CANCELLED` and `REFUNDED` orders from GMV, platform revenue, and escrow |

---

## 3. High-Level Monorepo Structure

```
NextDor/
├── next-frontend/                      # Next.js 16 App Router Client
│   ├── app/                            # 41 active routes
│   │   ├── (storefront)/               # Customer shopping routes (/, /shop, /deals, /product/[slug], /cart, /checkout, /returns)
│   │   ├── (auth)/                     # /login, /register, /verify-email, /forgot-password, /reset-password
│   │   ├── account/                    # Customer portal (/account, /account/orders, /account/addresses)
│   │   ├── vendor/                     # Merchant portal (/vendor/dashboard, /vendor/register)
│   │   ├── admin/                      # Super admin console (/admin, /admin/customers, /admin/analytics, /admin/inventory, /admin/payouts)
│   │   └── api/upload/                 # Cloudinary image upload serverless route handler
│   ├── components/                     # Reusable UI component library
│   │   ├── account/                    # ReturnRequestModal.tsx, ReturnClaimCard.tsx
│   │   ├── vendor/                     # CourierDispatchModal.tsx, PackingSlipModal.tsx, BulkUploadModal.tsx
│   │   ├── returns/                    # ReturnsLookupBar.tsx
│   │   ├── layout/                     # StoreHeader, CategoryNav, MobileNav, BottomNav, Footer
│   │   ├── shop/                       # ShopFilters, ActiveFilterChips, MobileFilterDrawer
│   │   ├── home/                       # HeroCarousel, CategoryTiles, ProductRow, TrendingSection
│   │   ├── product/                    # ProductCard, ProductGrid, PriceDisplay, AddToCartButton
│   │   ├── admin/                      # AdminNavbar, AdminSidebar, AdminNotificationsPopover, DataTables
│   │   └── ui/                         # Modal, ImageUpload, Pagination, Input
│   ├── context/                        # Global state (CartContext, AuthContext, ToastContext)
│   └── lib/                            # Business logic, caching, and API clients
│       ├── cache/                      # clientCache.ts, adminCache.ts (SWR cache engines)
│       ├── api/                        # client.ts, adminApi.ts, vendorApi.ts
│       └── auth/                       # tokenStorage.ts, session utilities
│
├── next-backend/                       # Fastify v5 Production REST API
│   ├── src/
│   │   ├── app.ts                      # Fastify instance, plugins, error handlers
│   │   ├── server.ts                   # Startup entry point (port 4000)
│   │   ├── config/                     # Environment validation with Zod
│   │   ├── domain/                     # Martin Fowler Money Value Object & CommissionCalculator
│   │   ├── lib/                        # Email queue, SMS, Prisma, Logger, Origins
│   │   ├── scripts/                    # verify-services.ts, check-email.ts
│   │   └── modules/                    # Feature vertical slices (Clean Architecture)
│   │       ├── auth/                   # Register, login, OTP verify, password recovery, refresh rotation
│   │       ├── users/                  # Customer profile and address repository & service
│   │       ├── products/               # Catalog, categories, autocomplete, faceted filtering, OCC locking
│   │       ├── orders/                 # Checkout, multi-vendor sub-orders, COD state machine, stock reclamation
│   │       ├── vendors/                # Merchant onboarding, tenant-isolated inventory & payouts
│   │       ├── returns/                # 48-Hour escrow return claims, merchant & admin reviews, refunds
│   │       ├── logistics/              # GhanaPost GPS geo-pricing & courier dispatch webhooks
│   │       ├── payouts/                # Bulk MoMo payout batches & Paystack Transfers API
│   │       ├── inventory/              # Multi-warehouse tracking, stock transfers & low-stock alerts
│   │       ├── admin/                  # Admin customer directory, analytics overview, double-entry ledger
│   │       ├── audit/                  # Platform audit logging (immutable events)
│   │       └── sync/                   # Asynchronous WooCommerce migration sync worker
│   ├── prisma/                         # schema.prisma, migrations, seeds
│   └── package.json
│
├── packages/shared/                    # Monorepo shared schemas and types
│   ├── src/schemas/                    # Zod validation schemas (auth, product, order, vendor, returns, logistics, payouts, inventory)
│   └── src/index.ts
└── documentation/                      # Architectural specifications
```

---

## 4. Frontend Application Portals

The frontend provides four distinct user experiences governed by RBAC and clean navigation:

### 🛍️ Storefront Portal (Public & Customer)
- **`/`**: Dynamic homepage featuring Hero carousel, top categories, Deal of the Day, Flash Sales, and trending products.
- **`/shop`**: 2-column full catalog with desktop `ShopFilters.tsx` sidebar, `ActiveFilterChips.tsx`, `MobileFilterDrawer.tsx`, price presets/custom inputs, in-stock/deals toggles, rating filters, server search, and pagination.
- **`/deals`**: Dedicated Deals Hub with discount tier filtering (🔥 50%+ OFF, ⚡ 30%+ OFF, 15%+ OFF, Under GH₵100), category pills, and sorting by savings.
- **`/product/[slug]`**: Rich product detail page with high-resolution image galleries, specifications sheet (`ProductSpecifications.tsx`), stock status, seller comparison ("Other Sellers"), and Add to Cart.
- **`/category/[slug]`**: Category showcase page with hero banner, sibling category selector pills, breadcrumb trails, and live faceted filters.
- **`/cart`**: Interactive shopping cart with quantity adjustment, price calculation, and subtotal updates.
- **`/checkout`**: Multi-step checkout with delivery address selection, Ghana delivery options (Standard, Express, Pickup), and Paystack / MoMo / Cash on Delivery payment initiation.
- **`/track-order`**: Public order status lookup accepting order numbers (e.g. `ND-00001`) or tracking UUIDs.
- **`/returns`**: Customer self-serve returns and claims hub powered by `ReturnsLookupBar.tsx`, allowing buyers to check 48-hour return eligibility and track active claim statuses.
- **`/login` & `/register`**: Seamless customer sign-in with auto-redirect back to checkout or original location.
- **`/verify-email`**: Mobile-optimized 6-digit OTP entry screen with large numeric keypad spacing, resend cooldown timer, and auto-session start.
- **`/forgot-password` & `/reset-password`**: Secure password recovery flow with time-limited OTP code verification and password strength enforcement.

### 👤 Customer Account Portal (`/account`)
- **`/account`**: Central customer overview with recent orders, default shipping address, and quick shortcuts.
- **`/account/orders` & `/account/orders/[id]`**: Complete order history, line item breakdown, tracking status timeline, and cancel order capability.
  - Delivered orders display the **"Request Return"** action within the 48-hour escrow window, opening `ReturnRequestModal.tsx`.
  - Active claims render the live `ReturnClaimCard.tsx` showing current inspection status (`REQUESTED`, `APPROVED`, `REJECTED`, `REFUNDED`).
- **`/account/addresses`**: Multi-address management (Home, Work, Other) with default address toggling.
- **`/account/wishlist`**: Saved items for future purchase.
- **`/account/settings`**: Profile information and security management.

### 🏪 Merchant Portal (`/vendor`)
- **`/vendor/register`**: Public merchant onboarding with business registration, owner details, and Mobile Money payout configuration (MTN MoMo, Telecel Cash, AT Money).
- **`/vendor/dashboard`**: 4-tab reactive console:
  1. *Inventory & Stock*: Real-time product table and responsive mobile cards (`< md`), inline price/stock editor with OCC concurrency protection, Cloudinary image uploader, slide-over OCC edit drawer, and 3-tier product ingestion modal:
     - **Single Product Entry**: Comprehensive modal with live Cloudinary drag-and-drop media upload and OCC locking.
     - **Bulk CSV/Excel Upload**: Powered by `BulkUploadModal.tsx`, featuring RFC 4180 parsing, delimiter autodetection, row-by-row error validation, and one-click sample template download.
     - **WooCommerce Store Sync**: Powered by `StoreSyncModal.tsx`, connecting to external stores via `/wp-json/wc/v3/products` with per-vendor Redis distributed locks (`lock:wc-sync:vendor:${id}`).
  2. *Store Orders & Dispatch*: Partitioned sub-orders (`VendorOrder`), buyer address snapshots, line items, 1-click dispatch progression (`PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`), integrated **Courier Dispatch Modal** (`CourierDispatchModal.tsx`), and printable thermal/A4 **Packing Slip Modal** (`PackingSlipModal.tsx`).
  3. *MoMo Payouts & Escrow*: Lifetime earnings, funds in 48-hour customer verification escrow, available balances, and automated transfer ledger.
  4. *Store Profile & Settings*: Brand identity, store bio, logo, banner, and settlement phone numbers.

### 🛡️ Admin Management Console (`/admin`)
- **`/admin`**: Executive dashboard with platform KPIs, gross revenue, vendor count, order volume, live PostgreSQL database metrics (`totalCustomers`, `totalProducts`, `totalOrders`), and recent audit activity (strictly excludes `CANCELLED` and `REFUNDED` orders from revenue calculations).
- **Admin Notifications Center**: Interactive header bell popover (`AdminNotificationsPopover.tsx`) with real-time unread badge, one-click "Mark read" (zeroes unread count), one-click "Clear all" (switches to empty state), and individual item dismissal with persistent storage.
- **Admin Navigation**: Zero-scrollbar non-scrollable desktop sidebar (`AdminSidebar.tsx`) with large NextDor logo and full-text action buttons, paired with a touch-friendly auto-dismissing mobile drawer with close (`X`) control.
- **`/admin/orders`**: Global order management across all marketplace transactions, search by customer or order number, courier dispatch console, and manual status override with audit logging.
- **`/admin/products`**: Global catalog directory, pricing audits, admin product creation (`POST /api/v1/products` via `AdminProductCreateForm`), admin bulk upload (`POST /api/v1/products/bulk`), and soft-delete controls.
- **`/admin/inventory`**: Multi-warehouse physical stock dashboard, cross-hub transfers with atomic unit conservation, and SKU low-stock threshold monitors.
- **`/admin/payouts`**: Automated Paystack MoMo transfers, batch payout history, and double-entry reconciliation balance sheet ledger verifying gateway/COD receipts against liabilities and platform revenue.
- **`/admin/customers` & `/admin/customers/[id]`**: Customer directory with order counts, lifetime spend aggregates, and full customer detail history.
- **`/admin/analytics`**: 30-day revenue trends, daily order distribution, top-selling categories, and vendor performance breakdowns (excluding cancelled/refunded orders).
- **`/admin/merchants`**: Merchant application queue, KYC review, commission rate adjustment, and one-click approval/suspension.
- **`/admin/admins`**: Administrative staff directory and role assignment.
- **`/admin/settings`**: Platform operational parameters, escrow durations, and maintenance modes.

### 📱 Mobile-First Navigation & Usability
- **Responsive Mobile Product Cards (`< md`)**: Eliminates horizontal scroll congestion on mobile phones by transforming 7-column desktop tables into stacked product cards with high-contrast badge indicators and one-tap action menus.
- **Bottom-Sheet Catalog Ingestion**: Tapping "+ Add Product" on mobile triggers an accessible bottom sheet modal with options for Single Entry, Bulk CSV, or WooCommerce Sync.
- **Slide-Over OCC Edit Drawer**: Quick edits to stock and price occur directly in a slide-over drawer without full page reloads.
- **Persistent Bottom Navigation (`BottomNav.tsx`)**: High-convenience thumb navigation bar fixed at viewport bottom with 1-tap access to Home, Shop/Explore, Search, Cart (with live animated item count badge), and Account/Sign In.
- **Horizontal Swipeable Category Pills (`CategoryNav.tsx`)**: Responsive mobile category strip right beneath the header enabling instant category switching with horizontal touch swipe, without requiring menu drawer interaction.
- **Accessible Mobile Drawer (`MobileNav.tsx`)**: Streamlined slide-out navigation with quick portal shortcuts (Admin Portal / Vendor Portal), account management, category directory, and touch-optimized tap targets.
- **High-Contrast Quick Search (`SearchBar.tsx`)**: High-visibility white search input with instant clear (`X`) button for rapid query adjustments on mobile screens.
- **Touch-Optimized Verification Screens**: Single-column vertical form layouts with `inputMode="numeric"`, high-contrast buttons, and clear countdown feedback for mobile screens.

---

## 5. Backend Architecture & Clean Design

The backend enforces strict **Clean Architecture** and **SOLID** principles:

### Separation of Concerns
1. **Route Handlers / Controllers (`*.routes.ts`)**: HTTP-only concerns. Extract headers/tokens, validate input schemas with Zod, and delegate business decisions to services.
2. **Domain Services (`*.service.ts`)**: Pure business logic. Enforce invariants (e.g. stock availability, commission math, status transitions), wrap multi-step operations in transactions, and manage cache invalidations.
3. **Repositories (`*.repository.ts`)**: Data access layer. Encapsulate all Prisma ORM operations, database joins, pagination skips, and index hints. Services never write raw SQL or call Prisma directly.
4. **Domain Value Objects (`domain/Money.ts`)**: Monetary calculations run in minor units (integer pesewas) via Martin Fowler's `Money` pattern to eliminate JavaScript IEEE 754 floating-point rounding errors.

### Polymorphic Order Retrieval
`OrderRepository.findByNumber(numberOrId, userId)` supports polymorphic lookups:
- If a string matches the UUID pattern, it queries by primary key `id`.
- Otherwise, it queries by the human-readable unique order number (`number`, e.g. `ND-00001`).
- This allows seamless interoperability across Paystack webhook references, customer tracking URLs, and internal administrative tools.

---

## 6. Frontend Caching & Data Flow

To ensure sub-100ms page transitions without stale data or duplicate network roundtrips:
1. **Multi-Tier SWR (`clientCache.ts`, `adminCache.ts`)**:
   - **L1 Memory**: Instant synchronous cache hit (0ms latency).
   - **L2 localStorage**: Persistent cross-tab and reload cache with configurable TTLs (e.g. 5 minutes for catalog, 1 minute for admin analytics).
2. **In-Flight Request Deduplication (`fetchDedupe`)**:
   - Simultaneous components requesting the same API endpoint share a single inflight Promise, preventing API hammering during component mount waterfalls.
3. **Mutation Invalidation**:
   - Mutations (e.g. placing an order, editing inventory, approving a merchant) immediately purge related cache keys (`clientCache.invalidate("products")`, `adminCache.invalidate("orders")`), ensuring instant UI consistency.
4. **Zero Dummy Data**:
   - All mock data arrays and placeholder JSON fixtures have been removed. Every page and table connects directly to the live backend API, with graceful loading skeletons and empty state UI when no records exist.

---

## 7. Security & Compliance Architecture

| Area | Implementation Details |
| :--- | :--- |
| **Authentication** | Dual-token authentication: short-lived (15 min) JWT access tokens + long-lived (30 day) cryptographically secure opaque refresh tokens stored hashed in the database. |
| **Email Verification** | 6-digit cryptographic OTP codes stored SHA-256 hashed with 15-minute TTL and max 5 attempts. Unverified accounts cannot authenticate and are redirected to verification with automatic code re-dispatch. |
| **Password Recovery** | Forgot password endpoint uses constant-time response to prevent email harvesting. Password reset updates bcrypt hash (cost 12), marks code used, and permanently revokes all active refresh token families across all devices. |
| **Token Family Rotation** | RFC 6749 token family rotation. If a previously used refresh token is presented again (indicating token theft), the entire family is instantly revoked, forcing re-authentication. |
| **O(1) Token Indexing**   | Refresh tokens include a SHA-256 `lookupHash` index for microsecond indexed lookups before bcrypt verification, eliminating table-scan denial-of-service vulnerabilities. |
| **Tenant Isolation** | All vendor operations enforce database isolation: queries are hard-filtered by `vendorId = req.authUser.vendorId`. Merchants cannot view, modify, or delete another merchant's data. |
| **Optimistic Concurrency**| Product updates include `version: product.version`. If another process updated the product concurrently, the database returns 0 rows updated, throwing `ConflictError` instead of overwriting data. |
| **Distributed Locking**   | Asynchronous WooCommerce synchronization workers acquire Redis distributed locks (`lock:wc-sync:vendor:${id}`) to prevent race conditions or duplicate product ingestion. |
| **Audit Logging** | High-privilege administrative and merchant actions (merchant approval, commission changes, order status overrides) create immutable `AuditLog` records containing user ID, IP address, timestamp, and payload snapshots. |
| **Payment Integrity** | Paystack webhooks are validated using HMAC-SHA512 with timing-safe comparison (`crypto.timingSafeEqual`) on the raw request body before processing. |
| **Financial Integrity**   | Orders with `status IN ('CANCELLED', 'REFUNDED')` are strictly excluded from GMV, 10% platform commission revenue, and 90% merchant escrow reserves. |

---

## 9. Checkout & Customer Order Visibility Lifecycle

### Problem Identified
Previously, customers completing checkout might see a "Success" redirect while zero orders appeared in their Account Overview (`/account`) or My Orders (`/account/orders`) page. Root cause investigation revealed:
1. **Schema Rejection on WooCommerce IDs**: Fastify's route body schema strictly enforced `format: "uuid"` on `cart.items.productId`. Products from WooCommerce had numeric IDs (e.g. `"1245"`), which caused Fastify to reject requests with `400 Bad Request`.
2. **PostgreSQL Type Mismatch**: `findProductsForCheckout` queried `where: { id: { in: productIds } }`. Passing numeric strings like `"1245"` to a PostgreSQL UUID column caused query failures or `NotFoundError`.
3. **Silent Client Fallback**: The frontend `checkout/page.tsx` caught errors from `placeOrder`, logged a console warning, generated an ephemeral random order number (`ND-XXXXX`), cleared the cart, and redirected to `/checkout/success`. The database never received the order.
4. **Untracked Stock Decrement**: The transaction in `order.repository.ts` ran `stockQty: { gte: item.quantity }`, which threw a constraint violation on WooCommerce products where `stockQty` is `null`.
5. **Guest vs. Authenticated Account Decoupling**: If an order was placed without an active JWT token, the order had `userId: null`, preventing the customer from viewing it when logged in.
6. **Stale SWR Caching & Token Hydration**: Client order caches were not invalidated on checkout completion, and account pages skipped fetching when `token` was hydrating.

### Robust Solutions Implemented
- **Polymorphic Product Resolution & Auto-Upsert**:
  - `findProductsForCheckout` dynamically partitions incoming identifiers into UUIDs (`id`), numeric IDs (`wcId`), and slugs (`slug`).
  - If a catalog product is missing from the local database, it is automatically upserted under the flagship vendor (`nextdor`) with snapshots of its name, price, and image.
  - The immutable database UUID is always snapshotted in `OrderItem.productId`.
- **Untracked Stock Resilience**:
  - Stock decrement only applies to products where `stockQty: { not: null, gte: item.quantity }`. Untracked products never fail checkout.
- **Account Linking & Case-Insensitive Order Retrieval**:
  - In `OrderService.checkout`, if `userId` is missing but `guestEmail` matches an existing registered user, `finalUserId` is automatically linked to `user.id`.
  - In `OrderRepository.findByUserId` and `findByNumber`, queries search for `{ OR: [{ userId }, { guestEmail: { equals: user.email, mode: "insensitive" } }] }`. Even if a customer checked out as a guest or before logging in, all orders placed under their email appear in their order history.
- **Strict Frontend Error Handling & Cache Eviction**:
  - Removed silent error-swallowing in `app/checkout/page.tsx`. If an API error occurs, a prominent alert banner displays the exact issue to the user, and cart contents remain intact.
  - Upon successful order placement, `ordersCache.invalidateAll()` is triggered immediately, ensuring the Overview and My Orders pages reflect the new order upon navigation.
  - Both `/account` and `/account/orders` use an effective token fallback (`token || localStorage.getItem("nextdor-token")`) and synchronize with `authLoading` so order lists never fail to render due to mount timing.

---

## 10. Mandatory Authenticated Checkout Gateway

To completely eradicate ghost orders, prevent customer delivery confusion, and guarantee courier tracking:
1. **Frictionless Auth Gateway**:
   - Guests clicking **"Proceed to Checkout"** in `/cart` are dynamically routed to `/login?redirect=/checkout`.
   - Direct visits to `/checkout` without an active session seamlessly redirect to `/login?redirect=/checkout` while preserving cart contents.
2. **Reassuring Contextual Login / Register UI**:
   - Both `/login` and `/register` display an amber alert banner when `redirect=/checkout`:
     > *"Sign in to complete your checkout: Your cart items are saved. Sign in or create an account in seconds to unlock live courier dispatch tracking and order receipts."*
   - Switching between "Sign In" and "Create one" preserves `?redirect=/checkout`.
3. **Backend Enforcement**:
   - `POST /api/v1/orders` strictly enforces `preHandler: requireAuth`.
   - `OrderService.checkout` strictly validates `input.userId`, rejecting any unauthenticated order creation attempts at the API level with `401 Unauthorized`.
4. **Verified Account Banner on Checkout**:
   - `/checkout` displays the buyer's authenticated badge:
     > *"Verified Account · Kwame Mensah (kwame@example.com) — Your order and courier dispatch timeline will be permanently linked to your dashboard."*

---

## 11. Enterprise Hardening & Production Integrity (Completed)

To ensure enterprise-grade reliability, maintainability, and scalability:
1. **Zero Secrets in Repository & Validation Guard**:
   - Replaced all active database URLs, JWT tokens, and Cloudinary keys across `.env.example` templates with generic placeholders.
   - Built startup audit validation in `env.ts` with `superRefine` that halts server boot if dummy or known leaked secrets are loaded in production.
2. **CORS & Origin Security Policy**:
   - Implemented exact-origin validation in `origins.ts` and `originPolicy.ts`, blocking wildcard preview domains from accessing credentialed (`credentials: true`) cookies while preserving development localhost flexibility.
3. **Decoupled Payment Settlement & Webhook Verification**:
   - Created pure `paystack.ts` helpers for constant-time HMAC-SHA512 webhook signature verification, preventing replay attacks and timing side-channels.
   - Implemented `PaymentRepository.settleSuccessfulPayment` to idempotently update orders, avoiding race conditions or double settlements.
4. **Atomic Concurrency & Inventory Protection**:
   - Conditional inventory decrement in `OrderRepository` prevents overselling under heavy concurrent checkouts.
   - Automatic inventory rollback is executed when an order is cancelled.
5. **Unified Role Guards**:
   - Unified authentication checks across all controllers (`admin.routes.ts`, `auth.routes.ts`, `vendor.routes.ts`, `order.routes.ts`, `product.routes.ts`) through `lib/auth.guards.ts`.
6. **Automated Unit Testing Baseline**:
   - Created comprehensive unit tests in Vitest covering CORS policies, Paystack webhook HMAC verification, and Money value object invariants with **100% pass rate** (31 tests passed).

7. **Phase 8: Automated Returns, Disputes & Paystack Refunds**:
   - Added `ReturnRequest` and `Refund` data models and generated standalone migration `20261014000000_phase8_returns_refunds`.
   - Built complete clean-architecture module in `src/modules/returns/` (`ReturnRepository`, `ReturnService`, `return.routes.ts`) providing customer filing within the 48-hour escrow window, merchant reviews, dispute escalation, and automated Paystack refund settlement.
   - Enforced proportional mathematical conservation on vendor order balance and platform commission deductions.

8. **Phase 9: Dynamic Delivery Zones, Geo-Pricing & Real-Time Courier Webhooks**:
   - Implemented GhanaPost GPS digital address normalization and zone matching across Ghana regions.
   - Dynamic weight-band geo-pricing engine (`POST /api/v1/logistics/quote`).
   - Courier dispatch and webhook ingestion pipeline (`POST /api/v1/logistics/webhooks/courier`) for third-party couriers (Fez, Kwik, DHL) with automated customer SMS and email notifications.

9. **Phase 10: Automated MoMo Payout Batches & Double-Entry Ledger Reconciliation**:
   - Automated bulk Mobile Money transfers via Paystack Transfers API for cleared escrow balances (`status = DELIVERED`, `clearedAt <= now`, `payoutId = null`).
   - Double-entry accounting balance sheet (`GET /api/v1/admin/reconciliation/ledger`) verifying inflows against merchant liabilities, platform commission equity, and customer refunds with zero penny variance.
   - Vendor analytics engine (`AOV`, repeat customer rate, return rate, fulfillment speed) and Super-Admin benchmark leaderboard.

10. **Phase 11: Enterprise Multi-Warehouse Inventory & Stock Transfers**:
    - Relational multi-location warehousing (`Warehouse`, `WarehouseStock`) supporting regional fulfillment hubs with bin locations.
    - Atomic cross-hub transfers (`POST /api/v1/inventory/stock/transfer`) enforcing strict unit conservation (`Total Before === Total After`) with immutable `StockMovement` audit logs.
    - Configurable per-SKU low-stock thresholds with multi-channel SMS & transactional email alerts to merchants.

11. **Phase 12: Resilient Asynchronous Email Dispatch & E2E Integration Suite**:
    - BullMQ Redis-backed worker queue with in-memory concurrency-capped fallback (5 concurrent workers, exponential backoff) preventing HTTP thread blocking.
    - Full 14-flow transactional email suite (OTP, password reset, order confirmation, vendor alert, courier milestones, delivery notice, returns, refunds, payouts).
    - Standalone email diagnostics CLI: `npm run email:check [recipient]`.

12. **Production System Audit & Financial Invariants**:
    - **COD Abandonment Exemption**: Checkouts with `paymentMethod === 'COD'` are exempted from the 30-minute unpaid abandonment reaper (`reclaimAbandonedOrders`).
    - **Automatic COD Settlement on Delivery**: Transitioning COD orders to `DELIVERED` atomically transitions `paymentStatus` to `'PAID'` and starts the 48-hour escrow countdown.
    - **Multi-Warehouse Two-Way Stock Restoration**: Order cancellations and returns restore physical units to both `WarehouseStock` and `Product.stockQty` atomically, logging immutable `StockMovement` events.
    - **Strict Payout Protection**: Gated vendor payouts on `order.paymentStatus === 'PAID'` to ensure unpaid orders never release merchant funds.
    - **Dual-Inflow Reconciliation Equation**: Inflows calculate both Paystack gateway receipts and Cash on Delivery collections ($\text{Total Inflow} = \text{Gateway} + \text{COD Collections}$), maintaining zero-variance balance sheets.
    - **COD Return Settlement**: Direct Mobile Money refunds for COD orders record simulated transactions (`COD-${orderNumber}-${timestamp}`), preventing invalid external gateway calls.
    - **Live Diagnostics Suite**: `npm run verify:services` executes live end-to-end checks across DB, Redis, Paystack, Cloudinary, and financial invariants.

---

## 12. Verification & Operational Health

The entire platform is fully verified and compiling cleanly:
- **`next-backend`**: `npx tsc --noEmit` exits with **0 errors**; Vitest test runner passes **15/15 test suites and 92/92 tests** (100% pass rate).
- **`next-frontend`**: `npm run build` exits with **0 errors** across all **41 App Router static and dynamic routes**.
- **Documentation**: All architecture documents (`README.md`, `PROJECT_OVERVIEW.md`, `PROJECT_PHASES_AND_ROADMAP.md`, `BACKEND_ARCHITECTURE.md`, `FRONTEND_CACHING_ARCHITECTURE.md`, `MULTI_VENDOR_OOD_ARCHITECTURE.md`, `codebase_analysis.md`) are synchronized with the live code.

