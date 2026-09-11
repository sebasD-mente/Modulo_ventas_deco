import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deduplicatePosters,
  extractImageSlug,
  normalizePosterTitle,
  extractPosterTitle,
} from '../server/services/webCatalogService.js';

import {
  extractPaymentMethod,
  resolveEntityAlias,
  normalizeArtworkQuery,
  parseStandIntent,
  normalizeSemanticText,
} from '../server/services/semanticParserService.js';

import {
  normalizeCatalogSizeId,
  constructDraftPayload,
} from '../server/services/aiMultimodalService.js';

describe('⚔️ ADVERSARIAL STRESS HARNESS — HITO M1 (STAND {IA})', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DEDUPLICATE POSTERS: STRESS, EDGE CASES & EXTREME INPUTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Stress Testing deduplicatePosters & extractImageSlug', () => {
    it('1.1 extractImageSlug con URLs malformadas y exóticas no debe lanzar excepciones', () => {
      const maliciousAndWeirdUrls = [
        'javascript:alert("xss")',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'https://',
        'http://///',
        'file:///C:/Users/test/image.jpg',
        'ftp://anonymous@ftp.example.com/pub/file.png',
        'https://example.com/???query=1&token=abc#frag?other=2',
        'https://cdn.example.com/%E0%A4%A/poster.webp', // Malformed/special URI component
        'https://cdn.example.com/%ZZ/invalid-percent.png', // Hex inválido
        'https://cdn.example.com/' + 'a'.repeat(5000) + '.jpg', // URL gigante
        'https://cdn.example.com/poster.v2.min.large.500x750.webp?v=1#preview',
        '   https://cdn.example.com/spaced-image.jpg   ',
        'https://cdn.example.com/no-extension',
        null,
        undefined,
        '',
        12345,
        {},
        [],
      ];

      for (const url of maliciousAndWeirdUrls) {
        assert.doesNotThrow(() => {
          const slug = extractImageSlug(url);
          // Si retorna slug, debe ser string no vacío o null
          if (slug !== null) {
            assert.strictEqual(typeof slug, 'string');
            assert.ok(slug.length > 0);
          }
        }, `Falló extractImageSlug con URL: ${String(url).slice(0, 40)}`);
      }
    });

    it('1.2 normalizePosterTitle con caracteres Unicode exóticos, emojis y diacríticos combinados', () => {
      // Emojis removidos y normalizados
      const withEmojis = normalizePosterTitle('Bad Bunny 🐰 - Un Verano Sin Ti 🏖️');
      assert.strictEqual(withEmojis, 'bad bunny un verano sin ti');

      // Variantes de comillas y apóstrofes colapsados
      const quotes1 = normalizePosterTitle('Taylor Swift: "1989" (Taylor\'s Version)');
      const quotes2 = normalizePosterTitle('Taylor Swift - 1989 (Taylors Version)');
      const quotes3 = normalizePosterTitle('Taylor Swift: «1989» (Taylor’s Version)');
      assert.strictEqual(quotes1, quotes2);
      assert.strictEqual(quotes1, quotes3);

      // Zonas de puntuación agresiva
      assert.strictEqual(
        normalizePosterTitle('!!!Spider-Man... vs. The Sinister Six??? (1964)***'),
        'spider man vs the sinister six 1964'
      );

      // Cero-width spaces y caracteres invisibles no deben romper
      assert.doesNotThrow(() => {
        normalizePosterTitle('Goku\u200B\u200C\u200DUltra\uFEFFInstinct');
      });
    });

    it('1.3 Diferenciación estricta de obras del mismo artista con nombres similares', () => {
      const posters = [
        { id: '1', name: 'Taylor Swift - 1989', imageUrl: 'https://cdn/1989.jpg' },
        { id: '2', name: 'Taylor Swift - 1989 (Taylor\'s Version)', imageUrl: 'https://cdn/1989-tv.jpg' },
        { id: '3', name: 'Taylor Swift - 1989 Deluxe Edition', imageUrl: 'https://cdn/1989-deluxe.jpg' },
        { id: '4', name: 'Taylor Swift - Red', imageUrl: 'https://cdn/red.jpg' },
        { id: '5', name: 'Taylor Swift - Red (Taylor\'s Version)', imageUrl: 'https://cdn/red-tv.jpg' },
        { id: '6', name: 'Spider-Man 1', imageUrl: 'https://cdn/sm1.jpg' },
        { id: '7', name: 'Spider-Man 2', imageUrl: 'https://cdn/sm2.jpg' },
        { id: '8', name: 'Spider-Man 3', imageUrl: 'https://cdn/sm3.jpg' },
      ];

      const deduplicated = deduplicatePosters(posters);
      assert.strictEqual(
        deduplicated.length,
        8,
        'Obras distintas con títulos similares del mismo artista NO deben ser descartadas erróneamente'
      );
    });

    it('1.4 Manejo resiliente de objetos sin propiedades, tipos corruptos y entradas anómalas', () => {
      const corruptList = [
        null,
        undefined,
        {},
        { irrelevantProp: 'foo' },
        { id: null, imageUrl: null, name: null },
        { id: 12345, name: 'Obra con ID numérico', imageUrl: 'https://cdn/numeric-id.jpg' },
        { id: 'p-string-id', name: 'Obra normal', imageUrl: 'https://cdn/normal.jpg' },
        { id: 'p-corrupt-url', name: 'Obra con url objeto', imageUrl: { invalid: true } },
        { id: false, name: false, imageUrl: false }, // Ignorado
        Object.create(null),
      ];

      let result;
      assert.doesNotThrow(() => {
        result = deduplicatePosters(corruptList);
      });

      assert.ok(Array.isArray(result));
      // Solo deben pasar los que tienen identificadores válidos
      const names = result.map(p => p.name);
      assert.ok(names.includes('Obra con ID numérico'));
      assert.ok(names.includes('Obra normal'));
      assert.ok(names.includes('Obra con url objeto'));
      assert.ok(!names.includes(false));
    });

    it('1.5 Prueba de estrés a escala: 10,000 elementos con duplicados masivos', () => {
      const uniqueCount = 100;
      const copiesPerItem = 100;
      const largeArray = [];

      for (let i = 0; i < uniqueCount; i++) {
        for (let j = 0; j < copiesPerItem; j++) {
          largeArray.push({
            id: `item-${i}`,
            sku: `SKU-${i}`,
            name: `Obra Maestra #${i}`,
            imageUrl: `https://storage.googleapis.com/deko-eventsales-media/poster-${i}-${j * 10}x${j * 10}.webp`,
          });
        }
      }

      assert.strictEqual(largeArray.length, 10000);

      const startTime = performance.now();
      const deduplicated = deduplicatePosters(largeArray);
      const elapsedMs = performance.now() - startTime;

      assert.strictEqual(deduplicated.length, uniqueCount, 'Debe colapsar 10,000 elementos a exactamente 100 únicos');
      assert.ok(elapsedMs < 300, `Deduplicación de 10,000 elementos tardó ${elapsedMs.toFixed(2)}ms (límite: 300ms)`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXTRACT PAYMENT METHOD: CASOS CONFUSOS Y MONEDAS MEZCLADAS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Stress Testing extractPaymentMethod', () => {
    it('2.1 Caso específico: "quiero 2 posters a 55 quetzales cada uno pagando con tarjeta debito"', () => {
      const input = 'quiero 2 posters a 55 quetzales cada uno pagando con tarjeta debito';
      const result = extractPaymentMethod(input);
      assert.strictEqual(result, 'TARJETA', 'Debe detectar TARJETA a pesar de la mención de 55 quetzales');
    });

    it('2.2 Caso específico: "son 110 en efectivo o puedo hacer transferencia?"', () => {
      const input = 'son 110 en efectivo o puedo hacer transferencia?';
      const result = extractPaymentMethod(input);
      // Debe resolver a un método válido determinístico (EFECTIVO o TRANSFERENCIA) y no crashear
      assert.ok(result === 'EFECTIVO' || result === 'TRANSFERENCIA');
      assert.strictEqual(result, 'EFECTIVO', 'Preposición "en efectivo" debe resolver con precedencia');
    });

    it('2.3 Caso específico: "visa cuotas"', () => {
      const input = 'visa cuotas';
      const result = extractPaymentMethod(input);
      assert.strictEqual(result, 'TARJETA', 'Debe detectar TARJETA ante "visa cuotas"');
    });

    it('2.4 Desambiguación de quetzales vs métodos reales', () => {
      // Frases con mención de quetzales que NO son efectivo
      assert.strictEqual(extractPaymentMethod('son 55 quetzales'), null);
      assert.strictEqual(extractPaymentMethod('el total es de Q110'), null);
      assert.strictEqual(extractPaymentMethod('cuesta 65 quetzales cada poster'), null);
      assert.strictEqual(extractPaymentMethod('a cuanto salen los posters en quetzales?'), null);

      // Frases con quetzales Y método explícito
      assert.strictEqual(extractPaymentMethod('son 130 quetzales en efectivo'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('te deposito 55 quetzales por banca movil'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('cobrame los 125 quetzales con pos'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('te doy un billete de a 100 quetzales'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('voy a pagar con tarjeta de credito visa los 65 quetzales'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('hago transferencia inmediata por ach'), 'TRANSFERENCIA');
    });

    it('2.5 Resistencia ante entradas agresivas o no strings', () => {
      assert.strictEqual(extractPaymentMethod(''), null);
      assert.strictEqual(extractPaymentMethod('   '), null);
      assert.strictEqual(extractPaymentMethod(null), null);
      assert.strictEqual(extractPaymentMethod(undefined), null);
      assert.strictEqual(extractPaymentMethod(12345), null);
      assert.strictEqual(extractPaymentMethod({}), null);
      assert.strictEqual(extractPaymentMethod(['tarjeta']), null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NORMALIZE CATALOG SIZE ID: ENTRADAS RARAS Y EXÓTICAS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Stress Testing normalizeCatalogSizeId', () => {
    it('3.1 Entradas raras solicitadas explícitamente', () => {
      const rareInputs = [
        { input: 'portada vinilo cuadrado', expected: 'PORTADA_ALBUM' },
        { input: 'album 12x12', expected: 'PORTADA_ALBUM' },
        { input: 'PORTADA', expected: 'PORTADA_ALBUM' },
        { input: 'cuadrada 30x30', expected: 'PORTADA_ALBUM' },
      ];

      for (const { input, expected } of rareInputs) {
        assert.strictEqual(
          normalizeCatalogSizeId(input),
          expected,
          `Falló normalización para entrada rara: "${input}"`
        );
      }
    });

    it('3.2 Variaciones semánticas y ortográficas de PORTADA_ALBUM', () => {
      const variations = [
        'portada',
        'portada de album',
        'portada de álbum',
        'disco',
        'disco de vinilo',
        'vinilo',
        'vinilo cuadrado',
        'cuadrado',
        'cuadrada',
        'formato cuadrado',
        '30x30',
        '30 x 30',
        '30 x 30 cm',
        '30*30 cms',
        '12x12',
        '12 x 12',
        '12 x 12 pulgadas',
        '12x12 in',
        '12*12 inches',
      ];

      for (const v of variations) {
        assert.strictEqual(
          normalizeCatalogSizeId(v),
          'PORTADA_ALBUM',
          `Falla en normalización de variante: "${v}"`
        );
      }
    });

    it('3.3 Preservación de otros tamaños oficiales bajo ruido sintáctico', () => {
      assert.strictEqual(normalizeCatalogSizeId('18 x 24 pulgadas'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('45x60 cm'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('24x36 pulg'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('60 x 90 centímetros'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('12x18 in'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('30 x 45'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('8.5 x 11 pulgadas'), 'PEQUENO');
      assert.strictEqual(normalizeCatalogSizeId('21 x 27'), 'PEQUENO');
      assert.strictEqual(normalizeCatalogSizeId('5 x 7 pulg'), 'MINI');
      assert.strictEqual(normalizeCatalogSizeId('14x21'), 'MINI');

      // Default ante null / vacío
      assert.strictEqual(normalizeCatalogSizeId(null), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(''), 'MEDIANO');
      // Hallazgo empírico documentado: cadena con solo espacios ('   ') es truthy en JS,
      // por lo que pasa if (!requestedSize) y retorna '' tras trim().toUpperCase()
      assert.strictEqual(normalizeCatalogSizeId('   '), '');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CONSTRUCT DRAFT PAYLOAD: INVARIANTE ABSOLUTO PORTADA_ALBUM (Q55.00)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Invariante Contable Absoluto de PORTADA_ALBUM en constructDraftPayload', () => {
    it('4.1 PORTADA_ALBUM NUNCA cobra Q65.00 ni Q0.00 bajo ninguna provocación o alucinación del LLM', async () => {
      // Conjunto adversarial de argumentos simulando alucinaciones del LLM
      const adversarialDraftArgs = [
        // 1. LLM retorna unitPrice: 65 explícito en obra con coincidencia
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'PORTADA_ALBUM', quantity: 1, unitPrice: 65.0 }],
          label: 'LLM alucinó unitPrice: 65.0 en obra coincidente',
        },
        // 2. LLM retorna unitPrice: 0 explícito
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'portada', quantity: 1, unitPrice: 0.0 }],
          label: 'LLM retornó unitPrice: 0.0 con size "portada"',
        },
        // 3. Obra desconocida (fallback) con unitPrice: 65.0
        {
          items: [{ productName: 'Banda Sonora Desconocida', size: 'vinilo', quantity: 1, unitPrice: 65.0 }],
          label: 'Fallback obra desconocida con unitPrice: 65.0',
        },
        // 4. Fallback obra desconocida con unitPrice: 0.0
        {
          items: [{ productName: 'Banda Sonora Desconocida', size: 'cuadrado', quantity: 1, unitPrice: 0.0 }],
          label: 'Fallback obra desconocida con unitPrice: 0.0',
        },
        // 5. Sin unitPrice (undefined)
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'album 12x12', quantity: 1 }],
          label: 'Sin unitPrice con size "album 12x12"',
        },
        // 6. unitPrice negativo
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'portada vinilo cuadrado', quantity: 1, unitPrice: -55.0 }],
          label: 'unitPrice negativo con size "portada vinilo cuadrado"',
        },
        // 7. unitPrice null o NaN
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'cuadrada 30x30', quantity: 1, unitPrice: null }],
          label: 'unitPrice null con size "cuadrada 30x30"',
        },
        // 8. size en minúsculas y unitPrice 999.0
        {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'portada', quantity: 1, unitPrice: 999.0 }],
          label: 'unitPrice absurdo 999.0 con size "portada"',
        },
      ];

      for (const testCase of adversarialDraftArgs) {
        const draft = await constructDraftPayload('tenant-stress-test', testCase, 'cliente paga en tarjeta');

        assert.ok(draft.items.length > 0, `No se generaron items para: ${testCase.label}`);
        const item = draft.items[0];

        // Verificación estricta de las reglas de negocio
        assert.strictEqual(
          item.sizeId,
          'PORTADA_ALBUM',
          `El sizeId debe ser PORTADA_ALBUM para: ${testCase.label}`
        );

        assert.notStrictEqual(
          item.unitPrice,
          65.0,
          `¡VIOLACIÓN CONTABLE! PORTADA_ALBUM cobró Q65.00 en caso: ${testCase.label}`
        );

        assert.notStrictEqual(
          item.unitPrice,
          0.0,
          `¡VIOLACIÓN CONTABLE! PORTADA_ALBUM cobró Q0.00 en caso: ${testCase.label}`
        );

        assert.strictEqual(
          item.unitPrice,
          55.0,
          `PORTADA_ALBUM debe cobrar exactamente Q55.00 en caso: ${testCase.label}`
        );

        assert.strictEqual(
          item.subtotal,
          55.0,
          `Subtotal debe ser Q55.00 para 1 unidad en caso: ${testCase.label}`
        );

        assert.strictEqual(
          draft.total,
          55.0,
          `Total debe ser Q55.00 para 1 unidad en caso: ${testCase.label}`
        );
      }
    });

    it('4.2 Fuzzing de cantidades: Total matemático exacto = cantidad * 55.00 sin redondeos erróneos', async () => {
      // Probar cantidades representativas del mostrador (1 a 5 y 10 unidades)
      for (const qty of [1, 2, 3, 4, 5, 10]) {
        const draft = await constructDraftPayload('tenant-stress-test', {
          items: [{ productName: 'Spider-Man Vintage Comic', size: 'portada', quantity: qty, unitPrice: 65.0 }]
        }, 'cobrado por transferencia');

        const expectedSubtotal = Number((qty * 55.0).toFixed(2));
        assert.strictEqual(draft.items[0].unitPrice, 55.0);
        assert.strictEqual(draft.items[0].subtotal, expectedSubtotal);
        assert.strictEqual(draft.total, expectedSubtotal);
        assert.strictEqual(draft.paymentMethod, 'TRANSFERENCIA');
      }
    });

    it('4.3 Carrito mixto: PORTADA_ALBUM (Q55) + MEDIANO (Q65) + GIGANTE (Q180) preserva precios individuales', async () => {
      const draft = await constructDraftPayload('tenant-stress-test', {
        items: [
          { productName: 'Bad Bunny - Un Verano Sin Ti', size: 'portada', quantity: 2, unitPrice: 65.0 }, // Debe corregirse a 55 * 2 = 110
          { productName: 'Spider-Man Vintage', size: 'mediano', quantity: 1, unitPrice: 65.0 }, // 65 * 1 = 65
          { productName: 'Batman The Dark Knight', size: 'gigante', quantity: 1, unitPrice: 180.0 }, // 180 * 1 = 180
        ]
      }, 'pago con tarjeta visa debito');

      assert.strictEqual(draft.items.length, 3);
      
      // Item 1: Portada
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].unitPrice, 55.0);
      assert.strictEqual(draft.items[0].subtotal, 110.0);

      // Item 2: Mediano
      assert.strictEqual(draft.items[1].sizeId, 'MEDIANO');
      assert.strictEqual(draft.items[1].unitPrice, 65.0);
      assert.strictEqual(draft.items[1].subtotal, 65.0);

      // Item 3: Gigante
      assert.strictEqual(draft.items[2].sizeId, 'GIGANTE');
      assert.strictEqual(draft.items[2].unitPrice, 180.0);
      assert.strictEqual(draft.items[2].subtotal, 180.0);

      // Total acumulado: 110 + 65 + 180 = 355.00
      assert.strictEqual(draft.total, 355.0);
      assert.strictEqual(draft.paymentMethod, 'TARJETA');
    });
  });
});
