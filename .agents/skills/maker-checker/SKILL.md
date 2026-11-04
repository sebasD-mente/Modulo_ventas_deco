---
name: maker-checker
description: "Loop Maker-Checker one-shot (zero-inheritance) con trinquete Ratchet y 4 disyuntores contra bucles, send_message y fallas A<->B."
---

# Skill: Loop Autónomo Maker-Checker con Trinquete y 4 Disyuntores

> **Pagar la Deuda de Intención (`Loop Engineering` y `Gotcha #12`)**: Esta Skill empaqueta el protocolo completo de ejecución y auditoría entre el Agente Constructor (*Maker*) y el Agente Evaluador Independiente (*Checker*), garantizando que su descripción en el frontmatter tenga `<= 150` caracteres con las palabras clave disparadoras al inicio para evitar truncamiento en el catálogo de Skills.

## Cuándo Activar esta Skill
Activa esta Skill siempre que vayas a:
1. Ejecutar una ronda de implementación y verificación autónoma gobernada por `goal.md` y `loop-state.md`.
2. Auditar una tarea activa de `feature_list.json` mediante separación estricta **Maker / Checker** en contextos aislados (`zero-inheritance`).
3. Verificar que ningún disyuntor (`Circuit Breaker`) se haya disparado antes o después de una ronda.

---

## Procedimiento Operativo Paso a Paso

### Fase 1: Verificación Previa de Disyuntores (`Pre-Round Check`)
Antes de permitir que el Agente Maker edite cualquier archivo, lee `goal.md` y `loop-state.md` y comprueba los **4 Candados (`4-Lock Circuit Breaker`)**:
1. **Candado 1 (`Max Rounds`)**: `Current Round <= 15`.
2. **Candado 2 (`Budget & Wall-Clock Cap`)**: Tiempo transcurrido `<= 90 min` (`<= 15 min` por ronda) y presupuesto dentro del tope (`$5 USD` / `250,000 tokens`).
3. **Candado 3 (`Stagnation Breaker`)**: `Consecutive Stagnant Rounds < 3`.
4. **Candado 4 (`Oscillation Breaker A↔B`)**: `Oscillating Tests Detected == None` y las verificaciones aprobadas no llevan 3 rondas estancadas.
- *Si cualquier candado saltó*: Ejecuta `git restore --worktree --staged .` (o `git checkout -- .`) para volver al último commit verde sin usar comandos destructivos bloqueados por `PreToolUse`, marca `Current Status: BLOCKED - Circuit Breaker Tripped` en `loop-state.md` y detén el loop.

### Fase 2: Ejecución del Agente Maker (`Contexto A`)
Sigue las instrucciones de [`maker-prompt.md`](../../../maker-prompt.md):
1. Lee `AGENTS.md`, `goal.md`, `sprint-contract.md`, `loop-state.md`, `ARCHITECTURE.md` y `docs/product-specs/` (cuando exista).
2. Formula un plan en menos de 10 líneas sin repetir enfoques fallidos previos registrados en `loop-state.md`.
3. Modifica únicamente archivos permitidos en `Fair game` (nunca toques archivos `Hands off`: `init.sh`, `scripts/validate-harness.mjs`, `evaluator-rubric.md`, `goal.md`).
4. Ejecuta `bash ./init.sh` y `node scripts/validate-harness.mjs --min-score 100` confirmando código `0` y `Overall: 100/100`.
5. Genera el reporte de entrega (`Implementation Summary`, `Modified Files`, `Basic Verification Output`, `Known Risks`).

### Fase 3: Auditoría del Agente Checker Efímero (`Contexto B — Zero-Inheritance & One-Shot`)
Lanza una instancia completamente nueva de sub-agente (`invoke_subagent` `one-shot` con ventana virgen) que **NO herede la conversación del Maker**, siguiendo [`checker-prompt.md`](../../../checker-prompt.md):
- **Anulación explícita para el rol `Checker` (`Un Checker = Una Sola Auditoría / one-shot`)**: Queda anulada cualquier regla genérica de continuar el trabajo de un sub-agente existente cuando se trata del Evaluador. Está **estrictamente prohibido** usar `send_message` hacia el `conversationId` de un Checker ya utilizado (ni para pedir re-auditoría, ni aclaración, ni segunda pasada). El propio Checker tiene prohibido ofrecer re-auditoría en su sesión y debe rechazar sin calificar cualquier `send_message` posterior.
1. Inspecciona `git status`, `git diff`, `goal.md`, `sprint-contract.md` y `evaluator-rubric.md`.
2. Ejecuta por su propia cuenta `bash ./init.sh`, `bash scripts/check-architecture.sh` y `node scripts/validate-harness.mjs --min-score 100`.
3. Califica las 6 dimensiones (`0 a 12 puntos`) en `evaluator-rubric.md`.
4. Emite veredicto estricto cerrando su única pasada (`one-shot`):
   - `✅ Pass` (`11-12 / 12` sin ninguna dimensión en `0` y 100% de verificaciones en verde).
   - `❌ Fail` (diagnóstico con formato Bolígrafo Rojo: `ERROR + POR QUÉ + SOLUCIÓN`).

### Fase 4: Actualización del Trinquete (`Ratchet`) en `loop-state.md`
- **Si el Checker emite `✅ Pass` (`ACEPTAR`)**:
  - Actualiza `loop-state.md` (registrando `HEAD->commit(feat-00X)` previo al commit según su convención determinista y sellando hashes previos reales), `progress.md`, `feature_list.json` y `session-handoff.md`.
  - Avanza el trinquete con un `git commit` atómico cuando todas las puertas y criterios de `Definition of Done` estén verificados.
- **Si el Checker emite `❌ Fail` (`REVISAR / BLOQUEAR`)**:
  - **Caso A — Experimento fallido o degradación de pruebas (Rollback limpio)**: Si el experimento degradó verificaciones o tomó un rumbo equivocado, restaura el árbol limpio al último commit verde con `git restore --worktree --staged .` (o `git checkout -- .`, compatible con `PreToolUse`), registra `(reverted)` en `loop-state.md`, incrementa el contador de ronda/estancamiento y plantea un enfoque distinto para la siguiente ronda.
  - **Caso B — Iteración correctiva acotada (`REVISAR`) dentro de la tarea activa**: Si el fallo requiere una corrección acotada dentro de la tarea activa, registra honestamente la pasada fallida (`❌ Fail` / `REVISAR`, `ratchet_status = revised`) en `loop-state.md` (incrementando ronda o fallo según corresponda), aplica la corrección dentro del alcance, re-ejecuta las 3 puertas (`bash ./init.sh` + `node scripts/validate-harness.mjs --min-score 100`) y **lanza un sub-agente Checker 100% nuevo (`invoke_subagent` `one-shot` con ventana virgen)** sin reutilizar jamás el `conversationId` anterior vía `send_message`.
