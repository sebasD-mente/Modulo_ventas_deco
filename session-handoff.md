# Session Handoff

## Current Objective
- **Goal:** Completada y certificada `feat-022` (`sesion-033`), construyendo el backend completo de integración S2S de la Bandeja de Pedidos Web (`WebOrderInbox`, webhook en tiempo real `POST /api/webhooks/web-orders`, sincronización Pull bajo demanda, descarte/restauración y cierre atómico en `createRemoteSaleTransaction` con candado `HTTP 409` y sello `[Origen Web: #CP-XXXX]`). Listo el repositorio para ejecutar `feat-023` (UI `"Bandeja Web"` + botón `"Importar Pedido Web"` con ventana flotante de selección).
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..022` en `done`; `feat-023` en `not-started`; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-022` verificada con `0 CRLF`, `43/43` suite S2S/Prisma/Zero-Trust, `265/265` unit tests, `53/53` voice tests y `HARNESS_PASS`).

## Completed This Session
- [x] Añadido `model WebOrderInbox` (`@@map("web_order_inbox")`) en `prisma/schema.prisma` (`@@unique([tenantId, orderNumber])`, `0` colisiones de índices, `npx prisma generate` `< 2500ms`), `server/validators/webOrderValidators.js`, soporte de `webOrderInboxId` / `webOrderNumber` en `server/validators/remoteSaleValidators.js` y `WEB_ORDERS_WEBHOOK_SECRET` en `server/config/env.js`.
- [x] Implementado `server/services/sales/webOrderInboxService.js` con autorización S2S en tiempo constante (`crypto.timingSafeEqual`), normalización de materiales (`mdf -> MDF_5_5MM`, `pvc -> PVC_5MM`, `vinyl_only -> VINILO_SOLO`), medidas decimales (`42.2 x 30 cm`), URLs absolutas `https://...`, resolución de `productId` local por `sku`, upsert idempotente que jamás revierte `IMPORTADO` o `DESCARTADO`, `syncWebOrdersFromWeb`, `listWebOrders`, `discardWebOrder`, `restoreWebOrder` y `notifyWebOrderStatus`.
- [x] Integrado en `createRemoteSaleTransaction` (`server/services/sales/remoteSaleService.js`) el marcado transaccional atómico `IMPORTADO` con protección anti-TOCTOU (`HTTP 409`), sello `[Origen Web: #CP-XXXX]` en `sale.notes` y notificación S2S tras el commit.
- [x] Expuestos los endpoints en `server/controllers/webOrderInboxController.js` (`0` saltos `Controller -> Config`) y `server/routes/apiRoutes.js`, y certificada la suite `tests/sales/web-orders-inbox-service.test.js` (`43/43 PASS` con `schema-robustness` y `zero-trust`, `HARNESS_PASS` y `bash ./init.sh` `100/100`).

## Blockers / Risks
- Ninguno para continuar con `feat-023`. Recordar en `feat-023` mantener estrictamente los techos de líneas (`Header.jsx <= 280L`, `FastManualSaleForm.jsx <= 350L`, `useRemoteSaleForm.js <= 350L`, `WebOrdersImportModal.jsx <= 280L`, `WebOrdersInboxView.jsx <= 280L`, `WebOrderImportBanner.jsx <= 120L`), cero precarga automática al entrar, cero clases `amber-*`/`orange-*` y controles `>= 44px`.

## Files Touched
- `prisma/schema.prisma`
- `server/config/env.js`
- `server/validators/webOrderValidators.js`
- `server/validators/remoteSaleValidators.js`
- `server/services/sales/webOrderInboxService.js`
- `server/services/sales/remoteSaleService.js`
- `server/controllers/webOrderInboxController.js`
- `server/routes/apiRoutes.js`
- `tests/sales/web-orders-inbox-service.test.js`
- `ARCHITECTURE.md`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar la siguiente sesión ejecutando `bash ./init.sh`, pasar **`feat-023`** a `"status": "in-progress"` (`WIP = 1`), actualizar `sprint-contract.md` e implementar la pestaña `"Bandeja Web"` + el botón `"Importar Pedido Web"` con ventana flotante `WebOrdersImportModal.jsx` y precarga limpia al formulario.
