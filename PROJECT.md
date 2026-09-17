# Project: STAND {IA} — Optimización Crítica de Latencia y Resiliencia Ferial

## Architecture
STAND {IA} (Deko EventSales) para Deco Vintage Guate y Deko Labs. Esta fase elimina cuellos de botella de latencia y refuerza la resiliencia offline/ferial:
- **Backend AI Streaming (Node / Express / @google/genai)**:
  - Eliminación del segundo turno LLM en ventas directas de chat (`aiStreamService.js`): emisión inmediata de `draft_sale` y confirmación dinámica determinista («¡Listo, [Vendedor]! Te monté el borrador en pantalla listo para cobrar con [método]. ¿Confirmamos la venta?»), concluyendo el stream con `done` en un solo turno. `streamClosedLoopFollowUp` se reserva exclusivamente para consultas informativas.
  - Zero-Wait GCS en reconocimiento visual (`aiMediaController.js`): ejecución concurrente mediante `Promise.all([ safePersistMedia(...), recognizePosterArtworkFromImage(...) ])`, reduciendo la latencia de visión de 6.6s a < 2.0s manteniendo los contratos JSON intactos.
  - Aligeramiento dinámico del system prompt (`aiPromptService.js`): exclusión del volcado JSON masivo de ventas del día excepto ante palabras clave de consulta operativa (`/caja|dinero|m[eé]tricas|ventas|cu[aá]nto|reporte|turno/i`).
- **Frontend Client & Audio Resilience (React 19 / Vite)**:
  - Compresión previa de imágenes en el cliente (`src/utils/imageCompressor.js`): función pura autosuficiente (<= 60 líneas) que escala fotos a máx 1024px lado mayor con JPEG calidad 0.75 (~100-140 KB), reduciendo el payload de subida en 96-98% en `useAiChatStream.js`.
  - Buffer de reintento de audio en memoria (`useAiChatStream.js`): retención del último `audioBlob` en `lastAudioBlobRef` y exposición de acción reactiva en `AiErrorBanner.jsx` para reintentar el despacho ante fallos de red sin forzar al vendedor a volver a dictar.
- **Testing & Benchmarks**:
  - Script programático `tests/benchmarks/latency-audit.test.js` ejecutable con `node --test` para verificar cuantitativamente el ciclo SSE de 1 turno y la concurrencia real de `Promise.all`.
  - Arnés 100% verde (`npm run harness:check`): Zero-Trust, auditoría de secretos, límites de monolitos (`audit-monoliths.js`) y compilación Vite.
- **Despliegue Dokploy & Verificación en Vivo**:
  - Despliegue en producción a `https://ventas.decovintage.online`.
  - Verificación activa en navegador con Chrome DevTools MCP bajo el protocolo Anti-Bypass y los 4 filtros forenses de `arnes-verificacion-evidencia-forense`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Eliminación del Doble Turno LLM en Chat | Emitir inmediatamente `draft_sale` + token dinámico y `done` sin re-invocar a Gemini en ventas directas. | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R2: Persistencia Asíncrona Paralela en Visión | Ejecutar `safePersistMedia` y `recognizePosterArtworkFromImage` concurrentemente con `Promise.all`. | M1 | ORIGINAL_REQUEST §R2 |
