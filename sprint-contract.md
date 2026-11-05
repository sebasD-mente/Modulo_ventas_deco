# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-000..003` Completadas y Certificadas `12/12 ACEPTAR`)
- **Tarea activa (`in-progress`):** Ninguna (`WIP = 0`; `feat-000`, `feat-001`, `feat-002` y `feat-003` selladas en `done`).
- **Estado arquitectónico alcanzado:** `0` excepciones en `scripts/check-architecture.sh` (`LEGACY_SERVER_ALLOWLIST` eliminada por completo: `13 -> 9 -> 3 -> 0`), con `10/10` dominios y `6/6` capas en calificación `A` dentro de `docs/QUALITY_SCORE.md`.
- **Siguiente tarea secuencial:** Lista para registrar `feat-004` bajo `WIP = 1` cuando el usuario solicite una nueva mejora de negocio.

## Alcance Cerrado y Certificado (`feat-003` — `Fair game`)
- **Desacoplamiento de Ventas (`server/services/sales/orderTrackingService.js`, `server/services/saleService.js` y `server/controllers/saleController.js`)**:
  - Extraídas las consultas de evento archivado (`prisma.event.findFirst`), listado/métricas de seguimiento de pedidos (`prisma.sale.{count,findMany,aggregate}`) y actualización logística con auditoría forense (`prisma.sale.{findFirst,update}` + `prisma.auditLog.create`) hacia `server/services/sales/orderTrackingService.js` (`189L`), re-exportadas desde `server/services/saleService.js` (`19L < 35L`).
  - Eliminado `import { prisma } from '../config/prisma.js'` en `server/controllers/saleController.js` (`154L <= 160L`), preservando sus 10 símbolos exportados, códigos HTTP `200/201/400/403/404/500`, el aislamiento de `getMonitorMetrics` y los contratos `surgery-056`.
- **Desacoplamiento de Eventos (`server/services/eventFinanceService.js`, `server/services/eventService.js` y `server/controllers/eventController.js`)**:
  - Expuestos `computeEventFinancialSummary` y `loadTenantEventsFinancialMaps` en `server/services/eventFinanceService.js` y creado `server/services/eventService.js` (`274L`, `rango 3`) para encapsular `ENV.NODE_ENV`, `prisma.$transaction` y todas las consultas Prisma fuera de `eventController.js` (`183L <= 190L`), conservando `invalidateUserAuthCache()` en capa `Controller` (`rango 5 -> 4`).
- **Eliminación total de deuda arquitectónica (`LEGACY_SERVER_ALLOWLIST 3 -> 0`)**:
  - Suprimida por completo `LEGACY_SERVER_ALLOWLIST` en `scripts/check-architecture.sh` (`0` excepciones permitidas) y actualizados `ARCHITECTURE.md` y `docs/QUALITY_SCORE.md` (`events: A`, `Runtime Backend: A`).

## Exclusiones Explícitas Respetadas
- **Cero lectura o impresión de `.env`**.
- **Cero modificaciones fuera de alcance (`Hands off`)**: `0` cambios en `src/`, `prisma/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `entrypoint.sh`, `init.sh`, `scripts/validate-harness.mjs`, `scripts/lib/harness-utils.mjs`, `goal.md` o `AGENTS.md`.
- **Cero despliegue remoto sin autorización explícita**: prohibido ejecutar `git push` o `npm run deploy` hasta orden expresa del usuario.
- **Separación estricta Maker-Checker**: `evaluator-rubric.md` auditada y calificada (`12/12 ACEPTAR`) por la instancia virgen `one-shot` `29a7daf5-e1c0-47bc-9de9-18748529c807` (`0` llamadas `send_message`).

## Estándares de Verificación Cumplidos
1. Los `11` `required_files` de `feat-003` existen físicamente en disco con `0 CRLF` y cumplen todos los techos de líneas (`saleService.js 19L < 35L`, `saleController.js 154L <= 160L`, `eventController.js 183L <= 190L`).
2. `bash ./init.sh`, `bash scripts/check-architecture.sh` y `node scripts/validate-harness.mjs --min-score 100` finalizan con `Exit code 0` (`Overall: 100/100`, `25/25 PASS`).
3. `npm run harness:check` finaliza en `HARNESS_PASS` (`STAND-IA-UNIFIED-HARNESS`: `190` archivos sin secretos, `267` JS sintaxis OK, `12/12` Zero-Trust, `253/253` unit tests en `104` suites y `vite build` en verde).
4. Sub-agente *Checker* `one-shot` virgen (`29a7daf5`) otorgó `✅ Pass — 12 / 12 ACEPTAR` en `evaluator-rubric.md`.
