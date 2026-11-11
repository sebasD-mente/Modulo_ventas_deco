# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-007` Completada y Verificada)
- **Estado de sesión:** Tarea `feat-007` concluida con verificación 100/100, 265/265 unit tests PASS, 53/53 voice tests PASS, build PASS y 0 CRLF.
- **Última tarea completada:** `feat-007` — Reubicación del Radar Financiero Ferial y Consolidación de Histórico de Movimientos en la Sección de Eventos.
- **Próxima tarea a ejecutar en DAG (`WIP = 1`):** Ninguna (`feat-000..007` cerradas en `done`).
- **Marcha de trabajo acordada:** `Modo Diario Ágil`.

---

## Alcance Ejecutado (`Scope` de `feat-007` — COMPLETADO)
1. **Reubicación de Métricas Financieras dentro de Eventos (`src/components/EventsManagementView.jsx`, `src/components/events/EventCard.jsx`, `src/components/events/modals/EventSalesModal.jsx` y `src/components/monitor/EventFinancialRadar.jsx`)**:
   - Montado el Radar Financiero Ferial (regla del 20%, recuperación de costos y balance pre-producción) dentro de la sección de eventos (`EventsManagementView.jsx`), permitiendo auditar y navegar stands concurrentes y consolidado global con `onOpenExpenseModal`.
   - En `EventCard.jsx`, `RentHealthPill` opera como disparador accesible para consultar de forma inmediata el radar y desglose ferial de cualquier stand (`ACTIVO`, `CONFIRMADO` o `ARCHIVADO`).
   - En `EventSalesModal.jsx`, integrada la tarjeta completa de desglose financiero y radar ferial (indicadores contables, fase de salud, barra de progreso al 20%, ritmo diario requerido y consolidado de pagos y cortes de caja).
2. **Consulta Integral de Histórico y Movimientos por Evento**:
   - Garantizado que cualquier evento histórico o archivado permita auditar sus ventas, cortes de caja y movimientos asociados directamente desde su ficha/modal en eventos sin depender del monitor general.
3. **Preservación Estricta de Contratos Existentes**:
   - Preservado `selectedStandId` y `selectedEventId` en `EventFinancialRadar.jsx` (contrato de `surgery-053` 16/16 PASS).
   - Preservado `data-testid="permanent-digital-pos-card"`, `toggle-archived-events-btn` y enlaces de `EventsManagementView.jsx` (contratos `surgery-056`, `surgery-058`, `surgery-065`).
   - Mantenido `useModalBackHandler` en `EventSalesModal.jsx`.

---

## Exclusiones Explícitas (`Hands off` cumplidas al 100%)
- **Cero lectura o modificación de `.env`** y **cero modificaciones en `prisma/schema.prisma`** o migraciones de base de datos.
- **Cero alteración de módulos ajenos** (POS de mostrador, cálculo de comisiones, contratos de sincronización de catálogo, endpoints de voz IA o infraestructura Docker).
- **Cero debilitamiento de suites de prueba** (`surgery-056`, `surgery-058`, ergonomía `>= 44px`, `zero-trust`, `check-architecture`).
- **Cero nuevas dependencias NPM** y **cero despliegue remoto (`git push` / `npm run deploy`)**.

---

## Criterios Verificables de Cierre Cumplidos para `feat-007`
1. [x] `src/components/EventsManagementView.jsx` monta y renderiza `EventFinancialRadar` para la gestión ferial multi-stand.
2. [x] `src/components/events/EventCard.jsx` ofrece acceso interactivo hacia el radar y auditoría ferial a través de `RentHealthPill` y `onViewSales`.
3. [x] `src/components/events/modals/EventSalesModal.jsx` integra la auditoría del Radar Financiero Ferial junto con el desglose de transacciones y cortes de caja para cualquier evento activo o archivado.
4. [x] `bash ./init.sh`, `bash scripts/check-architecture.sh`, `node scripts/validate-harness.mjs --min-score 100` y `npm run harness:check` pasan al 100% con 0 violaciones y 0 CRLF.
