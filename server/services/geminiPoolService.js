/**
 * Gemini Pool Service — Phase 3 / Milestone M4
 *
 * Multi-Model Contingency Pool and Fallback Engine for STAND {IA}.
 * Handles rate limits (HTTP 429 / RESOURCE_EXHAUSTED), model saturation (503 / UNAVAILABLE),
 * and transient network errors with Exponential Backoff + Full Jitter, smoothly degrading across
 * models: gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-1.5-flash.
 */

import { getGeminiClient } from '../config/gemini.js';

export const MODEL_PRIORITY_POOL = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
];

/**
 * Detects whether the error corresponds to a rate limit or quota exhaustion (HTTP 429 / RESOURCE_EXHAUSTED).
 * @param {any} err
 * @returns {boolean}
 */
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

/**
 * Detects whether the model or service is temporarily overloaded or unavailable (HTTP 503 / UNAVAILABLE / 500 / 504).
 * @param {any} err
 * @returns {boolean}
 */
export function isServiceOverloadedError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (
    status === 503 ||
    status === '503' ||
    status === 500 ||
    status === '500' ||
    status === 504 ||
    status === '504' ||
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

/**
 * Detects transient network or connection drop errors.
 * @param {any} err
 * @returns {boolean}
 */
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

/**
 * Determines if the error warrants a retry with exponential backoff on the same model.
 * @param {any} err
 * @returns {boolean}
 */
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

/**
 * Determines if the error warrants falling back to the next model in the priority pool.
 * @param {any} err
 * @returns {boolean}
 */
export function shouldFallbackToNextModel(err) {
  return (
    isRateLimitOrQuotaError(err) ||
    isServiceOverloadedError(err) ||
    isTransientNetworkError(err) ||
    isModelNotFoundError(err) ||
    isClientInvalidModelError(err)
  );
}

/**
 * Sleeps for a randomized duration following Exponential Backoff with Full Jitter.
 * @param {number} attempt
 * @param {number} [baseDelayMs=300]
 * @param {number} [maxDelayMs=1500]
 * @returns {Promise<number>} Returns actual slept milliseconds
 */
export async function sleepWithJitter(attempt, baseDelayMs = 300, maxDelayMs = 1500) {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitteredDelay = Math.floor(Math.random() * (exponentialDelay + 1));
  await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
  return jitteredDelay;
}

/**
 * Executes an AI task with automatic fallback across the model priority pool.
 * Handles transient retries on the same model and degrades to secondary models if quota
 * is exhausted (429) or service is unavailable (503).
 *
 * @template T
 * @param {object} opts
 * @param {({ model, client }: { model: string, client: any }) => Promise<T>} opts.taskFn
 * @param {string[]} [opts.models=MODEL_PRIORITY_POOL]
 * @param {string} [opts.actionName='AI_INTERACTION']
 * @param {string|null} [opts.tenantId=null]
 * @param {object} [opts.context={}]
 * @param {any} [opts.client=null]
 * @returns {Promise<{ result: T, usedModel: string, fallbackOccurred: boolean, initialModel: string }>}
 */
export async function executeWithModelFallback({
  taskFn,
  models = MODEL_PRIORITY_POOL,
  actionName = 'AI_INTERACTION',
  tenantId = null,
  context = {},
  client = null,
}) {
  const geminiClient = client || getGeminiClient();
  if (!geminiClient && !context?.mockMode && !context?.skipClientCheck) {
    throw new Error('GEMINI_CLIENT_UNAVAILABLE');
  }

  let lastError = null;

  for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
    const currentModel = models[modelIdx];
    const isLastModel = modelIdx === models.length - 1;

    // Up to 1 transient retry per model (attempt 0 and attempt 1)
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const result = await taskFn({ model: currentModel, client: geminiClient });

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
        console.warn(`[Gemini Pool] ⚠️ Intento ${attempt + 1} falló en modelo "${currentModel}": ${err?.message || err}`);

        // Non-recoverable client errors (401 Unauthorized, 403 Forbidden)
        if (err?.status === 401 || err?.status === 403) {
          if (!isRateLimitOrQuotaError(err)) {
            throw err;
          }
        }
        if (err?.status === 400 && !isModelNotFoundError(err) && !isClientInvalidModelError(err)) {
          if (!isRateLimitOrQuotaError(err)) {
            throw err;
          }
        }

        // Quota / Rate limit (429) o Modelo no soportado (404/400): conmutar inmediatamente
        if (isRateLimitOrQuotaError(err) || isModelNotFoundError(err) || isClientInvalidModelError(err)) {
          if (!isLastModel) {
            console.warn(`[Gemini Pool] ⚡ Error en "${currentModel}" (${isModelNotFoundError(err) || isClientInvalidModelError(err) ? 'Modelo no soportado' : 'Cuota agotada'}). Conmutando inmediatamente a "${models[modelIdx + 1]}"...`);
            break;
          } else {
            break;
          }
        }

        // Transient overload / network error: retry once on the same model with jitter
        if (attempt < 1 && isRetryableOnSameModel(err)) {
          await sleepWithJitter(attempt);
          continue;
        }

        // If retry exhausted or should fallback, break to next model
        if (shouldFallbackToNextModel(err) && !isLastModel) {
          console.warn(`[Gemini Pool] ⚡ Conmutando de "${currentModel}" hacia "${models[modelIdx + 1]}"...`);
          break;
        }

        if (isLastModel && attempt === 1) {
          break;
        }
      }
    }
  }

  console.error('[Gemini Pool] 🚨 Todos los modelos del pool de contingencia se agotaron:', lastError?.message || lastError);
  throw lastError;
}

