# NextDor Frontend (`next-frontend`)

> High-performance, modern e-commerce storefront, customer account center, merchant portal, and administrative control center for **NextDor** — Ghana's premier multi-vendor marketplace ("Shop More, Wait Less").

---

## ⚡ Tech Stack & Architecture

- **Framework**: [Next.js 16.3](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Language**: TypeScript 5
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom Amazon/NextDor palette (`#ff9900`, `#131921`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Typography**: [Outfit](https://fonts.google.com/specimen/Outfit) via Google Fonts (`next/font`)
- **State & Caching**: Multi-Tier SWR caching (`clientCache.ts`, `adminCache.ts`), in-flight request deduplication (`fetchDedupe`), React Context (`CartContext`, `AuthContext`)
- **Media**: Signed Cloudinary image uploads (`/api/upload`) with edge CDN optimization

---

## 🚀 Getting Started

### 1. Installation

```bash
cd next-frontend
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the `next-frontend` directory:

```env
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Cloudinary Media Configuration (for merchant product image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional WooCommerce fallback during catalog migration
NEXT_PUBLIC_WC_URL=https://nextdor.online
```

### 3. Development Server

Start the Turbopack development server:

```bash
npm run dev
```

The frontend will run at [http://localhost:3000](http://localhost:3000).

---

## 🗺️ Portal & Routing Structure

The application features 34 active routes organized into four distinct operational portals:

### 1. 🛍️ Storefront (Public & Customers)
| Route | Description |
| :--- | :--- |
| `/` | Homepage with hero discounts, category tiles, Deal of the Day, and trending products |
| `/shop` | Paginated catalog with multi-facet filters (categories, price, vendor, sort) and search |
| `/product/[slug]` | Product detail view with Cloudinary image gallery, stock badge, and seller comparison |
| `/category/[slug]` | Category-filtered product grid with breadcrumbs |
| `/search` | Global search results driven by `?q=` |
| `/cart` | Client-side cart with quantity adjustments and real-time subtotal calculation |
| `/checkout` | Order checkout with delivery options (Standard, Express, Pickup) and Paystack initiation |
| `/track-order` | Public order tracking lookup by order number (`ND-XXXXX`) or UUID |

### 2. 👤 Customer Account (`/account`)
| Route | Description |
| :--- | :--- |
| `/account` | Account dashboard with recent orders and quick shortcuts |
| `/account/orders` | Complete order history with status timeline and cancel action |
| `/account/orders/[id]` | Granular order detail with line items and delivery tracking |
| `/account/addresses` | Shipping address book (Home, Work, Other) with default address toggle |
| `/account/wishlist` | Saved items for future purchase |
| `/account/settings` | Profile information, email, and password security management |

### 3. 🏪 Merchant Portal (`/vendor`)
| Route | Description |
| :--- | :--- |
| `/vendor/register` | Public vendor application form with MoMo payout registration |
| `/vendor/dashboard` | 4-tab merchant console (Inventory, Orders & Dispatch, MoMo Escrow Payouts, Settings) |

### 4. 🛡️ Admin Management Console (`/admin`)
| Route | Description |
| :--- | :--- |
| `/admin` | Executive dashboard with platform KPIs, gross sales, vendor volume, and audit log |
| `/admin/orders` | Global marketplace order list with search and manual status overrides |
| `/admin/products` | Platform product catalog directory, price auditing, and soft delete |
| `/admin/customers` | Customer directory with spend history and order counts |
| `/admin/customers/[id]` | Individual customer profile, order breakdown, and address list |
| `/admin/analytics` | 30-day revenue charts, daily orders, category sales, and vendor performance |
| `/admin/merchants` | Merchant verification queue, KYC review, and commission rate adjustment |
| `/admin/admins` | Internal staff directory and role management |
| `/admin/settings` | Platform operational settings and escrow parameters |

---

## ⚡ Performance & Caching Engine

The frontend utilizes a custom **Multi-Tier SWR Caching System** to deliver sub-100ms page transitions without redundant API requests:

- **L1 Memory Cache**: Instant synchronous in-memory lookup for hot data.
- **L2 Storage Cache**: Persistent `localStorage` cache with TTL expiration across browser reloads.
- **In-Flight Deduplication (`fetchDedupe`)**: Guarantees that simultaneous components mounting concurrently share a single network request.
- **Immediate Invalidation**: Write operations (e.g. creating orders, updating stock, approving merchants) invalidate corresponding cache keys automatically.

For complete architectural details, see [`../FRONTEND_CACHING_ARCHITECTURE.md`](../FRONTEND_CACHING_ARCHITECTURE.md).

---

## 🔨 Building for Production

To create an optimized production build:

```bash
npm run build
```

To run the production server:

```bash
npm start
```
