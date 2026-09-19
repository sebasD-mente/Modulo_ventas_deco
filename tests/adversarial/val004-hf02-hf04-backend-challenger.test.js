/**
 * tests/adversarial/val004-hf02-hf04-backend-challenger.test.js
 * 
 * ⚔️ EMPIRICAL ADVERSARIAL TEST HARNESS: BACKEND LOGIC RESILIENCE
 * 
 * Scope:
 * 1. Ticket #HF-02 (R4): Confidentiality of System Prompt & isOperationalQuery False Positive Resistance
 * 2. Ticket #HF-04 (R5): aiMediaService Vision JSON Parser Resilience & Graceful Rejection
 * 3. Ticket #VAL-004 (R1): aiSessionService Defensive Prisma Exception Handling & In-Memory Fallbacks
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';
import { recognizePosterArtworkFromImage } from '../../server/services/ai/aiMediaService.js';
import {
  getOrCreateSession,
  saveSessionState,
  getSessionState,
  clearSessionDraft,
} from '../../server/services/ai/aiSessionService.js';
import { prisma } from '../../server/config/prisma.js';
import { ENV } from '../../server/config/env.js';
import { getClientForKey, resetKeyPool } from '../../server/services/ai/aiKeyPoolService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';

const EXACT_REJECTION_MESSAGE = 'La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo.';

describe('⚔️ ADVERSARIAL SUITE 1: Ticket HF-02 (R4) — System Prompt & Operational Query Regex', () => {
  const dummyContextData = {
    cajaTotal: 1540.0,
    efectivoEnCaja: 850.0,
    tarjetaTotal: 690.0,
    totalVentas: 24,
    vendedorNombre: 'Carlos Méndez',
    evento: 'Comic-Con Guatemala 2026',
  };

  describe('1.1 False Positive Resistance: Catalog & Price Questions MUST NOT leak cash drawer', () => {
    const catalogQueries = [
      '¿cuánto cuesta el mediano?',
      'cuánto vale la de queen?',
      'a cuánto está la de star wars?',
      'cuánto sale una personalizada?',
      '¿cuánto tardan en imprimir?',
      '¿a cuánto la tienes?',
      '¿cuánto es por 2 medianos?',
      'cuánto por el cuadro grande',
      '¿cuánto mide el formato póster mediano?',
      'precio de póster de spider-man',
    ];

    for (const query of catalogQueries) {
      test(`Query "${query}" MUST NOT trigger operational context injection`, () => {
        const prompt = buildSalesSystemPrompt({
          message: query,
          resolvedContextData: dummyContextData,
        });

        assert.ok(
          !prompt.includes('DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)'),
          `CRITICAL LEAK: "${query}" leaked confidential operational data into prompt!`
        );
        assert.ok(
          !prompt.includes('1540'),
          `Confidential cash amount (1540) leaked for catalog query "${query}"`
        );
      });
    }
  });

  describe('1.2 Operational Query Detection: Financial, Drawer & Reporting queries MUST be detected', () => {
    const operationalQueries = [
      '¿cuánto llevamos?',
      '¿cuánto vendimos?',
      '¿cuánto hay en caja?',
      'dame el reporte de ventas',
      'cuánto tenemos en efectivo',
      'caja chica',
      'cuanto llevamos',
      'CUÁNTO VENDIMOS',
      'corte de caja',
      'métricas del turno',
      'reporte del día',
      'cuánto dinero hay',
      'cuánto tenemos en caja',
    ];

    for (const query of operationalQueries) {
      test(`Query "${query}" MUST trigger operational context injection`, () => {
        const prompt = buildSalesSystemPrompt({
          message: query,
          resolvedContextData: dummyContextData,
        });

        assert.ok(
          prompt.includes('DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)'),
          `Operational context was NOT injected for operational query "${query}"`
        );
        assert.ok(
          prompt.includes('1540'),
          `Operational data (1540) must be present in prompt for query "${query}"`
        );
      });
    }
  });

  describe('1.3 Boundary Conditions: null, undefined, empty message', () => {
    test('Empty or null message defaults to including operational context (initial greeting state)', () => {
      const promptNull = buildSalesSystemPrompt({
        message: null,
        resolvedContextData: dummyContextData,
      });
      assert.ok(
        promptNull.includes('DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)'),
        'Initial null message should include context data'
      );

      const promptEmpty = buildSalesSystemPrompt({
        message: '',
        resolvedContextData: dummyContextData,
      });
      assert.ok(
        promptEmpty.includes('DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)'),
        'Empty message should include context data'
      );
    });
  });
});

describe('⚔️ ADVERSARIAL SUITE 2: Ticket HF-04 (R5) — aiMediaService Vision JSON Parser Resilience', () => {
  const TEST_TENANT = 't-adversarial-vision-hf04';
  const dummyImage = Buffer.from('MOCK_IMAGE_BUFFER_FOR_TESTS');
  const testKey = 'AQ.adversarial_vision_test_key';

  beforeEach(() => {
    resetKeyPool();
    invalidateCatalogCache(TEST_TENANT);
    ENV.GEMINI_API_KEYS = testKey;

    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: [
        {
          id: 'p-batman-dark-knight-1',
          name: 'Batman The Dark Knight',
          category: 'CÓMICS',
          basePrice: 65,
          imageUrl: 'https://images.example.com/batman.jpg',
          tags: ['batman', 'dark', 'knight', 'dc'],
          isActive: true,
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    invalidateCatalogCache(TEST_TENANT);
  });

  test('2.1 Valid JSON wrapped in markdown code fences parses cleanly and detects artwork', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: '```json\n{\n  "isArtworkDetected": true,\n  "confidence": 0.95,\n  "primaryTitle": "Batman The Dark Knight",\n  "visualAnalysis": "Batman de pie observando Gotham",\n  "suggestedSize": "MEDIANO",\n  "candidates": ["Batman The Dark Knight"]\n}\n```',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, true, 'Artwork should be detected from markdown-fenced JSON');
    assert.strictEqual(result.primaryTitle, 'Batman The Dark Knight');
    assert.ok(result.matchedPoster !== null, 'Matched poster should be populated');
    assert.strictEqual(result.total, 65);
    assert.ok(result.draftSale !== null, 'Draft sale should be prepared');
  });

  test('2.2 Malformed JSON returns graceful rejection without throwing uncaught SyntaxError', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: '```json\n{\n  "isArtworkDetected": true,\n  "confidence": 0.95,\n  "primaryTitle": "Batman The Dark Knight",\n  "visualAnalysis": "Batman unclosed JSON string',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, false, 'Malformed JSON must result in graceful rejection');
    assert.strictEqual(result.matchedPoster, null);
    assert.strictEqual(result.draftSale, null);
    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.message, EXACT_REJECTION_MESSAGE);
  });

  test('2.3 Empty response text returns graceful rejection without throwing', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: '',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, false, 'Empty text must result in graceful rejection');
    assert.strictEqual(result.draftSale, null);
    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.message, EXACT_REJECTION_MESSAGE);
  });

  test('2.4 Truncated JSON response returns graceful rejection without throwing', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: '{"primaryTitle": "Batman", "conf',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, false, 'Truncated JSON must result in graceful rejection');
    assert.strictEqual(result.draftSale, null);
    assert.strictEqual(result.message, EXACT_REJECTION_MESSAGE);
  });

  test('2.5 Non-JSON conversational response returns graceful rejection without throwing', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: 'Lo siento, no reconozco esta imagen como una obra de arte del catálogo.',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, false, 'Non-JSON text must result in graceful rejection');
    assert.strictEqual(result.draftSale, null);
    assert.strictEqual(result.message, EXACT_REJECTION_MESSAGE);
  });

  test('2.6 Markdown fences without "json" identifier safely caught or parsed without throwing', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: '```\n{\n  "isArtworkDetected": true,\n  "confidence": 0.95,\n  "primaryTitle": "Batman The Dark Knight"\n}\n```',
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    // Should return either valid rejection or match, but NEVER throw uncaught error
    assert.ok(typeof result.isArtworkDetected === 'boolean');
    assert.ok(Array.isArray(result.items));
  });

  test('2.7 Undefined or null text property on response returns graceful rejection without throwing', async () => {
    const client = getClientForKey(testKey);
    client.models.generateContent = async () => ({
      text: undefined,
    });

    const result = await recognizePosterArtworkFromImage({
      imageBuffer: dummyImage,
      mimeType: 'image/jpeg',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(result.isArtworkDetected, false);
    assert.strictEqual(result.draftSale, null);
    assert.strictEqual(result.message, EXACT_REJECTION_MESSAGE);
  });
});

describe('⚔️ ADVERSARIAL SUITE 3: Ticket VAL-004 (R1) — aiSessionService Defensive Prisma Handling', () => {
  let originalAiChatSession;

  beforeEach(() => {
    originalAiChatSession = prisma.aiChatSession;
  });

  afterEach(() => {
    prisma.aiChatSession = originalAiChatSession;
  });

  test('3.1 getOrCreateSession catches Prisma connection failure and returns in-memory fallback without throwing', async () => {
    prisma.aiChatSession = {
      upsert: async () => {
        throw new Error('Connection lost: Can\'t reach database server at 145.223.120.56:3000 (timeout 5000ms)');
      },
    };

    const session = await getOrCreateSession('sess-adv-failure-001', {
      tenantId: 'tenant-deko-test',
      eventId: 'evt-comiccon-2026',
      sellerName: 'Sebastián',
    });

    assert.ok(session !== null, 'Fallback session must not be null');
    assert.strictEqual(session.sessionId, 'sess-adv-failure-001');
    assert.strictEqual(session.tenantId, 'tenant-deko-test');
    assert.strictEqual(session.eventId, 'evt-comiccon-2026');
    assert.strictEqual(session.sellerName, 'Sebastián');
    assert.strictEqual(session.pendingDraft, null);
    assert.deepStrictEqual(session.messagesHistory, []);
  });

  test('3.2 saveSessionState catches Prisma failure and returns in-memory state fallback without throwing', async () => {
    prisma.aiChatSession = {
      upsert: async () => {
        throw new Error('PrismaClientKnownRequestError: Deadlock detected or DB unreachable');
      },
    };

    const draft = {
      items: [{ baseTitle: 'Spider-Man', sizeId: 'MEDIANO', quantity: 1, unitPrice: 65, subtotal: 65 }],
      total: 65,
      paymentMethod: 'EFECTIVO',
    };
    const history = [
      { sender: 'seller', text: 'dame 1 spiderman' },
      { sender: 'ai', text: '¡Anotado! 1 Mediano de Spider-Man en borrador.' },
    ];

    const session = await saveSessionState('sess-adv-failure-002', {
      pendingDraft: draft,
      history,
      sellerName: 'Gary',
      eventId: 'evt-2026',
      tenantId: 'tenant-test',
    });

    assert.ok(session !== null, 'Fallback session on save must not be null');
    assert.strictEqual(session.sessionId, 'sess-adv-failure-002');
    assert.strictEqual(session.sellerName, 'Gary');
    assert.strictEqual(session.pendingDraft.total, 65);
    assert.strictEqual(session.pendingDraft.items.length, 1);
    assert.strictEqual(session.messagesHistory.length, 2);
  });

  test('3.3 getSessionState catches Prisma failure and returns null without throwing', async () => {
    prisma.aiChatSession = {
      findFirst: async () => {
        throw new Error('ETIMEDOUT: database server did not respond');
      },
    };

    const result = await getSessionState('sess-adv-failure-003', 'tenant-test');
    assert.strictEqual(result, null, 'getSessionState must return null on DB error');
  });

  test('3.4 clearSessionDraft catches Prisma failure and returns null without throwing', async () => {
    prisma.aiChatSession = {
      update: async () => {
        throw new Error('ECONNREFUSED: connection refused by postgresql');
      },
    };

    const result = await clearSessionDraft('sess-adv-failure-004');
    assert.strictEqual(result, null, 'clearSessionDraft must return null on DB error');
  });

  describe('3.5 Null and undefined sessionId boundary handling', () => {
    test('All session methods safely return null when sessionId is missing', async () => {
      assert.strictEqual(await getOrCreateSession(null), null);
      assert.strictEqual(await getOrCreateSession(undefined), null);
      assert.strictEqual(await getOrCreateSession(''), null);

      assert.strictEqual(await saveSessionState(null, {}), null);
      assert.strictEqual(await saveSessionState(undefined, {}), null);
      assert.strictEqual(await saveSessionState('', {}), null);

      assert.strictEqual(await getSessionState(null), null);
      assert.strictEqual(await getSessionState(undefined), null);

      assert.strictEqual(await clearSessionDraft(null), null);
      assert.strictEqual(await clearSessionDraft(undefined), null);
    });
  });
});
