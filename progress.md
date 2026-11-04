# Session Progress Log

## Current State

**Last Updated:** 2026-11-04 16:56
**Session ID:** sesion-002 (Ola 1 Completada: `feat-001` Desacoplamiento Config IA y Webhook, `LEGACY_SERVER_ALLOWLIST 13 -> 9`)
**Active Feature:** Ninguna (`WIP = 0`; `feat-000` y `feat-001` en `done`, olas `feat-002 -> feat-003` en `not-started`)
**Standard Startup Path:** `bash ./init.sh`
**Standard Verification Path:** `bash ./init.sh`

## Status

### What's Done
- [x] **Hito Base `feat-000` (Arnés Brownfield Certificado `12/12 ACEPTAR`)**: Higiene de raíz, instalación con `0 CRLF` de los 28 artefactos certificados, adaptación de `ARCHITECTURE.md`, `docs/QUALITY_SCORE.md` y `scripts/check-architecture.sh` (`13` tuplas iniciales en `LEGACY_SERVER_ALLOWLIST`), unificación de `init.sh` y `scripts/audit-harness.js`, y auditoría independiente `Checker` `one-shot` (`27bb88dc`: `12/12 ACEPTAR`).
- [x] **Ola 1 `feat-001` (`LEGACY_SERVER_ALLOWLIST 13 -> 9` y Capa `Config` en `A`)**: Extraído `server/config/geminiKeyPool.js` para dejar `server/config/gemini.js` con `0` dependencias hacia capas superiores y singleton compartido vía re-exportación en `server/services/ai/aiKeyPoolService.js`; expuesto `getDefaultGeminiModel()` en `server/services/geminiPoolService.js` eliminando los saltos a `env.js` en `aiChatController.js` y `aiMediaController.js` (`0` líneas netas añadidas); encapsulado `isCatalogWebhookAuthorized(req)` en `server/services/catalog/liveCatalogSyncService.js` eliminando el salto a `env.js` en `catalogWebhookController.js`; reducida `LEGACY_SERVER_ALLOWLIST` de `13` a `9` tuplas y elevada la capa `Config` de `B` a `A` en `docs/QUALITY_SCORE.md`.

### What's In Progress
- Ninguna tarea en curso (`WIP = 0`).

### What's Next
1. En la siguiente sesión, tomar **`feat-002`** (*Ola 2: Extracción a Capa Service en Cierres, Catálogo, Auth y Usuarios, `9 -> 3`*), actualizar `sprint-contract.md` con su alcance específico, cambiar `feat-002` a `in-progress` (`WIP = 1`), implementarla y verificar `bash ./init.sh` + `npm run harness:check`.
2. Cerrar con **`feat-003`** (`3 -> 0` en Modo Crítico `/goal` con Checker `one-shot` virgen).

## Blockers / Risks
- Ninguno activo (`0` lectura de `.env`; `0` regresiones en las `104` suites unitarias ni en SSE/Zero-Trust).
- **Guardarraíles activos para `feat-002` y `feat-003`**: mantener `invalidateUserAuthCache` (`server/middleware/authMiddleware.js`, rango `4`) invocado desde controladores (`rango 5`) y nunca desde `server/services/` (`rango 3`), y preservar las aserciones estáticas `readFileSync` de `tests/m2-forensic-audit.test.js`, `tests/security/m2-zero-trust-challenger.test.js` y `tests/m2-hardening-verification.test.js`.

## Decisions Made
- **Re-exportación del Singleton `geminiKeyPool.js` desde `aiKeyPoolService.js` (`feat-001`)**:
  - Context: `12` suites de IA y streaming SSE mutan métodos sobre la instancia devuelta por `getGeminiClient()` esperando que `streamWithModelFallback` (`geminiPoolService.js` -> `aiKeyPoolService.js`) reutilice exactamente el mismo `clientCache` y `cooldownMap`.
  - Alternatives considered: Duplicar el caché en `config/` y `services/` (descartado porque rompería la identidad referencial de los mocks en `tests/streaming/ai-chat-controller-sse.test.js`); mover `getGeminiClient` fuera de `server/config/gemini.js` (descartado porque obligaría a alterar imports de `12` suites existentes). Al alojar el estado único en `server/config/geminiKeyPool.js` (`rango 2`) y re-exportarlo en `aiKeyPoolService.js` (`rango 3 -> 2`), se respeta la jerarquía estricta de capas con compatibilidad 100%.
- **Encapsulamiento de `isCatalogWebhookAuthorized` en `liveCatalogSyncService.js`**:
  - Context: `catalogWebhookController.js` leía `CATALOG_WEBHOOK_SECRET` y `JWT_SECRET` directamente de `server/config/env.js`.
  - Alternatives considered: Crear un servicio separado solo para el secreto del webhook (descartado por fragmentación innecesaria dado que `liveCatalogSyncService.js` ya importa `env.js` y es re-exportado automáticamente por `catalogSyncService.js`).

## Files Modified This Session
- `server/config/geminiKeyPool.js` (nuevo), `server/config/gemini.js`, `server/services/ai/aiKeyPoolService.js`, `server/services/geminiPoolService.js` — Pool de llaves Gemini en capa `Config` y `getDefaultGeminiModel()` en `Service`.
- `server/controllers/ai/aiChatController.js`, `server/controllers/ai/aiMediaController.js` — Eliminado import directo a `server/config/env.js` (`0` líneas añadidas en `aiMediaController.js`).
- `server/services/catalog/liveCatalogSyncService.js`, `server/controllers/catalogWebhookController.js` — Autorización de webhook encapsulada en capa `Service`.
- `scripts/check-architecture.sh`, `ARCHITECTURE.md`, `docs/QUALITY_SCORE.md` — `LEGACY_SERVER_ALLOWLIST` reducida `13 -> 9` y capa `Config` elevada `B -> A`.
- `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` — Sincronizados en estado limpio (`feat-001` en `done`, `WIP = 0`, `0 CRLF`).

## Verification Evidence
- [x] Puertas 1-3 (`init.sh` offline tras completar `feat-001`): `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` -> `command and output verified: Exit code 0 (CLEAN STATE), Puerta 1 OK (check-architecture con 9 tuplas congeladas + audit-secrets 186 archivos + verify-gemini-models), Puerta 2 Overall: 100/100 (25/25 PASS), Puerta 3 zero-trust 12/12 pass + vite build 1566 modules transformed`
- [x] Compuerta Física Unificada (`npm run harness:check`): `npm run harness:check` -> `command and output verified: HARNESS_PASS (STAND-IA-UNIFIED-HARNESS, 34.21s: check-architecture PASS, validate-harness 100/100, audit-secrets 186 files PASS, audit-syntax 263 files PASS, verify-gemini-models PASS, zero-trust 12/12 PASS, test:unit 253/253 tests across 104 suites PASS, vite build PASS)`
- [x] Suites focalizadas SSE, Pool IA y Contratos Webhook/Singleton: `node --test tests/streaming/ai-chat-controller-sse.test.js tests/ai/gemini-pool.test.js tests/security/zero-trust.test.js` -> `command and output verified: PASS (identidad de singleton clientCache preservada, HTTP 401/200 en webhook y 0 CRLF)`

## Notes for Next Session
Ejecuta `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` al iniciar la siguiente sesión, formaliza `sprint-contract.md` para `feat-002`, marca `feat-002` como `in-progress` (`WIP = 1`) y ejecuta la Ola 2 (`9 -> 3`).
