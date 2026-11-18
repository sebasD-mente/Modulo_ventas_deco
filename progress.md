# Session Progress Log

## Current State

**Last Updated:** 2026-11-17 18:05
**Session ID:** sesion-024 (Implementación y Verificación de `feat-017`: Anticipo Libre en Ventas de Redes, Iconografía Minimalista Centrada, Etiqueta `Valor del anticipo`, Botón `Registrar Venta (abono Q 0.00)` y Pie de Página Global 2026)
**Active Feature:** Ninguna en ejecución (`WIP = 0`; `feat-000..017` en `done`)
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
- [x] **Rediseño y Enfoque Inmediato del Monitor de Ventas en Vivo `feat-006` (`265/265` pruebas unitarias PASS, build -18.65 kB)**:
  - Desmontado por completo `EventFinancialRadar` de `MonitorDashboardView.jsx` (preparando su reubicación contextual a la sección de eventos en `feat-007`).
  - Removido el selector `input[type="date"]` de la barra de control del monitor, sustituyéndolo por un indicador sutil de jornada en tiempo real con fecha actual, conservando el botón interactivo de actualización manual (`RotateCcw`, `min-h-[44px]`), el badge `"EN VIVO"` y la estampa de última sincronización.
  - Reubicado el Copiloto Gerencial & Auditoría IA (`data-testid="toggle-ai-copilot-btn"`) inmediatamente después del desglose de rendimiento por eventos (`EventsPerformanceList`), dejando una vista superior limpia y despejada para el monitoreo de ventas.
  - Suministrado el prop `selectedEventId={activeEvent?.id}` a `EventsPerformanceList.jsx` para resaltar visualmente el stand seleccionado en la lista, satisfaciendo el contrato histórico de `surgery-053`.
- [x] **Reubicación del Radar Financiero Ferial y Consolidación de Histórico de Movimientos en la Sección de Eventos `feat-007` (`265/265` pruebas unitarias PASS, `54/54` cirugías PASS, `53/53` suites de voz PASS, build PASS)**
- [x] **Detección de Cambios en Tamaños (`sizes`) en Sincronización de Catálogo `feat-008` (`3/3` pruebas nuevas PASS, `265/265` unit tests PASS)**
- [x] **Historial Mensual de Ventas en Línea, Fix React #310 y Limpieza en 0 `feat-009` (`ad51a7a`)**
- [x] **Retiro de Botón Destructivo `'Reiniciar en 0'` y Endpoint `/sales/purge-online-test-data` `feat-010` (`4/4` `online-sales-history-and-purge.test.js`, `265/265` unit tests PASS, `bash ./init.sh` `100/100`)**:
  - Eliminado el botón `'Reiniciar en 0'`, sus estados (`isConfirmingOnlineReset`, `isResettingOnline`, `onlineResetFeedback`), `handleConfirmOnlineReset` y modal de confirmación en `src/components/EventsManagementView.jsx`.
  - Eliminados `POST /api/sales/purge-online-test-data` en `server/routes/apiRoutes.js`, `purgeOnlinePosTestData` en `server/controllers/saleController.js` y `purgeOnlinePosTestDataTransaction` en `server/services/saleService.js` y `server/services/sales/salePurgeService.js`, preservando intacta la protección `403` sobre `evt-ventas-redes-online` en `purgeEventSalesTransaction`.
  - Blindado `scripts/reset-online-pos-test-data.js` de forma autocontenida para borrar **exclusivamente** registros con `eventId: 'evt-ventas-redes-online'` (cero borrado de ventas `POS_FERIA` ni otros eventos).
  - Actualizado `tests/sales/online-sales-history-and-purge.test.js` (`4/4 PASS`).
  - Corregidos `deltaSyncRecentPosters` y `syncCatalogFromWeb` en `server/services/catalog/liveCatalogSyncService.js` para seleccionar `sizes: true` en `prisma.product.findMany` y comparar `prev.sizes` contra `data.sizes` mediante el helper compartido `hasCatalogProductChanged` + `normalizeSizesSignature`.
  - Añadida suite `tests/catalog/catalog-sync-sizes.test.js` verificando que agregar tallas manteniendo el mismo `basePrice` mínimo (ej. agregar Pequeño Q35 a un póster con Mini Q25) dispara actualización e invalidación de caché.
  - Montado `EventFinancialRadar` en `EventsManagementView.jsx` para la administración contextual ferial multi-stand, con navegación entre stands físicos y consolidado global.
  - Habilitada la normalización automática en `EventFinancialRadar.jsx` para soportar colecciones de eventos con `eventId` o `id`, cálculo dinámico de `globalFinancials` y preservación exacta de `setSelectedStandId(selectedEventId)` dentro de `useEffect` (contrato de `surgery-053`).
  - En `EventCard.jsx`, transformado `RentHealthPill` en un disparador accesible (`min-h-[36px]`) que abre directamente el modal detallado del evento con su radar financiero y movimientos históricos.
  - En `EventSalesModal.jsx`, integrada la tarjeta completa de desglose financiero y Radar Ferial (regla del 20%, 4 tarjetas contables, barra de progreso hacia 5x arriendo, ritmo diario ferial requerido, desglose consolidado de formas de pago y cortes de caja conciliados/automáticos) para cualquier evento (activo o archivado).

