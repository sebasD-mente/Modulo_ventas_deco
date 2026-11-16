# Session Handoff

## Current Objective
- **Goal:** Desplegar `feat-010` a producción (sin botón ni endpoint destructivo) y ejecutar `feat-011`: limpieza única en 0 en el VPS de producción restringida estrictamente a `eventId = 'evt-ventas-redes-online'` (`VENDEDOR_REDES`).
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..010` en `done`; `feat-011` en `not-started`; `Overall: 100/100`).
- **Branch / commit:** `main` (pendiente commit/despliegue de `feat-010`).

## Context & Incident Note (Para la nueva sesión)
- `feat-010` completada: retirados el botón `"Reiniciar en 0"` de `EventsManagementView.jsx`, el endpoint `POST /api/sales/purge-online-test-data` y `purgeOnlinePosTestDataTransaction`, preservando la protección `403` sobre `evt-ventas-redes-online` en `purgeEventSalesTransaction`.
- `scripts/reset-online-pos-test-data.js` quedó autocontenido y endurecido para operar **únicamente** sobre `eventId: 'evt-ventas-redes-online'`, sin tocar ninguna venta de stands físicos (`POS_FERIA`) ni otros eventos.

## Blockers / Risks
- `DATABASE_URL` en el entorno local no apunta al PostgreSQL de producción (VPS Dokploy). La limpieza única (`feat-011`) requiere autorización explícita del usuario para desplegar (`npm run deploy`) y ejecutar el comando único dentro del contenedor/VPS de Dokploy.

## Recommended Next Step
1. Confirmar con el usuario el despliegue de `feat-010` (`npm run deploy`) y la ejecución única de `node scripts/reset-online-pos-test-data.js --confirm` en la terminal del contenedor en Dokploy.
2. Verificar en vivo `GET /api/events` y `GET /api/sales/events/evt-ventas-redes-online` para cerrar `feat-011`.
