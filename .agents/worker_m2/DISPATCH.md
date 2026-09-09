## 2026-09-09T14:34:27Z
You are the Worker for Milestone M2 (API Security, Sales Concurrency & Graceful Shutdown).
Your working directory is: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m2`
The project workspace root is: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas`
The original user request is at: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md` (MANDATORY: Read first).
Project Master Scope: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/PROJECT.md`
Survey evidence: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2/handoff.md`
Domain skill: `C:\Users\sebas\.gemini\config\skills\cirugia-arquitectura-cero-deuda\SKILL.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
- `server/middleware/authMiddleware.js`
- `server/services/saleService.js`
- `server/services/webCatalogService.js`
- `prisma/schema.prisma`
- `server/index.js`

Tasks:
1. Fix `server/middleware/authMiddleware.js`:
   - Change line 21: replace `if (ENV.NODE_ENV === 'development' || !authHeader)` with `if (ENV.NODE_ENV === 'development')`.
   - In production (`NODE_ENV === 'production'`), ensure unauthenticated requests without a valid Bearer JWT receive HTTP 401 Unauthorized (`{"success":false,"error":"No autorizado. Se requiere inicio de sesión."}`).
2. Fix graceful shutdown in `server/index.js`:
   - Line 68: change import from `./config/db.js` to `./config/prisma.js` so Prisma disconnects cleanly without module-not-found error.
3. Sales Concurrency & Schema:
   - In `prisma/schema.prisma`, add `currentSaleSequence Int @default(0) @map("current_sale_sequence")` to the `Event` model.
   - Run `npx prisma generate` to update the Prisma Client types.
   - Refactor `server/services/saleService.js`: in `createSaleTransaction`, update the event sequence atomically inside the transaction using `tx.event.update({ where: { id: eventId }, data: { currentSaleSequence: { increment: 1 } }, select: { name: true, currentSaleSequence: true } })`. Build `saleNumber` from the incremented sequence and event prefix. Ensure `generateSaleNumber` is atomic and eliminates `P2002` collisions.
4. Parameterize SQL Queries:
   - In `server/services/webCatalogService.js`, eradicate the raw string interpolation with `$queryRawUnsafe` (`WHERE "posterId" IN (${posterIds})`). Use safe parameterization (`= ANY($1::text[])` or query local `prisma.product`).
5. Verification:
   - Write and execute a test script (`.agents/worker_m2/verify_m2.js`) to prove:
     a) Auth middleware blocks unauthenticated requests in production with 401.
     b) Sales concurrency: 10 parallel `createSaleTransaction` calls execute successfully without `P2002` errors and all receive unique sequential sale numbers.
     c) 0 occurrences of unsafe SQL string interpolation remain.
6. Deliver full report in `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m2/handoff.md`. Send a message upon completion.
