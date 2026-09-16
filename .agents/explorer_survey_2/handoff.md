# Handoff Report — Explorer Survey 2: Vector Calibration (>= 0.72) & Root Entity Gate (R2 / Cirugía 2.2)

**Author**: `explorer_survey_2` (teamwork_preview_explorer)  
**Working Directory**: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2`  
**Target Recipient**: `parent` (`db233a73-dd6b-4945-8057-cdd1e9a20608` / `orchestrator_24`)  
**Date**: 2026-09-16T00:06:00Z  
**Scope**:
1. Exact location and rationale for vector threshold calibration (`0.60` -> `0.72`) in `server/services/embeddingService.js`
2. Exact logic and replacement of matching condition `matchesEntity` (`.some` -> `every`)
3. Exact dissection of the `allSameTitle` gate and architectural blueprint for the Root Canonical Entity Gate
4. Current status and test execution results for `tests/ai/embeddingService.test.js` and `tests/adversarial/m1-embeddings-adversarial.test.js`
5. Line count audit for `server/services/embeddingService.js` against the <= 200 lines ceiling

---

## 1. Observation

### 1.1 Vector Similarity Threshold (`0.60` -> `0.72`) in `server/services/embeddingService.js`
* **Target File**: `server/services/embeddingService.js`
* **Lines 146–153**:
  ```javascript
  146:     for (const [key, vecEntry] of vectorScores.entries()) {
  147:       if (!combinedScores.has(key) && vecEntry.similarity >= 0.60) {
  148:         const posterText = `${vecEntry.poster.titulo || ''} ${vecEntry.poster.subtitulo || ''} ${Array.isArray(vecEntry.poster.tags) ? vecEntry.poster.tags.join(' ') : ''}`.toLowerCase();
  149:         if (normQueryTokens.length === 0 || normQueryTokens.some((tok) => posterText.includes(tok))) {
  150:           combinedScores.set(key, { poster: vecEntry.poster, hybridScore: vecEntry.similarity * 0.5, isLexicalMatch: false, vecSim: vecEntry.similarity });
  151:         }
  152:       }
  153:     }
  ```
* **Direct Observations**:
  * **Line 147** explicitly sets the complementary threshold: `vecEntry.similarity >= 0.60`. This condition admits candidates that were *not* found in the lexical pass (`!combinedScores.has(key)`), relying solely on their cosine vector similarity.
  * **Distinction with other thresholds**:
    * **Line 6**: `export const MIN_SIMILARITY_THRESHOLD = 0.45;` — Exported mathematical floor tested across unit and adversarial suites (`tests/ai/embeddingService.test.js#L84-L86`). Must remain `0.45`.
    * **Line 113**: `minThreshold = 0.55` in `searchHybridPosters` parameter list. Line 136 uses `if (sim >= minThreshold) vectorScores.set(...)` to populate raw candidates used to boost lexical matches (`vecSim * 0.35` at line 143).
    * **Line 147**: The `0.60` threshold is the *only* gate controlling pure vector candidate injection into `combinedScores`. Changing this to `0.72` directly implements Cirugía 2.2 without touching `MIN_SIMILARITY_THRESHOLD`.

### 1.2 Matching Condition `matchesEntity` (`.some` vs `every`)
* **File**: `server/services/embeddingService.js`
* **Line 149**:
  ```javascript
  148:         const posterText = `${vecEntry.poster.titulo || ''} ${vecEntry.poster.subtitulo || ''} ${Array.isArray(vecEntry.poster.tags) ? vecEntry.poster.tags.join(' ') : ''}`.toLowerCase();
  149:         if (normQueryTokens.length === 0 || normQueryTokens.some((tok) => posterText.includes(tok))) {
  150:           combinedScores.set(key, { poster: vecEntry.poster, hybridScore: vecEntry.similarity * 0.5, isLexicalMatch: false, vecSim: vecEntry.similarity });
  151:         }
  ```
