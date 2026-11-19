# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-022` `done`; Siguiente en Cola: `feat-023`)
- **Tareas completadas recientemente:** `feat-020` (`7b0523e`), `feat-021` (`1b8e48c`) y **`feat-022` (`done` — Backend `WebOrderInbox`, Webhook S2S, Sync Pull y Cierre Atómico al Registrar Venta)**.
- **Siguiente en Cola DAG (`not-started`, ejecutar bajo `WIP = 1`):**
  1. **`feat-023` (`P1`, depende de `feat-022` `done`)**: Vista `"Bandeja Web"` + Botón `"Importar Pedido Web"` con Ventana Flotante de Selección y Precarga al Formulario para `VENDEDOR_REDES` y `SUPER_ADMIN`.

---

## Contrato Certificado Recientemente: `feat-022` (`done`)

### Entregables Verificados en `feat-022`
1. **Capa 1 (`Types`)**: `model WebOrderInbox` (`@@map("web_order_inbox")`) en `prisma/schema.prisma` (`npx prisma generate` `< 2500ms`, `0` colisiones de índices), `server/validators/webOrderValidators.js` y extensión de `createRemoteSaleSchema` en `server/validators/remoteSaleValidators.js` (`webOrderInboxId` y `webOrderNumber`).
2. **Capa 2 (`Config`)**: `WEB_ORDERS_WEBHOOK_SECRET` opcional (`min(16)`) con fallback a `CATALOG_WEBHOOK_SECRET` en `server/config/env.js` (`0 CRLF`).
3. **Capa 3/4 (`Service`)**: `server/services/sales/webOrderInboxService.js` (`isWebOrderWebhookAuthorized` con `crypto.timingSafeEqual`, normalización de materiales `mdf/pvc/vinyl_only`, medidas decimales y URLs absolutas, upsert idempotente que jamás revierte `IMPORTADO`/`DESCARTADO`, `syncWebOrdersFromWeb`, `listWebOrders`, `discardWebOrder`, `restoreWebOrder` y `notifyWebOrderStatus`) e integración atómica en `createRemoteSaleTransaction` (`server/services/sales/remoteSaleService.js`) con bloqueo `HTTP 409` y sello `[Origen Web: #CP-XXXX]`.
4. **Capa 5 (`Runtime`)**: `server/controllers/webOrderInboxController.js` (`0` imports hacia `server/config/*`), rutas en `server/routes/apiRoutes.js` (`POST /api/webhooks/web-orders`, `GET /api/sales/web-orders`, `POST /api/sales/web-orders/sync`, `PATCH /api/sales/web-orders/:id/discard` y `PATCH /api/sales/web-orders/:id/restore`) y suite `tests/sales/web-orders-inbox-service.test.js` (`43/43 PASS` junto con `schema-robustness` y `zero-trust`).

---

## Contrato Preparado para la Siguiente Tarea en Cola (`feat-023`)
*(Al iniciar `feat-023`, actualizar a `in-progress` bajo `WIP = 1`)*

- **Regla de oro UX acordada con el usuario:** El formulario de *Pedidos / Venta* NUNCA debe aparecer precargado por sorpresa al entrar. Siempre inicia limpio; arriba del modo `REDES_PERSONALIZADO` muestra el botón **`Importar Pedido Web`** (con contador de pendientes) que abre la **ventana flotante `WebOrdersImportModal.jsx`**, desde donde el vendedor escoge el pedido deseado y recién ahí se precargan cliente + pósters + fotos HD + medidas decimales + precios.
- Pestaña **`Bandeja Web`** (`id: 'bandeja-web'`) en `Header.jsx` (`<= 280L`) y `App.jsx` (`WebOrdersInboxView.jsx <= 280L`) para `VENDEDOR_REDES` y `SUPER_ADMIN` con filtros `Pendientes / Importados / Descartados`, botón `Actualizar` (`POST /api/sales/web-orders/sync`) y acción `Importar a Venta`.
- Respetar estrictamente techos de líneas (`FastManualSaleForm.jsx <= 350L`, `useRemoteSaleForm.js <= 350L`, `Header.jsx <= 280L`, `WebOrdersImportModal.jsx <= 280L`, `WebOrdersInboxView.jsx <= 280L`, `WebOrderImportBanner.jsx <= 120L`), controles `>= 44px`, estética blanca/neutra (`0` `amber-*`/`orange-*`), `0` emojis redundantes y `0 CRLF`.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero escritura en el repositorio vecino `C:\Users\sebas\Documents\Antigravity Files\Web Deco Vintage Proyect`.
- Cero conexión directa entre bases de datos PostgreSQL de ambos proyectos.
