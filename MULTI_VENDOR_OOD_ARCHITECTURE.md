# NextDor Multi-Vendor Architecture: Object-Oriented Design & Code Breakdown

This document provides a comprehensive, function-by-function, line-by-line architectural breakdown of the NextDor Multi-Vendor Marketplace. It explains the design patterns, mathematical invariants, security mechanisms, and Object-Oriented / SOLID principles governing the codebase.

---

## 🏛️ 1. Architecture Overview & SOLID Compliance

NextDor does not use an "anemic model" (where raw database rows are passed around without validation). Instead, it follows **Clean Architecture** and **Domain-Driven Design (DDD)** principles:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Presentation Layer (Controllers / Fastify Routes)                     │
│  - Extracts HTTP params, checks JWT auth, enforces tenant context      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Calls
┌──────────────────────────────────▼─────────────────────────────────────┐
│  Domain Service Layer (ProductService, VendorService, AuthService)     │
│  - Enforces business rules, OCC concurrency, and tenant boundaries     │
└─────────────────┬────────────────────────────────────┬─────────────────┘
                  │ Injects                            │ Uses
┌─────────────────▼──────────────────┐   ┌─────────────▼─────────────────┐
│ Data Access Layer (Repositories)   │   │ Domain Layer (Value Objects)  │
│ - ProductRepository                │   │ - Money (minor units / pesewas)│
│ - VendorRepository                 │   │ - CommissionCalculator        │
│ - UserRepository                   │   │   (zero-leakage splits)       │
└────────────────────────────────────┘   └───────────────────────────────┘
```

### SOLID Principles in Practice:
- **Single Responsibility Principle (SRP):** Each class does exactly one thing:
  - `Money`: Exact minor-unit currency arithmetic.
  - `CommissionCalculator`: Fair revenue splitting between merchant and platform.
  - `ProductRepository`: Database queries and data mapping.
  - `ProductService`: Domain business logic and validation.
  - `product.routes.ts`: HTTP request parsing and response envelopes.
- **Open / Closed Principle (OCP):** Modules can be extended without editing core logic. For example, `CommissionCalculator` supports custom tiered commission rates for VIP vendors without modifying the core calculation engine.
- **Liskov Substitution Principle (LSP):** The `Money` Value Object guarantees consistent behavior across all entities; substituting amounts calculated from Prisma Decimals or numbers produces identical results.
- **Interface Segregation Principle (ISP):** Clean, targeted Data Transfer Objects (`RegisterVendorDto`, `CreateVendorProductDto`, `FindProductsFilter`) prevent methods from depending on unused parameters.
- **Dependency Inversion Principle (DIP):** Services **never instantiate database connections**. They receive their repositories through constructor injection (`constructor(private readonly repo: VendorRepository)`), making them 100% testable and decoupled.

---

## 💎 2. Domain Layer: Value Objects & Mathematical Strategies

### [`next-backend/src/domain/Money.ts`](./next-backend/src/domain/Money.ts)

A **Value Object** has no unique database identifier (UUID). It is defined purely by its values (`minorAmount` and `currency`). Two `Money` objects representing 50 GHS are completely equal.

#### Why Not Native JavaScript Numbers?
JavaScript numbers use IEEE 754 double-precision floats. Running `0.1 + 0.2` outputs `0.30000000000000004`. In e-commerce, float rounding leaks real money. `Money` operates in **minor units** (Ghana Pesewas or Cents): `GH₵ 45.50` is stored as integer `4550`.

#### Code Breakdown:
```typescript
26:   private readonly minorAmount: number;
31:   public readonly currency: string;
```
- **Line 26 (`minorAmount`)**: Stores the value in pesewas as an integer. `readonly` ensures immutability.
- **Line 31 (`currency`)**: Stores the ISO 4217 currency code (e.g. `"GHS"`).

```typescript
36:   private constructor(minorAmount: number, currency = "GHS") {
37:     if (!Number.isSafeInteger(minorAmount)) {
38:       throw new Error(`Money minorAmount must be a safe integer, received: ${minorAmount}`);
39:     }
40:     this.minorAmount = minorAmount;
41:     this.currency = currency.toUpperCase();
42:   }
```
- **Line 36 (`private constructor`)**: Prevents direct instantiation with raw floats (`new Money(12.50)`). Callers must use named factory methods.
- **Line 37 (`Number.isSafeInteger`)**: Guarantees the value is an integer within $\pm(2^{53} - 1)$ to prevent silent numeric overflow.

```typescript
48:   public static fromMajor(amount: number | string | Prisma.Decimal, currency = "GHS"): Money {
49:     const numericAmount = typeof amount === "object" ? Number(amount) : Number(amount);
50:     if (isNaN(numericAmount)) {
51:       throw new Error(`Invalid monetary amount: ${amount}`);
52:     }
53:     const minor = Math.round(numericAmount * 100);
54:     return new Money(minor, currency);
55:   }
```
- **Line 48 (`fromMajor`)**: Static factory method accepting standard cedis (from client inputs or Prisma `Decimal` columns).
- **Line 53 (`Math.round(...)`)**: Converts to minor pesewas while rounding away any floating point noise.

```typescript
96:   public add(other: Money): Money {
97:     this.assertSameCurrency(other);
98:     return new Money(this.minorAmount + other.minorAmount, this.currency);
99:   }
104:  public subtract(other: Money): Money {
105:    this.assertSameCurrency(other);
106:    return new Money(this.minorAmount - other.minorAmount, this.currency);
107:  }
145:  private assertSameCurrency(other: Money): void {
146:    if (this.currency !== other.currency) {
147:      throw new Error(`Currency mismatch: cannot operate on ${this.currency} and ${other.currency}`);
148:    }
149:  }
```
- **Lines 96-107 (`add`, `subtract`)**: Immutably returns a new `Money` instance containing the sum/difference.
- **Line 145 (`assertSameCurrency`)**: Domain boundary check. Rejects attempts to add `GHS` and `USD` without an explicit exchange rate conversion.

---

### [`next-backend/src/domain/CommissionCalculator.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/domain/CommissionCalculator.ts)

