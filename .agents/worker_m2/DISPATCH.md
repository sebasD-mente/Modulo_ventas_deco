## 2026-09-19T22:19:49Z

You are worker_m2.
Your working directory is: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2
Workspace Root: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Authoritative User Request: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md
Scope Document: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\orchestrator_36\PROJECT.md
Domain Survey Findings: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_36_2\survey_domain2.md

MANDATORY FIRST STEP: Read c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md completely, specifically the latest section under "## Follow-up — 2026-09-19T21:51:50Z". Also read survey_domain2.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
You own exclusively:
- server/validators/printSheetValidators.js
- server/services/printSheetService.js
- server/controllers/printSheetController.js
- server/routes/apiRoutes.js (mounting Domain 2 routes)

YOUR MISSION (Milestone 2 — Dominio 2: Pliegos Diarios de Taller PrintSheet):
1. Create `server/validators/printSheetValidators.js`:
   - `createPrintSheetSchema`: `material` enum (`PVC_5MM`, `MDF_5_5MM`, `VINILO_SOLO`, `MIXTO`), `notes` optional max 1000.
   - `assignItemsToSheetSchema`: `saleItemIds` array of UUIDs min 1.
   - `updateSheetStatusSchema`: `status` enum (`ABIERTO`, `EN_PRODUCCION`, `IMPRESO`, `TERMINADO`), `notes` optional max 1000.

2. Create `server/services/printSheetService.js` (Techo DOMAIN_CEILINGS: 280 líneas):
   - `generateSheetCode(tenantId, tx = prisma)`: Consecutivo diario `PLI-YYYYMMDD-01`, `PLI-YYYYMMDD-02` correlativo por día y tenant.
   - `createPrintSheet({ tenantId, userId, material, notes })`: Estado inicial `'ABIERTO'`, `createdById = userId`.
   - `assignItemsToSheet({ tenantId, sheetId, saleItemIds, userId })`:
     * Execute inside `prisma.$transaction`.
     * Verify sheet exists and status is `'ABIERTO'` or `'EN_PRODUCCION'`. If not, throw typed error.
     * Retrieve `sale_items` with their `sale`.
     * **FRENO INQUEBRANTABLE DE TALLER (Workshop Brake):**
       - If `item.sale.status === 'ANULADA'`: throw error with statusCode 422: `"El ítem '${item.description}' pertenece a una orden anulada (#${item.sale.saleNumber})."`.
       - If `item.sale.paymentStatus === 'PENDIENTE_ANTICIPO'`: throw error with statusCode 422: `"El ítem '${item.description}' está bloqueado: Orden #${item.sale.saleNumber} no cuenta con anticipo registrado"`.
       - If `!['ANTICIPO_PAGADO', 'PAGADO_TOTAL'].includes(item.sale.paymentStatus)`: throw error with statusCode 422.
     * Assign items to sheet: `printSheetId = sheetId`, `productionStatus = 'A_PRODUCCION'`, `statusChangedAt = new Date()`, `statusChangedById = userId`.
     * Register audit in `productionLog` for each item.
   - `updateSheetStatus({ tenantId, sheetId, status, userId, notes })`:
     * Execute inside `prisma.$transaction`.
     * Verify sheet exists and valid transitions.
     * **CASCADE ON IMPRESO:** When status is `'IMPRESO'`:
       - Update sheet: `status = 'IMPRESO'`, `printedAt = new Date()`, `printedById = userId`.
       - Update all items with `printSheetId === sheetId`: `productionStatus = 'IMPRESO'`, `impresoAt = new Date()`, `impresoById = userId`, `statusChangedAt = new Date()`, `statusChangedById = userId`.
       - Create `productionLog` for each item indicating transition to `'IMPRESO'`.
     * When status is `'TERMINADO'`: update sheet status to `'TERMINADO'`.
   - `getPrintSheets({ tenantId, status, material, search, page, limit })`: paginated list with items count and filters.
   - `getPrintSheetById({ tenantId, sheetId })`: returns sheet with full items and sale details.

3. Create `server/controllers/printSheetController.js` (Techo: 200 líneas):
   - `listPrintSheets`, `getPrintSheet`, `createPrintSheet`, `assignItems`, `updateStatus`.
   - Map errors properly (status 422 for workshop brake, 404 for not found, 400 for bad request).

4. Update `server/routes/apiRoutes.js` (Techo DOMAIN_CEILINGS: 350 líneas):
   - Mount routes under `requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2'])`:
     * GET /api/production/print-sheets -> listPrintSheets
     * POST /api/production/print-sheets -> validate(createPrintSheetSchema), createPrintSheet
     * GET /api/production/print-sheets/:id -> getPrintSheet
     * POST /api/production/print-sheets/:id/items -> validate(assignItemsToSheetSchema), assignItems
     * PATCH /api/production/print-sheets/:id/status -> validate(updateSheetStatusSchema), updateStatus

5. Verification:
   - Run tests:
     * npm run test:security
     * npm run audit:monoliths
     * npm run build
     * npm run harness:check
   - Document commands and outputs in your handoff.md and notify parent orchestrator via send_message.
