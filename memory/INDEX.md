# Auto-Memory Index (`memory/INDEX.md`)

> **LÍMITE DURO DE CAPACIDAD (Gotcha #1):** Este archivo índice se carga al inicio de cada sesión y NUNCA debe superar **200 líneas** ni **25 KB**. Superar este límite provoca truncamiento silencioso y pérdida de contexto reciente.

## Reglas de Oro de Producción para Auto-Memoria

1. **Separación Estricta (Memoria de Instrucción vs. Auto-Memoria)**:
   - **Memoria de Instrucción (`AGENTS.md`, `docs/`)**: Curada por el humano, controlada en Git; define las leyes del sistema.
   - **Auto-Memoria (`memory/`)**: Escrita por el agente para conservar preferencias, correcciones y contexto no deducible del código.
2. **Invariante de Guardado en Dos Pasos (`Two-Step Save Invariant`)**:
   - **Paso 1**: Escribir primero el detalle completo en un archivo separado dentro de `memory/topics/<nombre-del-tema>.md`.
   - **Paso 2**: Añadir **una sola línea resumen (gancho)** en la sección `Índice de Temas Activos` de este `memory/INDEX.md` apuntando a ese archivo.
   - *Protección contra huérfanos (Gotcha #15)*: Si una sesión se interrumpe entre el Paso 1 y el Paso 2, el índice permanece íntegro y el barrido de limpieza (`cleanup-scanner`) detecta cualquier archivo en `memory/topics/` no referenciado aquí.
3. **Taxonomía de 4 Tipos Permitidos vs. Prohibición de Contenido Derivable (Gotcha #4)**:
   - **SÍ GUARDAR (4 Tipos Permitidos)**:
     - `user`: Preferencias de trabajo, estilo de aprendizaje e idioma del usuario.
     - `feedback`: Correcciones de comportamiento y ajustes operativos validados.
     - `project`: Decisiones de contexto, porqués históricos y restricciones del entorno que no se deducen leyendo el código.
     - `reference`: Ubicación de recursos externos, paneles o documentación fuera del repositorio.
   - **PROHIBIDO GUARDAR**: Contenido **derivable del propio repositorio** (árbol de archivos, firmas de funciones, estado actual de tareas o código fuente). Cuando el repositorio cambia, la memoria derivable miente.
4. **Orden de Prioridad de las Instrucciones (Gotcha #2)**:
   - La regla más local siempre gana:
     `Organización` -> `Usuario Global` -> `Proyecto (AGENTS.md)` -> `Subdirectorio (AGENTS.md)` -> `Local Override (AGENTS.local.md / CLAUDE.local.md)`.

---

## Índice de Temas Activos (1 línea de gancho por archivo)

- `[feedback/project]` [harness-rules.md](topics/harness-rules.md) — Interacción natural, WIP=1, 5 niveles e `init.sh` multiplataforma (Linux/macOS y Windows PowerShell).
