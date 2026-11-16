# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-009` Completada y Verificada)
- **Estado de sesión:** Tarea `feat-009` concluida bajo `Modo Diario Ágil` (`WIP = 0`).
- **Tarea completada:** `feat-009` — Historial Mensual de Ventas en Línea, Fix React #310 en Ver Ventas y Limpieza en 0 de Datos de Prueba.
- **Marcha de trabajo acordada:** `Modo Diario Ágil`.

---

## Alcance Acordado (`Scope` de `feat-009`)
1. **Fix React Error #310 en `src/components/events/modals/EventSalesModal.jsx`**:
   - Mover todos los hooks (`useState`, `useMemo`) antes del retorno temprano `if (!event) return null;` para eliminar la violación de Rules of Hooks al abrir el modal.
2. **Historial Mensual de Ventas en Línea (`src/components/events/modals/OnlineSalesHistoryModal.jsx` + `src/components/EventsManagementView.jsx`)**:
   - Selector de mes (`<input type="month">` + navegación mes anterior/siguiente) y búsqueda rápida.
   - Listado detallado por venta del mes con: estado de pago (`PAGADO_TOTAL`, `ANTICIPO`/saldo pendiente, métodos de pago), estado de comisión (`commissionPaid`, corte de comisión asignado `commissionSettlement`, pendiente de cobro o sin cargar, más estimado 20%) y datos completos de entrega (método de entrega, cliente, teléfono, dirección/departamento/municipio o stand de recogida, courier, guía y productos).
3. **Soporte Backend Mensual y Limpieza en 0 (`server/services/sales/saleKpiService.js`, `salePurgeService.js`, `saleService.js`, `saleController.js`, `apiRoutes.js`, `scripts/reset-online-pos-test-data.js`)**:
   - Soporte de `month=YYYY-MM` en `getEventSalesList` e inclusión de `customer`, `pickupEvent` y `commissionSettlement`.
   - `purgeOnlinePosTestDataTransaction` + endpoint `POST /api/sales/purge-online-test-data` (`SUPER_ADMIN`) + botón con confirmación en `EventsManagementView.jsx` + script `scripts/reset-online-pos-test-data.js` para dejar en 0 las ventas de redes, clientes de prueba, liquidaciones huérfanas, cierres y secuencia del canal digital sin tocar ferias físicas.
4. **Pruebas Unitarias (`tests/sales/online-sales-history-and-purge.test.js`)**:
   - Cobertura de regresión para React #310 en `EventSalesModal.jsx`, `OnlineSalesHistoryModal.jsx`, filtro `month` en `getEventSalesList` y limpieza atómica en `purgeOnlinePosTestDataTransaction`.

---

## Exclusiones Explícitas (`Hands off`)
- **Cero lectura o modificación de `.env`** y **cero modificaciones en `prisma/schema.prisma`**.
- **Cero alteración de ferias físicas (`POS_FERIA`)** durante la limpieza de datos de prueba del canal digital.
- **Cero debilitamiento de suites de prueba** existentes.
- **Cero nuevas dependencias NPM** y **cero despliegue remoto (`git push` / `npm run deploy`)** sin autorización explícita.

---

## Criterios Verificables de Cierre Cumplidos para `feat-009`
1. [x] `EventSalesModal.jsx` ejecuta todos los hooks antes de `if (!event) return null;` (0 errores React #310).
2. [x] `OnlineSalesHistoryModal.jsx` permite seleccionar mes actual o anteriores y muestra pago, comisión y datos de entrega por cada venta.
3. [x] `getEventSalesList` soporta `month` (`YYYY-MM`) e incluye `customer`, `pickupEvent` y `commissionSettlement`.
4. [x] `purgeOnlinePosTestDataTransaction`, `POST /api/sales/purge-online-test-data` y `scripts/reset-online-pos-test-data.js` limpian en 0 el módulo de Ventas en Línea/Redes sin afectar ferias físicas.
5. [x] `node --test tests/sales/online-sales-history-and-purge.test.js`, `npm run test:unit`, `bash ./init.sh`, `bash scripts/check-architecture.sh` y `node scripts/validate-harness.mjs --min-score 100` pasan al 100% con 0 CRLF.
