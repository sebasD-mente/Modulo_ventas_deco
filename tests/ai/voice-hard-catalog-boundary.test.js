/**
 * tests/ai/voice-hard-catalog-boundary.test.js
 * 
 * Comprehensive test suite validating catalog shielding in voice sales:
 * - Test Case A: 100% uncataloged voice sale ("zapatos") -> isSaleDetected: false, draftSale: null, items: [], suggestedPosters <= 3.
 * - Test Case B: Mixed dictation ("1 Batman mediano y 2 pares de zapatos") -> only Batman in items, zapatos in unmatchedItems, warning in message.
 * - Test Case C: Valid voice sale ("Spider-Man") -> 100% matched, unmatchedItems: [].
 * - Test Case D: Zero items with null IDs under any circumstances.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { processVoiceSaleAudio } from '../../server/services/ai/aiMediaService.js';
import { handleVoiceSale } from '../../server/controllers/ai/aiMediaController.js';
import { ENV } from '../../server/config/env.js';
import { getClientForKey } from '../../server/services/ai/aiKeyPoolService.js';

function createMockRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(code) { statusCode = code; return this; },
    json(data) { body = data; return this; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

describe('🛡️ Voice Hard Catalog Boundary & Catalog Shielding Suite', () => {
  const TEST_TENANT = 't-voice-shield-test';
  const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....fake-audio-payload');

  beforeEach(() => {
    invalidateCatalogCache(TEST_TENANT);
    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: [
        {
          id: '8f7a92b1-4c3e-4b2a-8d1e-9f0a1b2c3d4e',
          titulo: 'Batman The Dark Knight',
          subtitulo: 'El caballero de la noche',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          tags: ['batman', 'dc', 'dark', 'knight'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
          ],
        },
        {
          id: '5e6d7c8b-9a0f-1e2d-3c4b-5a6b7c8d9e0f',
          titulo: 'Spider-Man Vintage Comic',
          subtitulo: 'Marvel Comics retro',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
          tags: ['spiderman', 'spider-man', 'marvel'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
          ],
        },
        {
          id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
          titulo: 'Bad Bunny - Un Verano Sin Ti',
          subtitulo: 'Portada de álbum musical',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          tags: ['bad', 'bunny', 'verano', 'musica'],
          sizes: [
            { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 },
          ],
        },
      ],
    });
  });

  // ==========================================================================
  // TEST CASE A: 100% Uncataloged Voice Sale ("zapatos")
  // ==========================================================================
  it('Test Case A: 100% uncataloged voice sale returns isSaleDetected: false, items: [], suggestedPosters <= 3 and draftSale: null in controller', async () => {
    const testKey = 'AQ.test_case_a_key';
    ENV.GEMINI_API_KEYS = testKey;
    const client = getClientForKey(testKey);

    client.models.generateContent = async ({ config }) => {
      if (!config?.responseSchema) {
        return { text: 'Quiero 2 pares de zapatos deportivos' };
      }
      return {
        text: JSON.stringify({
          transcription: 'Quiero 2 pares de zapatos deportivos',
          isSaleDetected: true,
          intent: 'DICTADO_VENTA',
          items: [
            { title: 'zapatos deportivos', rawName: 'zapatos deportivos', quantity: 2, size: 'MEDIANO', unitPrice: 100 },
          ],
          paymentMethod: 'EFECTIVO',
          confidence: 0.95,
        }),
      };
    };

    // 1. Service evaluation
    const serviceResult = await processVoiceSaleAudio({
      audioBuffer: dummyAudio,
      mimeType: 'audio/webm',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(serviceResult.isSaleDetected, false, 'isSaleDetected must be false when 100% items are uncataloged');
    assert.strictEqual(serviceResult.items.length, 0, 'items array must be strictly empty');
    assert.strictEqual(serviceResult.total, 0, 'total must be 0');
    assert.ok(Array.isArray(serviceResult.unmatchedItems), 'unmatchedItems must be an array');
    assert.strictEqual(serviceResult.unmatchedItems.length, 1, 'must contain 1 unmatched item');
    const unmatchedName = serviceResult.unmatchedItems[0].rawName || serviceResult.unmatchedItems[0].requestedTitle || serviceResult.unmatchedItems[0];
    assert.match(unmatchedName, /zapatos/i);
    assert.ok(Array.isArray(serviceResult.suggestedPosters), 'suggestedPosters must be an array');
    assert.ok(serviceResult.suggestedPosters.length <= 3, 'suggestedPosters must have at most 3 items');
    assert.match(serviceResult.message, /No se identificaron pósters del catálogo oficial/i);

    // 2. Controller evaluation
    const req = {
      file: { buffer: dummyAudio, mimetype: 'audio/webm' },
      body: { eventId: 'event-stand-1' },
      tenantId: TEST_TENANT,
    };
    const res = createMockRes();

    await handleVoiceSale(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.isSaleDetected, false);
    assert.strictEqual(res.body.draftSale, null, 'draftSale must be strictly null for 0-match audio');
    assert.ok(res.body.unmatchedItems && res.body.unmatchedItems.length === 1);
    assert.ok(Array.isArray(res.body.suggestedPosters));
    assert.ok(res.body.suggestedPosters.length <= 3);
  });

  // ==========================================================================
  // TEST CASE B: Mixed Dictation ("1 Batman mediano y 2 pares de zapatos")
  // ==========================================================================
  it('Test Case B: Mixed dictation isolates Batman in items, zapatos in unmatchedItems, and emits seller warning', async () => {
    const testKey = 'AQ.test_case_b_key';
    ENV.GEMINI_API_KEYS = testKey;
    const client = getClientForKey(testKey);

    client.models.generateContent = async ({ config }) => {
      if (!config?.responseSchema) {
        return { text: '1 Batman mediano y 2 pares de zapatos en efectivo' };
      }
      return {
        text: JSON.stringify({
          transcription: '1 Batman mediano y 2 pares de zapatos en efectivo',
          isSaleDetected: true,
          intent: 'DICTADO_VENTA',
          items: [
            { title: 'Batman', rawName: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 },
            { title: 'zapatos', rawName: 'zapatos', quantity: 2, size: 'MEDIANO', unitPrice: 100 },
          ],
          paymentMethod: 'EFECTIVO',
          confidence: 0.95,
        }),
      };
    };

    // 1. Service evaluation
    const serviceResult = await processVoiceSaleAudio({
      audioBuffer: dummyAudio,
      mimeType: 'audio/webm',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(serviceResult.isSaleDetected, true, 'isSaleDetected must be true when at least one catalog item matches');
    assert.strictEqual(serviceResult.items.length, 1, 'Only genuine catalog item must be in items');
    assert.match(serviceResult.items[0].description, /Batman/i);
    assert.strictEqual(serviceResult.items[0].sizeId, 'MEDIANO');
    assert.strictEqual(serviceResult.items[0].unitPrice, 65);
    assert.strictEqual(serviceResult.total, 65, 'Total must strictly equal the verified catalog item sum');

    assert.ok(Array.isArray(serviceResult.unmatchedItems));
    assert.strictEqual(serviceResult.unmatchedItems.length, 1);
    const unmatchedName = serviceResult.unmatchedItems[0].rawName || serviceResult.unmatchedItems[0].requestedTitle;
    assert.strictEqual(unmatchedName, 'zapatos');

    assert.ok(serviceResult.message, 'Message warning must be present');
    assert.match(serviceResult.message, /los siguientes productos no están en el catálogo: zapatos/i);

    // 2. Controller evaluation
    const req = {
      file: { buffer: dummyAudio, mimetype: 'audio/webm' },
      body: { eventId: 'event-stand-1' },
      tenantId: TEST_TENANT,
    };
    const res = createMockRes();

    await handleVoiceSale(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.draftSale !== null, 'draftSale must be created for verified items');
    assert.strictEqual(res.body.draftSale.items.length, 1);
    assert.match(res.body.draftSale.items[0].description, /Batman/i);
    assert.ok(Array.isArray(res.body.unmatchedItems));
    assert.strictEqual(res.body.unmatchedItems.length, 1);
    assert.match(res.body.message, /zapatos/i);
  });

  // ==========================================================================
  // TEST CASE C: Valid Voice Sale ("Spider-Man")
  // ==========================================================================
  it('Test Case C: 100% valid voice sale for Spider-Man enriches items completely with unmatchedItems: []', async () => {
    const testKey = 'AQ.test_case_c_key';
    ENV.GEMINI_API_KEYS = testKey;
    const client = getClientForKey(testKey);

    client.models.generateContent = async ({ config }) => {
      if (!config?.responseSchema) {
        return { text: 'Dame un Spider-Man mediano con tarjeta' };
      }
      return {
        text: JSON.stringify({
          transcription: 'Dame un Spider-Man mediano con tarjeta',
          isSaleDetected: true,
          intent: 'DICTADO_VENTA',
          items: [
            { title: 'Spider-Man', rawName: 'Spider-Man', quantity: 1, size: 'MEDIANO', unitPrice: 65 },
          ],
          paymentMethod: 'TARJETA',
          confidence: 0.98,
        }),
      };
    };

    const serviceResult = await processVoiceSaleAudio({
      audioBuffer: dummyAudio,
      mimeType: 'audio/webm',
      tenantId: TEST_TENANT,
    });

    assert.strictEqual(serviceResult.isSaleDetected, true);
    assert.strictEqual(serviceResult.items.length, 1);
    assert.match(serviceResult.items[0].description, /Spider-Man/i);
    assert.strictEqual(serviceResult.items[0].sizeId, 'MEDIANO');
    assert.strictEqual(serviceResult.items[0].unitPrice, 65);
    assert.strictEqual(serviceResult.total, 65);
    assert.strictEqual(serviceResult.paymentMethod, 'TARJETA');
    assert.deepStrictEqual(serviceResult.unmatchedItems, []);
    assert.deepStrictEqual(serviceResult.suggestedPosters, []);

    // Controller evaluation
    const req = {
      file: { buffer: dummyAudio, mimetype: 'audio/webm' },
      body: { eventId: 'event-stand-1' },
      tenantId: TEST_TENANT,
    };
    const res = createMockRes();

    await handleVoiceSale(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.draftSale !== null);
    assert.strictEqual(res.body.draftSale.items.length, 1);
    assert.strictEqual(res.body.draftSale.paymentMethod, 'TARJETA');
    assert.deepStrictEqual(res.body.unmatchedItems, []);
  });

  // ==========================================================================
  // TEST CASE D: Zero items with null IDs under any circumstances
  // ==========================================================================
  it('Test Case D: In all sales, zero items with null productId and null webPosterId are ever accepted', async () => {
    const testKey = 'AQ.test_case_d_key';
    ENV.GEMINI_API_KEYS = testKey;
    const client = getClientForKey(testKey);

    client.models.generateContent = async ({ config }) => {
      if (!config?.responseSchema) {
        return { text: '1 Batman mediano, 1 termo espacial y 1 pulsera de cuarzo' };
      }
      return {
        text: JSON.stringify({
          transcription: '1 Batman mediano, 1 termo espacial y 1 pulsera de cuarzo',
          isSaleDetected: true,
          intent: 'DICTADO_VENTA',
          items: [
            { title: 'Batman', quantity: 1, size: 'MEDIANO' },
            { title: 'termo espacial', quantity: 1, size: 'MEDIANO' },
            { title: 'pulsera de cuarzo', quantity: 1, size: 'MEDIANO' },
          ],
          paymentMethod: 'EFECTIVO',
          confidence: 0.90,
        }),
      };
    };

    const serviceResult = await processVoiceSaleAudio({
      audioBuffer: dummyAudio,
      mimeType: 'audio/webm',
      tenantId: TEST_TENANT,
    });

    for (const item of serviceResult.items) {
      assert.ok(
        item.productId !== null || item.webPosterId !== null,
        `Item ${item.description} must have at least one valid catalog ID`
      );
      assert.notStrictEqual(item.productId, null, 'productId cannot be null for catalog product');
    }

    assert.strictEqual(serviceResult.items.length, 1);
    assert.strictEqual(serviceResult.unmatchedItems.length, 2);
    const unmatchedTitles = serviceResult.unmatchedItems.map(u => u.rawName || u.requestedTitle);
    assert.ok(unmatchedTitles.includes('termo espacial'));
    assert.ok(unmatchedTitles.includes('pulsera de cuarzo'));
  });
});
