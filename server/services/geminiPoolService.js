/**
 * Gemini Pool Service — Phase 3 / Milestone M1
 * Multi-Model Contingency Pool & Multi-Key Fallback Engine for STAND {IA}.
 * Handles rate limits (429 / RESOURCE_EXHAUSTED), model saturation (503 / UNAVAILABLE),
 * and transient network errors across Gen 3 priority pool with multi-key rotation.
 */

import { getGeminiClient } from '../config/gemini.js';
import { getNextClient, markKeyCooldown, getAvailableKeys } from './ai/aiKeyPoolService.js';

export const MODEL_PRIORITY_POOL = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

export function isRateLimitOrQuotaError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 429 || status === '429' || status === 'RESOURCE_EXHAUSTED') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded your current quota')
  );
}

export function isServiceOverloadedError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (
    status === 503 || status === '503' ||
    status === 500 || status === '500' ||
    status === 504 || status === '504' ||
    status === 'UNAVAILABLE'
  ) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable') ||
    msg.includes('internal error') ||
    msg.includes('deadline exceeded')
  );
}

export function isTransientNetworkError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('und_err_connect_timeout')
  );
}

export function isRetryableOnSameModel(err) {
  return isServiceOverloadedError(err) || isTransientNetworkError(err);
}

export function isModelNotFoundError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 404 || status === '404' || status === 'NOT_FOUND') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('is not found') ||
    msg.includes('not_found') ||
    msg.includes('unsupported model') ||
    msg.includes('does not exist') ||
    msg.includes('is not supported')
  );
}

export function isClientInvalidModelError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 400 || status === '400') {
    const msg = String(err.message || '').toLowerCase();
    return msg.includes('model') || msg.includes('not supported') || msg.includes('not found');
  }
  return false;
}

export function shouldFallbackToNextModel(err) {
  return (
    isRateLimitOrQuotaError(err) ||
    isServiceOverloadedError(err) ||
    isTransientNetworkError(err) ||
    isModelNotFoundError(err) ||
    isClientInvalidModelError(err)
  );
}

export async function sleepWithJitter(attempt, baseDelayMs = 300, maxDelayMs = 1500) {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitteredDelay = Math.floor(Math.random() * (exponentialDelay + 1));
  await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
  return jitteredDelay;
}

export async function executeWithModelFallback({
  taskFn,
  models = MODEL_PRIORITY_POOL,
  actionName = 'AI_INTERACTION',
  tenantId = null,
  context = {},
  client = null,
}) {
  let lastError = null;
  const passedClient = client;

  for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
    const currentModel = models[modelIdx];
    const isLastModel = modelIdx === models.length - 1;

    const availableKeys = passedClient ? [null] : getAvailableKeys();
    const maxKeyAttempts = passedClient ? 1 : Math.max(1, availableKeys.length);

    for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
      let activeClient = passedClient;
      let activeApiKey = null;

      if (!activeClient) {
        const nextPool = getNextClient(currentModel);
        if (nextPool) {
          activeClient = nextPool.client;
          activeApiKey = nextPool.apiKey;
        } else {
          activeClient = getGeminiClient(currentModel);
        }
      }

      if (!activeClient && !context?.mockMode && !context?.skipClientCheck) {
        lastError = lastError || new Error('GEMINI_CLIENT_UNAVAILABLE');
        console.warn(`[Gemini Pool] ⚠️ Sin clientes disponibles para "${currentModel}". Continuando cascada...`);
        break;
      }

      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const result = await taskFn({ model: currentModel, client: activeClient });

          if (modelIdx > 0) {
            console.warn(`[Gemini Pool] 🔄 Éxito con modelo de contingencia "${currentModel}" (Fallback desde "${models[0]}")`);
          }

          return {
            result,
            usedModel: currentModel,
            fallbackOccurred: modelIdx > 0,
            initialModel: models[0],
          };
        } catch (err) {
          lastError = err;
          console.warn(`[Gemini Pool] ⚠️ Intento ${attempt + 1} falló en "${currentModel}": ${err?.message || err}`);

          if ((err?.status === 401 || err?.status === 403) && !isRateLimitOrQuotaError(err)) {
            throw err;
          }
          if (err?.status === 400 && !isModelNotFoundError(err) && !isClientInvalidModelError(err) && !isRateLimitOrQuotaError(err)) {
            throw err;
          }

          if (isRateLimitOrQuotaError(err)) {
            if (activeApiKey) {
              markKeyCooldown(activeApiKey, 60000, currentModel);
            }
            if (keyAttempt < maxKeyAttempts - 1) {
              console.warn(`[Gemini Pool] 🔄 Reintentando "${currentModel}" con siguiente clave del pool...`);
              break;
            }
            break;
          }

          if (isModelNotFoundError(err) || isClientInvalidModelError(err)) {
            break;
          }

          if (attempt < 1 && isRetryableOnSameModel(err)) {
            await sleepWithJitter(attempt);
            continue;
          }

          if (shouldFallbackToNextModel(err)) {
            break;
          }

          if (isLastModel && attempt === 1) {
            break;
          }
        }
      }

      if (lastError && !isRateLimitOrQuotaError(lastError) && shouldFallbackToNextModel(lastError)) {
        break;
      }
    }
  }

  console.error('[Gemini Pool] 🚨 Todos los modelos del pool de contingencia se agotaron:', lastError?.message || lastError);
  throw lastError || new Error('GEMINI_CLIENT_UNAVAILABLE');
}

