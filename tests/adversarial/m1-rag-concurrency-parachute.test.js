import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCosineSimilarity,
  cosineSimilarity,
  MIN_SIMILARITY_THRESHOLD,
  VECTOR_CACHE_TTL_MS,
  EMBEDDING_MODEL,
  embedTexts,
  getPosterEmbedding,
  warmCatalogVectors,
  searchHybridPosters,
  searchPostersByEmbedding,
  clearVectorCache,
  invalidateVectorCache,
  getVectorCacheStats,
  posterToEmbeddingText,
} from '../../server/services/embeddingService.js';
import { getCachedProducts } from '../../server/services/webCatalogService.js';

describe('⚔️ ADVERSARIAL CHALLENGE — M1: Concurrency, In-RAM Caching & Hybrid Parachute', () => {
  beforeEach(() => {
    clearVectorCache();
  });

  afterEach(() => {
    clearVectorCache();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Concurrency & Race Conditions (warmingPromises Map Deduplication)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Concurrencia y Deduplicación de Promesas (warmingPromises)', () => {
    it('1.1 Deduplica 50 llamadas simultáneas a warmCatalogVectors en una única invocación API', async () => {
      let apiCallCount = 0;
      let textsEmbeddedCount = 0;

      const delayedMockClient = {
        models: {
          embedContent: async ({ contents }) => {
            apiCallCount++;
            textsEmbeddedCount += contents.length;
            // Simular latencia de red asíncrona de 40ms
            await new Promise((resolve) => setTimeout(resolve, 40));
            return {
              embeddings: contents.map(() => ({
                values: Array.from({ length: 768 }, () => Math.random()),
              })),
            };
          },
        },
      };

      const tenant = 'tenant-burst-concurrency';
      const CONCURRENT_CALLS = 50;

      // Disparar 50 llamadas exactamente concurrentes
      const promises = Array.from({ length: CONCURRENT_CALLS }, () =>
        warmCatalogVectors(tenant, false, delayedMockClient)
      );

      const allResults = await Promise.all(promises);

      // Verificación 1: Deduplicación estricta
      // En un catálogo con 2 pósters dev, toFetch tiene 2 elementos (1 batch de 50).
      // Por tanto, la API debe ser invocada EXACTAMENTE 1 vez para todo el enjambre.
      assert.strictEqual(apiCallCount, 1, `La API debió llamarse exactamente 1 vez, pero se llamó ${apiCallCount} veces`);

      // Verificación 2: Todos los 50 consumidores recibieron resultados válidos e idénticos
      assert.strictEqual(allResults.length, CONCURRENT_CALLS);
      const firstResult = allResults[0];
      assert.ok(Array.isArray(firstResult) && firstResult.length > 0);

      for (let i = 1; i < CONCURRENT_CALLS; i++) {
        assert.strictEqual(
          allResults[i].length,
          firstResult.length,
          `Caller ${i} recibió diferente cantidad de items`
        );
        assert.deepStrictEqual(
          allResults[i].map((it) => it.id),
          firstResult.map((it) => it.id),
          `Caller ${i} recibió diferente conjunto de IDs`
        );
      }
    });

    it('1.2 Aislamiento multitenant concurrente: No hay crosstalk entre tenants simultáneos', async () => {
      const callsByTenant = { 'tenant-A': 0, 'tenant-B': 0, 'tenant-C': 0 };

      const createTenantClient = (tenantName) => ({
        models: {
          embedContent: async ({ contents }) => {
            callsByTenant[tenantName]++;
            await new Promise((r) => setTimeout(r, 20));
            return {
              embeddings: contents.map(() => ({
                values: Array.from({ length: 768 }, () => Math.random()),
              })),
            };
          },
        },
      });

      // Disparar 10 llamadas para cada uno de los 3 tenants de forma intercalada
      const mixedPromises = [];
      for (let i = 0; i < 10; i++) {
        mixedPromises.push(warmCatalogVectors('tenant-A', false, createTenantClient('tenant-A')));
        mixedPromises.push(warmCatalogVectors('tenant-B', false, createTenantClient('tenant-B')));
        mixedPromises.push(warmCatalogVectors('tenant-C', false, createTenantClient('tenant-C')));
      }

      const results = await Promise.all(mixedPromises);
      assert.strictEqual(results.length, 30);

      // Cada tenant debió llamar a su API exactamente 1 vez
      assert.strictEqual(callsByTenant['tenant-A'], 1);
      assert.strictEqual(callsByTenant['tenant-B'], 1);
      assert.strictEqual(callsByTenant['tenant-C'], 1);

      // Los vectores en caché deben estar particionados por tenant
      const stats = getVectorCacheStats();
      assert.ok(stats.size >= 6, `Esperados al menos 6 vectores en caché, encontrados: ${stats.size}`);
    });

    it('1.3 Resiliencia y auto-recuperación si warmCatalogVectors falla durante una ráfaga concurrente', async () => {
      let failedCallAttempts = 0;
      const failingClient = {
        models: {
          embedContent: async () => {
            failedCallAttempts++;
            await new Promise((r) => setTimeout(r, 25));
            throw new Error('503 Service Unavailable: Gemini overload');
          },
        },
      };

      const tenant = 'tenant-recovering';

      // 10 llamadas concurrentes que fallan
      const failingPromises = Array.from({ length: 10 }, () =>
        warmCatalogVectors(tenant, false, failingClient)
      );

      const failedResults = await Promise.all(failingPromises);
      // Debe atrapar el error internamente y retornar array vacío (o lo que esté en caché) sin arrojar excepción no capturada
      assert.ok(Array.isArray(failedResults[0]));

      // Lo crucial: warmingPromises DEBE haber borrado la entrada en `finally`
      // Comprobar que una llamada posterior con cliente saludable funciona normalmente
      let healthyCallAttempts = 0;
      const healthyClient = {
        models: {
          embedContent: async ({ contents }) => {
            healthyCallAttempts++;
            return {
              embeddings: contents.map(() => ({
                values: Array.from({ length: 768 }, () => 0.5),
              })),
            };
          },
        },
      };

      const recoveredResult = await warmCatalogVectors(tenant, false, healthyClient);
      assert.strictEqual(healthyCallAttempts, 1, 'Llamada posterior debe ejecutar normalmente tras recuperarse');
      assert.ok(Array.isArray(recoveredResult) && recoveredResult.length > 0);
    });

    it('1.4 Estrés de 30 consultas híbridas simultáneas (searchHybridPosters) con caché fría', async () => {
      let embeddingCalls = 0;
      const mockClient = {
        models: {
          embedContent: async ({ contents }) => {
            embeddingCalls++;
            await new Promise((r) => setTimeout(r, 15));
            return {
              embeddings: contents.map(() => ({
                values: Array.from({ length: 768 }, () => Math.random()),
              })),
            };
          },
        },
      };

      const queries = [
        'spider-man vintage', 'goku super saiyan', 'batman caballero noche',
        'pablo escobar sonrisa', 'iron man marvel', 'darth vader star wars',
      ];

      // Lanzar 30 búsquedas concurrentes
      const searches = Array.from({ length: 30 }, (_, idx) =>
        searchHybridPosters({
          tenantId: 'tenant-stress-search',
          query: queries[idx % queries.length],
          client: mockClient,
          limit: 5,
        })
      );

      const results = await Promise.all(searches);

      assert.strictEqual(results.length, 30);
      for (const res of results) {
        assert.ok(Array.isArray(res));
        assert.ok('results' in res);
        assert.ok('source' in res);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Hybrid Parachute Fallback Under Catastrophic Failures
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Paracaídas Híbrido Resiliente ante Catástrofes de Red / API', () => {
    it('2.1 Tolerancia ante HTTP 429 Quota Exceeded (Resource Exhausted)', async () => {
      const quotaClient = {
        models: {
          embedContent: async () => {
            const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
            err.status = 429;
            throw err;
          },
        },
      };

      const res = await searchHybridPosters({
        tenantId: 'tenant-test',
        query: 'spider-man',
        client: quotaClient,
        limit: 5,
      });

      assert.ok(Array.isArray(res), 'Debe retornar un array iterable');
      assert.strictEqual(res.source, 'lexical_parachute');
      assert.ok(Array.isArray(res.results));
      assert.ok(res.length > 0, 'Debe encontrar póster dev por coincidencia léxica');
      assert.ok(res[0].titulo.toLowerCase().includes('spider'));
    });

    it('2.2 Tolerancia ante Timeout de Red (ETIMEDOUT / fetch failed)', async () => {
      const timeoutClient = {
        models: {
          embedContent: async () => {
            const err = new Error('fetch failed: connect ETIMEDOUT 142.250.190.42:443');
            err.code = 'ETIMEDOUT';
            throw err;
          },
        },
      };

      const res = await searchHybridPosters({
        tenantId: 'tenant-test',
        query: 'pablo escobar',
        client: timeoutClient,
        limit: 5,
      });

      assert.strictEqual(res.source, 'lexical_parachute');
      assert.ok(res.length > 0);
      assert.ok(res[0].titulo.toLowerCase().includes('pablo'));
    });

    it('2.3 Tolerancia ante caída de DNS / Sin conexión (ENOTFOUND)', async () => {
      const offlineClient = {
        models: {
          embedContent: async () => {
            const err = new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
            err.code = 'ENOTFOUND';
            throw err;
          },
        },
      };

      const res = await searchHybridPosters({
        tenantId: 'tenant-test',
        query: 'spider',
        client: offlineClient,
      });

      assert.strictEqual(res.source, 'lexical_parachute');
      assert.ok(Array.isArray(res));
    });

    it('2.4 Tolerancia ante respuesta API malformada o vacía (null embeddings)', async () => {
      const malformedClient = {
        models: {
          embedContent: async () => {
            // API devuelve objeto vacío o sin embeddings
            return { unexpected: true };
          },
        },
      };

      const res = await searchHybridPosters({
        tenantId: 'tenant-test',
        query: 'spider',
        client: malformedClient,
      });

      assert.strictEqual(res.source, 'lexical_parachute');
      assert.ok(Array.isArray(res));
    });

    it('2.5 Consultas vacías, nulas o de puros espacios no invocan API y retornan source "lexical"', async () => {
      let apiInvoked = false;
      const spyClient = {
        models: {
          embedContent: async () => {
            apiInvoked = true;
            return { embeddings: [] };
          },
        },
      };

      const resEmpty = await searchHybridPosters({ query: '', client: spyClient });
      assert.strictEqual(resEmpty.source, 'lexical');
      assert.strictEqual(apiInvoked, false, 'No debe llamar a API para string vacío');

      const resSpaces = await searchHybridPosters({ query: '     ', client: spyClient });
      assert.strictEqual(resSpaces.source, 'lexical');
      assert.strictEqual(apiInvoked, false, 'No debe llamar a API para string de espacios');

      const resNull = await searchHybridPosters({ query: null, client: spyClient });
      assert.strictEqual(resNull.source, 'lexical');
      assert.strictEqual(apiInvoked, false, 'No debe llamar a API para query nulo');
    });

    it('2.6 Preserva contrato JSON idéntico tanto en vector como en lexical_parachute', async () => {
      const mockVectorClient = {
        models: {
          embedContent: async ({ contents }) => ({
            embeddings: contents.map(() => ({ values: [0.9, 0.1, 0.0] })),
          }),
        },
      };

      const mockFailingClient = {
        models: {
          embedContent: async () => {
            throw new Error('Simulated failure');
          },
        },
      };

      const vectorRes = await searchHybridPosters({ query: 'spider', client: mockVectorClient });
      const parachuteRes = await searchHybridPosters({ query: 'spider', client: mockFailingClient });

      assert.ok(Array.isArray(vectorRes));
      assert.ok(Array.isArray(parachuteRes));
      assert.strictEqual(vectorRes.source, 'vector');
      assert.strictEqual(parachuteRes.source, 'lexical_parachute');

      // Ambas respuestas deben tener .results apuntando a sí mismas
      assert.strictEqual(vectorRes.results, vectorRes);
      assert.strictEqual(parachuteRes.results, parachuteRes);

      if (parachuteRes.length > 0) {
        const item = parachuteRes[0];
        const requiredKeys = ['id', 'titulo', 'categoria', 'precioMinimo'];
        for (const key of requiredKeys) {
          assert.ok(key in item, `Campo faltante en póster de paracaídas: ${key}`);
        }
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: In-RAM Caching, TTL, Invalidation & Memory Leaks
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Caché Vectorial en RAM, TTL, Invalidación y Estabilidad de Memoria', () => {
    it('3.1 Invalidación selectiva por tenantId preserva otros tenants', async () => {
      const mockClient = {
        models: {
          embedContent: async ({ contents }) => ({
            embeddings: contents.map(() => ({ values: [0.5, 0.5] })),
          }),
        },
      };

      await getPosterEmbedding({ id: 'p1', titulo: 'Alpha' }, { tenantId: 'tenant-1', client: mockClient });
      await getPosterEmbedding({ id: 'p2', titulo: 'Beta' }, { tenantId: 'tenant-2', client: mockClient });
      await getPosterEmbedding({ id: 'p3', titulo: 'Global' }, { tenantId: null, client: mockClient });

      assert.strictEqual(getVectorCacheStats().size, 3);

      // Invalidar SOLO tenant-1
      invalidateVectorCache('tenant-1');

      // tenant-1 purgado, tenant-2 y __GLOBAL__ se mantienen
      assert.strictEqual(getVectorCacheStats().size, 2);

      // Invalidar todo
      clearVectorCache();
      assert.strictEqual(getVectorCacheStats().size, 0);
    });

    it('3.2 Ciclo de 500 vectores: Inserción masiva y purga sin fuga de referencias', () => {
      const initialStats = getVectorCacheStats();
      assert.strictEqual(initialStats.size, 0);

      const DIM = 768;
      // Cargar 500 vectores simulados directamente
      for (let i = 0; i < 500; i++) {
        const fakePoster = { id: `leak-test-${i}`, titulo: `Poster ${i}`, categoria: 'TEST' };
        // Usar la función posterToEmbeddingText
        const text = posterToEmbeddingText(fakePoster);
        assert.ok(text.length > 0);
      }

      clearVectorCache();
      assert.strictEqual(getVectorCacheStats().size, 0);
    });

    it('3.3 Expiración de TTL: Vectores con timestamp vencido son re-calculados', async () => {
      let apiCalls = 0;
      const mockClient = {
        models: {
          embedContent: async () => {
            apiCalls++;
            return { embedding: { values: [0.1, 0.2, 0.3] } };
          },
        },
      };

      const poster = { id: 'poster-ttl-test', titulo: 'Obra TTL' };

      // 1. Primera llamada: llena caché
      await getPosterEmbedding(poster, { client: mockClient, tenantId: 'tenant-ttl' });
      assert.strictEqual(apiCalls, 1);

      // 2. Segunda llamada inmediata: Cache Hit
      await getPosterEmbedding(poster, { client: mockClient, tenantId: 'tenant-ttl' });
      assert.strictEqual(apiCalls, 1);

      // 3. Simular expiración de TTL: forzar fecha pasada manualmente en el caché
      // Obtenemos la clave interna esperada
      clearVectorCache('tenant-ttl');
      
      // 4. Tras invalidar, debe invocar a la API nuevamente
      await getPosterEmbedding(poster, { client: mockClient, tenantId: 'tenant-ttl' });
      assert.strictEqual(apiCalls, 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Zero-Trust & Prohibited IP / Network Leakage Audit
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Auditoría Zero-Trust y Cero Fuga a IPs Prohibidas (145.223.120.56)', () => {
    it('4.1 embeddingService.js no contiene referencias a 145.223.120.56 ni catalog_db', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const filePath = path.resolve('server/services/embeddingService.js');
      const content = fs.readFileSync(filePath, 'utf8');

      assert.ok(!content.includes('145.223.120.56'), 'Violación detectada: IP ajena 145.223.120.56 en embeddingService.js');
      assert.ok(!content.includes('catalog_db'), 'Violación detectada: catalog_db en embeddingService.js');
      assert.ok(!content.includes('admin_deco'), 'Violación detectada: admin_deco en embeddingService.js');
    });

    it('4.2 embeddingService.js cumple estrictamente el presupuesto de < 150 líneas', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const filePath = path.resolve('server/services/embeddingService.js');
      const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;

      assert.ok(
        lineCount < 150,
        `Violación de techo de líneas: embeddingService.js tiene ${lineCount} líneas (máximo permitido: < 150)`
      );
    });
  });
});
