# Clean State Checklist (Lista de Verificación de Estado Limpio — 5 Dimensiones)

> **Fundamento (Ley de Evolución del Software de Lehman):** Sin una limpieza activa al final de cada sesión, la entropía y la deuda operativa (archivos temporales, pruebas a medias, notas desactualizadas) crecen exponencialmente hasta degradar la capacidad de arranque en frío del agente.

Ninguna sesión del agente se considera terminada hasta que las **5 dimensiones** estén verificadas:

- [ ] **1. Dimensión de Build / Integridad**: El proyecto compila o sus archivos estructurados (`feature_list.json`, documentos) validan sin errores de sintaxis.
- [ ] **2. Dimensión de Pruebas (`Verification`)**: La ruta estándar de verificación (`bash ./init.sh`) se ejecutó y pasó al 100%, incluyendo las pruebas que ya existían antes de esta sesión (cero regresiones).
- [ ] **3. Dimensión de Progreso (`State`)**: `progress.md`, `feature_list.json` y `session-handoff.md` fueron actualizados y reflejan la verdad exacta (ninguna tarea está marcada como `done` sin evidencia real y hay como máximo 1 tarea en `in-progress`).
- [ ] **4. Dimensión de Artefactos (`Cleanup`)**: Se eliminaron todos los archivos temporales (`*.tmp`, `*.bak`, `*.swp`, logs sueltos de depuración) y no quedaron cambios a medio hacer sin documentar.
- [ ] **5. Dimensión de Inicio (`Restartability`)**: La próxima sesión puede ejecutar `bash ./init.sh` inmediatamente y empezar a trabajar en menos de 3 minutos sin rescate manual humano.

## Comandos de Verificación Rápida de las 5 Dimensiones

```bash
# Dimensiones 1, 2 y 3 (Integridad, Pruebas y Estado con WIP <= 1 y Pass-State Gating):
bash ./init.sh
node scripts/validate-harness.mjs

# Dimensión 4 (Detección de artefactos huérfanos y estado del árbol de trabajo):
git status --short
```
