/**
 * ⚡ CHALLENGER 1: ADVERSARIAL STRESS-TESTING HARNESS
 * Latency & Concurrency Optimizations for STAND {IA}
 * 
 * Verifies:
 * - R1: Single-turn LLM guarantee for prepareSaleDraft (zero 2nd turn to Gemini).
 * - R1: Strict wire SSE event sequence: draft_sale -> token -> done.
 * - R1: Zero memory leaks across recurring stream generations.
 * - R2: Resilient Promise.all concurrency in aiMediaController.
 * - R2: Process survives GCS failures, asymmetric delays, and Gemini timeouts.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { getGCSClient } from '../../server/config/gcs.js';
import { resetKeyPool } from '../../server/services/ai/aiKeyPoolService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { streamChatWithSalesAssistant } from '../../server/services/ai/aiStreamService.js';
import { handleChatQuery } from '../../server/controllers/ai/aiChatController.js';
import { handleArtworkRecognition } from '../../server/controllers/ai/aiMediaController.js';

describe('⚔️ CHALLENGER 1: EMPIRICAL LATENCY & CONCURRENCY AUDIT', () => {
  let originalPrisma = {};

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'challenger-test-api-key';
    ENV.GCS_BUCKET_NAME = 'deko-eventsales-media';
    resetKeyPool();
    invalidateCatalogCache();

    originalPrisma = {
      product: prisma.product,
      tenant: prisma.tenant,
      event: prisma.event,
      sale: prisma.sale,
      saleItem: prisma.saleItem,
      salePayment: prisma.salePayment,
      auditLog: prisma.auditLog,
    };

    const mockProduct1 = {
      id: 'mock-batman-1',
      name: 'Batman',
      sku: 'DV-BATM',
      category: 'ARTE',
      basePrice: 65,
      sizes: [
        { sizeId: 'PEQUENO', precio: 35, nombre: 'Pequeño' },
        { sizeId: 'MEDIANO', precio: 65, nombre: 'Mediano' },
        { sizeId: 'GRANDE', precio: 125, nombre: 'Grande' },
      ],
      isActive: true,
      tenantId: 'test-tenant',
    };

    const mockProduct2 = {
      id: 'mock-starwars-1',
      name: 'Star Wars',
      sku: 'DV-STAR',
      category: 'CINE',
      basePrice: 65,
      sizes: [
        { sizeId: 'MEDIANO', precio: 65, nombre: 'Mediano' },
        { sizeId: 'GRANDE', precio: 125, nombre: 'Grande' },
      ],
      isActive: true,
      tenantId: 'test-tenant',
    };

    prisma.product = {
      findMany: async () => [mockProduct1, mockProduct2],
      upsert: async () => mockProduct1,
    };
    prisma.tenant = { findFirst: async () => ({ id: 'test-tenant' }) };
    prisma.event = {
      findUnique: async () => ({ id: 'test-event', name: 'Feria Vintage Stand IA', salesTarget: 5000 }),
      findFirst: async () => ({ id: 'test-event', name: 'Feria Vintage Stand IA', salesTarget: 5000 }),
    };
    prisma.sale = {
      aggregate: async () => ({ _sum: { totalAmount: 500 }, _count: { id: 5 } }),
      findMany: async () => [],
    };
    prisma.saleItem = {
      aggregate: async () => ({ _sum: { quantity: 10 } }),
      groupBy: async () => [],
    };
    prisma.salePayment = {
      groupBy: async () => [
        { method: 'EFECTIVO', _sum: { amount: 250 }, _count: { id: 3 } },
        { method: 'TARJETA', _sum: { amount: 250 }, _count: { id: 2 } },
      ],
    };
    prisma.auditLog = {
      create: async () => ({ id: 'audit-mock-1' }),
      update: async () => ({ id: 'audit-mock-1' }),
    };

    productCache.set('test-tenant', {
      products: [
        {
          id: 'mock-batman-1',
          titulo: 'Batman',
          precioMinimo: 65,
          sizes: mockProduct1.sizes,
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.jpg',
        },
        {
          id: 'mock-starwars-1',
          titulo: 'Star Wars',
          precioMinimo: 65,
          sizes: mockProduct2.sizes,
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/starwars.jpg',
        },
      ],
      timestamp: Date.now(),
    });

    const client = getGeminiClient();
    if (client?.models) {
      client.models.embedContent = async () => ({
        embedding: { values: new Array(768).fill(0.01) },
        embeddings: [{ values: new Array(768).fill(0.01) }],
      });
    }
  });

  afterEach(() => {
    Object.assign(prisma, originalPrisma);
    resetKeyPool();
    invalidateCatalogCache();
  });

  // ==========================================================================
  // EJE 1: DESAFÍO ADVERSARIAL R1 (aiStreamService.js & aiChatController.js)
  // ==========================================================================
  describe('1. Venta Directa & Streaming SSE (R1)', () => {
    it('1.1 Cero 2do turno LLM: prepareSaleDraft ejecuta exactamente 1 llamada LLM en venta directa', async () => {
      let llmCallsCount = 0;
      const mockClient = {
        models: {
          generateContentStream: async function* () {
            llmCallsCount++;
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [{ productName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                    paymentMethod: 'TARJETA',
                  },
                },
              ],
            };
          },
        },
      };

      const stream = streamChatWithSalesAssistant({
        message: '1 batman mediano en tarjeta',
        tenantId: 'test-tenant',
        eventId: 'test-event',
        contextData: { sellerName: 'Carlos Gómez' },
        geminiClient: mockClient,
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      assert.strictEqual(llmCallsCount, 1, 'CRÍTICO: No debe ocurrir un segundo turno LLM hacia Gemini');
      assert.strictEqual(emitted.length, 2, 'El stream debe emitir exactamente 2 eventos: draft_sale y token dinámico');
      assert.strictEqual(emitted[0].type, 'draft_sale');
      assert.strictEqual(emitted[1].type, 'token');
      assert.match(emitted[1].text, /¡Listo, Carlos!/);
      assert.match(emitted[1].text, /TARJETA/);
    });

    it('1.2 Orden estricto en el cable SSE: draft_sale -> token -> done en handleChatQuery', async () => {
      const mockClient = {
        models: {
          generateContentStream: async function* () {
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [
                      { productName: 'Batman', quantity: 2, size: 'MEDIANO', unitPrice: 65 },
                      { productName: 'Star Wars', quantity: 1, size: 'GRANDE', unitPrice: 125 },
                    ],
                    paymentMethod: 'EFECTIVO',
                  },
                },
              ],
            };
          },
        },
      };

      const originalGetClient = getGeminiClient();
      originalGetClient.models.generateContentStream = mockClient.models.generateContentStream;

      const req = new EventEmitter();
      req.body = {
        message: '2 batman mediano y 1 star wars grande en efectivo',
        eventId: 'test-event',
        sellerName: 'Sebastián',
        stream: true,
      };
      req.tenantId = 'test-tenant';
      req.headers = { accept: 'text/event-stream' };
      req.ip = '127.0.0.1';

      const sseWrites = [];
      let sseEnded = false;
      const res = {
        writeHead: () => res,
        flushHeaders: () => {},
        write: (str) => { sseWrites.push(str); return true; },
        end: () => { sseEnded = true; },
        writableEnded: false,
        destroyed: false,
      };

      await handleChatQuery(req, res);

      assert.strictEqual(sseEnded, true, 'El stream SSE debe cerrar correctamente con res.end()');

      // Parsear tipos de eventos SSE en orden de llegada
      const eventTypes = [];
      for (const chunk of sseWrites) {
        const match = chunk.match(/event:\s*([a-z_]+)/);
        if (match) {
          eventTypes.push(match[1]);
        }
      }

      assert.deepStrictEqual(
        eventTypes,
        ['draft_sale', 'token', 'done'],
        'CRÍTICO: El orden estricto de eventos SSE debe ser exactamente draft_sale -> token -> done'
      );

      // Inspeccionar datos del evento draft_sale
      const draftSaleRaw = sseWrites.find((w) => w.startsWith('event: draft_sale'));
      assert.ok(draftSaleRaw, 'Debe existir evento draft_sale');
      const draftSaleData = JSON.parse(draftSaleRaw.replace(/^event: draft_sale\ndata:\s*/, '').trim());
      assert.strictEqual(draftSaleData.items.length, 2);
      assert.strictEqual(draftSaleData.paymentMethod, 'EFECTIVO');

      // Inspeccionar evento token
      const tokenRaw = sseWrites.find((w) => w.startsWith('event: token'));
      assert.ok(tokenRaw, 'Debe existir evento token');
      const tokenData = JSON.parse(tokenRaw.replace(/^event: token\ndata:\s*/, '').trim());
      assert.match(tokenData.text, /¡Listo, Sebastián!/);
      assert.match(tokenData.text, /EFECTIVO/);

      // Inspeccionar evento done
      const doneRaw = sseWrites.find((w) => w.startsWith('event: done'));
      assert.ok(doneRaw, 'Debe existir evento done');
      const doneData = JSON.parse(doneRaw.replace(/^event: done\ndata:\s*/, '').trim());
      assert.ok(doneData.fullText, 'done debe contener el texto final completo');
    });

    it('1.3 Resiliencia a dictados multi-método (EFECTIVO, TARJETA, TRANSFERENCIA)', async () => {
      const methods = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

      for (const method of methods) {
        let calls = 0;
        const mockClient = {
          models: {
            generateContentStream: async function* () {
              calls++;
              yield {
                functionCalls: [
                  {
                    name: 'prepareSaleDraft',
                    args: {
                      items: [{ productName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                      paymentMethod: method,
                    },
                  },
                ],
              };
            },
          },
        };

        const stream = streamChatWithSalesAssistant({
          message: `1 batman mediano en ${method.toLowerCase()}`,
          tenantId: 'test-tenant',
          eventId: 'test-event',
          contextData: { sellerName: 'Ana' },
          geminiClient: mockClient,
        });

        const emitted = [];
        for await (const chunk of stream) emitted.push(chunk);

        assert.strictEqual(calls, 1, `Debe ser 1 llamada para método ${method}`);
        assert.strictEqual(emitted.length, 2);
        assert.strictEqual(emitted[0].type, 'draft_sale');
        assert.strictEqual(emitted[0].data.paymentMethod, method);
        assert.strictEqual(emitted[1].type, 'token');
        assert.match(emitted[1].text, new RegExp(method, 'i'));
      }
    });

    it('1.4 Blindaje contra llamadas paralelas de herramientas: prepareSaleDraft toma precedencia inmediata', async () => {
      let llmCallsCount = 0;
      const mockClient = {
        models: {
          generateContentStream: async function* () {
            llmCallsCount++;
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [{ productName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                    paymentMethod: 'EFECTIVO',
                  },
                },
                {
                  name: 'searchCatalog',
                  args: { query: 'Batman' },
                },
              ],
            };
          },
        },
      };

      const stream = streamChatWithSalesAssistant({
        message: 'quiero este batman y qué más tienes',
        tenantId: 'test-tenant',
        eventId: 'test-event',
        contextData: { sellerName: 'Pedro' },
        geminiClient: mockClient,
      });

      const emitted = [];
      for await (const chunk of stream) emitted.push(chunk);

      assert.strictEqual(llmCallsCount, 1, 'No debe invocar segundo turno aunque haya searchCatalog simultáneo');
      const directDraft = emitted.find((e) => e.type === 'draft_sale');
      assert.ok(directDraft, 'Debe emitir draft_sale');
      const token = emitted.find((e) => e.type === 'token');
      assert.ok(token, 'Debe emitir token confirmatorio');
      assert.match(token.text, /¡Listo, Pedro!/);
    });

    it('1.5 Seguridad en ítems vacíos: prepareSaleDraft con items:[] no produce venta corrupta', async () => {
      let llmCallsCount = 0;
      const mockClient = {
        models: {
          generateContentStream: async function* () {
            llmCallsCount++;
            if (llmCallsCount === 1) {
              yield {
                functionCalls: [
                  {
                    name: 'prepareSaleDraft',
                    args: { items: [], paymentMethod: 'EFECTIVO' },
                  },
                ],
              };
            } else {
              yield { type: 'token', text: '¿Qué póster deseas agregar al borrador?' };
            }
          },
        },
      };

      const stream = streamChatWithSalesAssistant({
        message: 'vende algo pero no sé qué',
        tenantId: 'test-tenant',
        eventId: 'test-event',
        contextData: { sellerName: 'Carlos' },
        geminiClient: mockClient,
      });

      const emitted = [];
      for await (const chunk of stream) emitted.push(chunk);

      const directConfirmation = emitted.find(
        (e) => e.type === 'token' && e.text?.includes('Te monté el borrador en pantalla listo para cobrar')
      );
      assert.strictEqual(directConfirmation, undefined, 'No debe emitir mensaje de venta lista si items está vacío');
    });

    it('1.6 Estrés de memoria y recurrencia: 250 streams recurrentes sin fugas de memoria', async () => {
      const initialMem = process.memoryUsage().heapUsed;

      const mockClient = {
        models: {
          generateContentStream: async function* () {
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [{ productName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                    paymentMethod: 'EFECTIVO',
                  },
                },
              ],
            };
          },
        },
      };

      for (let i = 0; i < 250; i++) {
        const stream = streamChatWithSalesAssistant({
          message: `venta recurrente número ${i}`,
          tenantId: 'test-tenant',
          eventId: 'test-event',
          contextData: { sellerName: `Vendedor${i}` },
          geminiClient: mockClient,
        });
        for await (const _ of stream) {
          // Consumir stream
        }
      }

      if (global.gc) global.gc();
      const finalMem = process.memoryUsage().heapUsed;
      const memDeltaMb = (finalMem - initialMem) / (1024 * 1024);

      assert.ok(
        memDeltaMb < 35,
        `Crecimiento de memoria (${memDeltaMb.toFixed(2)} MB) debe ser acotado tras 250 iteraciones`
      );
    });

    it('1.7 Cierre anticipado del cliente (Abort / Socket Close) no deja streams huérfanos', async () => {
      const mockClient = {
        models: {
          generateContentStream: async function* () {
            yield { type: 'token', text: 'Iniciando...' };
            await new Promise((r) => setTimeout(r, 20));
            yield { type: 'token', text: 'Continuando...' };
          },
        },
      };

      const originalGetClient = getGeminiClient();
      originalGetClient.models.generateContentStream = mockClient.models.generateContentStream;

      const req = new EventEmitter();
      req.body = { message: 'Hola', eventId: 'test-event', stream: true };
      req.tenantId = 'test-tenant';
      req.headers = { accept: 'text/event-stream' };
      req.ip = '127.0.0.1';

      const sseWrites = [];
      const res = {
        writeHead: () => res,
        flushHeaders: () => {},
        write: (str) => { sseWrites.push(str); return true; },
        end: () => {},
        writableEnded: false,
        destroyed: false,
      };

      setTimeout(() => {
        req.emit('close');
        res.writableEnded = true;
      }, 5);

      await handleChatQuery(req, res);

      assert.ok(sseWrites.length <= 2, 'No debe seguir escribiendo tras desconexión del cliente');
    });
  });

  // ==========================================================================
  // EJE 2: DESAFÍO ADVERSARIAL R2 (aiMediaController.js — Concurrencia Promise.all)
  // ==========================================================================
  describe('2. Concurrencia y Resiliencia en Visión (R2)', () => {
    it('2.1 Zero-Wait GCS: Ejecución concurrente real comprobada temporalmente', async () => {
      let gcsActive = false;
      let geminiActiveAtSameTime = false;

      const gcs = getGCSClient();
      gcs.bucket = (bName) => ({
        file: (filename) => ({
          save: async () => {
            gcsActive = true;
            await new Promise((r) => setTimeout(r, 40));
            gcsActive = false;
          },
          publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        if (gcsActive) geminiActiveAtSameTime = true;
        await new Promise((r) => setTimeout(r, 40));
        return {
          text: JSON.stringify({
            primaryTitle: 'Star Wars',
            visualAnalysis: 'Póster de Star Wars clásico',
            confidence: 0.95,
            suggestedSize: 'GRANDE',
            candidates: ['Star Wars IV', 'Star Wars V'],
          }),
        };
      };

      const req = {
        file: { buffer: Buffer.from('mock-binary-data'), originalname: 'sw.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };
      let responseData = null;
      let statusCode = 200;
      const res = {
        status(c) { statusCode = c; return this; },
        json(p) { responseData = p; return this; },
      };

      const t0 = Date.now();
      await handleArtworkRecognition(req, res);
      const elapsed = Date.now() - t0;

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(geminiActiveAtSameTime, true, 'Gemini y GCS deben operar al mismo tiempo');
      assert.ok(
        elapsed < 70,
        `Tiempo concurrente (${elapsed}ms) debe ser sustancialmente inferior a la suma secuencial (>=80ms)`
      );
      assert.strictEqual(responseData.primaryTitle, 'Star Wars');
      assert.ok(responseData.imageUrl);
    });

    it('2.2 Resiliencia ante falla catastrófica de GCS: Node no colapsa y responde con graceful fallback (imageUrl: null)', async () => {
      const gcs = getGCSClient();
      gcs.bucket = () => ({
        file: () => ({
          save: async () => {
            throw new Error('ECONNRESET: GCS connection abruptly dropped by peer');
          },
          publicUrl: () => null,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Batman Begins',
          visualAnalysis: 'Póster cinematográfico de Batman',
          confidence: 0.99,
          suggestedSize: 'MEDIANO',
          candidates: ['Batman Begins'],
        }),
      });

      const req = {
        file: { buffer: Buffer.from('mock-bytes'), originalname: 'batman.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };

      let responseData = null;
      let statusCode = 200;
      const res = {
        status(c) { statusCode = c; return this; },
        json(p) { responseData = p; return this; },
      };

      await handleArtworkRecognition(req, res);

      assert.strictEqual(statusCode, 200, 'Debe degradar graciosamente retornando HTTP 200');
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.imageUrl, null, 'imageUrl debe ser null al fallar GCS');
      assert.strictEqual(responseData.primaryTitle, 'Batman Begins');
      assert.ok(responseData.draftSale, 'draftSale debe ser retornado intacto');
      assert.strictEqual(responseData.draftSale.imageUrl, null);
    });

    it('2.3 Resiliencia a demoras asimétricas: GCS ultra-lento (120ms) y Gemini rápido (10ms)', async () => {
      const gcs = getGCSClient();
      gcs.bucket = (bName) => ({
        file: (filename) => ({
          save: async () => {
            await new Promise((r) => setTimeout(r, 120));
          },
          publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        await new Promise((r) => setTimeout(r, 10));
        return {
          text: JSON.stringify({
            primaryTitle: 'Batman',
            visualAnalysis: 'Batman rápido',
            confidence: 0.92,
            candidates: [],
          }),
        };
      };

      const req = {
        file: { buffer: Buffer.from('data'), originalname: 'batman.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };

      let responseData = null;
      const res = {
        status() { return this; },
        json(p) { responseData = p; return this; },
      };

      const t0 = Date.now();
      await handleArtworkRecognition(req, res);
      const elapsed = Date.now() - t0;

      assert.ok(responseData.success);
      assert.ok(responseData.imageUrl);
      assert.ok(elapsed >= 115 && elapsed < 160, `Tiempo total (${elapsed}ms) gobernado por GCS`);
    });

    it('2.4 Resiliencia a demoras asimétricas: GCS rápido (10ms) y Gemini lento (120ms)', async () => {
      const gcs = getGCSClient();
      gcs.bucket = (bName) => ({
        file: (filename) => ({
          save: async () => {
            await new Promise((r) => setTimeout(r, 10));
          },
          publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        await new Promise((r) => setTimeout(r, 120));
        return {
          text: JSON.stringify({
            primaryTitle: 'Star Wars',
            visualAnalysis: 'Star Wars lento',
            confidence: 0.94,
            candidates: [],
          }),
        };
      };

      const req = {
        file: { buffer: Buffer.from('data'), originalname: 'sw.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };

      let responseData = null;
      const res = {
        status() { return this; },
        json(p) { responseData = p; return this; },
      };

      const t0 = Date.now();
      await handleArtworkRecognition(req, res);
      const elapsed = Date.now() - t0;

      assert.ok(responseData.success);
      assert.ok(responseData.imageUrl);
      assert.strictEqual(responseData.draftSale.imageUrl, responseData.imageUrl);
      assert.ok(elapsed >= 115 && elapsed < 160, `Tiempo total (${elapsed}ms) gobernado por Gemini`);
    });

    it('2.5 Falla en Gemini (429 Rate Limit) con GCS exitoso no colapsa el proceso Node.js', async () => {
      const gcs = getGCSClient();
      gcs.bucket = (bName) => ({
        file: (filename) => ({
          save: async () => {},
          publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        const err = new Error('429 Resource Exhausted: Rate limit reached');
        err.status = 429;
        throw err;
      };

      const req = {
        file: { buffer: Buffer.from('data'), originalname: 'fail.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };

      let statusCode = null;
      let responseData = null;
      const res = {
        status(c) { statusCode = c; return this; },
        json(p) { responseData = p; return this; },
      };

      await handleArtworkRecognition(req, res);

      assert.strictEqual(statusCode, 500, 'Debe responder con HTTP 500');
      assert.strictEqual(responseData.success, false);
      assert.match(responseData.error, /Rate limit reached|Error/i);
    });

    it('2.6 Doble falla simultánea (GCS y Gemini fallan en simultáneo) no cuelga el proceso', async () => {
      const gcs = getGCSClient();
      gcs.bucket = () => ({
        file: () => ({
          save: async () => { throw new Error('GCS Error 503'); },
          publicUrl: () => null,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        throw new Error('Gemini Ingestion Error');
      };

      const req = {
        file: { buffer: Buffer.from('data'), originalname: 'double-fail.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'test-event' },
        tenantId: 'test-tenant',
      };

      let statusCode = null;
      let responseData = null;
      const res = {
        status(c) { statusCode = c; return this; },
        json(p) { responseData = p; return this; },
      };

      await handleArtworkRecognition(req, res);

      assert.strictEqual(statusCode, 500);
      assert.strictEqual(responseData.success, false);
    });

    it('2.7 Ráfaga de alta concurrencia: 40 peticiones concurrentes a handleArtworkRecognition', async () => {
      const gcs = getGCSClient();
      gcs.bucket = (bName) => ({
        file: (filename) => ({
          save: async () => { await new Promise((r) => setTimeout(r, Math.random() * 20)); },
          publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
        }),
      });

      const client = getGeminiClient();
      client.models.generateContent = async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 20));
        return {
          text: JSON.stringify({
            primaryTitle: 'Batman',
            visualAnalysis: 'Análisis de ráfaga',
            confidence: 0.9,
            candidates: [],
          }),
        };
      };

      const promises = Array.from({ length: 40 }, (_, idx) => {
        const req = {
          file: { buffer: Buffer.from(`data-${idx}`), originalname: `art-${idx}.jpg`, mimetype: 'image/jpeg' },
          body: { eventId: 'test-event' },
          tenantId: 'test-tenant',
        };
        let code = 200, data = null;
        const res = {
          status(c) { code = c; return this; },
          json(p) { data = p; return this; },
        };
        return handleArtworkRecognition(req, res).then(() => ({ code, data }));
      });

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 40);
      for (const r of results) {
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.data.success, true);
        assert.strictEqual(r.data.primaryTitle, 'Batman');
      }
    });
  });
});
