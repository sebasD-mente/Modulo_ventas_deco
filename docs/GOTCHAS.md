# GOTCHAS.md (Tabla de Control de los 15 Gotchas de Producción, Auditoría de 25 Puntos y Estudios de Ablación)

Este documento reúne los **15 modos de fallo no obvios de producción (`Gotchas`)**, los matices técnicos finos de extracción de memoria, `Bootstrap` y `Prompt Cache`, la especificación de las **25 verificaciones mecánicas** de `scripts/validate-harness.mjs` (con su invariante `structuredHas`) y el protocolo operativo para ejecutar **Estudios de Ablación** mensuales.

---

## 1. Tabla de Control de los 15 Gotchas Críticos de Producción

Esta tabla documenta los 15 errores sutiles de sistemas agénticos reales y el mecanismo exacto con el que nuestro arnés los neutraliza:

| # | Gotcha (Trampa Oculta) | Qué pasa si caes en ella | Cómo lo previene nuestro Arnés | Artefacto / Candado en este Repo |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Los límites del índice de memoria cortan en silencio** | `memory/INDEX.md` se trunca al superar `200` líneas o `25 KB` y el agente pierde recuerdos recientes sin emitir error. | Escribir solo 1 línea de gancho (`<= 120` caracteres) en `memory/INDEX.md` y guardar el detalle en `memory/topics/*.md`. | `memory/INDEX.md` + `scripts/check-architecture.sh` (Sección 3) |
| **2** | **El orden de prioridad de archivos es contraintuitivo** | Una regla global de usuario u organización es ignorada en silencio cuando entra en conflicto con reglas más cercanas. | Respetar la jerarquía explícita donde lo más local gana siempre: `Local (*.local.md) > Subdirectorio (AGENTS.md) > Proyecto raíz (AGENTS.md) > Usuario > Organización`, ignorando `*.local.md` en `.gitignore`. | `.gitignore` + `memory/topics/harness-rules.md` + `AGENTS.md` |
| **3** | **Ventana de carrera al extraer memoria en segundo plano** | El usuario envía otro mensaje antes de que termine la extracción asíncrona o se duplica lo ya escrito por el agente. | Disparar solo tras respuesta final sin *tool calls* pendientes, fusionar (*coalesce*) peticiones concurrentes, aplicar **exclusión mutua** (omitir si el agente principal escribió en `memory/` ese turno) y **avanzar el cursor solo tras éxito**. | `docs/SECURITY.md` (Sección 1.2) + `AGENTS.md` (`End of Session`) |
| **4** | **Guardar contenido derivable en la memoria** | El agente memoriza detalles de arquitectura o código; mañana el repositorio cambia y la memoria miente (*Stale Memory Poisoning*). | Prohibir almacenar en `memory/` cualquier dato derivable directamente del repositorio (`git log`, rutas, esquemas o capas). | `memory/INDEX.md` + `memory/topics/harness-rules.md` |
| **5** | **Clasificar concurrencia por herramienta y no por llamada** | Marcar la terminal como "segura en paralelo" provoca que un comando mutador corra mientras otro lee archivos. | Clasificar cada invocación individualmente en runtime: lecturas puras (`pwd`, `git status`, `cat`) en paralelo; mutaciones (`git commit`, `init.sh`, ediciones) estrictamente en serie. | `docs/SECURITY.md` (Sección 2.1) + `.agents/hooks.json` |
| **6** | **La evaluación de permisos tiene efectos secundarios** | Cachear una decisión de permiso impide registrar denegaciones o escalar automáticamente el modo `auto -> ask`. | Evaluar permisos en fresco en cada llamada sensible respetando el orden `Política -> Usuario -> Proyecto -> Local -> Sesión`; nunca cachear autorizaciones mutadoras. | `docs/SECURITY.md` (Sección 2.1 y 2.2) |
| **7** | **El trabajo asíncrono casi nunca pasa por `"pending"`** | Un monitor espera ver tareas de fondo en `"pending"`, pero el runtime las registra directamente en `"running"`. | Registrar unidades asíncronas con **`Typed Prefixed IDs`** (`extraction-001`, `checker-003`), salida en disco y estados `running -> completed \| failed \| killed`, usando en `feature_list.json` los 4 estados canónicos (`not-started`, `in-progress`, `blocked`, `done`). | `feature_list.json` + `scripts/feature-list.schema.json` + `docs/SECURITY.md` (Sección 3.2) |
| **8** | **Hijos creados con `Fork` haciendo nuevos `Forks`** | Un sub-agente bifurcado vuelve a bifurcarse heredando todo el contexto y el coste de tokens explota exponencialmente; pero quitar la herramienta del prompt rompe la `prompt cache`. | Invariante de **un solo nivel**: **mantener la herramienta `fork` en el pool de definiciones del hijo** (para compartir el prefijo exacto de `prompt cache` con el padre), pero **bloquear su ejecución en tiempo de llamada (*at call time*)**. | `docs/SECURITY.md` (Sección 1.4) + `graph.md` (Sección 4) |
| **9** | **Constructores de contexto cacheados sin invalidación** | El agente edita un archivo pero el *context builder* memoizado sigue sirviendo la copia antigua toda la sesión. | Todo punto de mutación (`writeFile` / `editFile`) debe invalidar explícitamente su clave en el caché de contexto y re-verificar con `PostToolUse` / `bash ./init.sh`. | `docs/SECURITY.md` (Sección 1.1) + `.agents/hooks.json` (`PostToolUse`) |
| **10** | **La confianza de los Hooks es Todo-o-Nada** | En un workspace no confiable se desactivan todos los hooks en silencio, o evaluar hooks individuales abre brechas de seguridad. | Gobernar el arranque con el **`Bootstrap en 4 Etapas y Frontera de Confianza`**: no cargar secretos, escritura ni hooks antes del consentimiento (Etapa 3); sin confianza se omiten todos los hooks en el despacho y la sesión queda en solo lectura. | `docs/SECURITY.md` (Sección 3.2) + `.agents/hooks.json` + `init.sh` |
| **11** | **Limpiar resultados de sub-agentes antes de notificar al padre** | El recolector borra el resultado de una unidad terminada antes de que el coordinador padre alcance a leerlo (*race condition*). | Aplicar **`Two-Phase Eviction`**: (1) limpiar salida cruda en disco de forma *eager* al entrar en estado terminal, y (2) liberar el registro en memoria de forma *lazy* solo después de notificar al padre. | `docs/SECURITY.md` (Sección 3.2) + `graph.md` + `loop-state.md` |
| **12** | **Descripciones de Skills demasiado largas** | El listado de Skills trunca cada descripción a `~150` caracteres y las palabras clave al final nunca disparan la Skill. | Imponer un tope duro de `<= 150` caracteres en `description` del frontmatter YAML de cada `SKILL.md` colocando los disparadores distintivos al inicio. | `.agents/skills/maker-checker/SKILL.md` + `scripts/check-architecture.sh` |
| **13** | **El permiso por defecto de herramientas nuevas es `"Allow"`** | Conectar una nueva herramienta o servidor MCP sin política propia permite mutaciones silenciosas sin pasar por compuerta. | Modelo `Fail-Closed` en el registro de herramientas: toda herramienta sensible o nueva entra con `defaultPermission: 'ask'` o `'deny'`, nunca `'allow'`. | `docs/SECURITY.md` (Sección 2) |
| **14** | **La memoria de equipo requiere Auto-Memoria activa** | Deshabilitar la infraestructura base de auto-memoria desactiva también la capa compartida de memoria del equipo. | Mantener activa y validada en Puerta 1 la infraestructura base `memory/INDEX.md` + `memory/topics/*.md` antes de habilitar capas compartidas. | `init.sh` + `scripts/check-architecture.sh` |
| **15** | **Acumulación de archivos huérfanos en `memory/topics/`** | Una interrupción entre el Paso 1 (crear tema) y el Paso 2 (enlazar en índice) deja archivos huérfanos que consumen disco. | El vigilante `scripts/check-architecture.sh` barre `memory/topics/*.md` en cada corrida y falla con Bolígrafo Rojo si algún archivo no está referenciado en `memory/INDEX.md`. | `scripts/check-architecture.sh` (Sección 3) + `clean-state-checklist.md` |

