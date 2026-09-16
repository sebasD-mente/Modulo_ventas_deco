# BRIEFING — 2026-09-16T00:05:00Z

## Mission
Survey the codebase for R2 (Cirugía 2.2): Vector calibration (>= 0.72) and root entity gate in server/services/embeddingService.js.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2
- Original parent: 40958512-4854-45d9-bf41-45feacb902c8
- Milestone: survey_phase_2
- Current parent: db233a73-dd6b-4945-8057-cdd1e9a20608 (orchestrator_24) | Milestone: R2 (Cirugía 2.2) Vector Calibration & Root Entity Gate

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Strict project isolation (aislamiento-estricto-proyectos)
- Architecture zero debt protocol (cirugia-arquitectura-cero-deuda)
- Zero assumptions, verified evidence chains
- Line ceiling constraint: server/services/embeddingService.js <= 200 lines
- Threshold calibration strictly >= 0.72 for pure vector candidates
- Strict token matching (every) for entity coverage
- Root canonical entity gate must preserve all works of the same character/entity

## Current Parent
- Conversation ID: db233a73-dd6b-4945-8057-cdd1e9a20608
- Updated: 2026-09-16T00:05:00Z

## Investigation State
- **Explored paths**:
  - `server/services/embeddingService.js`
  - `tests/ai/embeddingService.test.js`
  - `tests/adversarial/m1-embeddings-adversarial.test.js`
  - `AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 2, Cirugía 2.2)
  - `ORIGINAL_REQUEST.md` (header 2026-09-15T23:59:14Z)
  - `server/services/semantic/entityAliases.js`
  - `server/services/webCatalogService.js`
- **Key findings**:
  1. Threshold `0.60` is located at `server/services/embeddingService.js#L147`. It must be changed to `0.72` to eliminate baseline hypercone noise for non-lexical candidate additions.
  2. Matching condition `.some` is at line 149 (`normQueryTokens.some((tok) => posterText.includes(tok))`). Refactoring to `normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok))` prevents spurious partial token matches.
  3. The `allSameTitle` gate at lines 159-164 (`topEntityTitles.every((t) => t === topEntityTitles[0])`) has a severe flaw: it deletes other legitimate works of the same entity (e.g. "Messi - El Beso de la Gloria" when "Messi - El Beso Eterno" is present), and fails to activate when multiple different titles are found. Refactor to a `sharedTokens` root canonical entity gate.
  4. Current test suites (`tests/ai/embeddingService.test.js` [17/17 pass], `tests/adversarial/m1-embeddings-adversarial.test.js` [23/23 pass]) pass cleanly. They test `MIN_SIMILARITY_THRESHOLD = 0.45` and do not test `0.60`. New tests are needed to verify `>= 0.72`, `every`, and entity retention.
  5. `server/services/embeddingService.js` currently has 177 lines. Refactored changes will add ~8 lines, totaling ~185 lines, well below the 200-line limit.
- **Unexplored areas**: None within R2 scope.

## Key Decisions Made
- Confirmed that `MIN_SIMILARITY_THRESHOLD = 0.45` on Line 6 remains unchanged (tested baseline); only the pure vector complementary threshold on Line 147 changes from `0.60` to `0.72`.
- Formulated `sharedTokens` root entity gate matching `normQueryTokens` across lexical items to protect multi-poster entity queries while blocking foreign vector intrusions.

## Artifact Index
- handoff.md — Complete 5-component handoff report
- progress.md — Liveness heartbeat
- DISPATCH.md — Task history and prompt logs