* **Direct Observations**:
  * `normQueryTokens` is computed at line 124:
    ```javascript
    124:   const normQueryTokens = cleanQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter((t) => t.length > 2 && !['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'que'].includes(t));
    ```
  * Line 149 tests `normQueryTokens.some((tok) => posterText.includes(tok))`.
  * If a query has multiple informative tokens (e.g. `['dragon', 'ball', 'goku']` or `['messi', 'argentina']`), any vector candidate whose metadata contains just *one* token (e.g. a generic "ball" or "argentina" poster) satisfies `.some` and gets injected into the hybrid results.

### 1.3 The `allSameTitle` Gate and Topic Destruction
* **File**: `server/services/embeddingService.js`
* **Lines 158–164**:
  ```javascript
  158:     let filteredList = merged.map((m) => m.poster);
  159:     if (lexicalList.length > 0 && lexicalList.length <= 4) {
  160:       const topEntityTitles = lexicalList.map((p) => p.titulo.toLowerCase().trim());
  161:       if (topEntityTitles.every((t) => t === topEntityTitles[0])) {
  162:         filteredList = filteredList.filter((p) => p.titulo.toLowerCase().trim() === topEntityTitles[0]);
  163:       }
  164:     }
  ```
* **Direct Observations**:
  * **Flaw 1 (Destruction of Same-Entity Variants)**: If lexical search finds only 1 poster (e.g. `"Messi - El Beso Eterno"`), `topEntityTitles.length === 1`, so `every` returns `true`. Line 162 filters `filteredList` strictly by `p.titulo.toLowerCase().trim() === topEntityTitles[0]`. If vector search discovered another valid poster of the same character (e.g. `"Messi - El Beso de la Gloria"`), it is immediately discarded because its title string is not identical to the first.
  * **Flaw 2 (Leakage on Distinct Same-Entity Titles)**: If lexical search finds 2 posters with different titles (e.g. `"Messi - El Beso Eterno"` and `"Messi - El Beso de la Gloria"`), `topEntityTitles.every((t) => t === topEntityTitles[0])` returns `false`. The gate completely fails to activate, permitting unrelated vector intruders (e.g. basketball or movies) that surpassed line 147 to remain in `filteredList`.

### 1.4 Test Suite Status & Baseline Execution
* **Tool Command Executions**:
  * `node --test tests/ai/embeddingService.test.js`:
    * Exit Code: `0`
    * Output: `17 tests pass, 0 fail` across 5 suites (pure math, threshold 0.45, cache/RAM latency, parachute fallback). Duration: 5,545ms.
  * `node --test tests/adversarial/m1-embeddings-adversarial.test.js`:
    * Exit Code: `0`
    * Output: `23 tests pass, 0 fail` across 7 suites (extreme floats/NaN, high dimensions 768/1536/3072, boundary 0.45, 100% negative rejection, 1,000 evaluations stress benchmark, syntax integrity). Duration: 5,627ms.
  * **Grep Search for `0.60` in `tests/`**: Exactly 0 occurrences found.
  * **Grep Search for `0.72` in `tests/`**: Exactly 0 occurrences found.
  * Neither test suite hardcodes or verifies the `0.60` complementary threshold or tests multi-poster entity preservation.

### 1.5 File Line Count & Monolith Audit
* **Tool Command Execution**: `npm run audit:monoliths`
  * `server/services/embeddingService.js` is NOT in the list of monoliths.
  * Total line count of `server/services/embeddingService.js`: **177 lines** (Ceiling: **200 lines**, available headroom: **23 lines**).
* **Cross-Reference in Audits**:
  * `AUDITORIA_360_STAND_IA.md` (lines 393–405) cited `#L145, #L166, #L168, #L183-L189` based on a previous version before modular cleanups. Current line numbers are verified as `#L147`, `#L149`, and `#L159-L164`.

---

## 2. Logic Chain

