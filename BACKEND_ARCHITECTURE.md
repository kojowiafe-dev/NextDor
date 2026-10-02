# NextDor Backend — Production Architecture

> Living document. Updated as each phase is built.
> Last updated: 2026-08-31

---

## 1. Stack Decision

### Candidates evaluated

| Criterion | **Node.js + Fastify** | FastAPI (Python) |
|---|---|---|
| Language alignment with frontend | ✅ TypeScript end-to-end | ❌ Python — separate type systems |
| Shared types (`packages/shared`) | ✅ Zod schemas shared directly | ❌ Requires code-gen bridge |
| Raw performance | ✅ Fastify ~76k req/s | ✅ Comparable (~70k req/s) |
| Async I/O model | ✅ Node event loop, perfect for I/O-bound e-commerce | ✅ asyncio |
| Payment SDK ecosystem (Paystack) | ✅ First-class Node SDK | ⚠️ Community wrapper only |
| ORM quality | ✅ Prisma — type-safe, excellent migrations | ✅ SQLAlchemy + Alembic |
| Job queue | ✅ BullMQ (Redis-native, battle-tested) | ⚠️ Celery (heavier) |
| Deployment footprint | ✅ Small single process | ⚠️ Requires Python runtime |
| Team skill transferability | ✅ Same language as frontend devs | ❌ Context switch |

### ✅ Decision: **Node.js 20 LTS + Fastify v5**

