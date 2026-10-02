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

---

## 3. High-Level Monorepo Structure

```
NextDor/
├── next-frontend/                      # Next.js 16 App Router Client
│   ├── app/                            # 37 active routes
│   │   ├── (storefront)/               # Customer shopping routes (/, /shop, /product/[slug], /cart, /checkout)
│   │   ├── (auth)/                     # /login, /register, /verify-email, /forgot-password, /reset-password
│   │   ├── account/                    # Customer portal (/account, /account/orders, /account/addresses)
│   │   ├── vendor/                     # Merchant portal (/vendor/dashboard, /vendor/register)
│   │   ├── admin/                      # Super admin & staff console (/admin, /admin/customers, /admin/analytics)
│   │   └── api/upload/                 # Cloudinary image upload serverless route handler
│   ├── components/                     # Reusable UI component library
│   │   ├── layout/                     # StoreHeader, CategoryNav, MobileNav, Footer
│   │   ├── home/                       # HeroCarousel, CategoryTiles, ProductRow, TrendingSection
│   │   ├── product/                    # ProductCard, ProductGrid, PriceDisplay, AddToCartButton
│   │   ├── admin/                      # AdminNavbar, StatusBadge, DataTables
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
│   │   ├── lib/                        # EmailService (Resend + console fallback), Prisma, Logger
│   │   └── modules/                    # Feature vertical slices (Clean Architecture)
│   │       ├── auth/                   # Register, login, OTP verify, password recovery, refresh rotation
│   │       ├── users/                  # Customer profile and address repository & service
│   │       ├── products/               # Catalog, categories, OCC locking, soft delete
│   │       ├── orders/                 # Checkout, multi-vendor sub-orders, polymorphic findByNumber
│   │       ├── vendors/                # Merchant onboarding, tenant-isolated inventory & payouts
│   │       ├── admin/                  # Admin customer directory, analytics overview, governance
│   │       ├── audit/                  # Platform audit logging (immutable events)
│   │       └── sync/                   # Asynchronous WooCommerce migration sync worker
│   ├── prisma/                         # schema.prisma, migrations, seeds
│   └── package.json
│
├── packages/shared/                    # Monorepo shared schemas and types
│   ├── src/schemas/                    # Zod validation schemas (auth, product, order, vendor)
│   └── src/index.ts
└── documentation/                      # Architectural specifications
```

---

## 4. Frontend Application Portals

The frontend provides four distinct user experiences governed by RBAC and clean navigation:

### 🛍️ Storefront Portal (Public & Customer)
- **`/`**: Dynamic homepage featuring Hero carousel, top categories, Deal of the Day, Flash Sales, and trending products.
- **`/shop`**: Full catalog with multi-facet filters (categories, price range, vendors, sorting by newest/price/popularity), server search, and pagination.
- **`/product/[slug]`**: Rich product detail page with high-resolution image galleries, stock status, seller comparison ("Other Sellers"), and Add to Cart.
- **`/category/[slug]`**: Category-filtered catalog with breadcrumb trails.
- **`/cart`**: Interactive shopping cart with quantity adjustment, price calculation, and subtotal updates.
- **`/checkout`**: Multi-step checkout with delivery address selection, Ghana delivery options (Standard, Express, Pickup), and Paystack payment initiation.
- **`/track-order`**: Public order status lookup accepting order numbers (e.g. `ND-00001`) or tracking UUIDs.
- **`/login` & `/register`**: Seamless customer sign-in with auto-redirect back to checkout or original location.
- **`/verify-email`**: Mobile-optimized 6-digit OTP entry screen with large numeric keypad spacing, resend cooldown timer, and auto-session start.
- **`/forgot-password` & `/reset-password`**: Secure password recovery flow with time-limited OTP code verification and password strength enforcement.

### 👤 Customer Account Portal (`/account`)
- **`/account`**: Central customer overview with recent orders, default shipping address, and quick shortcuts.
- **`/account/orders` & `/account/orders/[id]`**: Complete order history, line item breakdown, tracking status timeline, and cancel order capability.
- **`/account/addresses`**: Multi-address management (Home, Work, Other) with default address toggling.
- **`/account/wishlist`**: Saved items for future purchase.
- **`/account/settings`**: Profile information and security management.

