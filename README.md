# Deko EventSales — Production POS & Sales Intelligence Platform

> **Deco Vintage Guate & Deko Labs**  
> Enterprise-grade Event Sales POS, Multi-Modal AI Assistant, and Real-Time Analytics Platform.

---

## 1. System Overview & Business Context

**Deko EventSales** is a specialized Point of Sale (POS) and sales intelligence application engineered specifically for **Deco Vintage Guate** and **Deko Labs**. 

During high-traffic events (anime conventions, artisan fairs, pop-up design markets, and seasonal expos), thousands of customers interact with physical exhibition booths. Sales operators face distinct operational challenges:
- **Massive Concurrency**: Multiple cashiers and booth attendants processing cash, card, and bank transfer transactions simultaneously.
- **Dynamic Catalog Pricing**: Posters and merchandise sold across multiple dimensions (Small, Medium, Large, Framed) with live inventory and pricing tiers.
- **Fast-Paced Data Capture**: Cashiers need multi-modal input channels (typing, barcode/SKU scanning, live voice recordings, batch receipt photo uploads) converted directly into structured sales drafts via AI.
- **Financial Reconciliation**: Live cash drawer monitoring, shift closings (*corte de caja*), and automated payment breakdown reporting.

Deko EventSales resolves these demands with a low-latency, resilient, zero-technical-debt architecture.

---

## 2. Architecture & Technology Stack

```
                     +--------------------------------------------------+
                     |         Browser / Client (Desktop & Mobile)      |
                     |  React 18/19 SPA + Vite 5 + Tailwind CSS + Lucide |
                     +------------------------+-------------------------+
                                              |
                                              | HTTPS / REST / JWT Bearer
                                              v
                     +--------------------------------------------------+
                     |            Express 5 Application Server          |
                     |          (Node.js 22 / Debian Bookworm Slim)     |
                     +---+--------------------+--------------------+----+
                         |                    |                    |
       Prisma 6 Client   |                    | Google GenAI SDK   | @google-cloud/storage
                         v                    v                    v
          +-------------------------+  +--------------+  +--------------------+
          | Isolated PostgreSQL     |  | Gemini 2.5 / |  | Google Cloud       |
          | (deko_eventsales_db)    |  | Flash Model  |  | Storage (GCS)      |
          | Multi-Tenant Schema     |  | Multimodal AI|  | gs://deko-...      |
          +-------------------------+  +--------------+  +--------------------+
                         ^
                         | (Decoupled sync via public REST API)
                         |
          +-------------------------+
          | Deco Vintage Web Store  |
          | https://decovintage...  |
          +-------------------------+
```

### Frontend
- **Framework**: React 18 / 19 with Vite 5 for instant HMR and optimized production bundles.
- **Styling**: Tailwind CSS with Autoprefixer and PostCSS.
- **Interactivity**: Lucide React icons, Canvas Confetti for celebratory sale confirmations.
- **Component Architecture**: Modular component structure (`UnifiedAiChat`, `FastManualSaleForm`, `RecentSalesList`, `MonitorDashboardView`, `CashClosingView`, `EventsManagementView`).

### Backend
- **Runtime**: Node.js 22 LTS (ES Modules `type: "module"`).
- **Web Framework**: Express 5 with Helmet security headers, Gzip compression, and CORS middleware.
- **ORM & Data Modeling**: Prisma ORM 6 with PostgreSQL dialect.
- **Validation & Authentication**: Zod runtime schema validation, JWT Bearer tokens with strict production verification.

### Database & Storage
- **Dedicated Database**: `deko_eventsales_db` strictly isolated from the main web store database (`catalog_db`), enforcing multi-tenant event separation without shared table locking.
- **Permanent Media Storage**: Google Cloud Storage (`gs://deko-eventsales-media/` in `us-central1`). Uploaded receipts, poster artwork photos, and voice notes are stored as stateless cloud objects with public CDN URLs; zero ephemeral disk reliance in production.

---

## 3. Strict Database Isolation & Decoupled Synchronization

Adhering to the **Strict Project Isolation Protocol** (`aislamiento-estricto-proyectos`):
1. **Zero Database Cohabitation**: The event sales platform never connects directly to or shares tables with the web store database (`catalog_db`).
2. **Autonomous Catalog Sync**: The catalog synchronization service (`server/services/catalogSyncService.js`) periodically queries the web store's public API (`GET https://decovintageguate.com/api/catalog/posters?take=500`) and upserts local records into the `Product` table.
3. **Fault Tolerance**: If the external website undergoes maintenance, the POS platform continues processing offline or local sales without interruption.

---

## 4. Prerequisites & Environment Variables

### Prerequisites
- **Node.js**: v22.x LTS or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v15.x or higher (or Dockerized PostgreSQL)
- **Google Cloud Platform**: Project with GCS bucket `deko-eventsales-media` and Service Account credentials (`roles/storage.objectAdmin`)
- **Google AI Studio**: Gemini API key (supports standard keys and Authorization Keys `AQ.`)

