# BRIEFING — 2026-09-13T14:15:00Z

## Mission
Implementar quirúrgicamente el Hito M1: Modernización a Generación 3 Pura (`gemini-3.8-flash`), satélite `aiKeyPoolService.js` (< 120 líneas) con pool rotativo multi-key y cooldown 60s en 429, refactorización de `geminiPoolService.js` (<= 334 líneas), erradicación de modelos 1.5/2.5 en backend/config/docs, y actualización exhaustiva de suites de tests.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m1
- Original parent: 40958512-4854-45d9-bf41-45feacb902c8
- Current parent: 8032eb16-445b-4b60-9d2c-03db10d5b529
- Milestone: M1 (Backend Gen 3 Pura & Pool Rotativo Multi-Key)

## 🔒 Key Constraints
- Sole write ownership of the 7 orphan component files (historic)
- Sole write ownership of assigned files:
  - `server/config/env.js`
  - `server/services/ai/aiKeyPoolService.js` (NEW, < 120 lines)
  - `server/services/geminiPoolService.js` (STRICT: <= 334 lines)
  - `server/config/gemini.js`
  - `server/services/ai/aiClosedLoopService.js` (< 120 lines)
  - `server/services/ai/aiStreamService.js` (< 150 lines)
  - `server/controllers/aiController.js`
  - `server/services/llmObservabilityService.js`
  - `server/index.js`
  - `.env.example`
  - `docker-compose.yml`
  - `README.md`
  - `src/components/ai-chat/ChatHeader.jsx`
  - `tests/ai/gemini-key-pool.test.js` (NEW)
  - `tests/ai/gemini-pool.test.js`
  - `tests/adversarial/m4-pool-resilience-adversarial.test.js`
  - `tests/ai/m4-challenger2-adversarial.test.js`
  - `tests/m3-forensic-audit.test.js`
- Techos presupuestarios inviolables:
  - `aiKeyPoolService.js` < 120 líneas
  - `geminiPoolService.js` <= 334 líneas
  - `aiClosedLoopService.js` < 120 líneas
  - `aiStreamService.js` < 150 líneas
- Aislamiento sagrado: Operación exclusiva en `Modulo_Ventas` y `deko_eventsales_db`.
- Cero mocks en producción; pruebas unitarias con simulación en memoria controlada.
- Cumplimiento inquebrantable de `test:security` y `audit:monoliths`.

## Current Parent
- Conversation ID: 8032eb16-445b-4b60-9d2c-03db10d5b529
- Updated: 2026-09-13T14:15:00Z

## Task Summary
- **What to build**: Modernización Gen 3 Pura (3.8, 3.7, 3.6, 3.5, 3.1-lite), pool multi-key con detección `GEMINI_API_KEYS`, Round-Robin, cooldown 60s ante 429, caché de instancias `@google/genai`, erradicación total de referencias 1.5/2.5 y test suites adaptadas.
- **Success criteria**:
  - `aiKeyPoolService.js` creado (< 120 lín) y probado al 100%.
  - `geminiPoolService.js` integrado y <= 334 líneas.
  - Cero ocurrencias de 1.5/2.5 en backend, config y docs.
  - `npm run test:security` pasa (9/9).
  - `npm run audit:monoliths` pasa sin exceder 334 líneas en geminiPoolService.
- **Interface contracts**: `SCOPE.md` § Interface Contracts
- **Code layout**: `SCOPE.md` § Code Layout

## Key Decisions Made
- `aiKeyPoolService.js` operará con un mapa de cooldown (`Map<string, number>`), puntero Round-Robin, y parseo transparente de `GEMINI_API_KEYS` con fallback a `GEMINI_API_KEY`.
- En `geminiPoolService.js`, se compactarán clasificadores booleanos y comentarios para permitir integrar el loop de reintento multi-key manteniéndose holgadamente en <= 334 líneas.

## Artifact Index
- `.agents/worker_m1/DISPATCH.md` — Asignación de tareas
- `.agents/worker_m1/BRIEFING.md` — Memoria situacional
- `.agents/worker_m1/progress.md` — Heartbeat de progreso
- `.agents/worker_m1/handoff.md` — Reporte de entrega

## Change Tracker
- **Files modified**:
  - `server/config/env.js`: Añadido `GEMINI_API_KEYS`, default `gemini-3.8-flash` (94 lín).
  - `server/services/ai/aiKeyPoolService.js`: Satélite nuevo con Round-Robin, cooldown 60s en 429, caché de instancias (68 lín).
  - `server/services/geminiPoolService.js`: Refactorizado con Gen 3 pool y reintento multi-key (311 lín <= 334).
  - `server/config/gemini.js`: Integrado con getNextClient() del pool multi-key (28 lín).
  - `server/services/ai/aiClosedLoopService.js`: Erradicado 1.5 -> gemini-3.8-flash (104 lín).
  - `server/services/ai/aiStreamService.js`: Erradicado 1.5 -> gemini-3.8-flash (130 lín).
  - `server/controllers/aiController.js`: Erradicado 1.5/2.5 en 5 puntos -> gemini-3.8-flash (429 lín).
  - `server/services/llmObservabilityService.js`: Pricing y defaults Gen 3 actualizados.
  - `server/index.js`: Diagnostic endpoints actualizados a Gen 3.
  - `.env.example`, `.env`, `docker-compose.yml`, `README.md`: Modelos actualizados a gemini-3.8-flash y GEMINI_API_KEYS.
  - `src/components/ai-chat/ChatHeader.jsx`: Badge actualizado a Gemini 3.8 Flash.
  - `prisma/schema.prisma`: Comentario purgado a gemini-3.8-flash.
  - Tests: `gemini-key-pool.test.js` (nuevo), `gemini-pool.test.js`, `m4-pool-resilience-adversarial.test.js`, `m4-challenger2-adversarial.test.js`, `m3-forensic-audit.test.js`.
- **Build status**: PASS
- **Pending issues**: Ninguno

## Quality Status
- **Build/test result**: 100% PASS
  - `tests/ai/gemini-key-pool.test.js`: 12/12 PASS
  - `tests/ai/gemini-pool.test.js`: 18/18 PASS
  - `tests/adversarial/m4-pool-resilience-adversarial.test.js`: 17/17 PASS
  - `tests/ai/m4-challenger2-adversarial.test.js`: 19/19 PASS
  - `tests/m3-forensic-audit.test.js`: 35/35 PASS
  - `npm run test:security`: 9/9 PASS
  - `npm run audit:monoliths`: PASS (`geminiPoolService.js` en 311 líneas <= 334 límite)
- **Lint status**: 0 violations
- **Tests added/modified**: 12 nuevos tests en `tests/ai/gemini-key-pool.test.js` + 4 suites actualizadas.

## Loaded Skills
- **Source**: `C:\Users\sebas\.gemini\config\skills\cirugia-arquitectura-cero-deuda\SKILL.md`
- **Source**: `C:\Users\sebas\.gemini\config\skills\aislamiento-estricto-proyectos\SKILL.md`
- **Source**: `C:\Users\sebas\.gemini\config\skills\gemini-auth-keys\SKILL.md`
