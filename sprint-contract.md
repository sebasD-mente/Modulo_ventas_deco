# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-015` Completada y Verificada)
- **Tareas completadas:** `feat-000` a `feat-015` (`done`).
- **Próxima tarea en cola DAG:** Ninguna pendiente (`WIP = 0`; lote `feat-013..015` listo para despliegue a producción cuando el usuario lo indique).
- **Marcha de trabajo acordada:** `Modo Diario Ágil` (`WIP = 1` por tarea).

---

## Alcance Incluido (`In-Scope`) para `feat-015`
1. **Retiro del Radar Financiero Ferial de la vista principal de Eventos (`src/components/EventsManagementView.jsx`)**:
   - Eliminar el import y el bloque `<EventFinancialRadar ... />` de `EventsManagementView.jsx`.
   - Mantener estrictamente el orden limpio de tarjetas en la sección `Eventos`:
     1. **Primera tarjeta (fija):** `Ventas en Línea y Redes Sociales` (`data-testid="permanent-digital-pos-card"`).
     2. **Enseguida debajo:** Las tarjetas limpias de selección de todos los demás eventos (`Eventos en curso`, `Eventos confirmados / Próximos` y el acordeón contraído de `Eventos Archivados`).
   - Pasar `onManageExpenses={isSuperAdmin ? () => { const ev = m.selectedEventForSales; m.setSelectedEventForSales(null); m.setEventForExpenses(ev); } : null}` (o abrir `EventExpensesModal` sobre el evento activo) hacia `EventSalesModal` para que la gestión de gastos también sea accionable desde el análisis interno del evento.
2. **Integración limpia del análisis financiero dentro de cada evento (`src/components/events/modals/EventSalesModal.jsx`)**:
   - Pulir la sección financiera integrada dentro de `EventSalesModal.jsx` (Venta Acumulada, Gastos Stand, Balance Pre-Prod, Peso Arriendo, Progreso Meta 20%, Duración y Ritmo Diario, Recaudación por método de pago, Cortes de caja, botón opcional de `Gestionar gastos` y Movimientos por Jornada).
   - Eliminar textos o iconos en color naranja/ámbar (`text-amber-*`) en `EventsManagementView.jsx` y `EventSalesModal.jsx`, aplicando estética blanca/neutra acorde a la regla de diseño del proyecto.
3. **Pruebas y Guardarraíles (`tests/events/events-clean-view-and-modal-radar.test.js`)**:
   - Crear suite dedicada que valide que `EventsManagementView.jsx` no monta `EventFinancialRadar`, que `permanent-digital-pos-card` precede a las listas de eventos físicos y que `EventSalesModal.jsx` integra el desglose financiero completo del evento.
   - **Guardarraíl estricto:** NO borrar `src/components/monitor/EventFinancialRadar.jsx` del disco (es inspeccionado estáticamente por `tests/adversarial/surgery-053-multi-event-radar-contracts.test.js` prueba `1.2`) y conservar intactos todos los selectores auditados por `surgery-065`.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma`.
