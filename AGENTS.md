# AGENTS.md

Este repositorio está gobernado por un arnés de ingeniería para agentes de larga duración. Siguiendo el principio de **Codex**, este archivo es una **página de índice (~100 líneas)** centrada en invariantes y rutas de verificación, no una enciclopedia que microgestione la implementación. El objetivo es completar una sola tarea verificada a la vez y dejar el repositorio limpio y reiniciable (`restartable`).

## Startup Workflow

Before writing code or modifying any project deliverable:
1. **Confirma el directorio de trabajo** con `pwd`.
2. **Lee este archivo (`AGENTS.md`)** de principio a fin (y cualquier `AGENTS.md` local del subdirectorio que vayas a tocar).
3. **Lee `progress.md` y `session-handoff.md`** para conocer el último estado verificado, riesgos abiertos y el siguiente paso recomendado.
4. **Lee `feature_list.json`** para inspeccionar el estado (`status`) y prioridades de las tareas.
5. **Revisa los commits recientes** con `git log --oneline -5` (si el repositorio Git ya tiene historial).
6. **Ejecuta `bash ./init.sh`** para verificar que el entorno y la línea base están sanos.

> REGLA DE BLOQUEO INICIAL: Si `bash ./init.sh` falla al iniciar la sesión, DETENTE y repara primero la línea base antes de agregar alcance.

## Working Rules

- **Página de Índice e Invariantes sobre Microgestión (`Codex` / `Claude Code`)**: Mantén `AGENTS.md` conciso (~100 líneas) enfocado en restricciones innegociables y comandos de verificación (*"don't micromanage the implementation; focus on invariants"*). El detalle procedimental vive en `docs/` y `.agents/skills/` bajo demanda; en monorepos, los `AGENTS.md` de subdirectorios se cargan bajo demanda al leer ese directorio (`Organización -> Usuario -> Proyecto raíz -> Subdirectorio -> Override local *.local.md`).
- **El Arnés lo lleva el Agente, NO el Usuario (Interacción 100% Natural)**: Está prohibido exigirle al usuario que edite archivos del arnés o hable en formato de lista de tareas. Conversa con naturalidad; tú traduces los acuerdos hacia `feature_list.json`, `sprint-contract.md`, `progress.md` y `session-handoff.md` (y en proyectos nuevos o *Brownfield*, inspeccionas y adaptas `feature_list.json` y `ARCHITECTURE.md` sin carga manual al humano).
- **Dos Marchas de Trabajo (`Modo Diario Ágil` por defecto vs `Modo Crítico / Loop`)**: El **Modo Diario Ágil** es el predeterminado para tareas normales (implementar bajo `WIP = 1` + verificar `bash ./init.sh` + actualizar `feature_list.json` y `progress.md`, sin exigir `loop-state.md` ni sub-agente *Checker* salvo cierre de hito o solicitud del usuario); el **Modo Crítico / Loop (`/goal`)** activa `loop-state.md` y el sub-agente *Checker* `one-shot` aislado para cambios de arquitectura, seguridad o bucles autónomos.
- **One feature at a time (`WIP = 1`)**: Elige exactamente UNA tarea no terminada de `feature_list.json` cuyas `dependencies` estén en `done` con sus `required_files` físicos creados en disco, y cambia su estado a `in-progress` (prohibido superar `WIP = 1` o saltarse el orden secuencial DAG; usa `blocked` si un requisito externo impide avanzar).
- **Contrato Previo al Código (`sprint-contract.md`)**: Antes de implementar la tarea activa, actualiza `sprint-contract.md` con alcance incluido, exclusiones explícitas y criterios verificables.
- **Stay in scope**: Mantén todos tus cambios estrictamente dentro del alcance de la tarea activa sin refactorizar módulos ajenos. Registra peticiones nuevas en `feature_list.json` para ejecutarlas en orden.
- **Verification required & Prohibido debilitar reglas**: Nunca declares una tarea terminada por inspección visual; ejecuta los comandos de verificación reales y jamás borres, comentes ni relajes pruebas o validadores.
- **Separación estricta Maker-Checker (`zero-inheritance` y `One-Shot` por pasada)**: El *Maker* tiene prohibido autoaprobarse en `evaluator-rubric.md`. Para el rol *Checker* queda anulada cualquier directriz genérica de continuar sub-agentes existentes: **1 Checker = 1 sola auditoría (`one-shot`)**; toda auditoría o re-auditoría tras corregir un hallazgo DEBE lanzar una instancia `invoke_subagent` completamente nueva con ventana virgen, quedando estrictamente prohibido usar `send_message` hacia el `conversationId` de un *Checker* ya utilizado.

