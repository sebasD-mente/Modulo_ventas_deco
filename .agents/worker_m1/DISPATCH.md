# DISPATCH — Worker M1: Backend Gen 3 Pura & Pool Rotativo Multi-Key

## Mandato
Implementar quirúrgicamente el Hito M1 cumpliendo R1 y R2 según las especificaciones del reporte de Explorer 1 (`c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/teamwork_preview_explorer_survey_16_1/handoff.md`).

## Archivo de Requerimientos Originales
`c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md` (Lectura obligatoria)

## Archivos Asignados con Propiedad Exclusiva de Escritura
- `server/config/env.js`
- `server/services/ai/aiKeyPoolService.js` (NUEVO, < 120 líneas)
- `server/services/geminiPoolService.js` (ESTRICTO: <= 334 líneas)
- `server/config/gemini.js`
- `server/services/ai/aiClosedLoopService.js` (< 120 líneas)
- `server/services/ai/aiStreamService.js` (< 150 líneas)
- `server/controllers/aiController.js`
- `server/services/llmObservabilityService.js`
- `server/index.js`
- `.env.example`
- `docker-compose.yml`
- `README.md`
- `src/components/ai-chat/ChatHeader.jsx`
- `tests/ai/gemini-key-pool.test.js` (NUEVO)
- `tests/ai/gemini-pool.test.js`
- `tests/adversarial/m4-pool-resilience-adversarial.test.js`
- `tests/ai/m4-challenger2-adversarial.test.js`
- `tests/m3-forensic-audit.test.js`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Requerimientos Técnicos Detallados
1. `server/config/env.js`:
   - Agregar `GEMINI_API_KEYS: z.string().optional()`.
   - Modificar default de `GEMINI_MODEL` a `'gemini-3.8-flash'`.
2. Crear `server/services/ai/aiKeyPoolService.js` (< 120 líneas):
   - Parsear `GEMINI_API_KEYS` (separadas por coma) o fallback a `GEMINI_API_KEY`.
   - Rotación Round-Robin.
   - Cooldown temporal de 60s en `Map<string, number>` ante 429 (`RESOURCE_EXHAUSTED`).
   - Instanciación y caché de `@google/genai` por clave.
   - Exports: `getAvailableKeys`, `getNextClient`, `markKeyCooldown`, `isKeyInCooldown`, `resetKeyPool`.
3. Refactorizar `server/services/geminiPoolService.js`:
   - `MODEL_PRIORITY_POOL`: `['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']`.
   - Podar comentarios JSDoc y optimizar clasificadores booleanos para reducir el archivo a ~280-300 líneas.
   - Integrar reintento con `getNextClient()` en 429 antes de cambiar de modelo.
   - El archivo resultante DEBE ser `<= 334 líneas`.
4. Erradicar `gemini-1.5-flash` y `gemini-2.5-flash` en:
   - `server/services/ai/aiClosedLoopService.js` (L9)
   - `server/services/ai/aiStreamService.js` (L12)
   - `server/controllers/aiController.js` (5 ocurrencias)
   - `server/services/llmObservabilityService.js` (`PRICING` Gen 3 y default `gemini-3.8-flash`)
   - `server/index.js` (L113)
   - `.env.example`, `docker-compose.yml`, `README.md`
   - `src/components/ai-chat/ChatHeader.jsx` (`STAND {IA} • Gemini 3.8 Flash`)
5. Tests y Verificación:
   - Crear `tests/ai/gemini-key-pool.test.js` probando detección, round-robin, cooldown 60s, y monoclave.
   - Actualizar `tests/ai/gemini-pool.test.js`, `tests/adversarial/m4-pool-resilience-adversarial.test.js`, `tests/ai/m4-challenger2-adversarial.test.js` y `tests/m3-forensic-audit.test.js`.
   - Ejecutar `node --test tests/ai/gemini-key-pool.test.js`.
   - Ejecutar `npm run test:security` y `npm run audit:monoliths`.


## 2026-09-13T14:13:45Z
Tu identidad es Worker M1. Tu directorio de trabajo exclusivo es:
c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m1

MANDATORY: Lee obligatoriamente:
1. c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md
2. c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m1/DISPATCH.md
3. c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/teamwork_preview_explorer_survey_16_1/handoff.md
4. c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/orchestrator_16/SCOPE.md

Tu misión es implementar el Hito M1.
