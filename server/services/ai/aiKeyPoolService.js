import { GoogleGenAI } from '@google/genai';
import { ENV } from '../../config/env.js';

const cooldownMap = new Map();
const clientCache = new Map();
let currentKeyIndex = 0;

export function getAvailableKeys() {
  const multiKeys = ENV.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS;
  if (multiKeys && typeof multiKeys === 'string') {
    const parsed = multiKeys.split(',').map((k) => k.trim()).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  const singleKey = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (singleKey && typeof singleKey === 'string') {
    const trimmed = singleKey.trim();
    if (trimmed) return [trimmed];
  }
  return [];
}

export function isKeyInCooldown(apiKey, model = null) {
  if (!apiKey) return false;
  const now = Date.now();
  const targetModel = (typeof model === 'object' && model !== null) ? model.model : model;

  const globalExp = cooldownMap.get(apiKey);
  if (globalExp) {
    if (now >= globalExp) {
      cooldownMap.delete(apiKey);
    } else {
      return true;
    }
  }

  if (targetModel) {
    const scopedKey = `${apiKey}:${targetModel}`;
    const scopedExp = cooldownMap.get(scopedKey);
    if (scopedExp) {
      if (now >= scopedExp) {
        cooldownMap.delete(scopedKey);
      } else {
        return true;
      }
    }
  }

  return false;
}

export function markKeyCooldown(apiKey, durationMs = 60000, model = null) {
  if (!apiKey) return;
  let duration = typeof durationMs === 'number' ? durationMs : 60000;
  let targetModel = model;

  if (typeof durationMs === 'string') {
    targetModel = durationMs;
    duration = 60000;
  } else if (typeof durationMs === 'object' && durationMs !== null) {
    targetModel = durationMs.model || null;
    duration = durationMs.durationMs || 60000;
  }

  const masked = apiKey.length > 8 ? `${apiKey.slice(0, 6)}...` : '***';
  const modelTag = targetModel ? ` en modelo "${targetModel}"` : ' (global)';
  console.warn(`[KeyPool] ⏳ Clave ${masked}${modelTag} en cooldown por ${Math.round(duration / 1000)}s ante 429`);

  const mapKey = targetModel ? `${apiKey}:${targetModel}` : apiKey;
  cooldownMap.set(mapKey, Date.now() + duration);
}

export function getClientForKey(apiKey) {
  if (!apiKey) return null;
  if (clientCache.has(apiKey)) return clientCache.get(apiKey);
  try {
    const client = new GoogleGenAI({ apiKey });
    clientCache.set(apiKey, client);
    return client;
  } catch (err) {
    console.error('[KeyPool] ❌ Error inicializando GoogleGenAI para clave:', err.message);
    return null;
  }
}

export function getNextClient(model = null) {
  const keys = getAvailableKeys();
  if (!keys.length) return null;

  const targetModel = (typeof model === 'object' && model !== null) ? model.model : model;
  const total = keys.length;
  for (let i = 0; i < total; i++) {
    const idx = (currentKeyIndex + i) % total;
    const key = keys[idx];
    if (!isKeyInCooldown(key, targetModel)) {
      currentKeyIndex = (idx + 1) % total;
      const client = getClientForKey(key);
      if (client) {
        return { client, apiKey: key, keyIndex: idx, totalKeys: total };
      }
    }
  }
  return null;
}

export function resetKeyPool() {
  cooldownMap.clear();
  clientCache.clear();
  currentKeyIndex = 0;
}