### 2.1 Logic Chain for Vector Calibration (`0.60` -> `0.72`)
1. **Observation 1.1** demonstrates that `vecEntry.similarity >= 0.60` at `server/services/embeddingService.js:147` governs whether pure vector candidates (items not retrieved during the initial lexical pass) are admitted into `combinedScores`.
2. In high-dimensional vector spaces (such as 3072-dimensional embeddings from `gemini-embedding-001` or 768-dimensional embeddings from `text-embedding-004`), random or loosely related document vectors exhibit high baseline cosine similarities (~0.55 to 0.65) due to the geometric concentration of measure in embedding hypercones.
3. As observed in production audits (`AUDITORIA_360_STAND_IA.md` Section 3 & 5), a threshold of `0.60` allows completely unrelated posters (e.g. basketball or pop singers) to leak into sports or anime queries simply because their vector representations fall within the high-density baseline cone.
4. Elevating this complementary threshold on line 147 from `0.60` to `0.72` establishes an empirical safety margin well above the hypercone noise floor. Only vector candidates with genuine semantic affinity will enter `combinedScores`.
5. Simultaneously, `MIN_SIMILARITY_THRESHOLD = 0.45` on line 6 remains untouched. As verified in `tests/ai/embeddingService.test.js` (Suites 1 & 2) and `tests/adversarial/m1-embeddings-adversarial.test.js` (Bloques 1–3), `MIN_SIMILARITY_THRESHOLD` serves as the global mathematical floor for cosine similarity calculations and distance clipping. Altering line 6 would break existing unit contracts; calibrating line 147 targets the exact operational vector injection gate.

### 2.2 Logic Chain for `matchesEntity` (`.some` vs `every`)
1. **Observation 1.2** identifies that line 149 currently uses `.some((tok) => posterText.includes(tok))`.
2. When a search query consists of multiple content tokens (e.g. `"Dragon Ball Goku"`, `"Michael Jordan Chicago Bulls"`, or `"Spider-Man Miles Morales"`), `.some` evaluates to `true` if *any single token* appears in the candidate's metadata.
3. Consequently, if a pure vector candidate scores >= 0.72 similarity but only matches `"ball"` (e.g. a generic beach ball or soccer ball poster) or `"jordan"` (e.g. an unrelated geography poster), `.some` permits it to be merged into `combinedScores`.
4. Replacing `.some` with `every`:
   ```javascript
   const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok));
   ```
   guarantees that pure vector additions (which lack lexical confirmation) must satisfy the complete semantic token signature of the query before entering `combinedScores`.
5. In conjunction with Cirugía 2.1 (which purges conversational stop-words like *"muéstrame"*, *"de"*, *"en"*, *"quiero"* via `UNIVERSAL_STOP_WORDS`), `normQueryTokens` will contain only the core entity identifiers, making `every` both precise and robust against false rejections.

### 2.3 Logic Chain for the Root Canonical Entity Gate
1. **Observation 1.3** highlights the dual failure modes of the current `allSameTitle` gate (`embeddingService.js:159-164`):
   - **Mode A (Over-Filtering / Destruction of Works)**: When lexical search returns 1 poster (e.g. `"Messi - El Beso Eterno"`), `topEntityTitles.every(...)` is trivially `true`. Line 162 executes `filteredList.filter((p) => p.titulo === topEntityTitles[0])`. If hybrid/vector search discovered another legitimate poster of the same character (e.g. `"Messi - El Beso de la Gloria"`), it is destroyed because its title is not identical.
   - **Mode B (Under-Filtering / Zero Protection)**: When lexical search returns 2 or more posters with distinct titles (e.g. `"Messi - El Beso Eterno"` and `"Messi - El Beso de la Gloria"`), `topEntityTitles.every(...)` evaluates to `false`. The gate never triggers, allowing unrelated vector candidates that passed line 147 to pollute the final result set.
2. The core architectural intention is to protect **entity affinity**, not **literal title string identity**.
3. By extracting the shared query tokens that unify the top lexical results:
   ```javascript
   const sharedTokens = normQueryTokens.filter((tok) =>
     lexicalList.every((p) => {
       const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
       return text.includes(tok);
     })
   );
   ```
4. If `sharedTokens.length > 0` (e.g. all top lexical results share the token `"messi"`):
   - Any poster in `filteredList` that contains `"messi"` is **retained**, enabling multiple posters of the same character (`"Messi - El Beso Eterno"`, `"Messi - El Beso de la Gloria"`, `"Messi - Campeón del Mundo"`) to be displayed side-by-side.
   - Any vector candidate that lacks `"messi"` (e.g. `"Cristiano Ronaldo"` or `"Batman"`) is **strictly discarded**.