- [x] **Limpieza única en 0 de los datos de prueba de Ventas en Línea en el VPS de Producción `feat-011` (`aae1eb2`)**
- [x] **Simplificación Visual de Mis Comisiones para `VENDEDOR_REDES` `feat-012` (`61/61` commission tests PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`)**:
  - Retirada la tarjeta `"Flete Administrado"` y redistribuido el espacio superior en 3 columnas equitativas (`grid-cols-1 sm:grid-cols-3`: **Comisiones Listas**, **Base Productos** y **En Espera de Saldo**).
  - Eliminados todos los estilos naranjas/ámbar (`text-amber-*`, `bg-amber-*`, `border-amber-*`) en `SellerCommissionDashboard.jsx`, unificando la tarjeta **En Espera de Saldo** con la estética blanca/neutra de **Base Productos** (`text-neutral-300`, `text-neutral-400`, `text-white`).
  - Retirado por completo el banner inferior del 20% debajo de las tarjetas KPI.
  - Incorporado el badge neutro `Última liquidación: <fecha es-GT | Sin registros>` (`data-testid="last-settlement-badge"`) junto al botón de actualizar en la cabecera de **"Ventas Elegibles para Liquidar"**, sincronizado con `settlements` y `fetchSettlements()` desde `CommissionSettlementView.jsx`.
  - Alineadas las suites `tests/commissions/commission-frontend.test.js` y `tests/adversarial/sprint5-commission-frontend-challenger.test.js` (`61/61 PASS`).
- [x] **Ciclo Contable Estricto de Jornada Diaria y Traspaso Post-Cierre `D -> D + 1` `feat-013` (`22/22` `daily-shift-closing-rollover` + `m4` PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`)**:
  - Eliminada la sobreescritura `prisma.cashClosing.update` en `cashClosingService.js`, imponiendo unicidad estricta de **1 cierre por jornada** (`HTTP 409` ante cualquier segundo intento salvo `idempotentReplay` con la misma `idempotencyKey`) y acotando el cálculo de KPIs diarios a la jornada `targetDate`.
  - Implementado corte automático puntual a las **11:59 PM CST (`23:59` `America/Guatemala`)** en `midnightClosingService.js` y reloj de precisión cada 30s en `server/index.js`, respetando ventas post-cierre ya pertenecientes a `D + 1` y conciliando también ventas rollover heredadas de `D - 1`.
  - Implementada `resolveStandShiftWindow` en `saleKpiService.js` para limpiar de inmediato a `0` `"Ventas de Hoy"` y las métricas vivas en cuanto se cierra la jornada (`createdAt <= closingDate`) y sumar automáticamente en `D + 1` cualquier venta post-cierre (`createdAt > closingDate`).
  - Actualizados `saleUpdateService.js`, `RecentSaleRow.jsx`, `RecentSalesList.jsx` y `EventSalesModal.jsx` para que toda venta post-cierre se contabilice en `D + 1`, permanezca 100% editable mientras `D + 1` siga abierta y se agrupe bajo `D + 1` en Movimientos por Jornada.
