# Project: STAND {IA} — Fase 2: Modernización Enterprise, Streaming & Rendimiento

## Architecture
STAND {IA} (Deko EventSales) es el sistema POS inteligente de alta concurrencia y producción artesanal para Deco Vintage Guate y Deko Labs. La Fase 2 eleva el sistema al estándar Enterprise:
- **Motor de IA Multimodal (@google/genai ^2.19.0)**: Function Calling nativo y fuertemente tipado con herramientas formales (`prepareSaleDraft`, `searchCatalog`, `getEventKPIs`), erradicando expresiones regulares sobre markdown. Schemas estrictos (`responseSchema`) en visión, audio y video para garantizar JSON inquebrantable.
- **Streaming Progresivo en Tiempo Real**: Server-Sent Events (SSE) en `/api/ai/chat` con `ai.models.generateContentStream`, reduciendo TTFB a <400ms con renderizado progresivo en cliente mediante `ReadableStream`.
- **Base de Datos & Rendimiento SQL (PostgreSQL / Prisma)**: Agregaciones nativas `prisma.sale.aggregate()` y `prisma.salePayment.groupBy()` en O(1) para cálculo de KPIs de evento en milisegundos, con paginación optimizada en listados de ventas y órdenes de taller.
- **Frontend Ultraligero & Code-Splitting (React 19 / Vite)**: Carga dinámica con `React.lazy()` y `<Suspense>` para vistas secundarias, complementado con `manualChunks` en Vite para aislar `vendor-react` y dependencias, reduciendo el bundle de entrada de 633 kB a <250 kB sin advertencias.
- **Saneamiento Forense Cero Deuda**: Purga total de 23 iconos huérfanos de `lucide-react`, dependencias no utilizadas (`clsx`, `tailwind-merge`), 38 líneas de CSS muerto, assets duplicados en `public/brand/`, corrección de favicon en `index.html` y eliminación de scripts residuales.
- **Infraestructura y Despliegue Inmutable**: Docker multi-stage con Debian bookworm-slim, despliegue continuo en Dokploy y verificación en vivo con Chrome DevTools MCP.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Function Calling Nativo & Schemas Estrictos | Reemplazar scraping de texto markdown por tools formales (`prepareSaleDraft`, `searchCatalog`, `getEventKPIs`) y aplicar `responseSchema` estricto en visión y voz con `@google/genai`. | M1 | Survey (Explorer 1) |
| 2 | F2: Streaming de Tokens en Tiempo Real (SSE) | Implementar endpoint `/api/ai/chat` emitiendo `text/event-stream` con `generateContentStream` y cliente `ReadableStream` en `UnifiedAiChat.jsx` para renderizado progresivo (<400ms TTFB). | M2 | Survey (Explorer 1) |
| 3 | F3: Agregaciones SQL Nativas O(1) & Paginación | En `saleService.js:getEventKPIs`, reemplazar hidratación en memoria por `prisma.sale.aggregate()` y `prisma.salePayment.groupBy()`. Añadir paginación en listados. | M3 | Survey (Explorer 2) |
| 4 | F4: Code-Splitting Frontend & Bundle <250 kB | Implementar `React.lazy()` / `<Suspense>` en `src/App.jsx` para vistas secundarias y configurar `manualChunks` en `vite.config.js` reduciendo el bundle principal a <250 kB. | M4 | Survey (Explorer 3) |
| 5 | F5: Saneamiento Forense de Código Muerto & Assets | Purgar 23 iconos huérfanos en 7 archivos, remover `"clsx"` y `"tailwind-merge"`, eliminar 38 líneas de CSS muerto, corregir favicon en `index.html`, purgar assets duplicados y scripts obsoletos. | M5 | Survey (Explorer 2) |
| 6 | F6: Verificación E2E, Despliegue Dokploy & DevTools en Vivo | Ejecutar suite de pruebas, compilar producción, sincronizar con Dokploy y verificar en vivo con Chrome DevTools MCP (captura de pantalla y prueba activa de chat). | M6 | Survey (Explorer 3) |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Function Calling Nativo y Schemas Estrictos (@google/genai) | F1 | none | DONE |
| M2 | Streaming de Tokens en Tiempo Real (SSE) | F2 | M1 | DONE |
| M3 | Agregaciones SQL Nativas O(1) y Paginación en Backend | F3 | none | DONE |
| M4 | Code-Splitting Frontend y Optimización de Bundle (<250 kB) | F4 | none | DONE |
| M5 | Saneamiento Forense de Código Muerto, Dependencias y Assets | F5 | none | DONE |
| M6 | Verificación Integral, Despliegue Dokploy y Pruebas en Vivo | F6 | M1, M2, M3, M4, M5 | IN_PROGRESS |

