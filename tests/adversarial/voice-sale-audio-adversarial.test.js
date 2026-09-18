/**
 * tests/adversarial/voice-sale-audio-adversarial.test.js
 * 
 * ⚔️ ADVERSARIAL AUDIO CHALLENGER SUITE — EMPIRICAL VERIFICATION HARNESS
 * 
 * Role: Audio Adversarial Challenger (challenger_1)
 * Target: processVoiceSaleAudio & /api/ai/voice-sale boundary
 * 
 * Stress-testing dimensions:
 * 1. 100% uncataloged voice sales ("sombrero mediano y zapatos deportivos", "pizza hawayana", "audífonos bluetooth")
 * 2. Mixed orders ("1 Batman mediano y 2 pares de zapatos", "Spider-Man grande y una hamburguesa")
 * 3. Colloquial aliases ("el bati", "conejo malo", "el hombre arana", "f1")
 * 4. Single-token non-catalog words & tag-bleed isolation ("sombrero", "street", "mundo")
 * 5. Audio edge cases (noise, greetings, empty transcriptions, zero items, negative/zero quantities)
 * 6. Hard constraint stress-check: zero items with null IDs (productId: null AND webPosterId: null)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { processVoiceSaleAudio } from '../../server/services/ai/aiMediaService.js';
import { handleVoiceSale } from '../../server/controllers/ai/aiMediaController.js';
import { matchPosterEverywhere, searchWebPosters } from '../../server/services/webCatalogService.js';
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

describe('⚔️ Audio Adversarial Challenger: Voice Sale & Catalog Shielding Stress Harness', () => {
  const TEST_TENANT = 't-audio-adversarial-challenger';
  const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....fake-audio-payload-for-adversarial-testing');

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
          tags: ['batman', 'dc', 'dark', 'knight', 'street', 'ciudad'],
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
          tags: ['spiderman', 'spider-man', 'marvel', 'peter', 'parker'],
          sizes: [
            { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
          ],
        },
        {
          id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
          titulo: 'Bad Bunny - Un Verano Sin Ti',
          subtitulo: 'Portada de álbum musical',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          tags: ['bad', 'bunny', 'verano', 'musica', 'album'],
          sizes: [
            { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
          ],
        },
        {
          id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
          titulo: 'Mapa del Mundo Vintage',
          subtitulo: 'Cartografía náutica antigua',
          categoria: 'VINTAGE',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/mapa.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/mapa.webp',
          tags: ['mapa', 'mundo', 'vintage', 'tierra', 'navegacion'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
          ],
        },
        {
          id: '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
          titulo: 'Formula 1 - Gran Premio Red Bull',
          subtitulo: 'Carreras Motorsport F1',
          categoria: 'DEPORTES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
          tags: ['f1', 'formula', 'carreras', 'redbull'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
          ],
        },
      ],
    });
  });

  // ==========================================================================
  // SECTION 1: 100% UNCATALOGED VOICE SALES
  // ==========================================================================
  describe('1. 100% Uncataloged Voice Sales Stress Tests', () => {
    it('1.1 "sombrero mediano y zapatos deportivos" -> isSaleDetected: false, draftSale: null, items: [], suggestedPosters <= 3', async () => {
      const testKey = 'AQ.adv_uncataloged_1';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: 'sombrero mediano y zapatos deportivos' };
        return {
          text: JSON.stringify({
            transcription: 'sombrero mediano y zapatos deportivos',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              { title: 'sombrero', rawName: 'sombrero mediano', quantity: 1, size: 'MEDIANO' },
              { title: 'zapatos deportivos', rawName: 'zapatos deportivos', quantity: 1, size: 'MEDIANO' },
            ],
            paymentMethod: 'EFECTIVO',
            confidence: 0.94,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false, 'isSaleDetected must be strictly false');
      assert.strictEqual(result.items.length, 0, 'items must be empty array');
      assert.strictEqual(result.total, 0, 'total must be 0');
      assert.strictEqual(result.unmatchedItems.length, 2, 'both uncataloged items must be in unmatchedItems');
      assert.ok(Array.isArray(result.suggestedPosters), 'suggestedPosters must be an array');
      assert.ok(result.suggestedPosters.length <= 3, 'suggestedPosters must not exceed 3');
      assert.match(result.message, /No se identificaron pósters del catálogo oficial/i);

      // Verify HTTP controller boundary
      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.isSaleDetected, false);
      assert.strictEqual(res.body.draftSale, null, 'draftSale MUST be null');
      assert.strictEqual(res.body.unmatchedItems.length, 2);
      assert.ok(res.body.suggestedPosters.length <= 3);
    });

    it('1.2 "pizza hawayana" -> isSaleDetected: false, draftSale: null, items: [], suggestedPosters <= 3', async () => {
      const testKey = 'AQ.adv_uncataloged_2';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: 'una pizza hawayana por favor' };
        return {
          text: JSON.stringify({
            transcription: 'una pizza hawayana por favor',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [{ title: 'pizza hawayana', quantity: 1, size: 'GRANDE' }],
            paymentMethod: 'EFECTIVO',
            confidence: 0.90,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.total, 0);
      assert.strictEqual(result.unmatchedItems.length, 1);
      assert.ok(result.suggestedPosters.length <= 3);

      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.body.draftSale, null);
      assert.strictEqual(res.body.isSaleDetected, false);
    });

    it('1.3 "audífonos bluetooth" -> isSaleDetected: false, draftSale: null, items: [], suggestedPosters <= 3', async () => {
      const testKey = 'AQ.adv_uncataloged_3';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '2 audífonos bluetooth con transferencia' };
        return {
          text: JSON.stringify({
            transcription: '2 audífonos bluetooth con transferencia',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [{ title: 'audífonos bluetooth', quantity: 2, size: 'MEDIANO' }],
            paymentMethod: 'TRANSFERENCIA',
            confidence: 0.92,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.total, 0);
      assert.strictEqual(result.unmatchedItems.length, 1);
      assert.ok(result.suggestedPosters.length <= 3);

      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.body.draftSale, null);
      assert.strictEqual(res.body.isSaleDetected, false);
    });
  });

  // ==========================================================================
  // SECTION 2: MIXED ORDERS (CATALOG + UNCATALOGED)
  // ==========================================================================
  describe('2. Mixed Orders (Catalog + Uncataloged) Stress Tests', () => {
    it('2.1 "1 Batman mediano y 2 pares de zapatos" -> only Batman in items, zapatos in unmatchedItems, seller warning', async () => {
      const testKey = 'AQ.adv_mixed_1';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '1 Batman mediano y 2 pares de zapatos' };
        return {
          text: JSON.stringify({
            transcription: '1 Batman mediano y 2 pares de zapatos',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              { title: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 },
              { title: 'zapatos', quantity: 2, size: 'MEDIANO', unitPrice: 150 },
            ],
            paymentMethod: 'EFECTIVO',
            confidence: 0.95,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true, 'isSaleDetected must be true because Batman matched');
      assert.strictEqual(result.items.length, 1, 'Only Batman should be enriched');
      assert.match(result.items[0].description, /Batman/i);
      assert.strictEqual(result.items[0].unitPrice, 65);
      assert.strictEqual(result.total, 65, 'Total must strictly equal Q65 (uncataloged zapatos excluded)');
      assert.strictEqual(result.unmatchedItems.length, 1);
      assert.strictEqual(result.unmatchedItems[0].rawName, 'zapatos');
      assert.match(result.message, /los siguientes productos no están en el catálogo: zapatos/i);

      // Verify controller response
      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.draftSale !== null, 'draftSale must be present');
      assert.strictEqual(res.body.draftSale.items.length, 1);
      assert.strictEqual(res.body.draftSale.total, 65);
      assert.strictEqual(res.body.unmatchedItems.length, 1);
      assert.match(res.body.message, /zapatos/i);
    });

    it('2.2 "Spider-Man grande y una hamburguesa" -> only Spider-Man in items (GRANDE), hamburguesa in unmatchedItems', async () => {
      const testKey = 'AQ.adv_mixed_2';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '1 Spider-Man grande y una hamburguesa con tarjeta' };
        return {
          text: JSON.stringify({
            transcription: '1 Spider-Man grande y una hamburguesa con tarjeta',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              { title: 'Spider-Man', quantity: 1, size: 'GRANDE', unitPrice: 125 },
              { title: 'hamburguesa', quantity: 1, size: 'MEDIANO' },
            ],
            paymentMethod: 'TARJETA',
            confidence: 0.96,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 1);
      assert.match(result.items[0].description, /Spider-Man/i);
      assert.strictEqual(result.items[0].sizeId, 'GRANDE');
      assert.strictEqual(result.items[0].unitPrice, 125);
      assert.strictEqual(result.total, 125);
      assert.strictEqual(result.paymentMethod, 'TARJETA');
      assert.strictEqual(result.unmatchedItems.length, 1);
      assert.strictEqual(result.unmatchedItems[0].rawName, 'hamburguesa');
      assert.match(result.message, /los siguientes productos no están en el catálogo: hamburguesa/i);
    });

    it('2.3 "3 Bad Bunny portada de álbum, 1 pizza y 4 llaves maestras" -> only Bad Bunny (PORTADA_ALBUM, total Q165)', async () => {
      const testKey = 'AQ.adv_mixed_3';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '3 Bad Bunny portada de album, 1 pizza y 4 llaves maestras' };
        return {
          text: JSON.stringify({
            transcription: '3 Bad Bunny portada de album, 1 pizza y 4 llaves maestras',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              { title: 'Bad Bunny', quantity: 3, size: 'PORTADA_ALBUM' },
              { title: 'pizza', quantity: 1, size: 'MEDIANO' },
              { title: 'llaves maestras', quantity: 4, size: 'PEQUENO' },
            ],
            paymentMethod: 'EFECTIVO',
            confidence: 0.97,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 1);
      assert.match(result.items[0].description, /Bad Bunny/i);
      assert.strictEqual(result.items[0].quantity, 3);
      assert.strictEqual(result.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(result.items[0].unitPrice, 55);
      assert.strictEqual(result.items[0].subtotal, 165);
      assert.strictEqual(result.total, 165);
      assert.strictEqual(result.unmatchedItems.length, 2);
      const unmatchedTitles = result.unmatchedItems.map(u => u.rawName);
      assert.ok(unmatchedTitles.includes('pizza'));
      assert.ok(unmatchedTitles.includes('llaves maestras'));
    });
  });

  // ==========================================================================
  // SECTION 3: COLLOQUIAL ALIASES RESOLUTION
  // ==========================================================================
  describe('3. Colloquial Aliases Resolution Stress Tests', () => {
    it('3.1 Colloquial alias "el bati" resolves to Batman The Dark Knight with 0 unmatched items', async () => {
      const testKey = 'AQ.adv_alias_bati';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: 'dame 1 del bati mediano' };
        return {
          text: JSON.stringify({
            transcription: 'dame 1 del bati mediano',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [{ title: 'el bati', rawName: 'el bati', quantity: 1, size: 'MEDIANO' }],
            paymentMethod: 'EFECTIVO',
            confidence: 0.96,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 1);
      assert.match(result.items[0].description, /Batman/i);
      assert.strictEqual(result.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(result.items[0].unitPrice, 65);
      assert.strictEqual(result.unmatchedItems.length, 0, 'Must have 0 unmatched items for valid alias');
    });

    it('3.2 Colloquial alias "conejo malo" resolves to Bad Bunny with 0 unmatched items', async () => {
      const testKey = 'AQ.adv_alias_conejo';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '1 de conejo malo en vinilo' };
        return {
          text: JSON.stringify({
            transcription: '1 de conejo malo en vinilo',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [{ title: 'conejo malo', rawName: 'conejo malo', quantity: 1, size: 'PORTADA_ALBUM' }],
            paymentMethod: 'EFECTIVO',
            confidence: 0.98,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 1);
      assert.match(result.items[0].description, /Bad Bunny/i);
      assert.strictEqual(result.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(result.items[0].unitPrice, 55);
      assert.strictEqual(result.unmatchedItems.length, 0);
    });

    it('3.3 Short alias "f1" resolves to Formula 1 without being filtered out', async () => {
      const testKey = 'AQ.adv_alias_f1';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '1 de f1 mediano' };
        return {
          text: JSON.stringify({
            transcription: '1 de f1 mediano',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [{ title: 'f1', rawName: 'f1', quantity: 1, size: 'MEDIANO' }],
            paymentMethod: 'EFECTIVO',
            confidence: 0.95,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 1);
      assert.match(result.items[0].description, /Formula 1/i);
      assert.strictEqual(result.unmatchedItems.length, 0);
    });
  });

  // ==========================================================================
  // SECTION 4: SINGLE-TOKEN NON-CATALOG WORDS & TAG-BLEED ISOLATION
  // ==========================================================================
  describe('4. Single-Token Non-Catalog Words & Tag-Bleed Isolation', () => {
    it('4.1 Single-token non-catalog word "sombrero" does NOT match any poster', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'sombrero');
      assert.strictEqual(match, null, '"sombrero" must NOT match any catalog item');
    });

    it('4.2 Single-token "street" present in Batman tags must NOT match Batman (anti tag-bleed rule)', async () => {
      // Batman has tag: 'street', but title is 'Batman The Dark Knight'
      const match = await matchPosterEverywhere(TEST_TENANT, 'street');
      assert.strictEqual(match, null, '"street" must NOT match Batman merely because it is in tags');
    });

    it('4.3 Single-token "mundo" matches "Mapa del Mundo Vintage" and NEVER matches Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'mundo');
      assert.ok(match !== null, 'Must match Mapa del Mundo');
      assert.match(match.description, /Mapa del Mundo/i);
      assert.doesNotMatch(match.description, /Batman/i);
    });

    it('4.4 Common stop words ("poster", "tamanos", "medida") return null in matcher', async () => {
      const match1 = await matchPosterEverywhere(TEST_TENANT, 'poster');
      const match2 = await matchPosterEverywhere(TEST_TENANT, 'tamanos');
      const match3 = await matchPosterEverywhere(TEST_TENANT, 'medida');
      assert.strictEqual(match1, null);
      assert.strictEqual(match2, null);
      assert.strictEqual(match3, null);
    });
  });

  // ==========================================================================
  // SECTION 5: AUDIO EDGE CASES (NOISE, GREETING, EMPTY, ANOMALOUS)
  // ==========================================================================
  describe('5. Audio Edge Cases Stress Tests', () => {
    it('5.1 Noise dictation returns intent: RUIDO_NO_VENTA, isSaleDetected: false, draftSale: null, items: []', async () => {
      const testKey = 'AQ.adv_noise';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '[ruido de fondo]' };
        return {
          text: JSON.stringify({
            transcription: '[ruido de fondo]',
            isSaleDetected: false,
            intent: 'RUIDO_NO_VENTA',
            items: [],
            confidence: 0.90,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.intent, 'RUIDO_NO_VENTA');
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.total, 0);

      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.body.isSaleDetected, false);
      assert.strictEqual(res.body.draftSale, null);
    });

    it('5.2 Greeting only returns intent: SALUDO, isSaleDetected: false, draftSale: null, greeting message', async () => {
      const testKey = 'AQ.adv_greeting';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '¡Hola! Buenos días, ¿cómo están por acá?' };
        return {
          text: JSON.stringify({
            transcription: '¡Hola! Buenos días, ¿cómo están por acá?',
            isSaleDetected: false,
            intent: 'SALUDO',
            greeting: '¡Buenos días! ¿Qué póster preparamos hoy?',
            items: [],
            confidence: 0.99,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.intent, 'SALUDO');
      assert.strictEqual(result.items.length, 0);
      assert.ok(result.greeting);

      const req = { file: { buffer: dummyAudio, mimetype: 'audio/webm' }, body: { eventId: 'event-adversarial-1' }, tenantId: TEST_TENANT };
      const res = createMockRes();
      await handleVoiceSale(req, res);

      assert.strictEqual(res.body.isSaleDetected, false);
      assert.strictEqual(res.body.draftSale, null);
      assert.match(res.body.message, /Buenos días/i);
    });

    it('5.3 Empty transcription returns isSaleDetected: false, draftSale: null, items: []', async () => {
      const testKey = 'AQ.adv_empty';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '' };
        return {
          text: JSON.stringify({
            transcription: '',
            isSaleDetected: false,
            items: [],
            confidence: 0.80,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.total, 0);
    });

    it('5.4 Anomalous LLM response (isSaleDetected: true with items: []) safely returns isSaleDetected: false', async () => {
      const testKey = 'AQ.adv_anomalous';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: 'algo raro' };
        return {
          text: JSON.stringify({
            transcription: 'algo raro',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [], // Anomaly: true flag with empty items
            confidence: 0.85,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, false, 'Must safeguard against empty items array even if isSaleDetected was true');
      assert.strictEqual(result.items.length, 0);
    });

    it('5.5 Zero or negative quantity in items is strictly clamped to at least 1', async () => {
      const testKey = 'AQ.adv_clamped_qty';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) return { text: '0 Batman' };
        return {
          text: JSON.stringify({
            transcription: '0 Batman',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              { title: 'Batman', quantity: 0, size: 'MEDIANO' },
              { title: 'Spider-Man', quantity: -5, size: 'MEDIANO' },
            ],
            paymentMethod: 'EFECTIVO',
            confidence: 0.90,
          }),
        };
      };

      const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.items[0].quantity, 1, 'Quantity 0 must clamp to 1');
      assert.strictEqual(result.items[1].quantity, 1, 'Quantity -5 must clamp to 1');
    });
  });

  // ==========================================================================
  // SECTION 6: ZERO ITEMS WITH NULL IDs UNDER ANY CIRCUMSTANCES
  // ==========================================================================
  describe('6. Absolute Constraint: Zero Items with Null IDs', () => {
    it('6.1 Under multiple adversarial scenarios, NO item with both productId: null AND webPosterId: null ever enters items', async () => {
      const testKey = 'AQ.adv_null_id_guard';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      const adversarialPayloads = [
        // All uncataloged
        [{ title: 'fantasma 1' }, { title: 'fantasma 2' }],
        // Mixed with empty strings
        [{ title: 'Batman', quantity: 1 }, { title: '', quantity: 1 }],
        // Mixed with symbols
        [{ title: 'Spider-Man' }, { title: '@@##$$%%' }, { title: '    ' }],
      ];

      for (const rawItems of adversarialPayloads) {
        client.models.generateContent = async ({ config }) => {
          if (!config?.responseSchema) return { text: 'test' };
          return {
            text: JSON.stringify({
              transcription: 'test payload',
              isSaleDetected: true,
              intent: 'DICTADO_VENTA',
              items: rawItems,
              paymentMethod: 'EFECTIVO',
              confidence: 0.90,
            }),
          };
        };

        const result = await processVoiceSaleAudio({ audioBuffer: dummyAudio, mimeType: 'audio/webm', tenantId: TEST_TENANT });
        for (const item of result.items) {
          assert.ok(
            item.productId !== null || item.webPosterId !== null,
            `VIOLATION DETECTED: Item "${item.description}" has both productId: null and webPosterId: null!`
          );
        }
      }
    });
  });
});
