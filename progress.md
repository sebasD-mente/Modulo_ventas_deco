# Session Progress Log

## Current State

**Last Updated:** 2026-11-05 08:35
**Session ID:** sesion-008 (Ejecución y Cierre de `feat-005`: Segregación de Ventas de Mostrador vs `⏳ Con Saldo` y Contabilización por Saldo Cobrado)
**Active Feature:** Ninguna (`WIP = 0`; `feat-000..005` en `done`)
**Standard Startup Path:** `bash ./init.sh`
**Standard Verification Path:** `bash ./init.sh`

## Status

### What's Done
- [x] **Hito Base `feat-000` (`52d7c3c` — `12/12 ACEPTAR`)**: Higiene de raíz, instalación con `0 CRLF` de los 28 artefactos certificados, adaptación Brownfield y unificación de `init.sh` + `scripts/audit-harness.js`.
- [x] **Ola 1 `feat-001` (`84875f5` — `LEGACY_SERVER_ALLOWLIST 13 -> 9`, `Config: A`)**: Extraído `server/config/geminiKeyPool.js`, expuesto `getDefaultGeminiModel()` en `geminiPoolService.js` y encapsulado `isCatalogWebhookAuthorized(req)` en `liveCatalogSyncService.js`.
- [x] **Ola 2 `feat-002` (`b1bcf2f` — `LEGACY_SERVER_ALLOWLIST 9 -> 3`, `catalog: A`)**: Trasladado `listEventCashClosings` a `cashClosingService.js`, expuesto `queryCatalogProducts` en `catalogSyncService.js` (`22L`), y creados `authService.js` (`183L`) y `userService.js` (`157L`) conservando `invalidateUserAuthCache` en `userController.js`.
- [x] **Ola 3 `feat-003` (`LEGACY_SERVER_ALLOWLIST 3 -> 0`, Zero-Trust `13/13`, Checkers R5 `15a71c9f` y `9199e5d7` `12/12 ACEPTAR`)**: Extraído `orderTrackingService.js` (`189L`) re-exportado desde `saleService.js` (`19L < 35L`), creado `eventService.js` (`274L`) apoyado en `eventFinanceService.js` (`314L`), reducidos `saleController.js` (`154L <= 160L`) y `eventController.js` (`185L <= 190L`), eliminada `LEGACY_SERVER_ALLOWLIST` en `scripts/check-architecture.sh` (`0` excepciones) y certificado con **`12 / 12 ACEPTAR`** en `evaluator-rubric.md`.
- [x] **Alineación de Suites de Voz `feat-004` (`c31bec8` — `npm run test:voice` `53/53 PASS`)**: Alineadas las 3 suites históricas de voz a cohesión de dominio real y búsqueda por `tags` sin modificar `server/` ni `src/`.
- [x] **Segregación de Ventas de Mostrador vs `⏳ Con Saldo` en Nueva Venta `feat-005` (`265/265` pruebas unitarias PASS)**: Eliminada la pestaña `"Todas"` en `RecentSalesList.jsx` dejando únicamente el botón conmutable accesible `"⏳ Con Saldo"` (`aria-pressed`, `min-h-[44px]`); creado el módulo puro `src/utils/counterSalesFilter.js` (capa `utils`) para aislar por defecto únicamente las ventas cobradas en mostrador por el vendedor activo (cero órdenes con `balanceDue > 0` mezcladas) y restringir `"⏳ Con Saldo"` a entregas pendientes de ese punto de venta (`pickupEventId === eventId`); enriquecidos `saleKpiService.js` y `remoteSaleService.js` para que al cobrar el saldo restante la orden pase al listado de mostrador relacionada por el valor exacto cobrado del saldo (`Saldo cobrado: Q ...`), su método de pago `[SALDO]` y el vendedor cobrador.

### What's In Progress
- Ninguna tarea en curso (`WIP = 0`; `feat-000..005` completadas en `done`).

### What's Next
1. Revisar con el usuario si desea algún ajuste visual adicional o proceder con despliegue controlado cuando lo indique.
2. Si surgen nuevos requerimientos de negocio, registrar `feat-006` en `feature_list.json` respetando el DAG secuencial y `WIP = 1`.

## Blockers / Risks
- Ninguno activo (`0` lectura de `.env`; `0` cambios en `prisma/schema.prisma`; `0` excepciones arquitectónicas; `53/53` voz, `13/13` Zero-Trust y `265/265` pruebas unitarias en verde).

