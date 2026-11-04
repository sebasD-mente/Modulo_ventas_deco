# Tema de Memoria: Reglas de Producción del Arnés y Entorno Local

- **Tipo Taxonómico**: `feedback` / `project` / `user`
- **Última Actualización**: 2026-10-30
- **Propósito**: Registrar decisiones de contexto del proyecto, preferencias del usuario y particularidades operativas que NO se deducen leyendo el código fuente (cumpliendo el Gotcha #4).

---

## 1. Preferencias del Usuario y Modalidad de Trabajo (`user` / `feedback`)

- **Interacción 100% Natural con el Usuario (`Agent-Owned Harness`)**: El usuario se comunica siempre en lenguaje natural (ideas, decisiones de diseño, dudas o solicitudes directas). El agente es el único responsable de traducir de forma transparente los acuerdos de la conversación hacia `feature_list.json`, `sprint-contract.md`, `progress.md` y `session-handoff.md`.
- **Cero Salto de Tareas (`Strict Sequential DAG` y `WIP = 1`)**: Las tareas registradas en `feature_list.json` (`N >= 1`) se ejecutan una por una respetando estrictamente sus dependencias (`dependencies`) y entregables físicos (`required_files`). Nunca se debe adelantar trabajo de una tarea cuyas dependencias no estén en `done`, ni crear documentos en `docs/` sin información real del proyecto (`Anti-Doc Bloat`).

## 2. Ejecución Multiplataforma de `init.sh` (`project` / `feedback`)

- **Punto de Entrada Único POSIX (`init.sh`)**: Se mantiene un único punto de entrada canónico POSIX (`init.sh`) para todas las plataformas, evitando el antipatrón de *Split-Brain* (divergencia entre scripts separados para Windows y Linux/macOS CI).
  - **Linux / macOS**: `bash ./init.sh`
  - **Windows PowerShell (vía Git Bash)**: `& "C:\Program Files\Git\bin\bash.exe" ./init.sh`

## 3. Reglas Operativas de Memoria Persistente (`project` / `reference`)

- **Separación Memoria de Instrucción vs. Auto-Memoria**:
  - **Memoria de Instrucción (`AGENTS.md`, `docs/`)**: Curada por el humano y versionada en Git; define las leyes del proyecto.
  - **Auto-Memoria (`memory/INDEX.md` + `memory/topics/*.md`)**: Escrita por el agente para retener aprendizajes, feedback y decisiones no derivables del código.
- **Invariante de Guardado en Dos Pasos (`Two-Step Save Invariant`)**:
  1. **Paso 1**: Escribir o actualizar primero el archivo detallado en `memory/topics/<tema>.md`.
  2. **Paso 2**: Añadir o actualizar únicamente **una línea de gancho (resumen)** en `memory/INDEX.md` apuntando al archivo de `memory/topics/`.
  - **Razón técnica (Gotcha #1 y #15)**: `memory/INDEX.md` tiene un tope estricto de **200 líneas o 25 KB**; escribir primero el archivo de tema evita corromper el índice si la sesión se interrumpe a mitad de escritura. Si ocurre un corte entre el Paso 1 y el Paso 2, el barrido periódico (`cleanup-scanner`) detecta archivos huérfanos en `memory/topics/` no enlazados en `memory/INDEX.md`.
- **Orden de Prioridad de Instrucciones (Gotcha #2)**:
  - La regla más local siempre gana:
    `Organización` -> `Usuario Global` -> `Proyecto (AGENTS.md)` -> `Subdirectorio (AGENTS.md)` -> `Local Override (AGENTS.local.md / CLAUDE.local.md)`.
