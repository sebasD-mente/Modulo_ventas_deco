# BRIEFING — 2026-09-16T00:08:00Z

## Mission
Survey codebase for R1 (Cirugía 2.1): Universal stop-words, short entities whitelist (F1, CR7), and entity aliases in embeddingService, webCatalogService, and entityAliases.js.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_1
- Original parent: 40958512-4854-45d9-bf41-45feacb902c8
- Milestone: survey (Cirugía 2.1 - R1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Thorough investigation of orphan components, references, Git/repo hygiene, and build scripts
- No code modification outside of .agents/explorer_survey_1
- Strict project isolation & zero-trust credential rules
- Check line count ceilings: embeddingService.js <= 200 lines, entityAliases.js <= 600 lines

## Current Parent
- Conversation ID: db233a73-dd6b-4945-8057-cdd1e9a20608
- Updated: 2026-09-16T00:08:00Z

## Investigation State
- **Explored paths**: `server/services/embeddingService.js`, `server/services/webCatalogService.js`, `server/services/semantic/entityAliases.js`, `server/services/catalog/liveCatalogSyncService.js`, `tests/ai/embeddingService.test.js`, `tests/adversarial/m1-embeddings-adversarial.test.js`, `tests/semantic/semantic-parser.test.js`, `AUDITORIA_360_STAND_IA.md`, `ORIGINAL_REQUEST.md`.
- **Key findings**:
  1. `embeddingService.js:124` contains only 11 hardcoded stop-words and `t.length > 2`, which purges 2-char entities like "f1", resulting in `normQueryTokens = []` and causing fallback `normQueryTokens.length === 0` to admit unrelated vector matches (basketball).
  2. `webCatalogService.js:351` has a local, non-exported 52-word `STOP_WORDS` set. A 3rd uncoordinated set exists in `liveCatalogSyncService.js:196`.
  3. Circular dependency between `webCatalogService.js` and `embeddingService.js` makes exporting `UNIVERSAL_STOP_WORDS` from `webCatalogService` risky for ESM TDZ.
  4. Defining `UNIVERSAL_STOP_WORDS` and `KNOWN_SHORT_ENTITIES` in `server/services/semantic/entityAliases.js` provides a zero-cycle, TDZ-safe solution.
  5. `entityAliases.js:474` requires updating `item.cleanAlias.length >= 3` to allow `KNOWN_SHORT_ENTITIES` in regex matching.
  6. Line counts: `embeddingService.js` (177/200, 23 free), `entityAliases.js` (512/600, 88 free).
- **Unexplored areas**: None within R1 survey scope.

## Key Decisions Made
- Recommending `UNIVERSAL_STOP_WORDS` and `KNOWN_SHORT_ENTITIES` defined in `entityAliases.js` and re-exported via `semanticParserService.js` and `webCatalogService.js`.
- Preserving driver-specific aliases in `F1 - Red Bull Racing` while adding generic `Formula 1 - F1` and `Cristiano Ronaldo - CR7`.

## Artifact Index
- DISPATCH.md — dispatch log
- progress.md — liveness heartbeat
- handoff.md — comprehensive 5-component report
