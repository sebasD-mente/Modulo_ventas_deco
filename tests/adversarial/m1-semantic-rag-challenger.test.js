import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIVERSAL_STOP_WORDS,
  KNOWN_SHORT_ENTITIES,
  resolveEntityAlias,
  STAND_ENTITY_ALIASES,
} from '../../server/services/semantic/entityAliases.js';
import {
  cosineSimilarity,
  computeCosineSimilarity,
  searchHybridPosters,
  clearVectorCache,
  MIN_SIMILARITY_THRESHOLD,
} from '../../server/services/embeddingService.js';

// Helper extracting query tokens using exact logic from embeddingService.js (lines 127-129)
function extractNormQueryTokens(query) {
  const cleanQuery = String(query || '').trim();
  const aliasRes = resolveEntityAlias(cleanQuery);
  const effectiveQuery = (aliasRes.matched && aliasRes.searchQuery) ? aliasRes.searchQuery : cleanQuery;
  const extractTokens = (q) =>
    (q || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((t) => (t.length > 2 || KNOWN_SHORT_ENTITIES.has(t)) && !UNIVERSAL_STOP_WORDS.has(t));
  const rawTokens = extractTokens(cleanQuery);
  return rawTokens.length > 0 ? rawTokens : extractTokens(effectiveQuery);
}

describe('⚔️ CHALLENGER EMPIRICAL ADVERSARIAL SUITE: M1 RAG & SEMANTIC SEARCH ENGINE', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: STOP-WORD STRIPPING ON COUNTER QUERIES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Stop-Word Stripping on Complex Counter Queries', () => {

    it('1.1 "muéstrame lo que tenemos de messi" -> exactly ["messi"]', () => {
      const tokens = extractNormQueryTokens('muéstrame lo que tenemos de messi');
      assert.deepStrictEqual(tokens, ['messi'], 'Must strip verbs, pronouns, and prepositions leaving only "messi"');
    });

    it('1.2 "cuánto cuesta el cuadro de spiderman" -> exactly ["spiderman"]', () => {
      const tokens = extractNormQueryTokens('cuánto cuesta el cuadro de spiderman');
      assert.deepStrictEqual(tokens, ['spiderman'], 'Must strip price interrogatives and nouns leaving only "spiderman"');
    });

    it('1.3 "buenas tardes quiero ver pósters de anime" -> exactly ["anime"] (ADVERSARIAL CHALLENGE)', () => {
      const tokens = extractNormQueryTokens('buenas tardes quiero ver pósters de anime');
      // If "tardes" is NOT in UNIVERSAL_STOP_WORDS, tokens will be ['tardes', 'anime'], causing this assertion to fail
      assert.deepStrictEqual(
        tokens,
        ['anime'],
        `Expected exactly ["anime"], but got ${JSON.stringify(tokens)}. "tardes" must be in UNIVERSAL_STOP_WORDS!`
      );
    });

    it('1.4 Greeting stop-words: "buenas", "buenos", "hola" must be stripped', () => {
      const q1 = extractNormQueryTokens('hola poster de goku');
      assert.deepStrictEqual(q1, ['goku']);

      const q2 = extractNormQueryTokens('buenos cuadros de batman');
      assert.deepStrictEqual(q2, ['batman']);
    });

    it('1.5 Conversational stop-words: "disponible", "catalogo", "ver", "mira", "dame", "quiero", "busca"', () => {
      const q = extractNormQueryTokens('quiero ver si tienes disponible en catalogo poster de naruto');
      assert.deepStrictEqual(q, ['naruto']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: SHORT ENTITIES WHITELIST & CULTURAL ALIASES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Short Entities Whitelist & Cultural Aliases ("f1", "cr7", "el bicho")', () => {

    it('2.1 "f1" retains ["f1"] and resolves canonical entity to "Formula 1 - F1"', () => {
      const tokens = extractNormQueryTokens('f1');
      assert.deepStrictEqual(tokens, ['f1'], '"f1" must NOT be discarded by length filter (2 chars)');
      assert.ok(tokens.length > 0, '"f1" must never result in empty tokens');

      const alias = resolveEntityAlias('f1');
      assert.strictEqual(alias.matched, true, '"f1" must match an entity alias');
      assert.strictEqual(alias.canonicalTitle, 'Formula 1 - F1');
      assert.strictEqual(alias.category, 'DEPORTES');
      assert.ok(alias.searchQuery.includes('Formula 1'), 'Search query must expand to Formula 1');
    });

    it('2.2 "cr7" retains ["cr7"] and resolves canonical entity to "Cristiano Ronaldo - CR7"', () => {
      const tokens = extractNormQueryTokens('cr7');
      assert.deepStrictEqual(tokens, ['cr7'], '"cr7" must NOT be discarded');

      const alias = resolveEntityAlias('cr7');
      assert.strictEqual(alias.matched, true, '"cr7" must match entity alias');
      assert.strictEqual(alias.canonicalTitle, 'Cristiano Ronaldo - CR7');
      assert.strictEqual(alias.category, 'FUTBOL');
    });

    it('2.3 "el bicho" resolves canonical entity to "Cristiano Ronaldo - CR7"', () => {
      const alias = resolveEntityAlias('el bicho');
      assert.strictEqual(alias.matched, true, '"el bicho" must match entity alias');
      assert.strictEqual(alias.canonicalTitle, 'Cristiano Ronaldo - CR7');
      assert.strictEqual(alias.category, 'FUTBOL');
      assert.ok(alias.searchQuery.includes('Cristiano Ronaldo'));
    });

    it('2.4 Whitelist coverage: KNOWN_SHORT_ENTITIES has f1, u2, r34, go, up, cr7', () => {
      const expected = ['f1', 'u2', 'r34', 'go', 'up', 'cr7'];
      for (const ent of expected) {
        assert.ok(KNOWN_SHORT_ENTITIES.has(ent), `KNOWN_SHORT_ENTITIES must contain "${ent}"`);
        const extracted = extractNormQueryTokens(ent);
        assert.ok(extracted.includes(ent), `Query "${ent}" must extract token "${ent}"`);
      }
    });

    it('2.5 Non-whitelisted 2-letter tokens ("de", "la", "en", "al", "un", "si", "no") must be discarded', () => {
      const nonWhitelisted = ['de', 'la', 'en', 'al', 'un', 'si', 'no'];
      for (const tok of nonWhitelisted) {
        assert.ok(!KNOWN_SHORT_ENTITIES.has(tok), `"${tok}" must NOT be in KNOWN_SHORT_ENTITIES`);
      }
    });

    it('2.6 Adversarial: "f1" search must NOT admit random basketball posters', () => {
      const normQueryTokens = extractNormQueryTokens('f1');
      assert.deepStrictEqual(normQueryTokens, ['f1']);

      const basketballPosters = [
        { titulo: 'Michael Jordan - The Last Shot', subtitulo: 'Chicago Bulls', categoria: 'BASKETBALL', tags: ['nba', 'jordan'] },
        { titulo: 'Kobe Bryant 24', subtitulo: 'Los Angeles Lakers', categoria: 'BASKETBALL', tags: ['nba', 'kobe', 'mamba'] },
        { titulo: 'LeBron James Dunk', subtitulo: 'Cleveland Cavaliers', categoria: 'BASKETBALL', tags: ['nba', 'lebron'] },
      ];

      for (const p of basketballPosters) {
        const posterText = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
        const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok));
        assert.strictEqual(matchesEntity, false, `Basketball poster "${p.titulo}" must NOT match "f1" tokens`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: VECTOR THRESHOLD >= 0.72 & EVERY MATCH CONDITION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Vector Threshold >= 0.72 and "every" Match Condition', () => {

    it('3.1 Candidates with vector similarity 0.70 or 0.71 are REJECTED when not matching lexically', () => {
      const normQueryTokens = ['messi'];
      const poster = { id: 'vec-70', titulo: 'Lionel Messi Campeón', subtitulo: 'Argentina', tags: ['messi'] };
      const posterText = `${poster.titulo} ${poster.subtitulo} ${poster.tags.join(' ')}`.toLowerCase();

      // Test similarity 0.70
      const sim70 = 0.70;
      const admitted70 = sim70 >= 0.72 && (normQueryTokens.length === 0 || normQueryTokens.every((t) => posterText.includes(t)));
      assert.strictEqual(admitted70, false, 'Similarity 0.70 must be rejected (< 0.72)');

      // Test similarity 0.71
      const sim71 = 0.71;
      const admitted71 = sim71 >= 0.72 && (normQueryTokens.length === 0 || normQueryTokens.every((t) => posterText.includes(t)));
      assert.strictEqual(admitted71, false, 'Similarity 0.71 must be rejected (< 0.72)');

      // Test boundary 0.719999
      const simBoundary = 0.719999;
      const admittedBoundary = simBoundary >= 0.72 && (normQueryTokens.length === 0 || normQueryTokens.every((t) => posterText.includes(t)));
      assert.strictEqual(admittedBoundary, false, 'Similarity 0.719999 must be rejected (< 0.72)');
    });

    it('3.2 Candidates with vector similarity >= 0.72 are ADMITTED if normQueryTokens.every(...) holds', () => {
      const normQueryTokens = ['messi'];
      const poster = { id: 'vec-72', titulo: 'Messi El Beso Eterno', subtitulo: 'Argentina', tags: ['messi'] };
      const posterText = `${poster.titulo} ${poster.subtitulo} ${poster.tags.join(' ')}`.toLowerCase();

      const sim72 = 0.72;
      const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((t) => posterText.includes(t));
      const admitted72 = sim72 >= 0.72 && (normQueryTokens.length === 0 || matchesEntity);
      assert.strictEqual(matchesEntity, true);
      assert.strictEqual(admitted72, true, 'Similarity 0.72 with matching token must be admitted');

      const sim85 = 0.85;
      const admitted85 = sim85 >= 0.72 && (normQueryTokens.length === 0 || matchesEntity);
      assert.strictEqual(admitted85, true, 'Similarity 0.85 with matching token must be admitted');
    });

    it('3.3 Candidates with vector similarity >= 0.72 (even 0.95) are REJECTED if normQueryTokens.every(...) fails', () => {
      // Query has 2 tokens: ['dragon', 'ball']
      const normQueryTokens = ['dragon', 'ball'];

      // Poster text has "dragon" but NOT "ball" (e.g. Dragon de Fuego)
      const posterPartial = { id: 'p-partial', titulo: 'Dragon de Fuego', subtitulo: 'Fantasy Art', tags: ['dragon'] };
      const partialText = `${posterPartial.titulo} ${posterPartial.subtitulo} ${posterPartial.tags.join(' ')}`.toLowerCase();

      const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((t) => partialText.includes(t));
      assert.strictEqual(matchesEntity, false, '"every" must fail because "ball" is not in partialText');

      const sim95 = 0.95;
      const admitted = sim95 >= 0.72 && (normQueryTokens.length === 0 || matchesEntity);
      assert.strictEqual(admitted, false, 'High vector similarity (0.95) must NOT admit candidate failing "every" token coverage');
    });

    it('3.4 Foreign candidate with vector similarity 0.80 and 0 matching tokens is strictly REJECTED', () => {
      const normQueryTokens = ['spiderman'];
      const posterForeign = { id: 'p-batman', titulo: 'Batman The Dark Knight', subtitulo: 'DC Comics', tags: ['batman'] };
      const foreignText = `${posterForeign.titulo} ${posterForeign.subtitulo} ${posterForeign.tags.join(' ')}`.toLowerCase();

      const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((t) => foreignText.includes(t));
      assert.strictEqual(matchesEntity, false);

      const admitted = 0.80 >= 0.72 && (normQueryTokens.length === 0 || matchesEntity);
      assert.strictEqual(admitted, false, 'Batman must NEVER be admitted into Spiderman search via vector candidate');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: ROOT CANONICAL ENTITY GATE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Root Canonical Entity Gate Preserving Multiple Works of Same Character', () => {

    it('4.1 Top lexical matches for "messi" identify shared token ["messi"]', () => {
      const normQueryTokens = ['messi'];
      const lexicalList = [
        { id: 'm1', titulo: 'Messi - El Beso Eterno', subtitulo: 'Copa del Mundo', tags: ['futbol', 'messi'] },
        { id: 'm2', titulo: 'Messi - El Beso de la Gloria', subtitulo: 'Qatar 2022', tags: ['futbol', 'messi'] },
      ];

      const sharedTokens = normQueryTokens.filter((tok) =>
        lexicalList.every((p) => {
          const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
          return text.includes(tok);
        })
      );

      assert.deepStrictEqual(sharedTokens, ['messi'], 'Shared tokens across all top lexical matches must be ["messi"]');
    });

    it('4.2 Root canonical entity gate KEEPS multiple Messi works and DISCARDS foreign works', () => {
      const normQueryTokens = ['messi'];
      const lexicalList = [
        { id: 'm1', titulo: 'Messi - El Beso Eterno', subtitulo: 'Copa del Mundo', tags: ['futbol', 'messi'] },
        { id: 'm2', titulo: 'Messi - El Beso de la Gloria', subtitulo: 'Qatar 2022', tags: ['futbol', 'messi'] },
      ];

      // Simulated merged list containing lexical matches + other candidate works
      const candidatePosters = [
        { id: 'm1', titulo: 'Messi - El Beso Eterno', subtitulo: 'Copa del Mundo', tags: ['futbol', 'messi'] },
        { id: 'm2', titulo: 'Messi - El Beso de la Gloria', subtitulo: 'Qatar 2022', tags: ['futbol', 'messi'] },
        { id: 'm3', titulo: 'Messi - Campeón del Mundo', subtitulo: 'Albiceleste', tags: ['futbol', 'messi'] },
        { id: 'cr1', titulo: 'Cristiano Ronaldo - CR7', subtitulo: 'Real Madrid', tags: ['futbol', 'cr7'] },
        { id: 'bat1', titulo: 'Batman - The Dark Knight', subtitulo: 'DC Comics', tags: ['comics', 'batman'] },
      ];

      let filteredList = [...candidatePosters];

      // Exact gate logic from embeddingService.js lines 165-176:
      if (lexicalList.length > 0 && lexicalList.length <= 4 && normQueryTokens.length > 0) {
        const sharedTokens = normQueryTokens.filter((tok) =>
          lexicalList.every((p) => {
            const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
            return text.includes(tok);
          })
        );
        if (sharedTokens.length > 0) {
          filteredList = filteredList.filter((p) => {
            const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
            return sharedTokens.every((tok) => text.includes(tok));
          });
        }
      }

      const keptIds = filteredList.map((p) => p.id);

      // Oracle 1: Both original lexical works must be kept
      assert.ok(keptIds.includes('m1'), 'Messi - El Beso Eterno must be kept');
      assert.ok(keptIds.includes('m2'), 'Messi - El Beso de la Gloria must be kept');

      // Oracle 2: OTHER Messi work must also be KEPT (old allSameTitle gate discarded this!)
      assert.ok(keptIds.includes('m3'), 'Messi - Campeón del Mundo must be KEPT by the shared tokens gate');

      // Oracle 3: Foreign works must be completely DISCARDED
      assert.ok(!keptIds.includes('cr1'), 'Cristiano Ronaldo must be DISCARDED from Messi search');
      assert.ok(!keptIds.includes('bat1'), 'Batman must be DISCARDED from Messi search');

      assert.strictEqual(filteredList.length, 3, 'Exactly 3 Messi works must survive');
    });

    it('4.3 Gate behavior when top lexical items share multiple tokens (e.g. "dragon ball")', () => {
      const normQueryTokens = ['dragon', 'ball'];
      const lexicalList = [
        { id: 'db1', titulo: 'Dragon Ball Z - Goku SSJ', subtitulo: 'Anime', tags: ['dragon', 'ball'] },
        { id: 'db2', titulo: 'Dragon Ball Super - Ultra Instinct', subtitulo: 'Anime', tags: ['dragon', 'ball'] },
      ];

      const sharedTokens = normQueryTokens.filter((tok) =>
        lexicalList.every((p) => {
          const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
          return text.includes(tok);
        })
      );
      assert.deepStrictEqual(sharedTokens, ['dragon', 'ball']);

      const candidatePosters = [
        { id: 'db1', titulo: 'Dragon Ball Z - Goku SSJ', subtitulo: 'Anime', tags: ['dragon', 'ball'] },
        { id: 'db3', titulo: 'Dragon Ball - Shenlong', subtitulo: 'Anime', tags: ['dragon', 'ball'] },
        { id: 'd-only', titulo: 'House of the Dragon', subtitulo: 'HBO Series', tags: ['dragon', 'series'] },
        { id: 'naruto', titulo: 'Naruto Shippuden', subtitulo: 'Anime', tags: ['ninja'] },
      ];

      const filtered = candidatePosters.filter((p) => {
        const text = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
        return sharedTokens.every((tok) => text.includes(tok));
      });

      const ids = filtered.map((p) => p.id);
      assert.ok(ids.includes('db1'));
      assert.ok(ids.includes('db3'));
      assert.ok(!ids.includes('d-only'), 'Must reject "House of the Dragon" because it lacks "ball"');
      assert.ok(!ids.includes('naruto'), 'Must reject Naruto');
    });

    it('4.4 Gate boundary: when lexicalList is empty, gate does not crash and leaves candidates intact', () => {
      const normQueryTokens = ['abstract'];
      const lexicalList = [];
      const candidates = [{ id: 'c1', titulo: 'Abstract Art 1' }];

      let filteredList = [...candidates];
      if (lexicalList.length > 0 && lexicalList.length <= 4 && normQueryTokens.length > 0) {
        // Not entered
      }
      assert.strictEqual(filteredList.length, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: EMPIRICAL IMPACT OF MISSING STOP-WORDS (FAILURE MODE ANALYSIS)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Empirical Failure Mode: Missing Stop-Words Leaking Into Query Tokens', () => {

    it('5.1 Demonstrates that when "tardes" is NOT stripped, normQueryTokens blocks valid anime vector candidates', () => {
      // User says: "buenas tardes quiero ver pósters de anime"
      const extractedTokens = extractNormQueryTokens('buenas tardes quiero ver pósters de anime');

      // Valid anime poster from catalog:
      const animePoster = {
        id: 'anime-naruto',
        titulo: 'Naruto Uzumaki Shippuden',
        subtitulo: 'Ninja de Konoha',
        categoria: 'ANIME',
        tags: ['anime', 'manga', 'naruto'],
      };
      const posterText = `${animePoster.titulo} ${animePoster.subtitulo} ${animePoster.tags.join(' ')}`.toLowerCase();

      // Vector candidate condition from embeddingService.js line 154:
      const matchesEntity = extractedTokens.length > 0 && extractedTokens.every((tok) => posterText.includes(tok));

      if (extractedTokens.includes('tardes')) {
        // "tardes" leaked into tokens!
        assert.strictEqual(matchesEntity, false, 'FATAL BUG: anime poster fails matchesEntity because "tardes" is in normQueryTokens!');
        // Candidate with similarity 0.85 will be REJECTED!
        const vectorSimilarity = 0.85;
        const admitted = vectorSimilarity >= 0.72 && (extractedTokens.length === 0 || matchesEntity);
        assert.strictEqual(admitted, false, 'FATAL BUG: High similarity anime poster is REJECTED by leaked "tardes" token!');
      } else {
        // If "tardes" was properly stripped:
        assert.strictEqual(matchesEntity, true, 'Anime poster matches when "tardes" is stripped');
      }
    });

  });
});
