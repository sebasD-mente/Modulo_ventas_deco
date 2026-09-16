# DISPATCH — Explorer Survey 3

## Identity
- Role: Codebase Investigator (R3: AbortController & Cache Resilience)
- TypeName: teamwork_preview_explorer
- Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_3
- Parent orchestrator directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\orchestrator_24

## Mission
Survey the codebase for **R3 (Cirugía 2.3)**: AbortController in manual search & asynchronous snapshot caching.

Read:
1. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md` (specifically header `2026-09-15T23:59:14Z`)
2. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 2)
3. `src/components/manual-sale/hooks/useCatalogSearch.js` (inspect debounce logic, HTTP request dispatch, error handling, line count)
4. `src/services/catalogCacheService.js` (inspect `TIMEOUT_MS`, `saveCatalogSnapshot`, localStorage sync, line count)
5. `src/services/webCatalogService.js` (or whichever client service implements `searchPostersWithFallback`, check if it accepts an options object or `signal`)
6. `tests/catalog/catalog-cache-service.test.js`

Produce a comprehensive investigation report `handoff.md` with:
- Exact lines in `src/components/manual-sale/hooks/useCatalogSearch.js` where `activeAbortRef` should be added, where `.abort()` should be called on query change, how `signal` should be passed to `searchPostersWithFallback`, and how `AbortError` should be ignored.
- Exact signature of `searchPostersWithFallback` and whether it supports `{ signal }` or needs minor forwarding.
- Exact lines in `src/services/catalogCacheService.js` for `TIMEOUT_MS` (change to 1500ms) and `saveCatalogSnapshot` deferred serialization (`setTimeout(..., 0)`).
- Impact on `tests/catalog/catalog-cache-service.test.js` and how testing compatibility is preserved.
- Line counts of `useCatalogSearch.js` (<= 200 lines) and `catalogCacheService.js` (<= 200 lines).
