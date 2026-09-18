/**
 * ⚔️ CHALLENGER 2 — ADVERSARIAL EMPIRICAL STRESS TEST SUITE
 * 
 * Domain: Catalog Matcher & Vision Artwork Certainty
 * Roles: critic, specialist (Empirical Challenger)
 * 
 * Objectives:
 * 1. Single-word queries: "mundo", "sombrero", "street", "live", "vintage", "retro"
 *    -> Must NOT match unrelated posters whose tags contain these words.
 * 2. Multi-word queries with < 70% token coverage -> MUST reject.
 * 3. Stopword and plural edge cases: "dos sombreros", "las fotos", "olivia uña" vs "olivia rodrigo".
 * 4. Non-catalog or uncataloged artwork image recognition (or low confidence <0.60):
 *    -> Must return isArtworkDetected: false, draftSale: null, items: [], exact seller rejection message.
 * 5. Valid catalog artworks: must recognize accurately without false negatives.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { matchPosterEverywhere } from '../../server/services/catalog/webCatalogService.js';
import { recognizePosterArtworkFromImage } from '../../server/services/ai/aiMediaService.js';
import { handleArtworkRecognition } from '../../server/controllers/ai/aiMediaController.js';
import { prisma } from '../../server/config/prisma.js';
import { ENV } from '../../server/config/env.js';
import { getClientForKey, resetKeyPool } from '../../server/services/ai/aiKeyPoolService.js';

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

const EXACT_REJECTION_MESSAGE = 'La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo.';

describe('⚔️ CHALLENGER 2: Empirical Stress Test — Catalog Matcher & Vision Certainty', () => {
  const TEST_TENANT = 't-challenger2-eval';
  const dummyImage = Buffer.from('FAKE_IMAGE_BYTES_FOR_ADVERSARIAL_TEST');

  beforeEach(() => {
    resetKeyPool();
    invalidateCatalogCache(TEST_TENANT);

    // Mock prisma to avoid remote connection errors in auditLog or product queries
    prisma.auditLog = {
      create: async () => ({ id: 'mock-audit-id' }),
    };
    prisma.product = {
      findMany: async () => [],
      findFirst: async () => null,
    };

    // Populate catalog with both bait posters (having controversial tags) and genuine target posters
    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: [
        {
          id: '8a1b2c3d-0001-4000-8000-000000000001',
          titulo: 'Bad Bunny - Un Verano Sin Ti',
          subtitulo: 'Portada de álbum musical',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          // BAIT TAGS: contains all single-word challenge tokens!
          tags: ['bad', 'bunny', 'mundo', 'sombrero', 'street', 'live', 'vintage', 'retro', 'musica', 'album'],
          sizes: [
            { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
        {
          id: '8a1b2c3d-0002-4000-8000-000000000002',
          titulo: 'Batman The Dark Knight',
          subtitulo: 'El caballero de la noche',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          // BAIT TAGS: also contains challenge tokens
          tags: ['batman', 'dc', 'dark', 'knight', 'mundo', 'sombrero', 'street', 'live', 'vintage', 'retro'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          ],
        },
        {
          id: '8a1b2c3d-0003-4000-8000-000000000003',
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
          id: '8a1b2c3d-0004-4000-8000-000000000004',
          titulo: 'Sombrero Tradicional Mexicano',
          subtitulo: 'Arte y folclore',
          categoria: 'ARTE',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sombrero.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sombrero.webp',
          tags: ['sombrero', 'mexico', 'folclore'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
        {
          id: '8a1b2c3d-0005-4000-8000-000000000005',
          titulo: 'Street Fighter II Arcade',
          subtitulo: 'Videojuego de peleas clásico',
          categoria: 'GAMING',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/street.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/street.webp',
          tags: ['street', 'fighter', 'arcade', 'capcom'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
        {
          id: '8a1b2c3d-0006-4000-8000-000000000006',
          titulo: 'Live at Wembley Queen',
          subtitulo: 'Concierto histórico de rock',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/queen_live.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/queen_live.webp',
          tags: ['live', 'queen', 'wembley', 'rock'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
        {
          id: '8a1b2c3d-0007-4000-8000-000000000007',
          titulo: 'Retro Gaming Arcade 80s',
          subtitulo: 'Consolas y salones retro',
          categoria: 'GAMING',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/retro.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/retro.webp',
          tags: ['retro', 'gaming', 'arcade', '80s'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
        {
          id: '8a1b2c3d-0008-4000-8000-000000000008',
          titulo: 'Spider-Man Vintage Comic',
          subtitulo: 'Marvel Comics retro',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/spiderman.webp',
          tags: ['spiderman', 'spider-man', 'marvel'],
          sizes: [
            { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
        {
          id: '8a1b2c3d-0009-4000-8000-000000000009',
          titulo: 'Vincent van Gogh - La Noche Estrellada',
          subtitulo: 'Impresionismo clásico',
          categoria: 'ARTE',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/starry.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/starry.webp',
          tags: ['van gogh', 'noche', 'estrellada', 'arte', 'cuadro'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          ],
        },
        {
          id: '8a1b2c3d-0010-4000-8000-000000000010',
          titulo: 'Olivia Rodrigo - Sour',
          subtitulo: 'Portada de álbum musical',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/olivia.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/olivia.webp',
          tags: ['olivia', 'rodrigo', 'sour', 'musica', 'album'],
          sizes: [{ sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 }],
        },
      ],
    });
  });

  // ==========================================================================
  // CHALLENGE 1: Single-Word Query Precision vs Bait Tags
  // ==========================================================================
  describe('1. Adversarial Challenge: Single-Word Query Isolation vs Bait Tags', () => {
    it('1.1 Query "mundo" matches "Mapa del Mundo Vintage" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'mundo');
      assert.ok(match !== null, 'Should match a poster');
      assert.strictEqual(match.posterId, '8a1b2c3d-0003-4000-8000-000000000003', 'Must match Mapa del Mundo Vintage');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.2 Query "sombrero" matches "Sombrero Tradicional Mexicano" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'sombrero');
      assert.ok(match !== null, 'Should match a poster');
      assert.strictEqual(match.posterId, '8a1b2c3d-0004-4000-8000-000000000004', 'Must match Sombrero Tradicional');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.3 Query "street" matches "Street Fighter II Arcade" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'street');
      assert.ok(match !== null, 'Should match a poster');
      assert.strictEqual(match.posterId, '8a1b2c3d-0005-4000-8000-000000000005', 'Must match Street Fighter');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.4 Query "live" matches "Live at Wembley Queen" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'live');
      assert.ok(match !== null, 'Should match a poster');
      assert.strictEqual(match.posterId, '8a1b2c3d-0006-4000-8000-000000000006', 'Must match Live at Wembley');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.5 Query "vintage" matches "Mapa del Mundo Vintage" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'vintage');
      assert.ok(match !== null, 'Should match a poster');
      assert.ok(
        match.posterId === '8a1b2c3d-0003-4000-8000-000000000003' || match.posterId === '8a1b2c3d-0008-4000-8000-000000000008',
        'Must match poster with vintage in title (Mapa del Mundo or Spider-Man Vintage)'
      );
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.6 Query "retro" matches "Retro Gaming Arcade 80s" and NEVER matches Bad Bunny or Batman', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'retro');
      assert.ok(match !== null, 'Should match a poster');
      assert.strictEqual(match.posterId, '8a1b2c3d-0007-4000-8000-000000000007', 'Must match Retro Gaming Arcade');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'CRITICAL: Must NEVER match Bad Bunny');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0002-4000-8000-000000000002', 'CRITICAL: Must NEVER match Batman');
    });

    it('1.7 When no poster has single token in title, matching solely on tags returns null', async () => {
      // Create isolated catalog with only Bad Bunny (which has tag 'sombrero' but not in title)
      const ISOLATED_TENANT = 't-isolated-single-token';
      productCache.set(ISOLATED_TENANT, {
        timestamp: Date.now(),
        products: [
          {
            id: 'poster-only-bb',
            titulo: 'Bad Bunny - Un Verano Sin Ti',
            subtitulo: 'Portada de álbum musical',
            categoria: 'MUSICA',
            imageUrl: 'https://example.com/bb.webp',
            tags: ['sombrero', 'street', 'live', 'retro'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
        ],
      });

      const matchSombrero = await matchPosterEverywhere(ISOLATED_TENANT, 'sombrero');
      assert.strictEqual(matchSombrero, null, 'Single-token "sombrero" must return null when only in tags');

      const matchStreet = await matchPosterEverywhere(ISOLATED_TENANT, 'street');
      assert.strictEqual(matchStreet, null, 'Single-token "street" must return null when only in tags');

      const matchLive = await matchPosterEverywhere(ISOLATED_TENANT, 'live');
      assert.strictEqual(matchLive, null, 'Single-token "live" must return null when only in tags');

      const matchRetro = await matchPosterEverywhere(ISOLATED_TENANT, 'retro');
      assert.strictEqual(matchRetro, null, 'Single-token "retro" must return null when only in tags');
    });
  });

  // ==========================================================================
  // CHALLENGE 2: Multi-Word Queries with < 70% Token Coverage Must Reject
  // ==========================================================================
  describe('2. Adversarial Challenge: Multi-Word Token Coverage (< 70% Rejection)', () => {
    it('2.1 3-word query with 1 match (33.3% < 70%) returns null', async () => {
      // Query: "batman pizza sushi" -> significant: ['batman', 'pizza', 'sushi'] -> 1/3 match
      const match = await matchPosterEverywhere(TEST_TENANT, 'batman pizza sushi');
      assert.strictEqual(match, null, 'Must reject when token coverage is only 33% (1/3)');
    });

    it('2.2 3-word query with 2 matches (66.7% < 70%) returns null (CRITICAL BOUNDARY TEST)', async () => {
      // Query: "batman dark superman" -> significant: ['batman', 'dark', 'superman'] (3 tokens)
      // "Batman The Dark Knight" contains 'batman' and 'dark', but NOT 'superman'.
      // Coverage is 2/3 = 66.67%. Since 66.67% < 70%, it MUST reject!
      const match = await matchPosterEverywhere(TEST_TENANT, 'batman dark superman');
      assert.strictEqual(
        match,
        null,
        'CRITICAL: 66.7% coverage (2/3) must be strictly rejected by the >= 70% threshold'
      );
    });

    it('2.3 4-word query with 2 matches (50.0% < 70%) returns null', async () => {
      // Query: "spiderman venom carnage symbiote" -> 4 tokens, only 'spiderman' matches
      const match = await matchPosterEverywhere(TEST_TENANT, 'spiderman venom carnage symbiote');
      assert.strictEqual(match, null, 'Must reject when coverage is 50% or less (2/4)');
    });

    it('2.4 5-word query with 3 matches (60.0% < 70%) returns null', async () => {
      // Candidate: "Vincent van Gogh - La Noche Estrellada"
      // Query: "van gogh noche luna brillante" -> tokens: ['van', 'gogh', 'noche', 'luna', 'brillante'] (5 tokens)
      // Matched: 'van', 'gogh', 'noche' (3 tokens) -> 3/5 = 60.0% < 70% -> REJECT
      const match = await matchPosterEverywhere(TEST_TENANT, 'van gogh noche luna brillante');
      assert.strictEqual(match, null, 'Must reject when token coverage is 60% (3/5)');
    });

    it('2.5 Query with franchise term absent from candidate is rejected even if other tokens match', async () => {
      // Query: "spiderman mapa vintage" -> contains franchise 'spiderman'
      // Candidate: "Mapa del Mundo Vintage" contains 'mapa' and 'vintage', but NOT 'spiderman'
      const match = await matchPosterEverywhere(TEST_TENANT, 'spiderman mapa vintage');
      assert.strictEqual(
        match,
        null,
        'Must reject when key franchise term (Spider-Man) is missing from candidate title'
      );
    });

    it('2.6 Multi-word query with >= 70% coverage is accepted (positive control)', async () => {
      // Candidate: "Batman The Dark Knight"
      // Query: "batman dark knight" -> tokens: ['batman', 'dark', 'knight'] (3/3 = 100% >= 70%)
      const match100 = await matchPosterEverywhere(TEST_TENANT, 'batman dark knight');
      assert.ok(match100 !== null, 'Must match 100% coverage');
      assert.strictEqual(match100.posterId, '8a1b2c3d-0002-4000-8000-000000000002');

      // Query: "batman dark knight comic" -> 4 tokens, 3 match (75% >= 70%)
      const match75 = await matchPosterEverywhere(TEST_TENANT, 'batman dark knight comic');
      assert.ok(match75 !== null, 'Must match 75% coverage (3/4)');
      assert.strictEqual(match75.posterId, '8a1b2c3d-0002-4000-8000-000000000002');
    });
  });

  // ==========================================================================
  // CHALLENGE 3: Stopword and Plural Edge Cases
  // ==========================================================================
  describe('3. Adversarial Challenge: Stopword and Plural Edge Cases', () => {
    it('3.1 "dos sombreros" strips stopword "dos", stems "sombreros" to "sombrero", and matches Sombrero Tradicional', async () => {
      const match = await matchPosterEverywhere(TEST_TENANT, 'dos sombreros');
      assert.ok(match !== null, 'Should match Sombrero Tradicional');
      assert.strictEqual(match.posterId, '8a1b2c3d-0004-4000-8000-000000000004');
      assert.notStrictEqual(match.posterId, '8a1b2c3d-0001-4000-8000-000000000001', 'Must not match Bad Bunny');
    });

    it('3.2 "las fotos" contains exclusively stopwords and returns null immediately', async () => {
      // "las" and "fotos" are both in EXTENDED_STOP_WORDS -> significantTokens.length === 0
      const match = await matchPosterEverywhere(TEST_TENANT, 'las fotos');
      assert.strictEqual(match, null, 'Pure stopword query "las fotos" must strictly return null');
    });

    it('3.3 Pure stopword combinations ("los cuadros", "un poster", "el diseno") all return null', async () => {
      assert.strictEqual(await matchPosterEverywhere(TEST_TENANT, 'los cuadros'), null);
      assert.strictEqual(await matchPosterEverywhere(TEST_TENANT, 'un poster'), null);
      assert.strictEqual(await matchPosterEverywhere(TEST_TENANT, 'el diseno'), null);
      assert.strictEqual(await matchPosterEverywhere(TEST_TENANT, 'de la en con'), null);
    });

    it('3.4 "olivia uña" vs "olivia rodrigo": preserves "ñ", rejects "olivia uña" and accepts "olivia rodrigo"', async () => {
      // Query "olivia uña": "uña" is NOT stripped to "una".
      // Significant tokens: ['olivia', 'uña'] (2 tokens).
      // Candidate: "Olivia Rodrigo - Sour". Only 'olivia' matches (1/2 = 50% < 70%).
      // Result: MUST RETURN NULL!
      const matchUnia = await matchPosterEverywhere(TEST_TENANT, 'olivia uña');
      assert.strictEqual(
        matchUnia,
        null,
        'CRITICAL: "olivia uña" must NOT falsely match Olivia Rodrigo (uña != stopword una)'
      );

      // Query "olivia rodrigo": tokens ['olivia', 'rodrigo'] (2/2 = 100% >= 70%).
      // Result: MUST MATCH Olivia Rodrigo!
      const matchRodrigo = await matchPosterEverywhere(TEST_TENANT, 'olivia rodrigo');
      assert.ok(matchRodrigo !== null, '"olivia rodrigo" must match Olivia Rodrigo');
      assert.strictEqual(matchRodrigo.posterId, '8a1b2c3d-0010-4000-8000-000000000010');
      assert.match(matchRodrigo.description, /Olivia Rodrigo/i);
    });

    it('3.5 Plural stemming matches accurately: "spidermans" and "mapas"', async () => {
      const matchSpider = await matchPosterEverywhere(TEST_TENANT, 'spidermans');
      assert.ok(matchSpider !== null);
      assert.strictEqual(matchSpider.posterId, '8a1b2c3d-0008-4000-8000-000000000008');

      const matchMapas = await matchPosterEverywhere(TEST_TENANT, 'mapas');
      assert.ok(matchMapas !== null);
      assert.strictEqual(matchMapas.posterId, '8a1b2c3d-0003-4000-8000-000000000003');
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Non-Catalog / Low-Confidence Artwork Recognition
  // ==========================================================================
  describe('4. Adversarial Challenge: Non-Catalog Artwork & Low-Confidence Certainty Gate', () => {
    it('4.1 Low confidence (< 0.60, e.g. 0.59) triggers immediate rejection with exact message', async () => {
      const testKey = 'AQ.test_low_confidence_59';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Batman The Dark Knight',
          visualAnalysis: 'Póster borroso o con reflejos',
          confidence: 0.59, // Strictly below 0.60
          suggestedSize: 'MEDIANO',
          candidates: ['Batman'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'isArtworkDetected must be strictly false');
      assert.strictEqual(res.draftSale, null, 'draftSale must be strictly null');
      assert.strictEqual(res.items.length, 0, 'items must be empty array');
      assert.strictEqual(res.total, 0, 'total must be 0');
      assert.strictEqual(res.matchedPoster, null, 'matchedPoster must be null');
      assert.strictEqual(res.message, EXACT_REJECTION_MESSAGE, 'Must match exact rejection message');
    });

    it('4.2 Very low confidence (0.25) triggers rejection with exact message', async () => {
      const testKey = 'AQ.test_low_confidence_25';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Objeto desconocido',
          visualAnalysis: 'Foto oscura sin arte distinguible',
          confidence: 0.25,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
      assert.strictEqual(res.total, 0);
      assert.strictEqual(res.message, EXACT_REJECTION_MESSAGE);
    });

    it('4.3 Non-catalog artwork with high confidence ("Neon Cyber Lobster") does NOT force nearest neighbor and rejects', async () => {
      const testKey = 'AQ.test_non_catalog_lobster';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      // Gemini is 95% confident it is a "Neon Cyber Lobster", which does NOT exist in catalog
      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Neon Cyber Lobster',
          franchiseOrCategory: 'CYBERPUNK',
          visualAnalysis: 'Una langosta cibernética brillante con luces de neón en fondo negro',
          confidence: 0.95,
          suggestedSize: 'MEDIANO',
          candidates: ['Neon Cyber Lobster', 'Cyberpunk Lobster'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'Non-catalog artwork must not be detected');
      assert.strictEqual(res.draftSale, null, 'Must NOT create draft sale for non-catalog artwork');
      assert.strictEqual(res.items.length, 0, 'Must not return items');
      assert.strictEqual(res.total, 0, 'Total must be 0');
      assert.strictEqual(res.matchedPoster, null, 'matchedPoster must be null (no nearest neighbor fallback!)');
      assert.strictEqual(res.message, EXACT_REJECTION_MESSAGE);
    });

    it('4.4 Blank or generic visual detection (empty title) rejects cleanly', async () => {
      const testKey = 'AQ.test_blank_detection';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: '',
          franchiseOrCategory: '',
          visualAnalysis: 'Pared blanca sin pósters',
          confidence: 0.70,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
      assert.strictEqual(res.message, EXACT_REJECTION_MESSAGE);
    });

    it('4.5 Controller (handleArtworkRecognition) returns HTTP 200 with draftSale: null and exact message on rejection', async () => {
      const testKey = 'AQ.test_controller_rejection';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Tenedor de cocina sobre mantel',
          visualAnalysis: 'Utensilio de cocina',
          confidence: 0.92,
        }),
      });

      const req = {
        file: { buffer: dummyImage, originalname: 'fork.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'event-adversarial-1' },
        tenantId: TEST_TENANT,
      };
      const res = createMockRes();

      await handleArtworkRecognition(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.isArtworkDetected, false);
      assert.strictEqual(res.body.draftSale, null, 'Controller must emit draftSale: null');
      assert.strictEqual(res.body.message, EXACT_REJECTION_MESSAGE);
    });
  });

  // ==========================================================================
  // CHALLENGE 5: Valid Catalog Artworks Recognized Accurately
  // ==========================================================================
  describe('5. Adversarial Challenge: Valid Catalog Artworks Precision (Zero False Negatives)', () => {
    it('5.1 Accurately recognizes classic artwork "La Noche Estrellada" (Van Gogh)', async () => {
      const testKey = 'AQ.test_valid_starry_night';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'La Noche Estrellada',
          franchiseOrCategory: 'ARTE',
          visualAnalysis: 'Pintura al óleo de Van Gogh con cielo en espiral azul y amarillo',
          confidence: 0.98,
          suggestedSize: 'MEDIANO',
          candidates: ['La Noche Estrellada', 'Starry Night'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'isArtworkDetected must be true');
      assert.ok(res.draftSale !== null, 'draftSale must not be null');
      assert.strictEqual(res.items.length, 1, 'items must have 1 element');
      assert.strictEqual(res.items[0].sizeId, 'MEDIANO', 'sizeId must be MEDIANO');
      assert.strictEqual(res.items[0].unitPrice, 65, 'Price must be 65');
      assert.match(res.items[0].description, /Noche Estrellada/i);
      assert.ok(res.items[0].productId || res.items[0].webPosterId, 'Must have catalog ID');
      assert.strictEqual(res.draftSale.inputChannel, 'IA_FOTO_ARTE');
      assert.match(res.message, /Obra analizada y encontrada/i);
    });

    it('5.2 Accurately recognizes superhero artwork "Batman The Dark Knight"', async () => {
      const testKey = 'AQ.test_valid_batman';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Batman',
          franchiseOrCategory: 'SUPERHEROES',
          visualAnalysis: 'Póster de Batman The Dark Knight en ciudad gótica',
          confidence: 0.96,
          suggestedSize: 'GRANDE',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, true);
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.match(res.items[0].description, /Batman/i);
      assert.strictEqual(res.items[0].sizeId, 'GRANDE');
      assert.strictEqual(res.items[0].unitPrice, 125);
    });

    it('5.3 Accurately recognizes music album "Bad Bunny - Un Verano Sin Ti" with PORTADA_ALBUM size', async () => {
      const testKey = 'AQ.test_valid_bad_bunny';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Un Verano Sin Ti',
          franchiseOrCategory: 'MUSICA',
          visualAnalysis: 'Corazón triste con ojos sobre playa portada de Bad Bunny',
          confidence: 0.97,
          suggestedSize: 'PORTADA_ALBUM',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TEST_TENANT,
      });

      assert.strictEqual(res.isArtworkDetected, true);
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(res.items[0].unitPrice, 55);
      assert.match(res.items[0].description, /Bad Bunny/i);
    });

    it('5.4 Controller (handleArtworkRecognition) produces complete valid draftSale on match', async () => {
      const testKey = 'AQ.test_controller_valid_artwork';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Spider-Man',
          franchiseOrCategory: 'SUPERHEROES',
          visualAnalysis: 'Póster de cómic vintage de Spider-Man',
          confidence: 0.99,
          suggestedSize: 'PEQUENO',
        }),
      });

      const req = {
        file: { buffer: dummyImage, originalname: 'spiderman.jpg', mimetype: 'image/jpeg' },
        body: { eventId: 'event-adversarial-1' },
        tenantId: TEST_TENANT,
      };
      const res = createMockRes();

      await handleArtworkRecognition(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.isArtworkDetected, true);
      assert.ok(res.body.draftSale !== null);
      assert.strictEqual(res.body.draftSale.items.length, 1);
      assert.strictEqual(res.body.draftSale.inputChannel, 'IA_FOTO_ARTE');
      assert.strictEqual(res.body.draftSale.items[0].sizeId, 'PEQUENO');
      assert.strictEqual(res.body.draftSale.items[0].unitPrice, 35);
      assert.match(res.body.message, /Obra analizada y encontrada/i);
    });
  });
});
