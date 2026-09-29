# NextDor Frontend Caching & Performance Architecture

This document details the **Client-Side Stale-While-Revalidate (SWR) Caching and Request Deduplication Engine** implemented in `next-frontend`. It explains the problems solved, architectural design decisions, data structures, mutation invalidation rules, and the complete audit of cached routes across the application.

---

## 🧭 1. Problem Statement

### 1.1 The Navigation Unmount Problem
In the **Next.js App Router**, navigating between different routes (e.g. from `/admin/merchants` to `/admin/admins` and back) completely unmounts and remounts the route components. 
Prior to this implementation:
- Every page had `useEffect(() => { load(); }, [token])`.
- Navigating between admin tabs fired a fresh network request to the backend every single time.
- Users experienced constant loading spinners (*"Loading registered merchants..."*), and the PostgreSQL database was hammered on every click.

### 1.2 The Mount-Invalidation Bug
In an early attempt to invalidate caches upon filter changes, `merchantsCache.invalidate()` was placed directly inside `useEffect`:
```tsx
useEffect(() => {
  merchantsCache.invalidate(); // ❌ Cleared cache on EVERY component mount!
  loadMerchants();
}, [token, statusFilter]);
```
Because `useEffect` triggers on initial mount, navigating to the page immediately destroyed the cache before `loadMerchants()` could read it. This forced `cached === null`, triggered the loading spinner, and made a network request on every single visit.

