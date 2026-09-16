# BRIEFING — 2026-09-16T00:18:00Z

## Mission
Implementar de forma genuina y rigurosa Cirugía 2.1 y Cirugía 2.2 (Fase 2: Motor de Búsqueda Híbrida y RAG Cero Contaminación): Sincronización universal de stop words (`UNIVERSAL_STOP_WORDS`), whitelist de entidades cortas (`KNOWN_SHORT_ENTITIES`), incorporación de entidades `Formula 1 - F1` y `Cristiano Ronaldo - CR7` con sus alias culturales en `entityAliases.js`, elevación del umbral vectorial a `>= 0.72`, sustitución de `.some` por cobertura estricta `every`, y compuerta de entidad raíz compartida en `embeddingService.js`, junto al reemplazo de `STOP_WORDS` en `webCatalogService.js`.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1
- Original parent: 1b9755bb-6609-409e-9161-fefd19278594
- Current parent: db233a73-dd6b-4945-8057-cdd1e9a20608
- Milestone: M1 (Fase 2: Cirugía 2.1 y Cirugía 2.2 - Búsqueda Híbrida y RAG Cero Contaminación)

## 🔒 Key Constraints
- Sole write ownership of assigned files:
  - `server/services/sales/saleNumberGenerator.js` (NEW)
  - `server/services/sales/saleTransactionService.js` (NEW)
  - `server/services/sales/saleKpiService.js` (NEW)
  - `server/services/sales/cashClosingService.js` (NEW)
  - `server/services/saleService.js` (CANONICAL FACADE < 35 lines)
  - `server/services/semantic/entityAliases.js` (NEW)
  - `server/services/semantic/paymentExtractor.js` (NEW)
  - `server/services/semanticParserService.js` (CANONICAL FACADE < 30 lines)
  - `server/services/productionService.js` (EXPANDED ~180 lines, zero mocks)
  - `server/controllers/productionController.js` (REDUCED ~120 lines, zero mocks, preserve catch(dbErr) res.status(500))
  - Exclusive write ownership for Phase 2:
    * `server/services/semantic/entityAliases.js` (ceiling <= 600 lines)
    * `server/services/webCatalogService.js` (keep intact, replace STOP_WORDS import)
    * `server/services/embeddingService.js` (ceiling <= 200 lines)
- DO NOT CHEAT: All implementations must be genuine, maintaining real state and behavior.
- Strictly adhere to line ceilings (`embeddingService.js` <= 200 lines, `entityAliases.js` <= 600 lines).
- Run all test suites and audit commands before reporting.

## Current Parent
- Conversation ID: db233a73-dd6b-4945-8057-cdd1e9a20608
- Updated: 2026-09-16T00:18:00Z

## Task Summary
- **What to build**:
  1. `entityAliases.js`: export `UNIVERSAL_STOP_WORDS` (54 terms) and `KNOWN_SHORT_ENTITIES` (`f1`, `u2`, `r34`, `go`, `up`, `cr7`). Add `Formula 1 - F1` (category `DEPORTES`) and `Cristiano Ronaldo - CR7` (category `FUTBOL`). Update `resolveEntityAlias` word boundary matching.
  2. `webCatalogService.js`: import `UNIVERSAL_STOP_WORDS` and re-export `UNIVERSAL_STOP_WORDS` and `KNOWN_SHORT_ENTITIES`.
  3. `embeddingService.js`: import constants and `resolveEntityAlias`. Compute `normQueryTokens` with fallback to `effectiveQuery` tokens. Raise complementary similarity threshold to `>= 0.72`. Use strict `every` match for vector candidates. Refactor `allSameTitle` to root canonical entity gate.
- **Success criteria**:
  - `node --test tests/ai/embeddingService.test.js`: PASS (17/17)
  - `node --test tests/adversarial/m1-embeddings-adversarial.test.js`: PASS (23/23)
  - `npm run audit:monoliths`: PASS (`embeddingService.js` 189 <= 200 lines, `entityAliases.js` 543 <= 600 lines)
  - Regression verified: `"muéstrame lo que tenemos de messi"` -> `['messi']`, `"f1"` retained and resolved.
  - `npm run test:security`: PASS (9/9)
  - `npm run audit:secrets`: PASS (0 leaks / 107 files)
  - `npm run build`: PASS (Vite 0 errors in 3.11s)

## Key Decisions Made
- `UNIVERSAL_STOP_WORDS` and `KNOWN_SHORT_ENTITIES` reside in `entityAliases.js` to avoid ESM circular dependency with `webCatalogService.js` and `embeddingService.js`.
- `MIN_SIMILARITY_THRESHOLD = 0.45` is preserved intact on line 6 of `embeddingService.js`. Only the complementary pure-vector threshold at line 147 is calibrated from `0.60` to `0.72`.
- `normQueryTokens` prioritizes meaningful tokens from the user's raw query (`rawTokens`), preventing multi-word expansion of `searchQuery` from demanding all expansion keywords on individual candidate posters.

## Artifact Index
- `.agents/worker_m1/DISPATCH.md` — Assignment instructions
- `.agents/worker_m1/BRIEFING.md` — Situational memory
- `.agents/worker_m1/progress.md` — Liveness and execution tracker
- `.agents/worker_m1/handoff.md` — Final deliverable handoff report
- `.agents/worker_m1/skills/cirugia-arquitectura-cero-deuda.md` — Local copy of skill
- `.agents/worker_m1/skills/aislamiento-estricto-proyectos.md` — Local copy of skill

## Change Tracker
- **Files modified**:
  - `server/services/semantic/entityAliases.js`: 543 lines (ceiling <= 600) — Added `UNIVERSAL_STOP_WORDS`, `KNOWN_SHORT_ENTITIES`, F1 & CR7 entities, updated `resolveEntityAlias`.
  - `server/services/webCatalogService.js`: 551 lines — Imported `UNIVERSAL_STOP_WORDS`, removed local Set, re-exported constants.
  - `server/services/embeddingService.js`: 189 lines (ceiling <= 200) — Added `normQueryTokens` with stop-word filter, 0.72 threshold, `every` match, root canonical entity gate.
- **Build status**: PASS (`npm run build` in 3.11s)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 100% PASS on required suites:
  - `node --test tests/ai/embeddingService.test.js`: 17/17 PASS
  - `node --test tests/adversarial/m1-embeddings-adversarial.test.js`: 23/23 PASS
  - `npm run test:security`: 9/9 PASS
  - `npm run audit:secrets`: 0 violations in 107 files
  - `npm run audit:monoliths`: 0 violations in modified files
- **Lint status**: 0 violations
- **Tests added/modified**: Verified all regression invariants via inline assertion harness

## Loaded Skills
- **Source**: `C:\Users\sebas\.gemini\config\skills\cirugia-arquitectura-cero-deuda\SKILL.md`
  - **Local copy**: `.agents/worker_m1/skills/cirugia-arquitectura-cero-deuda.md`
  - **Core methodology**: Protocolo quirúrgico de ingeniería, despacho de prompts blindados y erradicación de parches superficiales.
- **Source**: `C:\Users\sebas\.gemini\config\skills\aislamiento-estricto-proyectos\SKILL.md`
  - **Local copy**: `.agents/worker_m1/skills/aislamiento-estricto-proyectos.md`
  - **Core methodology**: Aislamiento estricto de base de datos e infraestructura, cero bases operativas compartidas.
