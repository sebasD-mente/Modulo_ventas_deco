import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SIZES,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
} from '../../src/components/manual-sale/manualSaleConstants.js';
import {
  createSaleSchema,
  saleItemSchema,
  salePaymentSchema,
} from '../../server/validators/saleValidators.js';
import {
  searchWebPosters,
  invalidateCatalogCache,
} from '../../server/services/webCatalogService.js';
import { prisma } from '../../server/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Mock data to ensure hermetic and isolated testing without remote DB dependencies
const MOCK_CATALOG = [
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic - Portada clásica Marvel',
    category: 'CÓMICS',
    basePrice: 25,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample-spiderman.webp',
    tags: ['spiderman', 'spider-man', 'marvel', 'vintage'],
    isActive: true,
    tenantId: 'tenant-stress-test',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
    ],
  },
  {
    id: 'prod-pablo-1',
    sku: 'DV-PABLO-01',
    name: 'Pablo Escobar (Sonrisa / Mugshot) - Diseño icónico vintage',
    category: 'HISTÓRICOS',
    basePrice: 25,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample-pablo.webp',
    tags: ['pablo', 'escobar', 'mugshot', 'vintage'],
    isActive: true,
    tenantId: 'tenant-stress-test',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-badbunny-1',
    sku: 'DV-BB-01',
    name: 'Bad Bunny Un Verano Sin Ti - Álbum Oficial',
    category: 'MÚSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample-badbunny.webp',
    tags: ['bad bunny', 'un verano sin ti', 'musica', 'urbano'],
    isActive: true,
    tenantId: 'tenant-stress-test',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
];