| 3 | R4: Aligeramiento Dinámico del Prompt Operativo | Omitir volcado JSON masivo de ventas del día en órdenes directas, inyectándolo solo con regex operativa. | M1 | ORIGINAL_REQUEST §R4 |
| 4 | R3: Compresor de Imágenes en Cliente | Crear `src/utils/imageCompressor.js` (<=60L, 1024px, JPEG 0.75) e integrarlo en `useAiChatStream.js`. | M2 | ORIGINAL_REQUEST §R3 |
| 5 | R5: Buffer de Reintento de Audio en Memoria | Guardar `audioBlob` en `lastAudioBlobRef` y habilitar reintento visual en `AiErrorBanner.jsx`. | M2 | ORIGINAL_REQUEST §R5 |
| 6 | R6: Script Programático de Benchmarks | Crear `tests/benchmarks/latency-audit.test.js` con `node --test` para certificar 1 turno SSE y concurrencia. | M3 | ORIGINAL_REQUEST §R6 |
| 7 | R7: Despliegue Dokploy & Verificación en Vivo | Despliegue remoto y verificación con Chrome DevTools MCP con capturas y sustentación de 4 filtros. | M4 | ORIGINAL_REQUEST & User Rules |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Latency & Prompt Optimizations | R1, R2, R4 | none | DONE |
| M2 | Frontend Client Compression & Audio Resilience | R3, R5 | none | DONE |
| M3 | Latency Benchmarks & Quality Harness Suite | R6, Harness | M1, M2 | DONE |
| M4 | Dokploy Deployment & Live Verification DevTools | R7, Live DevTools | M3 | IN_PROGRESS |

---

## Interface Contracts

### SSE Single-Turn Sale Contract (`aiStreamService.js`)
- Cuando `call.name === 'prepareSaleDraft'` y `draft` contiene ítems:
  * Evento 1: `event: draft_sale\ndata: { ...draftPayload }\n\n`
  * Evento 2: `event: token\ndata: {"text":"¡Listo, [NombreVendedor]! Te monté el borrador en pantalla listo para cobrar con [método]. ¿Confirmamos la venta?"}\n\n`
  * Evento 3: `event: done\ndata: {"fullText":"..."}\n\n`
- LLM Call Count: Exactamente 1 llamada a `ai.models.generateContentStream`.

### Vision Parallel Persist Contract (`aiMediaController.js`)
- Concurrencia: `const [imageUrl, analysis] = await Promise.all([ safePersistMedia(...), recognizePosterArtworkFromImage(...) ]);`
- Retorno JSON: `{ success: true, imageUrl, primaryTitle, visualAnalysis, candidates, draftSale, executionStats }` (100% retrocompatible).

### Client Image Compressor Contract (`src/utils/imageCompressor.js`)
- Firma: `export async function compressImage(file, maxDimension = 1024, quality = 0.75): Promise<Blob>`
- Tamaño máximo del archivo: <= 60 líneas de código.
- Retorno: Blob `image/jpeg` redimensionado proporcionalmente o fallback seguro del archivo original.

### Audio Retry Buffer Contract (`useAiChatStream.js` & `AiErrorBanner.jsx`)
- Referencia: `lastAudioBlobRef`
- Handler expuesto: `retryVoiceUpload()`
- Elemento visual: Botón `[🔄 Reintentar Audio]` en `AiErrorBanner.jsx` activo cuando `lastAudioBlobRef.current` existe y hubo error de red/timeout.

---

## Code Layout
- `server/`:
  - `services/ai/aiStreamService.js`: Generador asíncrono SSE token a token y resolución de herramientas. (Owns: M1 - DONE)
  - `controllers/ai/aiMediaController.js`: Controladores para voz (`handleVoiceSale`) y visión (`handleArtworkRecognition`). (Owns: M1 - DONE)
  - `services/ai/aiPromptService.js`: Ensamblado de system prompts y esquemas JSON. (Owns: M1 - DONE)
- `src/`:
  - `utils/imageCompressor.js`: Función pura de compresión de imágenes en cliente (Canvas / OffscreenCanvas). (Owns: M2 - DONE)
  - `components/ai-chat/hooks/useAiChatStream.js`: Hook de gestión de streaming SSE, uploads multimedia y borradores. (Owns: M2 - DONE)
  - `components/ai-chat/AiErrorBanner.jsx`: Banner de errores y acción de reintento en memoria. (Owns: M2 - DONE)
- `tests/`:
  - `benchmarks/latency-audit.test.js`: Suite de benchmarks de latencia y concurrencia ejecutables con `node --test`. (Owns: M3 - DONE)
