# Session Progress Log

## Current State

**Last Updated:** 2026-11-04 17:10
**Session ID:** sesion-003 (Ola 2 Completada: `feat-002` Extracción a Capa Service en Cierres, Catálogo, Auth y Usuarios, `LEGACY_SERVER_ALLOWLIST 9 -> 3`)
**Active Feature:** Ninguna (`WIP = 0`; `feat-000`, `feat-001` y `feat-002` en `done`, cierre final `feat-003` en `not-started`)
**Standard Startup Path:** `bash ./init.sh`
**Standard Verification Path:** `bash ./init.sh`

## Status

### What's Done
- [x] **Hito Base `feat-000` (Arnés Brownfield Certificado `12/12 ACEPTAR`)**: Higiene de raíz, instalación con `0 CRLF` de los 28 artefactos certificados, adaptación de `ARCHITECTURE.md`, `docs/QUALITY_SCORE.md` y `scripts/check-architecture.sh` (`13` tuplas iniciales en `LEGACY_SERVER_ALLOWLIST`), unificación de `init.sh` y `scripts/audit-harness.js`, y auditoría independiente `Checker` `one-shot` (`27bb88dc`: `12/12 ACEPTAR`).
- [x] **Ola 1 `feat-001` (`LEGACY_SERVER_ALLOWLIST 13 -> 9` y Capa `Config` en `A`)**: Extraído `server/config/geminiKeyPool.js`, expuesto `getDefaultGeminiModel()` en `geminiPoolService.js` y encapsulado `isCatalogWebhookAuthorized(req)` en `liveCatalogSyncService.js`, dejando la capa `Config` con `0` dependencias hacia arriba.
- [x] **Ola 2 `feat-002` (`LEGACY_SERVER_ALLOWLIST 9 -> 3` y Dominio `catalog` en `A`)**: Trasladado `listEventCashClosings` a `server/services/sales/cashClosingService.js` limpiando `cashClosingController.js`; expuesto `queryCatalogProducts` en `server/services/catalogSyncService.js` (`22L <= 25L`) limpiando `catalogController.js` (`83L <= 90L`); creado `server/services/authService.js` (`183L <= 200L`) encapsulando OAuth/JWT, `ENV` y `prisma.{tenant,user}` para limpiar `authController.js` preservando los invariantes Zero-Trust `A-12`; creado `server/services/userService.js` (`157L <= 200L`) encapsulando `ENV.SUPER_ADMIN_EMAILS` y `prisma.user` para limpiar `userController.js` manteniendo `invalidateUserAuthCache` en capa `Controller` (`rango 5 -> 4`); reducida `LEGACY_SERVER_ALLOWLIST` de `9` a `3` tuplas en `scripts/check-architecture.sh` y actualizados `ARCHITECTURE.md` y `docs/QUALITY_SCORE.md`.

### What's In Progress
- Ninguna tarea en curso (`WIP = 0`).

### What's Next
1. En la siguiente sesión, ejecutar **`feat-003`** (*Ola 3: Desacoplamiento de Ventas y Eventos y Eliminación Total de `LEGACY_SERVER_ALLOWLIST 3 -> 0`*) bajo **Modo Crítico (`/goal`)**: actualizar `sprint-contract.md` y `loop-state.md`, pasar `feat-003` a `in-progress` (`WIP = 1`), extraer el acceso a `prisma` y `ENV` de `saleController.js` y `eventController.js` hacia `saleService.js` y `eventService.js`, eliminar `LEGACY_SERVER_ALLOWLIST` (`0` excepciones), verificar `init.sh` + `npm run harness:check` y auditar con un sub-agente *Checker* `one-shot` virgen (`zero-inheritance`).

## Blockers / Risks
- Ninguno activo (`0` lectura de `.env`; `0` regresiones en las `104` suites unitarias ni en suites forenses Zero-Trust).
- **Guardarraíles activos para `feat-003`**: mantener `invalidateUserAuthCache` (`server/middleware/authMiddleware.js`, rango `4`) invocado desde `eventController.js` (`rango 5`) y nunca desde `server/services/` (`rango 3`), y preservar los códigos HTTP `400/403/404/409` y contratos estáticos de `surgery-{053,056,060}` (`const hasRel = Array.isArray(ev.assignedSellers);` en `eventController.js`).

