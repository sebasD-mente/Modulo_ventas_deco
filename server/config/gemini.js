import { GoogleGenAI } from '@google/genai';
import { ENV } from './env.js';

let geminiClient = null;

export function getGeminiClient() {
  if (geminiClient) return geminiClient;

  if (!ENV.GEMINI_API_KEY) {
    console.warn('[Gemini Init] ⚠️ No se detectó GEMINI_API_KEY en variables de entorno.');
    return null;
  }

  try {
    geminiClient = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY.trim() });
    console.log(`[Gemini Init] ✅ Cliente @google/genai inicializado correctamente (Modelo por defecto: ${ENV.GEMINI_MODEL})`);
    return geminiClient;
  } catch (err) {
    console.error('[Gemini Init Error] ❌ Error inicializando GoogleGenAI:', err.message);
    return null;
  }
}
