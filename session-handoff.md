# Session Handoff

## Current Objective
- **Goal:** Completada y certificada `feat-024` (`sesion-035`), endureciendo de extremo a extremo el pipeline S2S de pedidos web entre `decovintage.online` y `ventas.decovintage.online`: eliminación del bucle de refresco cada `200ms` en `Bandeja Web`, orden cronológico real por `webCreatedAt DESC`, vinculación multi-SKU al catálogo local, extracción automática de cliente/dirección desde `customerNotes` y borrado definitivo (`DELETE /api/sales/web-orders/:id`) de pedidos descartados o de prueba.
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..024` en `done`; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-024` verificada con `0 CRLF`, `34/34` suite S2S/UI/Decimal, `265/265` unit tests y `HARNESS_PASS`).

## Completed This Session
- [x] Eliminado el bucle infinito de re-consulta en `src/components/WebOrdersInboxView.jsx` (`278L <= 280L`) y `src/App.jsx` (`394L <= 420L`) usando `useRef(onCountsChanged)` y la bandera `{ mutated }`.
- [x] Ordenada `listWebOrders` por `[{ webCreatedAt: 'desc' }, { createdAt: 'desc' }]` y recorrido cronológico ascendente en `syncWebOrdersFromWeb` para que el pedido web más reciente encabece siempre `Bandeja Web` y el modal flotante.
- [x] Añadida resolución multi-SKU (`sku`, `WEB-${posterId}`, `WEB-${legacyId}`) y `extractStructuredCustomerFromNotes` en `server/services/sales/webOrderInboxService.js` y `src/components/manual-sale/hooks/useWebOrderImport.js` (`277L <= 280L`).
- [x] Implementado `DELETE /api/sales/web-orders/:id` (`deleteWebOrder` + `deleteWebOrderHandler` + botón `'Eliminar'` en pestaña `Descartados` protegiendo órdenes `IMPORTADO` con `HTTP 409`) y la suite `tests/sales/web-orders-pipeline-hardening.test.js` (`4/4 PASS`).

## Blockers / Risks
- Ninguno activo. Todas las 25 tareas (`feat-000..024`) están en `done` con `0` violaciones arquitectónicas y `0 CRLF`.

## Files Touched
- `server/services/sales/webOrderInboxService.js`
- `server/controllers/webOrderInboxController.js`
- `server/routes/apiRoutes.js`
- `src/components/WebOrdersInboxView.jsx`
- `src/components/manual-sale/hooks/useWebOrderImport.js`
- `src/App.jsx`
- `tests/sales/web-orders-pipeline-hardening.test.js`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar la siguiente sesión con `bash ./init.sh`. Mantener `WIP <= 1` registrando cualquier nuevo requerimiento en `feature_list.json` antes de codificar.