## Required Artifacts

- `.gitignore` — Protección de secretos (`.env*`), overrides locales (`*.local.md`), dependencias, builds y temporales.
- `feature_list.json` — Fuente única de verdad para estado (`not-started`, `in-progress`, `blocked`, `done`), DAG, `verification` y `evidence`.
- `scripts/feature-list.schema.json` — Esquema JSON Draft-07 canónico con `Pass-State Gating` y campos `area`/`user_visible_behavior`.
- `progress.md` — Registro maestro de continuidad, decisiones (`por qué` + `Alternatives considered`) y estado actual.
- `init.sh` — Punto de entrada POSIX multi-stack para instalación y verificación en 3 puertas (`set -euo pipefail`).
- `session-handoff.md` — Acta de entrega de turno obligatoria al finalizar cada sesión.
- `clean-state-checklist.md` — Lista de verificación de las 5 dimensiones de estado limpio antes de cerrar sesión.
- `memory/INDEX.md` — Índice de Auto-Memoria en Dos Pasos (tope de 200 líneas / 25 KB) hacia `memory/topics/*.md`.
- `ARCHITECTURE.md` — Mapa de dominios, 6 capas (`Types -> Config -> Repo -> Service -> Runtime -> UI`), `Capability Seams`, interfaces transversales y puntos calientes.
- `scripts/check-architecture.sh` — Vigilante mecánico de límites arquitectónicos, higiene `cleanup-scanner` y Bolígrafo Rojo (`ERROR + POR QUÉ + SOLUCIÓN`).
- `docs/RELIABILITY.md` — Observabilidad de Runtime: logs JSON estructurados con `correlationId` y fiabilidad en 3 puertas.
- `sprint-contract.md` — Contrato formal de alcance (`Scope`), exclusiones explícitas y criterios de éxito previos al código.
- `evaluator-rubric.md` — Rúbrica objetiva de 0 a 12 puntos exclusiva para el Agente Evaluador (*Checker*) `one-shot` en contexto aislado (`zero-inheritance`).
- `docs/QUALITY_SCORE.md` — Semáforo de salud (`A-D`) por dominio/capa y registro de Estudios de Ablación.
- `docs/SECURITY.md` — Presupuesto de contexto (`Write-Select-Compress-Isolate`), 5 niveles de compactación, 4 capas de extensión, `Fail-Closed`, `Turn Event Pipeline`, Bootstrap en 4 etapas y `Model-Visible Means Logged`.
- `.agents/hooks.json` — Candados deterministas nativos de ciclo de vida (`PreToolUse`, `PostToolUse` y `Stop`).
- `scripts/harness-hooks.mjs` — Runner Node.js multiplataforma (`stdin`/`stdout` JSON) de hooks nativos y Candado 3 `one-shot`.
- `goal.md` — Loop Basado en Objetivo (`/goal`) con 3 categorías de archivos y Disyuntor de 4 Candados (`4-Lock Circuit Breaker`).
- `maker-prompt.md` — Instrucciones operativas por ronda para el Agente Constructor (*Maker*).
- `checker-prompt.md` — Instrucciones operativas para el Agente Evaluador Independiente (*Checker*) `one-shot` bajo `zero-inheritance`.
- `loop-state.md` — Memoria entre rondas, mecanismo de Trinquete (*Ratchet*) y monitor de disyuntores.
- `.agents/skills/maker-checker/SKILL.md` — Skill bajo demanda del bucle `Maker-Checker` con `description <= 150` caracteres (`Gotcha #12`).
- `graph.md` — Ingeniería de Grafos de 5 nodos (`research -> implement -> verify -> human_approval -> merge`), `error_layer` y patrones `Coordinator`, `Fork` y `Swarm`.
- `docs/GOTCHAS.md` — Tabla de los 15 Gotchas críticos de producción, auditoría de las 25 verificaciones (`structuredHas`) y protocolo de Estudios de Ablación.

