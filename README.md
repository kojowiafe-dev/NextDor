# NextDor — Enterprise Multi-Vendor Marketplace

> **"Shop More, Wait Less"** — An enterprise-grade, high-performance Ghanaian E-Commerce and Multi-Vendor Marketplace platform built with Next.js 16 (App Router + Turbopack), Fastify, TypeScript, Prisma ORM, Cloud PostgreSQL (Neon), and Cloudinary media infrastructure.

---

## 📚 Essential Documentation

| Document | Purpose |
| :--- | :--- |
| 🗺️ **[Master Project Overview & Navigation Map](./PROJECT_OVERVIEW.md)** | **Start here!** Full sitemap, "If I want this, where do I go?" cheat sheet, routing index, and environment setup. |
| 🔍 **[Codebase Analysis & System Architecture](./codebase_analysis.md)** | Full monorepo breakdown, tech stack, active routes, domain logic, and security verification. |
| 🏛️ **[Multi-Vendor OOD Architecture](./MULTI_VENDOR_OOD_ARCHITECTURE.md)** | Comprehensive function-by-function architectural breakdown, SOLID principles, Tenant Isolation, and Optimistic Concurrency Control (OCC). |
| ⚡ **[Frontend Caching & Performance Architecture](./FRONTEND_CACHING_ARCHITECTURE.md)** | Client-side SWR caching engine, in-flight request deduplication, navigation latency elimination, and audit. |
| ⚙️ **[Backend Architecture & Database Design](./BACKEND_ARCHITECTURE.md)** | Complete database ERD, 14 models, security specifications, Paystack/MoMo settlement, and RFC 7240 async sync mechanics. |
| 💻 **[Frontend Application Guide](./next-frontend/README.md)** | Next.js 16 App Router setup, portals, component design system, and Cloudinary uploads. |
| 🖥️ **[Backend API Server Guide](./next-backend/README.md)** | Fastify v5 setup, Prisma migrations, Clean Architecture modules, and API route index. |
| 📖 **[Recommended Books & Architecture Pillars](./RECOMMENDED_BOOKS_AND_ARCHITECTURE_PILLARS.md)** | Curated reading list of industry-standard textbooks on DDD, Concurrency, Distributed Systems, Multi-Tenancy, and Marketplace Economics. |

---

## 🚀 Quick Start

### 1. Backend (`next-backend`)
```bash
cd next-backend
npm install
npm run dev
```
- API Server: `http://127.0.0.1:4000`
- Interactive OpenAPI / Swagger Docs: `http://127.0.0.1:4000/docs`

### 2. Frontend (`next-frontend`)
```bash
cd next-frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`
- Customer Storefront: `http://localhost:3000/`
- Vendor Portal Dashboard: `http://localhost:3000/vendor/dashboard`
- Admin Management Portal: `http://localhost:3000/admin`
- Interactive Cloudinary Image Upload API: `http://localhost:3000/api/upload`

---

## 🌟 Core System Pillars

1. **Marketplace Order Partitioning**: Automated split of multi-vendor checkouts into distinct `VendorOrder` records with isolated tenant visibility.
2. **Deterministic Commission & Payouts**: 90% merchant / 10% platform split calculated with Martin Fowler's `Money` Value Object (pesewas/minor units) to prevent penny rounding leaks.
3. **Multi-Tenant Security & OCC**: Hardened tenant isolation (`WHERE id = productId AND vendorId = currentVendorId`) for viewing, editing, and soft-deleting products, paired with Optimistic Concurrency Control versioning.
4. **Cloudinary Asset Storage**: High-speed, signed media pipeline with client-side drag-and-drop uploads and edge CDN delivery.
5. **Brand Consistency**: Unified Amazon/NextDor orange theme (`#ff9900` / `#f08804`) and motto *"Shop More, Wait Less"*.

---

## 🛠️ Troubleshooting

If port 4000 is blocked (`EADDRINUSE: address already in use 0.0.0.0:4000`), kill the orphan process in PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

For complete runbooks on Prisma engine DLL locks (`EPERM`) and IDE TypeScript cache resets, see [Section 7 of the Project Overview](./PROJECT_OVERVIEW.md#-7-troubleshooting--operational-runbook).