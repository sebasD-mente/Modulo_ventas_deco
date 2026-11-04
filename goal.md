# Goal Loop Specification (goal.md)

> **Propósito en el Arnés (`Loop Engineering — Objetivo y Disyuntores`)**: Este documento pertenece a la categoría **Archivos de Dirección (Solo los edita el Humano)** y define la línea de meta verificable por máquina, las fronteras de actuación (`Fair game` vs `Hands off`) y los **4 Candados del Disyuntor (`4-Lock Circuit Breaker`)** que impiden bucles infinitos o fallas oscilantes (`Bug A <-> Bug B`).

## Regla de Oro para Elegir el Tipo de Loop (`/goal` vs `/loop`)
- **¿Esta tarea tiene una línea de meta final?**
  - **SÍ tiene final** (ej. completar una tarea o conjunto acotado de tareas en `feature_list.json` con todas las puertas en verde) -> Usa un **Loop Basado en Objetivo (`/goal`)** gobernado por este archivo.
  - **NO tiene final, es vigilancia continua** (ej. revisar cada mañana o cada 30 minutos si se rompió una prueba o entraron documentos nuevos) -> Usa un **Loop Basado en Tiempo (`/loop` o `/schedule`)** donde cada ejecución es corta e independiente.

---

## Goal
Implementar y verificar `[nombre de la tarea o conjunto de tareas en feature_list.json]` cumpliendo al 100% los criterios de aceptación bajo la regla `WIP = 1` y orden secuencial DAG estricto.

## Acceptance Criteria (Verificables por Máquina)
- [ ] `bash ./init.sh` termina con código de salida `0` (superando Puerta 1 Estática, Puerta 2 Comportamiento y Puerta 3 Sistema Completo).
- [ ] `bash scripts/check-architecture.sh` reporta cero violaciones de las 6 capas (`Types -> Config -> Repo -> Service -> Runtime -> UI`), cero enlaces muertos y cero archivos temporales.
- [ ] `node scripts/validate-harness.mjs` reporta `Overall: 100/100` (`25/25 checks PASS`).
- [ ] Todas las pruebas unitarias y End-to-End pasan sin errores ni regresiones.
- [ ] El agente Checker (en instancia efímera de un solo uso `one-shot` con ventana virgen `zero-inheritance`, sin reutilizar jamás `send_message`) otorga veredicto `✅ Pass` (`11-12 / 12` sin ceros) en `evaluator-rubric.md`.

## Scope (Límites de Actuación y División en 3 Categorías)

### 1. Archivos de Dirección (Solo los edita el Humano — `Hands off` para el Agente)
- `goal.md`, `AGENTS.md` (reglas núcleo), definición base del DAG en `feature_list.json`.

### 2. Archivos de Trabajo (`Fair game` — Permitido modificar por el Agente Maker)
- Archivos dentro del alcance directo (`required_files`) de la tarea activa y sus pruebas o validadores asociados.
- Campos de estado y evidencia de la tarea activa en `feature_list.json`, `sprint-contract.md`, `progress.md`, `session-handoff.md` y `loop-state.md`.

### 3. Archivos de Infraestructura Fija (`Hands off` — Prohibido debilitar o tocar durante el Loop)
- `init.sh`, `scripts/validate-harness.mjs`, `scripts/lib/harness-utils.mjs`, `evaluator-rubric.md` (exclusivo del Checker aislado), `goal.md`.
- Rutas protegidas (`.git/**`, `.env*`, `node_modules/**`) y configuraciones fuera del alcance de la tarea activa.