## Decisions Made
- **Exposición acotada de `authEnv` (`GOOGLE_CLIENT_ID` read-only) y `googleClient` desde `authService.js` (`feat-002`)**:
  - Context: Las suites forenses `tests/m2-forensic-audit.test.js`, `tests/sales/sales-adversarial.test.js` y `tests/security/m2-zero-trust-challenger.test.js` verifican estática y dinámicamente que `authController.js` compruebe `if (!ENV.GOOGLE_CLIENT_ID)` y ejecute `googleClient.verifyIdToken(...)` sin tocar `jwt.decode`.
  - Alternatives considered: Mover toda la verificación de `idToken` fuera de `authController.js` ocultando el patrón con comentarios (descartado por ser frágil/engañoso); mantener el import a `server/config/env.js` (descartado porque impediría eliminar la tupla `authController -> env.js`). Exponer en `authService.js` el adaptador inmutable `authEnv` (solo `GOOGLE_CLIENT_ID`, sin exponer `JWT_SECRET` ni `DATABASE_URL`) y `googleClient` permite validación criptográfica ejecutable real en el controlador respetando `Controller (5) -> Service (3) -> Config (2)`.
- **Frontera explícita `where: { id, tenantId: req.tenantId }` e `invalidateUserAuthCache` en `userController.js` (`feat-002`)**:
  - Context: `server/middleware/authMiddleware.js` tiene rango `4` superior a `server/services/` (`rango 3`), y `tests/m2-hardening-verification.test.js` audita que `userController.js` exija `where: { id, tenantId: req.tenantId }` en mutaciones.
  - Alternatives considered: Importar `invalidateUserAuthCache` dentro de `userService.js` (descartado porque rompería el orden direccional estricto `3 -> 4`); construir `where` únicamente dentro del servicio (descartado porque debilitaría la visibilidad multitenant auditada en el borde HTTP).

## Files Modified This Session
- `server/services/sales/cashClosingService.js`, `server/controllers/cashClosingController.js` — `listEventCashClosings` movido a capa `Service`.
- `server/services/catalogSyncService.js`, `server/controllers/catalogController.js` — `queryCatalogProducts` expuesto en fachada `Service` (`22L <= 25L`, controlador en `83L <= 90L`).
- `server/services/authService.js` (nuevo), `server/controllers/authController.js` — OAuth/JWT, `ENV` y `prisma.{tenant,user}` encapsulados en capa `Service` (`183L <= 200L`).
- `server/services/userService.js` (nuevo), `server/controllers/userController.js` — Reglas `SUPER_ADMIN_EMAILS` y CRUD `prisma.user` encapsulados en `Service` (`157L <= 200L`), manteniendo `invalidateUserAuthCache` en `Controller`.
- `scripts/check-architecture.sh`, `ARCHITECTURE.md`, `docs/QUALITY_SCORE.md` — `LEGACY_SERVER_ALLOWLIST` reducida `9 -> 3` y dominio `catalog` elevado `B -> A`.
- `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` — Sincronizados en estado limpio (`feat-002` en `done`, `WIP = 0`, `0 CRLF`).

## Verification Evidence
- [x] Puertas 1-3 (`init.sh` offline tras completar `feat-002`): `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` -> `command and output verified: Exit code 0 (CLEAN STATE), Puerta 1 OK (check-architecture con 3 tuplas congeladas + audit-secrets 188 archivos + verify-gemini-models), Puerta 2 Overall: 100/100 (25/25 PASS), Puerta 3 zero-trust 12/12 pass + vite build 1566 modules transformed`
- [x] Compuerta Física Unificada (`npm run harness:check`): `npm run harness:check` -> `command and output verified: HARNESS_PASS (STAND-IA-UNIFIED-HARNESS, 30.42s: check-architecture PASS, validate-harness 100/100, audit-secrets 188 files PASS, audit-syntax 265 files PASS, verify-gemini-models PASS, zero-trust 12/12 PASS, test:unit 253/253 tests across 104 suites PASS, vite build PASS)`
- [x] Contratos forenses, de comportamiento y rechazo Bolígrafo Rojo (`os.tmpdir()`): `node --test tests/m2-forensic-audit.test.js tests/m2-hardening-verification.test.js tests/security/m2-zero-trust-challenger.test.js` + sandbox `os.tmpdir()` -> `command and output verified: ALL_BEHAVIORAL_AND_RED_PEN_CONTRACTS_PASS (A-12, P0-7 5.2, HTTP 200/400/401/403 y rechazo de 4.ª tupla con ERROR/POR QUÉ/SOLUCIÓN)`

## Notes for Next Session
Ejecuta `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` al iniciar la siguiente sesión y aborda **`feat-003`** en Modo Crítico (`/goal`) con `loop-state.md` y sub-agente *Checker* `one-shot` aislado para eliminar por completo `LEGACY_SERVER_ALLOWLIST` (`3 -> 0`).
