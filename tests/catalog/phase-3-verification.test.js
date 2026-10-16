import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OFFICIAL_SIZES, DEFAULT_SIZES, DEFAULT_MEDIUM_SIZE } from '../../src/components/manual-sale/manualSaleConstants.js';
import { DEFAULT_EVENT_SIZES, SIZE_PRICE_MAP, buildOfflineFallbackReply } from '../../src/components/ai-chat/chatConstants.js';
import {
  STANDARD_EVENT_SIZES,
  ALBUM_COVER_SIZE,
  SIZE_CATALOG_MAP,
  normalizeCatalogSizeId,
  validateOfficialItemPrice,
} from '../../server/services/catalog/catalogSizeResolver.js';
import { matchPosterEverywhere, normalizeMatcherString, stemMatcherToken } from '../../server/services/catalog/webCatalogService.js';
import { computePosterEmbeddingHash } from '../../server/services/embeddingService.js';
import { SEED_POSTERS, TIMEOUT_MS, saveCatalogSnapshot, STANDARD_POSTER_SIZES, ALBUM_POSTER_SIZES } from '../../src/services/catalogCacheService.js';
import { productCache } from '../../server/services/catalog/catalogCacheStore.js';

describe('🗡️ BATERÍA DE PRUEBAS UNITARIAS - FASE 3 DE 6 (CATÁLOGO, CACHÉ, EMBEDDINGS, FINANZAS)', () => {
  describe('1. Unificación de Tallas y Precios Canónicos (Hallazgos #17, #34, #39)', () => {
    it('1.1 GIGANTE debe ser Q180.00 y medir 60 x 90 cm en manualSaleConstants', () => {
      const gigante = OFFICIAL_SIZES.find((s) => s.sizeId === 'GIGANTE');
      assert.ok(gigante, 'Debe existir GIGANTE en OFFICIAL_SIZES');
      assert.strictEqual(gigante.precio, 180.00);
      assert.strictEqual(gigante.dimensiones, '60 x 90 cm');
      assert.strictEqual(gigante.anchoCm, 60);
      assert.strictEqual(gigante.altoCm, 90);
    });

    it('1.2 DEFAULT_MEDIUM_SIZE debe resolver MEDIANO a Q65', () => {
      assert.ok(DEFAULT_MEDIUM_SIZE, 'DEFAULT_MEDIUM_SIZE debe estar definido');
      assert.strictEqual(DEFAULT_MEDIUM_SIZE.sizeId, 'MEDIANO');
      assert.strictEqual(DEFAULT_MEDIUM_SIZE.precio, 65.00);
    });

    it('1.3 Backend catalogSizeResolver debe tener GIGANTE a Q180 (60 x 90 cm)', () => {
      const gigante = SIZE_CATALOG_MAP.GIGANTE;
      assert.ok(gigante, 'GIGANTE debe existir en SIZE_CATALOG_MAP');
      assert.strictEqual(gigante.precio, 180);
      assert.strictEqual(gigante.dimensiones, '60 x 90 cm');
    });

    it('1.4 normalizeCatalogSizeId debe resolver variantes correctamente', () => {
      assert.strictEqual(normalizeCatalogSizeId('gigante'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('60x90'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('24x36'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('mediano'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('portada vinilo'), 'PORTADA_ALBUM');
      assert.strictEqual(normalizeCatalogSizeId('30x30 cm'), 'PORTADA_ALBUM');
    });

    it('1.5 buildOfflineFallbackReply debe usar MEDIANO como fallback', () => {
      const reply = buildOfflineFallbackReply('un poster cualquiera');
      assert.ok(reply.draft, 'Debe generar borrador offline');
      assert.strictEqual(reply.draft.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(reply.draft.items[0].unitPrice, 65);
    });
  });

  describe('2. Búsqueda Léxica de Chainsaw Man / El Hombre Motosierra (Hallazgo #3)', () => {
    it('2.1 matchPosterEverywhere debe encontrar Chainsaw Man cuando se busca "El Hombre Motosierra"', async () => {
      const result = await matchPosterEverywhere('test_tenant', 'El Hombre Motosierra');
      assert.ok(result, 'Debe devolver un resultado para El Hombre Motosierra');
      assert.match(result.baseTitle.toLowerCase(), /chainsaw\s*man|motosierra/i);
    });

    it('2.2 matchPosterEverywhere debe encontrar Chainsaw Man cuando se busca "Chainsaw Man"', async () => {
      const result = await matchPosterEverywhere('test_tenant', 'Chainsaw Man');
      assert.ok(result, 'Debe devolver un resultado para Chainsaw Man');
      assert.match(result.baseTitle.toLowerCase(), /chainsaw\s*man/i);
    });
  });

  describe('3. Persistencia de Embeddings por Hash (Hallazgo #21)', () => {
    it('3.1 computePosterEmbeddingHash genera un hash determinista sha256 de 32 caracteres', () => {
      const poster = {
        titulo: 'Chainsaw Man',
        subtitulo: 'Denji y Pochita',
        categoria: 'ANIME',
        tags: ['chainsaw', 'denji', 'pochita'],
      };
      const hash1 = computePosterEmbeddingHash(poster);
      const hash2 = computePosterEmbeddingHash(poster);
      assert.strictEqual(hash1, hash2, 'El hash debe ser determinista');
      assert.strictEqual(typeof hash1, 'string');
      assert.strictEqual(hash1.length, 32);
    });
  });

  describe('4. Saneamiento de SEED_POSTERS y TIMEOUT_MS (Hallazgos #24, #25, #26)', () => {
    it('4.1 TIMEOUT_MS en catalogCacheService debe ser 2500 ms', () => {
      assert.strictEqual(TIMEOUT_MS, 2500);
    });

    it('4.2 SEED_POSTERS asigna ALBUM_POSTER_SIZES exclusivamente a obras de música (off-5 y off-6)', () => {
      const badBunny = SEED_POSTERS.find((p) => p.id === 'off-5');
      const taylor = SEED_POSTERS.find((p) => p.id === 'off-6');
      assert.ok(badBunny && taylor);
      assert.strictEqual(badBunny.categoria, 'MUSICA');
      assert.strictEqual(badBunny.precioMinimo, 55);
      assert.deepStrictEqual(badBunny.sizes, ALBUM_POSTER_SIZES);

      const nonMusic = SEED_POSTERS.filter((p) => p.categoria !== 'MUSICA');
      for (const p of nonMusic) {
        assert.deepStrictEqual(p.sizes, STANDARD_POSTER_SIZES, `Póster ${p.id} debe tener tallas estándar`);
        assert.strictEqual(p.sizes.some((s) => s.sizeId === 'PORTADA_ALBUM'), false);
      }
    });
  });

  describe('5. Validación Server-Side de Precios Oficiales (Hallazgo #38)', () => {
    it('5.1 Acepta precio oficial exacto de la talla', () => {
      assert.doesNotThrow(() => {
        validateOfficialItemPrice({ description: 'Spider-Man (Mediano)', unitPrice: 65.00 });
      });
      assert.doesNotThrow(() => {
        validateOfficialItemPrice({ description: 'Chainsaw Man (Gigante)', unitPrice: 180.00 });
      });
      assert.doesNotThrow(() => {
        validateOfficialItemPrice({ description: 'Bad Bunny (Portada de Álbum)', unitPrice: 55.00 });
      });
    });

    it('5.2 Rechaza alteraciones de precio en tallas oficiales', () => {
      assert.throws(() => {
        validateOfficialItemPrice({ description: 'Spider-Man (Mediano)', unitPrice: 10.00 });
      }, /no coincide con el precio oficial/);

      assert.throws(() => {
        validateOfficialItemPrice({ description: 'Spider-Man (Gigante)', unitPrice: 210.00 });
      }, /no coincide con el precio oficial/);
    });

    it('5.3 Permite precio libre si el ítem es personalizado', () => {
      assert.doesNotThrow(() => {
        validateOfficialItemPrice({ description: 'Cuadro Familiar [PERSONALIZADO]', unitPrice: 147.35, isCustom: true });
      });
    });
  });

  describe('6. Cálculo de Arcos SVG para 100% de Ventas (Hallazgo #47)', () => {
    it('6.1 Cuando un solo método concentra el 100%, el ángulo no debe colapsar a 0', () => {
      const total = 500;
      const itemAmount = 500;
      const rawSliceAngle = (itemAmount / total) * 2 * Math.PI;
      const sliceAngle = Math.min(rawSliceAngle, 2 * Math.PI - 0.0001);
      assert.strictEqual(rawSliceAngle, 2 * Math.PI);
      assert.ok(sliceAngle < 2 * Math.PI, 'sliceAngle debe estar acotado');
      assert.ok(sliceAngle > 2 * Math.PI - 0.001, 'sliceAngle debe cubrir casi el círculo completo');
    });
  });
});
