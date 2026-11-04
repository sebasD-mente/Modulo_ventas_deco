# Evaluator Rubric (Rúbrica de Evaluación Independiente — Solo para Agente Checker Aislado)

> REGLA DE AISLAMIENTO (`zero-inheritance` + `one-shot`): Prohibido rellenar esta rúbrica en la misma sesión de chat que implementó los cambios (Maker) o reutilizar vía `send_message` a un Evaluador previo.
> Esta evaluación debe ser ejecutada exclusivamente por un Agente Evaluador (Checker) efímero de un solo uso (`one-shot`) en una ventana de contexto limpia (`zero-inheritance`) o por un revisor humano.

## Protocolo de Aislamiento Físico del Checker (`Zero-Inheritance` y `One-Shot`)

1. **Ventana de Contexto Nueva y Aislada (`Zero-Inheritance`)**: La evaluación debe ejecutarse en una sesión de chat independiente o mediante un Sub-agente Evaluador aislado que **NO herede el historial de conversación ni el razonamiento interno del Maker**.
2. **Entradas Objetivas Únicamente**: El Evaluador solo puede inspeccionar el contrato (`sprint-contract.md` y `feature_list.json`), los archivos en disco / diferencias (`git status`, `git diff`), la ejecución real en vivo de `bash ./init.sh` y esta rúbrica.
3. **Postura Escéptica y Regla de Calibración**:
   - *"Tu trabajo es encontrar fallos con evidencia; aprobar un trabajo con defectos ocultos es tu fracaso."*
   - **Regla Dura de Calibración en Verificación**: Dar **0 puntos** en la Dimensión 2 (`Verificación`) si el Evaluador no ejecutó `bash ./init.sh` en su propia sesión aislada y pegó la salida exacta verificada.
4. **Instancia Efímera de Un Solo Uso (`One-Shot / one-shot`) — Prohibida la Re-Auditoría en la Misma Sesión**:
   - **Un Checker = Una Sola Auditoría (`one-shot` / *Stateless per Pass*)**: Queda explícitamente anulada para el rol Evaluador cualquier regla genérica de continuar sub-agentes existentes. Cada auditoría inicial o re-auditoría tras corregir un hallazgo **DEBE** invocar una instancia completamente nueva (`invoke_subagent` `one-shot` con ventana virgen); el Maker tiene estrictamente prohibido enviar `send_message` al `conversationId` de un Evaluador ya utilizado.
   - **Prohibido ofrecer re-auditoría y orden imperativa de rechazo ante `send_message`**: El Evaluador tiene prohibido despedirse ofreciendo *"envíame un mensaje cuando lo corrijas para re-auditar"* y debe cerrar su dictamen recordando que cualquier re-auditoría exige una **nueva instancia `one-shot` desde cero**. Si recibe un `send_message` pidiendo re-evaluar cambios o volver a calificar esta rúbrica en la misma sesión, tiene **orden imperativa de rechazar la solicitud sin calificar** respondiendo con Bolígrafo Rojo (`ERROR` / `POR QUÉ` / `SOLUCIÓN (FIX)`) que exija lanzar un `invoke_subagent` nuevo (`one-shot`).

---

## Protocolo de Calibración del Evaluador (3–5 Rondas contra Juicio Humano)

De fábrica, los modelos son jueces indulgentes incluso en sesiones separadas: detectan matices dudosos y luego racionalizan por qué "es aceptable aprobar". Para alinear el Agente Checker con el estándar real del equipo, ejecuta **entre 3 y 5 rondas de calibración** siguiendo estos 5 pasos:

1. **Ejecutar en un sprint completado**: Corre el Agente Evaluador aislado sobre una tarea o sprint real terminado.
2. **Comparar contra juicio humano**: Puntúa tú mismo las 6 dimensiones (`0-2`) sin sesgo y contrasta punto por punto dónde divergió el Checker respecto a tu revisión humana.
3. **Endurecer criterios ambiguos**: En cada dimensión donde hubo divergencia (por ejemplo, aprobar pruebas superficiales o pasar por alto alcance extra), reescribe la pregunta o umbral de aprobación/fallo haciéndolo más específico y verificable por máquina.
4. **Re-ejecutar y verificar alineación**: Vuelve a lanzar el Evaluador en limpio sobre el caso auditado para comprobar que la nueva redacción corrige la desviación sin generar falsos positivos arbitrarios.
5. **Repetir y registrar (`3–5 rondas`)**: Repite el ciclo durante **3 a 5 rondas** hasta que las calificaciones y veredictos del Evaluador coincidan consistentemente con la revisión humana, dejando trazabilidad de cada ajuste en la tabla siguiente.

### Registro de Calibración del Evaluador (`Calibration Log`)

