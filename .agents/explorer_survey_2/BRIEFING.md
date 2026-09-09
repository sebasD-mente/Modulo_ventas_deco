# BRIEFING — 2026-09-09T14:27:15Z

## Mission
Investigate API Security & Auth Middleware, Sales Concurrency & Number Generation, Raw SQL Queries, and Database Isolation & Decoupled Sync for Deko EventSales.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2
- Original parent: 40958512-4854-45d9-bf41-45feacb902c8
- Milestone: survey_phase_2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Strict project isolation (aislamiento-estricto-proyectos)
- Architecture zero debt protocol (cirugia-arquitectura-cero-deuda)
- Zero assumptions, verified evidence chains

## Current Parent
- Conversation ID: 40958512-4854-45d9-bf41-45feacb902c8
- Updated: 2026-09-09T14:27:15Z

## Investigation State
- **Explored paths**:
  - `server/middleware/authMiddleware.js`
  - `server/routes/apiRoutes.js`
  - `server/index.js`
  - `server/config/env.js`
  - `server/services/saleService.js`
  - `server/controllers/saleController.js`
  - `prisma/schema.prisma`
  - `server/services/webCatalogService.js`
  - `server/controllers/catalogController.js`
  - `server/services/aiMultimodalService.js`
  - `.env`
  - `prisma/seed.js`
  - `src/components/FastManualSaleForm.jsx`
  - `Web Deco Vintage Proyect/routes/catalogRoutes.js`
  - `Web Deco Vintage Proyect/services/catalogService.js`
- **Key findings**:
  1. `authMiddleware.js` line 21 contains `if (ENV.NODE_ENV === 'development' || !authHeader)`. In production, requests lacking an `Authorization` header satisfy `!authHeader === true`, granting full access to all 15 protected routes as `defaultUser` (`ENCARGADO_STAND`).
  2. `saleService.js` lines 6-19 generates sale numbers using `prisma.sale.count({ where: { eventId } })` outside transactional locks. Concurrent sales simultaneously compute identical numbers, triggering PostgreSQL `unique_violation` (`P2002`) on `[eventId, saleNumber]`. Recommended fix: Row-level lock via `tx.event.update` with atomic `increment: 1` on a sequence column in `Event`.
  3. `webCatalogService.js` line 57 interpolates comma-separated IDs into a raw SQL string in `$queryRawUnsafe`. No other services use raw SQL. Moreover, it queries `public.posters` which belongs to `catalog_db`.
  4. `.env` has `DATABASE_URL` pointing to `catalog_db?schema=event_sales`, directly violating `aislamiento-estricto-proyectos`. Must use dedicated DB `deko_eventsales_db`.
  5. `catalogSyncService.js` must be created to fetch public API `GET /api/catalog/posters` from `https://decovintageguate.com` and populate local `Product` table in `deko_eventsales_db`, enabling `webCatalogService.js` to query local Prisma models with zero raw SQL and full offline resilience.
- **Unexplored areas**: None within the assigned survey scope.

## Key Decisions Made
- Formulated atomic concurrency strategy using row-level locking on `Event` model (`currentSaleSequence` with Prisma `increment`).
- Formulated local catalog sync and replica architecture mapping web posters into local `Product` table.

## Artifact Index
- handoff.md — Complete 5-component handoff report
- progress.md — Liveness heartbeat
- DISPATCH.md — Task history
