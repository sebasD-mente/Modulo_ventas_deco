# Loop State Tracker (loop-state.md)

> **Propósito en el Arnés (`Loop Engineering — Memoria entre Rondas`)**: Memoria externa persistente entre rondas del loop autónomo, monitor del **Disyuntor de 4 Candados (`4-Lock Circuit Breaker`)** y registro completo del **Trinquete (`Ratchet`)**.
> Al iniciar cada ronda y cada evaluación del Checker (`one-shot` con ventana virgen, `0` reutilizaciones por `send_message`) leyendo únicamente este archivo en lugar de acumular el historial conversacional de 15 rondas, el arnés elimina la **Explosión Cuadrática de Tokens ($O(N^2)$)** y el sesgo de co-autoría.

## Basic Info & Circuit Breaker Monitor
- **Loop Name:** `deko-eventsales-wave3-zero-allowlist`
- **Active Target:** `feat-003 (Ola 3: Desacoplamiento de Ventas y Eventos y Eliminación Total de LEGACY_SERVER_ALLOWLIST 3 -> 0 — Completada)`
- **Started At:** `2026-11-04T17:36:00-06:00`
- **Current Round:** `3 / 15 (Max — Candado 1)`
- **Current Status:** `Completed` (`Idle` | `In Progress` | `Completed` | `BLOCKED - Circuit Breaker Tripped`)
- **Elapsed Time / Cap:** `48m / 90m Max (15m Max per Round / $5 USD / 250,000 tokens — Candado 2)`
- **Net Passing Checks (Ratchet):** `Baseline: 0/25 -> Round 1: 25/25 (Checker 9/12 REVISAR) -> Round 2: 25/25 (100/100, Checker 12/12 ACEPTAR, 52d7c3c) -> Round 3: 25/25 (100/100, Checker 12/12 ACEPTAR, HEAD->commit(feat-003))`
- **Consecutive Stagnant Rounds:** `0 / 3 Max (Candado 3)`
- **Oscillating Tests Detected (`PASS -> FAIL -> PASS -> FAIL`):** `None (Candado 4)`

---

## Round Log

### Round 1 (Aterrizaje Inicial — Auditada por Checker `One-Shot` `046edf88`)
- **Maker Approach:** Purga de `.agents/library` e higiene de raíz (`84` PNG archivadas + `4` reportes movidos con `git mv`), instalación con `0 CRLF` de los 28 artefactos de `Plantilla-Maestra-Arnes`, adaptación de `ARCHITECTURE.md`, `docs/QUALITY_SCORE.md` y linter dual en `scripts/check-architecture.sh` (`13` tuplas congeladas en `LEGACY_SERVER_ALLOWLIST`), y unificación de `init.sh` + `scripts/audit-harness.js` (`STAND-IA-UNIFIED-HARNESS`).
- **Basic Check (`bash ./init.sh`):** `Pass (Exit code 0 — 25/25 PASS, 8.75s offline)`
- **Independent Checker Verdict:** `❌ Fail — 9 / 12 REVISAR` (instancia `one-shot` virgen `046edf88-4019-43dc-9f8f-58bbf1e273b8`, cerrada definitivamente sin `send_message`)
- **Net Passing Checks Count:** `25 / 25 (Overall: 100/100)`
- **Issues Found by Checker:** `3` (`Critical`: `.git/info/exclude:8` ocultaba `AGENTS.md`; `Medium`: `.gitattributes` exponía artefactos `.md`/`.json` a conversión `CRLF` en Windows bajo `core.autocrlf=true`; `Minor`: cota documental `< 6s` desalineada frente a los `8.75s` reales en Windows Git Bash con `vite build`)
- **Human intervention needed:** `No`
- **Git Action (Ratchet):** `Caso B — Iteración correctiva acotada in-place ((revised-in-place) / revised)`
- **Next Round Adjustment:** `Añadir !AGENTS.md en .gitignore, fijar text eol=lf para todos los artefactos del arnés en .gitattributes, alinear la cota empírica a ~8.8s (< 10s offline) y lanzar un nuevo invoke_subagent Checker one-shot virgen en Round 2.`