### 1.1 Resumen de las 3 Invariantes Finas de Runtime (`Memoria`, `Bootstrap` y `Prompt Cache`)

1. **Exclusión Mutua y Cursor Atómico en Memoria (`Gotcha #3`)**: La extracción en segundo plano nunca compite con escrituras explícitas del turno principal: si el agente escribió en `memory/` durante el turno, la extracción automática se salta; si se ejecuta y falla, el cursor no avanza para reintentar esos mensajes en el siguiente turno.
2. **Bootstrap Ordenado en 4 Etapas con `Trust Boundary`, `Typed Prefixed IDs` y `Two-Phase Eviction` (`Gotchas #7, #10, #11`)**: `Stage 1 (Minimal Context)` -> `Stage 2 (Read-Only Safe Tools)` -> `Stage 3 (Trust Boundary Crossed)` -> `Stage 4 (Telemetry, Secrets, Write Tools & Hooks)`. Ningún subsistema sensible arranca antes de la Etapa 3, y las tareas de fondo usan IDs prefijados con desalojo *eager* en disco y *lazy* en memoria tras notificar al padre.
3. **Bloqueo en Tiempo de Llamada (`Call-Time Guard`) para Preservar `Prompt Cache` en `Fork` (`Gotcha #8`)**: Eliminar herramientas del prompt del sub-agente hijo altera el prefijo del sistema y destruye la `prompt cache`; por ello la definición de `fork` permanece visible en el pool del hijo pero el runtime rechaza cualquier llamada recursiva en el instante de ejecución.

