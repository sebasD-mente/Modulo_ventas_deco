# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-004` Completada en `done`)
- **Tarea activa (`in-progress`):** Ninguna (`WIP = 0`; `feat-000..004` selladas en `done` con evidencia ejecutable verificada).
- **Decisión arquitectónica humana vigente (`Opción A`):** Privilegiar la **cohesión de dominio real** y los límites de 6 capas (`check-architecture.sh` con `0` excepciones) por encima de los antiguos micro-techos artificiales de líneas (`<= 220` en `aiMediaController.js` y `<= 280` en `aiMediaService.js`), prohibiendo fragmentar `server/` o `src/` en código ravioli.

## Alcance Verificado de `feat-004` (`done`)
- **`tests/ai/voice-lexical-priming-hesitation.test.js` (sección `5`) y `tests/ai/voice-vad-reengineering.test.js` (`Archivo D` y `Archivo F`)**:
  - Sustituir los antiguos micro-techos rígidos (`aiMediaController.js <= 220` y `aiMediaService.js <= 280`) por verificaciones contractuales de cohesión de dominio y arquitectura limpia (`0` imports directos a `config/prisma.js` o `config/env.js` en `aiMediaController.js`, exportación de sus 6 handlers multimodales con `recordLlmInteraction` y preservación de contratos de inferencia en `aiMediaService.js`), manteniendo intactas todas las demás aserciones de ambas suites.
- **`tests/ai/voice-vad-reengineering.test.js` (`Archivo A` y `Archivo G`)**:
  - Alinear `Archivo A` (`useAiVoiceRecorder.js`) al timeout parametrizado real (`maxDurationMs = 15000` + `setTimeout(() => stopRecording(), maxDurationMs)`).
  - Alinear `Archivo G` (`webCatalogService.js`) al contrato vigente de búsqueda por `tags` (`[DEKO-STANDIA-063]`): verificar que coinciden pósters con el token en título o `tags` y que un póster sin el token en título/subtítulo ni `tags` queda excluido.
- **`tests/adversarial/m1-voice-priming-hesitation-stress.test.js` (caso `3.3`)**:
  - Actualizar el antiguo test de bug (`'GRANDE'`) para validar el comportamiento ya corregido `normalizeCatalogSizeId('extra grande') === 'GIGANTE'`.

## Exclusiones Explícitas (`Hands off`)
- **Cero lectura o impresión de `.env`**.
- **Cero toque a código productivo o infraestructura (`Hands off` absoluto)**: prohibido modificar ni una sola línea en `server/`, `src/`, `prisma/`, `scripts/`, `package.json`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `entrypoint.sh`, `init.sh` o `AGENTS.md`.
- **Cero despliegue remoto**: prohibido ejecutar `git push` o `npm run deploy`; al cerrar `feat-004`, dejar únicamente commit atómico local con `0 CRLF` para auditoría independiente en la sesión principal.

## Criterios Verificables de Cierre para `feat-004`
1. Solo los `3` archivos de `tests/` en `required_files` (más los artefactos de estado del arnés) presentan cambios respecto al commit previo, con `0` cambios en `server/` y `src/` y `0 CRLF`.
2. `npm run test:voice` pasa al `100%` (`53/53 PASS`, `0 fail`).
3. `bash ./init.sh`, `bash scripts/check-architecture.sh`, `node scripts/validate-harness.mjs --min-score 100` y `npm run harness:check` finalizan en verde (`Overall: 100/100`, `25/25 PASS`, `HARNESS_PASS`).