## Progressive Expansion (Anti-Doc Bloat — SOP `encode-knowledge-into-repo`)

Cuando decisiones de producto, diseño o referencias residan fuera del repositorio (chats, tickets o acuerdos verbales), codifícalas **bajo demanda** creando únicamente el artefacto necesario (y enlázalo arriba en `Required Artifacts` recién después de crearlo con contenido real):
- **Comportamiento de producto y aceptación**: `docs/product-specs/` (y `docs/PRODUCT_SENSE.md` para criterios transversales).
- **Razonamiento de diseño duradero**: `docs/design-docs/`.
- **Planes multi-sesión y deuda pospuesta**: `docs/exec-plans/active/`, `docs/exec-plans/completed/` y `docs/exec-plans/tech-debt-tracker.md`.
- **Restricciones de UI, diseño y accesibilidad**: `docs/FRONTEND.md`.
- **Referencias externas compactas para LLM y derivados**: `docs/references/*-llms.txt` y `docs/generated/` (no editable a mano).

## Definition of Done

Una tarea está terminada (`done` only when) SOLO cuando TODAS las siguientes condiciones se cumplen:

- [ ] El comportamiento o entregable objetivo está implementado por completo.
- [ ] Los pasos listados en `verification` de la tarea y `bash ./init.sh` se ejecutaron realmente (tests, lint, type-check o build según aplique).
- [ ] La evidencia ejecutable (`Verification Evidence`: comando exacto y salida obtenida) quedó registrada en `evidence` de `feature_list.json` y en `progress.md`.
- [ ] El repositorio permanece limpio y reiniciable (`restartable`) desde la ruta de inicio estándar.

## Verification Commands

```bash
bash ./init.sh                                     # Verificación completa en 3 puertas (Puertas 1, 2 y 3)
bash scripts/check-architecture.sh                 # Vigilante mecánico de 6 capas, higiene y Bolígrafo Rojo
node scripts/validate-harness.mjs --min-score 100  # Auditoría matemática 100/100 (WIP=1, DAG y Pass-State Gating)
```
- `bash ./init.sh` (ejecuta Puerta 1 Estática/Arquitectura, Puerta 2 Comportamiento/Subsistemas y Puerta 3 Sistema Completo/Build/Test)
- `bash scripts/check-architecture.sh` (verifica `ARCHITECTURE.md`, 6 capas, enlaces en `Required Artifacts` y `cleanup-scanner`)
- `node scripts/validate-harness.mjs --min-score 100` (verifica `100/100` en los 5 subsistemas del arnés)

## Escalation

Si durante la ejecución encuentras cualquiera de estas situaciones, escala de forma estructurada en lugar de improvisar:
- **Architecture decisions (Decisiones de arquitectura)**: Consulta `ARCHITECTURE.md` (y `docs/design-docs/` si existe); si requiere alterar límites de capas o invariantes, consulta al usuario antes de codificar.
- **Unclear requirements (Requisitos ambiguos)**: Revisa `feature_list.json`, `sprint-contract.md` y `docs/product-specs/` (si existe); si persiste la ambigüedad, pregunta al usuario.
- **Repeated test failures (Fallos repetidos de pruebas)**: Respeta los disyuntores de `goal.md` / `loop-state.md`, documenta el diagnóstico en `progress.md`, marca `"status": "blocked"` si depende de un bloqueo externo y solicita revisión humana.
- **Scope ambiguity (Ambigüedad de alcance)**: Relee `feature_list.json` (`Definition of Done`) y `sprint-contract.md`; anota cualquier alcance adicional como tarea futura sin romper `WIP = 1`.

## End of Session

Before ending a session or when context usage reaches 65%:

1. Ejecuta `bash ./init.sh` y confirma que el estado es limpio (`clean state`).
2. Actualiza `progress.md` con lo completado, decisiones tomadas, archivos modificados y evidencia.
3. Actualiza `feature_list.json` con el estado real y el campo `evidence` documentado.
4. Actualiza `session-handoff.md` registrando bloqueos (`Blockers`), archivos tocados y el siguiente paso recomendado (`Recommended Next Step`).
5. Elimina cualquier archivo temporal (`*.tmp`, `*.bak`, `*.swp`) y realiza un `git commit` descriptivo cuando sea seguro reanudar.
