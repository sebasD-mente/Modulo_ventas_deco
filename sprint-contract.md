# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-005` completada en `done`)
- **Última tarea cerrada (`done`):** `feat-005` — Segregación Estricta de Ventas de Mostrador vs Con Saldo y Contabilización por Saldo Cobrado en Nueva Venta.
- **Marcha de trabajo:** `Modo Diario Ágil` (`WIP = 0`).

## Alcance Incluido (`Scope` de `feat-005`)
1. **Eliminación de la pestaña `"Todas"` y pestaña única conmutable `"⏳ Con Saldo"` (`src/components/RecentSalesList.jsx`)**:
   - Retirar el botón `"Todas (...)"` y conservar únicamente el botón conmutable (`aria-pressed`) `"⏳ Con Saldo ({pendingCount})"` (`min-h-[44px]`).
   - Cuando `"⏳ Con Saldo"` está inactivo (vista por defecto), el listado y el contador `"Ventas de Hoy (...)"` en stands físicos muestran **únicamente** las ventas realizadas y cobradas en mostrador (del vendedor activo si su rol es `VENDEDOR` sin `SUPER_ADMIN`, o del stand si es `SUPER_ADMIN`), excluyendo estrictamente cualquier venta con `balanceDue > 0`.
   - Cuando `"⏳ Con Saldo"` está activo, el listado muestra **estrictamente** las ventas con `balanceDue > 0` pendientes para entrega en ese punto de venta específico (`pickupEventId === eventId`). Al pulsar nuevamente `"⏳ Con Saldo"`, regresa al listado por defecto de mostrador.
2. **Transición al cobrar saldo restante y visualización por el monto cobrado (`server/services/sales/saleKpiService.js`, `server/services/sales/remoteSaleService.js`, `src/utils/counterSalesFilter.js`, `src/components/RecentSalesList.jsx`, `src/components/sales/RecentSaleRow.jsx`)**:
   - Enriquecer en `getEventSalesList` y `registerBalancePayment` los metadatos de liquidación en stand (`standCollectedAmount`, `standCollectedAt`, `standCollectedPayments`, `balanceCollectedById` vía `AuditLog` `SALDO_VENTA_COBRADO`), sellando también con `[SALDO]` pagos completos en stand sobre órdenes `PENDIENTE_PAGO` y ordenando cronológicamente por instante real de cobro en mostrador.
   - Al liquidar el saldo pendiente (`balanceDue === 0`), retirar la orden de `"⏳ Con Saldo"`, volver al listado por defecto de mostrador y mostrarla en `RecentSaleRow.jsx` por el **valor exacto cobrado del saldo restante** (`Saldo cobrado: Q ...`), con los badges de pago del cobro en mostrador, desglose transparente del anticipo previo de redes y hora del cobro.
3. **Pruebas deterministas de regresión (`tests/sales/counter-sales-pending-balance-segregation.test.js` + `package.json`)**:
   - Cubrir aislamiento por rol de vendedor de mostrador, exclusión total de `balanceDue > 0` en vista por defecto, pestaña única `"⏳ Con Saldo"` sin botón `"Todas"` y transición contable por el monto del saldo restante cobrado.

## Exclusiones Explícitas (`Hands off`)
- **Cero lectura o modificación de `.env`** y **cero cambios en `prisma/schema.prisma`** o migraciones SQL.
- **Cero alteración de módulos ajenos** (taller de pliegos, liquidación de comisiones 20% del vendedor de redes original `sale.sellerId`, IA/voz o Docker).
- **Cero debilitamiento de suites existentes** (`surgery-056`, `surgery-058`, `val005` ergonomía `>= 44px`, `zero-trust`).
- **Cero nuevas dependencias NPM** y **cero despliegue remoto (`git push` / `npm run deploy`)** sin autorización explícita del usuario.

## Criterios Verificables de Cierre para `feat-005`
1. `RecentSalesList.jsx` no renderiza el botón `"Todas"` y opera con la pestaña única conmutable `"⏳ Con Saldo"` (`aria-pressed`, `min-h-[44px]`).
2. En vista por defecto de mostrador jamás aparece ninguna orden con `balanceDue > 0`, y las ventas mostradas para un `VENDEDOR` de mostrador corresponden únicamente a las ventas registradas o saldos cobrados por ese vendedor en ese stand.
3. Al cobrarse el saldo restante de un pedido para entrega en el stand, pasa al listado por defecto de mostrador reflejando exactamente `standCollectedAmount` (el saldo restante cobrado por el vendedor) en lugar del `totalAmount` histórico de redes.
4. `node --test tests/sales/counter-sales-pending-balance-segregation.test.js`, `bash ./init.sh`, `bash scripts/check-architecture.sh`, `node scripts/validate-harness.mjs --min-score 100` y `npm run harness:check` pasan en verde con `0 CRLF`.
