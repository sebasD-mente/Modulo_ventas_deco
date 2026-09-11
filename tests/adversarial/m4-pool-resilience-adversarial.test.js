/**
 * ⚔️ CHALLENGER 1 — ADVERSARIAL EMPIRICAL SUITE (Hito M4)
 * 
 * Comprehensive empirical stress-testing for the Multi-Model Contingency Pool,
 * 429/503 fallback chains, SSE streaming resiliency, mid-stream fault injection,
 * wire-level SSE channel protection, and high-concurrency leak prevention.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Environment bootstrap for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

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
  streamChatWithSalesAssistant,
  chatWithSalesAssistant,
  buildSalesSystemPrompt,
} from '../../server/services/aiMultimodalService.js';

import {
  PRICING,
  estimateCostUsd,
  recordLlmInteraction,
} from '../../server/services/llmObservabilityService.js';

describe('⚔️ CHALLENGER 1: Adversarial Stress-Testing — Multi-Model Contingency Pool & SSE (M4)', () => {

  // ==========================================================================
  // BLOQUE 1: Inyección de Fallas 429 y 503 en Cadena (Cascada Multi-Modelo)
  // ==========================================================================
  describe('1. Inyección de Fallas 429 (Cuotas) y 503 (Sobrecarga) en Cadena', () => {

    it('1.1 Cascada Doble 429: gemini-2.5-flash (429) -> gemini-2.5-flash-lite (429) -> gemini-1.5-flash (Éxito)', async () => {
      const callSequence = [];
      const mockClient = { models: {} };

      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callSequence.push(model);
          if (model === 'gemini-2.5-flash') {
            const err = new Error('GoogleGenerativeAIError: [429 Too Many Requests] RESOURCE_EXHAUSTED quota exceeded');
            err.status = 429;
            throw err;
          }
          if (model === 'gemini-2.5-flash-lite') {
            const err = new Error('GoogleGenerativeAIError: [429] Rate limit reached for flash-lite');
            err.status = 'RESOURCE_EXHAUSTED';
            throw err;
          }
          if (model === 'gemini-1.5-flash') {
            return { text: 'Respuesta exitosa desde modelo de contingencia final' };
          }
          throw new Error('Modelo desconocido: ' + model);
        },
      });

      // Verificaciones estrictas
      assert.deepStrictEqual(
        callSequence,
        ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'],
        'Debe haber intentado cada modelo exactamente una vez sin reintentos inútiles ante 429'
      );
      assert.strictEqual(res.usedModel, 'gemini-1.5-flash', 'El modelo utilizado debe ser gemini-1.5-flash');
      assert.strictEqual(res.fallbackOccurred, true, 'Debe marcar que ocurrió fallback');
      assert.strictEqual(res.initialModel, 'gemini-2.5-flash', 'El modelo inicial debe ser gemini-2.5-flash');
      assert.strictEqual(res.result.text, 'Respuesta exitosa desde modelo de contingencia final');
    });

    it('1.2 Cascada Mixta Compleja: 503 en flash (con 1 reintento jitter) -> 429 en flash-lite (inmediato) -> éxito en 1.5-flash', async () => {
      const callSequence = [];
      let flash503Attempts = 0;
      const mockClient = { models: {} };

      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callSequence.push(model);
          if (model === 'gemini-2.5-flash') {
            flash503Attempts++;
            const err = new Error('503 Service Unavailable: The model is overloaded. Please try again later.');
            err.status = 503;
            throw err;
          }
          if (model === 'gemini-2.5-flash-lite') {
            const err = new Error('429 RESOURCE_EXHAUSTED: Daily quota reached');
            err.status = 429;
            throw err;
          }
          if (model === 'gemini-1.5-flash') {
            return { answer: 'Éxito tras cascada mixta' };
          }
          throw new Error('Inesperado');
        },
      });

      // Para 503 debe haber intentado 2 veces (intento 0 y retry 1) en gemini-2.5-flash
      // Para 429 en flash-lite debe haber intentado 1 sola vez y conmutado inmediatamente
      assert.strictEqual(flash503Attempts, 2, 'gemini-2.5-flash debe haber recibido 2 intentos (intento inicial + 1 reintento jitter)');
      assert.deepStrictEqual(
        callSequence,
        ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'],
        'Secuencia exacta esperada de llamadas con retry en 503 e switch inmediato en 429'
      );
      assert.strictEqual(res.usedModel, 'gemini-1.5-flash');
      assert.strictEqual(res.fallbackOccurred, true);
      assert.strictEqual(res.result.answer, 'Éxito tras cascada mixta');
    });

    it('1.3 Recuperación Transitoria: Caída de socket ECONNRESET en intento 1 -> éxito en intento 2 del mismo modelo', async () => {
      const callSequence = [];
      let attempts = 0;
      const mockClient = { models: {} };

      const res = await executeWithModelFallback({
        models: MODEL_PRIORITY_POOL,
        client: mockClient,
        taskFn: async ({ model }) => {
          callSequence.push(model);
          attempts++;
          if (attempts === 1) {
            const err = new Error('fetch failed: socket hang up');
            err.code = 'ECONNRESET';
            throw err;
          }
          return { reply: 'Recuperado en el mismo modelo tras micro-corte de red' };
        },
      });

      assert.strictEqual(attempts, 2, 'Debió reintentar en el mismo modelo');
      assert.deepStrictEqual(callSequence, ['gemini-2.5-flash', 'gemini-2.5-flash']);
      assert.strictEqual(res.usedModel, 'gemini-2.5-flash');
      assert.strictEqual(res.fallbackOccurred, false, 'No conmutó de modelo porque el reintento tuvo éxito');
      assert.strictEqual(res.result.reply, 'Recuperado en el mismo modelo tras micro-corte de red');
    });

    it('1.4 Colapso Total del Pool: Si todos los 3 modelos se agotan, relanza el error original sin perder datos', async () => {
      const callSequence = [];
      const mockClient = { models: {} };

      await assert.rejects(
        async () => {
          await executeWithModelFallback({
            models: MODEL_PRIORITY_POOL,
            client: mockClient,
            taskFn: async ({ model }) => {
              callSequence.push(model);
              const err = new Error(`429 Quota Exhausted on ${model}`);
              err.status = 429;
              err.customField = `exhaustion-${model}`;
              throw err;
            },
          });
        },
        (err) => {
          assert.strictEqual(err.status, 429);
          assert.strictEqual(err.customField, 'exhaustion-gemini-1.5-flash', 'Debe preservar el último error del pool');
          assert.ok(err.message.includes('gemini-1.5-flash'));
          return true;
        }
      );

      assert.deepStrictEqual(callSequence, ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']);
    });

    it('1.5 Error 400 Bad Request o 401 Unauthorized: Cero reintentos y Cero conmutación espuria', async () => {
      const callSequence = [];
      const mockClient = { models: {} };

      await assert.rejects(
        async () => {
          await executeWithModelFallback({
            models: MODEL_PRIORITY_POOL,
            client: mockClient,
            taskFn: async ({ model }) => {
              callSequence.push(model);
              const err = new Error('API key not valid. Please pass a valid API key.');
              err.status = 401;
              throw err;
            },
          });
        },
        (err) => {
          assert.strictEqual(err.status, 401);
          return true;
        }
      );

      assert.deepStrictEqual(
        callSequence,
        ['gemini-2.5-flash'],
        'No debe enmascarar errores de autorización ni iterar innecesariamente el pool'
      );
    });
  });

  // ==========================================================================
  // BLOQUE 2: Streaming SSE Resiliente Bajo Contingencia
  // ==========================================================================
  describe('2. Streaming SSE Resiliente: Conmutación Pre-Token y Protección Mid-Stream', () => {

    it('2.1 Pre-Token Fallback en Cadena: Modelo 1 (429) -> Modelo 2 (503) -> Modelo 3 (Stream de Tokens)', async () => {
      const attempted = [];
      let selectedModel = null;

      const mockClient = {
        models: {
          generateContentStream: async ({ model }) => {
            attempted.push(model);
            if (model === 'gemini-2.5-flash') {
              const err = new Error('429 RESOURCE_EXHAUSTED: Rate limit');
              err.status = 429;
              throw err;
            }
            if (model === 'gemini-2.5-flash-lite') {
              const err = new Error('503 UNAVAILABLE: Model overloaded');
              err.status = 503;
              throw err;
            }
            if (model === 'gemini-1.5-flash') {
              async function* stream() {
                yield { text: '¡Hola! ' };
                yield { text: '¿En qué te puedo asesorar hoy en el stand?' };
              }
              return stream();
            }
            throw new Error('Modelo desconocido');
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'],
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
        onModelSelected: (m) => {
          selectedModel = m;
        },
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.deepStrictEqual(attempted, ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']);
      assert.strictEqual(selectedModel, 'gemini-1.5-flash');
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, '¡Hola! ');
      assert.strictEqual(chunks[1].text, '¿En qué te puedo asesorar hoy en el stand?');
    });

    it('2.2 Colapso Total Pre-Token: Si todos los modelos fallan en inicialización, emite mensaje cordial sin romper el stream', async () => {
      const mockClient = {
        models: {
          generateContentStream: async ({ model }) => {
            const err = new Error(`429 Quota exhausted on ${model}`);
            err.status = 429;
            throw err;
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'],
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].type, 'token');
      assert.ok(
        chunks[0].text.includes('volumen alto de consultas') || chunks[0].text.includes('formulario manual'),
        'Debe emitir mensaje cordial orientando al formulario manual ágil'
      );
    });

    it('2.3 Corte Abrupto Mid-Stream: Conserva tokens previos y finaliza con mensaje cordial sin lanzar excepción', async () => {
      const mockClient = {
        models: {
          generateContentStream: async () => {
            async function* brokenStream() {
              yield { text: '¡Excelente elección! La obra de ' };
              yield { text: 'Spider-Man Mediano de Q65 está lista. ' };
              // Simular corte de socket / saturación a mitad de stream
              const netErr = new Error('ECONNRESET: Connection severed mid-stream by upstream proxy');
              netErr.code = 'ECONNRESET';
              throw netErr;
            }
            return brokenStream();
          },
        },
      };

      const generator = streamWithModelFallback({
        client: mockClient,
        models: ['gemini-2.5-flash'],
        buildContentsAndConfig: () => ({ contents: [], config: {} }),
      });

      const receivedChunks = [];
      for await (const chunk of generator) {
        receivedChunks.push(chunk);
      }

      // Debe haber recibido los dos primeros tokens intactos
      assert.strictEqual(receivedChunks.length, 3, 'Debe contener los 2 tokens previos + 1 token cordial de cierre');
      assert.strictEqual(receivedChunks[0].text, '¡Excelente elección! La obra de ');
      assert.strictEqual(receivedChunks[1].text, 'Spider-Man Mediano de Q65 está lista. ');
      assert.ok(
        receivedChunks[2].text.includes('*(Respuesta finalizada.'),
        'El tercer token debe ser el mensaje cordial de cierre para no romper el cliente React'
      );
    });

    it('2.4 Mid-Stream con Function Calling emitido antes del corte: Preserva llamadas a herramientas', async () => {
      const mockClient = {
        models: {
          generateContentStream: async () => {
            async function* brokenStream() {
              yield {
                functionCalls: [
                  {
                    name: 'prepareSaleDraft',
                    args: {
                      items: [{ name: 'Anime Poster', quantity: 1, sizeId: 'MEDIANO', price: 65 }],
                      total: 65,
                      paymentMethod: 'EFECTIVO',
                    },
                  },
                ],
              };
              yield { text: 'Te he preparado el borrador en pantalla. ' };
              throw new Error('Service Unavailable 503 mid-stream');
            }
            return brokenStream();
          },
        },
      };

      const generator = streamChatWithSalesAssistant({
        message: 'Anotame 1 de anime mediano',
        history: [],
        tenantId: 'test-tenant',
        eventId: 'test-event-uuid',
        geminiClient: mockClient,
      });

      const yieldedEvents = [];
      for await (const ev of generator) {
        yieldedEvents.push(ev);
      }

      // Verificamos que el borrador fue extraído y yield-eado antes del corte
      const draftEvents = yieldedEvents.filter((e) => e.type === 'draft_sale');
      assert.strictEqual(draftEvents.length, 1, 'Debe haber emitido el evento draft_sale antes de la interrupción');
      assert.strictEqual(draftEvents[0].data.total, 65);

      // Verificamos que los tokens emitidos existan y terminen cordialmente
      const tokenEvents = yieldedEvents.filter((e) => e.type === 'token');
      assert.ok(tokenEvents.length >= 2, 'Debe haber emitido el token inicial y el token de cierre cordial');
      const lastToken = tokenEvents[tokenEvents.length - 1];
      assert.ok(lastToken.text.includes('*(Respuesta finalizada.') || lastToken.text.includes('venta activa'));
    });
  });

  // ==========================================================================
  // BLOQUE 3: Integridad del Canal SSE a Nivel de Cable (Simulación aiController)
  // ==========================================================================
  describe('3. Integridad del Canal SSE a Nivel Wire (Express Response Mock)', () => {

    /**
     * Helper para mockear el objeto Express Response para SSE
     */
    function createMockSseResponse() {
      const written = [];
      let headers = {};
      let statusCode = 200;
      let finished = false;

      return {
        writeHead: (code, hdrs) => {
          statusCode = code;
          headers = { ...headers, ...hdrs };
        },
        flushHeaders: () => {},
        write: (chunk) => {
          written.push(String(chunk));
        },
        end: () => {
          finished = true;
        },
        headersSent: false,
        getWrittenData: () => written.join(''),
        getWrittenFrames: () => written,
        getStatusCode: () => statusCode,
        getHeaders: () => headers,
        isFinished: () => finished,
      };
    }

    it('3.1 Wire SSE: Corte mid-stream NUNCA emite "event: error", envía "event: done" y cierra limpiamente', async () => {
      const res = createMockSseResponse();

      const mockClient = {
        models: {
          generateContentStream: async () => {
            async function* brokenStream() {
              yield { text: 'Iniciando asesoría de arte Deco Vintage... ' };
              const err = new Error('500 Internal Error during token generation');
              err.status = 500;
              throw err;
            }
            return brokenStream();
          },
        },
      };

      // Simular exactamente la lógica de streaming de aiController.js:handleChatQuery
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });

      let fullText = '';
      const streamGenerator = streamChatWithSalesAssistant({
        message: 'Hola, recomiéndame algo',
        history: [],
        tenantId: 'test-tenant',
        eventId: 'test-event-uuid',
        geminiClient: mockClient,
      });

      for await (const chunk of streamGenerator) {
        if (chunk.type === 'token') {
          fullText += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`);
        } else if (chunk.type === 'draft_sale') {
          res.write(`event: draft_sale\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        }
      }

      res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
      res.end();

      const wireOutput = res.getWrittenData();

      // Comprobaciones cruciales para la estabilidad de UnifiedAiChat.jsx
      assert.strictEqual(res.isFinished(), true, 'La respuesta SSE debe finalizar limpiamente');
      assert.strictEqual(res.getStatusCode(), 200);
      assert.strictEqual(res.getHeaders()['Content-Type'], 'text/event-stream');
      assert.ok(!wireOutput.includes('event: error'), 'CRÍTICO: El canal SSE NO debe emitir "event: error" ante cortes mid-stream');
      assert.ok(wireOutput.includes('event: token'), 'Debe emitir los tokens generados');
      assert.ok(wireOutput.includes('*(Respuesta finalizada.'), 'Debe incluir el mensaje cordial de cierre');
      assert.ok(wireOutput.includes('event: done'), 'Debe concluir con "event: done"');
    });

    it('3.2 Wire SSE: Fallback 429 pre-token transmite transparente sin corrupción de frames', async () => {
      const res = createMockSseResponse();
      let attemptedModels = [];

      const mockClient = {
        models: {
          generateContentStream: async ({ model }) => {
            attemptedModels.push(model);
            if (model === 'gemini-2.5-flash') {
              const err = new Error('429 Quota Exceeded');
              err.status = 429;
              throw err;
            }
            async function* okStream() {
              yield { text: '¡Por supuesto! Tenemos pósters de HP Látex con durabilidad superior.' };
            }
            return okStream();
          },
        },
      };

      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let fullText = '';
      const streamGenerator = streamChatWithSalesAssistant({
        message: '¿Qué calidad tienen los pósters?',
        history: [],
        tenantId: 'test-tenant',
        eventId: 'test-event-uuid',
        geminiClient: mockClient,
      });

      for await (const chunk of streamGenerator) {
        if (chunk.type === 'token') {
          fullText += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`);
        }
      }
      res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
      res.end();

      const wireOutput = res.getWrittenData();
      assert.deepStrictEqual(attemptedModels, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
      assert.ok(!wireOutput.includes('event: error'));
      assert.ok(wireOutput.includes('HP Látex con durabilidad superior'));
      assert.ok(wireOutput.includes('event: done'));
      assert.strictEqual(res.isFinished(), true);
    });
  });

  // ==========================================================================
  // BLOQUE 4: Pruebas de Estrés Concurrente, Memoria y Casos Límite
  // ==========================================================================
  describe('4. Estrés de Alta Concurrencia, Cero Memory Leaks y Robustez de Errores', () => {

    it('4.1 50 llamadas concurrentes con fallas aleatorias 429/503: Cero unhandled rejections y heap estable', async () => {
      const mockClient = { models: {} };
      const startHeap = process.memoryUsage().heapUsed;

      // Lanzar 50 ejecuciones concurrentes compitiendo por el pool
      const tasks = Array.from({ length: 50 }, (_, i) => {
        return executeWithModelFallback({
          models: MODEL_PRIORITY_POOL,
          client: mockClient,
          taskFn: async ({ model }) => {
            const rand = (i + model.length) % 4;
            if (rand === 0 && model === 'gemini-2.5-flash') {
              const err = new Error('429 Rate Limit');
              err.status = 429;
              throw err;
            }
            if (rand === 1 && model === 'gemini-2.5-flash') {
              const err = new Error('503 Service Overloaded');
              err.status = 503;
              throw err;
            }
            if (rand === 2 && (model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-lite')) {
              const err = new Error('429 Quota');
              err.status = 429;
              throw err;
            }
            return { taskId: i, handledBy: model };
          },
        });
      });

      const results = await Promise.all(tasks);
      assert.strictEqual(results.length, 50, 'Todas las 50 promesas deben resolverse exitosamente');

      const byModel = results.reduce((acc, r) => {
        acc[r.usedModel] = (acc[r.usedModel] || 0) + 1;
        return acc;
      }, {});

      // Verificar que el tráfico se distribuyó y resolvió a través del pool
      assert.ok(byModel['gemini-2.5-flash'] > 0, 'Parte del tráfico debe haber sido atendido por flash');
      assert.ok(byModel['gemini-2.5-flash-lite'] > 0 || byModel['gemini-1.5-flash'] > 0, 'Parte del tráfico debió conmutar a contingencia');

      const endHeap = process.memoryUsage().heapUsed;
      const heapDiffMb = (endHeap - startHeap) / (1024 * 1024);
      // Comprobar que no hay fuga masiva de memoria (< 30 MB tras 50 ejecuciones simultáneas)
      assert.ok(heapDiffMb < 30, `El incremento de heap (${heapDiffMb.toFixed(2)} MB) debe mantenerse bajo control`);
    });

    it('4.2 30 streams concurrentes con abortos mid-stream: Cero fugas de iteradores ni bloqueos', async () => {
      const mockClient = {
        models: {
          generateContentStream: async () => {
            async function* erraticStream() {
              yield { text: 'Token 1 ' };
              yield { text: 'Token 2 ' };
              const err = new Error('Random socket reset mid-stream');
              err.code = 'ECONNRESET';
              throw err;
            }
            return erraticStream();
          },
        },
      };

      const streamTasks = Array.from({ length: 30 }, async () => {
        const gen = streamWithModelFallback({
          client: mockClient,
          models: ['gemini-2.5-flash'],
          buildContentsAndConfig: () => ({ contents: [], config: {} }),
        });
        const chunks = [];
        for await (const chunk of gen) {
          chunks.push(chunk);
        }
        return chunks;
      });

      const allStreamResults = await Promise.all(streamTasks);
      assert.strictEqual(allStreamResults.length, 30);
      for (const res of allStreamResults) {
        assert.strictEqual(res.length, 3, 'Cada stream interrumpido debe haber emitido exactamente 3 tokens (2 normales + 1 cierre cordial)');
        assert.ok(res[2].text.includes('*(Respuesta finalizada.'));
      }
    });

    it('4.3 Resistencia de Clasificadores ante Entradas Adversariales y Malformadas', () => {
      const adversarialInputs = [
        null,
        undefined,
        '',
        0,
        123,
        NaN,
        false,
        true,
        {},
        [],
        { message: null },
        { message: undefined },
        { message: 429 },
        { status: null },
        { status: 'invalid_status' },
        { code: null },
        { code: 503 },
      ];

      // Referencia circular
      const circularObj = {};
      circularObj.self = circularObj;
      adversarialInputs.push(circularObj);

      for (const input of adversarialInputs) {
        assert.doesNotThrow(
          () => isRateLimitOrQuotaError(input),
          `isRateLimitOrQuotaError no debe arrojar error con ${typeof input}`
        );
        assert.doesNotThrow(
          () => isServiceOverloadedError(input),
          `isServiceOverloadedError no debe arrojar error con ${typeof input}`
        );
        assert.doesNotThrow(
          () => isTransientNetworkError(input),
          `isTransientNetworkError no debe arrojar error con ${typeof input}`
        );
        assert.doesNotThrow(
          () => isRetryableOnSameModel(input),
          `isRetryableOnSameModel no debe arrojar error con ${typeof input}`
        );
        assert.doesNotThrow(
          () => shouldFallbackToNextModel(input),
          `shouldFallbackToNextModel no debe arrojar error con ${typeof input}`
        );
      }
    });

    it('4.4 sleepWithJitter Distribución y Cotas Estrictas', async () => {
      const samples = [];
      for (let i = 0; i < 20; i++) {
        const delay = await sleepWithJitter(1, 10, 50);
        assert.ok(delay >= 0 && delay <= 51, `Delay ${delay} debe estar en [0, 51]`);
        samples.push(delay);
      }
      // Verificar que los delays varían (no son estáticos/determinísticos)
      const uniqueSamples = new Set(samples);
      assert.ok(uniqueSamples.size > 1, 'El jitter debe generar valores variados en el rango');
    });
  });

  // ==========================================================================
  // BLOQUE 5: Verificación del Prompt Maestro J.A.R.V.I.S. y Trato de "Tú"
  // ==========================================================================
  describe('5. Auditoría Adversarial del Tono J.A.R.V.I.S. y Proscripción de Burocracia', () => {

    it('5.1 Proscripción Incondicional de Fórmulas Formales Burocráticas', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'ComicCon Guatemala 2026', location: 'Fórum Majadas', salesTarget: 15000 },
        resolvedContextData: {
          totalVendido: 'Q 5,420.00',
          transaccionesTotales: 34,
          unidadesVendidas: 62,
          ticketPromedio: 'Q 159.41',
        },
        pendingDraft: null,
      });

      // El prompt debe instruir taxativamente el trato de "tú"
      assert.ok(prompt.includes('TRATO EXCLUSIVO DE "TÚ"'));
      assert.ok(prompt.includes('PROHIBIDO terminantemente usar "usted"'));
      assert.ok(prompt.includes('"su persona"'), 'Debe incluir "su persona" en la lista de prohibiciones');
      assert.ok(prompt.includes('"su revisión"'), 'Debe incluir "su revisión" en la lista de prohibiciones');

      // Verificar que las instrucciones no utilicen fórmulas burocráticas
      assert.ok(!prompt.includes('a su entera disposición'));
      assert.ok(!prompt.includes('quedo a su disposición'));
    });

    it('5.2 Presencia de los 4 Pilares Comerciales y Upselling Activo', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Bazar Central' },
        resolvedContextData: {},
        pendingDraft: null,
      });

      assert.ok(prompt.includes('HP LÁTEX ECOLÓGICO'), 'Debe incluir directiva de tecnología HP Látex');
      assert.ok(prompt.includes('Durabilidad UV superior a 10 años'), 'Debe incluir durabilidad UV superior a 10 años');
      assert.ok(prompt.includes('tesa'), 'Debe incluir cinta tesa');
      assert.ok(prompt.includes('15 segundos'), 'Debe incluir instalación en 15 segundos sin clavos');
      assert.ok(prompt.includes('MEDIANO (30x45 cm / 12x18 pulg a Q65.00)'), 'Debe incluir recomendación estrella Mediano Q65');
      assert.ok(prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)'), 'Debe incluir Portada de Álbum Q55');
    });
  });
});