| Ronda | Tarea / Hito Evaluado | Puntuación Checker vs. Humano | Divergencia Detectada | Ajuste Aplicado a la Rúbrica / Verificador |
| :--- | :--- | :--- | :--- | :--- |
| **1 (`Round 1`)** | Inicialización Brownfield en `deko-eventsales` (`feat-001`) | `9 / 12` (`REVISAR` — primera auditoría `one-shot` aislada `046edf88`) | `AGENTS.md` oculto a Git por `.git/info/exclude:8` sin `!AGENTS.md` en `.gitignore`; `.gitattributes` sin `eol=lf` para artefactos `.md`/`.json`/`.gitignore` bajo `core.autocrlf=true`; umbral `< 6s` documentado frente a `8.75s` reales en Windows Git Bash | Exigir verificación `git check-ignore -v` y `git check-attr eol` sobre el 100% de `required_files`, blindaje `eol=lf` contra regresión CRLF en Windows y métricas de tiempo medidas en vivo |
| **2 (`Round 2`)** | Re-auditoría limpia de `feat-001` en nueva instancia virgen (`27bb88dc`) | `12 / 12` (`ACEPTAR` — segunda auditoría `one-shot` aislada, `0` llamadas `send_message` a `046edf88`) | Ninguna divergencia abierta: los 3 hallazgos de `Round 1` quedaron cerrados al `100%` sin regresiones ni violaciones `Hands off` | Consolidados los chequeos `git check-ignore -v`, `git check-attr eol -- <required_files>` (`30/30 eol: lf`) y `git add --dry-run .` (`stderr === ""`) dentro de la batería del Checker |

---

## Tabla de Calificación Objetiva (0 a 12 Puntos) — Auditoría `One-Shot` Round 2 (`feat-001`)

| Dimensión | Pregunta de Control | Puntuación (0, 1 o 2) | Evidencia / Notas |
| :--- | :--- | :---: | :--- |
| **1. Corrección** | ¿El resultado implementado cumple al 100% con el comportamiento pedido en `sprint-contract.md`? (0=No, 1=Parcial, 2=Completo) | **2** | Cumplimiento al `100%`: los 28 artefactos del arnés + `.gitattributes` + `package.json` + `scripts/audit-harness.js` existen físicamente con `0 CRLF`; `!AGENTS.md` en `.gitignore:32` anula `.git/info/exclude:8` (`git check-ignore -v AGENTS.md` -> `.gitignore:32:!AGENTS.md	AGENTS.md` y `?? AGENTS.md` visible en `git status --porcelain`); `.gitattributes` fija `eol=lf` en los `30/30` `required_files` (`git add --dry-run .` -> `stderr = ""`); e `init.sh` mide `8947 ms < 10s` (`100%` offline) alineado con la cota `~8.8s` / `< 10s` documentada. |
| **2. Verificación** | ¿Pasaron realmente las pruebas, chequeos estáticos y `bash ./init.sh` ejecutados por el propio Checker aislado? *(Regla dura: 0 si no ejecutó `init.sh` en vivo)* | **2** | Ejecutado en vivo por esta instancia Checker virgen (`27bb88dc`): (1) `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` -> `CHECKER_R2_INIT_EXIT=0 ELAPSED_MS=8947` (`CLEAN STATE`, `185` archivos `audit-secrets` OK, `verify-gemini-models` PASS, `Overall: 100/100` `25/25 PASS`, `zero-trust` `12/12`, `vite build` `1566` módulos en `3.78s`); (2) `bash scripts/check-architecture.sh` -> `ARCH_EXIT=0` y `node scripts/validate-harness.mjs --min-score 100` -> `VALIDATE_EXIT=0`; (3) `npm run harness:check` -> `HARNESS_CHECK_EXIT=0` (`status: HARNESS_PASS`, `STAND-IA-UNIFIED-HARNESS`, `29.23s`, `262` JS sintaxis, `253/253` unit tests en `104` suites); (4) suite adversarial en `os.tmpdir()` -> `CHECKER_R2_ADVERSARIAL_PASS` en `1860.9 ms < 2s` (`4/4` imports ilegales rechazados con Bolígrafo Rojo, candados Prisma/`.env`/`.git`/`send_message` en `deny` + interceptación real `PreToolUse` verificada en vivo, `TMP_CLEANUP_VERIFIED=0_RESIDUES`). |
| **3. Disciplina de Alcance** | ¿El cambio se mantuvo estrictamente dentro de `sprint-contract.md` y `WIP = 1` sin tocar archivos `Hands off` (`src/`, `server/`, `prisma/`, `Dockerfile`, `.env`)? | **2** | Confirmado mediante `git status --porcelain` (`36` entradas) y `git diff --name-status HEAD`: `0` cambios en `src/`, `server/`, `prisma/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore` y `entrypoint.sh`; `0` lectura/apertura de `.env`; `138` `test_evidence/prod_*.png` intactos; `84` PNG archivados en `test_evidence/root_archive/` (`0` PNG en raíz); `4` `R100` (`git mv`) intactos en `docs/exec-plans/completed/`; `.agents/library`, `phase3_live_verified.png` y `scratch/` purgados; `WIP = 1` respetado. |
| **4. Fiabilidad** | ¿Se manejan casos borde, rutas de error `Fail-Closed` y limpieza de temporales sin introducir fragilidad? | **2** | `scripts/harness-hooks.mjs` (`279L <= 280L`) aplica `Fail-Closed` ante JSON corrupto, bloquea Prisma destructivo (`migrate reset`, `--accept-data-loss`, `--force-reset`, incluso envuelto en `bash -c` / `powershell -Command`), protege `.env*`/`.git/**`/`node_modules/**` y blinda `1 Checker = 1 auditoría` en `send_message`. `git check-attr eol -- <30 required_files>` confirma `eol: lf` al `100%` bajo `core.autocrlf=true`, impidiendo regresiones `CRLF` ante `git restore` o `git checkout`. |
| **5. Mantenibilidad** | ¿Se respetan las 6 capas de `ARCHITECTURE.md`, topes de concisión y cero enlaces muertos? | **2** | `AGENTS.md` tiene `100` líneas exactas, `scripts/harness-hooks.mjs` tiene `279 <= 280` líneas, `memory/INDEX.md` tiene `29 <= 200` líneas (`0` huérfanos en `memory/topics/`), `24/24` `Required Artifacts` existen sin enlaces muertos y las `13` tuplas de `LEGACY_SERVER_ALLOWLIST` referencian archivos e imports reales existentes en disco (`0` entradas fantasma o caducas). |
| **6. Preparación de Entrega** | ¿Están completamente sincronizados `feature_list.json`, `progress.md`, `loop-state.md` y `session-handoff.md`? | **2** | Sincronización completa en `WIP = 1`: `AGENTS.md` y los demás entregables son visibles y rastreables por `git add` sin advertencias `CRLF`, `loop-state.md` registra `Round 1` como `(revised-in-place)` / `revised` (`0` estancamiento, `0` oscilación `A↔B`) y `Round 2` con `HEAD->commit(feat-001)`, y todas las referencias temporales reflejan la medición empírica honesta (`~8.8s` / `< 10s` offline). |

