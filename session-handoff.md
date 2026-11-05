# Session Handoff

## Current Objective
- **Goal:** Repositorio con `feat-000..005` completadas y verificadas al `100%` (`WIP = 0`), con segregación estricta entre ventas cobradas en mostrador y pestaña única conmutable `⏳ Con Saldo` en **Nueva Venta**.
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..005` en `done`; `Overall: 100/100`; `265/265` pruebas unitarias PASS; `npm run test:voice` `53/53 PASS`)
- **Branch / commit:** `main` (árbol limpio tras commit atómico local de `feat-005`; `0` `git push` ejecutados)

## Completed This Session
- [x] Ejecutado `Startup Workflow` completo de `AGENTS.md` (`pwd`, lectura íntegra de `AGENTS.md`, `progress.md`, `session-handoff.md`, `sprint-contract.md`, `feature_list.json`, `git log -5` y `bash ./init.sh` en `CLEAN STATE`) y consultada la guía `accessibility` de `modern-web-guidance`.
- [x] Eliminada la pestaña `"Todas"` en `src/components/RecentSalesList.jsx`, dejando únicamente la pestaña conmutable `"⏳ Con Saldo"` (`aria-pressed`, `min-h-[44px]`) y asegurando mediante `src/utils/counterSalesFilter.js` que el listado por defecto de mostrador muestre exclusivamente las ventas registradas y cobradas al momento por ese vendedor (sin ninguna orden con saldo pendiente mezclada).
- [x] Enriquecidos `server/services/sales/saleKpiService.js`, `server/services/sales/remoteSaleService.js` y `src/components/sales/RecentSaleRow.jsx` para que, cuando un vendedor cobra el saldo restante de un pedido en el punto de venta, la orden salga de `"⏳ Con Saldo"` y pase al listado por defecto de mostrador por el valor exacto del saldo cobrado (`Saldo cobrado: Q ...`).
- [x] Agregada y registrada la suite `tests/sales/counter-sales-pending-balance-segregation.test.js` (`12/12 PASS`), verificando `npm run harness:check` (`HARNESS_PASS`, `265/265` pruebas unitarias, `vite build` `1567` módulos), `npm run test:voice` (`53/53 PASS`) y `bash ./init.sh` (`CLEAN STATE`, `100/100`).

## Verification Evidence

| Check | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| Suite Mostrador vs Con Saldo (`feat-005`) | `node --test tests/sales/counter-sales-pending-balance-segregation.test.js` | `PASS (12/12)` | `5` suites, `0` fallos (`144.11ms`); aislamiento por vendedor, pestaña única `⏳ Con Saldo` y cobro por monto de saldo restante |
| Vigilante Arquitectónico Tolerancia Cero (Puerta 1) | `bash scripts/check-architecture.sh` | `PASS (Exit code 0)` | `0` violaciones y `0` excepciones en `src/` (`utils -> components`) y `server/` |
| Validación de los 5 Subsistemas y DAG (Puerta 2) | `node scripts/validate-harness.mjs --min-score 100` | `PASS (100/100)` | `25/25` checks PASS (`feat-000..005` en `done`, `WIP = 0`, todos los `required_files` en disco) |
| Compuerta Unificada Deko Labs | `npm run harness:check` | `HARNESS_PASS (30.35s)` | `191` archivos sin secretos, `269` JS sintaxis OK, `13/13` Zero-Trust, `265/265` unit tests (`109` suites) y `vite build` (`1567` módulos) |
| Suite Completa de Voz y VAD | `npm run test:voice` | `PASS (53/53)` | `12` suites en verde (`309.26ms`) |

## Files Changed
- `src/utils/counterSalesFilter.js` — Funciones puras `isPhysicalStandEvent`, `partitionEventSalesForPos` y `resolveStandSaleDisplay`
- `src/components/RecentSalesList.jsx` — Eliminado botón `"Todas"`, botón único conmutable `"⏳ Con Saldo"` con `aria-pressed` y transición post-cobro al listado de mostrador
- `src/components/sales/RecentSaleRow.jsx` — Renderizado de `Saldo cobrado: Q ...`, pagos `[SALDO]` y línea informativa de anticipo previo de redes
- `server/services/sales/saleKpiService.js` — Filtro `balanceDue <= 0` en liquidados de stand y enriquecimiento de `standCollectedAmount` y `balanceCollectedById` vía `AuditLog`
- `server/services/sales/remoteSaleService.js` — Sello `[SALDO]` en liquidación total de stand y metadatos de cobro en retorno de `registerBalancePayment`
- `tests/sales/counter-sales-pending-balance-segregation.test.js` y `package.json` — Suite de 12 pruebas unitarias integrada en `test:unit`
- `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` — Estado `done` (`WIP = 0`) y acta de entrega actualizada

## Decisions Made
- Resolver la atribución del vendedor cobrador de saldo y el monto exacto cobrado en stand a partir de `SalePayment.reference` (`[SALDO]`) y `AuditLog` (`SALDO_VENTA_COBRADO` / respaldo en `sale.notes`), sin tocar `prisma/schema.prisma` ni alterar la atribución comercial original (`sale.sellerId`) que usa `commissionService.js` para las comisiones del vendedor de redes.

## Blockers / Risks
- Ninguno activo (`0` lectura de `.env`; `0` procesos locales huérfanos; `0` `git push` o `npm run deploy` ejecutados).

## Next Session Startup
1. Confirmar `pwd` y revisar `git log --oneline -5`.
2. Leer `AGENTS.md`, `progress.md`, `session-handoff.md`, `sprint-contract.md` y `feature_list.json`.
3. Ejecutar `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` antes de realizar cualquier acción.

## Recommended Next Step
- Validar visualmente el flujo en **Nueva Venta** con el usuario o proceder al despliegue cuando el usuario lo autorice explícitamente.
