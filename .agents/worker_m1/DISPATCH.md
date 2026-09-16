# DISPATCH — Worker M1 (Motor de Búsqueda Híbrida y RAG Cero Contaminación)

## Identity & Role
- Archetype: teamwork_preview_worker
- Assigned Working Directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1
- Exclusive Write Ownership:
  * `server/services/semantic/entityAliases.js`
  * `server/services/embeddingService.js`
  * `server/services/webCatalogService.js`

## Mandatory Reference Documents
1. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md` (Read header `2026-09-15T23:59:14Z`)
2. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 2)
3. Explorer 1 Handoff: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_1\handoff.md`
4. Explorer 2 Handoff: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_2\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Implementation Tasks

### 1. `server/services/semantic/entityAliases.js`
- Export `UNIVERSAL_STOP_WORDS` (Set of 50+ counter colloquial terms: `'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'unos', 'unas', 'con', 'por', 'para', 'cuanto', 'cuánto', 'cuesta', 'cuestan', 'precio', 'precios', 'tienen', 'tienes', 'hay', 'que', 'del', 'al', 'o', 'poster', 'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseño', 'diseños', 'hola', 'buenas', 'buenos', 'muestrame', 'mustrame', 'muéstrame', 'mostrar', 'muestra', 'tenemos', 'disponible', 'disponibles', 'catalogo', 'catálogo', 'ver', 'mira', 'dame', 'quiero', 'busca', 'buscar'`).
- Export `KNOWN_SHORT_ENTITIES = new Set(['f1', 'u2', 'r34', 'go', 'up', 'cr7'])`.
- Add entity `Formula 1 - F1` with category `DEPORTES` or `CARRERAS` and aliases:
  `['f1', 'formula 1', 'formula uno', 'carreras', 'ferrari f1', 'red bull f1', 'verstappen', 'hamilton', 'senna', 'ayrton senna']`.
- Add entity `Cristiano Ronaldo - CR7` with category `FUTBOL` and aliases:
  `['el bicho', 'cr7', 'cristiano ronaldo', 'cristiano', 'ronaldo', 'siuu', 'el comandante']`.
- Update `resolveEntityAlias`: allow word boundary match for short entities:
  `if (item.cleanAlias.length >= 3 || KNOWN_SHORT_ENTITIES.has(item.cleanAlias))`.
- Line count ceiling: `<= 600` lines.

### 2. `server/services/webCatalogService.js`
- Import `UNIVERSAL_STOP_WORDS` from `./semantic/entityAliases.js` instead of defining local `STOP_WORDS`.
- Re-export `UNIVERSAL_STOP_WORDS` and `KNOWN_SHORT_ENTITIES` for backwards compatibility.

### 3. `server/services/embeddingService.js`
- Import `UNIVERSAL_STOP_WORDS`, `KNOWN_SHORT_ENTITIES`, and `resolveEntityAlias` from `./semantic/entityAliases.js`.
- In `searchHybridPosters`:
  * Apply `resolveEntityAlias(cleanQuery)` to determine `effectiveQuery = (aliasRes.matched && aliasRes.searchQuery) ? aliasRes.searchQuery : cleanQuery`.
  * Compute `normQueryTokens` filtering out `UNIVERSAL_STOP_WORDS` and retaining tokens where `(t.length > 2 || KNOWN_SHORT_ENTITIES.has(t))`.
  * Raise complementary vector similarity threshold from `0.60` to `0.72` (`vecEntry.similarity >= 0.72`).
  * Replace `.some` with strict coverage `normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok))`.
  * Refactor `allSameTitle` gate to root canonical entity gate: if top lexical results share query tokens, retain all posters sharing those tokens (allowing multiple posters of the same character like Messi) while strictly rejecting foreign candidates.
- Line count ceiling: `<= 200` lines (DO NOT EXCEED).

## Verification Requirements
Run the following test commands and report output in `handoff.md`:
1. `node --test tests/ai/embeddingService.test.js`
2. `node --test tests/adversarial/m1-embeddings-adversarial.test.js`
3. Check regression cases:
   - Query `"muéstrame lo que tenemos de messi"` produces tokens `['messi']`.
   - Query `"f1"` retains `"f1"` and resolves to Formula 1.
4. `npm run audit:monoliths`

## 2026-09-16T00:09:47Z
You are Worker M1 (teamwork_preview_worker).
Your assigned working directory is:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1`

Read your full dispatch instructions in:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1\DISPATCH.md`

Read:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md` (header 2026-09-15T23:59:14Z)
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_1\handoff.md`
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_2\handoff.md`

Your exclusive write ownership is:
- `server/services/semantic/entityAliases.js` (ceiling <= 600 lines)
- `server/services/webCatalogService.js` (keep intact, replace STOP_WORDS import)
- `server/services/embeddingService.js` (ceiling <= 200 lines)

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Cirugía 2.1 and Cirugía 2.2 following the exact blueprints in the handoffs.
Run the required tests (`node --test tests/ai/embeddingService.test.js`, `node --test tests/adversarial/m1-embeddings-adversarial.test.js`, `npm run audit:monoliths`).
Document all commands, line counts, and results in `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m1\handoff.md`.
Notify the parent orchestrator via send_message when complete.

