# Project: Deko EventSales — Production Architecture & Hardening

## Architecture
Deko EventSales is a dedicated POS and Sales Intelligence application for Deco Vintage Guate and Deko Labs. It operates with strict separation of concerns, complete database isolation, and cloud-native statelessness:
- **Frontend**: Single Page Application built with React 19, Vite, Tailwind CSS, Lucide icons, Canvas Confetti.
- **Backend**: Node.js 22 with Express, Prisma ORM, JSON Web Tokens (JWT), Google GenAI SDK.
- **Database**: Dedicated PostgreSQL database (`deko_eventsales_db`) completely isolated from web catalog DB (`catalog_db`), enforcing multi-tenant event sales.
- **Storage**: Stateless media storage via Google Cloud Storage (`gs://deko-eventsales-media/`), zero ephemeral disk dependency in production.
- **Containerization**: Multi-stage Docker container based on `node:22-bookworm-slim` (Debian glibc / OpenSSL 3.0.x for Prisma), orchestrated with an automated database migration/connectivity `entrypoint.sh` for Dokploy.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Dead Code Removal | Delete 7 orphan components (`AiChatAssistant.jsx`, `BatchPhotoScanner.jsx`, `QuickPosKeyboard.jsx`, `LiveMonitor.jsx`, `CatalogView.jsx`, `VoiceRecorder.jsx`, `HumanVerificationModal.jsx`). Audit all imports across `src/` to ensure zero broken references. | M1 | Survey (Explorer 1) |
| 2 | F2: Frontend Build Verification | Verify `npm run build` runs cleanly and exits with code 0 producing production bundle in `dist/`. | M1 | Survey (Explorer 1) |
| 3 | F3: API Security Hardening | In `server/middleware/authMiddleware.js`, remove `\|\| !authHeader` to enforce valid Bearer JWT in production, returning 401 Unauthorized for unauthenticated requests. | M2 | Survey (Explorer 2) |
| 4 | F4: Server Graceful Shutdown Fix | In `server/index.js:68`, fix broken import `./config/db.js` -> `./config/prisma.js` so Prisma disconnects cleanly on SIGTERM/SIGINT. | M2 | Survey (Explorer 3) |
| 5 | F5: Atomic Sales Concurrency | Add `currentSaleSequence` counter to `Event` model and update it atomically via `tx.event.update` inside transaction in `server/services/saleService.js`, eliminating `P2002` collisions. | M2 | Survey (Explorer 2) |
| 6 | F6: SQL Parameterization & Local Product Query | In `server/services/webCatalogService.js`, eliminate raw SQL string interpolation with `$queryRawUnsafe` and query local `prisma.product`. | M2 | Survey (Explorer 2) |
| 7 | F7: Git Initialization & Technical Docs | Create fortified `.gitignore` (excluding `.env*`, `node_modules/`, `dist/`, `.gemini/`, `public/uploads/*` except `.gitkeep`, keys, logs), create `public/uploads/.gitkeep`, write technical `README.md`, and run `git init` with initial semantic commit. | M3 | Survey (Explorer 1) |
| 8 | F8: GCS Bucket Provisioning | Provision bucket `gs://deko-eventsales-media/` in `us-central1` on GCP project `tienda-deco-vintage-web` with `roles/storage.objectViewer` for `allUsers` and CORS policy. | M4 | Survey (Explorer 3) |
| 9 | F9: GCS Storage Service Refactor | Refactor `server/services/gcsStorageService.js` to eliminate silent fallback to ephemeral `public/uploads` in production, update default bucket to `deko-eventsales-media`, and fail fast on errors. | M4 | Survey (Explorer 3) |
| 10 | F10: Strict Database Isolation | Update `.env` and configuration to connect exclusively to dedicated `deko_eventsales_db`, eradicating cross-database coupling with `catalog_db?schema=event_sales`. | M5 | Survey (Explorer 2) |
| 11 | F11: Decoupled Catalog Sync Service | Implement `server/services/catalogSyncService.js` consuming public API `GET /api/catalog/posters` and upserting into local `Product` table with `sizes` and `tags`. | M5 | Survey (Explorer 2) |
| 12 | F12: Docker Multi-Stage Containerization | Rebuild `Dockerfile` using 3-stage build with `node:22-bookworm-slim`, removing missing `/app/public` copy, and create strict `.dockerignore`. | M6 | Survey (Explorer 3) |
| 13 | F13: Docker Entrypoint Automation | Create `entrypoint.sh` with PostgreSQL connectivity retry loop, `npx prisma db push --skip-generate`, Unix LF encoding, and `exec "$@"`. | M6 | Survey (Explorer 3) |
| 14 | F14: Health Check & Observability | Enrich `GET /health` in `server/index.js` to perform a live database ping (`prisma.$queryRaw\`SELECT 1\``) returning 200 OK or 503 Service Unavailable. | M6 | Survey (Explorer 3) |
| 15 | F15: E2E Verification & Live Browser Testing | Execute comprehensive automated test suite and live browser verification with Chrome DevTools MCP (interactive UI navigation, screenshots, zero console errors). | M7 | Survey & User Rules |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Saneamiento de Código Muerto & Build Frontend | F1, F2 | none | DONE |
| M2 | Blindaje de Seguridad en API & Concurrencia de Ventas | F3, F4, F5, F6 | none | DONE |
| M3 | Control de Versiones & Repositorio Git | F7 | M1 | DONE |
| M4 | Almacenamiento Permanente en Google Cloud Storage | F8, F9 | none | DONE |
| M5 | Aislamiento Estricto de Base de Datos & Sincronización | F10, F11 | M2 | DONE |
| M6 | Contenerización Docker Multi-Stage & Health Check | F12, F13, F14 | M2, M4, M5 | DONE |
| M7 | E2E Testing Suite & Verificación en Vivo DevTools | F15 | M1, M2, M3, M4, M5, M6 | DONE |