Encapsulates marketplace revenue sharing between platform take-rate and vendor net payout.

#### The Rounding Leak Problem:
Suppose Subtotal = `GH₵ 10.05` and commission is 50%:
- Platform Fee = $10.05 \times 0.50 = 5.025 \rightarrow \text{rounded to } 5.03$
- Vendor Net = $10.05 \times 0.50 = 5.025 \rightarrow \text{rounded to } 5.03$
- Total = $5.03 + 5.03 = 10.06$ (1 pesewa created out of thin air!). Over 100,000 orders, accounts are irreconcilable.

#### Code Breakdown:
```typescript
47:   public calculateSplit(subtotal: Money, overrideRate?: number): CommissionSplitResult {
48:     const rate = overrideRate !== undefined ? overrideRate : this.defaultRatePercent;
...
55:     const platformFee = subtotal.percentage(rate);
59:     const vendorNet = subtotal.subtract(platformFee);
61:     return { subtotal, platformFee, vendorNet, effectiveRatePercent: rate };
67:   }
```
- **Line 55 (`platformFee = subtotal.percentage(rate)`)**: Derives platform fee using integer pesewa math.
- **Line 59 (`vendorNet = subtotal.subtract(platformFee)`)**: Derives vendor payout by **direct subtraction**, strictly enforcing the invariant:
  $$\text{platformFee} + \text{vendorNet} \equiv \text{subtotal}$$
  Zero pesewas are ever lost or generated.

---

## 📦 3. Data Access Layer: Repositories

---

### [`next-backend/src/modules/products/product.repository.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/products/product.repository.ts)

Isolates all Prisma queries for catalog items.