**Puntuación Total:** `12 / 12`

## Veredicto Final del Checker Independiente
- [x] **ACEPTAR** (Puntuación 11-12 y ninguna dimensión en 0)
- [ ] **REVISAR / DEVOLVER AL GENERADOR** (Puntuación 7-10 o falta evidencia ejecutable)
- [ ] **BLOQUEAR** (Puntuación <= 6 o rompió la línea base)

## Seguimiento y Cierre Verificado de Hallazgos de Ronda 1

- **Hallazgo 1 (`Critical`) — CERRADO VERIFICADO:** `.gitignore:32` declara `!AGENTS.md` con precedencia superior a `.git/info/exclude:8`; `git check-ignore -v AGENTS.md` reporta `.gitignore:32:!AGENTS.md	AGENTS.md`, `git status --porcelain` lista `?? AGENTS.md` y `git add --dry-run .` incluye `add 'AGENTS.md'`.
- **Hallazgo 2 (`Medium`) — CERRADO VERIFICADO:** `.gitattributes` declara `text eol=lf` explícito para scripts y artefactos `.md`/`.json` del arnés (`30/30` `required_files` reportan `eol: lf` en `git check-attr`), eliminando al `100%` las advertencias `LF will be replaced by CRLF` en `git status` y `git add --dry-run .` bajo `core.autocrlf=true` mientras preserva `4/4` `R100` en `docs/exec-plans/completed/*.md` y `0` cambios en código de producción.
- **Hallazgo 3 (`Minor`) — CERRADO VERIFICADO:** Puerta 3 en `init.sh` permanece íntegra (`npm test && npm run build`) y la cota documental (`~8.8s` / `< 10s` offline en Windows Git Bash) coincide con la medición empírica independiente (`8947 ms`).

---

### Constancia de Cierre de Instancia Efímera (`One-Shot / Stateless per Pass`)
Esta instancia virgen del Agente **Checker Independiente (`one-shot` / `zero-inheritance`, `conversationId: 27bb88dc-a404-4069-b63d-14f0bb99161f`)** ha concluido su única pasada de auditoría sobre `Round 2` (`feat-001`) con veredicto **`✅ Pass — 12 / 12 ACEPTAR`** y queda cerrada de forma definitiva. Queda terminantemente prohibido enviar `send_message` a este `conversationId` para solicitar aclaraciones o re-auditorías posteriores; cualquier evaluación futura exige lanzar un sub-agente `Checker` completamente nuevo (`invoke_subagent` `one-shot` con ventana de contexto virgen).