## Verification Method (Orden Estricto en cada Ronda)
1. Ejecutar `bash ./init.sh` (incluye `bash scripts/check-architecture.sh`).
2. Ejecutar `node scripts/validate-harness.mjs --min-score 100`.
3. Entregar el resultado a una instancia completamente nueva del sub-agente **Checker independiente (`one-shot` + `zero-inheritance`)** para auditoría con `evaluator-rubric.md` y `checker-prompt.md`. Queda explícitamente anulada para el rol `Checker` cualquier directriz genérica de continuar sub-agentes existentes: **1 Checker = 1 sola auditoría (`one-shot` / *Stateless per Pass*)**, y está estrictamente prohibido usar `send_message` hacia el `conversationId` de un Checker ya utilizado.
4. **Mecanismo de Trinquete (`Ratchet`)**:
   - **Si el Checker independiente aprueba (`✅ Pass`)** y el número neto de verificaciones aprobadas se mantiene o sube sin romper nada previo -> Actualizar `loop-state.md` (registrando `HEAD->commit(feat-00X)` previo al commit según su convención determinista y sellando hashes previos reales) y guardar un `git commit` atómico (el trinquete avanza un diente y nunca retrocede).
   - **Si el Checker rechaza (`❌ Fail` / `REVISAR`)**:
     - **Caso A — Experimento fallido o degradación de verificaciones (Rollback limpio)**: Si el cambio empeora verificaciones o tomó un rumbo equivocado, restaurar el árbol limpio al último commit verde con `git restore --worktree --staged .` (o `git checkout -- .`, compatible con los candados `PreToolUse` sin reescritura destructiva de historial), registrar `(reverted)` y el enfoque descartado en `loop-state.md` para no repetirlo en la siguiente ronda, e intentar un enfoque distinto.
     - **Caso B — Iteración correctiva acotada (`REVISAR`) dentro de la tarea activa**: Si la base es válida y requiere un ajuste puntual acotado dentro del alcance, registrar honestamente la pasada fallida (`❌ Fail` / `REVISAR`, `revised`) en `loop-state.md` (incrementando ronda o fallo según corresponda), aplicar la corrección, re-ejecutar las 3 puertas y **lanzar un sub-agente Checker 100% nuevo (`invoke_subagent` `one-shot` con ventana virgen)** sin reutilizar jamás mediante `send_message` el `conversationId` anterior.

## Circuit Breakers (Disyuntor de 4 Candados — Condiciones Duras de Parada Automática)
> **Prohibición de `"Nunca te detengas"` sin Disyuntores**: Un loop sin candados que cae en una falla oscilante (`Bug A <-> Bug B`, donde arreglar A rompe B y arreglar B vuelve a romper A) evade una regla simple de "3 errores idénticos seguidos" y provoca una explosión cuadrática de tokens ($O(N^2)$).

El loop debe detenerse **INMEDIATAMENTE** cuando ocurra cualquiera de las siguientes condiciones:
1. **Éxito Total**: Todos los criterios de aceptación están en `PASS` y el Checker independiente aprueba `✅ Pass`.
2. **Candado 1 — Tope Duro de Rondas (`Max Rounds`)**: Se alcanza el límite duro de `15 rondas` totales por ejecución.
3. **Candado 2 — Tope Duro de Presupuesto y Tiempo Reloj (`Budget & Wall-Clock Cap`)**: El tiempo acumulado supera `90 minutos` (máx. `15 min` por ronda) o el consumo acumulado supera el presupuesto máximo asignado (`$5 USD` / `250,000 tokens`).
4. **Candado 3 — Disyuntor por Estancamiento (`Stagnation Breaker`)**: El mismo error o fallo se repite durante `3 rondas consecutivas`.
5. **Candado 4 — Disyuntor Anti-Oscilación y Regresión (`Oscillation Breaker A↔B`)**: El número neto de pruebas aprobadas no aumenta durante `3 rondas`, o cualquier prueba/verificación que ya estaba en `PASS` vuelve a caer en `FAIL` en dos rondas distintas (patrón oscilante `A <-> B`).
   - *Acción obligatoria al saltar los Candados 1, 2, 3 o 4*: Revertir cambios no verificados al último commit limpio (`git restore --worktree --staged .` / `git checkout -- .`), registrar la causa exacta en `loop-state.md` bajo `Blocker List & Tripped Circuit Breakers` y detener el loop con estado `BLOCKED - Circuit Breaker Tripped` esperando decisión humana.