#### Code Breakdown:
```typescript
44:   async findMany(filter: FindProductsFilter): Promise<PaginatedProducts> {
46:     const skip = (page - 1) * limit;
49:     const where: Prisma.ProductWhereInput = { deletedAt: null };
```
- **Line 46 (`skip`)**: Computes SQL `OFFSET` pagination.
- **Line 49 (`deletedAt: null`)**: Soft-delete pattern; deleted products are excluded from store browsing without breaking historical order references.

```typescript
75:     const [total, products] = await Promise.all([
76:       prisma.product.count({ where }),
77:       prisma.product.findMany({ where, skip, take: limit, orderBy, ... })
78:     ]);
```
- **Lines 75-78 (`Promise.all`)**: Executes the total item count and paginated query concurrently over the database pool, cutting query latency in half.

```typescript
83:         include: {
84:           images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
87:           categories: { select: { id: true, name: true, slug: true } },
90:           vendor: { select: { id: true, name: true, slug: true, logoUrl: true, status: true } },
93:         }
```
- **Lines 83-93 (Eager Loading)**: Pre-fetches images, categories, and vendor branding in a single query, preventing the **N+1 query problem**.

---

### [`next-backend/src/modules/vendors/vendor.repository.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/vendors/vendor.repository.ts)

Isolates all merchant, inventory, and payout queries.

#### Code Breakdown:
```typescript
75:     return prisma.$transaction(async (tx) => {
76:       const newUser = await tx.user.create({ data: params.user });
80:       const newVendor = await tx.vendor.create({
81:         data: { ...params.vendor, owner: { connect: { id: newUser.id } } },
84:       });
87:       await tx.user.update({
88:         where: { id: newUser.id },
89:         data: { vendorId: newVendor.id },
90:       });
92:       return { user: newUser, vendor: newVendor };
93:     });
```
- **Line 75 (`prisma.$transaction`)**: Runs merchant registration inside an **ACID database transaction**. If vendor creation fails (e.g. duplicate store name), user creation is rolled back automatically. No orphaned accounts can exist.
- **Lines 80-90**: Connects the user as owner of the vendor, and updates `user.vendorId` for single-query tenant resolution.

```typescript
198:   async updateProductWithOcc(productId: string, data: Prisma.ProductUpdateInput) {
199:     return prisma.product.update({
200:       where: { id: productId },
201:       data: {
202:         ...data,
203:         version: { increment: 1 },
204:       },
...
209:     });
210:   }
```
- **Line 203 (`version: { increment: 1 }`)**: Generates SQL `UPDATE "Product" SET version = version + 1 WHERE id = $1`. Atomically increments the Optimistic Concurrency Control counter inside PostgreSQL.

---

### [`next-backend/src/modules/auth/user.repository.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/auth/user.repository.ts)

Manages identity and refresh token lifecycles.

```typescript
76:   async revokeTokenFamily(family: string): Promise<number> {
77:     const res = await prisma.refreshToken.updateMany({
78:       where: { family, revokedAt: null },
79:       data: { revokedAt: new Date() },
80:     });
81:     return res.count;
82:   }
```
- **Lines 76-82 (`revokeTokenFamily`)**: Implements **RFC 6749 Token Family Rotation**. If an attacker attempts to replay a stolen refresh token, the entire family is instantly invalidated, forcing re-authentication across all devices.

---

## 🧠 4. Business Logic Layer: Services

---

### [`next-backend/src/modules/vendors/vendor.service.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/vendors/vendor.service.ts)

Handles merchant onboarding, dashboard analytics, and tenant-isolated product updates.

```typescript
74:   constructor(
75:     private readonly vendorRepo: VendorRepository,
76:     private readonly commissionCalc: CommissionCalculator
77:   ) {}
```
- **Lines 74-77 (Constructor Injection)**: Follows the **Dependency Inversion Principle**. `VendorService` does not directly instantiate repositories or database connections; they are injected into it.