---

## 2. Las 25 Verificaciones Exactas del Arnés (`validate-harness.mjs`)

El script `scripts/validate-harness.mjs` audita matemáticamente el arnés sobre **100 puntos** divididos en **5 subsistemas $\times$ 5 verificaciones objetivas**:

1. **Subsistema 1 — Instrucciones (`instructions`: 5/5)**:
   - Existe `AGENTS.md` en la raíz (diseñado como página de índice concisa ~100 líneas centrada en invariantes).
   - Documenta estructuradamente el flujo de arranque (`Startup Workflow` / `Before writing code`).
   - Documenta estructuradamente la Definición de Terminado (`Definition of Done`).
   - Expone los comandos de verificación (`Verification Commands`, `./init.sh`).
   - Enruta hacia los artefactos de estado (`feature_list.json` y `progress.md`).
2. **Subsistema 2 — Estado (`state`: 5/5)**:
   - Existe `feature_list.json` en la raíz.
   - `feature_list.json` cumple el esquema `scripts/feature-list.schema.json`: contiene al menos una tarea estructurada (`N >= 1` tareas con campos opcionales de dominio y valor observable `area`, `user_visible_behavior` y `notes`), exige **Pass-State Gating** (ninguna tarea en `done` con `evidence` vacío) y comprueba que todos los archivos declarados en `required_files` existan físicamente en disco y no estén vacíos.
   - Existe `progress.md` en la raíz.
   - `progress.md` incluye encabezados de reinicio (`Current State`, `What's Done`, `What's Next`).
   - `session-handoff.md` captura `Blockers`, `Files Changed` y `Next Session` / `Recommended Next Step`.
3. **Subsistema 3 — Verificación (`verification`: 5/5)**:
   - Existe el punto de entrada POSIX `init.sh` en la raíz.
   - `init.sh` activa fallo rápido (`set -euo pipefail`).
   - Se documenta el comando de pruebas (`test` / `validate-harness.mjs`).
   - Se documenta la validación estática y arquitectónica (`check-architecture.sh` / `lint` / `type` / `build`).
   - Se exige y verifica evidencia ejecutable (`Verification Evidence` / `command and output`).
4. **Subsistema 4 — Alcance (`scope`: 5/5)**:
   - `AGENTS.md` impone `One feature at a time` y `feature_list.json` cumple `WIP <= 1`.
   - `feature_list.json` rastrea `dependencies` y respeta el orden secuencial DAG sin saltarse tareas (ninguna tarea dependiente puede iniciar ni cerrarse mientras una dependencia esté en `not-started`, `in-progress` o `blocked`).
   - Cada tarea tiene un campo `status` explícito validado contra los **4 estados canónicos** (`not-started`, `in-progress`, `blocked`, `done`). Soportar explícitamente `blocked` evita que un agente bloqueado por credenciales externas o ambigüedades invente implementaciones falsas o debilite pruebas para forzar `done`.
   - `AGENTS.md` documenta la frontera de alcance (`Stay in scope`) y el protocolo `Escalation`.
   - `Definition of Done` actúa como compuerta de cierre de alcance.
5. **Subsistema 5 — Ciclo de Vida (`lifecycle`: 5/5)**:
   - Existe el script de inicio `init.sh`.
   - `AGENTS.md` define el protocolo estructurado `End of Session`.
   - Existe `session-handoff.md` en la raíz.
   - `progress.md` y `session-handoff.md` contienen los marcadores de reinicio (`Last Updated`, `Current Objective`, `Recommended Next Step`).
   - Está documentada la ruta de estado limpio y reiniciable (`restartable`, `clean state`).

