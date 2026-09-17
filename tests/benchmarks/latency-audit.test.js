import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { getGCSClient } from '../../server/config/gcs.js';
import { resetKeyPool } from '../../server/services/ai/aiKeyPoolService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { streamChatWithSalesAssistant } from '../../server/services/ai/aiStreamService.js';
import { handleArtworkRecognition } from '../../server/controllers/ai/aiMediaController.js';

describe('⚡ BENCHMARK & AUDITORÍA DE LATENCIA Y RESILIENCIA FERIAL (R6)', () => {
  let originalPrisma = {};

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-benchmark-key';
    ENV.GCS_BUCKET_NAME = 'deko-eventsales-media';
    resetKeyPool();
    invalidateCatalogCache();

    originalPrisma = {
      product: prisma.product, tenant: prisma.tenant, event: prisma.event,
      sale: prisma.sale, saleItem: prisma.saleItem, salePayment: prisma.salePayment,
    };

    const mockProduct = {
      id: 'mock-batman-1', name: 'Batman', sku: 'DV-BATM', category: 'ARTE', basePrice: 65,
      sizes: [{ sizeId: 'MEDIANO', precio: 65, nombre: 'Mediano' }], isActive: true, tenantId: 'test-tenant',
    };

    prisma.product = { findMany: async () => [mockProduct], upsert: async () => mockProduct };
    prisma.tenant = { findFirst: async () => ({ id: 'test-tenant' }) };
    prisma.event = { findUnique: async () => ({ id: 'test-event', name: 'Feria Vintage Stand IA' }), findFirst: async () => ({ id: 'test-event', name: 'Feria Vintage Stand IA' }) };
    prisma.sale = { aggregate: async () => ({ _sum: { totalAmount: 100 }, _count: { id: 2 } }), findMany: async () => [] };
    prisma.saleItem = { aggregate: async () => ({ _sum: { quantity: 3 } }), groupBy: async () => [] };
    prisma.salePayment = { groupBy: async () => [{ method: 'EFECTIVO', _sum: { amount: 50 }, _count: { id: 1 } }, { method: 'TARJETA', _sum: { amount: 50 }, _count: { id: 1 } }] };

    productCache.set('test-tenant', {
      products: [{ id: 'mock-batman-1', titulo: 'Batman', precioMinimo: 65, sizes: [{ sizeId: 'MEDIANO', precio: 65, nombre: 'Mediano' }], imageUrl: 'https://img.jpg' }],
      timestamp: Date.now(),
    });

    const client = getGeminiClient();
    if (client?.models) client.models.embedContent = async () => ({ embedding: { values: new Array(768).fill(0.01) }, embeddings: [{ values: new Array(768).fill(0.01) }] });
  });

  afterEach(() => {
    Object.assign(prisma, originalPrisma);
    resetKeyPool();
    invalidateCatalogCache();
  });

  it('1. Chat Venta Directa (R1): Completa en 1 solo turno LLM sin follow-up cerrado', async () => {
    let llmCallsCount = 0;
    const mockClient = {
      models: {
        generateContentStream: async function* () {
          llmCallsCount++;
          yield { functionCalls: [{ name: 'prepareSaleDraft', args: { items: [{ productName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }], paymentMethod: 'TARJETA' } }] };
        },
      },
    };

    const stream = streamChatWithSalesAssistant({
      message: '1 batman mediano en tarjeta', tenantId: 'test-tenant', eventId: 'test-event',
      contextData: { sellerName: 'Carlos Gómez' }, geminiClient: mockClient,
    });
    const emitted = [];
    for await (const chunk of stream) emitted.push(chunk);

    assert.strictEqual(llmCallsCount, 1, 'CRÍTICO: Exactamente 1 llamada LLM (sin segundo turno)');
    assert.strictEqual(emitted.length, 2, 'Debe emitir draft_sale seguido de token dinámico y finalizar');
    const draftEvent = emitted.find((e) => e.type === 'draft_sale');
    assert.ok(draftEvent, 'Debe emitir el evento draft_sale');
    assert.strictEqual(draftEvent.data.paymentMethod, 'TARJETA');
    assert.strictEqual(draftEvent.data.items?.[0]?.quantity, 1);

    const tokenEvent = emitted.find((e) => e.type === 'token');
    assert.ok(tokenEvent, 'Debe emitir token conversacional dinámico');
    assert.strictEqual(tokenEvent.text, '¡Listo, Carlos! Te monté el borrador en pantalla listo para cobrar con TARJETA. ¿Confirmamos la venta?');
  });

  it('2. Visión Concurrente (R2): safePersistMedia y recognizePosterArtworkFromImage corren en paralelo (Promise.all)', async () => {
    let gcsActive = false, gcsActiveWhenGeminiStarted = false;
    const gcs = getGCSClient();
    gcs.bucket = (bName) => ({
      file: (filename) => ({
        save: async () => { gcsActive = true; await new Promise((r) => setTimeout(r, 30)); gcsActive = false; },
        publicUrl: () => `https://storage.googleapis.com/${bName}/${filename}`,
      }),
    });

    const client = getGeminiClient();
    client.models.generateContent = async () => {
      if (gcsActive) gcsActiveWhenGeminiStarted = true;
      await new Promise((r) => setTimeout(r, 30));
      return {
        text: JSON.stringify({
          primaryTitle: 'Batman', visualAnalysis: 'Póster vintage de Batman en estilo cómic clásico',
          confidence: 0.98, suggestedSize: 'MEDIANO', candidates: ['Batman Begins', 'The Dark Knight'],
        }),
      };
    };

    const req = {
      file: { buffer: Buffer.from('mock-img-data'), originalname: 'batman.jpg', mimetype: 'image/jpeg' },
      body: { eventId: 'test-event' }, tenantId: 'test-tenant',
    };
    let responseData = null, responseStatus = 200;
    const res = { status(c) { responseStatus = c; return this; }, json(p) { responseData = p; return this; } };

    const tStart = Date.now();
    await handleArtworkRecognition(req, res);
    const elapsed = Date.now() - tStart;

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(gcsActiveWhenGeminiStarted, true, 'CRÍTICO: Gemini Vision inició mientras GCS estaba activo (concurrencia confirmada)');
    assert.ok(elapsed < 55, `Tiempo total (${elapsed}ms) debe ser menor a la suma secuencial (>=60ms)`);
    assert.ok(responseData.imageUrl, 'Debe incluir imageUrl');
    assert.strictEqual(responseData.primaryTitle, 'Batman');
    assert.strictEqual(responseData.visualAnalysis, 'Póster vintage de Batman en estilo cómic clásico');
    assert.ok(Array.isArray(responseData.candidates), 'Debe incluir candidates');
    assert.ok(responseData.draftSale, 'Debe incluir draftSale');
    assert.strictEqual(responseData.draftSale.imageUrl, responseData.imageUrl, 'draftSale debe heredar imageUrl');
    assert.strictEqual(responseData.requiresConfirmation, true, 'requiresConfirmation debe ser true');
  });

  it('3. No-Regresión Informativa (searchCatalog): Preserva follow-up conversacional cerrado (streamClosedLoopFollowUp)', async () => {
    let llmCallsCount = 0;
    const mockClient = {
      models: {
        generateContentStream: async function* () {
          llmCallsCount++;
          if (llmCallsCount === 1) yield { functionCalls: [{ name: 'searchCatalog', args: { query: 'Batman' } }] };
          else yield { type: 'token', text: 'Aquí tienes las opciones de Batman en catálogo.' };
        },
      },
    };

    const stream = streamChatWithSalesAssistant({
      message: 'busca Batman en catálogo', tenantId: 'test-tenant', eventId: 'test-event',
      contextData: { sellerName: 'Carlos' }, geminiClient: mockClient,
    });
    const emitted = [];
    for await (const chunk of stream) emitted.push(chunk);

    assert.strictEqual(llmCallsCount, 2, 'Consultas informativas deben realizar segundo turno para follow-up enriquecido');
    assert.ok(emitted.find((e) => e.type === 'suggested_posters'), 'Debe emitir evento suggested_posters');
    const tokenEvent = emitted.find((e) => e.type === 'token');
    assert.ok(tokenEvent, 'Debe emitir token conversacional tras resolver la herramienta');
    assert.match(tokenEvent.text, /Batman/i);
  });

  it('4. No-Regresión Informativa (getEventKPIs): Ejecuta segundo turno con streamClosedLoopFollowUp', async () => {
    let llmCallsCount = 0;
    const mockClient = {
      models: {
        generateContentStream: async function* () {
          llmCallsCount++;
          if (llmCallsCount === 1) yield { functionCalls: [{ name: 'getEventKPIs', args: { eventId: 'test-event' } }] };
          else yield { type: 'token', text: 'Llevamos Q 100.00 vendidos hoy.' };
        },
      },
    };

    const stream = streamChatWithSalesAssistant({
      message: '¿cuánto dinero llevamos vendido en caja?', tenantId: 'test-tenant', eventId: 'test-event',
      contextData: { sellerName: 'Carlos' }, geminiClient: mockClient,
    });
    const emitted = [];
    for await (const chunk of stream) emitted.push(chunk);

    assert.strictEqual(llmCallsCount, 2, 'getEventKPIs debe invocar 2 turnos cerrados');
    assert.ok(emitted.find((e) => e.type === 'event_kpis'), 'Debe emitir event_kpis');
    assert.ok(emitted.find((e) => e.type === 'token'), 'Debe emitir token explicativo en segundo turno');
  });
});