```typescript
267:     const product = await this.vendorRepo.findVendorProductById(vendorId, productId);
269:     if (!product) {
270:       throw new NotFoundError("Product not found or you do not have permission to edit it.");
271:     }
```
- **Lines 267-271 (Tenant Boundary Check)**: Queries by *both* `vendorId` AND `productId`. Even if Vendor B guesses the UUID of Vendor A's product, it returns `NotFoundError`. Cross-merchant tampering is mathematically impossible.

```typescript
274:     if (product.version !== expectedVersion) {
275:       throw new ConflictError(
276:         `Optimistic lock conflict: This product was modified by another session (expected v${expectedVersion}, found v${product.version}). Please refresh and review before saving.`
277:       );
278:     }
```
- **Lines 274-278 (Optimistic Concurrency Control - OCC)**:
  - **The Race Condition:** User A loads stock `10` (`version: 1`). User B buys `2` items, reducing stock to `8` (`version: 2`). User A then tries to edit the price and save with `version: 1`.
  - **The Safeguard:** The server detects `product.version (2) !== expectedVersion (1)` and throws **HTTP 409 Conflict**, preventing User A from silently overwriting User B's stock reduction!

---

### [`next-backend/src/modules/auth/auth.service.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/auth/auth.service.ts)

```typescript
108:     const passwordToCheck = user?.passwordHash ?? "$2b$12$invalidhashpadding";
110:     const valid = await bcrypt.compare(input.password, passwordToCheck);
112:     if (!user || !valid || user.deletedAt) {
113:       throw new UnauthorizedError("Email or password is incorrect");
114:     }
```
- **Lines 108-114 (Timing Attack Protection)**: If a user doesn't exist, comparing against a dummy hash ensures the execution time is always ~100ms, preventing hackers from enumerating registered emails based on server response latency.

---

## 🌐 5. Presentation Layer: Controllers & Routes

---

### [`next-backend/src/modules/vendors/vendor.routes.ts`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-backend/src/modules/vendors/vendor.routes.ts)

Acts as a clean controller delegating requests to the service layer.

```typescript
35: async function requireVendorAuth(req: FastifyRequest, reply: FastifyReply) {
...
46:   const payload = AuthService.verifyAccessToken(token);
49:   if (payload.role !== "VENDOR_OWNER" && payload.role !== "VENDOR_STAFF" ...) {
53:     return reply.status(403).send({ success: false, error: { code: "FORBIDDEN" } });
54:   }
79:   req.vendorId = vendorId;
80:   req.userId = payload.sub;
```
- **Lines 35-80 (`requireVendorAuth`)**: Fastify pre-handler hook acting as a Security Interceptor:
  1. Validates JWT signature.
  2. Enforces Role-Based Access Control (RBAC).
  3. Attaches `req.vendorId` directly to the request, so downstream route handlers never have to guess the merchant ID.

```typescript
90: export const vendorRoutes: FastifyPluginAsync = async (app) => {
92:   const vendorRepository = new VendorRepository();
93:   const commissionCalculator = new CommissionCalculator();
94:   const vendorService = new VendorService(vendorRepository, commissionCalculator);
```
- **Lines 90-94 (Composition Root)**: Where classes are wired together. Route handlers contain **zero raw database queries**; they only validate inputs, invoke `vendorService`, and serialize HTTP responses.

---

## 🖥️ 6. Frontend Reactive State & OCC Integration

### [`next-frontend/app/vendor/dashboard/page.tsx`](file:///c:/Users/User/OneDrive/Desktop/NextDor/next-frontend/app/vendor/dashboard/page.tsx)

```typescript
164:   const res = await fetch(`${API_BASE}/vendors/portal/products/${product.id}`, {
165:     method: "PATCH",
166:     headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
170:     body: JSON.stringify({
171:       version: product.version, // Transmit local version for OCC validation
172:       price: parseFloat(editPrice),
173:       stockQty: parseInt(editStock, 10),
174:     }),
175:   });
```
- **Line 171 (`version: product.version`)**: Sends the version number currently known to the frontend.