### 🏪 Merchant Portal (`/vendor`)
- **`/vendor/register`**: Public merchant onboarding with business registration, owner details, and Mobile Money payout configuration (MTN MoMo, Telecel Cash, AT Money).
- **`/vendor/dashboard`**: 4-tab reactive console:
  1. *Inventory & Stock*: Real-time product table, inline price/stock editor with OCC concurrency protection, Cloudinary image uploader, and product publishing modal.
  2. *Store Orders & Dispatch*: Partitioned sub-orders (`VendorOrder`), buyer address snapshots, line items, and 1-click dispatch progression (`PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`).
  3. *MoMo Payouts & Escrow*: Lifetime earnings, funds in 48-hour customer verification escrow, available balances, and automated transfer ledger.
  4. *Store Profile & Settings*: Brand identity, store bio, logo, banner, and settlement phone numbers.

### 🛡️ Admin Management Console (`/admin`)
- **`/admin`**: Executive dashboard with platform KPIs, gross revenue, vendor count, order volume, live PostgreSQL database metrics (`totalCustomers`, `totalProducts`, `totalOrders`), and recent audit activity.
- **Admin Notifications Center**: Interactive header bell popover (`AdminNotificationsPopover.tsx`) with real-time unread badge, one-click "Mark read" (zeroes unread count), one-click "Clear all" (switches to empty state), and individual item dismissal with persistent storage.
- **Admin Navigation**: Zero-scrollbar non-scrollable desktop sidebar (`AdminSidebar.tsx`) with large NextDor logo and full-text action buttons, paired with a touch-friendly auto-dismissing mobile drawer with close (`X`) control.
- **`/admin/orders`**: Global order management across all marketplace transactions, search by customer or order number, and manual status override with audit logging.
- **`/admin/products`**: Global catalog directory, pricing audits, admin product creation (`POST /api/v1/products` via `AdminProductCreateForm`), and soft-delete controls.
- **`/admin/customers` & `/admin/customers/[id]`**: Customer directory with order counts, lifetime spend aggregates, and full customer detail history.
- **`/admin/analytics`**: 30-day revenue trends, daily order distribution, top-selling categories, and vendor performance breakdowns.
- **`/admin/merchants`**: Merchant application queue, KYC review, commission rate adjustment, and one-click approval/suspension.
- **`/admin/admins`**: Administrative staff directory and role assignment.
- **`/admin/settings`**: Platform operational parameters, escrow durations, and maintenance modes.

### 📱 Mobile-First Navigation & Usability
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
| **Tenant Isolation** | All vendor operations enforce database isolation: queries are hard-filtered by `vendorId = req.authUser.vendorId`. Merchants cannot view, modify, or delete another merchant's data. |
| **Optimistic Concurrency**| Product updates include `version: product.version`. If another process updated the product concurrently, the database returns 0 rows updated, throwing `ConflictError` instead of overwriting data. |
| **Audit Logging** | High-privilege administrative and merchant actions (merchant approval, commission changes, order status overrides) create immutable `AuditLog` records containing user ID, IP address, timestamp, and payload snapshots. |
| **Payment Integrity** | Paystack webhooks are validated using HMAC-SHA512 with timing-safe comparison (`crypto.timingSafeEqual`) on the raw request body before processing. |

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

## 11. Verification & Operational Health

The entire platform is fully verified and compiling cleanly:
- **`next-backend`**: `npm run build` and `npx tsc --noEmit` pass with **0 errors**.
- **`next-frontend`**: `npm run build` generates all **34 routes** (SSG + SSR + Turbopack) with **0 errors**.
- **Documentation**: All architecture documents (`README.md`, `PROJECT_OVERVIEW.md`, `BACKEND_ARCHITECTURE.md`, `FRONTEND_CACHING_ARCHITECTURE.md`, `MULTI_VENDOR_OOD_ARCHITECTURE.md`, `codebase_analysis.md`) are synchronized with the live code.
