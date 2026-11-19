# Session Handoff

## Current Objective
- **Goal:** Completada y certificada `feat-023` (`sesion-034`), implementando la interfaz completa de importación de pedidos web para `VENDEDOR_REDES` y `SUPER_ADMIN`: botón `"Importar Pedido Web"` con ventana flotante de selección (`WebOrdersImportModal.jsx`) y cero precarga sorpresiva en *Pedidos / Venta*, más la pestaña dedicada `"Bandeja Web"` (`WebOrdersInboxView.jsx`) con contador vivo de pendientes, sincronización Pull, descarte/restauración e importación directa a venta.
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..023` en `done`; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-023` verificada con `0 CRLF`, `98/98` suite S2S/UI/Cirugías, `265/265` unit tests, `53/53` voice tests y `HARNESS_PASS`).

## Completed This Session
- [x] Creado `src/components/manual-sale/hooks/useWebOrderImport.js` (`275L <= 280L`) con mapeo puro de ítems web (catálogo, medidas decimales `42.2 x 30 cm`, materiales `MDF_5_5MM`/`PVC_5MM`/`VINILO_SOLO` y fotos HD absolutas para Taller), coincidencia CRM por WhatsApp o formulario inline, y cero precarga automática al abrir la pantalla.
- [x] Creados `src/components/manual-sale/WebOrderImportBanner.jsx` (`82L <= 120L`) y `src/components/manual-sale/WebOrdersImportModal.jsx` (`253L <= 280L`, con `useModalBackHandler`, buscador, sincronización `'Actualizar'` y `'Cargar al Formulario'`), integrados en `src/components/FastManualSaleForm.jsx` (`339L <= 350L`) y `src/components/manual-sale/hooks/useRemoteSaleForm.js` (`343L <= 350L`) enviando `webOrderInboxId` y `webOrderNumber`.
- [x] Añadida la pestaña `'Bandeja Web'` (`id: 'bandeja-web'`) con badge de pendientes en `src/components/Header.jsx` (`276L <= 280L`) y `src/components/WebOrdersInboxView.jsx` (`257L <= 280L`, lazy-loaded en `src/App.jsx` `395L <= 420L`) con filtros `Pendientes / Importados / Descartados`, descarte, restauración e `'Importar a Venta'`.
- [x] Certificada la suite `tests/sales/web-orders-import-ui.test.js` (`98/98 PASS` junto con `web-orders-inbox-service`, `surgery-059/061`, `design-edition` y `commission-frontend`), `npm run harness:check` (`HARNESS_PASS`) y `bash ./init.sh` (`100/100`).

## Blockers / Risks
- Ninguno activo. Todas las 24 tareas (`feat-000..023`) están en `done` con `0` violaciones arquitectónicas y `0 CRLF`.

## Files Touched
- `src/components/manual-sale/hooks/useWebOrderImport.js`
- `src/components/manual-sale/WebOrderImportBanner.jsx`
- `src/components/manual-sale/WebOrdersImportModal.jsx`
- `src/components/WebOrdersInboxView.jsx`
- `src/components/FastManualSaleForm.jsx`
- `src/components/manual-sale/hooks/useRemoteSaleForm.js`
- `src/components/Header.jsx`
- `src/App.jsx`
- `tests/sales/web-orders-import-ui.test.js`
- `ARCHITECTURE.md`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar la siguiente sesión con `bash ./init.sh`. Cuando el usuario lo indique, desplegar a producción (aplicando el cambio aditivo `WebOrderInbox` en PostgreSQL y compartiendo `WEB_ORDERS_WEBHOOK_SECRET` / `CATALOG_WEBHOOK_SECRET` con `Web Deco Vintage Proyect`) o registrar nuevas tareas en `feature_list.json` bajo `WIP = 1`.
