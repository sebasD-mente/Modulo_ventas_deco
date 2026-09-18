# Project: STAND {IA} — Blindaje de Catálogo y Cero Alucinaciones

## Architecture
STAND {IA} (Deko EventSales) para Deco Vintage Guate y Deko Labs. Esta misión erradica los falsos positivos y la invención de productos en los canales de Audio (`/api/ai/voice-sale`) y Visión (`/api/ai/recognize-artwork`), asegurando que solo productos verificados con ID oficial de catálogo ingresen a un borrador de venta.

- **Frontera Dura en Audio (`server/services/ai/aiMediaService.js` y `server/controllers/ai/aiMediaController.js`)**:
  - Prohibición absoluta de ítems fantasma (`productId: null` y `webPosterId: null`) en `enrichedItems`.
  - Manejo transparente de dictados mixtos: obras reales entran a `enrichedItems`, obras no catalogadas se aíslan en `unmatchedItems` con advertencia clara:  
    `"⚠️ Se preparó la venta con {count} ítem(s) disponible(s) ({matchedList}). Atención: los siguientes productos no están en el catálogo: {unmatchedList}."`
  - Rechazo con sugerencias amigables: ante 0 obras catalogadas, `isSaleDetected = false`, `draftSale = null`, `items = []`, `total = 0`, y sugerencias opcionales en `suggestedPosters` (hasta 3) con mensaje:  
    `"No se identificaron pósters del catálogo oficial en el dictado de voz. Verifica el diseño o selecciónalo en el buscador."`
  - Compatibilidad frontend en `src/components/ai-chat/hooks/useAiChatStream.js` propagando `data.message` y soportando `suggestedPosters` interactivos en `ChatToolCards.jsx`.
- **Refinamiento Inteligente del Comparador (`server/services/catalog/webCatalogService.js` & `server/services/webCatalogService.js`)**:
  - Eliminación total de la condición laxa `matchedTokens.length >= 2`.
  - Normalización previa determinista: NFD para acentos preservando `ñ`, remoción de puntuación, stopwords feriales y numéricas extendidas (*'dos', 'tres', 'cuatro', 'de', 'la', 'el', 'los', 'un', 'una', 'en', 'con', 'poster', 'posters', 'tamano'*), y lematización simple de plurales en español (`s/es`).
  - Cobertura léxica estricta $\ge 70\%$ en multi-palabra sobre título primario y subtítulo/franquicia (excluyendo tags secundarios abiertos), con presencia obligatoria de términos clave de franquicia/personaje (Spider-Man, Batman, Taylor Swift, etc.).
  - Búsqueda de 1 sola palabra restringida exclusivamente a título primario, franquicia o alias registrado (prohibido validar contra tags secundarios o descripciones accesorias).
  - Validación estricta de alias canónicos: `aliasRes.exactMatch === true` para resolución inmediata en Paso 2; consultas compuestas con subcadenas de alias pasan al Paso 4 para evaluar cobertura completa $\ge 70\%$.
  - Implementación modular y exportación/re-exportación en `webCatalogService.js` y `aiMediaService.js` para mantener retrocompatibilidad total con la fachada `aiMultimodalService.js`.
- **Umbral de Certeza en Visión (`server/services/ai/aiMediaService.js` y `server/controllers/ai/aiMediaController.js`)**:
  - Evaluación de umbral de certeza visual de Gemini (`confidence >= 0.60`).
  - Cero forzado de nearest-neighbors: búsqueda estricta en catálogo sin inyectar frases descriptivas de `visualAnalysis`.
  - Si `matched == null`: `isArtworkDetected = false`, `matchedPoster = null`, `draftSale = null`, `items = []`, `total = 0`, con mensaje explícito:  
    `"La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo."`
- **Cohesión y Arnés de Calidad**:
  - Registro de techo de dominio en `scripts/audit-monoliths.js` para `aiMediaService.js` (`max: 260`, "Orquestador multimodal de medios e inferencia").
  - Verificación `npm run harness:check` 100% en verde (Zero-Trust 9/9, 0 secretos, 0 violaciones de techos, build Vite exitoso con código 0).
  - Creación de suite de pruebas dedicadas en `tests/ai/` cubriendo los 4 casos límite mandatados.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 Prohibición Total de Borradores Fantasma | En `processVoiceSaleAudio`, si `matched == null`, prohibir fallback a `item.title` y rechazar ítems con ID nulo en `enrichedItems`. | M1 | ORIGINAL_REQUEST §R1.1 |