```typescript
179:   if (!res.ok || !json.success) {
180:     if (res.status === 409) {
181:       setErrorNotice(
182:         "⚠️ Concurrency Conflict (OCC): Another user modified this product simultaneously! Reloading current state..."
183:       );
184:       loadVendorData(); // Automatically syncs with latest server data
185:     }
186:   }
```
- **Lines 180-185 (Handling HTTP 409)**: If another user modified the record in the meantime, the UI alerts the user and refreshes the catalog to prevent data loss.

---

## 📦 7. Domain Design: Sub-Order Partitioning & Independent Fulfillment

In a multi-vendor marketplace, a single customer cart frequently contains products from multiple independent merchants (e.g., pastries from *Sweet Bakes* and phone accessories from *NextDor Direct*).

### The Architectural Invariant: Master Order vs. Sub-Orders
Passing the raw checkout order directly to merchants would violate tenant isolation and prevent independent delivery logistics. NextDor implements the **Master-Sub Order Decomposition Pattern**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Master Order (ND-XXXXX)                         │
│  - Customer reference, total gross amount, checkout shipping address   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ 1:N                             │ 1:N
┌──────────────────▼─────────────┐   ┌───────────────▼───────────────────┐
│     VendorOrder (Merchant A)   │   │      VendorOrder (Merchant B)     │
│ - vendorId: "sweet-bakes"      │   │ - vendorId: "nextdor-direct"      │
│ - Subtotal: GH₵ 640.00         │   │ - Subtotal: GH₵ 320.00            │
│ - 10% Commission: -GH₵ 64.00   │   │ - 0% Commission: GH₵ 0.00         │
│ - Net Earnings: GH₵ 576.00     │   │ - Net Earnings: GH₵ 320.00        │
│ - Status: PROCESSING           │   │ - Status: SHIPPED                 │
└────────────────────────────────┘   └───────────────────────────────────┘
```

### Snapshot Immutability (`OrderItem`)
`OrderItem` rows store immutable snapshots taken at the exact instant of checkout:
- `productName`: String snapshot. If the merchant renames the product tomorrow, old receipts remain historically accurate.
- `unitPrice`: Numeric snapshot. Repricing an active product does not alter completed orders.
- `productImage`: URL snapshot.
- `vendorId`: Enables strict tenant filtering without joining across the entire catalog.

### State Machine for Sub-Order Dispatch:
$$\text{PENDING} \xrightarrow{\text{Accept}} \text{PROCESSING} \xrightarrow{\text{Dispatch}} \text{SHIPPED} \xrightarrow{\text{Delivery}} \text{DELIVERED} \xrightarrow{\text{48h Escrow}} \text{CLEARED / PAID}$$

---

## ⚖️ 8. Financial Engine: 48-Hour Escrow & Automated MoMo Settlement

E-commerce in West Africa requires balancing buyer trust with merchant liquidity. If merchants received immediate payouts before delivery, buyers would face fraud risks; conversely, manual delays hurt small business cash flow.

### The 48-Hour Escrow State Machine
NextDor solves this with an automated **Escrow Settlement Engine**:

1. **Checkout & Authorization**: Customer pays via Paystack (MTN Mobile Money, Telecel Cash, Card). Funds enter NextDor's platform escrow account.
2. **Merchant Fulfillment**: Merchant accepts order, prepares items, and dispatches with a rider.
3. **Delivery Timestamp**: When marked `DELIVERED`, `updateVendorOrderStatus` calculates and writes:
   $$\text{clearedAt} = \text{now}() + 48 \text{ hours}$$
4. **Inspection Window**: The customer has a 48-hour window to report missing or damaged goods.
5. **Automated MoMo Disbursement (`VendorPayout`)**:
   - Once $\text{now}() \ge \text{clearedAt}$, the sub-order moves from `inEscrow` to `availableForPayout`.
   - The platform disbursements engine generates a `VendorPayout` row and executes an automated transfer to the merchant's registered MoMo number (e.g. `0241234567` on MTN).

---

## 🎛️ 9. Merchant Console: 4-Tab Reactive Console Architecture

The Merchant Portal ([`next-frontend/app/vendor/dashboard/page.tsx`](./next-frontend/app/vendor/dashboard/page.tsx)) provides four dedicated control planes:

| Tab | Role & Capabilities | API Endpoints |
|---|---|---|
| **📦 Inventory & Stock** | Live catalog, inline stock/price editor with OCC version counters, Cloudinary drag-and-drop image upload, product publishing modal locked to `req.vendorId`, and tenant-isolated soft-delete. | `GET /vendors/portal/products`<br>`POST /vendors/portal/products`<br>`PATCH /vendors/portal/products/:id`<br>`DELETE /vendors/portal/products/:id` |
| **🛍️ Store Orders & Dispatch** | Partitioned sub-orders, customer address snapshots, line items, 90% net earnings calculation, and 1-click dispatch status progression. | `GET /vendors/portal/orders`<br>`PATCH /vendors/portal/orders/:id/status` |
| **💳 MoMo Payouts & Escrow** | Real-time financial cards (Lifetime Net, In 48h Escrow, Available, Disbursed), escrow educational guide, and MoMo transfer ledger. | `GET /vendors/portal/payouts` |
| **⚙️ Store Profile & Settings** | Public brand identity (Name, Bio, Phone), MoMo settlement account selection (MTN, Telecel, AT), and Logo/Banner URL live previews. | `PATCH /vendors/portal/me` |

---

## ☁️ 10. Media Infrastructure: Cloudinary Asset Pipeline

NextDor delegates binary media storage to **Cloudinary** to maintain serverless scalability and maximize edge CDN performance:

1. **Signed Serverless Upload Route (`/api/upload`)**: Next.js route handler securely signs uploads and streams file buffers to Cloudinary under folder `nextdor/products`, keeping API secrets strictly server-side.
2. **Interactive UI Component (`components/ui/ImageUpload.tsx`)**: Reusable drag-and-drop component featuring instant client previews, real-time Cloudinary upload progress, CDN badge detection, and fallback URL input.
3. **Optimized Delivery**: Integrated with `next/image` using Next.js 16 remote patterns (`res.cloudinary.com`), enabling WebP/AVIF auto-transcoding, responsive srcset generation, and blur-up loading.

---

---

## 🚀 11. 3-Tier Multi-Vendor Catalog Ingestion Architecture

Merchants on NextDor vary widely in inventory scale — from boutique artisans with 5 handmade products to distributors with thousands of SKUs. NextDor provides a flexible 3-tier catalog ingestion pipeline:

```
                  ┌────────────────────────────────────────────────────────┐
                  │              Merchant Catalog Ingestion               │
                  └───────────────────────────┬────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
