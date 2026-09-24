import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { isFuzzyTokenMatch, searchWebPosters } from '../../server/services/webCatalogService.js';
import { productCache } from '../../server/services/catalog/catalogCacheStore.js';

describe('🔍 Tolerancia Tipográfica (Fuzzy Search) en Buscador Web', () => {
  const TEST_TENANT = 'tenant_fuzzy_test';

  beforeEach(() => {
    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: [
        {
          id: 'poster-spiderman',
          sku: 'WEB-SPIDER-1',
          titulo: 'Spider-Man Vintage Comic',
          subtitulo: 'Marvel Comics',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://cdn.example.com/spiderman.jpg',
          tags: ['spiderman', 'spider-man', 'marvel', 'peter', 'parker'],
          precioMinimo: 65,
        },
        {
          id: 'poster-chainsaw',
          sku: 'WEB-CHAINSAW-1',
          titulo: 'Chainsaw Man - Denji & Pochita',
          subtitulo: 'Anime Shonen',
          categoria: 'ANIME',
          imageUrl: 'https://cdn.example.com/chainsaw.jpg',
          tags: ['chainsaw', 'chainsawman', 'denji', 'pochita'],
          precioMinimo: 65,
        },
        {
          id: 'poster-batman',
          sku: 'WEB-BATMAN-1',
          titulo: 'Batman - The Dark Knight',
          subtitulo: 'DC Comics',
          categoria: 'SUPERHEROES',
          imageUrl: 'https://cdn.example.com/batman.jpg',
          tags: ['batman', 'dc', 'dark', 'knight'],
          precioMinimo: 65,
        },
        {
          id: 'poster-mapa',
          sku: 'WEB-MAPA-1',
          titulo: 'Mapa del Mundo Vintage',
          subtitulo: 'Cartografía',
          categoria: 'VINTAGE',
          imageUrl: 'https://cdn.example.com/mapa.jpg',
          tags: ['mapa', 'mundo', 'vintage'],
          precioMinimo: 65,
        },
        {
          id: 'poster-badbunny',
          sku: 'WEB-BB-1',
          titulo: 'Bad Bunny - Un Verano Sin Ti',
          subtitulo: 'Música',
          categoria: 'MUSICA',
          imageUrl: 'https://cdn.example.com/badbunny.jpg',
          tags: ['badbunny', 'benito', 'musica', 'verano'],
          precioMinimo: 55,
        },
      ],
    });
  });

  describe('1. Función utilitaria isFuzzyTokenMatch', () => {
    it('1.1 Coincidencia exacta retorna true', () => {
      assert.strictEqual(isFuzzyTokenMatch('batman', 'batman'), true);
      assert.strictEqual(isFuzzyTokenMatch('chainsaw', 'chainsaw'), true);
    });

    it('1.2 Tipos con 1 error de distancia retornan true', () => {
      assert.strictEqual(isFuzzyTokenMatch('spidrman', 'spiderman'), true);
      assert.strictEqual(isFuzzyTokenMatch('chinsaw', 'chainsaw'), true);
      assert.strictEqual(isFuzzyTokenMatch('btman', 'batman'), true);
    });

    it('1.3 Palabras cortas (< 4 letras) no aplican fuzzy', () => {
      assert.strictEqual(isFuzzyTokenMatch('sol', 'sal'), false);
      assert.strictEqual(isFuzzyTokenMatch('dos', 'tos'), false);
    });

    it('1.4 Diferencia de longitud mayor a 2 retorna false', () => {
      assert.strictEqual(isFuzzyTokenMatch('bat', 'batman'), false);
      assert.strictEqual(isFuzzyTokenMatch('supercalifragilistico', 'super'), false);
    });

    it('1.5 Términos incongruentes no coinciden', () => {
      assert.strictEqual(isFuzzyTokenMatch('pizza', 'batman'), false);
      assert.strictEqual(isFuzzyTokenMatch('incongruente999xyz', 'spiderman'), false);
    });
  });

  describe('2. Búsqueda en Catálogo searchWebPosters con Errores de Dedo', () => {
    it('2.1 "spidrman" devuelve Spider-Man Vintage Comic', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'spidrman' });
      assert.ok(results.length > 0, 'Debe devolver al menos 1 resultado para "spidrman"');
      assert.strictEqual(results[0].id, 'poster-spiderman');
    });

    it('2.2 "chinsaw" devuelve Chainsaw Man', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'chinsaw' });
      assert.ok(results.length > 0, 'Debe devolver al menos 1 resultado para "chinsaw"');
      assert.strictEqual(results[0].id, 'poster-chainsaw');
    });

    it('2.3 "btman" devuelve Batman', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'btman' });
      assert.ok(results.length > 0, 'Debe devolver al menos 1 resultado para "btman"');
      assert.strictEqual(results[0].id, 'poster-batman');
    });

    it('2.4 "mundo" devuelve Mapa del Mundo y NO a Bad Bunny ni Batman', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'mundo' });
      const ids = results.map((r) => r.id);
      assert.ok(ids.includes('poster-mapa'), 'Debe incluir Mapa del Mundo');
      assert.ok(!ids.includes('poster-badbunny'), 'NO debe incluir Bad Bunny');
      assert.ok(!ids.includes('poster-batman'), 'NO debe incluir Batman');
    });

    it('2.5 Término no existente "incongruente999xyz" devuelve arreglo vacío', async () => {
      const results = await searchWebPosters({ tenantId: TEST_TENANT, query: 'incongruente999xyz' });
      assert.strictEqual(results.length, 0);
    });
  });
});