### 1.3 The Cold-Start Double-Fetch
In Next.js development mode (`React.StrictMode`), React mounts, unmounts, and re-mounts components on initial render. In addition, authentication tokens are restored asynchronously from `localStorage`. Because cold database queries (like Prisma's unindexed table aggregations) took 1.5+ seconds, the second mount triggered before the first query resolved, causing two identical, heavy database queries in parallel.

---

## 🏛️ 2. Architectural Solution: `clientCache.ts`

To solve these issues with **zero external dependencies** (avoiding adding 15–30 KB bundle bloat from external libraries), we built an enterprise-grade SWR cache factory in [`next-frontend/lib/cache/clientCache.ts`](file:///home/kojowiafe/Desktop/NextDor/next-frontend/lib/cache/clientCache.ts).

### 2.1 Multi-Tier Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Component Request                    │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │ Tier 1: In-Memory Map     │  O(1) lookup, zero latency,
              │ (Module-Level Store)      │  lives until tab refresh
              └─────────────┬─────────────┘
                            │ (Cache Miss)
              ┌─────────────▼─────────────┐
              │ Tier 2: sessionStorage    │  Survives route navigations
              │ (Persisted JSON envelope) │  within the same browser tab
              └─────────────┬─────────────┘
                            │ (Cache Miss or Stale)
              ┌─────────────▼─────────────┐
              │ Tier 3: Network Fetch     │  Deduplicated via in-flight
              │ (Fastify REST API)        │  Promise sharing (`fetchDedupe`)
              └───────────────────────────┘
```

### 2.2 Core Interfaces & Strategy

```typescript
export interface SWRCache<T> {
  /** Returns cached data (memory → sessionStorage → null). Never throws. */
  get(subKey?: string): T | null;
  /** Writes data to both memory and sessionStorage with current timestamp. */
  set(data: T, subKey?: string): void;
  /** True when the cache is missing or older than ttlMs. */
  isStale(subKey?: string): boolean;
  /** Returns data and staleness status in a single safe atomic call. */
  getEntry(subKey?: string): SWRCacheEntryResult<T>;
  /** Wipes a specific subkey (or default if omitted). */
  invalidate(subKey?: string): void;
  /** Wipes ALL subkeys in this cache namespace. Call after mutations. */
  invalidateAll(): void;
  /**
   * Fetches data with in-flight deduplication.
   * If a fetch for this key is already running, returns the existing Promise.
   */
  fetchDedupe(subKey: string | undefined, fetcher: () => Promise<T>): Promise<T>;
}
```

### 2.3 Sub-Key Parameterization
Queries frequently accept filters, pagination, or entity identifiers (e.g. status filter, search query, page number, order number).
- Key format: `${storageKey}::${subKey}`
- Different filters (`ALL`, `PENDING_APPROVAL`, `SUSPENDED`) cache independently. Switching between tabs or filter pills is instantaneous.
- Calling `invalidateAll()` uses namespace prefix scanning (`storageKey::*`) to purge all sub-keys across both memory and `sessionStorage` atomically.

### 2.4 In-Flight Request Deduplication (`fetchDedupe`)
`IN_FLIGHT_PROMISES` tracks running network requests by key. If a second component or an asynchronous `useEffect` trigger attempts to fetch the exact same endpoint while request #1 is still in transit, it attaches to the existing Promise. Only **ONE** query ever touches the backend and PostgreSQL.

---

## 📋 3. Route-by-Route Implementation Audit

The following table summarizes all data touchpoints across `next-frontend` where SWR caching has been implemented:

| Module / Route | Storage Key | TTL | Strategy & Invalidation Rules |
|---|---|---|---|
| **Operations Console (Dashboard)**<br>`app/admin/page.tsx` | `nextdor_admin_vendor_alerts` | 2 min | Pending vendor applications & merchant metrics. Deduplicated with `fetchDedupe`. Invalidation upon merchant approval or manual refresh. |
| **Admin Orders**<br>`app/admin/orders/page.tsx` | `nextdor_admin_orders` | 2 min | Sub-keyed by order status filter (`all`, `processing`, `shipped`, `delivered`, `cancelled`). Live backend connection with fallback. Invalidation on status update in `[id]` and manual refresh. |
| **Admin Products Catalog**<br>`app/admin/products/page.tsx` | `nextdor_admin_products` | 5 min | Full catalog SWR caching with in-flight deduplication. Purged automatically on product deletion, creation, WooCommerce sync completion, and manual refresh. |
| **Admin Customers**<br>`app/admin/customers/page.tsx` | `nextdor_admin_customers` | 5 min | Instant SWR rendering, search filtering, and manual refresh cache purge. |
| **Admin Analytics**<br>`app/admin/analytics/page.tsx` | `nextdor_admin_analytics` | 5 min | Cached analytics snapshot (30d revenue, orders by status, top products, sales by category) with manual refresh. |
| **Merchant Review / Approvals**<br>`app/admin/merchants/page.tsx` | `nextdor_admin_merchants` | 3 min | Sub-keyed by `statusFilter` & `search`. Removed mount invalidation. `merchantsCache.invalidateAll()` called on status update, commission update, and manual refresh. |
| **Super Admin Team**<br>`app/admin/admins/page.tsx` | `nextdor_admin_team` | 5 min | Super admin only. Invalidation on create admin, toggle active status, and manual refresh. |
| **Platform Audit Logs**<br>`app/admin/audit-logs/page.tsx` | `nextdor_admin_audit_logs` | 1 min | Super admin only. Sub-keyed by `actionFilter` & `search`. Real-time security events. `auditLogsCache.invalidateAll()` called on manual refresh. |
| **User Orders List**<br>`app/account/orders/page.tsx` | `nextdor_my_orders` | 2 min | Sub-keyed by page number (`String(p)`). Multi-page navigation is instant. Exported `ordersCache` for external invalidation. |
| **User Order Details**<br>`app/account/orders/[number]/page.tsx` | `nextdor_order_detail` | 2 min | Sub-keyed by order `number`. Navigating back and forth between list and detail is instant. Cancelling an order purges both the detail cache and `ordersCache.invalidateAll()`. |
| **Vendor Portal Dashboard**<br>`app/vendor/dashboard/page.tsx` | `nextdor_vendor_portal` | 3 min | Snapshots store profile, statistics, products, orders, payouts, and escrow. Backend requests parallelized with `Promise.all`. Invalidation on product update (OCC), product creation, order status change, store settings change, and signout. |
| **Public Vendor Storefront**<br>`app/store/[slug]/page.tsx` | Next.js Server Cache | 60 sec | Replaced `cache: "no-store"` with Next.js ISR revalidation (`next: { revalidate: 60 }`), eliminating repetitive database hits under public browsing traffic. |

---

## 💡 4. How to Use `createSWRCache` in New Pages

To add SWR caching to any new page or component:

```typescript
import { createSWRCache } from "@/lib/cache/clientCache";

// 1. Create typed cache instance with unique key and TTL (in ms)
const myCache = createSWRCache<MyDataType[]>("nextdor_my_data", 3 * 60_000);

export default function MyPage() {
  const [data, setData] = useState<MyDataType[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData(forceRefresh = false) {
    // 2. Instant cache retrieval
    const { data: cached, isStale, hasData } = myCache.getEntry(subKey);
    if (hasData && !forceRefresh) {
      setData(cached!);
      setLoading(false);
      if (!isStale) return; // Completely fresh — skip network!
    } else if (!hasData) {
      setLoading(true); // First load ever — show spinner
    }

    // 3. Network fetch with deduplication
    try {
      const fresh = await myCache.fetchDedupe(subKey, async () => {
        const res = await fetch("/api/my-data");
        const json = await res.json();
        return json.data;
      });
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }

  // 4. Invalidate on mutations
  async function handleMutation() {
    await apiCall();
    myCache.invalidateAll(); // Clear stale data
    await loadData(true);    // Reload fresh
  }
}
```

---

## 🔍 5. Verification & Performance Impact

1. **Route Navigation Latency**:
   - Switching between tabs (e.g. Merchants ↔ Administrators): **Reduced from ~1,600ms database round-trips to 0ms (instant in-memory render)**.
   - Screen-flickering loading spinners eliminated during navigation.
2. **Database Load Reduction**:
   - Zero PostgreSQL queries fired when navigating between previously loaded tabs within TTL window.
   - Public storefront `/store/:slug` cached for 60s at the Next.js edge instead of querying the database on every page hit.
3. **Build & Typecheck Cleanliness**:
   - `npx tsc --noEmit`: **0 errors**.
   - `npm run build`: All 34 static and dynamic routes compiled successfully.

---

## 🛡️ 6. Resilient Error Handling & Fault Tolerance

### Problem: Uncaught Exceptions Triggering Next.js Error Modals
In development and production, throwing raw exceptions (`throw new Error(...)`) inside asynchronous data-fetch callbacks causes React and Next.js to intercept the error and mount the full-screen development error overlay (e.g. `Failed to load merchants`). This occurred if:
- An administrator session token in `localStorage` expired (HTTP 401/403).
- The backend was restarting or temporarily unreachable.
- The API returned a non-200 status code.

### Solution: Non-Crashing `fetchDedupe` & Graceful Component UI
1. **`fetchDedupe(subKey, fetcher: () => Promise<T | null>): Promise<T | null>`**:
   - `fetchDedupe` accepts fetchers that return `T | null`.
   - It wraps execution in an internal `try / catch`. If any error occurs during fetching or parsing, it logs a warning, cleans up the in-flight Promise map, and safely returns `null` rather than rejecting.
   - Only non-null, valid data is saved to memory and `sessionStorage`.
2. **Inline HTTP Status Handling**:
   - Endpoints inspect `res.status === 401 || res.status === 403` to show a user-friendly notice (*"Admin authorization required or session expired."*).
   - If cached data already exists (`hasData === true`), the user continues to see their cached information smoothly without visual interruption while the notice informs them of the background status.
   - If the fetch returns `null`, the component state is preserved, `isLoading` is set to `false`, and no unhandled error overlay appears.

---

## 🔑 7. Persistent Authentication & Reload Session Stability

### Problem: Premature Relocation to Login on Page Reload
Users experienced sudden redirection to `/login` or `/admin/login` after brief inactivity or upon reloading the page. Root cause investigation revealed:
1. **Short Access Token Lifespan (`15m`)**: `JWT_ACCESS_EXPIRES_IN` expired in only 15 minutes.
2. **Cross-Origin Cookie Blockade in Dev**: With `sameSite: "strict"`, modern browsers refuse to transmit the httpOnly `refresh_token` cookie across ports (`localhost:3000` → `127.0.0.1:4000`).
3. **Aggressive Session Purging on Network Glitches**: `initAuth()` previously caught any failed validation (`fetchCurrentUser`) and immediately purged `localStorage`, unmounting the authenticated user even on transient network hiccups.

### Solution: Resilient Token Expiration, Dual-Channel Refresh, & Client JWT Inspection
1. **Extended Access Token Window**:
   - `JWT_ACCESS_EXPIRES_IN` increased from `15m` to `7d` in backend configuration.
2. **Dual-Channel Refresh Token Fallback**:
   - Backend returns `refreshToken` in authentication payloads and sets `sameSite: "lax"` with `path: "/"` in development.
   - Frontend persists `nextdor-refresh-token` as a fallback. When calling `POST /auth/refresh`, it sends the fallback in `x-refresh-token` headers and JSON body alongside `credentials: "include"`.
3. **Client-Side `isJwtExpired(token)` Check**:
   - Upon page reload, `initAuth()` inspects the JWT payload `exp` timestamp client-side.
   - If the token is still valid (e.g. valid for the next 7 days), the user is **immediately hydrated as authenticated** with zero redirect flicker.
   - Network blips during background verification (`/auth/me`) do not delete the session. The session is only destroyed if the backend explicitly confirms revocation or after refresh token expiry.

---

## 🎯 8. Admin Portal Orders Counter Stability & Badge Wrapping Fixes

### 8.1 The Fluctuating Orders Counter Problem
Administrators reported that the numerical badges and statistics shown on the Orders tab (`/admin/orders`) and dashboard (`/admin`) kept unpredictably changing and jumping. 

**Root Cause Analysis:**
1. **Mutating Tab Counters via Filtered State**:
   The tab pill badges in `app/admin/orders/page.tsx` were calculating their counts dynamically against the active `orders` state:
   ```tsx
   // ❌ Flawed calculation against mutating state:
   {tab.value === "all" ? orders.length : orders.filter((o) => o.status === tab.value).length}
   ```
   When the user clicked "Processing", `loadOrders` fetched only the processing orders from the backend and called `setOrders(liveOrders)`. The `orders` state array shrank from 4 to 1. Consequently:
   - The "All" tab badge suddenly dropped from 4 to 1.
   - The "Shipped", "Delivered", and "Cancelled" tab badges dropped to 0.
   - Clicking "All" restored the counts, causing constant visual jumping on every tab switch.

2. **Phantom Mock Data Re-Injection on Zero-Result Statuses**:
   The network fetch fallback used `if (json.success && json.data.length > 0)`. When filtering by a status with zero orders in the database (e.g. `CANCELLED`), `json.data.length > 0` evaluated to `false`. The component fell back to `MOCK_ORDERS.filter(...)`, which contained 1 mock cancelled order. Thus, clicking "Cancelled" materialized a fake cancelled order that did not exist in the database!

3. **Dashboard / Orders Page Discrepancy**:
   The Admin Dashboard (`/admin`) calculated KPI cards (Monthly Orders, Shipped, Delivered) directly from static `MOCK_ORDERS`, while `/admin/orders` rendered live orders from the database, creating divergent numbers across adjacent admin portal screens.

### 8.2 The Solution: Authoritative Dataset Caching & Stable Counters
1. **Master Dataset Caching (`all_orders`)**:
   `loadOrders` in `AdminOrdersPage` fetches the complete order dataset once (`/api/v1/admin/orders?limit=100`) and caches it in `adminOrdersCache` under `"all_orders"`.
2. **Stable Memoized Status Counters**:
   ```tsx
   const statusCounts = useMemo(() => ({
     all: orders.length,
     processing: orders.filter((o) => o.status === "processing" || o.status === "pending" || o.status === "confirmed").length,
     shipped: orders.filter((o) => o.status === "shipped").length,
     delivered: orders.filter((o) => o.status === "delivered").length,
     cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "refunded").length,
   }), [orders]);
   ```
   The tab pill badges always read from `statusCounts[tab.value]`, guaranteeing that counts remain **100% immutable and accurate** when navigating between tabs.
3. **Zero-Latency In-Memory Filtering**:
   Tab clicks filter the authoritative `orders` array in memory instantly. No network roundtrip occurs, eliminating loading spinners and layout shift during tab navigation.
4. **Synchronized Dashboard Metrics**:
   `AdminDashboardPage` (`app/admin/page.tsx`) now hydrates from `adminOrdersCache.getEntry("all_orders")` and updates seamlessly via `adminOrdersCache.fetchDedupe("all_orders", ...)`. All statistics across the operations console match the orders management screen.
5. **Backend Database Precision**:
   Updated `OrderRepository.findAll` in `order.repository.ts` to include `unitPrice: true` in items selection, preventing `NaN` subtotal calculations in the UI.

---

### 8.3 "In Stock" Badge Text Wrapping Prevention
In narrow table columns, mobile screens, or flex containers, stock indicator badges ("In Stock", "Out of Stock", "Low Stock") were wrapping text onto multiple lines (e.g. "In\nStock").

**Changes Applied Across Frontend:**
- **`app/admin/products/page.tsx`**: Added `whitespace-nowrap` to `stockConfig` classes and `inline-flex items-center shrink-0 whitespace-nowrap` to table and mobile product card badge spans.
- **`app/store/[slug]/page.tsx`**: Added `inline-flex items-center shrink-0 whitespace-nowrap` to storefront product card stock badges.
- **`app/product/[slug]/page.tsx`**: Added `whitespace-nowrap` to product detail availability indicators (`In Stock` / `Out of Stock`).
- **`app/vendor/dashboard/page.tsx`**: Added `inline-flex items-center shrink-0 whitespace-nowrap` to merchant store inventory stock status pills.
- **`components/product/AddToCartButton.tsx`**: Added `whitespace-nowrap` to button styling to guarantee text remains on a single line regardless of container width.