Reasons:
1. **Type safety end-to-end** — Zod schemas live in `packages/shared`, consumed by both Next.js and Fastify with zero duplication.
2. **Paystack** (Ghana's dominant payment gateway — MoMo, Visa, Mastercard) has an official Node SDK.
3. **Fastify** is consistently faster than Express and has built-in schema validation, OpenAPI generation, and a plugin ecosystem purpose-built for production APIs.
4. **Prisma** gives us type-safe database access, migrations as code, and a clean query API.
5. **BullMQ** handles async jobs (order emails, SMS, webhook retries) on top of the same Redis instance used for caching.

---

## 2. Full System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Browser (Next.js App Router)"]
        Mobile["Mobile App (future)"]
    end

    subgraph CDN["Edge / CDN"]
        Vercel["Vercel Edge (Next.js SSR + ISR)"]
        Cloudinary["Cloudinary (Images / Assets)"]
    end

    subgraph API["API Layer"]
        Fastify["Fastify API Server :4000"]
        RateLimit["Rate Limiter (Redis sliding window)"]
    end

    subgraph Data["Data Layer"]
        Postgres["PostgreSQL 16 (Primary store)"]
        Redis["Redis 7 (Cache + Sessions + Queues)"]
        WooCommerce["WooCommerce (Product catalog source)"]
    end

    subgraph Jobs["Background Jobs"]
        BullMQ["BullMQ Workers"]
        EmailQ["Email Queue (Resend)"]
        SMSQ["SMS Queue (Arkesel)"]
        WebhookQ["Webhook Retry Queue"]
        SyncQ["WooCommerce Sync Queue"]
    end

    subgraph External["External Services"]
        Paystack["Paystack (Card + MoMo)"]
        ResendSvc["Resend (Transactional Email)"]
        Arkesel["Arkesel (Ghana SMS)"]
    end

    Browser --> Vercel
    Vercel --> Fastify
    Mobile --> Fastify
    Fastify --> RateLimit
    Fastify --> Postgres
    Fastify --> Redis
    Fastify --> BullMQ
    Fastify --> Paystack
    BullMQ --> EmailQ --> ResendSvc
    BullMQ --> SMSQ --> Arkesel
    BullMQ --> WebhookQ --> Paystack
    BullMQ --> SyncQ --> WooCommerce
    Cloudinary --> Browser
```

---

## 3. Repository Layout

```
NextDor/
├── next-frontend/          # Next.js 15 App Router
├── next-backend/           # Fastify API
│   ├── src/
│   │   ├── app.ts          # Fastify instance + plugin registration
│   │   ├── server.ts       # Entry point (listen)
│   │   ├── config/         # Environment config (zod-validated)
│   │   ├── modules/        # Feature modules (vertical slices)
│   │   │   ├── auth/       # JWT tokens, refresh family rotation, RBAC
│   │   │   ├── audit/      # Tamper-proof platform audit trail
│   │   │   ├── users/      # Profile & addresses
│   │   │   ├── products/   # Catalog, categories, OCC locking
│   │   │   ├── vendors/    # Merchant onboarding, sub-orders, 48h escrow, payouts
│   │   │   ├── orders/     # Checkout, master orders
│   │   │   ├── payments/   # Paystack gateway & webhooks
│   │   │   ├── reviews/    # Product ratings & moderation
│   │   │   ├── sync/       # Asynchronous WooCommerce worker
│   │   │   └── admin/      # Platform governance & merchant approvals
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   ├── queue.ts
│   │   │   ├── logger.ts
│   │   │   └── errors.ts
│   │   ├── plugins/
│   │   │   ├── auth.ts
│   │   │   ├── cors.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── swagger.ts
│   │   └── workers/
│   │       ├── email.worker.ts
│   │       ├── sms.worker.ts
│   │       ├── payment.worker.ts
│   │       └── sync.worker.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/
│   └── package.json
└── packages/
    └── shared/             # Zod schemas + TS types shared by both apps
        ├── src/
        │   ├── schemas/
        │   │   ├── auth.ts
        │   │   ├── order.ts
        │   │   ├── product.ts
        │   │   └── user.ts
        │   └── index.ts
        └── package.json
```

---

## 4. Database Schema (PostgreSQL + Prisma)

### Design principles
- **UUID v4** primary keys via `gen_random_uuid()` (no enumeration attacks)
- **Soft deletes** on User, Product, Order (`deletedAt`)
- **Audit columns** (`createdAt`, `updatedAt`) on every table
- **Immutable financial records** — OrderItem and Payment rows are never UPDATEd
- **Indexes** on all FKs, filter columns, and full-text search columns
- **Price as Decimal(12,2)** — never Float (floating-point money bugs)

### Entity relationship

```mermaid
erDiagram
    User ||--o{ Address : has
    User ||--o{ Order : places
    User ||--o{ Review : writes
    User ||--o{ RefreshToken : holds
    Order ||--|{ OrderItem : contains
    Order ||--o{ Payment : has
    Order ||--o{ OrderStatusHistory : tracks
    Product ||--o{ OrderItem : "appears in"
    Product ||--o{ Review : receives
    Product }o--o{ Category : "belongs to"
    Product ||--o{ ProductImage : has
    Payment ||--o{ PaymentAttempt : logs
    Coupon ||--o{ Order : "applied to"
```

### Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users & Auth ──────────────────────────────────────────────────

model User {
  id            String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email         String     @unique
  emailVerified Boolean    @default(false)
  passwordHash  String
  name          String
  phone         String?
  role          UserRole   @default(CUSTOMER)
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?

  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  refreshTokens RefreshToken[]

  @@index([email])
  @@index([deletedAt])
}

enum UserRole   { CUSTOMER ADMIN }
enum UserStatus { ACTIVE SUSPENDED }

model RefreshToken {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String    @db.Uuid
  tokenHash String    @unique   // bcrypt hash of the opaque token
  family    String              // token family for rotation detection
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([family])
}

model Address {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @db.Uuid
  label     String   @default("Home")
  street    String
  city      String
  region    String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders    Order[]

  @@index([userId])
}

// ─── Catalog ───────────────────────────────────────────────────────

model Category {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  wcId        Int?       @unique
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?    @db.Uuid
  sortOrder   Int        @default(0)

  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  products    Product[]  @relation("ProductCategories")

  @@index([slug])
  @@index([parentId])
}

model Product {
  id            String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  wcId          Int?          @unique
  slug          String        @unique
  name          String
  description   String
  shortDesc     String?
  price         Decimal       @db.Decimal(12, 2)
  salePrice     Decimal?      @db.Decimal(12, 2)
  currency      String        @default("GHS")
  stockStatus   StockStatus   @default(IN_STOCK)
  stockQty      Int?
  averageRating Decimal       @default(0) @db.Decimal(3, 2)
  reviewCount   Int           @default(0)
  sortOrder     Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  categories    Category[]    @relation("ProductCategories")
  images        ProductImage[]
  orderItems    OrderItem[]
  reviews       Review[]

  @@index([slug])
  @@index([deletedAt])
  @@index([stockStatus])
}

enum StockStatus { IN_STOCK OUT_OF_STOCK LOW_STOCK }

model ProductImage {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId String  @db.Uuid
  url       String
  alt       String  @default("")
  sortOrder Int     @default(0)

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
}

// ─── Orders ────────────────────────────────────────────────────────

model Order {
  id              String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  number          String               @unique        // ND-XXXXX
  userId          String?              @db.Uuid
  guestEmail      String?
  addressId       String?              @db.Uuid
  shippingAddress Json                 // Immutable snapshot at checkout
  subtotal        Decimal              @db.Decimal(12, 2)
  deliveryFee     Decimal              @db.Decimal(12, 2)
  discount        Decimal              @default(0) @db.Decimal(12, 2)
  total           Decimal              @db.Decimal(12, 2)
  currency        String               @default("GHS")
  status          OrderStatus          @default(PENDING)
  paymentStatus   PaymentStatus        @default(UNPAID)
  deliveryMethod  DeliveryMethod       @default(STANDARD)
  couponId        String?              @db.Uuid
  notes           String?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  user            User?                @relation(fields: [userId], references: [id])
  address         Address?             @relation(fields: [addressId], references: [id])
  items           OrderItem[]
  payments        Payment[]
  statusHistory   OrderStatusHistory[]
  coupon          Coupon?              @relation(fields: [couponId], references: [id])

  @@index([userId])
  @@index([number])
  @@index([status])
  @@index([createdAt])
}

enum OrderStatus    { PENDING CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED REFUNDED }
enum PaymentStatus  { UNPAID PARTIAL PAID REFUNDED }
enum DeliveryMethod { STANDARD EXPRESS PICKUP }

// Polymorphic lookup note: OrderRepository.findByNumber accepts both human-readable
// order numbers (e.g. "ND-00001") and internal UUIDs, ensuring smooth routing
// across customer tracking URLs, payment webhook callbacks, and admin tools.

model OrderStatusHistory {
  id        String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId   String      @db.Uuid
  status    OrderStatus
  note      String?
  createdBy String?     @db.Uuid
  createdAt DateTime    @default(now())

  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}

model OrderItem {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId      String   @db.Uuid
  productId    String   @db.Uuid
  productName  String               // Snapshot — immutable
  productImage String?              // Snapshot — immutable
  unitPrice    Decimal  @db.Decimal(12, 2)
  quantity     Int
  subtotal     Decimal  @db.Decimal(12, 2)

  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product      Product  @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}

// ─── Payments ──────────────────────────────────────────────────────

model Payment {
  id           String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId      String          @db.Uuid
  paystackRef  String          @unique
  method       PaymentMethod
  amount       Decimal         @db.Decimal(12, 2)
  currency     String          @default("GHS")
  status       PaymentTxStatus @default(PENDING)
  metadata     Json?
  paidAt       DateTime?
  createdAt    DateTime        @default(now())

  order        Order           @relation(fields: [orderId], references: [id])
  attempts     PaymentAttempt[]

  @@index([orderId])
  @@index([paystackRef])
}

enum PaymentMethod   { MOMO CARD BANK_TRANSFER }
enum PaymentTxStatus { PENDING SUCCESS FAILED REFUNDED }

model PaymentAttempt {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  paymentId   String   @db.Uuid
  status      String
  gatewayResp Json
  createdAt   DateTime @default(now())

  payment     Payment  @relation(fields: [paymentId], references: [id])

  @@index([paymentId])
}

// ─── Reviews ───────────────────────────────────────────────────────

model Review {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId String   @db.Uuid
  userId    String?  @db.Uuid
  guestName String?
  rating    Int      // 1–5, check constraint added in migration
  title     String
  body      String
  verified  Boolean  @default(false)  // purchased the product
  approved  Boolean  @default(false)  // admin moderation gate
  helpful   Int      @default(0)
  createdAt DateTime @default(now())

  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  user      User?    @relation(fields: [userId], references: [id])

  @@index([productId, approved])
  @@index([userId])
}

// ─── Coupons ───────────────────────────────────────────────────────

model Coupon {
  id          String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code        String       @unique
  type        DiscountType
  value       Decimal      @db.Decimal(10, 2)
  minOrderAmt Decimal?     @db.Decimal(12, 2)
  maxUses     Int?
  usedCount   Int          @default(0)
  expiresAt   DateTime?
  active      Boolean      @default(true)
  createdAt   DateTime     @default(now())

  orders      Order[]

  @@index([code])
}

enum DiscountType { FIXED PERCENTAGE }

// ─── Multi-Vendor Marketplace & Settlements ────────────────────────

model Vendor {
  id                    String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                  String
  slug                  String        @unique
  description           String?
  logoUrl               String?
  bannerUrl             String?
  phone                 String?
  email                 String?
  status                VendorStatus  @default(PENDING_APPROVAL)
  commissionRate        Decimal       @default(10.00) @db.Decimal(5, 2)
  payoutMethod          PayoutMethod  @default(MOMO)
  momoNumber            String?
  momoNetwork           String?       // "MTN" | "TELECEL" | "AT"
  ownerId               String        @unique @db.Uuid
  owner                 User          @relation(fields: [ownerId], references: [id])
  products              Product[]
  vendorOrders          VendorOrder[]
  payouts               VendorPayout[]
}

enum VendorStatus { PENDING_APPROVAL ACTIVE SUSPENDED }
enum PayoutMethod { MOMO BANK }

model VendorOrder {
  id               String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId          String            @db.Uuid
  vendorId         String            @db.Uuid
  subtotal         Decimal           @db.Decimal(12, 2)
  commissionAmount Decimal           @db.Decimal(12, 2)
  vendorEarnings   Decimal           @db.Decimal(12, 2)
  status           VendorOrderStatus @default(PENDING)
  notes            String?
  clearedAt        DateTime?         // 48h escrow clearance timestamp
  payoutId         String?           @db.Uuid
  order            Order             @relation(fields: [orderId], references: [id], onDelete: Cascade)
  vendor           Vendor            @relation(fields: [vendorId], references: [id])
  payout           VendorPayout?     @relation(fields: [payoutId], references: [id])

  @@index([orderId])
  @@index([vendorId])
  @@index([status])
}

enum VendorOrderStatus { PENDING PROCESSING SHIPPED DELIVERED CANCELLED }

model VendorPayout {
  id                  String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendorId            String        @db.Uuid
  amount              Decimal       @db.Decimal(12, 2)
  currency            String        @default("GHS")
  status              PayoutStatus  @default(PENDING)
  paystackTransferRef String?       @unique
  paidAt              DateTime?
  vendor              Vendor        @relation(fields: [vendorId], references: [id])
  vendorOrders        VendorOrder[]

  @@index([vendorId])
}

enum PayoutStatus { PENDING PROCESSING PAID FAILED }

// ─── Platform Governance & Tamper-Proof Audit Trail ────────────────

model AuditLog {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String?  @db.Uuid
  userEmail String?
  action    String   // "VENDOR_REGISTERED", "MERCHANT_APPROVED", "ORDER_DISPATCH_UPDATED", "VENDOR_PROFILE_UPDATED"
  entity    String   // "Vendor", "VendorOrder", "User"
  entityId  String?
  details   Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([action])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

---

## 5. Caching Strategy (Redis)

### Cache layers

| Layer | Key pattern | TTL | Invalidated by |
|---|---|---|---|
| Product page | `product:{slug}` | 5 min | WC sync job or admin edit |
| Product list | `products:list:{hash}` | 3 min | New product, edit, delete |
| Category tree | `categories:tree` | 15 min | Admin edit |
| Homepage featured | `home:featured` | 10 min | Manual flush |
| User session | `session:{userId}` | 1 hour | Logout |
| Rate limit counter | `rl:{ip}:{route}` | 1 min sliding | Auto-expire |
| Server-side cart | `cart:{sessionId}` | 7 days | Checkout / clear |
| WC sync lock | `lock:wc-sync` | 30 sec | Released after sync |

### Redis data structures used

| Use case | Redis type | Rationale |
|---|---|---|
| Product / category cache | String (JSON) | Simple O(1) get/set |
| Cart contents | Hash | Per-item updates without full re-serialisation |
| Rate limiting | Sorted Set (sliding log) | O(log N) window check, no memory leak |
| Popular products (leaderboard) | Sorted Set (score = view count) | O(log N) ZRANGEBYSCORE |
| User session | Hash | Structured, partial updates with HSET |
| Pub/Sub cache invalidation | Pub/Sub channel | Broadcast to all API instances |
| BullMQ job queues | List + Sorted Set | Managed internally by BullMQ |

### Cache-aside read flow

```
Request → Redis GET →
  HIT  → return JSON  (< 1ms)
  MISS → Postgres query → Redis SET with TTL → return
```

### Write-through invalidation (admin mutations)

```
PATCH /admin/products/:id
  → UPDATE Postgres
  → DEL Redis product:{slug}
  → DEL Redis products:list:*  (scan + delete)
  → return updated product
```

---

## 6. Authentication & Security

### Auth flow

```
Register
  → validate with Zod
  → check email unique
  → bcrypt(password, rounds=12)
  → INSERT User
  → enqueue email verification job
  → return 201

Login
  → find User by email
  → bcrypt.compare(password, hash)
  → generate accessToken  (JWT, 15 min, HS256)
  → generate refreshToken (crypto.randomBytes(64).toString('hex'))
  → hash refresh token with bcrypt
  → INSERT RefreshToken { tokenHash, family: uuid(), expiresAt: +30d }
  → set httpOnly cookie: refresh_token=<raw_token>; SameSite=Strict; Secure
  → return { accessToken, user }

Refresh
  → read refresh_token cookie
  → find RefreshToken where tokenHash = bcrypt.compare(...)
  → if not found → 401
  → if revokedAt set → revoke entire family → 401 (reuse attack detected)
  → if expired → 401
  → REVOKE old token, ISSUE new token pair (rotation)
  → return { accessToken }
```

### Token family rotation (theft detection)

```
Family F1: token_A [active]
  ↓ legitimate refresh
Family F1: token_A [revoked], token_B [active]
  ↓ attacker replays token_A
Family F1: ALL REVOKED → user must re-login
```

### Security controls

| Control | Implementation |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| JWT secret | 64-byte CSPRNG, stored in env, never in code |
| Refresh tokens | Opaque + hashed in DB; httpOnly, SameSite=Strict, Secure cookie |
| Rate limiting | Redis sliding window — 10 req/15min on auth, 1000 req/15min general |
| Input validation | Zod schema on every route input (body, params, query) |
| SQL injection | Prisma parameterised queries — zero raw string interpolation |
| XSS | API returns JSON only; no server-rendered HTML |
| CORS | Allowlist: `nextdor.online`, `localhost:3000` |
| Security headers | `@fastify/helmet`: CSP, HSTS, X-Frame-Options, Referrer-Policy |
| CSRF | SameSite cookie + `X-Requested-With` header double-submit |
| Secrets management | Zod-validated env at startup — app refuses to start if missing |
| Webhook integrity | Paystack HMAC-SHA512 signature on raw body before processing |
| Admin guard | `role === ADMIN` check in Fastify `preHandler` hook |
| Audit trail | Every order/payment state change in `OrderStatusHistory` |
| PII in logs | User IDs only — never log email, phone, or card data |

---

## 7. Payment Integration (Paystack)

Paystack is Ghana's production-grade payment gateway:
- ✅ **MTN MoMo, Vodafone Cash, AirtelTigo Money**
- ✅ **Visa / Mastercard** (local + international)
- ✅ **GHS natively** (no currency conversion needed)
- ✅ Official Node.js SDK
- ✅ Webhook support with HMAC signature verification

### Payment flow

```
1. POST /api/v1/orders
   → create Order (status: PENDING, paymentStatus: UNPAID)
   → create Payment row (status: PENDING)
   → call Paystack: transactions.initialize({
       reference, amount_in_kobo, email, currency: "GHS",
       metadata: { orderId, items }
     })
   → return { authorizationUrl, reference } to client

2. Client redirects to Paystack hosted page

3. User completes payment

4. Paystack calls POST /api/v1/webhooks/paystack
   → verify HMAC-SHA512 signature
   → enqueue payment.webhook job in BullMQ

5. Worker processes job:
   → call Paystack: transactions.verify(reference)
   → if status === "success":
       UPDATE Payment { status: SUCCESS, paidAt }
       UPDATE Order   { paymentStatus: PAID, status: CONFIRMED }
       INSERT OrderStatusHistory { status: CONFIRMED }
       enqueue email.job + sms.job
   → if status === "failed":
       UPDATE Payment { status: FAILED }
       UPDATE Order   { status: CANCELLED }
```

### Webhook HMAC verification

```typescript
import crypto from "node:crypto";

function verifyPaystackWebhook(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
}
```

---

## 8. Job Queues (BullMQ)

### Queue definitions

| Queue | Triggered by | Action |
|---|---|---|
| `email` | Order confirmed / shipped / cancelled | Resend transactional email |
| `sms` | Order confirmed, OTP, delivery update | Arkesel SMS (Ghana) |
| `payment-webhook` | Paystack POST webhook | Verify + update order/payment |
| `wc-sync` | Cron every 5 minutes | Fetch WC products → upsert Postgres → flush Redis |
| `review-approved` | Admin approves a review | Recalculate product `averageRating` + `reviewCount` |

### Retry strategy

```
Attempt 1: immediate
Attempt 2: +30 seconds
Attempt 3: +5 minutes
Attempt 4: +30 minutes
Attempt 5: +2 hours
→ Dead Letter Queue → admin alert via email
```

---

## 9. API Design Standards

### Base URL
```
https://api.nextdor.online/v1
```

### Response envelope

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 240, "totalPages": 20 }
}

// Error
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "details": []
  }
}
```

### Route map

```
Auth
  POST   /auth/register
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout
  POST   /auth/forgot-password
  POST   /auth/reset-password

Users (authenticated)
  GET    /users/me
  PATCH  /users/me
  GET    /users/me/addresses
  POST   /users/me/addresses
  PATCH  /users/me/addresses/:id
  DELETE /users/me/addresses/:id

Products (Catalog)
  GET    /products                     ?page&limit&sort&category&vendor&search
  GET    /products/categories          (Category list with product counts)
  GET    /products/trending            ?limit=10 (Sales velocity & customer rating signals)
  GET    /products/sellers             ?name=...&excludeSlug=... (Multi-merchant lookup)
  GET    /products/grouped-by-merchant ?limitMerchants=6&productsPerMerchant=4
  GET    /products/:slug               (Single product detail by slug)
  GET    /products/:slug/reviews       (Product reviews)
  POST   /products                     (Create new product - Admin or Super Admin)
  PATCH  /products/:id                 (Update product details - Admin or Vendor)
  DELETE /products/:id                 (Soft-delete product - Admin)

Orders
  POST   /orders                       (Place order / checkout - Authenticated user required)
  GET    /orders                       (List my orders - paginated)
  GET    /orders/:number               (Order detail & tracking: supports polymorphic lookup by order number ND-XXXXX or UUID)
  POST   /orders/:number/cancel        (Cancel customer order)

Vendors (Merchant Portal & Onboarding)
  POST   /vendors/register             (Public merchant registration)
  GET    /vendors/portal/me            (Authenticated merchant profile & MoMo details)
  PATCH  /vendors/portal/me            (Update merchant settings & payout info)
  GET    /vendors/portal/products      (Merchant's isolated product inventory)
  POST   /vendors/portal/products      (Publish new product under merchant vendorId)
  PATCH  /vendors/portal/products/:id  (Update vendor product with OCC version lock)
  DELETE /vendors/portal/products/:id  (Tenant-isolated soft delete)
  GET    /vendors/portal/orders        (Partitioned merchant sub-orders queue)
  PATCH  /vendors/portal/orders/:id/status (Dispatch status progression: PROCESSING -> SHIPPED -> DELIVERED)
  GET    /vendors/portal/payouts       (Escrow balances & automated MoMo disbursement ledger)

Admin (role: ADMIN or SUPER_ADMIN)
  GET    /admin/orders                 ?status&page&limit (Global orders list)
  GET    /admin/orders/:number         (Global order detail by number or UUID)
  PATCH  /admin/orders/:id/status      (Force-update status with audit log note)
  GET    /admin/customers              ?page&limit&search (Customer list with spend/orders)
  GET    /admin/customers/:id          (Customer profile, addresses & order history)
  GET    /admin/analytics/overview     (Platform metrics with live DB counts: totalCustomers, totalProducts, totalOrders, and 30-day trends)
  GET    /admin/analytics/summary      (Quick dashboard KPI summary)
  GET    /vendors/admin/alerts         (Pending merchant KYC verification alerts for notifications popover)
  GET    /auth/audit-logs              (Platform governance & security audit logs for notifications popover)
  GET    /admin/merchants              (Merchant approval queue & verification)
  PATCH  /admin/merchants/:id/status   (Approve, suspend, or adjust commission rate)
  GET    /admin/reviews                ?approved=false (Review moderation queue)
  PATCH  /admin/reviews/:id/approve    (Approve review)
  DELETE /admin/reviews/:id            (Reject/delete review)

Reviews (authenticated)
  POST   /products/:slug/reviews

Cart (session-based, Redis)
  GET    /cart
  POST   /cart/items
  PATCH  /cart/items/:productId
  DELETE /cart/items/:productId
  DELETE /cart

Payments & Escrow
  POST   /payments/initiate            (Paystack initialization for MoMo/Card)
  GET    /payments/:reference/status   (Verify transaction)

Webhooks (no auth — Paystack HMAC-SHA512 verified)
  POST   /webhooks/paystack
```

---

## 10. Observability

| Concern | Tool |
|---|---|
| Structured logging | Pino (JSON, log levels, requestId trace) |
| Request tracing | `fastify-request-context` |
| Error tracking | Sentry Node SDK |
| Health check | `GET /health` → DB ping + Redis ping |
| API documentation | Swagger UI auto-generated from Fastify schemas |

---

## 11. Deployment Topology

```
Production
  Vercel              → Next.js frontend (SSR + ISR + Edge)
  Railway / Render    → Fastify API (2 instances, auto-scale)
  Neon / Supabase     → PostgreSQL (managed, daily backups, PITR)
  Upstash             → Redis (serverless, persistent)
  Railway             → BullMQ workers (separate process)
  Cloudinary          → Product images + assets

Development
  Docker Compose      → Postgres + Redis + API + Workers, all local
```

---

## 12. Build Phases & Current Implementation Status

### Phase 1 — Foundation ✅ (Completed)
- [x] Architecture & ERD documented
- [x] `next-backend` scaffold (Fastify v5 + TypeScript + Prisma)
- [x] `packages/shared` Zod schemas
- [x] Docker Compose (Postgres + Redis local) & Neon Serverless Cloud Postgres
- [x] All Prisma migrations & 14 normalized models
- [x] Config validation at startup with Zod (including Cloudinary)
- [x] Pino logger + RFC 7807 error handler + `/health` DB ping check

### Phase 2 — Authentication & Multi-Tenant Security ✅ (Completed)
- [x] Register, login, refresh, logout
- [x] RFC 6749 Opaque Refresh Token Family Rotation with replay theft detection
- [x] Role-Based Access Control (`CUSTOMER`, `VENDOR_OWNER`, `VENDOR_STAFF`, `ADMIN`, `SUPER_ADMIN`)
- [x] Rate limiting on auth routes
- [x] Tenant Isolation middleware (`requireVendorAuth`) strictly scoping data access to `req.vendorId`

### Phase 3 — Catalog, Sync & Cloudinary Media ✅ (Completed)
- [x] WooCommerce async sync engine (RFC 7240 `Preference-Applied: respond-async`)
- [x] `GET /products` (paginated, search, category filtered, OCC versioned)
- [x] `GET /products/:slug` (slug resolution with price snapshots)
- [x] Serverless Cloudinary streaming upload handler (`POST /api/upload`)
- [x] Multi-Tier SWR client-side cache with in-flight request deduplication

### Phase 4 — Orders, Partitioning & Financial Settlement ✅ (Completed)
- [x] `POST /orders/checkout` (atomic transaction with stock decrement & snapshot prices)
- [x] Multi-vendor sub-order decomposition (`Master Order` -> `VendorOrder` per merchant)
- [x] Martin Fowler `Money` Value Object (integer pesewas) & `CommissionCalculator` strategy
- [x] Invariant conservation: 10% platform fee + 90% merchant earnings with zero rounding leakage
- [x] 48-Hour delivery escrow state machine (`clearedAt = now + 48h`)
- [x] Vendor Mobile Money wallet settlement (`momoNumber`, `momoNetwork` on MTN, Telecel, AT)
- [x] Vendor payout ledger API (`GET /api/v1/vendors/portal/payouts`)

### Phase 5 — Governance, Admin & Vendor CRUD ✅ (Completed)
- [x] Merchant dashboard with live OCC concurrency protection (`PATCH /portal/products/:id`)
- [x] Vendor product soft-deletion (`DELETE /portal/products/:id`)
- [x] Super Admin merchant governance (approvals, suspensions, custom commission rates)
- [x] Immutable platform audit logs (`audit_logs`) tracking all governance actions

---

## 13. Technology Stack & Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| Node.js | 20+ LTS | High-throughput async runtime |
| Fastify | ^5.2 | HTTP framework with built-in schema compilation |
| Next.js | 16.3 (Turbopack) | React 19 Frontend App Router & Edge Serverless |
| Prisma | ^5.22 | ORM, migrations, and type-safe relational models |
| Cloudinary | ^2.5 | Enterprise cloud media hosting, transforms, CDN |
| ioredis | ^5.4 | Redis client for caching and pub/sub |
| bullmq | ^5.13 | Redis-backed asynchronous job queues |
| zod | ^3.23 | Runtime environment and payload validation |
| jsonwebtoken | ^9.0 | Cryptographic JWT access tokens |
| bcryptjs | ^2.4 | Cryptographic password and token hashing |
| pino | ^9.4 | Structured JSON logging |
| @fastify/helmet | ^12.0 | Content-Security-Policy & security headers |
| @fastify/cors | ^10.0 | Multi-origin CORS support |
| @fastify/swagger | ^9.2 | Interactive OpenAPI documentation (`/docs`) |

---

> **Status**: Core enterprise foundation, multi-vendor partitioning, financial math, tenant isolation, and Cloudinary media pipelines are fully implemented and verified production-ready.