- [x] **Simplificación de Interfaz en Cierre de Caja `feat-014` (`70/70` `closing-modular` + `m3` + `p5-2` PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`)**:
  - Desmontado `<CashDenominationGrid />` de `CashClosingView.jsx` (`69L < 70L`), dejando siempre visible `Efectivo Físico Directo (Q)` (`min-h-[44px]`) y preservando `CashDenominationGrid.jsx` en disco y los exports puros en `useCashClosing.js`.
  - Retirado `Efectivo Esperado (Sistema):` tanto del resumen principal como del modal de confirmación en `CashClosingSummary.jsx`, conservando intacto `Balance / Diferencia` (`Caja cuadrada exacta` / `Sobrante en caja` / `Faltante en caja`) y el bloque WhatsApp.
  - Sustituidos todos los estilos `text-amber-400` por estética blanca/neutra en `CashClosingView.jsx` y `CashClosingSummary.jsx`.
- [x] **Limpieza de la Vista de Eventos e Integración Contextual del Radar Financiero por Evento `feat-015` (`27/27` `events-clean-view` + `surgery-053` + `surgery-065` PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`, bundle `-18.26 kB`)**:
  - Desmontado por completo `EventFinancialRadar` de `src/components/EventsManagementView.jsx`, dejando primero la tarjeta fija `Ventas en Línea y Redes Sociales` (`permanent-digital-pos-card`) e inmediatamente debajo las tarjetas de selección de `Eventos en curso`, `Eventos confirmados / Próximos` y el acordeón de `Eventos Archivados`.
  - Consolidado y pulido el análisis financiero del Radar del 20% dentro de `src/components/events/modals/EventSalesModal.jsx` (`364L <= 380L`), incluyendo resolución viva de `activeSalesEvent`, acceso directo a gestionar/registrar gastos (`onManageExpenses` / `modal-manage-expenses-btn`), las 4 tarjetas contables, progreso 5x arriendo, ritmo diario requerido, formas de pago, cortes de caja conciliados/automáticos y movimientos por jornada.
  - Eliminadas todas las clases naranjas/ámbar (`text-amber-*`, `bg-amber-*`, `border-amber-*`) en `EventsManagementView.jsx` y `EventSalesModal.jsx` en favor de estética blanca/neutra, conservando `src/components/monitor/EventFinancialRadar.jsx` en disco para compatibilidad con `surgery-053` y agregando la suite `tests/events/events-clean-view-and-modal-radar.test.js`.
