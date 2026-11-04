# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-001` Sellada y `feat-002` Lista en Cola)
- **Tarea activa (`in-progress`):** Ninguna (`WIP = 0`; `feat-000` y `feat-001` selladas en `done`).
- **Siguiente tarea secuencial lista para iniciar:** `feat-002` (*Ola 2: Extracción a Capa Service en Cierres, Catálogo, Auth y Usuarios, `LEGACY_SERVER_ALLOWLIST 9 -> 3`*), cuyas dependencias (`["feat-001"]`) están en `done` con todos sus entregables físicos en disco. Al abrir la siguiente sesión, el agente debe formalizar aquí el contrato específico de `feat-002` antes de pasarla a `in-progress` (`WIP = 1`).

## Alcance Incluido del Último Hito Cerrado (`feat-001` — `Fair game`)
- **Extracción del pool de llaves Gemini a capa `Config` (`server/config/geminiKeyPool.js`)**: reubicación del pool puro de rotación y cooldown de llaves (`getAvailableKeys`, `isKeyInCooldown`, `markKeyCooldown`, `getClientForKey`, `getNextClient`, `resetKeyPool`) en `server/config/geminiKeyPool.js` dependiendo solo de `@google/genai` y `./env.js`, actualización de `server/config/gemini.js` conservando intacto `getGeminiClient` y re-exportación 100% compatible del mismo singleton en `server/services/ai/aiKeyPoolService.js`.
- **Exposición de modelo Gemini por defecto en capa `Service` (`server/services/geminiPoolService.js`)**: exportación de `getDefaultGeminiModel()` en `geminiPoolService.js` y eliminación de `import { ENV } from '../../config/env.js'` en `server/controllers/ai/aiChatController.js` y `server/controllers/ai/aiMediaController.js` (`+7/-7`, `0` líneas netas agregadas).
- **Encapsulamiento de autorización del webhook de catálogo (`server/services/catalog/liveCatalogSyncService.js`)**: extracción de `isCatalogWebhookAuthorized(req)` (`timingSafeEqual` sobre `CATALOG_WEBHOOK_SECRET` / `JWT_SECRET` + verificación JWT `SUPER_ADMIN`) a `liveCatalogSyncService.js`, eliminando el salto a `env.js` en `server/controllers/catalogWebhookController.js` y manteniendo `handleCatalogWebhook`.
- **Reducción de deuda arquitectónica y observabilidad (`13 -> 9`)**: retiro de las 4 tuplas resueltas en `LEGACY_SERVER_ALLOWLIST` (`scripts/check-architecture.sh`), actualización de `ARCHITECTURE.md` y elevación de la capa `Config` de `B` a `A` en `docs/QUALITY_SCORE.md`.

## Exclusiones Explícitas (Qué NO se va a tocar bajo ninguna circunstancia)
- **Cero lectura o impresión de `.env`** (contiene credenciales reales de producción).
- **Cero modificaciones en infraestructura de despliegue o esquema de BD**: prohibido alterar `prisma/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `entrypoint.sh` o `test_evidence/prod_*.png`.
- **Cero despliegue remoto**: prohibido ejecutar `git push` o `npm run deploy` (únicamente `git commit` atómico local al cerrar cada hito verificado).
- **Cero auto-calificación o reutilización de Checker**: el *Maker* tiene prohibido rellenar puntajes en `evaluator-rubric.md` o enviar `send_message` a un *Checker* ya consumido (`1 Checker = 1 sola auditoría / one-shot`).

## Estándares de Verificación ("Hecho" significa exactamente esto)
1. Los 11 `required_files` de `feat-001` existen físicamente en disco con `0 CRLF` y `LEGACY_SERVER_ALLOWLIST` se redujo de `13` a `9` tuplas (`0` dependencias hacia arriba en `server/config/`).
2. `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` termina con `Exit code 0` (`100%` offline) y `Overall: 100/100` (`25/25 PASS`).
3. `npm run harness:check` termina en `HARNESS_PASS` (`STAND-IA-UNIFIED-HARNESS`) con `263` archivos JS verificados, `12/12` pruebas Zero-Trust, `253/253` pruebas unitarias en `104` suites y `vite build` en verde.
4. `feature_list.json` valida al `100%` contra `scripts/feature-list.schema.json` y el DAG secuencial (`feat-000` y `feat-001` en `done`, `feat-002 -> feat-003` en `not-started`, `WIP = 0`).
