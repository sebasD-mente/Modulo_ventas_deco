import { GoogleGenAI } from '@google/genai';
import { ENV } from './env.js';
import { getNextClient, getClientForKey } from '../services/ai/aiKeyPoolService.js';

export function getGeminiClient(model = null) {
  const pooled = getNextClient(model);
  if (pooled?.client) {
    return pooled.client;
  }

  const apiKey = (ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[Gemini Init] ⚠️ No se detectó GEMINI_API_KEY ni GEMINI_API_KEYS en variables de entorno.');
    return null;
  }

  try {
    const client = getClientForKey(apiKey) || new GoogleGenAI({ apiKey });
    console.log(`[Gemini Init] ✅ Cliente @google/genai inicializado correctamente (Modelo por defecto: ${ENV.GEMINI_MODEL})`);
    return client;
  } catch (err) {
    console.error('[Gemini Init Error] ❌ Error inicializando GoogleGenAI:', err.message);
    return null;
  }
}