- [x] **Rediseño Operativo de Producción: Cola Masiva >300 Diseños, Tamaño Visible en Móvil y Archivo Inmutable por Operario `feat-016` (`25/25` `production-scale` + `seller-isolation` + `production-adversarial` PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`)**:
  - Elevado el tope máximo de paginación en `getProductionItems` (`server/services/productionService.js`) hasta `1000` por página (`limit = 500` por defecto en `useProductionQueue.js` y `usePrintSheets.js`), agregados controles accesibles de paginación (`min-h-[44px]`) y contador `"Mostrando X de Y diseños"`, y excluidas estrictamente las ventas con `status: 'ANULADA'` tanto en `getProductionItems` como en `getProductionMetrics`.
  - Proyectados `productionLogs` con `user: { id, fullName, email }` en `getProductionItems` y `updateItemProductionStatus` sin modificar `prisma/schema.prisma`.
  - Extraído determinísticamente el tamaño del póster (`extractPosterSizeInfo` en `ProductionOrderCard.jsx`) para mostrar en primera línea móvil un badge prominente no truncable (`data-testid="poster-size-badge"`, `shrink-0`) junto con la cantidad (`data-testid="poster-qty-badge"`), sustituyendo el truncamiento de 1 línea del título por `line-clamp-2 break-words` y erradicando al 100% los tonos naranjas/ámbar (`amber-*` / `orange-*`).
  - Separadas estrictamente la **Cola Pendiente / Por Imprimir** y el **Archivo Inmutable de Resueltos / Impresos** tanto para `OPERARIO_1` como para `OPERARIO_2`: al procesar un diseño (`SEPARADO` o `A_PRODUCCION` para Operario 1; `IMPRESO` para Operario 2), sale al instante de su cola activa y queda sellado en el archivo con acción, nombre del usuario responsable y fecha/hora exacta en `America/Guatemala` (`es-GT`), con `0` botones de acción en el archivo y bloqueo `HTTP 403` en backend ante cualquier intento de re-modificación o reversión por operarios.

- [x] **Flexibilización de Anticipo en Nueva Venta de Redes, Iconografía Minimalista Centrada, Etiqueta `Valor del anticipo`, Botón `Registrar Venta (abono Q 0.00)` y Pie de Página Global 2026 `feat-017` (`58/58` `remote-sale-flexible-deposit` + `surgery-056/059/061` PASS, `265/265` unit tests PASS, `53/53` voice tests PASS, `bash ./init.sh` `100/100`)**:
  - Retirada de extremo a extremo la compuerta del 50% de anticipo tanto en backend (`createRemoteSaleTransaction` y `registerBalancePayment` en `server/services/sales/remoteSaleService.js`) como en frontend (`useRemoteSaleForm.js`, `RemoteQuoterSummary.jsx` y `BalancePaymentModal.jsx`), aceptando cualquier anticipo positivo (`> 0` y `<= totalAmount`) para iniciar `A_PRODUCCION`, eliminando el auto-llenado forzoso al 50%, el botón de `50%` y los avisos de anticipo insuficiente, y dejando únicamente el campo numérico libre y el botón de `100%`.
  - Eliminados todos los emojis/iconos a color redundantes (doble icono: `⚡`, `⏳`, `💯`, `🔍`, `📱`, `📲`, `✅`, `📋`) en `RemoteQuoterSummary.jsx`, `FastManualSaleForm.jsx`, `WhatsAppQuoteShareModal.jsx` y `BalancePaymentModal.jsx`, dejando exclusivamente los iconos minimalistas de `lucide-react` con texto centrado (`justify-center text-center`).
  - Sustituida la etiqueta `"Monto ingresado por el cliente (Q):"` por el título exacto **`Valor del anticipo`** y reemplazado el botón primario de cierre por **`Registrar Venta (abono Q 0.00)`** (con monto dinámico `Q ${numericDeposit.toFixed(2)}`).
  - Actualizado el pie de página global en `src/App.jsx` (layout principal y vista de vendedor sin stand) e incorporado en `src/components/LoginView.jsx` con el texto exacto **`Desarrollado por Sebastian Jimenez / Deko Labs Todos los Derechos Reservados 2026`**.

### What's In Progress
- Ninguna tarea en ejecución (`WIP = 0`; `feat-000..017` completadas y verificadas).

### What's Next
- Cola de tareas actual en `done` (`feat-000..017`); listo para despliegue a producción cuando el usuario lo solicite o para registrar nuevas funcionalidades bajo `WIP = 1`.

## Blockers / Risks
- Ninguno activo (`0` lectura de `.env`; `Overall: 100/100`; arquitectura en verde con 0 excepciones; 265/265 unit tests PASS; 53/53 voice tests PASS; 58/58 remote sale & surgery contract tests PASS).

## Decisions Made
- **Ventana contable sin traslapes ni huecos `(C_{D-1}, C_D]` para traspaso post-cierre (`feat-013`)**:
  - Context: Cerrar caja temprano (p. ej. 7:30 PM) y recibir un cliente de último minuto bloqueaba la edición con `403` y dejaba ambigua la conciliación del dinero, sin modificar `prisma/schema.prisma`.
  - Alternatives considered: (a) Agregar una columna `shiftDate` en `prisma/schema.prisma` (descartado por restricción explícita de no alterar el esquema Prisma); (b) Permitir sobreescribir el cierre diario existente con `prisma.cashClosing.update` (descartado por requerimiento de unicidad estricta de 1 cierre al día).
  - Resolution: Se derivó determinísticamente la ventana contable efectiva en `America/Guatemala` usando `closingDate` (`createdAt <= dayClosing.closingDate` pertenece a `D`; `createdAt > dayClosing.closingDate` pasa a `D + 1` con `gt: prevClosing.closingDate`), garantizando partición exacta sin doble conteo ni dinero huérfano.
- **Desmonte de `CashDenominationGrid` sin borrar el módulo en disco (`feat-014`)**:
  - Context: El conteo billete por billete ralentizaba el cierre en stand, pero suites existentes (`phase5-frontend-ergonomics-resilience.test.js` y `closing-modular.test.js`) auditan la presencia de `CashDenominationGrid.jsx` y la aritmética exportada en `useCashClosing.js`.
  - Alternatives considered: Borrar `CashDenominationGrid.jsx` y relajar suites ajenas (descartado por regla `Stay in scope` y prohibición de debilitar validadores).
  - Resolution: Se desmontó el componente en `CashClosingView.jsx` (`69L < 70L`) dejando siempre directo `Efectivo Físico Directo (Q)` y conservando el módulo y utilidades puras en disco.
- **Retiro del Radar global en `EventsManagementView` e integración contextual en `EventSalesModal` (`feat-015`)**:
  - Context: La vista de `Eventos` tenía una tarjeta global de `EventFinancialRadar` que saturaba la selección de eventos, mientras que cada evento ya posee su propio modal detallado.
  - Alternatives considered: (a) Borrar `src/components/monitor/EventFinancialRadar.jsx` (descartado porque `surgery-053` prueba `1.2` inspecciona ese archivo estáticamente); (b) Apilar `EventExpensesModal` sobre `EventSalesModal` con doble backdrop `z-50` (descartado para evitar conflicto de pila de modales en móvil).
  - Resolution: Se retiró `EventFinancialRadar` de `EventsManagementView.jsx` (reduciendo su bundle de `250.15 kB` a `231.89 kB`), se consolidó todo el análisis financiero del Radar del 20% sin tonos naranjas dentro de `EventSalesModal.jsx` (`364L <= 380L`) resolviendo `activeSalesEvent` desde `m.events` y conmutando limpiamente a `EventExpensesModal` al pulsar `Gastos`, conservando `EventFinancialRadar.jsx` en disco.
- **Separación de Bandeja Principal (`Cola Activa` vs `Archivo Inmutable`) y Trazabilidad sin Migración Prisma (`feat-016`)**:
  - Context: Con >300 diseños vendidos en feria, el límite de `50` ocultaba pedidos, `truncate` ocultaba el tamaño en móvil, y mezclar ítems resueltos con pendientes permitía confusiones y carecía de un archivo inmutable auditable para Operario 1 y Operario 2, sin alterar `prisma/schema.prisma`.
  - Alternatives considered: (a) Añadir nuevas columnas de auditoría en `SaleItem` modificando `prisma/schema.prisma` (descartado porque `ProductionLog` con relación `user` ya persiste cada transición); (b) Mostrar pestañas de archivo dentro de `ProductionFilterTabs` para `isOp2Only` rompiendo el contrato histórico `if (isOp2Only) return null;` de `production-adversarial.test.js` (descartado para preservar compatibilidad al 100%).
  - Resolution: Se incorporó un selector superior dedicado de bandeja (`Cola Pendiente / Por Imprimir` vs `Archivo de Resueltos / Impresos`) en `ProductionManagementView.jsx` para ambos operarios y `SUPER_ADMIN`, conservando `ProductionFilterTabs` para sub-estados de Operario 1 / Admin (`if (isOp2Only) return null;`), proyectando `productionLogs` ordenados cronológicamente con nombre de usuario y hora `America/Guatemala` y bloqueando con `HTTP 403` cualquier mutación posterior de operarios sobre diseños ya procesados.

- **Retiro Fullstack de la Compuerta del 50% de Anticipo en Ventas de Redes (`feat-017`)**:
  - Context: En `RemoteQuoterSummary.jsx` y `useRemoteSaleForm.js` el vendedor no podía ingresar un anticipo menor al 50% (además un `useEffect` auto-rellenaba el 50% al agregar productos), pero en `server/services/sales/remoteSaleService.js` (`createRemoteSaleTransaction` y `registerBalancePayment`) también existía una compuerta dura `HTTP 400` del 50%.
  - Alternatives considered: Retirar la validación únicamente en el componente React `RemoteQuoterSummary.jsx` (descartado porque `POST /api/sales/remote` rechazaría en servidor con `HTTP 400 Anticipo insuficiente` cualquier anticipo menor al 50%).
  - Resolution: Se retiró la restricción del 50% de extremo a extremo (`RemoteQuoterSummary.jsx`, `useRemoteSaleForm.js`, `BalancePaymentModal.jsx` y `remoteSaleService.js`), iniciando `depositInput` vacío (`''` -> `abono Q 0.00`), dejando únicamente el campo `Valor del anticipo` y el botón de `100%`, y preservando intactas las clases y contratos estáticos exigidos por `surgery-056`, `surgery-059`, `surgery-061`, `surgery-064` y `surgery-065`.

## Files Modified This Session
- `server/services/sales/remoteSaleService.js` — Retirada la compuerta del 50% en `createRemoteSaleTransaction` y `registerBalancePayment`, aceptando cualquier anticipo `> 0` y `<= totalAmount` (`0 CRLF`).
- `src/components/manual-sale/hooks/useRemoteSaleForm.js` — Eliminado el `useEffect` de auto-llenado al 50% y el bloqueo de `minDeposit`, validando anticipo libre `> 0` (`342L <= 350L`, `0 CRLF`).
- `src/components/manual-sale/RemoteQuoterSummary.jsx` — Etiqueta `Valor del anticipo`, solo campo numérico + botón `100%`, retiro de emojis a color redundantes con texto centrado y botón primario `Registrar Venta (abono Q 0.00)` dinámico (`316L <= 350L`, `0 CRLF`).
- `src/components/FastManualSaleForm.jsx` — Limpieza de doble icono `📱` junto a `<Smartphone />`, subtítulo sin `50/50` y centrado de controles (`333L <= 350L`, `0 CRLF`).
- `src/components/manual-sale/WhatsAppQuoteShareModal.jsx` — Limpieza de dobles iconos (`📲`, `✅`, `📋`) dejando solo iconos minimalistas Lucide con texto centrado (`0 CRLF`).
- `src/components/sales/BalancePaymentModal.jsx` — Retiro del mínimo del 50% y doble icono en anticipo diferido (`PENDIENTE_PAGO`), etiqueta `Valor del anticipo` y botón `100%` (`0 CRLF`).
- `src/App.jsx` y `src/components/LoginView.jsx` — Nuevo pie de página global `Desarrollado por Sebastian Jimenez / Deko Labs Todos los Derechos Reservados 2026` (`0 CRLF`).
- `tests/sales/remote-sale-flexible-deposit-and-footer.test.js` — Suite integral backend + frontend para los 5 requerimientos de `feat-017` (`9/9 PASS`, `0 CRLF`).
- `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` — Estado del arnés cerrado en `done` (`WIP = 0`, `0 CRLF`).

## Verification Evidence
- [x] Suite Dedicada `feat-017` + Contratos Quirúrgicos: `node --test tests/sales/remote-sale-flexible-deposit-and-footer.test.js tests/adversarial/surgery-056-permanent-pos-and-pickup-accounting.test.js tests/adversarial/surgery-059-ui-polish-header-order-sync-camera.test.js tests/adversarial/surgery-061-ui-shipping-clean-colors-custom-modal.test.js` -> `Exit code 0 (58/58 PASS across 20 suites in 335.12ms)`
- [x] Pruebas Unitarias Completas: `npm run test:unit` -> `Exit code 0 (265/265 PASS across 109 suites)`
- [x] Suites de Voz y VAD: `npm run test:voice` -> `Exit code 0 (53/53 PASS across 12 suites)`
- [x] Compuerta Física Unificada: `npm run harness:check` -> `status HARNESS_PASS, framework STAND-IA-UNIFIED-HARNESS (276 JS syntax OK, 13/13 zero-trust, 193 secrets OK, vite build 1566 modules PASS in 4.22s)`
- [x] Verificación en 3 Puertas (`sesion-024`): `bash ./init.sh` -> `Exit code 0 (CLEAN STATE, Overall: 100/100, 25/25 PASS, check-architecture 0 violations, zero-trust 13/13 PASS, vite build PASS)`
- [x] Validación Matemática del Arnés: `node scripts/validate-harness.mjs --min-score 100` -> `Overall: 100/100 (25/25 PASS, WIP = 0, DAG respetado)`

## Notes for Next Session
1. Repositorio en estado limpio (`WIP = 0`, `Overall: 100/100`), con `feat-000..017` completadas y verificadas.
2. Listo para despliegue a producción cuando el usuario lo indique o para abordar el siguiente requerimiento iniciando con `bash ./init.sh`.
