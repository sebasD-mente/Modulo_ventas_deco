/**
 * ⚔️ CHALLENGER REMEDIATION ROUND 2 — EMPIRICAL BOUNDARY VERIFICATION
 *
 * Explicit empirical verification of boundary behaviors:
 * 1. Multi-word with alias substring + non-catalog tokens (MUST return null)
 * 2. Exact alias queries ("el bati", "conejo malo", "spiderman", "f1") (MUST match accurately)
 * 3. Stopwords ("dos sombreros") (MUST match "Sombrero Tradicional Mexicano")
 * 4. Plurals ("spidermans", "mapas") (MUST match their singular counterparts)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { matchPosterEverywhere } from '../../server/services/catalog/webCatalogService.js';
import { prisma } from '../../server/config/prisma.js';

describe('⚔️ CHALLENGER 2: Empirical Boundary Verification Suite', () => {
  const TEST_TENANT = 't-boundary-eval';

  beforeEach(() => {
    invalidateCatalogCache(TEST_TENANT);

    prisma.auditLog = {
      create: async () => ({ id: 'mock-audit-id' }),
    };
    prisma.product = {
      findMany: async () => [],
      findFirst: async () => null,
    };

    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: [
        {
          id: 'prod-batman',
          titulo: 'Batman The Dark Knight',
          subtitulo: 'El caballero de la noche',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.webp',
          tags: ['batman', 'dc', 'dark', 'knight'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          ],
        },
        {
          id: 'prod-spiderman',
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
          id: 'prod-badbunny',
          titulo: 'Bad Bunny - Un Verano Sin Ti',
          subtitulo: 'Portada de álbum musical',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.webp',
          tags: ['bad', 'bunny', 'un', 'verano', 'sin', 'ti'],
          sizes: [
            { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
        {
          id: 'prod-f1',
          titulo: 'Formula 1 - F1 Red Bull',
          subtitulo: 'Carreras Motorsport F1',
          categoria: 'DEPORTES',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/f1.webp',
          tags: ['f1', 'formula', 'carreras'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
        {
          id: 'prod-sombrero',
          titulo: 'Sombrero Tradicional Mexicano',
          subtitulo: 'Arte y folclore',
          categoria: 'ARTE',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sombrero.webp',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sombrero.webp',
          tags: ['sombrero', 'mexico', 'folclore'],
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          ],
        },
        {
          id: 'prod-mapa',
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
      ],
    });
  });

  // 1. Multi-word with alias substring + non-catalog tokens MUST return null
  describe('Boundary Group 1: Multi-word with alias substring + non-catalog tokens', () => {
    it('"batman pizza sushi" returns null', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'batman pizza sushi');
      assert.strictEqual(result, null, 'Query "batman pizza sushi" must return null');
    });

    it('"spiderman venom carnage symbiote" returns null', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'spiderman venom carnage symbiote');
      assert.strictEqual(result, null, 'Query "spiderman venom carnage symbiote" must return null');
    });

    it('"conejo malo hamburguesa con papas" returns null', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'conejo malo hamburguesa con papas');
      assert.strictEqual(result, null, 'Query "conejo malo hamburguesa con papas" must return null');
    });

    it('"f1 tacos y burritos" returns null', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'f1 tacos y burritos');
      assert.strictEqual(result, null, 'Query "f1 tacos y burritos" must return null');
    });
  });

  // 2. Exact alias queries MUST match accurately
  describe('Boundary Group 2: Exact alias queries', () => {
    it('"el bati" matches Batman The Dark Knight', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'el bati');
      assert.ok(result !== null, '"el bati" must not be null');
      assert.strictEqual(result.posterId, 'prod-batman');
      assert.match(result.description, /Batman/i);
    });

    it('"conejo malo" matches Bad Bunny', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'conejo malo');
      assert.ok(result !== null, '"conejo malo" must not be null');
      assert.strictEqual(result.posterId, 'prod-badbunny');
      assert.match(result.description, /Bad Bunny/i);
    });

    it('"spiderman" matches Spider-Man Vintage Comic', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'spiderman');
      assert.ok(result !== null, '"spiderman" must not be null');
      assert.strictEqual(result.posterId, 'prod-spiderman');
      assert.match(result.description, /Spider-Man/i);
    });

    it('"f1" matches Formula 1', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'f1');
      assert.ok(result !== null, '"f1" must not be null');
      assert.strictEqual(result.posterId, 'prod-f1');
      assert.match(result.description, /Formula 1/i);
    });
  });

  // 3. Stopwords MUST match intended target
  describe('Boundary Group 3: Stopwords stripping and matching', () => {
    it('"dos sombreros" matches Sombrero Tradicional Mexicano', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'dos sombreros');
      assert.ok(result !== null, '"dos sombreros" must not be null');
      assert.strictEqual(result.posterId, 'prod-sombrero');
      assert.match(result.description, /Sombrero Tradicional/i);
    });

    it('"tres mapas" matches Mapa del Mundo Vintage', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'tres mapas');
      assert.ok(result !== null, '"tres mapas" must not be null');
      assert.strictEqual(result.posterId, 'prod-mapa');
      assert.match(result.description, /Mapa del Mundo/i);
    });

    it('"un poster de batman" matches Batman The Dark Knight', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'un poster de batman');
      assert.ok(result !== null, '"un poster de batman" must not be null');
      assert.strictEqual(result.posterId, 'prod-batman');
      assert.match(result.description, /Batman/i);
    });
  });

  // 4. Plurals MUST match their singular counterparts
  describe('Boundary Group 4: Plurals stemming and matching', () => {
    it('"spidermans" matches Spider-Man Vintage Comic', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'spidermans');
      assert.ok(result !== null, '"spidermans" must not be null');
      assert.strictEqual(result.posterId, 'prod-spiderman');
      assert.match(result.description, /Spider-Man/i);
    });

    it('"mapas" matches Mapa del Mundo Vintage', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'mapas');
      assert.ok(result !== null, '"mapas" must not be null');
      assert.strictEqual(result.posterId, 'prod-mapa');
      assert.match(result.description, /Mapa del Mundo/i);
    });

    it('"sombreros" matches Sombrero Tradicional Mexicano', async () => {
      const result = await matchPosterEverywhere(TEST_TENANT, 'sombreros');
      assert.ok(result !== null, '"sombreros" must not be null');
      assert.strictEqual(result.posterId, 'prod-sombrero');
      assert.match(result.description, /Sombrero Tradicional/i);
    });
  });
});