/**
 * Resilient async generator for SSE streaming with two-phase fallback:
 * Phase 1 (Pre-Token): If stream initialization fails (429/503), transparently switches to the next model before emitting tokens.
 * Phase 2 (Mid-Stream): If an interruption occurs after tokens started emitting, gracefully closes without fatal error.
 *
 * @param {object} opts
 * @param {({ model }: { model: string }) => { contents: any[], config: any }} opts.buildContentsAndConfig
 * @param {string[]} [opts.models=MODEL_PRIORITY_POOL]
 * @param {((model: string) => void)} [opts.onModelSelected]
 * @param {any} [opts.client=null]
 * @returns {AsyncGenerator<any, void, unknown>}
 */
export async function* streamWithModelFallback({
  buildContentsAndConfig,
  models = MODEL_PRIORITY_POOL,
  onModelSelected = () => {},
  client = null,
}) {
  const geminiClient = client || getGeminiClient();
  if (!geminiClient) {
    yield { type: 'token', text: '[Modo Offline] El asistente de IA no está conectado actualmente.' };
    return;
  }

  let stream = null;
  let activeModel = models[0];
  let lastError = null;

  // FASE 1: Conmutación en Inicialización del Stream (Pre-Token)
  for (let i = 0; i < models.length; i++) {
    activeModel = models[i];
    try {
      const { contents, config } = buildContentsAndConfig({ model: activeModel });
      stream = await geminiClient.models.generateContentStream({
        model: activeModel,
        contents,
        config,
      });

      if (i > 0) {
        console.warn(`[Gemini Stream Pool] 🔄 Stream iniciado exitosamente con modelo de contingencia: "${activeModel}"`);
      }
      if (typeof onModelSelected === 'function') {
        onModelSelected(activeModel);
      }
      break;
    } catch (initErr) {
      lastError = initErr;
      console.warn(`[Gemini Stream Pool] ⚠️ Fallo al inicializar stream con "${activeModel}": ${initErr?.message || initErr}`);

      if (i < models.length - 1) {
        console.warn(`[Gemini Stream Pool] ⚡ Conmutando stream a "${models[i + 1]}"...`);
        continue;
      }
      break;
    }
  }

  // Si fallaron todos los modelos en inicialización:
  if (!stream) {
    console.error('[Gemini Stream Pool] 🚨 Fallaron todos los modelos del pool para streaming:', lastError?.message || lastError);
    yield {
      type: 'token',
      text: 'En este momento la red de IA está recibiendo un volumen alto de consultas. Puedes registrar la venta directamente con el formulario manual ágil de abajo sin interrupciones.',
    };
    return;
  }

  // FASE 2: Consumo de Tokens y Protección Mid-Stream
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