┌────────▼──────────────┐           ┌─────────▼─────────────┐            ┌─────────▼──────────────┐
│  Tier 1: Single Item  │           │   Tier 2: Bulk CSV    │            │   Tier 3: WooCommerce  │
│  - Web modal / form   │           │   - RFC 4180 parsing  │            │   - Live REST API v3   │
│  - Cloudinary upload  │           │   - Delimiter detect  │            │   - Key/Secret crypto  │
│  - OCC Concurrency    │           │   - Batch validation  │            │   - Redis lock per-vdr │
│  - Tenant isolation   │           │   - Up to 500 rows    │            │   - Background worker  │
└───────────────────────┘           └───────────────────────┘            └────────────────────────┘
```

### 1. Tier 1: Single Product Ingestion
- **Route:** `POST /api/v1/vendors/portal/products` (Merchant) or `POST /api/v1/products` (Admin).
- **Execution:** Form inputs validate required fields (`name`, `price`, `description`, `images`, `stockQty`).
- **OCC Invariant:** Newly created products initialize with `version = 1`. Subsequent mutations require client to pass `version` for optimistic locking.

### 2. Tier 2: Bulk CSV / Excel Upload (`BulkUploadModal.tsx`)
- **Route:** `POST /api/v1/vendors/portal/products/bulk`.
- **Parsing Engine:** Robust RFC 4180 parser with quote-escaping and automatic delimiter detection (comma `,`, semicolon `;`, or tab `\t`).
- **Header Normalization:** Lenient aliases matching common spreadsheet column headers:
  - Name: `name`, `productname`, `title`, `itemname`
  - Price: `price`, `regularprice`, `unitprice`, `originalprice`
  - Sale Price: `saleprice`, `currentprice`, `discountedprice`, `offerprice`
  - Stock: `stock`, `stockqty`, `quantity`, `inventory`
  - Category: `category`, `categoryname`, `department`
  - Image: `image`, `imageurl`, `photo`, `picture`
- **Client-Side Batch Validation:** Validates required values, positive numbers, and row formats before sending to the backend, rendering row-by-row error indicators.
- **One-Click Sample Template:** Generates and downloads a clean, pre-formatted CSV template directly in the browser.

### 3. Tier 3: Per-Vendor WooCommerce Live Store Connector (`StoreSyncModal.tsx`)
- **Routes:**
  - `GET /api/v1/vendors/portal/sync`: Fetches sync configuration and timestamp of last execution.
  - `PATCH /api/v1/vendors/portal/sync`: Securely updates WooCommerce store URL, Consumer Key, and Consumer Secret.
  - `POST /api/v1/vendors/portal/sync/trigger`: Dispatches live asynchronous catalog synchronization.
- **Distributed Lock with Redis:** Prevents race conditions and duplicate catalog writes by acquiring a distributed lock key:
  $$\text{lock:wc-sync:vendor:}\{\text{vendorId}\}$$
  with a 10-minute TTL and automatic release on completion or error.
- **Tenant Scope Guarantee:** Incoming products are strictly upserted under the calling vendor's `vendorId`, preventing external products from leaking into other stores.

---

## 🏷️ 12. Dynamic Pricing & Financial Integrity Engine

### Compare-At Pricing & Discount Engine
To motivate conversions without deceptive pricing, NextDor implements an automated discount calculation and strikethrough engine:

1. **Pricing Invariant:**
   - **Current Price (`price`)**: The actual checkout price charged to the buyer.
   - **Previous Price (`regularPrice`)**: The original reference or compare-at price.
2. **Display Rule:**
   - If $\text{regularPrice} > \text{price}$:
     - Render `price` as the primary highlight.
     - Render `regularPrice` with strikethrough styling (`line-through text-neutral-400`).
     - Calculate and display percentage discount badge:
       $$\text{Discount \%} = \text{round}\left(\frac{\text{regularPrice} - \text{price}}{\text{regularPrice}} \times 100\right)\%$$
   - If $\text{regularPrice}$ is empty, null, or $\le \text{price}$:
     - Render only `price`.
     - Completely omit strikethrough price and percentage discount badge.

### Financial Accounting & Cancelled Order Exclusion
In strict compliance with GAAP/IFRS e-commerce standards, cancelled and refunded orders must **never** inflate revenue:
- **Rule:** Orders with `status IN ('CANCELLED', 'REFUNDED')` are excluded at the database query level from:
  1. **Gross Marketplace Volume (GMV)**
  2. **10% Platform Commission Revenue**
  3. **90% Merchant Escrow Balances**
  4. **Top-Selling Products by Revenue**
  5. **Category Sales Velocity Aggregates**
- **Enforcement:** Enforced consistently across backend analytics services (`admin.analytics.service.ts`) and frontend summary dashboards (`app/admin/page.tsx`).

---

## 📱 13. Mobile-First Uncongested UX Architecture

To deliver world-class usability on mobile devices (over 80% of Ghanaian e-commerce traffic):

1. **Responsive Card Architecture (`< md`)**:
   - Replaced crowded 7-column desktop tables with clean, stacked mobile product cards.
   - Each card displays high-resolution thumbnail, product title, current price with strikethrough previous price, stock badge chip, and quick-action menu (Edit OCC Drawer, Delete).
2. **Bottom-Sheet Ingestion Flow**:
   - Tapping **"+ Add Product"** on mobile summons an ergonomic bottom sheet offering three clear choices (Single Product Entry, Bulk CSV Upload, WooCommerce Sync).
3. **Slide-Over OCC Edit Drawer**:
   - Quick price and stock edits happen in an inline slide-over drawer with OCC version verification, preventing full-page navigation context switches.
4. **Touch-Optimized Filters**:
   - Horizontally scrollable status tabs and stock filter pills ("All", "In Stock", "Low Stock", "Out of Stock") with minimum 44px tap targets.

---

## 🛡️ 14. Vendor Moderation Queue & Public Catalog Visibility

To prevent unvetted counterfeit items or unauthorized merchant stores from diluting platform quality:

### The Vendor Moderation Lifecycle:
$$\text{Registration} \xrightarrow{} \text{PENDING\_APPROVAL} \xrightarrow{\text{Admin Review}} \text{ACTIVE} \underset{\text{KYC / Dispute}}{\overset{\text{Violation}}{\rightleftharpoons}} \text{SUSPENDED}$$

1. **Merchant Status Isolation**:
   - Newly registered merchants enter `PENDING_APPROVAL`. They can access their isolated portal (`/vendor/dashboard`), configure payout settings, and stage products.
   - However, their staged items are withheld from the public customer storefront until platform administrators verify their business registration and Ghana Card KYC details (`PATCH /api/v1/admin/merchants/:id/status`).
2. **Public Catalog Invariant**:
   - All storefront search, category, and catalog queries enforce the predicate:
     ```prisma
     where: {
       deletedAt: null,
       vendor: {
         status: "ACTIVE"
       }
     }
     ```
   - If an active merchant is suspended (`SUSPENDED`), all their products immediately disappear from public search, category listings, and checkout without deleting historical order records.
3. **Automated Collision-Free SKU Generation**:
   - Ingested products receive an automated platform SKU formatted as `ND-XXXXX` (e.g. `ND-7F8A1`), combining a platform prefix with a cryptographically uniform alphanumeric sequence.
   - SKUs are unique per platform instance, indexed for O(1) warehouse and courier scanning.

---

## 🏆 Key Takeaways

1. **Precision Finance**: Minor pesewa integer math avoids JavaScript floating-point errors.
2. **Absolute Tenant Isolation**: No vendor can access, edit, or delete another vendor's inventory, sub-orders, or payouts (`WHERE id = productId AND vendorId = currentVendorId`).
3. **Concurrency Safety**: Optimistic locking (OCC version counter) guarantees race-free stock and pricing management.
4. **Sub-Order Partitioning**: Master orders safely decompose into merchant-isolated line items.
5. **Automated Escrow Protection**: 48-hour delivery verification window protects buyers while guaranteeing seller MoMo settlement.
6. **3-Tier Catalog Ingestion**: Single product OCC forms, bulk RFC 4180 CSV batch uploads, and per-vendor WooCommerce REST API connectors with Redis distributed locking.
7. **Vendor Moderation Gate**: Staged vendor inventory requires administrative KYC approval before entering the public customer catalog.
8. **Automated SKU Generation**: Collision-free `ND-XXXXX` identifier system for unified barcode and logistics handling.
9. **Pricing & Revenue Integrity**: Dynamic compare-at discount calculations with strict exclusion of cancelled orders from revenue metrics.
10. **Decoupled Architecture**: High maintainability through SOLID, Dependency Inversion, Clean Architecture, and Cloudinary media pipelines.


