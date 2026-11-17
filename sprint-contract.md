# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-013` y `feat-014` Completadas y Verificadas en `done`)
- **Tareas completadas en esta sesión (secuencialmente bajo `WIP = 1`):**
  1. `feat-013` (`done`, depende de `feat-012`) — Ciclo Contable Estricto de Jornada Diaria: 1 Cierre al Día, Corte Automático 11:59 PM, Limpieza de Nueva Venta y Traspaso Post-Cierre al Día Siguiente.
  2. `feat-014` (`done`, depende de `feat-013`) — Simplificación de Interfaz en Cierre de Caja: Retiro de Panel de Denominaciones, Retiro de Efectivo Esperado en Sistema y Cero Color Naranja.
- **Marcha de trabajo ejecutada:** `Modo Diario Ágil` (`WIP = 0` al cierre; todas las tareas `feat-000..014` en `done`).

---

## Alcance Incluido (`In-Scope`) para `feat-013`
1. **Un solo cierre por jornada diaria (`server/services/sales/cashClosingService.js`)**:
   - Eliminar la sobreescritura silenciosa (`prisma.cashClosing.update`) cuando ya existe un cierre `DIARIO` o `AUTOMATICO_MEDIANOCHE` para esa jornada (`targetDate`): salvo `idempotentReplay` exacto con la misma `idempotencyKey`, lanzar HTTP `409` (`Ya existe un cierre de caja registrado para esta jornada (${targetDate}).`).
2. **Corte automático puntual a las 11:59 PM hora Guatemala (`server/services/sales/midnightClosingService.js` y `server/index.js`)**:
   - Asegurar que a las `23:59` CST (`America/Guatemala`) —y en el barrido de recuperación posterior a medianoche— cualquier jornada con ventas abiertas sin cierre manual genere su `AUTOMATICO_MEDIANOCHE` (incluyendo ventas rezagadas heredadas del post-cierre de `D-1`).
3. **Limpieza inmediata de Nueva Venta al efectuarse un cierre (`server/services/sales/saleKpiService.js`, `src/components/RecentSalesList.jsx` y `src/App.jsx`)**:
   - En stands físicos (`isStand`), cuando se consulta la jornada activa del día (`date = todayStr` en `getEventSalesList` y `getEventKPIs`):
     - Si `todayStr` **ya tiene un `CashClosing`**, todas las ventas con `createdAt <= closingDate` pertenecen al periodo cerrado y **NO se devuelven en `"Ventas de Hoy"`** ni en el turno abierto de Nueva Venta (dejando la pantalla en `0` inmediatamente tras el cierre y archivándolas en **Eventos**).
     - Si en `D-1` hubo ventas post-cierre (`createdAt > closing_D_minus_1.closingDate`), esas ventas sí forman parte de la jornada abierta de `D` (tanto en `"Ventas de Hoy"` de `D` como en `getEventKPIs` y en el `CashClosing` de `D`).
4. **Traspaso automático de ventas post-cierre a la jornada siguiente `D + 1` (`saleUpdateService.js`, `saleKpiService.js`, `RecentSaleRow.jsx` y `EventSalesModal.jsx`)**:
   - Si en el día `D` ya existe un `CashClosing` (`closingDate`) y posteriormente entra una venta de último minuto (`sale.createdAt > dayClosing.closingDate`):
     - Su fecha de jornada contable efectiva es `D + 1` (día siguiente en `America/Guatemala`).
     - En `saleUpdateService.js`: una venta es inmutable (`403`) SOLO si su jornada contable efectiva ya es pasada (`effectiveShiftDate < todayStr`) o si **su propia jornada contable efectiva** ya tiene `CashClosing` (`createdAt <= shiftClosing.closingDate`). Por lo tanto, una venta post-cierre (`createdAt > todayClosing.closingDate`) pertenece a la jornada abierta `D + 1` y **SÍ permite editarse con normalidad** tanto esa misma noche como durante `D + 1` antes del cierre de `D + 1`.
     - En `RecentSaleRow.jsx`: habilitar el botón `Editar` para cualquier venta perteneciente a la jornada abierta actual (incluyendo ventas post-cierre de `D-1` cuando hoy es `D` sin cierre aún, y ventas post-cierre de hoy `D` que ya pertenecen a `D + 1`).
     - En `EventSalesModal.jsx`: al agrupar `groupedDays`, si `sale.createdAt > closingOfSaleDay.closingDate`, agrupar esa venta dentro de la tarjeta del día siguiente (`D + 1`) para que cuadre al centavo con el arqueo de `D + 1` sin alterar el cierre ya conciliado de `D`.
5. **Pruebas automatizadas (`tests/sales/daily-shift-closing-rollover.test.js` y `tests/adversarial/m4-closing-immutability-thumbnails.test.js`)**:
   - Cubrir: (a) bloqueo `409` al intentar segundo cierre del mismo día, (b) limpieza en `0` de `"Ventas de Hoy"` tras cerrar caja, (c) venta post-cierre editable (`200`) mientras ventas previas al cierre siguen inmutables (`403`), (d) inclusión del efectivo post-cierre en el cierre de `D + 1`, y (e) cierre automático de las `23:59` CST.

---

## Alcance Incluido (`In-Scope`) para `feat-014`
1. **Retiro del panel de denominaciones (`src/components/CashClosingView.jsx`)**:
   - Desmontar `<CashDenominationGrid ... />` y su import en `CashClosingView.jsx`.
   - Dejar siempre visible el campo `Efectivo Físico Directo (Q)` (`min-h-[44px]`).
   - **Guardarraíl de suites existentes:** NO borrar el archivo `src/components/closing/CashDenominationGrid.jsx` del disco (es inspeccionado por `tests/frontend/phase5-frontend-ergonomics-resilience.test.js`) ni retirar los exports `DENOMINATIONS`, `INITIAL_COUNTS`, `calculateDenominationsTotal` de `useCashClosing.js`. Mantener `CashClosingView.jsx` estrictamente `< 70` líneas.
2. **Retiro de `"Efectivo Esperado (Sistema):"` (`src/components/closing/CashClosingSummary.jsx` y `src/components/CashClosingView.jsx`)**:
   - Retirar la tarjeta/fila `Efectivo Esperado (Sistema):` tanto de la vista principal como del modal de confirmación en `CashClosingSummary.jsx` (y limpiar el comentario de verificación obsoleto al final de `CashClosingView.jsx`), dejando intacto `Balance / Diferencia` (`Caja cuadrada exacta` / `Sobrante en caja` / `Faltante en caja`) y el resto de componentes de la vista.
3. **Cero color naranja/ámbar (`CashClosingView.jsx` y `CashClosingSummary.jsx`)**:
   - Reemplazar `text-amber-400` por `text-white` en el input de `Gastos Caja (Q)` y en el título del modal `¿Confirmar Asiento de Cierre?`.
4. **Alineación de pruebas (`tests/closing/closing-modular.test.js` y `tests/m3-forensic-audit.test.js`)**:
   - Actualizar las aserciones estáticas que buscaban `Efectivo Esperado (Sistema):` para reflejar el diseño simplificado acordado con el usuario.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma`.