| 2 | R1.2 Manejo Transparente de Dictados Mixtos | Obras reales a `enrichedItems`; obras no catalogadas a `unmatchedItems` con advertencia clara. | M1 | ORIGINAL_REQUEST §R1.2 |
| 3 | R1.3 Rechazo de Audio con Sugerencias Amigables | Si ninguna obra existe en catálogo: `isSaleDetected: false`, `draftSale: null`, `items: []`, y hasta 3 sugerencias en `suggestedPosters`. | M1 | ORIGINAL_REQUEST §R1.3 |
| 4 | R2.1 Eliminación de Coladero de 2 Tokens | Eliminar la condición `matchedTokens.length >= 2` en `matchPosterEverywhere`. | M1 | ORIGINAL_REQUEST §R2.1 |
| 5 | R2.2 Normalización Determinista de Tokens | Filtrar stopwords, acentos y plurales simples (`s/es`). | M1 | ORIGINAL_REQUEST §R2.2 |
| 6 | R2.3 Cobertura Léxica Multi-Palabra (>=70%) | Exigir $\ge 70\%$ de cobertura léxica y presencia obligatoria de franquicias/personajes clave. | M1 | ORIGINAL_REQUEST §R2.3 |
| 7 | R2.4 Búsqueda Estricta de 1 Sola Palabra | Coincidencia solo contra título primario, franquicia o alias registrado (no tags/descripciones). | M1 | ORIGINAL_REQUEST §R2.4 |
| 8 | R3.1 Cero Forzado de Nearest-Neighbors en Visión | Prohibir asignación de obra aproximada si la similitud no supera umbral estricto. | M1 | ORIGINAL_REQUEST §R3.1 |
| 9 | R3.2 Respuesta Limpia ante Obras Desconocidas | Si no hay match con certeza: `isArtworkDetected: false`, `draftSale: null`, `items: []`. | M1 | ORIGINAL_REQUEST §R3.2 |
| 10 | R4.1 Techos de Dominio en Monolitos | Ajustar `DOMAIN_CEILINGS` en `scripts/audit-monoliths.js` para `aiMediaService.js` (`max: 260`) si excede 200 líneas. | M1 | ORIGINAL_REQUEST §R4.1 |
| 11 | R4.2 Arnés de Calidad Zero-Trust 100% Verde | `npm run harness:check` pasando con 0 violaciones, 9/9 tests y build exitoso. | M2 | ORIGINAL_REQUEST §R4.2 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Technical Exploration | R1, R2, R3, R4 | none | DONE |
| M1 | Core Implementation: Matcher, Audio & Vision Hard Border | R1.1, R1.2, R1.3, R2.1, R2.2, R2.3, R2.4, R3.1, R3.2, R4.1 | M0 | DONE |
| M2 | Adversarial Stress Testing, Review & Remediation | R4.2, Tests, Review, Challenges | M1 | DONE |
| M3 | Forensic Audit & Gate Certification | Full Forensic Audit, Gate Result | M2 | DONE |

---

## Interface Contracts

### Audio Response Contract (`/api/ai/voice-sale` / `processVoiceSaleAudio`)
- Case A (Total Match): `{ isSaleDetected: true, draftSale: { items: [...], total, paymentMethod }, unmatchedItems: [], message: "Audio analizado con éxito..." }`
- Case B (Mixed Match): `{ isSaleDetected: true, draftSale: { items: [...catalogOnly], total }, unmatchedItems: [{ rawName: "...", requestedTitle: "...", quantity: 2, size: "MEDIANO" }], message: "⚠️ Se preparó la venta con 1 ítem(s) disponible(s) (Batman). Atención: los siguientes productos no están en el catálogo: zapatos." }`
- Case C (No Match): `{ isSaleDetected: false, draftSale: null, items: [], total: 0, suggestedPosters: [...up to 3 closest], message: "No se identificaron pósters del catálogo oficial en el dictado de voz. Verifica el diseño o selecciónalo en el buscador." }`

### Vision Response Contract (`/api/ai/recognize-artwork` / `recognizePosterArtworkFromImage`)
- Case A (Confident Match): `{ isArtworkDetected: true, matchedPoster: { id, title, thumbUrl, imageUrl, unitPrice, sizeId }, draftSale: { items: [...] }, confidence: "high"|"exact", message: "Obra analizada y encontrada en el catálogo web..." }`
- Case B (Uncertain/Unknown): `{ isArtworkDetected: false, matchedPoster: null, draftSale: null, items: [], total: 0, message: "La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo." }`

### Matcher Contract (`matchPosterEverywhere`)
- Signature: `matchPosterEverywhere(tenantId, query, requestedSize = null)`
- Return: Object `{ productId, posterId, baseTitle, description, category, sizeId, unitPrice, thumbUrl, imageUrl, availableSizes }` OR `null`.

---

## Code Layout
- `server/services/catalog/webCatalogService.js`: Motor de catálogo, búsqueda y `matchPosterEverywhere`.
- `server/services/ai/aiMediaService.js`: Orquestador de voz (`processVoiceSaleAudio`), visión (`recognizePosterArtworkFromImage`) y re-export de `matchPosterEverywhere`.
- `server/controllers/ai/aiMediaController.js`: Manejadores HTTP para voz y visión.
- `src/components/ai-chat/hooks/useAiChatStream.js`: Hook frontend para consumo de respuestas de audio y visión.
- `scripts/audit-monoliths.js`: Auditor de techos de código con `DOMAIN_CEILINGS`.
- `tests/ai/voice-hard-catalog-boundary.test.js`: Suite de pruebas dedicada para frontera dura de audio (4/4 pass).
- `tests/adversarial/m3-matcher-vision-challenger2.test.js`: Suite de pruebas adversarias del comparador y visión (27/27 pass).
- `tests/adversarial/voice-sale-audio-adversarial.test.js`: Suite de pruebas adversarias de audio (19/19 pass).
- `tests/adversarial/m3-voice-search-challenger.test.js`: Suite de regresión del comparador (14/14 pass).
