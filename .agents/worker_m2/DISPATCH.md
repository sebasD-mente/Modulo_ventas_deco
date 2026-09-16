# DISPATCH — Worker M2 (Blindaje de Red con AbortController y Snapshot Asíncrono)

## Identity & Role
- Archetype: teamwork_preview_worker
- Assigned Working Directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2
- Exclusive Write Ownership:
  * `src/components/manual-sale/hooks/useCatalogSearch.js`
  * `src/services/catalogCacheService.js`

## Mandatory Reference Documents
1. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md` (Read header `2026-09-15T23:59:14Z`)
2. `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 2)
3. Explorer 3 Handoff: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_3\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Implementation Tasks

### 1. `src/components/manual-sale/hooks/useCatalogSearch.js`
- Implement `activeAbortRef = useRef(null)`.
- At the start of `useEffect` on `searchQuery` change, execute `activeAbortRef.current?.abort()` before scheduling the new debounce.
- In `clearSearch()` and `selectPoster()`, also abort in-flight requests.
- In unmount cleanup, execute `activeAbortRef.current?.abort()`.
- Inside the debounce timer (120ms):
  * Instantiate `const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;`.
  * Set `activeAbortRef.current = controller;`.
  * Pass `{ signal: controller?.signal }` to `searchPostersWithFallback`.
  * In `catch (err)`: cleanly ignore `AbortError` (`if (err?.name === 'AbortError' || controller?.signal?.aborted) return;`).
  * In `finally`: only set `setIsSearching(false)` if `activeAbortRef.current === controller`.
- Line count ceiling: `<= 200` lines.

### 2. `src/services/catalogCacheService.js`
- Set and export `export const TIMEOUT_MS = 1500;` (reduced from 5000ms).
- In `searchPostersWithFallback`:
  * Accept `options` parameter supporting either a timeout number or an options object `{ signal, timeoutMs }` or an `AbortSignal`.
  * Link external `signal` to controller so external cancellation aborts immediately.
  * If external signal was aborted, rethrow `err` / do NOT fallback to stale local catalog (prevents old search results from overwriting fresh queries).
- In `saveCatalogSnapshot`:
  * Enclose persistence in `const persist = () => { ... }`.
  * If in browser (`typeof window !== 'undefined'` and not in test environment), defer execution via `setTimeout(persist, 0)`.
  * In testing / Node.js environment (`typeof window === 'undefined'` or `process.env.NODE_ENV === 'test'`), execute `persist()` immediately and synchronously so existing tests pass cleanly.
- Line count ceiling: `<= 200` lines.

## Verification Requirements
Run the following test commands and report output in `handoff.md`:
1. `node --test tests/catalog/catalog-cache-service.test.js` (must pass 22/22 tests).
2. `npm run audit:monoliths` (both files must be <= 200 lines).
3. `npm run build` (bundling must succeed with exit code 0).

## 2026-09-16T00:09:47Z
You are Worker M2 (teamwork_preview_worker).
Your assigned working directory is:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2`

Read your full dispatch instructions in:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2\DISPATCH.md`

Read:
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md` (header 2026-09-15T23:59:14Z)
`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_3\handoff.md`

Your exclusive write ownership is:
- `src/components/manual-sale/hooks/useCatalogSearch.js` (ceiling <= 200 lines)
- `src/services/catalogCacheService.js` (ceiling <= 200 lines)

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Cirugía 2.3 following the exact blueprint in Explorer 3's handoff.
Run the required tests (`node --test tests/catalog/catalog-cache-service.test.js`, `npm run audit:monoliths`, `npm run build`).
Document all commands, line counts, and results in `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2\handoff.md`.
Notify the parent orchestrator via send_message when complete.
