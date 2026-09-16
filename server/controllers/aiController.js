/**
 * aiController.js — Fachada Reexportadora Oficial para STAND {IA}
 * Modelo de IA Oficial: Gemini 3.8 Flash
 * Delegación modular:
 *  - Streaming SSE y chat conversacional: ai/aiChatController.js
 *    (soporte pendingDraft: pendingDraft || null y searchCatalog limit: 12)
 *  - Endpoints multimodales (voz, fotos, video): ai/aiMediaController.js
 */
export { handleChatQuery } from './ai/aiChatController.js';
export {
  handleVoiceSale,
  handleBatchPhoto,
  handleArtworkRecognition,
  handleVideoRecognition,
} from './ai/aiMediaController.js';
