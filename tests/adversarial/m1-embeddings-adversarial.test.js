import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cosineSimilarity,
  computeCosineSimilarity,
  MIN_SIMILARITY_THRESHOLD,
  searchHybridPosters,
  clearVectorCache,
} from '../../server/services/embeddingService.js';

describe('⚔️ ADVERSARIAL EMPIRICAL STRESS-TEST: MOTOR RAG VECTORIAL HÍBRIDO (M1)', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 1: Valores Extremos de Punto Flotante, NaN, Infinitos y Vectores Nulos
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Valores Extremos de Punto Flotante, NaN, Infinitos y Vectores Nulos', () => {

    it('1.1 Vectores de magnitud cero devuelven 0.0 sin arrojar error ni división por cero', () => {
      const zero3 = [0, 0, 0];
      const normal3 = [1, 2, 3];
      const zero768 = new Array(768).fill(0);
      const normal768 = new Array(768).fill(0.1);

      assert.strictEqual(cosineSimilarity(zero3, normal3), 0.0);
      assert.strictEqual(cosineSimilarity(normal3, zero3), 0.0);
      assert.strictEqual(cosineSimilarity(zero3, zero3), 0.0);
      assert.strictEqual(cosineSimilarity(zero768, normal768), 0.0);
    });

    it('1.2 Vectores con NaN devuelven NaN y son estrictamente descartados por el filtro >= 0.45', () => {
      const vecWithNaN = [NaN, 0.5, 0.5];
      const normalVec = [0.5, 0.5, 0.5];
      const sim = cosineSimilarity(vecWithNaN, normalVec);

      assert.ok(Number.isNaN(sim), 'Similitud con NaN debe ser NaN');
      // Verificación de seguridad crítica: NaN nunca debe superar el umbral
      assert.strictEqual(sim >= MIN_SIMILARITY_THRESHOLD, false, 'NaN >= 0.45 debe ser false');
      assert.strictEqual(sim >= 0.0, false, 'NaN >= 0.0 debe ser false');
      assert.strictEqual(sim < MIN_SIMILARITY_THRESHOLD, false, 'NaN < 0.45 es false');
    });

    it('1.3 Vectores con Infinity y -Infinity no rompen el proceso y son rechazados', () => {
      const posInfVec = [Infinity, 1.0, 0.0];
      const negInfVec = [-Infinity, 1.0, 0.0];
      const normalVec = [1.0, 1.0, 1.0];

      const simPos = cosineSimilarity(posInfVec, normalVec);
      const simNeg = cosineSimilarity(negInfVec, normalVec);
      const simBoth = cosineSimilarity(posInfVec, posInfVec);

      // Verificación de seguridad: no arroja excepción no controlada
      assert.strictEqual(simPos >= MIN_SIMILARITY_THRESHOLD, false);
      assert.strictEqual(simNeg >= MIN_SIMILARITY_THRESHOLD, false);
      assert.strictEqual(simBoth >= MIN_SIMILARITY_THRESHOLD, false);
    });

    it('1.4 Invarianza de escala y números grandes sin desbordamiento (hasta 1e100)', () => {
      const bigVecA = [1e50, 2e50, 3e50];
      const bigVecB = [2e50, 4e50, 6e50];
      const simBig = cosineSimilarity(bigVecA, bigVecB);
      assert.ok(Math.abs(simBig - 1.0) < 1e-7, `Esperado 1.0 para vectores gigantes proporcionales, obtenido: ${simBig}`);

      // Desbordamiento extremo (1e300 * 1e300 = Infinity)
      const hugeVecA = [1e300, 1e300];
      const hugeVecB = [1e300, 1e300];
      const simHuge = cosineSimilarity(hugeVecA, hugeVecB);
      assert.ok(Number.isNaN(simHuge) || Math.abs(simHuge - 1.0) < 1e-5, 'No debe arrojar excepción no capturada');
      // Seguridad: si es NaN, no pasa el umbral
      if (Number.isNaN(simHuge)) {
        assert.strictEqual(simHuge >= MIN_SIMILARITY_THRESHOLD, false);
      }
    });

    it('1.5 Números subnormales o extremadamente pequeños bajo cero no arrojan excepción', () => {
      const tinyA = [1e-150, 2e-150, 3e-150];
      const tinyB = [2e-150, 4e-150, 6e-150];
      const simTiny = cosineSimilarity(tinyA, tinyB);
      assert.ok(Math.abs(simTiny - 1.0) < 1e-7, `Esperado 1.0 para números subnormales proporcionales, obtenido: ${simTiny}`);

      // Underflow total a cero (1e-300)^2 = 0
      const underflowA = [1e-300, 1e-300];
      const underflowB = [1e-300, 1e-300];
      const simUnderflow = cosineSimilarity(underflowA, underflowB);
      assert.strictEqual(simUnderflow, 0.0, 'Underflow a norma cero debe retornar 0.0');
    });

    it('1.6 Discrepancia de dimensiones entre vectores retorna 0.0 inmediatamente', () => {
      const vec768 = new Array(768).fill(0.1);
      const vec1536 = new Array(1536).fill(0.1);
      const vec3 = [1, 2, 3];
      const vec4 = [1, 2, 3, 4];

      assert.strictEqual(cosineSimilarity(vec768, vec1536), 0.0);
      assert.strictEqual(cosineSimilarity(vec3, vec4), 0.0);
      assert.strictEqual(cosineSimilarity(null, vec768), 0.0);
      assert.strictEqual(cosineSimilarity(vec768, undefined), 0.0);
      assert.strictEqual(cosineSimilarity([], []), 0.0);
    });

    it('1.7 Compatibilidad con TypedArrays (Float32Array y Float64Array)', () => {
      const f32A = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const f32B = new Float32Array([0.2, 0.4, 0.6, 0.8]);
      const simF32 = cosineSimilarity(f32A, f32B);
      assert.ok(Math.abs(simF32 - 1.0) < 1e-6, `Esperado 1.0 para Float32Array, obtenido: ${simF32}`);

      const f64A = new Float64Array([1, 0, 0]);
      const f64B = new Float64Array([0, 1, 0]);
      const simF64 = cosineSimilarity(f64A, f64B);
      assert.ok(Math.abs(simF64 - 0.0) < 1e-6, `Esperado 0.0 para Float64Array ortogonales, obtenido: ${simF64}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 2: Vectores de Alta Dimensión (768 y 1536 Dimensiones)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Vectores de Alta Dimensión (768 y 1536 Dimensiones)', () => {

    it('2.1 Vectores de 768 dimensiones (text-embedding-004): Idénticos, opuestos y ortogonales', () => {
      const dim = 768;
      const raw = Array.from({ length: dim }, () => Math.random() - 0.5);
      const norm = Math.sqrt(raw.reduce((acc, x) => acc + x * x, 0));
      const vA = raw.map((x) => x / norm);
      const vOpp = vA.map((x) => -x);

      const simId = cosineSimilarity(vA, vA);
      assert.ok(Math.abs(simId - 1.0) < 1e-7, `768 dims idéntico debe ser 1.0, obtenido: ${simId}`);

      const simOpp = cosineSimilarity(vA, vOpp);
      assert.ok(Math.abs(simOpp - (-1.0)) < 1e-7, `768 dims opuesto debe ser -1.0, obtenido: ${simOpp}`);

      const vOrth1 = new Array(dim).fill(0);
      const vOrth2 = new Array(dim).fill(0);
      for (let i = 0; i < dim / 2; i++) vOrth1[i] = 1 / Math.sqrt(dim / 2);
      for (let i = dim / 2; i < dim; i++) vOrth2[i] = 1 / Math.sqrt(dim / 2);
      const simOrth = cosineSimilarity(vOrth1, vOrth2);
      assert.ok(Math.abs(simOrth - 0.0) < 1e-7, `768 dims ortogonales debe ser 0.0, obtenido: ${simOrth}`);
    });

    it('2.2 Vectores de 1536 dimensiones (OpenAI): Idénticos y opuestos', () => {
      const dim = 1536;
      const raw = Array.from({ length: dim }, () => Math.random() - 0.5);
      const norm = Math.sqrt(raw.reduce((acc, x) => acc + x * x, 0));
      const vA = raw.map((x) => x / norm);
      const vOpp = vA.map((x) => -x);

      const simId = cosineSimilarity(vA, vA);
      assert.ok(Math.abs(simId - 1.0) < 1e-7, `1536 dims idéntico debe ser 1.0, obtenido: ${simId}`);

      const simOpp = cosineSimilarity(vA, vOpp);
      assert.ok(Math.abs(simOpp - (-1.0)) < 1e-7, `1536 dims opuesto debe ser -1.0, obtenido: ${simOpp}`);
    });

    it('2.3 Acotamiento estricto [-1.0, 1.0] en 100 pares aleatorios de alta dimensión', () => {
      const dim = 768;
      for (let i = 0; i < 100; i++) {
        const vA = Array.from({ length: dim }, () => (Math.random() - 0.5) * 1000);
        const vB = Array.from({ length: dim }, () => (Math.random() - 0.5) * 1000);
        const sim = cosineSimilarity(vA, vB);
        assert.ok(sim >= -1.0 && sim <= 1.0, `Similitud fuera de límites [-1, 1]: ${sim}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 3: Pruebas de Frontera Milimétrica alrededor de MIN_SIMILARITY_THRESHOLD = 0.45
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Pruebas de Frontera Milimétrica en Umbral 0.45', () => {

    it('3.1 Exactamente 0.45 supera el umbral (sim >= 0.45 es true)', () => {
      const query = [1, 0];
      const thetaExact = Math.acos(0.45);
      const vecExact = [Math.cos(thetaExact), Math.sin(thetaExact)];
      const sim = cosineSimilarity(query, vecExact);

      assert.ok(Math.abs(sim - 0.45) < 1e-7);
      assert.strictEqual(sim >= MIN_SIMILARITY_THRESHOLD, true, '0.45 exacto debe ser aceptado');
    });

    it('3.2 0.4500001 supera el umbral (sim >= 0.45 es true)', () => {
      const query = [1, 0];
      const thetaAbove = Math.acos(0.4500001);
      const vecAbove = [Math.cos(thetaAbove), Math.sin(thetaAbove)];
      const simAbove = cosineSimilarity(query, vecAbove);

      assert.ok(simAbove >= MIN_SIMILARITY_THRESHOLD, '0.4500001 debe superar 0.45');
    });

    it('3.3 0.4499999 es descartado tajantemente (sim >= 0.45 es false)', () => {
      const query = [1, 0];
      const thetaBelow = Math.acos(0.4499999);
      const vecBelow = [Math.cos(thetaBelow), Math.sin(thetaBelow)];
      const simBelow = cosineSimilarity(query, vecBelow);

      assert.ok(simBelow < MIN_SIMILARITY_THRESHOLD, '0.4499999 debe ser menor a 0.45');
      assert.strictEqual(simBelow >= MIN_SIMILARITY_THRESHOLD, false);
    });

    it('3.4 Precisión IEEE 754 en delta infinitesimal (0.45 + 1e-14 vs 0.45 - 1e-14)', () => {
      const justAbove = 0.45 + 1e-14;
      const justBelow = 0.45 - 1e-14;

      assert.strictEqual(justAbove >= MIN_SIMILARITY_THRESHOLD, true);
      assert.strictEqual(justBelow >= MIN_SIMILARITY_THRESHOLD, false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 4: Consultas de Catálogo Real y Descarte 100% Negativo (Dragon Ball vs Batman/BTS)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Consultas de Catálogo Real y Descarte 100% Negativo', () => {

    it('4.1 Búsqueda "Dragon Ball": Goku hace match (>0.85) y Batman / BTS son 100% descartados', () => {
      function makeClusterVector(cluster, noise = 0.02) {
        const v = new Array(768).fill(0.01);
        const start = cluster * 100;
        for (let i = start; i < start + 60; i++) {
          v[i] = 1.0 + (Math.random() - 0.5) * noise;
        }
        const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
        return v.map((x) => x / norm);
      }

      const dragonBallQueryVec = makeClusterVector(0, 0.01);
      const gokuSuperSaiyanVec = makeClusterVector(0, 0.05);
      const gokuUltraInstinctVec = makeClusterVector(0, 0.08);
      const vegetaBlueVec = makeClusterVector(0, 0.10);
      const batmanDarkKnightVec = makeClusterVector(1, 0.02);
      const batmanDetectiveVec = makeClusterVector(1, 0.02);
      const btsButterVec = makeClusterVector(2, 0.02);
      const btsDynamiteVec = makeClusterVector(2, 0.02);
      const taylorSwiftVec = makeClusterVector(3, 0.02);

      const testPosters = [
        { id: 'p-goku-1', titulo: 'Goku Super Saiyan 3', vector: gokuSuperSaiyanVec },
        { id: 'p-goku-2', titulo: 'Goku Ultra Instinct', vector: gokuUltraInstinctVec },
        { id: 'p-vegeta', titulo: 'Vegeta Super Saiyan Blue', vector: vegetaBlueVec },
        { id: 'p-bat-1', titulo: 'Batman - The Dark Knight', vector: batmanDarkKnightVec },
        { id: 'p-bat-2', titulo: 'Batman Detective Comics #27', vector: batmanDetectiveVec },
        { id: 'p-bts-1', titulo: 'BTS - Butter Album', vector: btsButterVec },
        { id: 'p-bts-2', titulo: 'BTS - Dynamite Pop Art', vector: btsDynamiteVec },
        { id: 'p-taylor', titulo: 'Taylor Swift Eras Tour', vector: taylorSwiftVec },
      ];

      const scored = testPosters
        .map((p) => ({ ...p, sim: cosineSimilarity(dragonBallQueryVec, p.vector) }))
        .filter((p) => p.sim >= MIN_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.sim - a.sim);

      assert.strictEqual(scored.length, 3, 'Solo deben sobrevivir los 3 pósters del universo Dragon Ball');
      assert.ok(scored.some((p) => p.id === 'p-goku-1'), 'Goku SSJ3 debe estar en resultados');
      assert.ok(scored.some((p) => p.id === 'p-goku-2'), 'Goku Ultra Instinct debe estar en resultados');
      assert.ok(scored.some((p) => p.id === 'p-vegeta'), 'Vegeta debe estar en resultados');

      const goku1 = scored.find((p) => p.id === 'p-goku-1');
      assert.ok(goku1.sim > 0.85, `Goku debe tener afinidad > 0.85, obtenido: ${goku1.sim}`);

      // 100% DESCARTADOS
      assert.strictEqual(scored.some((p) => p.id === 'p-bat-1'), false, 'Batman 1 NUNCA debe estar');
      assert.strictEqual(scored.some((p) => p.id === 'p-bat-2'), false, 'Batman 2 NUNCA debe estar');
      assert.strictEqual(scored.some((p) => p.id === 'p-bts-1'), false, 'BTS Butter NUNCA debe estar');
      assert.strictEqual(scored.some((p) => p.id === 'p-bts-2'), false, 'BTS Dynamite NUNCA debe estar');
      assert.strictEqual(scored.some((p) => p.id === 'p-taylor'), false, 'Taylor Swift NUNCA debe estar');

      const simBat1 = cosineSimilarity(dragonBallQueryVec, batmanDarkKnightVec);
      const simBts1 = cosineSimilarity(dragonBallQueryVec, btsButterVec);
      assert.ok(simBat1 < 0.1, `Afinidad de Batman con Dragon Ball debe ser < 0.1, obtenido: ${simBat1}`);
      assert.ok(simBts1 < 0.1, `Afinidad de BTS con Dragon Ball debe ser < 0.1, obtenido: ${simBts1}`);
    });

    it('4.2 Búsqueda sin coincidencias afines (todos < 0.45) devuelve array vacío sin error', () => {
      const queryVec = [1, 0, 0];
      const orthogonalPosters = [
        { id: 'p-1', vector: [0, 1, 0] },
        { id: 'p-2', vector: [0, 0, 1] },
        { id: 'p-3', vector: [0, -1, 0] },
      ];

      const scored = orthogonalPosters
        .map((p) => ({ ...p, sim: cosineSimilarity(queryVec, p.vector) }))
        .filter((p) => p.sim >= MIN_SIMILARITY_THRESHOLD);

      assert.strictEqual(scored.length, 0, 'No debe retornar pósters si ninguno supera 0.45');
    });

    it('4.3 searchHybridPosters maneja queries vacías o espacios sin lanzar excepciones', async () => {
      const resEmpty = await searchHybridPosters({ query: '' });
      assert.ok(Array.isArray(resEmpty), 'Query vacía debe devolver array');
      assert.strictEqual(resEmpty.source, 'lexical');

      const resSpaces = await searchHybridPosters({ query: '   ' });
      assert.ok(Array.isArray(resSpaces), 'Query con espacios debe devolver array');
      assert.strictEqual(resSpaces.source, 'lexical');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 5: Benchmark de Estrés y Medición de Latencia en 1,000 Evaluaciones
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Benchmark de Estrés y Medición de Latencia en 1,000 Evaluaciones', () => {

    it('5.1 1,000 evaluaciones de similitud coseno en 768 dimensiones toman < 15ms', () => {
      const dim = 768;
      const queryVec = Array.from({ length: dim }, () => Math.random() - 0.5);
      const catalogVectors = Array.from({ length: 1000 }, () =>
        Array.from({ length: dim }, () => Math.random() - 0.5)
      );

      for (let i = 0; i < 50; i++) {
        cosineSimilarity(queryVec, catalogVectors[i]);
      }

      const t0 = performance.now();
      let matchesCount = 0;
      for (let i = 0; i < 1000; i++) {
        const sim = cosineSimilarity(queryVec, catalogVectors[i]);
        if (sim >= MIN_SIMILARITY_THRESHOLD) matchesCount++;
      }
      const elapsedMs = performance.now() - t0;

      console.log(`      ⚡ Latencia 1,000 evaluaciones (768 dims): ${elapsedMs.toFixed(3)}ms (Promedio: ${(elapsedMs / 1000).toFixed(4)}ms / eval)`);
      assert.ok(elapsedMs < 15.0, `1,000 evaluaciones tomaron ${elapsedMs.toFixed(2)}ms (debe ser < 15.0ms)`);
    });

    it('5.2 1,000 evaluaciones de similitud coseno en 1536 dimensiones toman < 30ms', () => {
      const dim = 1536;
      const queryVec = Array.from({ length: dim }, () => Math.random() - 0.5);
      const catalogVectors = Array.from({ length: 1000 }, () =>
        Array.from({ length: dim }, () => Math.random() - 0.5)
      );

      const t0 = performance.now();
      let matchesCount = 0;
      for (let i = 0; i < 1000; i++) {
        const sim = cosineSimilarity(queryVec, catalogVectors[i]);
        if (sim >= MIN_SIMILARITY_THRESHOLD) matchesCount++;
      }
      const elapsedMs = performance.now() - t0;

      console.log(`      ⚡ Latencia 1,000 evaluaciones (1536 dims): ${elapsedMs.toFixed(3)}ms (Promedio: ${(elapsedMs / 1000).toFixed(4)}ms / eval)`);
      assert.ok(elapsedMs < 30.0, `1,000 evaluaciones en 1536 dims tomaron ${elapsedMs.toFixed(2)}ms (debe ser < 30.0ms)`);
    });

    it('5.3 Escaneo, filtrado y ordenamiento de catálogo de 300 pósters en RAM toma < 5ms', () => {
      const dim = 768;
      const queryVec = Array.from({ length: dim }, () => Math.random() - 0.5);
      const posters = Array.from({ length: 300 }, (_, i) => ({
        id: `poster-${i}`,
        vector: Array.from({ length: dim }, () => Math.random() - 0.5),
      }));

      const t0 = performance.now();
      const scored = [];
      for (let i = 0; i < posters.length; i++) {
        const sim = cosineSimilarity(queryVec, posters[i].vector);
        if (sim >= MIN_SIMILARITY_THRESHOLD) {
          scored.push({ id: posters[i].id, similarity: sim });
        }
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      const elapsedMs = performance.now() - t0;

      console.log(`      ⚡ Escaneo completo de catálogo (300 pósters en RAM): ${elapsedMs.toFixed(3)}ms`);
      assert.ok(elapsedMs < 5.0, `Escaneo de catálogo tomó ${elapsedMs.toFixed(2)}ms (debe ser < 5.0ms)`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 6: Integridad Sintáctica de Entregables de M1 (aiToolsService.js)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Integridad Sintáctica de Entregables de M1 (aiToolsService.js)', () => {
    it('6.1 server/services/ai/aiToolsService.js debe ser un módulo ESM válido sin SyntaxError', async () => {
      let syntaxError = null;
      try {
        await import('../../server/services/ai/aiToolsService.js');
      } catch (err) {
        syntaxError = err;
      }
      assert.strictEqual(syntaxError, null, `CRITICAL: aiToolsService.js tiene un SyntaxError fatal en producción: ${syntaxError?.message}`);
    });
  });
});
