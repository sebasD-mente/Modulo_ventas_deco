import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_PRIORITY_POOL,
  isRateLimitOrQuotaError,
  isServiceOverloadedError,
  isTransientNetworkError,
  isRetryableOnSameModel,
  shouldFallbackToNextModel,
  sleepWithJitter,
  executeWithModelFallback,
  streamWithModelFallback,
} from '../../server/services/geminiPoolService.js';
import {
  PRICING,
  estimateCostUsd,
  recordLlmInteraction,
} from '../../server/services/llmObservabilityService.js';

describe('🛡️ Suite de Pruebas: Multi-Model Contingency Pool & Resiliencia anti-429 (M4)', () => {
  describe('1. Clasificadores de Error y Detección de Cuotas', () => {
    it('1.1 isRateLimitOrQuotaError detecta 429, RESOURCE_EXHAUSTED y mensajes de cuota', () => {
      assert.strictEqual(isRateLimitOrQuotaError({ status: 429 }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ statusCode: 429 }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ code: 429 }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ status: 'RESOURCE_EXHAUSTED' }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ message: 'Quota exceeded for quota metric' }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ message: 'Rate limit reached, please retry later' }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ message: 'Too many requests' }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ message: 'You have exceeded your current quota' }), true);

      // Errores que NO son 429
      assert.strictEqual(isRateLimitOrQuotaError({ status: 500 }), false);
      assert.strictEqual(isRateLimitOrQuotaError({ status: 400 }), false);
      assert.strictEqual(isRateLimitOrQuotaError(null), false);
    });

    it('1.2 isServiceOverloadedError detecta 503, 500, 504, UNAVAILABLE y saturación', () => {
      assert.strictEqual(isServiceOverloadedError({ status: 503 }), true);
      assert.strictEqual(isServiceOverloadedError({ status: 500 }), true);
      assert.strictEqual(isServiceOverloadedError({ status: 504 }), true);
      assert.strictEqual(isServiceOverloadedError({ status: 'UNAVAILABLE' }), true);
      assert.strictEqual(isServiceOverloadedError({ message: 'The model is overloaded. Please try again later.' }), true);
      assert.strictEqual(isServiceOverloadedError({ message: 'Service unavailable' }), true);
      assert.strictEqual(isServiceOverloadedError({ message: 'Deadline exceeded' }), true);

      assert.strictEqual(isServiceOverloadedError({ status: 429 }), false);
      assert.strictEqual(isServiceOverloadedError({ status: 404 }), false);
    });

    it('1.3 isTransientNetworkError detecta cortes de red y sockets caídos', () => {
      assert.strictEqual(isTransientNetworkError({ code: 'ECONNRESET' }), true);
      assert.strictEqual(isTransientNetworkError({ code: 'ETIMEDOUT' }), true);
      assert.strictEqual(isTransientNetworkError({ code: 'ENOTFOUND' }), true);
      assert.strictEqual(isTransientNetworkError({ message: 'fetch failed' }), true);
      assert.strictEqual(isTransientNetworkError({ message: 'socket hang up' }), true);

      assert.strictEqual(isTransientNetworkError({ code: 'ENOENT' }), false);
    });

    it('1.4 isRetryableOnSameModel distingue sobrecargas transitorias de cuotas agotadas', () => {
      // 503 o caídas de red sí ameritan reintento con jitter en el mismo modelo
      assert.strictEqual(isRetryableOnSameModel({ status: 503 }), true);
      assert.strictEqual(isRetryableOnSameModel({ code: 'ECONNRESET' }), true);

      // 429 de cuota NO se debe reintentar ciegamente en el mismo modelo
      assert.strictEqual(isRetryableOnSameModel({ status: 429 }), false);
      assert.strictEqual(isRetryableOnSameModel({ status: 400 }), false);
    });

    it('1.5 shouldFallbackToNextModel autoriza conmutación para cuotas, 503 y red', () => {
      assert.strictEqual(shouldFallbackToNextModel({ status: 429 }), true);
      assert.strictEqual(shouldFallbackToNextModel({ status: 503 }), true);
      assert.strictEqual(shouldFallbackToNextModel({ message: 'fetch failed' }), true);

      // 400 Bad Request no conmuta de modelo (error de cliente)
      assert.strictEqual(shouldFallbackToNextModel({ status: 400 }), false);
    });

    it('1.6 sleepWithJitter respeta cotas y ejecuta sin error', async () => {
      const delay = await sleepWithJitter(0, 50, 100);
      assert.ok(typeof delay === 'number');
      assert.ok(delay >= 0 && delay <= 101);
    });
  });

  describe('2. Ejecución Unaria con Fallback Multi-Modelo (executeWithModelFallback)', () => {
    const mockClient = { models: {} };

    it('2.1 Caso Exitoso: Resuelve inmediatamente con el modelo primario (gemini-2.5-flash)', async () => {
      const callLog = [];
      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callLog.push(model);
          return { reply: 'Hola desde ' + model };
        },
      });

      assert.strictEqual(res.usedModel, 'gemini-2.5-flash');
      assert.strictEqual(res.fallbackOccurred, false);
      assert.strictEqual(res.initialModel, 'gemini-2.5-flash');
      assert.deepStrictEqual(callLog, ['gemini-2.5-flash']);
      assert.strictEqual(res.result.reply, 'Hola desde gemini-2.5-flash');
    });

    it('2.2 Caso 429: Cuota agotada en gemini-2.5-flash conmuta inmediatamente a gemini-2.5-flash-lite', async () => {
      const callLog = [];
      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callLog.push(model);
          if (model === 'gemini-2.5-flash') {
            const err = new Error('Resource exhausted: quota exceeded for model gemini-2.5-flash');
            err.status = 429;
            throw err;
          }
          return { reply: 'Éxito desde ' + model };
        },
      });

      assert.strictEqual(res.usedModel, 'gemini-2.5-flash-lite');
      assert.strictEqual(res.fallbackOccurred, true);
      assert.strictEqual(res.initialModel, 'gemini-2.5-flash');
      // Debe haber intentado flash una sola vez y conmutado directamente a flash-lite
      assert.deepStrictEqual(callLog, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
    });

    it('2.3 Caso Cascada Doble 429: gemini-2.5-flash y lite agotados conmutan a gemini-1.5-flash', async () => {
      const callLog = [];
      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callLog.push(model);
          if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-lite') {
            const err = new Error('429 RESOURCE_EXHAUSTED');
            err.status = 429;
            throw err;
          }
          return { reply: 'Respaldo estable desde ' + model };
        },
      });

      assert.strictEqual(res.usedModel, 'gemini-1.5-flash');
      assert.strictEqual(res.fallbackOccurred, true);
      assert.deepStrictEqual(callLog, ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']);
    });

    it('2.4 Caso Error No Recuperable (400 / 401): Aborta inmediatamente sin iterar el pool', async () => {
      const callLog = [];
      await assert.rejects(
        async () => {
          await executeWithModelFallback({
            models: MODEL_PRIORITY_POOL,
            client: mockClient,
            taskFn: async ({ model }) => {
              callLog.push(model);
              const err = new Error('Bad Request: Invalid parameter');
              err.status = 400;
              throw err;
            },
          });
        },
        (err) => err.status === 400
      );

      // Solo intentó una vez y no iteró hacia flash-lite
      assert.deepStrictEqual(callLog, ['gemini-2.5-flash']);
    });

    it('2.5 Caso Agotamiento Total del Pool: Relanza último error si todos fallan', async () => {
      await assert.rejects(
        async () => {
          await executeWithModelFallback({
            models: ['model-a', 'model-b'],
            client: mockClient,
            taskFn: async ({ model }) => {
              const err = new Error(`Fallo definitivo en ${model}`);
              err.status = 429;
              throw err;
            },
          });
        },
        (err) => err.message.includes('Fallo definitivo en model-b')
      );
    });
  });

  describe('3. Streaming SSE Resiliente en Dos Fases (streamWithModelFallback)', () => {
    it('3.1 Fase 1 (Pre-Token): Falla inicialización en modelo 1 y conmuta transparentemente al modelo 2', async () => {
      const attemptedModels = [];
      let selectedModel = null;

      const mockClient = {
        models: {
          generateContentStream: async ({ model }) => {
            attemptedModels.push(model);
            if (model === 'gemini-2.5-flash') {
              const err = new Error('RESOURCE_EXHAUSTED 429');
              err.status = 429;
              throw err;
            }
            // Modelo de contingencia responde
            async function* streamGen() {
              yield { text: '¡Hola! ' };
              yield { text: 'Respuesta desde lite.' };
            }
            return streamGen();
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        buildContentsAndConfig: ({ model }) => ({ contents: [], config: {} }),
        onModelSelected: (m) => {
          selectedModel = m;
        },
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.deepStrictEqual(attemptedModels, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
      assert.strictEqual(selectedModel, 'gemini-2.5-flash-lite');
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, '¡Hola! ');
      assert.strictEqual(chunks[1].text, 'Respuesta desde lite.');
    });

    it('3.2 Fase 2 (Mid-Stream): Interrupción durante emisión se captura cordialmente sin error fatal', async () => {
      const mockClient = {
        models: {
          generateContentStream: async () => {
            async function* brokenStreamGen() {
              yield { text: 'Primera parte de la respuesta. ' };
              throw new Error('Socket closed unexpectedly by peer');
            }
            return brokenStreamGen();
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['gemini-2.5-flash'],
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Primera parte de la respuesta. ');
      assert.ok(chunks[1].text.includes('*(Respuesta finalizada.'), 'Debe emitir cierre cordial de protección React');
    });

    it('3.3 Modo Offline: Si client es null emite advertencia cordial sin crashear', async () => {
      const generator = streamWithModelFallback({
        client: null,
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.strictEqual(chunks.length, 1);
      assert.ok(chunks[0].text.includes('[Modo Offline]'));
    });

    it('3.4 Fallo Global Pre-Token: Si todos los modelos fallan emite mensaje de alto volumen', async () => {
      const mockClient = {
        models: {
          generateContentStream: async () => {
            const err = new Error('503 Service Unavailable');
            err.status = 503;
            throw err;
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['model-1', 'model-2'],
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.strictEqual(chunks.length, 1);
      assert.ok(chunks[0].text.includes('volumen alto de consultas'));
    });
  });

  describe('4. Observabilidad y Precios de Contingencia (llmObservabilityService)', () => {
    it('4.1 PRICING incluye precios correctos para gemini-2.5-flash-lite', () => {
      assert.ok(PRICING['gemini-2.5-flash-lite'], 'PRICING debe registrar gemini-2.5-flash-lite');
      assert.strictEqual(PRICING['gemini-2.5-flash-lite'].inputPerToken, 0.0000001);
      assert.strictEqual(PRICING['gemini-2.5-flash-lite'].outputPerToken, 0.0000004);
    });

    it('4.2 estimateCostUsd calcula costos precisos sin colisión de prefijos', () => {
      // 1M tokens de entrada = 1,000,000 * 0.0000001 = $0.10
      // 1M tokens de salida  = 1,000,000 * 0.0000004 = $0.40
      const costLite = estimateCostUsd('gemini-2.5-flash-lite', 1000000, 1000000);
      assert.strictEqual(costLite, 0.50);

      // gemini-2.5-flash cuesta 0.30 in y 2.50 out = 2.80
      const costFlash = estimateCostUsd('gemini-2.5-flash', 1000000, 1000000);
      assert.strictEqual(costFlash, 2.80);
    });

    it('4.3 recordLlmInteraction acepta y propaga fallbackActivated y effectiveModel sin arrojar excepciones', () => {
      assert.doesNotThrow(() => {
        recordLlmInteraction({
          tenantId: 'test-tenant',
          action: 'AI_CHAT_FALLBACK_TEST',
          model: 'gemini-2.5-flash',
          tokensIn: 500,
          tokensOut: 150,
          latencyMs: 320,
          fallbackActivated: true,
          effectiveModel: 'gemini-2.5-flash-lite',
          initialModel: 'gemini-2.5-flash',
        });
      });
    });
  });
});