### Round 2 (Cierre Certificado Hito Base — Auditada por Nuevo Checker `One-Shot` `27bb88dc`)
- **Maker Approach:** Añadido `!AGENTS.md` en `.gitignore:32` anulando `.git/info/exclude:8` (sin tocar `.git/**`); añadidas reglas `text eol=lf` explícitas en `.gitattributes` para `.gitignore`, `.gitattributes`, `package.json`, `scripts/audit-harness.js` y los artefactos `.md`/`.json` del arnés (`30/30` `required_files` con `eol: lf` y `0` advertencias `LF -> CRLF`); y sincronizada la cota empírica `~8.8s` (`< 10s` offline) manteniendo intacta la Puerta 3 (`npm test && npm run build`).
- **Basic Check (`bash ./init.sh`):** `Pass (Exit code 0 — 8863ms Maker / 8947ms Checker, Overall: 100/100, 25/25 PASS)`
- **Independent Checker Verdict:** `✅ Pass — 12 / 12 ACEPTAR` (instancia `one-shot` virgen `27bb88dc-a404-4069-b63d-14f0bb99161f`, cerrada definitivamente sin `send_message`)
- **Net Passing Checks Count:** `25 / 25 (Overall: 100/100)`
- **Issues Found by Checker:** `None (0)`
- **Human intervention needed:** `No`
- **Git Action (Ratchet):** `Atomic local commit advancing the Ratchet (52d7c3c, kept; 0 git push / 0 deploy)`
- **Next Round Adjustment:** `Loop base completado en CLEAN STATE (WIP = 0).`

### Round 3 (Cierre Certificado `feat-003` Tolerancia Cero — Auditada por Nuevo Checker `One-Shot` `29a7daf5`)
- **Maker Approach:** Extraídas las 14 consultas `prisma.{event,sale,auditLog}` de `saleController.js` (`154L <= 160L`) hacia `server/services/sales/orderTrackingService.js` (`189L`) re-exportado desde `saleService.js` (`19L < 35L`); creado `server/services/eventService.js` (`274L`) apoyado en `eventFinanceService.js` para encapsular `ENV.NODE_ENV`, `prisma.$transaction` y las 37 consultas Prisma fuera de `eventController.js` (`183L <= 190L`) manteniendo `invalidateUserAuthCache()` en capa `Controller` (`rango 5 -> 4`); y eliminada por completo `LEGACY_SERVER_ALLOWLIST` en `scripts/check-architecture.sh` (`3 -> 0` excepciones), elevando `events` y `Runtime Backend` a `A` en `docs/QUALITY_SCORE.md`.
- **Basic Check (`bash ./init.sh`):** `Pass (Exit code 0 — 9197ms Checker offline, Overall: 100/100, 25/25 PASS, HARNESS_PASS en 30.55s)`
- **Independent Checker Verdict:** `✅ Pass — 12 / 12 ACEPTAR` (instancia `one-shot` virgen `29a7daf5-e1c0-47bc-9de9-18748529c807`, cerrada definitivamente sin `send_message`)
- **Net Passing Checks Count:** `25 / 25 (Overall: 100/100)`
- **Issues Found by Checker:** `None (0)`
- **Human intervention needed:** `No`
- **Git Action (Ratchet):** `Atomic local commit advancing the Ratchet (HEAD->commit(feat-003), kept; 0 git push / 0 deploy)`
- **Next Round Adjustment:** `Hoja de ruta feat-000..003 completada al 100% en CLEAN STATE (WIP = 0, 0 excepciones arquitectónicas).`

---

## Cumulative Stats

| Metric | Value |
| :--- | :--- |
| **Rounds completed** | `3` |
| **Passed rounds** | `2` (`Round 2`: `12/12 ACEPTAR`; `Round 3`: `12/12 ACEPTAR`) |
| **Failed rounds** | `1` (`Round 1`: `9/12 REVISAR`) |
| **Total issues found** | `3` (100% resueltos y verificados desde `Round 2`) |
| **Human interventions** | `0` |
| **Files changed** | `15` en `Round 3` (`orderTrackingService.js`, `saleService.js`, `saleController.js`, `eventFinanceService.js`, `eventService.js`, `eventController.js`, `check-architecture.sh`, `ARCHITECTURE.md`, `QUALITY_SCORE.md` y artefactos de estado/rúbrica) |

---

## Experiment History (`results.tsv` — Registro Completo del Ratchet, estilo `autoresearch`)

