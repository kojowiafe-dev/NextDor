# NextDor — Enterprise Multi-Vendor Marketplace

NextDor is an enterprise-grade, high-performance Ghanaian E-Commerce and Multi-Vendor Marketplace built with Next.js 14 (App Router), Fastify, TypeScript, Prisma ORM, and Cloud PostgreSQL (Neon).

---

## 📚 Essential Documentation

| Document | Purpose |
| :--- | :--- |
| 🗺️ **[Master Project Overview & Navigation Map](file:///c:/Users/User/OneDrive/Desktop/NextDor/PROJECT_OVERVIEW.md)** | **Start here!** Full sitemap, "If I want this, where do I go?" cheat sheet, frontend/backend routing index, and environment setup. |
| 🏛️ **[Multi-Vendor OOD Architecture](file:///c:/Users/User/OneDrive/Desktop/NextDor/MULTI_VENDOR_OOD_ARCHITECTURE.md)** | Comprehensive function-by-function, line-by-line architectural breakdown, SOLID principles, and Optimistic Concurrency Control (OCC). |
| ⚙️ **[Backend Architecture & Database Design](file:///c:/Users/User/OneDrive/Desktop/NextDor/BACKEND_ARCHITECTURE.md)** | Complete database ERD, 14 models, security specifications, and RFC 7240 async sync mechanics. |

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
- Public Vendor Storefront: `http://localhost:3000/store/sweet-bakes`
- Vendor Portal Dashboard: `http://localhost:3000/vendor/dashboard`
- Admin Sync Dashboard: `http://localhost:3000/admin/products`

---

## 🛠️ Troubleshooting

If port 4000 is blocked (`EADDRINUSE: address already in use 0.0.0.0:4000`), kill the orphan process in PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

For complete runbooks on Prisma engine DLL locks (`EPERM`) and IDE TypeScript cache resets, see [Section 7 of the Project Overview](file:///c:/Users/User/OneDrive/Desktop/NextDor/PROJECT_OVERVIEW.md#-7-troubleshooting--operational-runbook).