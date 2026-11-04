# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-002` Sellada y `feat-003` Lista en Cola)
- **Tarea activa (`in-progress`):** Ninguna (`WIP = 0`; `feat-000`, `feat-001` y `feat-002` selladas en `done`).
- **Siguiente tarea secuencial lista para iniciar:** `feat-003` (*Ola 3: Desacoplamiento de Ventas y Eventos y Eliminación Total de `LEGACY_SERVER_ALLOWLIST 3 -> 0`*), cuyas dependencias (`["feat-002"]`) están en `done` con todos sus entregables físicos en disco. Al iniciar `feat-003` en Modo Crítico (`/goal`), el agente debe formalizar aquí su contrato específico antes de pasarla a `in-progress` (`WIP = 1`).

## Alcance Incluido del Último Hito Cerrado (`feat-002` — `Fair game`)
- **Cierres de caja (`server/services/sales/cashClosingService.js` y `server/controllers/cashClosingController.js`)**: extracción de `listEventCashClosings({ tenantId, eventId })` a `cashClosingService.js` y consumo directo desde `cashClosingController.js`, eliminando `import { prisma } from '../config/prisma.js'`.
- **Catálogo de productos (`server/services/catalogSyncService.js` y `server/controllers/catalogController.js`)**: exposición de `queryCatalogProducts({ tenantId, page, limit, search, category })` en `catalogSyncService.js` (`22L <= 25L`, preservando `deco-vintage-guate`, `descTokens` y re-exportaciones), eliminando el import directo a `prisma.js` en `catalogController.js` (`83L <= 90L`).
- **Autenticación OAuth/JWT (`server/services/authService.js` y `server/controllers/authController.js`)**: creación de `authService.js` (`183L <= 200L`) encapsulando `OAuth2Client`, firma JWT (`jwt.sign`), lecturas de `ENV` y consultas `prisma.{tenant,user}`, manteniendo en `authController.js` los invariantes Zero-Trust `A-12` (`!ENV.GOOGLE_CLIENT_ID`, `googleClient.verifyIdToken` y `0` `jwt` sin firma).
- **Gestión de usuarios multi-rol (`server/services/userService.js` y `server/controllers/userController.js`)**: creación de `userService.js` (`157L <= 200L`) encapsulando `ENV.SUPER_ADMIN_EMAILS` y consultas `prisma.user`, manteniendo `invalidateUserAuthCache` estrictamente en `userController.js` (`rango 5 -> 4`) y preservando `where: { id, tenantId: req.tenantId }`.
- **Reducción de deuda arquitectónica (`9 -> 3`)**: retiro de las 6 tuplas resueltas en `LEGACY_SERVER_ALLOWLIST` (`scripts/check-architecture.sh`) y actualización de `ARCHITECTURE.md` y `docs/QUALITY_SCORE.md` (`catalog` elevado `B -> A`).

## Exclusiones Explícitas (Qué NO se va a tocar bajo ninguna circunstancia)
- **Cero lectura o impresión de `.env`** (contiene credenciales reales de producción).
- **Cero modificaciones fuera de alcance**: prohibido alterar `src/`, `prisma/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore` o `entrypoint.sh`.
- **Cero despliegue remoto**: prohibido ejecutar `git push` o `npm run deploy` (únicamente `git commit` atómico local al cerrar cada hito verificado).
- **Cero auto-calificación o reutilización de Checker**: el *Maker* tiene prohibido rellenar puntajes en `evaluator-rubric.md` o enviar `send_message` a un *Checker* ya consumido (`1 Checker = 1 sola auditoría / one-shot`).

## Estándares de Verificación ("Hecho" significa exactamente esto)
1. Los 11 `required_files` de `feat-002` existen físicamente en disco con `0 CRLF`, respetan los techos de líneas y `LEGACY_SERVER_ALLOWLIST` se redujo de `9` a `3` tuplas.
2. `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` termina con `Exit code 0` (`100%` offline) y `Overall: 100/100` (`25/25 PASS`).
3. `npm run harness:check` termina en `HARNESS_PASS` (`STAND-IA-UNIFIED-HARNESS`) con `188` archivos sin secretos, `265` archivos JS verificados, `12/12` pruebas Zero-Trust, `253/253` pruebas unitarias en `104` suites y `vite build` en verde.
4. `feature_list.json` valida al `100%` contra `scripts/feature-list.schema.json` y el DAG secuencial (`feat-000..002` en `done`, `feat-003` en `not-started`, `WIP = 0`).
