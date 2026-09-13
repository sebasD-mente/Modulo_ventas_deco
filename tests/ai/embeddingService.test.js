import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDING_MODEL,
  computeCosineSimilarity,
  MIN_SIMILARITY_THRESHOLD,
  getPosterEmbedding,
  searchPostersByEmbedding,
  clearVectorCache,
  getVectorCacheStats,
} from '../../server/services/embeddingService.js';

describe('📐 Suite RAG Vectorial Híbrido: EmbeddingService (STAND {IA})', () => {
  beforeEach(() => {
    clearVectorCache();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Cosine Similarity Pure Math Unit Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Cálculo Matemático de Similitud Coseno (computeCosineSimilarity)', () => {
    it('1.1 Retorna 1.0 para vectores idénticos normalizados', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5];
      const vecB = [0.5, 0.5, 0.5, 0.5];
      const sim = computeCosineSimilarity(vecA, vecB);
      assert.ok(Math.abs(sim - 1.0) < 1e-6, `Esperado 1.0, obtenido: ${sim}`);
    });

    it('1.2 Retorna 0.0 para vectores ortogonales (sin afinidad)', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const sim = computeCosineSimilarity(vecA, vecB);
      assert.ok(Math.abs(sim - 0.0) < 1e-6, `Esperado 0.0, obtenido: ${sim}`);
    });

    it('1.3 Retorna -1.0 para vectores opuestos (anti-paralelos)', () => {
      const vecA = [1, 0];
      const vecB = [-1, 0];
      const sim = computeCosineSimilarity(vecA, vecB);
      assert.ok(Math.abs(sim - (-1.0)) < 1e-6, `Esperado -1.0, obtenido: ${sim}`);
    });

    it('1.4 Es independiente de la magnitud del vector (invarianza de escala)', () => {
      const vecA = [1, 2, 3];
      const vecB = [2, 4, 6];
      const sim = computeCosineSimilarity(vecA, vecB);
      assert.ok(Math.abs(sim - 1.0) < 1e-6, `Esperado 1.0 para vectores proporcionales`);
    });

    it('1.5 Protección contra división por cero con vectores nulos', () => {
      const zeroVec = [0, 0, 0];
      const normalVec = [1, 2, 3];
      const sim = computeCosineSimilarity(zeroVec, normalVec);
      assert.strictEqual(sim, 0.0, 'Vector nulo debe retornar 0.0 sin arrojar NaN');
    });

    it('1.6 Protección contra arrays inválidos o de diferente dimensión', () => {
      assert.strictEqual(computeCosineSimilarity([1, 2], [1, 2, 3]), 0.0);
      assert.strictEqual(computeCosineSimilarity(null, [1, 2]), 0.0);
      assert.strictEqual(computeCosineSimilarity([], []), 0.0);
    });

    it('1.7 El resultado está acotado estrictamente en el rango [-1.0, 1.0]', () => {
      const testCases = [
        [[0.2, 0.8, -0.4], [0.5, -0.1, 0.9]],
        [[-0.9, 0.1], [0.3, 0.7]],
        [[100, 200, 300], [-50, -100, -150]],
      ];
      for (const [a, b] of testCases) {
        const sim = computeCosineSimilarity(a, b);
        assert.ok(sim >= -1.0 && sim <= 1.0, `Similitud fuera de rango: ${sim}`);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Strict Cut-Off Threshold (MIN_SIMILARITY_THRESHOLD = 0.45)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Umbral Estricto de Afinidad (MIN_SIMILARITY_THRESHOLD = 0.45)', () => {
    it('2.0 La constante exportada EMBEDDING_MODEL es por defecto gemini-embedding-001', () => {
      assert.strictEqual(EMBEDDING_MODEL, 'gemini-embedding-001');
    });

    it('2.1 La constante exportada MIN_SIMILARITY_THRESHOLD es exactamente 0.45', () => {
      assert.strictEqual(MIN_SIMILARITY_THRESHOLD, 0.45);
    });

    it('2.2 Filtra tajantemente obras con afinidad inferior al 45% (Dragon Ball vs Batman/BTS)', async () => {
      const mockPosters = [
        {
          id: 'db-1',
          titulo: 'Dragon Ball Z - Goku Super Saiyan',
          embedding: [0.9, 0.1, 0.0],
        },
        {
          id: 'db-2',
          titulo: 'Dragon Ball Super - Goku Ultra Instinct',
          embedding: [0.8, 0.2, 0.0],
        },
        {
          id: 'bat-1',
          titulo: 'Batman - The Dark Knight',
          embedding: [0.1, 0.9, 0.1],
        },
        {
          id: 'bts-1',
          titulo: 'BTS - Butter Album Poster',
          embedding: [0.0, 0.1, 0.9],
        },
      ];

      const queryVector = [0.95, 0.05, 0.0];
      
      const results = mockPosters
        .map((p) => ({ ...p, similarity: computeCosineSimilarity(queryVector, p.embedding) }))
        .filter((p) => p.similarity >= MIN_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity);

      assert.strictEqual(results.length, 2, 'Solo deben sobrevivir los 2 pósters de Dragon Ball');
      assert.strictEqual(results[0].id, 'db-1');
      assert.strictEqual(results[1].id, 'db-2');
      assert.ok(results.every((r) => r.similarity >= 0.45), 'Todas las similitudes deben ser >= 0.45');
      assert.ok(!results.some((r) => r.id === 'bat-1'), 'Batman NUNCA debe incluirse en búsqueda de Dragon Ball');
      assert.ok(!results.some((r) => r.id === 'bts-1'), 'BTS NUNCA debe incluirse en búsqueda de Dragon Ball');
    });

    it('2.3 Comportamiento milimétrico en la frontera del umbral (0.450001 vs 0.449999)', () => {
      const queryVec = [1, 0];
      const angleAbove = Math.acos(0.450001);
      const vecAbove = [Math.cos(angleAbove), Math.sin(angleAbove)];
      const angleBelow = Math.acos(0.449999);
      const vecBelow = [Math.cos(angleBelow), Math.sin(angleBelow)];

      const simAbove = computeCosineSimilarity(queryVec, vecAbove);
      const simBelow = computeCosineSimilarity(queryVec, vecBelow);

      assert.ok(simAbove >= MIN_SIMILARITY_THRESHOLD, '0.450001 debe superar el umbral');
      assert.ok(simBelow < MIN_SIMILARITY_THRESHOLD, '0.449999 debe ser descartado');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: In-Memory Vector Caching, TTL & Sub-15ms Latency
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Caché Vectorial en Memoria RAM y Rendimiento Sub-15ms', () => {
    it('3.1 Reutiliza vectores cacheados sin invocar la API en llamadas sucesivas (Cache Hit)', async () => {
      let apiCallsCount = 0;
      const mockClient = {
        models: {
          embedContent: async () => {
            apiCallsCount++;
            return { embedding: { values: [0.1, 0.2, 0.3, 0.4, 0.5] } };
          },
        },
      };

      const poster = { id: 'poster-101', titulo: 'Spider-Man Vintage', categoria: 'COMICS' };

      const emb1 = await getPosterEmbedding(poster, { client: mockClient, tenantId: 'tenant-test' });
      assert.strictEqual(apiCallsCount, 1, 'Primer llamado debe generar embedding');
      assert.ok(Array.isArray(emb1) && emb1.length === 5);

      const emb2 = await getPosterEmbedding(poster, { client: mockClient, tenantId: 'tenant-test' });
      assert.strictEqual(apiCallsCount, 1, 'Segundo llamado debe resolver de caché sin llamar a API');
      assert.deepStrictEqual(emb1, emb2);
    });

    it('3.2 clearVectorCache() purga las entradas y resetea las estadísticas', async () => {
      const mockClient = {
        models: {
          embedContent: async () => ({ embedding: { values: [0.5, 0.5] } }),
        },
      };
      await getPosterEmbedding({ id: 'p1', titulo: 'Test' }, { client: mockClient, tenantId: 't1' });
      
      const statsBefore = getVectorCacheStats();
      assert.ok(statsBefore.size > 0);

      clearVectorCache();

      const statsAfter = getVectorCacheStats();
      assert.strictEqual(statsAfter.size, 0);
    });

    it('3.3 Latencia matemática sub-15ms en escaneo de 300 vectores cacheados de 3072 dimensiones', () => {
      const dim = 3072;
      const queryVec = Array.from({ length: dim }, () => Math.random());
      
      const cachedVectors = Array.from({ length: 300 }, (_, i) => ({
        id: `p-${i}`,
        vector: Array.from({ length: dim }, () => Math.random()),
      }));

      const start = performance.now();
      const scored = cachedVectors
        .map((p) => ({ id: p.id, sim: computeCosineSimilarity(queryVec, p.vector) }))
        .filter((p) => p.sim >= MIN_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.sim - a.sim);
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 15.0, `Latencia excedió 15ms: tomó ${elapsed.toFixed(2)}ms`);
      assert.ok(Array.isArray(scored));
    });

    it('3.4 Cálculo de similitud coseno con vectores normalizados de 3072 dimensiones', () => {
      const dim = 3072;
      const raw = Array.from({ length: dim }, () => Math.random() - 0.5);
      const norm = Math.sqrt(raw.reduce((acc, x) => acc + x * x, 0));
      const vA = raw.map((x) => x / norm);
      const sim = computeCosineSimilarity(vA, vA);
      assert.ok(Math.abs(sim - 1.0) < 1e-6, `Esperado 1.0, obtenido: ${sim}`);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Parachute / Resilient Lexical Fallback
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Paracaídas Híbrido Resiliente ante Falla de Red / API', () => {
    it('4.1 Conmuta a búsqueda léxica local si la API de embeddings arroja error 429 o ETIMEDOUT', async () => {
      const mockFailingClient = {
        models: {
          embedContent: async () => {
            const err = new Error('Resource Exhausted (HTTP 429)');
            err.status = 429;
            throw err;
          },
        },
      };

      const result = await searchPostersByEmbedding({
        tenantId: 'tenant-test',
        query: 'spider man',
        client: mockFailingClient,
        limit: 8,
      });

      assert.ok(result, 'El resultado no debe ser nulo');
      assert.ok(Array.isArray(result.results), 'Debe retornar array de resultados');
      assert.strictEqual(result.source, 'lexical_parachute', 'Debe marcar la fuente como paracaídas léxico');
      assert.ok(result.results.length > 0, 'Debe encontrar pósters vía búsqueda léxica');
    });

    it('4.2 Mantiene intacto el contrato JSON de pósters devueltos por el paracaídas', async () => {
      const mockFailingClient = {
        models: {
          embedContent: async () => {
            throw new Error('fetch failed: ETIMEDOUT');
          },
        },
      };

      const result = await searchPostersByEmbedding({
        tenantId: 'tenant-test',
        query: 'pablo escobar',
        client: mockFailingClient,
        limit: 4,
      });

      const first = result.results[0];
      if (first) {
        assert.ok('id' in first, 'Debe contener id');
        assert.ok('titulo' in first, 'Debe contener titulo');
        assert.ok('categoria' in first, 'Debe contener categoria');
        assert.ok('precioMinimo' in first, 'Debe contener precioMinimo');
      }
    });
  });
});