5. If the top lexical results do not share a common query token (e.g. broad exploratory queries like *"anime"* where results span Naruto, Goku, and Luffy), `sharedTokens` will be empty, and the gate gracefully avoids over-restricting the results.

### 2.4 Logic Chain for Line Count & File Ceiling
1. **Observation 1.5** establishes that `server/services/embeddingService.js` currently has **177 lines**.
2. The architectural limit enforced by `PROJECT.md` and `scripts/audit-monoliths.js` is **200 lines**.
3. Implementing R2 (Cirugía 2.2):
   - Line 147: Modify threshold in-place (0 line delta).
   - Line 149: Replace `.some` with `matchesEntity` declaration (+1 line delta).
   - Lines 159–164: Replace 6-line `allSameTitle` block with a 13-line Root Canonical Entity Gate (+7 line delta).
4. Total net change: $+8\text{ lines}$, bringing the file to **185 lines**, safely below the 200-line ceiling (15 lines of buffer remaining).

---

## 3. Caveats

1. **Coupling with Cirugía 2.1 (`UNIVERSAL_STOP_WORDS` & `KNOWN_SHORT_ENTITIES`)**:
   - The precision of `normQueryTokens.every(...)` and `sharedTokens` depends on `normQueryTokens` containing only meaningful keywords. If stop words like *"muéstrame"* or *"de"* are not filtered out, `every` would require candidate posters to contain the word *"muéstrame"*, causing false negatives.
   - Therefore, Cirugía 2.1 (importing `UNIVERSAL_STOP_WORDS` and handling `KNOWN_SHORT_ENTITIES` like `'f1'`, `'cr7'`) must be applied in tandem with Cirugía 2.2.
2. **Empty Token Queries**:
   - If a user sends a query that normalizes to zero tokens (e.g. only punctuation or stop words), `normQueryTokens.length === 0`. The implementation must safeguard `normQueryTokens.length > 0` before checking `every` or running the root entity gate, allowing fallback to default lexical browsing.
3. **Read-Only Scope Compliance**:
   - In accordance with explorer rules, this report provides exact code blueprints and verified line references. No modifications to `server/services/embeddingService.js` were applied during this survey.

---

## 4. Conclusion & Actionable Implementation Blueprint

### 4.1 Summary Assessment
The codebase is in an ideal state for the atomic application of R2 (Cirugía 2.2):
- The test suites (`tests/ai/embeddingService.test.js` and `tests/adversarial/m1-embeddings-adversarial.test.js`) are 100% green and isolated from external database connections.
- The exact injection points in `server/services/embeddingService.js` are verified.
- The file has 23 lines of available headroom before reaching its 200-line ceiling.

### 4.2 Exact Code Replacements for the Implementer

#### Change 1: Threshold Calibration (`0.60` -> `0.72`) and `matchesEntity` (`.some` -> `every`)
* **Target**: `server/services/embeddingService.js#L146-L153`
* **BEFORE**:
  ```javascript
  146:     for (const [key, vecEntry] of vectorScores.entries()) {
  147:       if (!combinedScores.has(key) && vecEntry.similarity >= 0.60) {
  148:         const posterText = `${vecEntry.poster.titulo || ''} ${vecEntry.poster.subtitulo || ''} ${Array.isArray(vecEntry.poster.tags) ? vecEntry.poster.tags.join(' ') : ''}`.toLowerCase();
  149:         if (normQueryTokens.length === 0 || normQueryTokens.some((tok) => posterText.includes(tok))) {
  150:           combinedScores.set(key, { poster: vecEntry.poster, hybridScore: vecEntry.similarity * 0.5, isLexicalMatch: false, vecSim: vecEntry.similarity });
  151:         }
  152:       }
  153:     }
  ```
* **AFTER**:
  ```javascript
  146:     for (const [key, vecEntry] of vectorScores.entries()) {
  147:       if (!combinedScores.has(key) && vecEntry.similarity >= 0.72) {
  148:         const posterText = `${vecEntry.poster.titulo || ''} ${vecEntry.poster.subtitulo || ''} ${Array.isArray(vecEntry.poster.tags) ? vecEntry.poster.tags.join(' ') : ''}`.toLowerCase();
  149:         const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok));
  150:         if (normQueryTokens.length === 0 || matchesEntity) {
  151:           combinedScores.set(key, { poster: vecEntry.poster, hybridScore: vecEntry.similarity * 0.5, isLexicalMatch: false, vecSim: vecEntry.similarity });
  152:         }
  153:       }
  154:     }
  ```

