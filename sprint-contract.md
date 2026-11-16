# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-010` Completada, Pendiente `feat-011`)
- **Estado de sesión:** `feat-010` completada y verificada en verde (`WIP = 0`).
- **Próxima tarea en DAG (`WIP = 1`):** `feat-011` — Limpieza única en 0 de los datos de prueba de Ventas en Línea en el VPS de Producción (sin UI destructiva), previa autorización de despliegue (`npm run deploy`) y ejecución única en PostgreSQL de producción restringida estrictamente a `eventId = 'evt-ventas-redes-online'`.
- **Marcha de trabajo acordada:** `Modo Diario Ágil`.

---

## Alcance Requerido para `feat-010` (Siguiente Sesión)
1. **Eliminar botón destructivo en UI (`src/components/EventsManagementView.jsx`)**:
   - Retirar el botón `"Reiniciar en 0"`, los estados `isConfirmingOnlineReset` / `isResettingOnline` / `onlineResetFeedback`, `handleConfirmOnlineReset` y el modal de confirmación.
2. **Eliminar endpoint y función de purga en backend**:
   - Retirar `POST /api/sales/purge-online-test-data` de `server/routes/apiRoutes.js`, `purgeOnlinePosTestData` de `server/controllers/saleController.js`, y `purgeOnlinePosTestDataTransaction` de `server/services/saleService.js` y `server/services/sales/salePurgeService.js`.
   - Preservar intacta la protección `403` en `purgeEventSalesTransaction` contra purgas accidentales de `evt-ventas-redes-online`.
3. **Actualizar pruebas (`tests/sales/online-sales-history-and-purge.test.js`)**:
   - Verificar que no exista ningún botón ni endpoint de borrado masivo de Ventas en Línea, manteniendo los tests de `EventSalesModal.jsx` (sin React #310), `OnlineSalesHistoryModal.jsx` y `getEventSalesList` (`month`).

---

## Exclusiones Explícitas (`Hands off`)
- **Cero lectura o modificación de `.env`** y **cero modificaciones en `prisma/schema.prisma`**.
- **No tocar `OnlineSalesHistoryModal.jsx` ni `EventSalesModal.jsx`** salvo necesidad estricta.
- **Cero alteración de ferias físicas (`POS_FERIA`)**.