> [!IMPORTANT]
> **Invariante `structuredHas` (Por qué el Formato Importa)**
> `scripts/lib/harness-utils.mjs` evalúa las reglas de `AGENTS.md`, `progress.md` y `session-handoff.md` mediante la función `structuredHas`: **solo reconoce reglas expresadas en encabezados Markdown (`##`), listas (`-` o `1.`), tablas (`|`) o etiquetas en negrita al inicio de línea (`**...**`)**. Esconder reglas operativas dentro de párrafos largos de prosa hace que tanto el validador como el LLM las pasen por alto.

---

## 3. Protocolo de Estudios de Ablación y Simplificación Continua

Un arnés de ingeniería no solo agrega defensas; también **se poda empíricamente**. Cada regla o candado existe porque el modelo actual falla sin él, pero cuando el modelo base evoluciona, ciertas restricciones pueden volverse redundantes.

### Procedimiento en 4 Pasos para Ejecutar un Estudio de Ablación
1. **Línea Base (`Baseline Snapshot`)**: Confirma que `bash ./init.sh` y `node scripts/validate-harness.mjs` están en `100/100` y revisa las calificaciones actuales en `docs/QUALITY_SCORE.md`.
2. **Aislamiento de Variable (`Single-Component Ablation`)**: En un entorno o copia temporal aislada (sin corromper el árbol principal), desactiva **exactamente un componente o regla** a la vez (por ejemplo, retirar una regla estructurada de `AGENTS.md`, quitar la evidencia de una tarea `done` o introducir un archivo huérfano en `memory/topics/`).
3. **Ejecución del Benchmark Mecánico**: Corre el conjunto de verificación (`node scripts/validate-harness.mjs` y/o `bash scripts/check-architecture.sh`) y mide el impacto exacto en el puntaje y en el diagnóstico de Bolígrafo Rojo.
4. **Decisión Basada en Evidencia y Registro**:
   - **Si la calidad o el puntaje cae** (o el vigilante detecta una regresión real): Queda demostrado empíricamente el valor marginal positivo del componente. **Restáuralo de inmediato** y registra el experimento con la decisión **Mantener** en la Sección 3 de `docs/QUALITY_SCORE.md`.
   - **Si la calidad, seguridad y determinismo permanecen idénticos sin él**: Elimina el componente redundante para reducir el *Discovery Cost* y registra la simplificación en `docs/QUALITY_SCORE.md`.

---

## 4. Las 4 Etapas Progresivas del Arnés y Expansión Bajo Demanda (Anti-`Doc Bloat`)

La arquitectura de este arnés organiza sus capacidades en 4 etapas de madurez progresiva sin caer en `Doc Bloat` (ningún documento auxiliar en `docs/` se enlaza en `Required Artifacts` de `AGENTS.md` antes de existir físicamente con información real del proyecto):

1. **Etapa 1 — Paquete Mínimo Vital (Día 1)**: Los archivos base (`.gitignore`, `AGENTS.md`, `feature_list.json`, `scripts/feature-list.schema.json`, `progress.md`, `session-handoff.md`, `init.sh`) validados a `100/100` sobre cualquier proyecto (`N >= 1` tareas).
2. **Etapa 2 — Continuidad, Higiene y Memoria en Dos Pasos**: Verificación de arranque en frío, checklist de 5 dimensiones (`clean-state-checklist.md`) y Auto-Memoria (`memory/INDEX.md` + `memory/topics/harness-rules.md`).
3. **Etapa 3 — Arquitectura en 6 Capas, `Capability Seams`, Observabilidad Dual y Seguridad `Fail-Closed`**: `ARCHITECTURE.md` y Bolígrafo Rojo en `scripts/check-architecture.sh`, `docs/RELIABILITY.md`, `sprint-contract.md`, `evaluator-rubric.md`, `docs/QUALITY_SCORE.md`, `docs/SECURITY.md` y `.agents/hooks.json`.
4. **Etapa 4 — Loops Autónomos, Grafos de 5 Nodos y Superficie Avanzada OpenAI Bajo Demanda**: `goal.md`, `maker-prompt.md`, `checker-prompt.md`, `loop-state.md`, `.agents/skills/maker-checker/SKILL.md`, `graph.md`, `docs/GOTCHAS.md` y creación bajo demanda (según el SOP `encode-knowledge-into-repo`) de `docs/product-specs/`, `docs/design-docs/`, `docs/exec-plans/` (`active/`, `completed/`, `tech-debt-tracker.md`), `docs/FRONTEND.md`, `docs/references/*-llms.txt` y `docs/generated/`.
