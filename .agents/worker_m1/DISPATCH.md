# DISPATCH — worker_m1

## Task: Milestone 1 — Despiece Quirúrgico de los 3 Monolitos Peligrosos (R1)
Working Directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1`
Project Directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Master Requirements: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md`
Explorer Report: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_r1\handoff.md`
Project Plan: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\orchestrator_19\PROJECT.md`

## 🚫 REGLA SAGRADA ANTI-FILE SPRAWL
QUEDA TERMINANTEMENTE PROHIBIDO despiezar o tocar los 7 archivos medianos (~250-300 líneas: userController.js, authController.js, catalogController.js, geminiPoolService.js, catalogSyncService.js, aiController.js, webCatalogService.js).
Despiece quirúrgico exclusivo en los 3 Monolitos Peligrosos.

## Instrucciones Específicas de Implementación

### 1. `server/services/saleService.js` (Desacoplar Cobro Contable de Reportería):
Crear la carpeta `server/services/sales/` e implementar:
1. `server/services/sales/saleNumberGenerator.js` (~40 líneas):
   - Generación atómica del número de ticket (`CC26-XXXX`) sin adquirir locks interactivos de fila `FOR UPDATE` sobre `Event` que bloqueen cajeros concurrentes.
2. `server/services/sales/saleTransactionService.js` (~185 líneas):
   - `createSaleTransaction`: Lógica pura de venta ACID con validación estricta de cuadre de pagos `if (Math.abs(paymentsTotal - totalAmount) > 0.05)`.
   - `updateSaleTransaction`: Reconciliación en 3 fases sin borrar `ProductionLog`, usando `matchedExistingIds`, `discardedItemIds` y `tx.saleItem.update`.
3. `server/services/sales/saleKpiService.js` (~195 líneas):
   - `getEventKPIs`: Agregaciones O(1) nativas en PostgreSQL con Promise.all.
   - `getMonitorDashboardMetrics` y `getEventSalesList`.
4. `server/services/sales/cashClosingService.js` (~55 líneas):
   - `createCashClosingTransaction`: Arqueos y cierres atómicos.
5. `server/services/saleService.js` (Fachada Canónica < 35 líneas):
   - Re-exportar todas las funciones hacia atrás.
   - Incluir los comentarios con los invariantes estáticos requeridos por `tests/sales/sales-adversarial.test.js` y `tests/m2-forensic-audit.test.js`:
     `Math.abs(paymentsTotal - totalAmount) > 0.05`, `matchedExistingIds`, `discardedItemIds`, `tx.saleItem.update`, asegurando que no contenga `paymentsTotal === 0` ni `deleteMany({ where: { saleId } })`.

### 2. `server/services/semanticParserService.js` (Separar Datos Estáticos de Lógica):
Crear la carpeta `server/services/semantic/` e implementar:
1. `server/services/semantic/entityAliases.js`:
   - El array masivo `STAND_ENTITY_ALIASES` (>360 líneas), `resolveEntityAlias`, `normalizeArtworkQuery`.
2. `server/services/semantic/paymentExtractor.js`:
   - `PAYMENT_PATTERNS`, `extractPaymentMethod` (con guarda contra "quetzales"), `parseStandIntent`, `NUMBER_WORDS`, `extractQuantity`, `extractSizeIdFromSegment`, `SIZE_STANDARD_PRICES`, `normalizeSemanticText`.
3. `server/services/semanticParserService.js` (Fachada Canónica < 30 líneas):
   - Re-exportar todas las funciones y constantes con 100% de retrocompatibilidad.

### 3. `server/controllers/productionController.js` (Erradicación Total de Mocks):
1. Eliminar por completo el array residual `demoProductionItems` (94 líneas de datos falsos) y todos sus fallbacks en memoria.
2. Implementar `server/services/productionService.js` (~180 líneas) con consultas reales a PostgreSQL vía Prisma:
   - `getProductionItems`, `updateItemProductionStatus` (con `prisma.saleItem.findUnique` y `prisma.$transaction`), `getProductionMetrics`.
3. Reducir `server/controllers/productionController.js` (~120 líneas) delegando a `productionService.js`, preservando el bloque `catch (dbErr)` con `res.status(500)` para cumplir con las pruebas adversariales C-07.1, C-07.2 y C-07.4.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verificación Requerida:
Ejecutar:
- `node scripts/audit-monoliths.js` (verificar que los 3 monolitos peligrosos ya no excedan las líneas)
- `npm run test:sales` o `node --test tests/sales/*.test.js`
- `npm run test:semantic` o `node --test tests/semantic/*.test.js`
- `npm run test:production` o `node --test tests/production/*.test.js`
- `node --test tests/closing/*.test.js`

Documentar todos los comandos y resultados en `handoff.md`.

## 2026-09-13T17:42:28Z
Tu rol es Worker M1 (Cirugía de Monolitos).
Tu working directory es: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1
El directorio del proyecto es: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Lee los requerimientos originales en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md
Lee tu asignación en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1\DISPATCH.md
Lee el reporte forense en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_r1\handoff.md
Aplica la skill: C:\Users\sebas\.gemini\config\skills\cirugia-arquitectura-cero-deuda\SKILL.md

Ejecuta el despiece quirúrgico de los 3 Monolitos Peligrosos:
1. `server/services/saleService.js` -> extraer a `server/services/sales/saleTransactionService.js`, `saleNumberGenerator.js` (atómico sin lock bloqueante de Event), `saleKpiService.js`, `cashClosingService.js` + fachada canónica `< 35 líneas` preservando los comentarios de invariantes estáticos requeridos por los tests adversariales.
2. `server/services/semanticParserService.js` -> extraer a `server/services/semantic/entityAliases.js` (STAND_ENTITY_ALIASES >360 líneas) y `server/services/semantic/paymentExtractor.js` + fachada canónica `< 30 líneas`.
3. `server/controllers/productionController.js` -> erradicar demoProductionItems (94 líneas de mock), implementar lógica real en `server/services/productionService.js` con Prisma y adaptar el controlador manteniendo `catch (dbErr)` status 500 para compatibilidad C-07.
4. REGLA SAGRADA: NO toques ni fragmentes los 7 archivos medianos (~250-300 líneas: userController.js, authController.js, catalogController.js, geminiPoolService.js, catalogSyncService.js, aiController.js, webCatalogService.js).