#### Change 2: Root Canonical Entity Gate (Refactoring `allSameTitle`)
* **Target**: `server/services/embeddingService.js#L158-L164`
* **BEFORE**:
  ```javascript
  158:     let filteredList = merged.map((m) => m.poster);
  159:     if (lexicalList.length > 0 && lexicalList.length <= 4) {
  160:       const topEntityTitles = lexicalList.map((p) => p.titulo.toLowerCase().trim());
  161:       if (topEntityTitles.every((t) => t === topEntityTitles[0])) {
  162:         filteredList = filteredList.filter((p) => p.titulo.toLowerCase().trim() === topEntityTitles[0]);
  163:       }
  164:     }
  ```
* **AFTER**:
  ```javascript
  158:     let filteredList = merged.map((m) => m.poster);
  159:     if (lexicalList.length > 0 && lexicalList.length <= 4 && normQueryTokens.length > 0) {
  160:       const sharedTokens = normQueryTokens.filter((tok) =>
  161:         lexicalList.every((p) => {
  162:           const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
  163:           return text.includes(tok);
  164:         })
  165:       );
  166:       if (sharedTokens.length > 0) {
  167:         filteredList = filteredList.filter((p) => {
  168:           const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
  169:           return sharedTokens.every((tok) => text.includes(tok));
  170:         });
  171:       }
  172:     }
  ```

---

## 5. Verification Method

### 5.1 Automated Test Execution Commands
The implementer and QA agents must run the following test commands to verify that no regressions occur:
```bash
# 1. AI & Vector Embedding Suite (17 tests)
node --test tests/ai/embeddingService.test.js

# 2. Adversarial Stress & High-Dimension Math Suite (23 tests)
node --test tests/adversarial/m1-embeddings-adversarial.test.js

# 3. Monolith & Line Ceiling Audit (Must report embeddingService.js <= 200 lines)
npm run audit:monoliths

# 4. Zero-Trust Security Harness
npm run harness:check
```

### 5.2 Specific New Test Cases to Validate R2 Implementation
The following test scenarios should be added to `tests/ai/embeddingService.test.js`:
1. **Vector Candidate Threshold Gate (0.71 vs 0.72)**:
   - Provide a mocked vector candidate not in `lexicalList` with similarity `0.71`. Assert it is **not** included in `combinedScores`.
   - Provide a candidate with similarity `0.72` and full token coverage. Assert it **is** included.
2. **Compound Query Token Rejection (`every` vs `.some`)**:
   - Query: `"Dragon Ball Goku"`.
   - Provide a vector candidate with similarity `0.75` whose text is `"Chicago Bulls Basketball"`.
   - Assert it is **rejected** because it lacks `"dragon"` and `"goku"`, even if partial vector similarity was high.
3. **Root Canonical Entity Gate Multi-Poster Retention**:
   - Lexical search returns:
     - Poster A: `"Messi - El Beso Eterno"`
     - Poster B: `"Messi - El Beso de la Gloria"`
   - Pure vector candidate returned:
     - Poster C: `"Messi - Campeón del Mundo"` (similarity 0.76, matches `"messi"`)
     - Poster D: `"Cristiano Ronaldo - Al Nassr"` (similarity 0.74, lacks `"messi"`)
   - Assert `filteredList` retains Posters A, B, and C, and strictly discards Poster D.

### 5.3 Invalidation Conditions
The implementation must be considered **FAILED** if any of the following occur:
- `server/services/embeddingService.js` exceeds 200 lines.
- `MIN_SIMILARITY_THRESHOLD = 0.45` on line 6 is altered.
- Búsqueda de *"Messi"* eliminates one Messi poster because another Messi poster has a different title.
- A candidate scoring similarity between `0.60` and `0.719` enters `combinedScores` without lexical confirmation.

