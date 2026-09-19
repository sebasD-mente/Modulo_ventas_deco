/**
 * ⚔️ CHALLENGER 1 — MILESTONE 3: ADVERSARIAL EMPIRICAL STRESS TEST SUITE
 * 
 * Domain: Lexical Matching & Word Boundaries in Catalog (R1 - "Bug del Ramen")
 * Target: server/services/catalog/webCatalogService.js
 * Roles: critic, specialist (Empirical Challenger)
 * 
 * Objectives:
 * 1. Substring injection (<4 chars like "IT", "UP", "300", "EL", "A") inside common words.
 * 2. Legitimate queries with isolated short titles ("Quiero IT", "Póster de UP", "Póster 300").
 * 3. Stop words and diacritics handling ("el", "la", "de", "con", "sin", accents, ñ).
 * 4. Regex special characters in titles (+, *, ?, $, ^, parenthesis, brackets, dots).
 * 5. Dual signature verification: (query, catalog, requestedSize) vs (tenantId, clean, requestedSize).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  findLocalMatch,
  matchesCatalogWordBoundary,
  normalizeMatcherString,
  stemMatcherToken,
  EXTENDED_STOP_WORDS,
  STANDARD_SIZES,
} from '../../server/services/catalog/webCatalogService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { prisma } from '../../server/config/prisma.js';

// Standard adversarial catalog containing short title products
const MOCK_ADVERSARIAL_CATALOG = [
  {
    id: 'prod-it-01',
    sku: 'DV-IT-01',
    name: 'IT',
    titulo: 'IT',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-up-01',
    sku: 'DV-UP-01',
    name: 'UP',
    titulo: 'UP',
    category: 'INFANTIL',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-300-01',
    sku: 'DV-300-01',
    name: '300',
    titulo: '300',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-lord-rings-01',
    sku: 'DV-LOTR-01',
    name: 'El Señor de los Anillos',
    titulo: 'El Señor de los Anillos',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-amelie-01',
    sku: 'DV-AMELIE-01',
    name: 'Amélie',
    titulo: 'Amélie',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-spiderman-1994',
    sku: 'DV-SPID-94',
    name: 'Spider-Man (1994)',
    titulo: 'Spider-Man (1994)',
    category: 'SUPERHEROES',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-who-framed-01',
    sku: 'DV-ROGER-01',
    name: 'Who Framed Roger Rabbit?',
    titulo: 'Who Framed Roger Rabbit?',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-mash-01',
    sku: 'DV-MASH-01',
    name: 'M*A*S*H',
    titulo: 'M*A*S*H',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-topgun-plus',
    sku: 'DV-TGPLUS-01',
    name: 'Top Gun + Maverick',
    titulo: 'Top Gun + Maverick',
    category: 'CINE',
    basePrice: 65,
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
];

// Specialized catalog with single letter products A and EL for isolated stress-testing
const MOCK_SINGLE_CHAR_CATALOG = [
  {
    id: 'prod-a-01',
    sku: 'DV-A-01',
    name: 'A',
    titulo: 'A',
    category: 'ARTE',
    basePrice: 65,
  },
  {
    id: 'prod-el-01',
    sku: 'DV-EL-01',
    name: 'EL',
    titulo: 'EL',
    category: 'ARTE',
    basePrice: 65,
  },
];

describe('⚔️ CHALLENGER 1 (M3): Lexical Matching & Word Boundaries Stress Suite', () => {
  const TEST_TENANT = 't-challenger1-m3';

  beforeEach(() => {
    invalidateCatalogCache(TEST_TENANT);
    prisma.product = {
      findMany: async () => MOCK_ADVERSARIAL_CATALOG,
      findFirst: async () => null,
    };
    productCache.set(TEST_TENANT, {
      timestamp: Date.now(),
      products: MOCK_ADVERSARIAL_CATALOG,
    });
  });

  describe('1. Inyección de Substrings Cortos (< 4 chars) en Palabras Comunes', () => {
    it('1.1 Substring "IT" embebido en palabras comunes JAMÁS debe emparejar con el póster "IT"', async () => {
      const baitQueries = [
        'traditional',
        'traditional japanese tonkotsu ramen',
        'edición limitada',
        'habitacion',
        'circuito cerrado',
        'delicado',
        'superficial',
        'melodía',
        'castillo',
        'edición',
        'límite de velocidad',
        'espíritu',
      ];

      for (const query of baitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta "${query}" contiene accidentalmente "it" y NO debe emparejar con IT`
        );
      }
    });

    it('1.2 Substring "UP" embebido en palabras comunes JAMÁS debe emparejar con "UP"', async () => {
      const baitQueries = [
        'superficial',
        'cupido',
        'grupo musical',
        'duplicado',
        'ocupado',
        'super mario bros',
        'erupcion volcanica',
      ];

      for (const query of baitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta "${query}" contiene "up" dentro de una palabra y NO debe emparejar con UP`
        );
      }
    });

    it('1.3 Substring "300" embebido en números más largos o cadenas alfanuméricas NO empareja con "300"', async () => {
      const baitQueries = [
        '3000',
        '30000',
        'espacio300',
        '300km',
        'modelo300x',
      ];

      for (const query of baitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta "${query}" NO debe emparejar con 300 por falta de límite de palabra`
        );
      }
    });

    it('1.4 Letra aislada "A" embebida dentro de palabras comunes JAMÁS empareja con "A"', async () => {
      const baitQueries = [
        'castillo',
        'melodía',
        'delicado',
        'fantasia',
        'casa',
        'mariposa',
      ];

      for (const query of baitQueries) {
        const match = await findLocalMatch(query, MOCK_SINGLE_CHAR_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta "${query}" contiene la letra 'a' dentro de palabras y NO debe emparejar con "A"`
        );
      }
    });

    it('1.5 Substring "EL" embebido dentro de palabras comunes JAMÁS empareja con "EL" o productos con "el"', async () => {
      const baitQueries = [
        'melodía',
        'delicado',
        'hotel',
        'papel',
        'caramelo',
      ];

      for (const query of baitQueries) {
        const match = await findLocalMatch(query, MOCK_SINGLE_CHAR_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta "${query}" contiene "el" dentro de palabras y NO debe emparejar con "EL"`
        );
      }
    });
  });

  describe('2. Consultas Legítimas con Títulos Cortos Aislados', () => {
    it('2.1 "Quiero IT" y variantes con palabra completa legítima emparejan exitosamente con "IT"', async () => {
      const legitQueries = [
        'Quiero IT',
        'póster de IT',
        'pelicula IT',
        'IT',
        'el poster de it por favor',
        'IT de stephen king',
      ];

      for (const query of legitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.ok(match !== null, `"${query}" debería emparejar legítimamente con IT`);
        assert.strictEqual(match.baseTitle, 'IT');
      }
    });

    it('2.2 "Póster de UP" y variantes legítimas emparejan exitosamente con "UP"', async () => {
      const legitQueries = [
        'Póster de UP',
        'Quiero UP',
        'UP',
        'película UP de pixar',
        'UP en grande',
      ];

      for (const query of legitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.ok(match !== null, `"${query}" debería emparejar legítimamente con UP`);
        assert.strictEqual(match.baseTitle, 'UP');
      }
    });

    it('2.3 "Póster 300" y variantes legítimas emparejan exitosamente con "300"', async () => {
      const legitQueries = [
        'Póster 300',
        '300',
        'Quiero 300',
        'pelicula 300 espartanos',
        'el poster de 300',
      ];

      for (const query of legitQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.ok(match !== null, `"${query}" debería emparejar legítimamente con 300`);
        assert.strictEqual(match.baseTitle, '300');
      }
    });
  });

  describe('3. Manejo de Stop Words y Diacríticos', () => {
    it('3.1 Consultas que consisten ÚNICAMENTE en stop words son rechazadas en catálogo general', async () => {
      const stopWordQueries = [
        'el',
        'la',
        'de',
        'con',
        'sin',
        'por',
        'para',
        'un',
        'una',
        'los',
        'las',
        'y',
        'o',
      ];

      for (const query of stopWordQueries) {
        const match = await findLocalMatch(query, MOCK_ADVERSARIAL_CATALOG);
        assert.strictEqual(
          match,
          null,
          `La consulta stopword "${query}" debe ser rechazada de inmediato y no emparejar nada`
        );
      }
    });

    it('3.2 Comportamiento de stop words ante productos con nombres coincidentes con stopwords ("EL")', async () => {
      // Coincidencia exacta estricta (pNorm === cleanNorm)
      const exactMatch = await findLocalMatch('EL', MOCK_SINGLE_CHAR_CATALOG);
      assert.ok(exactMatch !== null);
      assert.strictEqual(exactMatch.baseTitle, 'EL');

      // Frase que incluye la stopword ("Quiero el") NO debe emparejar con el producto "EL"
      const phraseMatch = await findLocalMatch('Quiero el', MOCK_SINGLE_CHAR_CATALOG);
      assert.strictEqual(phraseMatch, null, '"Quiero el" debe ser filtrado por EXTENDED_STOP_WORDS');
    });

    it('3.3 Títulos legítimos que incorporan stop words ("El Señor de los Anillos") emparejan correctamente', async () => {
      const match = await findLocalMatch('Quiero El Señor de los Anillos', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(match !== null, 'Debe emparejar con El Señor de los Anillos');
      assert.strictEqual(match.baseTitle, 'El Señor de los Anillos');
    });

    it('3.4 Diacríticos (tildes) son normalizados con paridad bidireccional', async () => {
      // Obra con tilde en catálogo ("Amélie") buscada sin tilde ("amelie")
      const matchWithoutAccent = await findLocalMatch('Quiero poster de amelie', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(matchWithoutAccent !== null, 'amelie sin tilde debe emparejar con Amélie');
      assert.strictEqual(matchWithoutAccent.baseTitle, 'Amélie');

      // Obra buscada con tilde ("Póster de IT")
      const matchWithAccent = await findLocalMatch('Póster de IT', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(matchWithAccent !== null);
      assert.strictEqual(matchWithAccent.baseTitle, 'IT');
    });
  });

  describe('4. Caracteres Especiales de Regex en Títulos (+, *, ?, $, ^)', () => {
    it('4.1 matchesCatalogWordBoundary y findLocalMatch manejan metacaracteres de regex sin lanzar excepciones', async () => {
      const specialCharQueries = [
        'C++',
        'M*A*S*H',
        'Who Framed Roger Rabbit?',
        'Spider-Man (1994)',
        'Top Gun + Maverick',
        '$uicideboy$',
        'What if...?',
        'Up ^ Away',
        'Terminator 2: Judgment Day [Special]',
      ];

      for (const query of specialCharQueries) {
        assert.doesNotThrow(
          () => matchesCatalogWordBoundary('test ' + query + ' test', query),
          `matchesCatalogWordBoundary no debe lanzar SyntaxError para "${query}"`
        );
      }
    });

    it('4.2 Obras con caracteres especiales normalizados (parentesis, interrogación, asterisco, más) emparejan legítimamente', async () => {
      // Spider-Man (1994)
      const spideyMatch = await findLocalMatch('Spider-Man (1994)', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(spideyMatch !== null, 'Debe emparejar Spider-Man (1994)');
      assert.strictEqual(spideyMatch.baseTitle, 'Spider-Man (1994)');

      // Who Framed Roger Rabbit?
      const rogerMatch = await findLocalMatch('Who Framed Roger Rabbit?', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(rogerMatch !== null, 'Debe emparejar Who Framed Roger Rabbit?');
      assert.strictEqual(rogerMatch.baseTitle, 'Who Framed Roger Rabbit?');

      // M*A*S*H
      const mashMatch = await findLocalMatch('M*A*S*H', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(mashMatch !== null, 'Debe emparejar M*A*S*H');
      assert.strictEqual(mashMatch.baseTitle, 'M*A*S*H');

      // Top Gun + Maverick
      const topGunMatch = await findLocalMatch('Top Gun + Maverick', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(topGunMatch !== null, 'Debe emparejar Top Gun + Maverick');
      assert.strictEqual(topGunMatch.baseTitle, 'Top Gun + Maverick');
    });

    it('4.3 Caso límite adversarial: M*A*S*H normalizado genera tokens aislados m a s h', () => {
      const norm = normalizeMatcherString('M*A*S*H');
      assert.strictEqual(norm, 'm a s h', 'Los asteriscos deben ser convertidos a espacios');
      // Verificamos que matchesCatalogWordBoundary no colisione con palabras enteras distintas
      assert.strictEqual(matchesCatalogWordBoundary('mashup party', 'm a s h'), false);
    });
  });

  describe('5. Verificación de la Firma Dual de findLocalMatch', () => {
    it('5.1 Firma 1: findLocalMatch(query, catalog, requestedSize)', async () => {
      // Sin requestedSize
      const res1 = await findLocalMatch('IT', MOCK_ADVERSARIAL_CATALOG);
      assert.ok(res1 !== null);
      assert.strictEqual(res1.baseTitle, 'IT');
      assert.strictEqual(res1.sizeId, 'MEDIANO');
      assert.strictEqual(res1.unitPrice, 65);

      // Con requestedSize = 'GRANDE'
      const res2 = await findLocalMatch('IT', MOCK_ADVERSARIAL_CATALOG, 'GRANDE');
      assert.ok(res2 !== null);
      assert.strictEqual(res2.baseTitle, 'IT');
      assert.strictEqual(res2.sizeId, 'GRANDE');
      assert.strictEqual(res2.unitPrice, 125);
    });

    it('5.2 Firma 2: findLocalMatch(tenantId, clean, requestedSize)', async () => {
      // Sin requestedSize
      const res1 = await findLocalMatch(TEST_TENANT, 'IT');
      assert.ok(res1 !== null);
      assert.strictEqual(res1.baseTitle, 'IT');
      assert.strictEqual(res1.sizeId, 'MEDIANO');

      // Con requestedSize = 'GRANDE'
      const res2 = await findLocalMatch(TEST_TENANT, 'IT', 'GRANDE');
      assert.ok(res2 !== null);
      assert.strictEqual(res2.baseTitle, 'IT');
      assert.strictEqual(res2.sizeId, 'GRANDE');
      assert.strictEqual(res2.unitPrice, 125);
    });

    it('5.3 Manejo robusto de entradas nulas, vacías o malformadas en ambas firmas', async () => {
      const invalidInputs = [
        [null, MOCK_ADVERSARIAL_CATALOG],
        [undefined, MOCK_ADVERSARIAL_CATALOG],
        ['', MOCK_ADVERSARIAL_CATALOG],
        ['   ', MOCK_ADVERSARIAL_CATALOG],
        [TEST_TENANT, null],
        [TEST_TENANT, undefined],
        [TEST_TENANT, ''],
        [TEST_TENANT, '   '],
      ];

      for (const [arg1, arg2] of invalidInputs) {
        const res = await findLocalMatch(arg1, arg2);
        assert.strictEqual(res, null, `Entrada inválida (${arg1}, ${arg2}) debe retornar null de forma segura`);
      }
    });
  });
});