> **Invariante del Registro Completo (`Karpathy autoresearch`)**: Mientras `git log` conserva únicamente los commits que superaron todas las puertas y avanzaron el *Ratchet*, esta tabla registra **cada experimento sin excepción** —tanto mejoras conservadas como intentos fallidos marcados con `(reverted)`— bajo el mismo presupuesto fijo de verificación, garantizando que ninguna sesión futura repita un experimento descartado.
>
> **Convención Determinista de `commit_hash` (`Anti-Paradoja SHA-1`)**: Un archivo incluido dentro de un commit no puede contener el SHA-1 de ese mismo commit antes de crearlo. Para impedir hashes inventados o etiquetas inconsistentes, la columna `commit_hash` usa **exclusivamente** uno de estos 4 formatos:
> 1. `<sha7>` (ej. `a1b2c3d`): SHA-1 corto real de `git log`, sellado para todas las rondas previas ya confirmadas al abrir o cerrar la siguiente ronda.
> 2. `HEAD->commit(feat-00X)`: Marcador transitorio determinista registrado durante el cierre previo al `git commit` de la tarea activa `feat-00X` cuando el *Ratchet* avanza (`ratchet_status = kept`).
> 3. `(reverted)`: Experimento descartado cuyo árbol se restauró al último commit verde con `git restore --worktree --staged .` (o `git checkout -- .`) y `ratchet_status = reverted`.
> 4. `(revised-in-place)`: Pasada intermedia con veredicto `REVISAR` (`ratchet_status = revised`) corregida dentro de la tarea activa antes de lanzar una nueva instancia `Checker` `one-shot`.

```tsv
timestamp	commit_hash	harness_score	checks_passed	ratchet_status	description
2026-11-03T21:15	(revised-in-place)	100/100	25/25	revised	round-1: Checker one-shot 046edf88 reporto 9/12 REVISAR (!AGENTS.md, .gitattributes eol=lf y cota ~8.8s)
2026-11-03T21:33	52d7c3c	100/100	25/25	kept	round-2: Checker one-shot 27bb88dc otorgo 12/12 ACEPTAR; hito base Brownfield sellado en done con WIP=0 y 0 CRLF
2026-11-04T18:05	HEAD->commit(feat-003)	100/100	25/25	kept	round-3: Checker one-shot 29a7daf5 otorgo 12/12 ACEPTAR; LEGACY_SERVER_ALLOWLIST eliminada (3->0) y feat-003 sellada en done con WIP=0
```

*(Nota operativa: si una ronda futura falla la verificación o recibe `❌ Fail` irreversible del Checker `one-shot`, se restaura el árbol limpio al último commit verde mediante `git restore --worktree --staged .` o `git checkout -- .` —compatible con `PreToolUse`— y se añade aquí una fila con `commit_hash = (reverted)` y `ratchet_status = reverted` documentando qué enfoque falló).*

---

## Blocker List & Tripped Circuit Breakers
- `Ninguno activo (0 candados disparados).`

---

## Final Result

- **Final status:** `Completed` (`Completed` | `Failed` | `Manually stopped` | `In Progress` | `Idle`)
- **Finished at:** `2026-11-04T18:05:00-06:00`
- **Summary:** `Completadas y certificadas las 3 olas quirúrgicas (feat-001, feat-002 y feat-003) reduciendo LEGACY_SERVER_ALLOWLIST de 13 a 0 excepciones con dictamen 12/12 ACEPTAR del Checker independiente (29a7daf5), 10/10 dominios y 6/6 capas en calificación A.`

---

## Protocolo de Auditoría Semanal: Los 4 Costes Silenciosos de los Loops
1. **Deuda de Verificación**: ¿El loop está cerrando tareas con pruebas débiles? -> Endurecer las reglas mecánicas en `scripts/check-architecture.sh` y la auditoría del Checker aislado.
2. **Deterioro de la Comprensión**: ¿El loop avanza más rápido de lo que el humano comprende? -> Revisar siempre los resúmenes de decisiones (`Context` + `Alternatives considered`) en `progress.md`.
3. **Rendición Cognitiva**: ¿Se está aceptando todo sin juicio crítico? -> Mantener los Archivos de Dirección (`goal.md`, `AGENTS.md`, `feature_list.json`) bajo control humano exclusivo.
4. **Explosión Cuadrática de Tokens ($O(N^2)$)**: ¿Se están acumulando múltiples rondas en la misma sesión? -> Ejecutar cada ronda y cada evaluación Checker en ventanas frescas leyendo únicamente `loop-state.md`.
