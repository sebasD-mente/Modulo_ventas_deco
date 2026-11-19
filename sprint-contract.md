# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-000..023` en `done`)
- **Tareas completadas recientemente:** `feat-021` (`1b8e48c`), `feat-022` (`54b01ed`) y **`feat-023` (`done` — Vista `Bandeja Web` + Botón `Importar Pedido Web` con Ventana Flotante y Precarga Limpia)**.
- **Tareas pendientes en `feature_list.json`:** Ninguna (`WIP = 0`; `24/24` tareas del backlog completadas y certificadas).

---

## Contrato Certificado Recientemente: `feat-023` (`done`)

### Entregables Verificados en `feat-023`
1. **Orquestación y Precarga sin Sorpresas (`src/components/manual-sale/hooks/useWebOrderImport.js`, `275L <= 280L`)**:
   - Exportados helpers puros (`mapWebOrderItemToCartItem`, `buildWebOrderCustomerDraft`, `filterWebOrdersByQuery`, `formatWebOrderSourceLabel`, `formatWebMaterialLabel`) que mapean pósters de catálogo (con y sin `productId` local), personalizados con decimales (`42.2 x 30 cm`), materiales (`MDF_5_5MM`, `PVC_5MM`, `VINILO_SOLO`) y fotos HD absolutas.
   - Búsqueda de cliente en CRM por teléfono (`GET /api/customers?query=...`) con apertura automática del formulario inline cuando el cliente es nuevo o carece de dirección completa, y cero precarga automática al abrir la vista.
2. **Banner + Ventana Flotante en Pedidos / Venta (`WebOrderImportBanner.jsx` `82L <= 120L` + `WebOrdersImportModal.jsx` `253L <= 280L`)**:
   - Botón accesible `'Importar Pedido Web'` con contador vivo de pendientes y chip `'#CP-XXXX cargado'` + `'Desvincular'` montado al inicio de `REDES_PERSONALIZADO` en `FastManualSaleForm.jsx` (`339L <= 350L`).
   - Ventana flotante con `useModalBackHandler`, buscador instantáneo, botón `'Actualizar'` (`POST /api/sales/web-orders/sync`), miniaturas HD, medidas decimales, notas, total cotizado y botón `'Cargar al Formulario'`, enviando `webOrderInboxId` / `webOrderNumber` desde `useRemoteSaleForm.js` (`343L <= 350L`).
3. **Pestaña Dedicada `'Bandeja Web'` (`Header.jsx` `276L <= 280L`, `App.jsx` `395L <= 420L` y `WebOrdersInboxView.jsx` `257L <= 280L`)**:
   - Pestaña `'bandeja-web'` con badge de pendientes para `SUPER_ADMIN` y `VENDEDOR_REDES`, carga `lazy` en `App.jsx`, filtros `Pendientes / Importados / Descartados`, sincronización manual, descarte, restauración y acción `'Importar a Venta'`.
4. **Suite de Verificación (`tests/sales/web-orders-import-ui.test.js`)**:
   - `98/98 PASS` junto con `web-orders-inbox-service`, `surgery-059`, `surgery-061`, `remote-sale-design-edition` y `commission-frontend`; `265/265` unit tests, `53/53` voice tests, `HARNESS_PASS` y `bash ./init.sh` `100/100` con `0 CRLF`.

---

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero escritura en el repositorio vecino `C:\Users\sebas\Documents\Antigravity Files\Web Deco Vintage Proyect`.
- Cero conexión directa entre bases de datos PostgreSQL de ambos proyectos.
