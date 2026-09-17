/**
 * ⚔️ CHALLENGER 1 — ADVERSARIAL EMPIRICAL TEST SUITE (Milestone 3)
 *
 * Rigorous empirical stress-testing for Backend Voice & Search reengineering:
 * 1. Single-token queries in searchWebPosters (e.g. "mundo" must NEVER match Bad Bunny)
 * 2. Cultural entity alias resolution in matchPosterEverywhere ("conejo malo", "batman", "spiderman", "f1")
 * 3. Greeting & non-sale audio intent classification in processVoiceSaleAudio ("Hola", "Buenos días")
 * 4. Resilient error handling and fallback when Gemini models fail or throw exceptions
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { searchWebPosters } from '../../server/services/webCatalogService.js';
import { matchPosterEverywhere, processVoiceSaleAudio } from '../../server/services/ai/aiMediaService.js';
import { voiceSaleResponseSchema } from '../../server/services/ai/aiPromptService.js';
import { ENV } from '../../server/config/env.js';
import { getClientForKey } from '../../server/services/ai/aiKeyPoolService.js';

describe('⚔️ CHALLENGER 1: Empirical Adversarial Suite — Milestone 3 Backend Voice & Search', () => {
  const TEST_TENANT = 't-challenger-m3-eval';
  const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....fake-audio');

  beforeEach(() => {
    invalidateCatalogCache(TEST_TENANT);
  });

  // ==========================================================================
  // CHALLENGE 1: Single-Token Query Isolation in searchWebPosters
  // ==========================================================================
  describe('1. Single-Token Query Isolation & Relevance Protection', () => {
    beforeEach(() => {
      productCache.set(TEST_TENANT, {
        timestamp: Date.now(),
        products: [
          {
            id: 'poster-bb',
            titulo: 'Bad Bunny - Un Verano Sin Ti',
            subtitulo: 'Portada de álbum musical',
            categoria: 'MUSICA',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
            tags: ['bad', 'bunny', 'verano', 'mundo', 'musica', 'album', 'el mundo es nuestro'],
            sizes: [
              { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 },
              { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            ],
          },
          {
            id: 'poster-mapa',
            titulo: 'Mapa del Mundo Vintage',
            subtitulo: 'Cartografía náutica antigua',
            categoria: 'VINTAGE',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/mapa.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/mapa.webp',
            tags: ['mapa', 'mundo', 'vintage', 'tierra', 'globo'],
            sizes: [
              { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
              { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
            ],
          },
          {
            id: 'poster-batman',
            titulo: 'Batman The Dark Knight',
            subtitulo: 'El caballero de la noche',
            categoria: 'SUPERHEROES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
            tags: ['batman', 'dc', 'comics', 'dark', 'knight', 'mundo sombrio'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
          {
            id: 'poster-spiderman',
            titulo: 'Spider-Man Vintage Comic',
            subtitulo: 'Marvel Comics retro',
            categoria: 'SUPERHEROES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
            tags: ['spiderman', 'marvel', 'comics', 'arana'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
          {
            id: 'poster-formula1',
            titulo: 'Formula 1 - Gran Premio Red Bull',
            subtitulo: 'Carreras Motorsport',
            categoria: 'DEPORTES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
            tags: ['f1', 'formula1', 'carreras', 'redbull', 'verstappen'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
        ],
      });
    });

    it('1.1 Single-token query "mundo" matches "Mapa del Mundo Vintage" and NEVER matches Bad Bunny or Batman', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'mundo' });
      assert.ok(Array.isArray(results), 'Must return array of results');
      const matchedIds = results.map((r) => r.id);

      // Must include poster that has "Mundo" in its title
      assert.ok(matchedIds.includes('poster-mapa'), 'Must match "Mapa del Mundo Vintage"');

      // Must NOT include Bad Bunny or Batman even though "mundo" is present in tags
      assert.ok(!matchedIds.includes('poster-bb'), 'CRITICAL: "mundo" must NOT match Bad Bunny!');
      assert.ok(!matchedIds.includes('poster-batman'), 'CRITICAL: "mundo" must NOT match Batman!');
      assert.ok(!matchedIds.includes('poster-spiderman'), 'Must NOT match Spider-Man');
      assert.ok(!matchedIds.includes('poster-formula1'), 'Must NOT match Formula 1');
    });

    it('1.2 Single-token query "verano" matches Bad Bunny (has "Verano" in title)', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'verano' });
      const matchedIds = results.map((r) => r.id);
      assert.ok(matchedIds.includes('poster-bb'), 'Should match Bad Bunny because title contains "Verano"');
      assert.ok(!matchedIds.includes('poster-mapa'), 'Should not match Mapa del Mundo');
    });

    it('1.3 Single-token query with non-existent keyword returns empty array', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'incongruente999xyz' });
      assert.strictEqual(results.length, 0, 'Must return empty array for nonexistent token');
    });

    it('1.4 Single-token query with uppercase/accents ("MÚNDO") normalizes and matches title correctly', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: '  MÚNDO  ' });
      const matchedIds = results.map((r) => r.id);
      assert.ok(matchedIds.includes('poster-mapa'), 'Accented "MÚNDO" must match "Mapa del Mundo Vintage"');
      assert.ok(!matchedIds.includes('poster-bb'), 'Accented "MÚNDO" must NOT match Bad Bunny');
    });
  });

  // ==========================================================================
  // CHALLENGE 2: Cultural Entity Alias Resolution in matchPosterEverywhere
  // ==========================================================================
  describe('2. Cultural Entity Alias Resolution in matchPosterEverywhere', () => {
    beforeEach(() => {
      productCache.set(TEST_TENANT, {
        timestamp: Date.now(),
        products: [
          {
            id: 'bb-un-verano',
            titulo: 'Bad Bunny - Un Verano Sin Ti',
            subtitulo: 'Portada de álbum musical',
            categoria: 'MUSICA',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
            tags: ['bad', 'bunny', 'un', 'verano', 'sin', 'ti', 'conejo'],
            sizes: [
              { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 },
              { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
            ],
          },
          {
            id: 'batman-dark-knight',
            titulo: 'Batman - The Dark Knight',
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
            id: 'spiderman-vintage',
            titulo: 'Spider-Man Vintage Comic',
            subtitulo: 'Marvel Comics retro',
            categoria: 'SUPERHEROES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
            tags: ['spiderman', 'spider-man', 'marvel'],
            sizes: [
              { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
              { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
            ],
          },
          {
            id: 'formula1-gp',
            titulo: 'Formula 1 - F1 Red Bull',
            subtitulo: 'Carreras F1',
            categoria: 'DEPORTES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
            tags: ['f1', 'formula', 'carreras'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 }],
          },
        ],
      });
    });

    it('2.1 Cultural alias "conejo malo" resolves to Bad Bunny', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'conejo malo');
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.posterId, 'bb-un-verano');
      assert.match(result.description, /Bad Bunny/i);
    });

    it('2.2 Cultural alias "el conejo malo" resolves to Bad Bunny with default or requested size', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'el conejo malo', 'portada');
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.posterId, 'bb-un-verano');
      assert.strictEqual(result.sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(result.unitPrice, 55);
    });

    it('2.3 Cultural alias "batman" resolves to Batman The Dark Knight', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'batman', 'grande');
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.posterId, 'batman-dark-knight');
      assert.match(result.description, /Batman/i);
      assert.strictEqual(result.sizeId, 'GRANDE');
      assert.strictEqual(result.unitPrice, 125);
    });

    it('2.4 Cultural alias "spiderman" resolves to Spider-Man Vintage Comic', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'spiderman', 'pequeño');
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.posterId, 'spiderman-vintage');
      assert.match(result.description, /Spider-Man/i);
      assert.strictEqual(result.sizeId, 'PEQUENO');
      assert.strictEqual(result.unitPrice, 35);
    });

    it('2.5 Short entity alias "f1" resolves to Formula 1 without being dropped by token filters', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'f1');
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.posterId, 'formula1-gp');
      assert.match(result.description, /Formula 1/i);
    });
  });

  // ==========================================================================
  // CHALLENGE 3: Greeting Classification & Zero-Draft Contract
  // ==========================================================================
  describe('3. Greeting Classification and Zero-Draft Contract in processVoiceSaleAudio', () => {
    it('3.1 Audio containing greeting "Hola" returns isSaleDetected: false, intent: SALUDO, items: []', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.test_greeting_key';
      const client = getClientForKey('AQ.test_greeting_key');

      // STT returns greeting
      let callCount = 0;
      client.models.generateContent = async ({ config }) => {
        callCount++;
        if (!config?.responseSchema) {
          // STT phase
          return { text: '¡Hola buenas tardes! ¿Cómo están?' };
        }
        // NLU phase with schema
        return {
          text: JSON.stringify({
            transcription: '¡Hola buenas tardes! ¿Cómo están?',
            isSaleDetected: false,
            intent: 'SALUDO',
            greeting: '¡Hola! Todo excelente en el stand. ¿Qué póster o venta preparamos hoy?',
            items: [],
            paymentMethod: 'EFECTIVO',
            confidence: 0.98,
          }),
        };
      };

      const result = await processVoiceSaleAudio({
        audioBuffer: dummyAudio,
        mimeType: 'audio/webm',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(result.isSaleDetected, false, 'isSaleDetected must be strictly false');
      assert.strictEqual(result.intent, 'SALUDO', 'intent must be strictly SALUDO');
      assert.ok(Array.isArray(result.items), 'items must be an array');
      assert.strictEqual(result.items.length, 0, 'items array must be strictly empty');
      assert.strictEqual(result.total, 0, 'total must be 0');
      assert.ok(result.greeting, 'greeting message must be present');
      assert.match(result.greeting, /Hola/i);
    });

    it('3.2 Audio containing "Buenos días" returns isSaleDetected: false, intent: SALUDO, items: []', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.test_greeting_key_2';
      const client = getClientForKey('AQ.test_greeting_key_2');

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) {
          return { text: 'Buenos días amigos' };
        }
        return {
          text: JSON.stringify({
            transcription: 'Buenos días amigos',
            isSaleDetected: false,
            intent: 'SALUDO',
            greeting: '¡Buenos días! Con gusto te apoyo en el mostrador.',
            items: [],
            confidence: 0.95,
          }),
        };
      };

      const result = await processVoiceSaleAudio({
        audioBuffer: dummyAudio,
        mimeType: 'audio/webm',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(result.isSaleDetected, false);
      assert.strictEqual(result.intent, 'SALUDO');
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.total, 0);
    });

    it('3.3 Actual sale dictation "1 Batman mediano en efectivo" returns isSaleDetected: true, intent: DICTADO_VENTA', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.test_sale_dictation';
      const client = getClientForKey('AQ.test_sale_dictation');

      // Mock catalog product in cache
      productCache.set(TEST_TENANT, {
        timestamp: Date.now(),
        products: [
          {
            id: 'batman-dark-knight',
            titulo: 'Batman The Dark Knight',
            subtitulo: 'El caballero de la noche',
            categoria: 'SUPERHEROES',
            imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
            thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
            tags: ['batman', 'dark', 'knight'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 }],
          },
        ],
      });

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) {
          return { text: '1 Batman mediano en efectivo' };
        }
        return {
          text: JSON.stringify({
            transcription: '1 Batman mediano en efectivo',
            isSaleDetected: true,
            intent: 'DICTADO_VENTA',
            items: [
              {
                title: 'Batman',
                size: 'MEDIANO',
                quantity: 1,
                unitPrice: 65,
              },
            ],
            paymentMethod: 'EFECTIVO',
            confidence: 0.99,
          }),
        };
      };

      const result = await processVoiceSaleAudio({
        audioBuffer: dummyAudio,
        mimeType: 'audio/webm',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(result.isSaleDetected, true);
      assert.strictEqual(result.intent, 'DICTADO_VENTA');
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].unitPrice, 65);
      assert.strictEqual(result.total, 65);
      assert.strictEqual(result.paymentMethod, 'EFECTIVO');
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Error Handling & Fallback Behavior on Model Failures
  // ==========================================================================
  describe('4. Error Handling and Gemini Fallback Resilience', () => {
    it('4.1 When STT fails with 429 Rate Limit, processVoiceSaleAudio throws structured AI_MEDIA_SERVICE_FAILED', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.err_key_429';
      const client = getClientForKey('AQ.err_key_429');

      client.models.generateContent = async () => {
        const err = new Error('Resource exhausted (429)');
        err.status = 429;
        throw err;
      };

      await assert.rejects(
        async () => {
          await processVoiceSaleAudio({
            audioBuffer: dummyAudio,
            mimeType: 'audio/webm',
            tenantId: TEST_TENANT,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
          assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
          return true;
        }
      );
    });

    it('4.2 When NLU returns invalid JSON, processVoiceSaleAudio throws structured AI_MEDIA_SERVICE_FAILED', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.err_key_bad_json';
      const client = getClientForKey('AQ.err_key_bad_json');

      client.models.generateContent = async ({ config }) => {
        if (!config?.responseSchema) {
          return { text: 'Transcribed text ok' };
        }
        return { text: 'MALFORMED_NON_JSON_RESPONSE' };
      };

      await assert.rejects(
        async () => {
          await processVoiceSaleAudio({
            audioBuffer: dummyAudio,
            mimeType: 'audio/webm',
            tenantId: TEST_TENANT,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
          return true;
        }
      );
    });
  });
});