## Decisions Made
- **Extracción pura en `src/utils/counterSalesFilter.js` (Capa 1 Frontend) sin migración Prisma (`feat-005`)**:
  - Context: `RecentSalesList.jsx` mostraba por defecto todas las filas devueltas por `/api/sales/events/:eventId` (incluyendo pedidos remotos con `balanceDue > 0` para retiro en stand) y `RecentSaleRow.jsx` mostraba siempre `sale.totalAmount`, provocando confusión en los vendedores de mostrador tanto antes como después de cobrar un saldo pendiente.
  - Alternatives considered: Alterar `prisma/schema.prisma` agregando columnas nuevas a `Sale` (descartado porque `SalePayment.reference` con sello `[SALDO]` y `AuditLog` con `SALDO_VENTA_COBRADO` ya almacenan quién cobró, cuánto y cuándo sin migraciones de BD); filtrar solo en JSX dentro de `RecentSalesList.jsx` (descartado para mantener lógica pura testeable en Node ESM y respetar estrictamente las 6 capas `utils -> components`).
- **Botón conmutable único `aria-pressed` en lugar de doble pestaña `Todas` / `Con Saldo` (`feat-005`)**:
  - Context: El usuario pidió retirar la pestaña `"Todas"` y dejar únicamente `"⏳ Con Saldo"`, de modo que el estado base siempre sea el listado de ventas cobradas en mostrador y activar/desactivar `"⏳ Con Saldo"` conmute hacia los pedidos pendientes de entrega en ese punto de venta.
  - Alternatives considered: Usar `role="tab"` en un único botón aislado (descartado siguiendo `modern-web-guidance` `accessibility`, ya que un control único de filtro/alternancia sin `tablist` debe ser un `<button type="button" aria-pressed={showPendingOnly}>` nativo con objetivo táctil `min-h-[44px]`).

## Files Modified This Session
- `src/utils/counterSalesFilter.js` — Nuevo helper puro de Capa 1 (`isPhysicalStandEvent`, `partitionEventSalesForPos`, `resolveStandSaleDisplay`) para segregar ventas de mostrador vs `Con Saldo` y proyectar el monto cobrado en stand (`0 CRLF`).
- `src/components/RecentSalesList.jsx` — Retirada la pestaña `"Todas"`, conservado botón único conmutable `"⏳ Con Saldo ({pendingCount})"` (`aria-pressed`, `min-h-[44px]`), contador `Ventas de Hoy ({defaultSales.length})` y transición automática al listado de mostrador al liquidar saldo (`0 CRLF`).
- `src/components/sales/RecentSaleRow.jsx` — Presentación de `Saldo cobrado: Q <displayedAmount>`, pagos `[SALDO]` (`(Saldo)`), distintivo `✅ Saldo cobrado`, referencia `💳 Anticipo previo (Redes)` y estado `Liquidada` preservando contratos `surgery-056` y `surgery-058` (`0 CRLF`).
- `server/services/sales/saleKpiService.js` — Filtro `balanceDue: { lte: 0 }` en rama de liquidados de `getEventSalesList`, enriquecimiento `standCollectedAmount` / `standCollectedPayments` / `balanceCollectedById` desde `AuditLog` y ordenamiento por instante de cobro (`0 CRLF`).
- `server/services/sales/remoteSaleService.js` — Sello `[SALDO]` extendido también a liquidaciones al 100% en stand sobre órdenes `PENDIENTE_PAGO` y retorno inmediato de `standCollectedAmount`, `standCollectedPayments` y `balanceCollectedById` (`0 CRLF`).
- `tests/sales/counter-sales-pending-balance-segregation.test.js` y `package.json` — Nueva suite de 12 pruebas deterministas integrada en `npm run test:unit` (`0 CRLF`).
- `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` — Cierre formal de `feat-005` en `done` (`WIP = 0`) con evidencia real (`0 CRLF`).

## Verification Evidence
- [x] Suite de Segregación Mostrador vs Con Saldo (`feat-005`): `node --test tests/sales/counter-sales-pending-balance-segregation.test.js` -> `command and output verified: Exit code 0 (12/12 PASS across 5 suites in 144.11ms)`
- [x] Compuerta Unificada Deko Labs (`feat-005`): `npm run harness:check` -> `command and output verified: status HARNESS_PASS, framework STAND-IA-UNIFIED-HARNESS (30.35s: check-architecture PASS, validate-harness 100/100, audit-secrets 191 files OK, audit-syntax 269 JS files OK, verify-gemini-models PASS, zero-trust 13/13 PASS, test:unit 265/265 tests across 109 suites PASS, vite build 1567 modules PASS)`
- [x] Suite Completa de Voz y VAD: `npm run test:voice` -> `command and output verified: Exit code 0 (53/53 PASS across 12 suites in 309.26ms)`
- [x] Puertas 1-3 de cierre `CLEAN STATE` (`WIP = 0`): `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` -> `command and output verified: Exit code 0 (CLEAN STATE, Overall: 100/100, 25/25 PASS)`

## Notes for Next Session
Ejecuta `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` al abrir la próxima sesión para confirmar `CLEAN STATE` (`100/100`, `WIP = 0`, `0` excepciones arquitectónicas).