export async function* streamWithModelFallback({
  buildContentsAndConfig,
  models = MODEL_PRIORITY_POOL,
  onModelSelected = () => {},
  client = null,
}) {
  let stream = null;
  let activeModel = models[0];
  let lastError = null;

  if (!client && getAvailableKeys().length === 0) {
    yield { type: 'token', text: '[Modo Offline] El asistente de IA no está conectado actualmente.' };
    return;
  }

  for (let i = 0; i < models.length; i++) {
    activeModel = models[i];
    const availableKeys = client ? [null] : getAvailableKeys();
    const maxKeys = client ? 1 : Math.max(1, availableKeys.length);

    for (let k = 0; k < maxKeys; k++) {
      let activeClient = client;
      let activeApiKey = null;

      if (!activeClient) {
        const nextPool = getNextClient(activeModel);
        if (nextPool) {
          activeClient = nextPool.client;
          activeApiKey = nextPool.apiKey;
        } else {
          activeClient = getGeminiClient(activeModel);
        }
      }

      if (!activeClient) {
        lastError = lastError || new Error('GEMINI_CLIENT_UNAVAILABLE');
        console.warn(`[Gemini Stream Pool] ⚠️ Sin clientes disponibles para "${activeModel}". Conmutando al siguiente modelo...`);
        break;
      }

      try {
        const { contents, config } = buildContentsAndConfig({ model: activeModel });
        stream = await activeClient.models.generateContentStream({
          model: activeModel,
          contents,
          config,
        });

        if (i > 0) {
          console.warn(`[Gemini Stream Pool] 🔄 Stream iniciado con modelo de contingencia: "${activeModel}"`);
        }
        if (typeof onModelSelected === 'function') {
          onModelSelected(activeModel);
        }
        break;
      } catch (initErr) {
        lastError = initErr;
        console.warn(`[Gemini Stream Pool] ⚠️ Fallo al inicializar stream con "${activeModel}": ${initErr?.message || initErr}`);

        if (isRateLimitOrQuotaError(initErr)) {
          if (activeApiKey) markKeyCooldown(activeApiKey, 60000, activeModel);
          if (k < maxKeys - 1) {
            console.warn(`[Gemini Stream Pool] 🔄 Reintentando "${activeModel}" con siguiente clave...`);
            continue;
          }
        }
        break;
      }
    }

    if (stream) break;
    if (i < models.length - 1) {
      console.warn(`[Gemini Stream Pool] ⚡ Conmutando stream a "${models[i + 1]}"...`);
    }
  }

  if (!stream) {
    console.error('[Gemini Stream Pool] 🚨 Fallaron todos los modelos del pool para streaming:', lastError?.message || lastError);
    yield {
      type: 'token',
      text: '⚠️ Conexión con IA intermitente en el stand. Puedes continuar registrando la venta con el formulario manual inferior.',
    };
    return;
  }

  try {
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (midStreamErr) {
    console.warn('⚠️ [Gemini Stream Mid-Stream Break] Interrupción durante la emisión de tokens:', midStreamErr?.message || midStreamErr);
    yield {
      type: 'token',
      text: '\n\n*(Respuesta finalizada. Si falta algún ítem, puedes confirmarlo directamente en la venta activa.)*',
    };
  }
}