### Environment Variables (.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Local port for Express API server |
| `NODE_ENV` | Yes | `development` | Environment mode (`development` or `production`) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/deko_eventsales_db?schema=public`) |
| `JWT_SECRET` | Yes | — | Cryptographic secret for signing JWTs (min. 32 characters) |
| `JWT_EXPIRES_IN` | No | `7d` | Expiration window for JWT sessions |
| `GEMINI_API_KEY` | Yes | — | Google AI Studio Gemini API Key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name for audio, vision, and text processing |
| `GCS_BUCKET_NAME` | Yes | `deko-eventsales-media` | Dedicated Google Cloud Storage bucket |
| `GCS_PROJECT_ID` | No | `tu-proyecto-gcp`| Google Cloud Project ID dedicado |
| `GCS_CREDENTIALS_BASE64` | Conditional | — | Base64-encoded Service Account JSON key (for container/Dokploy deployment) |
| `DEFAULT_TENANT_NAME` | No | `Deco Vintage Guate` | Default tenant identifier |
| `DEFAULT_CURRENCY` | No | `GTQ` | ISO currency code |
| `DEFAULT_CURRENCY_SYMBOL` | No | `Q` | Display currency symbol |

---

## 5. Installation & Local Development

### 1. Clone & Configure
```bash
# Clone repository
git clone <repo-url> deko-eventsales
cd deko-eventsales

# Create local environment configuration
cp .env.example .env
# Edit .env and supply your local DATABASE_URL, GEMINI_API_KEY, and JWT_SECRET
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Migration & Seeding
```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema directly to database
npm run prisma:push

# Seed initial admin user, tenant, and demo event
npm run prisma:seed
```

### 4. Running Development Servers
```bash
# Terminal 1: Backend API Server (Port 3001)
npm run server

# Terminal 2: Frontend Vite Dev Server (Port 5173 with proxy to 3001)
npm run dev
```

### 5. Production Build
```bash
# Compile and optimize frontend into dist/
npm run build

# Verify preview
npm run preview
```

---

## 6. Docker Multi-Stage Deployment & Dokploy

The application uses a high-efficiency 3-stage `Dockerfile` based on `node:22-bookworm-slim` (compatible with Debian glibc and OpenSSL 3.0.x for Prisma):

### Dockerfile Architecture
1. **Stage 1 (dependencies)**: Installs npm dependencies with clean production caching.
2. **Stage 2 (builder)**: Compiles the React/Vite frontend bundle (`npm run build`) and generates Prisma client binaries (`npx prisma generate`).
3. **Stage 3 (runner)**: Minimal Debian runtime image containing only production dependencies, compiled frontend assets in `dist/`, Prisma engines, and the Express backend.

### Container Entrypoint Automation (`entrypoint.sh`)
When the container spins up on Dokploy or Kubernetes:
1. It executes a connectivity loop against the PostgreSQL host until the database is healthy.
2. It automatically synchronizes the schema (`npx prisma db push --skip-generate`).
3. It hands off execution to the Node.js production server (`exec node server/index.js`).

### Building and Running with Docker Compose
```bash
# Build and run locally
docker-compose up --build -d

# Check container logs
docker-compose logs -f deko-eventsales

# Check health endpoint
curl http://localhost:3001/health
```

### Deploying on Dokploy
1. Create a new Application in Dokploy connected to your Git repository.
2. Select **Docker** or **Dockerfile** deployment type.
3. Configure the Environment Variables in the Dokploy dashboard (including `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GCS_CREDENTIALS_BASE64`).
4. Set the Health Check path to `/health` on port `3000`.
5. Trigger build and deploy.

---

## 7. Security & Concurrency Highlights

- **Strict Production JWT Authentication**: In production (`NODE_ENV === 'production'`), requests to protected endpoints (`/api/sales`, `/api/events`, `/api/cash-closing`, `/api/ai`) strictly require a valid Bearer JWT. No fallback or mock users are allowed.
- **Race-Condition-Free Sale Numbering**: Sale sequence numbers (`generateSaleNumber`) are incremented atomically inside a database transaction via `tx.event.update({ data: { currentSaleSequence: { increment: 1 } } })`. This prevents duplicate sale numbers (`P2002` collisions) when dozens of cashiers submit sales concurrently.
- **SQL Injection Immunization**: All database queries are executed via Prisma's typed queries or parameterized raw queries (`prisma.$queryRaw` with template literals). Unsafe string concatenations (`$queryRawUnsafe`) are eliminated.
- **Fortified Version Control**: `.gitignore` strictly protects `.env*`, service account keys (`*.pem`, `*.key`, `*credentials*.json`), `node_modules/`, and local build artifacts from repository exposure.
- **Ephemeral Storage Protection**: Local uploads directory (`public/uploads`) is tracked only via `.gitkeep` for development fallback, while all production media flows directly to Google Cloud Storage.

---

## 8. License & Ownership

Developed for **Deco Vintage Guate** and **Deko Labs**.  
All rights reserved © 2026.
