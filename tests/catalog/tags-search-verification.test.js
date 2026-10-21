import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { searchWebPosters, productCache, invalidateCatalogCache } from '../../server/services/webCatalogService.js';
import {
  saveCatalogSnapshot,
  searchLocalCatalog,
  getLocalCatalog,
} from '../../src/services/catalogCacheService.js';

describe('🏷️ STAND {IA} — Suite de Búsqueda por Tags en Catálogo (Ticket DEKO-STANDIA-062)', () => {
  const TEST_TENANT = 'tenant-tags-test-suite';

  const mockPosters = [
    {
      id: 'poster-pink-floyd',
      titulo: 'The Dark Side of the Moon',
      subtitulo: 'Prisma Triangular',
      categoria: 'MUSICA',
      imageUrl: '/images/pink-floyd.jpg',
      thumbUrl: '/images/pink-floyd-thumb.jpg',
      tags: ['rock', 'psicodelico', 'prisma', 'guitarra', 'clasico 70s'],
      sku: 'MUS-001',
    },
    {
      id: 'poster-breaking-bad',
      titulo: 'Heisenberg Portrait',
      subtitulo: 'I am the one who knocks',
      categoria: 'CINE',
      imageUrl: '/images/bb.jpg',
      thumbUrl: '/images/bb-thumb.jpg',
      tags: ['quimica', 'metanfetamina', 'albuquerque', 'walter white'],
      sku: 'CIN-002',
    },
    {
      id: 'poster-queen',
      titulo: 'Bohemian Rhapsody',
      subtitulo: 'Freddie Mercury Live',
      categoria: 'MUSICA',
      imageUrl: '/images/queen.jpg',
      thumbUrl: '/images/queen-thumb.jpg',
      tags: ['rock', 'vocalista', 'estadio', 'wimbley'],
      sku: 'MUS-003',
    },
    {
      id: 'poster-spiderman-verse',
      titulo: 'Spider-Man',
      subtitulo: 'Spider-Verse Amazing Spider-Man',
      categoria: 'COMICS',
      imageUrl: '/images/spiderman.jpg',
      thumbUrl: '/images/spiderman-thumb.jpg',
      tags: ['marvel', 'spider-verse', 'brincolin', 'peter parker'],
      sku: 'COM-004',
    },
    {
      id: 'poster-godfather',
      titulo: 'The Godfather',
      subtitulo: 'Homenaje Ilustrado a la Dinastía Corleone',
      categoria: 'CINE',
      imageUrl: '/images/godfather.jpg',
      thumbUrl: '/images/godfather-thumb.jpg',
      tags: ['mafia', 'don vito', 'corleone', 'padrino vintage'],
      sku: 'CIN-005',
    },
    {
      id: 'poster-zelda',
      titulo: 'The Legend of Zelda',
      subtitulo: 'El Salto del Destino',
      categoria: 'VIDEOJUEGOS',
      imageUrl: '/images/zelda.jpg',
      thumbUrl: '/images/zelda-thumb.jpg',
      tags: ['nintendo', 'link', 'hyrule', 'zelda cayendo'],
      sku: 'VID-006',
    },
  ];

  let memoryStore = {};

  beforeEach(() => {
    // 1. Configurar caché en memoria para backend
    invalidateCatalogCache(TEST_TENANT);
    productCache.set(TEST_TENANT, {
      products: mockPosters,
      timestamp: Date.now(),
    });

    // 2. Configurar mock de localStorage para frontend
    memoryStore = {};
    global.localStorage = {
      getItem: (key) => memoryStore[key] || null,
      setItem: (key, val) => { memoryStore[key] = String(val); },
      removeItem: (key) => { delete memoryStore[key]; },
      clear: () => { memoryStore = {}; },
    };
  });

  afterEach(() => {
    invalidateCatalogCache(TEST_TENANT);
    delete global.localStorage;
  });

  describe('1. Búsqueda Backend (searchWebPosters) con Coincidencia de Tags', () => {
    it('1.1. Búsqueda de 1 sola palabra por un tag único ausente en el título retorna el póster', async () => {
      // "quimica" no está en "Heisenberg Portrait" ni en "I am the one who knocks"
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'quimica',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe retornar al menos 1 resultado para el tag "quimica"');
      assert.equal(results[0].id, 'poster-breaking-bad');
    });

    it('1.2. Búsqueda por tag compartido ("rock") retorna todos los pósters con dicho tag', async () => {
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'rock',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 2, 'Debe retornar al menos los 2 pósters de rock');
      const ids = results.map((r) => r.id);
      assert.ok(ids.includes('poster-pink-floyd'));
      assert.ok(ids.includes('poster-queen'));
    });

    it('1.3. Búsqueda combinada título + tag retorna el resultado preciso', async () => {
      // Título: "Heisenberg", Tag: "quimica"
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'heisenberg quimica',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe encontrar la combinación título + tag');
      assert.equal(results[0].id, 'poster-breaking-bad');
    });

    it('1.4. Búsqueda por tag con variación flexiva o stem ("guitarras" -> "guitarra") encuentra el póster', async () => {
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'guitarra',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe encontrar el póster con tag "guitarra"');
      assert.equal(results[0].id, 'poster-pink-floyd');
    });

    it('1.5. No dispara paracaídas web falso cuando los términos están en los tags del producto', async () => {
      // "prisma psicodelico" está 100% en los tags de Pink Floyd
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'prisma psicodelico',
        skipLiveParachute: false,
      });

      assert.ok(results.length >= 1);
      assert.equal(results[0].id, 'poster-pink-floyd');
    });

    it('1.6. [DEKO-STANDIA-063] Coincidencia por prefijo de tag ("brincoli" -> tag "brincolin")', async () => {
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'brincoli',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe retornar el póster de Spider-Man Amazing por prefijo de tag "brincoli"');
      assert.equal(results[0].id, 'poster-spiderman-verse');
    });

    it('1.7. [DEKO-STANDIA-063] Coincidencia por tag compuesto desglosado ("cayendo" -> tag "zelda cayendo")', async () => {
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'cayendo',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe retornar el póster de Zelda por palabra desglosada "cayendo"');
      assert.equal(results[0].id, 'poster-zelda');
    });

    it('1.8. [DEKO-STANDIA-063] Coincidencia por tag temático ("vintage" -> tag "padrino vintage")', async () => {
      const results = await searchWebPosters({
        tenantId: TEST_TENANT,
        query: 'vintage',
        skipLiveParachute: true,
      });

      assert.ok(results.length >= 1, 'Debe retornar el póster de El Padrino por tag "padrino vintage"');
      assert.equal(results[0].id, 'poster-godfather');
    });
  });

  describe('2. Frontend Local (catalogCacheService) — Preservación y Búsqueda por Tags', () => {
    it('2.1. saveCatalogSnapshot preserva los tags normalizados en localStorage', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const storedCatalog = getLocalCatalog();
      assert.equal(storedCatalog.length, mockPosters.length);

      const pink = storedCatalog.find((p) => p.id === 'poster-pink-floyd');
      assert.ok(pink, 'Debe existir el póster en localStorage');
      assert.ok(Array.isArray(pink.tags), 'Debe tener arreglo de tags');
      assert.deepEqual(pink.tags, ['rock', 'psicodelico', 'prisma', 'guitarra', 'clasico 70s']);

      const bb = storedCatalog.find((p) => p.id === 'poster-breaking-bad');
      assert.ok(bb);
      assert.deepEqual(bb.tags, ['quimica', 'metanfetamina', 'albuquerque', 'walter white']);
    });

    it('2.2. searchLocalCatalog encuentra póster por tag único ausente en título', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('quimica');
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'poster-breaking-bad');
    });

    it('2.3. searchLocalCatalog encuentra póster combinando título y tag', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('heisenberg albuquerque');
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'poster-breaking-bad');
    });

    it('2.4. searchLocalCatalog encuentra pósters compartiendo un tag', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('rock');
      assert.equal(results.length, 2);
      const ids = results.map((r) => r.id);
      assert.ok(ids.includes('poster-pink-floyd'));
      assert.ok(ids.includes('poster-queen'));
    });

    it('2.5. [DEKO-STANDIA-063] searchLocalCatalog encuentra por prefijo de tag ("brincoli")', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('brincoli');
      assert.ok(results.length >= 1, 'Debe encontrar póster por prefijo de tag "brincoli"');
      assert.equal(results[0].id, 'poster-spiderman-verse');
    });

    it('2.6. [DEKO-STANDIA-063] searchLocalCatalog encuentra por tag compuesto desglosado ("cayendo")', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('cayendo');
      assert.ok(results.length >= 1, 'Debe encontrar póster por tag desglosado "cayendo"');
      assert.equal(results[0].id, 'poster-zelda');
    });

    it('2.7. [DEKO-STANDIA-063] searchLocalCatalog encuentra por tag temático ("vintage")', () => {
      saveCatalogSnapshot(mockPosters, { sync: true });

      const results = searchLocalCatalog('vintage');
      assert.ok(results.length >= 1, 'Debe encontrar póster por tag "vintage"');
      assert.equal(results[0].id, 'poster-godfather');
    });
  });
});