## Interface Contracts
### Web Catalog API ↔ Local Catalog Sync Service
- Endpoint: `GET https://decovintageguate.com/api/catalog/posters?take=500` (or `https://decovintage.online/api/catalog/posters?take=500`)
- Response Schema:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "string (uuid)",
        "titulo": "string",
        "categoria": "string",
        "imageUrl": "string (url)",
        "thumbUrl": "string (url)",
        "precioMinimo": "number",
        "tags": ["string"],
        "sizes": [
          { "sizeId": "string", "nombre": "string", "dimensiones": "string", "precio": "number" }
        ]
      }
    ],
    "count": "number"
  }
  ```
- Local Upsert Target: `prisma.product` with `sku: "WEB-" + id`, `name: titulo`, `category: categoria`, `basePrice: precioMinimo`, `imageUrl`, `sizes (Json)`, `tags (String[])`.

### GCS Storage Service Contract
- Function: `uploadBufferToStorage(buffer, originalname, folder)`
- Returns: `{ success: true, url: "https://storage.googleapis.com/deko-eventsales-media/...", filename: "..." }`
- Error handling: In production, rejects with explicit Error if GCS upload fails. Zero local disk writes.

### Sale Number Generation Contract
- Function: `generateSaleNumber(eventId)` or atomic transaction block inside `createSaleTransaction`
- Implementation: `tx.event.update({ where: { id: eventId }, data: { currentSaleSequence: { increment: 1 } }, select: { name: true, currentSaleSequence: true } })`
- Returns: `${prefix}-${String(sequence).padStart(4, '0')}` (guaranteed unique per event).

## Code Layout
- `src/`: React frontend source files
  - `components/`: Active UI components (`UnifiedAiChat.jsx`, `FastManualSaleForm.jsx`, `MonitorDashboardView.jsx`, `RecentSalesList.jsx`, `EventsManagementView.jsx`, `CashClosingView.jsx`, `Header.jsx`, `DonutChart.jsx`, `EditSaleModal.jsx`). Dead components eradicated.
- `server/`: Express backend
  - `config/`: Configuration modules (`env.js`, `prisma.js`, `gcs.js`, `gemini.js`).
  - `middleware/`: Middleware (`authMiddleware.js`).
  - `routes/`: Express routers (`apiRoutes.js`).
  - `services/`: Business logic services (`saleService.js`, `gcsStorageService.js`, `webCatalogService.js`, `catalogSyncService.js`, `geminiService.js`, `cashClosingService.js`).
- `prisma/`: Database schema (`schema.prisma`) and migrations.
- `public/`: Static assets (`public/uploads/.gitkeep`).
- `Dockerfile`: Production multi-stage Docker build.
- `entrypoint.sh`: Container bootstrap script.
- `.dockerignore`: Container ignore rules.
- `.gitignore`: Repository ignore rules.
- `README.md`: Technical system documentation.
