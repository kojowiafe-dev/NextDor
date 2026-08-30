# NextDor — Codebase Analysis

## What Is This Project?

**NextDor** (`nextdor.online`) is a Ghanaian e-commerce storefront — a Next.js frontend that sits on top of a **WooCommerce/WordPress backend** (already live at `nextdor.online`). Think of it as a modern, custom-built storefront replacing the default WooCommerce theme, but still pulling all product/category data from WooCommerce via its Store API.

The tagline is: *"Style, Convenience, and Comfort — Nextdor to You"*, and it sells electronics, laptops, beauty products, bakery items, and more — delivered across Ghana. Prices are in **GHS (Ghanaian Cedis)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.3.3** (App Router, React 19) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** |
| Icons | **Lucide React** |
| Font | **Outfit** (Google Fonts) |
| Backend/Data | **WooCommerce Store API** (REST, no auth needed) |
| Cart State | **React Context + localStorage** |
| HTML Sanitization | `isomorphic-dompurify` |
| Utilities | `clsx`, `tailwind-merge` |

---

## Architecture Overview

```
nextdor.online (WordPress + WooCommerce)
        ↓  WC Store API v1 (public REST)
next-frontend (Next.js App Router)
  ├── lib/woocommerce/  ← Raw API client + WC types
  ├── lib/catalog/      ← Domain model + business logic
  ├── components/       ← UI components
  ├── context/          ← Cart state (client-side)
  └── app/              ← Pages (App Router)
```

The data layer is cleanly two-tiered:
1. **`lib/woocommerce/`** — raw WC API types and HTTP client, with fallback URLs and 5-min ISR cache
2. **`lib/catalog/`** — normalizes WC data into clean domain types (`Product`, `Category`) and exposes product-fetching functions

---

## Pages / Routes

| Route | Status | Description |
|---|---|---|
| `/` | ✅ Done | Homepage: Hero banner, category tiles, Deal of the Day, Featured & Popular product rows |
| `/shop` | ✅ Done | Full product catalog with sort (popularity, date, price, rating) + category filter pills + pagination |
| `/product/[slug]` | ✅ Done | Product detail: image gallery, price, stock status, Add to Cart, description (sanitized HTML), related products |
| `/category/[slug]` | ✅ Done | Category-filtered product grid with breadcrumbs |
| `/search` | ✅ Done | Search results page driven by `?q=` query param |
| `/cart` | ✅ Done (partial) | Cart page with qty controls, remove, order summary — **Checkout button is disabled ("Coming Soon")** |
| `/account` | ⚠️ Stub | Placeholder page — sign in/account features not yet built |

---

## Component Breakdown

### Layout Components (`components/layout/`)
- **`StoreLayout`** — async server component; fetches categories, wraps all pages in `CartProvider` + `Header` + `CategoryNav` + `Footer`
- **`Header`** — logo, delivery location (Ghana), search bar, account link, cart icon with live item count badge
- **`CategoryNav`** — horizontal scrollable category navigation bar
- **`MobileNav`** — hamburger menu for mobile
- **`SearchBar`** — form that navigates to `/search?q=...`
- **`Footer`** — links for Shop, Help, Account sections + branding

### Home Components (`components/home/`)
- **`HeroCarousel`** — hero banner showing the best "Deal of the Day" discount percentage with CTA buttons
- **`CategoryTiles`** — top-6 categories as clickable tiles with letter avatars
- **`ProductRow`** — horizontal scrollable row of product cards with a "View All" link

### Product Components (`components/product/`)
- **`ProductCard`** — card with image, name, short description, star rating, price, sale badge
- **`ProductGrid`** — responsive grid (2 → 4 columns) of `ProductCard`s
- **`ProductGallery`** — image gallery for the product detail page
- **`PriceDisplay`** — handles sale pricing (strikethrough original price, red sale price, discount % badge)
- **`AddToCartButton`** — client component; adds product to cart context or shows "Out of Stock"

---

## Data / Catalog Layer

### Cart (`context/CartContext.tsx`)
- Client-side only, persisted to **localStorage** (`nextdor-cart`)
- Supports: `addItem`, `removeItem`, `updateQty`, `clearCart`
- Exposes: `items`, `itemCount`, `subtotal`
- No backend cart sync — purely frontend for now

### Catalog Functions (`lib/catalog/index.ts`)
| Function | What it does |
|---|---|
| `getProducts(options)` | Paginated product list with sort/search/category filter |
| `getAllProducts(options)` | Fetches up to 100 products (no pagination) |
| `getProductBySlug(slug)` | Finds a product by slug |
| `getProductById(id)` | Fetches a single product by numeric ID |
| `getCategories()` | Top-level categories only, sorted by count, excludes "uncategorized" |
| `getCategoryBySlug(slug)` | Single category lookup |
| `getRelatedProducts(id, limit)` | Related products for PDP |
| `getDealOfTheDay()` | On-sale product with the highest discount % |
| `getFeaturedProducts(limit)` | Latest products by date |
| `getPopularProducts(limit)` | Products sorted by popularity |

### WooCommerce Client (`lib/woocommerce/client.ts`)
- Uses the **public WC Store API v1** (no auth required)
- Fallback URL chain: env var → `nextdor.online` → `www.nextdor.online`
- **5-minute ISR revalidation** (`next: { revalidate: 300 }`) for caching
- Filters out internal/non-purchasable products (e.g. `reverse-withdrawal-payment`)

---

## What's Incomplete / Missing

> [!WARNING]
> These are significant gaps for a production client site:

1. **Checkout flow** — The cart "Checkout" button is explicitly disabled with "Coming Soon". No payment integration (e.g. Paystack, which is common in Ghana).
2. **User accounts / auth** — `/account` is a stub. No sign-in, order history, or saved addresses.
3. **Backend** — `next-backend/` directory exists but is **completely empty**. The docker-compose file is also empty. A custom backend was likely planned but not started.
4. **Order tracking** — Footer links to "Track Order" go to `#` (no-op).
5. **Customer service / returns pages** — Footer links are all `#`.
6. **WooCommerce checkout redirect** — There's no WooCommerce checkout redirect as a fallback either.
7. **No image for Hero** — The `HeroCarousel` is a text-only banner (no product image shown alongside it).
8. **Category tiles use letter avatars** — No actual category images are fetched/displayed (WooCommerce categories may have images, but they aren't used).
9. **Pagination bug** — The `getProducts` function calculates `totalPages` based on the filtered slice length, not the WC API's `X-WP-TotalPages` header — this will be incorrect for large catalogs.
10. **`packages/shared/`** — Exists but appears to be a monorepo package placeholder (not explored in depth, likely empty or scaffolding).

---

## Branding / Design System

- **Color palette** (Amazon-inspired dark theme):
  - Dark navy: `#131921` (header/footer bg)
  - Slate: `#232f3e`, `#37475a`
  - Amber: `#ff9900` (primary CTA / accents)
  - Gold: `#febd69`
  - Page background: `#eaeded` (light gray)
- **Font**: Outfit (Google Fonts)
- **Design inspiration**: Clearly Amazon-like UI/UX patterns (header structure, cart badge, product card layout, color scheme)