---

## Interface Contracts

### AI Tools Contract (@google/genai)
1. `prepareSaleDraft`
   - Parameters: `items` (array of objects: `productName`, `quantity`, `unitPrice`, `size`), `total` (number), `paymentMethod` (enum: `EFECTIVO`, `TRANSFERENCIA`, `TARJETA`), `notes` (string), `customerName` (string).
   - Execution: Emits/returns structured draft payload matching `SaleDraft` contract.
2. `searchCatalog`
   - Parameters: `query` (string), `category` (optional string).
   - Execution: Queries local catalog service and returns matched posters.
3. `getEventKPIs`
   - Parameters: `eventId` (string).
   - Execution: Invokes `saleService.getEventKPIs(eventId)` and returns aggregate metrics.

### SSE Protocol Contract (`/api/ai/chat`)
- Headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
- Events:
  - `event: token\ndata: {"text":"..."}\n\n`
  - `event: draft_sale\ndata: { ...draftObject... }\n\n`
  - `event: suggested_posters\ndata: [ ...posters... ]\n\n`
  - `event: done\ndata: {"fullText":"..."}\n\n`
  - `event: error\ndata: {"error":"..."}\n\n`
- Dual-Mode: If client does not send `Accept: text/event-stream` or `stream: true`, returns standard JSON response for backwards compatibility.

### Event KPIs SQL Contract (`saleService.js:getEventKPIs`)
- Complexity: O(1) RAM, 1 round-trip via `Promise.all`
- Queries:
  - `prisma.sale.aggregate({ where: { eventId, status: { not: 'ANULADA' } }, _sum: { totalAmount: true }, _count: { id: true } })`
  - `prisma.salePayment.groupBy({ by: ['paymentMethod'], where: { sale: { eventId, status: { not: 'ANULADA' } } }, _sum: { amount: true } })`
  - `prisma.saleItem.groupBy({ by: ['productName'], where: { sale: { eventId, status: { not: 'ANULADA' } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 })`
  - `prisma.sale.findMany({ where: { eventId }, take: 15, orderBy: { createdAt: 'desc' }, include: { seller: true, payments: true, items: true } })`

---

## Code Layout
- `src/`: React 19 Frontend
  - `components/`: `UnifiedAiChat.jsx`, `FastManualSaleForm.jsx`, `MonitorDashboardView.jsx`, `RecentSalesList.jsx`, `EventsManagementView.jsx`, `CashClosingView.jsx`, `Header.jsx`, `DonutChart.jsx`, `EditSaleModal.jsx`, `ProductionManagementView.jsx`, `UserManagementView.jsx`.
  - `App.jsx`: Root component with code-splitting via `React.lazy` and `Suspense`.
  - `index.css`: Tailwind directives and clean custom CSS.
- `server/`: Express backend
  - `controllers/`: `aiController.js`, `saleController.js`, `productionController.js`, `authController.js`.
  - `services/`: `aiMultimodalService.js`, `saleService.js`, `productionService.js`, `gcsStorageService.js`, `webCatalogService.js`, `catalogSyncService.js`.
- `public/brand/`: Clean branded media assets.
- `vite.config.js`: Vite configuration with optimized `manualChunks`.