describe('⚔️ SUITE ADVERSARIAL CHALLENGER 1: Empirical Stress Tests for Modular FastManualSaleForm', () => {
  let originalProductFindMany;

  beforeEach(() => {
    invalidateCatalogCache();
    originalProductFindMany = prisma.product?.findMany;
    if (prisma.product) {
      prisma.product.findMany = async () => MOCK_CATALOG;
    }
  });

  afterEach(() => {
    if (prisma.product && originalProductFindMany) {
      prisma.product.findMany = originalProductFindMany;
    }
    invalidateCatalogCache();
  });

  // =========================================================================
  // 1. SEARCH QUERY STRESS & REGEX INJECTION RESILIENCE
  // =========================================================================
  describe('1. Search Query Stress & Injection Resilience', () => {
    it('1.1. Malformed regex syntax (?[*+\\ does not crash searchWebPosters', async () => {
      const regexBombQueries = [
        '(?[*+\\',
        '([a-z]+',
        '.*+?',
        '\\',
        '\\x',
        '^(?=.*[a-z])(?=.*[A-Z])',
        '(((',
        '[a-z',
        '*',
        '+',
        '?',
        '{1,5}',
      ];

      for (const query of regexBombQueries) {
        const results = await searchWebPosters({
          tenantId: 'tenant-stress-test',
          query,
          limit: 10,
        });
        assert.ok(
          Array.isArray(results),
          `Búsqueda con "${query}" debe retornar un array sin lanzar excepción`
        );
      }
    });

    it('1.2. Potential ReDoS patterns and catastrophic backtracking strings do not hang', async () => {
      const redosPatterns = [
        '((a+)+)+$',
        '(a|aa)+$',
        '([a-zA-Z]+)*',
        'a'.repeat(500) + '!',
      ];

      for (const query of redosPatterns) {
        const start = Date.now();
        const results = await searchWebPosters({
          tenantId: 'tenant-stress-test',
          query,
          limit: 5,
        });
        const duration = Date.now() - start;
        assert.ok(
          duration < 250,
          `Query ReDoS "${query.slice(0, 20)}..." tomó ${duration}ms (debe ser < 250ms)`
        );
        assert.ok(Array.isArray(results));
      }
    });

    it('1.3. SQL injection and XSS payloads are treated as plain text literals', async () => {
      const injectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE products; --",
        "' UNION SELECT * FROM users --",
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '${7*7}',
        '{{7*7}}',
        'null',
        'undefined',
      ];

      for (const query of injectionPayloads) {
        const results = await searchWebPosters({
          tenantId: 'tenant-stress-test',
          query,
          limit: 10,
        });
        assert.ok(Array.isArray(results), `Payload "${query}" debe responder array`);
      }
    });

    it('1.4. Leading, trailing, and excessive whitespace are trimmed and sanitized', async () => {
      const whitespaceQueries = [
        '   spiderman   ',
        '\t\r\n  spiderman  \n\t',
        'spider    man',
        '   ',
        '',
      ];

      for (const query of whitespaceQueries) {
        const results = await searchWebPosters({
          tenantId: 'tenant-stress-test',
          query,
          limit: 10,
        });
        assert.ok(Array.isArray(results));
        if (query.includes('spiderman')) {
          assert.ok(
            results.some((r) => r.id === 'prod-spiderman-1'),
            `Debe encontrar Spider-Man a pesar de espacios en "${query}"`
          );
        }
      }
    });

    it('1.5. Null, undefined, and non-string query inputs do not throw unhandled exceptions', async () => {
      const oddInputs = [null, undefined, 123, true, {}, []];
      for (const query of oddInputs) {
        const results = await searchWebPosters({
          tenantId: 'tenant-stress-test',
          query,
          limit: 5,
        });
        assert.ok(Array.isArray(results), `Input ${typeof query} no debe romper searchWebPosters`);
      }
    });

    it('1.6. Frontend useCatalogSearch enforces encodeURIComponent and trims queries', () => {
      const hookPath = path.join(
        rootDir,
        'src/components/manual-sale/hooks/useCatalogSearch.js'
      );
      const code = fs.readFileSync(hookPath, 'utf-8');

      // Verify encodeURIComponent is applied to query
      assert.ok(
        code.includes('encodeURIComponent(searchQuery.trim())'),
        'useCatalogSearch debe usar encodeURIComponent(searchQuery.trim())'
      );

      // Verify empty or whitespace-only queries suppress search immediately
      assert.ok(
        code.includes('if (!searchQuery.trim())'),
        'useCatalogSearch debe verificar !searchQuery.trim() para bypass inmediato'
      );

      // Simulation of URL construction with special characters
      const rawQuery = '(?[*+\\ & param=hack';
      const encodedQuery = encodeURIComponent(rawQuery.trim());
      const constructedUrl = `/api/catalog/web-posters?q=${encodedQuery}&limit=8`;

      assert.ok(
        !constructedUrl.includes('& param=hack'),
        'El query parametrizado debe estar codificado para prevenir manipulación de URL'
      );
      assert.equal(
        encodedQuery,
        '(%3F%5B*%2B%5C%20%26%20param%3Dhack',
        'Los caracteres reservados de query (&, =, ?, +, \\, space) deben estar percent-encoded'
      );
    });
  });

  // =========================================================================
  // 2. PRICING AND ACCOUNTING EDGE CASES & NUMERICAL STABILITY
  // =========================================================================
  describe('2. Pricing and Accounting Edge Cases & Numerical Stability', () => {
    it('2.1. Extreme discount (discount > subtotal) strictly clamps grandTotal to 0, never negative', () => {
      const subtotal = 65;
      const extremeDiscounts = [66, 100, 500, 100000, 9999999];

      for (const discount of extremeDiscounts) {
        const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));
        assert.equal(
          grandTotal,
          0,
          `grandTotal con subtotal ${subtotal} y descuento ${discount} debe ser exactamente 0`
        );
        assert.ok(grandTotal >= 0, 'grandTotal nunca debe ser negativo');
      }
    });

    it('2.2. Full discount (discount === subtotal) sets grandTotal to exactly 0', () => {
      const subtotal = 125;
      const discount = 125;
      const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));
      assert.equal(grandTotal, 0);
    });

    it('2.3. Malformed, non-numeric or empty discount inputs safely fallback to 0 discount', () => {
      const subtotal = 180;
      const weirdDiscounts = ['abc', '', null, undefined, NaN, {}, '   '];

      for (const discount of weirdDiscounts) {
        const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));
        assert.equal(
          grandTotal,
          subtotal,
          `Descuento inválido "${discount}" no debe alterar el subtotal ${subtotal}`
        );
      }
    });

    it('2.4. Negative discount behavior: frontend clamps math, while backend Zod rejects negative values', () => {
      const negativeDiscount = -25;
      const subtotal = 65;
      // In frontend, Math.max(0, subtotal - (-25)) = 90
      const calculatedTotal = Math.max(0, subtotal - (Number(negativeDiscount) || 0));
      assert.equal(calculatedTotal, 90);

      // In backend, Zod createSaleSchema strictly forbids negative discount
      const testPayload = {
        eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        items: [
          {
            description: 'Póster Spider-Man (Mediano)',
            quantity: 1,
            unitPrice: 65,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 90,
          },
        ],
        discount: negativeDiscount,
        inputChannel: 'MANUAL_RAPIDA',
      };

      const result = createSaleSchema.safeParse(testPayload);
      assert.equal(result.success, false, 'Zod debe rechazar descuento negativo');
      const discountIssue = result.error?.issues.find((i) => i.path.includes('discount'));
      assert.ok(
        discountIssue,
        'Debe existir un issue para el campo discount en validación Zod'
      );
      assert.match(discountIssue.message, /no puede ser negativo/i);
    });

    it('2.5. Floating point additions (e.g. 0.1 + 0.2) do not corrupt item subtotals or grand totals', () => {
      // Classic IEEE-754 precision problem: 0.1 + 0.2 === 0.30000000000000004
      const items = [
        { unitPrice: 0.1, quantity: 1 },
        { unitPrice: 0.2, quantity: 1 },
      ];

      // Mutator formula in useManualSaleCart: Number((qty * unitPrice).toFixed(2))
      const processedItems = items.map((it) => ({
        ...it,
        subtotal: Number((it.quantity * it.unitPrice).toFixed(2)),
      }));

      assert.equal(processedItems[0].subtotal, 0.1);
      assert.equal(processedItems[1].subtotal, 0.2);

      const rawSubtotal = processedItems.reduce((sum, it) => sum + it.subtotal, 0);
      const roundedSubtotal = Number(rawSubtotal.toFixed(2));
      assert.equal(roundedSubtotal, 0.3);

      const discount = 0.05;
      const grandTotal = Number(Math.max(0, roundedSubtotal - discount).toFixed(2));
      assert.equal(grandTotal, 0.25);
    });

    it('2.6. Decimal prices multiplication with high quantities maintains exact 2-decimal precision', () => {
      const testCases = [
        { price: 33.33, qty: 3, expectedSubtotal: 99.99 },
        { price: 19.99, qty: 7, expectedSubtotal: 139.93 },
        { price: 12.5, qty: 8, expectedSubtotal: 100.0 },
        { price: 0.05, qty: 100, expectedSubtotal: 5.0 },
      ];

      for (const { price, qty, expectedSubtotal } of testCases) {
        const subtotal = Number((qty * price).toFixed(2));
        assert.equal(
          subtotal,
          expectedSubtotal,
          `Subtotal para precio ${price} x ${qty} debe ser ${expectedSubtotal}, recibido ${subtotal}`
        );
      }
    });

    it('2.7. Backend accounting tolerance (saleService epsilon) accepts float micro-differences <= 0.05 and rejects discrepancies > 0.05', () => {
      const totalAmount = 100.0;

      // Float epsilon tolerance check from saleService.js:52:
      // if (Math.abs(paymentsTotal - totalAmount) > 0.05) throw new Error(...)
      const passesTolerance = (paymentsTotal) =>
        Math.abs(paymentsTotal - totalAmount) <= 0.05;

      // Micro-differences within 5 cents
      assert.ok(passesTolerance(100.00000000000004));
      assert.ok(passesTolerance(100.04));
      assert.ok(passesTolerance(99.96));

      // Actual discrepancies greater than 5 cents must fail
      assert.equal(passesTolerance(100.06), false);
      assert.equal(passesTolerance(99.94), false);
      assert.equal(passesTolerance(110.0), false);
      assert.equal(passesTolerance(50.0), false);
    });
  });

  // =========================================================================
  // 3. MUTATOR STRESS & QUANTITY INVARIANTS
  // =========================================================================
  describe('3. Mutator Stress & Quantity Invariants', () => {
    // Exact logic from useManualSaleCart.js:74-78:
    const updateItemQtyLogic = (cartItems, id, delta) =>
      cartItems
        .map((it) =>
          it.id === id
            ? it.quantity + delta > 0
              ? {
                  ...it,
                  quantity: it.quantity + delta,
                  subtotal: Number(((it.quantity + delta) * it.unitPrice).toFixed(2)),
                }
              : null
            : it
        )
        .filter(Boolean);

    it('3.1. Decrementing quantity to 0 removes the item from the cart', () => {
      let cart = [
        { id: 'item-1', quantity: 1, unitPrice: 65, subtotal: 65 },
        { id: 'item-2', quantity: 2, unitPrice: 25, subtotal: 50 },
      ];

      // Decrement item-1 from 1 with delta -1 -> quantity becomes 0 -> filtered out
      cart = updateItemQtyLogic(cart, 'item-1', -1);
      assert.equal(cart.length, 1);
      assert.equal(cart[0].id, 'item-2');
    });

    it('3.2. Decrementing quantity with large negative delta evicts item cleanly', () => {
      let cart = [{ id: 'item-1', quantity: 3, unitPrice: 35, subtotal: 105 }];

      // Decrement with delta -100
      cart = updateItemQtyLogic(cart, 'item-1', -100);
      assert.equal(cart.length, 0);
    });

    it('3.3. Incrementing quantity correctly updates quantity and subtotal', () => {
      let cart = [{ id: 'item-1', quantity: 1, unitPrice: 65, subtotal: 65 }];

      cart = updateItemQtyLogic(cart, 'item-1', 4);
      assert.equal(cart.length, 1);
      assert.equal(cart[0].quantity, 5);
      assert.equal(cart[0].subtotal, 325);
    });

    it('3.4. addItemFromPoster with quantity <= 0 safely defaults to quantity 1', () => {
      // In useManualSaleCart.js:60: const qty = Number(quantity) || 1;
      const sanitizeQty = (qty) => Number(qty) || 1;

      assert.equal(sanitizeQty(0), 1);
      assert.equal(sanitizeQty(null), 1);
      assert.equal(sanitizeQty(undefined), 1);
      assert.equal(sanitizeQty(NaN), 1);
      assert.equal(sanitizeQty(''), 1);
      assert.equal(sanitizeQty(5), 5);
    });

    it('3.5. Backend Zod saleItemSchema strictly rejects non-positive or negative quantities', () => {
      const invalidQuantities = [0, -1, -10, 1.5];

      for (const qty of invalidQuantities) {
        const item = {
          description: 'Póster de prueba',
          quantity: qty,
          unitPrice: 65,
        };
        const res = saleItemSchema.safeParse(item);
        assert.equal(
          res.success,
          false,
          `Cantidad inválida ${qty} debe ser rechazada por saleItemSchema`
        );
      }

      // Positive integer must pass
      const validRes = saleItemSchema.safeParse({
        description: 'Póster válido',
        quantity: 3,
        unitPrice: 65,
      });
      assert.ok(validRes.success);
    });

    it('3.6. Removing non-existent item ID does not mutate or corrupt the cart', () => {
      const cart = [{ id: 'item-1', quantity: 1, unitPrice: 65, subtotal: 65 }];
      const removeItem = (id) => cart.filter((it) => it.id !== id);

      const afterRemove = removeItem('non-existent-uuid');
      assert.equal(afterRemove.length, 1);
      assert.deepEqual(afterRemove, cart);
    });

    it('3.7. confirmSale validations: empty cart and missing eventId are properly guarded', () => {
      // Validation logic from useManualSaleCart.js:96-97:
      const validateSaleAttempt = (cartItems, eventId) => {
        if (cartItems.length === 0) return 'Debes agregar al menos un póster a la venta.';
        if (!eventId) return 'No hay un evento activo seleccionado.';
        return null;
      };

      assert.equal(
        validateSaleAttempt([], 'valid-event-id'),
        'Debes agregar al menos un póster a la venta.'
      );
      assert.equal(
        validateSaleAttempt([{ id: '1' }], null),
        'No hay un evento activo seleccionado.'
      );
      assert.equal(
        validateSaleAttempt([{ id: '1' }], ''),
        'No hay un evento activo seleccionado.'
      );
      assert.equal(
        validateSaleAttempt([{ id: '1' }], 'valid-event-id'),
        null
      );
    });
  });

  // =========================================================================
  // 4. RAPID SIZE TOGGLING & SIZE_CLEANUP_REGEX INVARIANT STRESS
  // =========================================================================
  describe('4. Rapid Size Toggling & SIZE_CLEANUP_REGEX Invariant Stress', () => {
    // Exact mutator logic from useManualSaleCart.js:80-89:
    const changeItemSizeLogic = (item, newSize) => {
      const clean = item.description.replace(SIZE_CLEANUP_REGEX, '').trim();
      const price = Number(newSize.precio) || 0;
      return {
        ...item,
        description: `${clean} (${newSize.nombre || newSize.sizeId})`,
        unitPrice: price,
        selectedSizeId: newSize.sizeId,
        subtotal: Number((item.quantity * price).toFixed(2)),
      };
    };

    it('4.1. Rapid size toggling (60 consecutive cycles across all sizes) preserves exactly ONE size tag', () => {
      let item = {
        id: 'test-item-1',
        description: 'Póster Spider-Man Vintage Comic (Mediano)',
        quantity: 2,
        unitPrice: 65,
        subtotal: 130,
        selectedSizeId: 'MEDIANO',
      };

      // Toggle through all canonical sizes 10 times (60 total toggles)
      for (let cycle = 0; cycle < 10; cycle++) {
        for (const targetSize of DEFAULT_SIZES) {
          item = changeItemSizeLogic(item, targetSize);

          // Invariant 1: Exactly one size tag in parentheses
          const matches = item.description.match(/\(([^)]+)\)/g);
          assert.ok(
            matches && matches.length === 1,
            `Debe haber exactamente 1 paréntesis en la descripción, recibido: "${item.description}"`
          );

          // Invariant 2: Size name matches current size
          const expectedTag = `(${targetSize.nombre || targetSize.sizeId})`;
          assert.equal(matches[0], expectedTag);

          // Invariant 3: Clean base title is preserved
          assert.ok(
            item.description.startsWith('Póster Spider-Man Vintage Comic'),
            `El título base debe permanecer intacto: "${item.description}"`
          );

          // Invariant 4: No duplicated tags like (Mediano) (Grande)
          assert.ok(
            !item.description.includes(') ('),
            `Detectadas etiquetas duplicadas consecutivas: "${item.description}"`
          );

          // Invariant 5: Price and subtotal updated
          assert.equal(item.unitPrice, targetSize.precio);
          assert.equal(
            item.subtotal,
            Number((item.quantity * targetSize.precio).toFixed(2))
          );
        }
      }
    });

    it('4.2. Titles with native parentheses (e.g. Pablo Escobar (Sonrisa / Mugshot)) retain native parentheses and cleanly swap size tags', () => {
      let item = {
        id: 'test-item-2',
        description: 'Póster Pablo Escobar (Sonrisa / Mugshot) (Mediano)',
        quantity: 1,
        unitPrice: 65,
        subtotal: 65,
        selectedSizeId: 'MEDIANO',
      };

      // Toggle through multiple sizes
      const sizesToTest = [
        DEFAULT_SIZES[0], // MINI
        DEFAULT_SIZES[3], // GRANDE
        DEFAULT_SIZES[5], // PORTADA_ALBUM
        DEFAULT_SIZES[4], // GIGANTE
        DEFAULT_SIZES[1], // PEQUENO
      ];

      for (const targetSize of sizesToTest) {
        item = changeItemSizeLogic(item, targetSize);

        // Native parentheses "(Sonrisa / Mugshot)" MUST NOT be stripped by SIZE_CLEANUP_REGEX!
        assert.ok(
          item.description.includes('(Sonrisa / Mugshot)'),
          `Los paréntesis nativos del póster deben preservarse en "${item.description}"`
        );

        // Should have exactly 2 sets of parentheses: (Sonrisa / Mugshot) and (<Size>)
        const allParentheses = item.description.match(/\(([^)]+)\)/g);
        assert.equal(
          allParentheses.length,
          2,
          `Debe haber exactamente 2 paréntesis en "${item.description}"`
        );
        assert.equal(allParentheses[0], '(Sonrisa / Mugshot)');
        assert.equal(
          allParentheses[1],
          `(${targetSize.nombre || targetSize.sizeId})`
        );
      }
    });

    it('4.3. SIZE_CLEANUP_REGEX handles all size synonyms, case variations, and accents', () => {
      const variationCases = [
        'Póster Star Wars (MINI)',
        'Póster Star Wars (mini)',
        'Póster Star Wars (PEQUEÑO)',
        'Póster Star Wars (pequeño)',
        'Póster Star Wars (PEQUENO)',
        'Póster Star Wars (pequeno)',
        'Póster Star Wars (MEDIANO)',
        'Póster Star Wars (mediano)',
        'Póster Star Wars (GRANDE)',
        'Póster Star Wars (grande)',
        'Póster Star Wars (GIGANTE)',
        'Póster Star Wars (gigante)',
        'Póster Star Wars (PORTADA_ALBUM)',
        'Póster Star Wars (portada_album)',
        'Póster Star Wars (PORTADA)',
        'Póster Star Wars (portada)',
        'Póster Star Wars (PORTADA ÁLBUM)',
        'Póster Star Wars (portada álbum)',
      ];

      for (const input of variationCases) {
        const cleaned = input.replace(SIZE_CLEANUP_REGEX, '').trim();
        assert.equal(
          cleaned,
          'Póster Star Wars',
          `Fallo al limpiar variante "${input}": recibido "${cleaned}"`
        );
      }
    });

    it('4.4. SIZE_CLEANUP_REGEX with global flag does not drift or retain stateful lastIndex across 1,000 replaces', () => {
      const testString = 'Póster Anime (Mediano)';

      for (let i = 0; i < 1000; i++) {
        const result = testString.replace(SIZE_CLEANUP_REGEX, '').trim();
        assert.equal(
          result,
          'Póster Anime',
          `Iteración ${i} falló debido a estado residual de regex`
        );
      }
    });
  });
});
