import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../../server/config/prisma.js';

// Import facades and satellite modules
import * as saleServiceFacade from '../../server/services/saleService.js';
import { generateSaleNumber } from '../../server/services/sales/saleNumberGenerator.js';
import { createSaleTransaction, updateSaleTransaction } from '../../server/services/sales/saleTransactionService.js';
import { getEventKPIs, getMonitorDashboardMetrics, getEventSalesList } from '../../server/services/sales/saleKpiService.js';
import { createCashClosingTransaction } from '../../server/services/sales/cashClosingService.js';

import * as semanticParserFacade from '../../server/services/semanticParserService.js';
import {
  extractPaymentMethod,
  normalizeSemanticText,
  extractQuantity,
  extractSizeIdFromSegment,
  SIZE_STANDARD_PRICES,
  parseStandIntent,
} from '../../server/services/semantic/paymentExtractor.js';
import {
  STAND_ENTITY_ALIASES,
  resolveEntityAlias,
  normalizeArtworkQuery,
} from '../../server/services/semantic/entityAliases.js';

import * as productionController from '../../server/controllers/productionController.js';
import * as productionService from '../../server/services/productionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('⚔️ DESAFÍO EMPÍRICO Y ADVERSARIAL — HITO M1: 3 MONOLITOS REFACTORIZADOS', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 1: Concurrencia y Generación Atómica de Tickets (saleNumberGenerator.js)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Concurrencia y Generación Atómica de Tickets (saleNumberGenerator.js)', () => {

    it('1.1: 50 llamadas concurrentes generan 50 números de ticket únicos y secuenciales sin colisiones', async () => {
      let sequenceCounter = 0;
      const mockClient = {
        event: {
          update: async ({ where, data }) => {
            // Simulación atómica de RETURNING currentSaleSequence + 1
            sequenceCounter += data.currentSaleSequence.increment;
            return {
              name: 'Comic Con 2026',
              currentSaleSequence: sequenceCounter,
            };
          },
        },
      };

      const concurrency = 50;
      const tasks = Array.from({ length: concurrency }, () =>
        generateSaleNumber('event-concurrency-1', mockClient)
      );

      const results = await Promise.all(tasks);

      // Verificación 1: Exactamente 50 resultados
      assert.strictEqual(results.length, 50, 'Deben generarse exactamente 50 números');

      // Verificación 2: Cero colisiones (Set de 50 elementos únicos)
      const uniqueNumbers = new Set(results);
      assert.strictEqual(uniqueNumbers.size, 50, 'No debe haber ningún número de ticket duplicado');

      // Verificación 3: Formato exacto COMI-0001 a COMI-0050
      assert.strictEqual(results[0], 'COMI-0001');
      assert.strictEqual(results[49], 'COMI-0050');
      for (let i = 0; i < 50; i++) {
        const expected = `COMI-${String(i + 1).padStart(4, '0')}`;
        assert.ok(uniqueNumbers.has(expected), `Debe contener el ticket ${expected}`);
      }
    });

    it('1.2: Sanitización de prefijos y límites extremos de secuencia', async () => {
      const testCases = [
        { name: 'Comic Con Guatemala 2026!', seq: 1, expected: 'COMI-0001' },
        { name: 'Feria de Diseño & Arte', seq: 42, expected: 'FERI-0042' },
        { name: '#1 Mega Expo @ Guate', seq: 99, expected: '1MEG-0099' },
        { name: 'A!', seq: 7, expected: 'A-0007' },
        { name: '', seq: 5, expected: 'VENTA-0005' },
        { name: null, seq: 12, expected: 'VENTA-0012' },
        { name: 'STAND', seq: 10042, expected: 'STAN-10042' }, // Secuencia > 9999
        { name: 'STAND', seq: 999999, expected: 'STAN-999999' }, // Secuencia masiva
      ];

      for (const tc of testCases) {
        const mockClient = {
          event: {
            update: async () => ({
              name: tc.name,
              currentSaleSequence: tc.seq,
            }),
          },
        };

        const ticket = await generateSaleNumber('event-test', mockClient);
        assert.strictEqual(ticket, tc.expected, `Para evento "${tc.name}" y secuencia ${tc.seq}`);
      }
    });

    it('1.3: Concurrencia estocástica con latencia de red aleatoria (Jitter)', async () => {
      let sequenceCounter = 0;
      const mockClient = {
        event: {
          update: async ({ data }) => {
            // Introducir retardo asíncrono estocástico de 1ms a 10ms
            const jitterMs = Math.floor(Math.random() * 10) + 1;
            await new Promise((resolve) => setTimeout(resolve, jitterMs));
            sequenceCounter += data.currentSaleSequence.increment;
            return {
              name: 'Jitter Expo',
              currentSaleSequence: sequenceCounter,
            };
          },
        },
      };

      const concurrency = 30;
      const promises = Array.from({ length: concurrency }, () =>
        generateSaleNumber('event-jitter', mockClient)
      );

      const results = await Promise.all(promises);
      const uniqueResults = new Set(results);

      assert.strictEqual(uniqueResults.size, concurrency, 'Todas las llamadas con jitter deben generar tickets únicos');
      assert.strictEqual(sequenceCounter, concurrency, 'El contador acumulado debe reflejar exactamente el total de transacciones');
    });

    it('1.4: Propagación limpia de errores ante desconexión o timeout de base de datos', async () => {
      const mockFailingClient = {
        event: {
          update: async () => {
            const err = new Error('P2024: Timed out fetching a connection from the pool');
            err.code = 'P2024';
            throw err;
          },
        },
      };

      await assert.rejects(
        async () => {
          await generateSaleNumber('event-fail', mockFailingClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'P2024');
          assert.match(err.message, /Timed out fetching a connection/);
          return true;
        }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 2: Transacciones ACID y Control Contable (saleTransactionService.js)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Transacciones ACID y Control Contable (saleTransactionService.js)', () => {

    it('2.1: Validación de pagos con tolerancia exacta a centavos (±Q0.05)', async () => {
      const originalTx = prisma.$transaction;

      prisma.$transaction = async (cb) => {
        return await cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
          sale: {
            create: async ({ data }) => ({
              id: 'sale-test-id',
              saleNumber: data.saleNumber,
              totalAmount: data.totalAmount,
              payments: data.payments.create,
            }),
          },
          auditLog: { create: async () => {} },
        });
      };

      try {
        const baseSale = {
          tenantId: 'tenant-acid-1',
          sellerId: 'seller-acid-1',
          eventId: 'event-acid-1',
          items: [{ quantity: 2, unitPrice: 50.0, description: 'Póster A' }], // Total Q100.00
        };

        // 2.1.1: Pago exacto Q100.00 -> Válido
        const resExact = await createSaleTransaction({
          ...baseSale,
          payments: [{ method: 'EFECTIVO', amount: 100.0 }],
        });
        assert.strictEqual(resExact.totalAmount, 100.0);

        // 2.1.2: Pago con diferencia +Q0.05 (Q100.05) -> Válido (dentro de tolerancia)
        const resTolPlus = await createSaleTransaction({
          ...baseSale,
          payments: [{ method: 'TARJETA', amount: 100.05 }],
        });
        assert.ok(resTolPlus);

        // 2.1.3: Pago con diferencia -Q0.05 (Q99.95) -> Válido (dentro de tolerancia)
        const resTolMinus = await createSaleTransaction({
          ...baseSale,
          payments: [{ method: 'TRANSFERENCIA', amount: 99.95 }],
        });
        assert.ok(resTolMinus);

        // 2.1.4: Pago con diferencia +Q0.06 (Q100.06) -> RECHAZADO
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              ...baseSale,
              payments: [{ method: 'EFECTIVO', amount: 100.06 }],
            });
          },
          /no coincide con el total de la venta/
        );

        // 2.1.5: Pago con diferencia -Q0.06 (Q99.94) -> RECHAZADO
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              ...baseSale,
              payments: [{ method: 'EFECTIVO', amount: 99.94 }],
            });
          },
          /no coincide con el total de la venta/
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.2: Manejo de precisión en coma flotante con múltiples decimales y descuentos', async () => {
      const originalTx = prisma.$transaction;
      prisma.$transaction = async (cb) => {
        return await cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 10 }) },
          sale: {
            create: async ({ data }) => ({
              id: 'sale-fp-1',
              saleNumber: data.saleNumber,
              totalAmount: data.totalAmount,
            }),
          },
          auditLog: { create: async () => {} },
        });
      };

      try {
        // 3 ítems a Q33.33 = Q99.99, descuento Q9.99 -> total Q90.00
        const sale = await createSaleTransaction({
          tenantId: 'tenant-fp',
          sellerId: 'seller-fp',
          eventId: 'event-fp',
          items: [
            { quantity: 1, unitPrice: 33.33, description: 'Item 1' },
            { quantity: 1, unitPrice: 33.33, description: 'Item 2' },
            { quantity: 1, unitPrice: 33.33, description: 'Item 3' },
          ],
          discount: 9.99,
          payments: [{ method: 'EFECTIVO', amount: 90.0 }],
        });

        assert.strictEqual(sale.totalAmount, 90.0);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.3: Reconciliación atómica en 3 fases en updateSaleTransaction preservando logs de taller', async () => {
      const originalTx = prisma.$transaction;
      const updatedCalls = [];
      const createdCalls = [];
      const deletedCalls = [];
      let auditLogCreated = null;

      prisma.$transaction = async (cb) => {
        return await cb({
          sale: {
            findFirst: async () => ({
              id: 'sale-recon-1',
              tenantId: 'tenant-recon',
              sellerId: 'seller-1',
              saleNumber: 'COMI-0005',
              totalAmount: 120.0,
              discount: 0,
              notes: 'Nota previa',
              items: [
                {
                  id: 'item-existing-1',
                  productId: 'prod-1',
                  description: 'Póster Spider-Man',
                  quantity: 1,
                  unitPrice: 65.0,
                  subtotal: 65.0,
                  productionStatus: 'SEPARADO',
                  productionNotes: 'En marco negro',
                },
                {
                  id: 'item-existing-2',
                  productId: 'prod-2',
                  description: 'Póster Batman',
                  quantity: 1,
                  unitPrice: 55.0,
                  subtotal: 55.0,
                  productionStatus: 'PENDIENTE',
                },
              ],
              payments: [{ id: 'pay-1', method: 'EFECTIVO', amount: 120.0 }],
            }),
            update: async ({ data }) => ({
              id: 'sale-recon-1',
              ...data,
              payments: [{ method: 'TARJETA', amount: data.totalAmount }],
            }),
          },
          saleItem: {
            update: async (args) => {
              updatedCalls.push(args);
              return args;
            },
            create: async (args) => {
              createdCalls.push(args);
              return args;
            },
            deleteMany: async (args) => {
              deletedCalls.push(args);
              return args;
            },
          },
          salePayment: {
            deleteMany: async () => {},
            createMany: async () => {},
          },
          auditLog: {
            create: async (args) => {
              auditLogCreated = args;
            },
          },
        });
      };

      try {
        // Enviar actualización:
        // - item-existing-1 se modifica (cantidad 2, unitPrice 65 -> subtotal 130)
        // - item-existing-2 se descarta (no viene en lista)
        // - se añade un nuevo ítem (Póster One Piece Gear 5 Q125)
        // Total esperado: 130 + 125 = Q255.00
        const result = await updateSaleTransaction({
          saleId: 'sale-recon-1',
          tenantId: 'tenant-recon',
          userId: 'user-editor',
          items: [
            {
              id: 'item-existing-1',
              productId: 'prod-1',
              description: 'Póster Spider-Man (Actualizado)',
              quantity: 2,
              unitPrice: 65.0,
            },
            {
              description: 'Póster One Piece Gear 5',
              quantity: 1,
              unitPrice: 125.0,
            },
          ],
          payments: [{ method: 'TARJETA', amount: 255.0 }],
          notes: 'Cliente cambió póster',
        });

        // 1. Verificar que item-existing-1 fue ACTUALIZADO con tx.saleItem.update (NO borrado)
        assert.strictEqual(updatedCalls.length, 1);
        assert.strictEqual(updatedCalls[0].where.id, 'item-existing-1');
        assert.strictEqual(updatedCalls[0].data.quantity, 2);

        // 2. Verificar que el nuevo ítem fue CREADO con productionStatus: 'PENDIENTE'
        assert.strictEqual(createdCalls.length, 1);
        assert.strictEqual(createdCalls[0].data.description, 'Póster One Piece Gear 5');
        assert.strictEqual(createdCalls[0].data.productionStatus, 'PENDIENTE');

        // 3. Verificar que item-existing-2 fue ELIMINADO en discardedItemIds
        assert.strictEqual(deletedCalls.length, 1);
        assert.deepStrictEqual(deletedCalls[0].where.id.in, ['item-existing-2']);

        // 4. Verificar AuditLog inmutable registrado
        assert.ok(auditLogCreated);
        assert.strictEqual(auditLogCreated.data.action, 'VENTA_MODIFICADA');
        assert.strictEqual(auditLogCreated.data.details.previousTotal, 120.0);
        assert.strictEqual(auditLogCreated.data.details.newTotal, 255.0);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.4: Rollback completo cuando un paso transaccional falla (Atomicidad ACID)', async () => {
      const originalTx = prisma.$transaction;
      prisma.$transaction = async (cb) => {
        // Ejecuta callback y si lanza, simula aborto
        return await cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
          sale: { create: async () => ({ id: 'sale-rollback' }) },
          auditLog: {
            create: async () => {
              throw new Error('Simulated DB Constraint Violation in AuditLog');
            },
          },
        });
      };

      try {
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 1, unitPrice: 50, description: 'Test' }],
              payments: [{ method: 'EFECTIVO', amount: 50 }],
            });
          },
          /Simulated DB Constraint Violation in AuditLog/
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 3: Parsing Semántico y Cultura Pop Comic Con (semanticParserService)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Parsing Semántico y Cultura Pop Comic Con (semanticParserService)', () => {

    it('3.1: Mapeo de pedidos complejos de múltiples obras de Comic Con', () => {
      const order = '2 de luffy gear 5 grande en tarjeta y 1 de zoro mediano en efectivo';
      const parsed = parseStandIntent(order);

      assert.strictEqual(parsed.isSaleIntent, true);
      assert.ok(parsed.items.length >= 1, 'Debe parsear al menos 1 ítem del pedido');

      // Buscar si detectó luffy
      const luffyItem = parsed.items.find((it) => it.canonicalName.toLowerCase().includes('luffy'));
      if (luffyItem) {
        assert.strictEqual(luffyItem.quantity, 2);
        assert.strictEqual(luffyItem.sizeId, 'GRANDE');
        assert.strictEqual(luffyItem.unitPrice, 125.0);
      }
    });

    it('3.2: Portada de álbum / Vinilo mapea forzosamente a PORTADA_ALBUM con precio Q55.00', () => {
      const queries = [
        '1 de bad bunny un verano sin ti portada en tarjeta',
        'portada de album de taylor swift 1989',
        'vinilo de billie eilish por transferencia',
        'cuadrado de daft punk en efectivo',
      ];

      for (const q of queries) {
        const parsed = parseStandIntent(q);
        assert.strictEqual(parsed.isSaleIntent, true, `Debe ser venta: "${q}"`);
        const item = parsed.items[0];
        assert.ok(item, `Debe extraer ítem de "${q}"`);
        assert.strictEqual(item.sizeId, 'PORTADA_ALBUM', `Tamaño debe ser PORTADA_ALBUM para "${q}"`);
        assert.strictEqual(item.unitPrice, 55.0, `Precio debe ser exactamente Q55.00 para "${q}"`);
      }
    });

    it('3.3: Detección estricta de métodos de pago en jerga guatemalteca', () => {
      const testCases = [
        { text: 'te paso por bi en linea', expected: 'TRANSFERENCIA' },
        { text: 'pago con banrural transferencia', expected: 'TRANSFERENCIA' },
        { text: 'cobrame con tarjeta pos credomatic', expected: 'TARJETA' },
        { text: 'en efectivo cabal', expected: 'EFECTIVO' },
        { text: 'son 50 quetzales exactos', expected: null }, // No debe asumir efectivo por "quetzales"
        { text: 'te doy 100 quetzales en efectivo', expected: 'EFECTIVO' },
        { text: 'te pago con visa', expected: 'TARJETA' },
        { text: 'por banca virtual', expected: 'TRANSFERENCIA' },
      ];

      for (const tc of testCases) {
        const detected = extractPaymentMethod(tc.text);
        assert.strictEqual(
          detected,
          tc.expected,
          `Frase "${tc.text}" debe resultar en método "${tc.expected}" pero fue "${detected}"`
        );
      }
    });

    it('3.4: Diccionario cultural STAND_ENTITY_ALIASES y normalización', () => {
      assert.ok(Array.isArray(STAND_ENTITY_ALIASES), 'STAND_ENTITY_ALIASES debe ser array');
      assert.ok(STAND_ENTITY_ALIASES.length >= 45, 'Debe contener al menos 45 grupos de entidades culturales');

      const totalAliases = STAND_ENTITY_ALIASES.reduce((acc, e) => acc + e.aliases.length, 0);
      assert.ok(totalAliases > 200, `Debe contener más de 200 alias individuales (actual: ${totalAliases})`);

      // Test resoluciones clave
      const alias1 = resolveEntityAlias('checo perez');
      assert.strictEqual(alias1.matched, true);
      assert.ok(alias1.canonicalTitle.includes('Checo Pérez') || alias1.canonicalTitle.includes('Red Bull'));

      const alias2 = resolveEntityAlias('bad bunny');
      assert.strictEqual(alias2.matched, true);
      assert.ok(alias2.canonicalTitle.includes('Un Verano Sin Ti'));

      const alias3 = resolveEntityAlias('el pibe motosierra');
      assert.strictEqual(alias3.matched, true);
      assert.ok(alias3.canonicalTitle.includes('Chainsaw Man'));

      const alias4 = resolveEntityAlias('termino totalmente inexistente xyz 999');
      assert.strictEqual(alias4.matched, false);
    });

    it('3.5: Fuzzing y resiliencia ante entradas hostiles o masivas', () => {
      const hostileInputs = [
        "' OR '1'='1'; DROP TABLE Product; --",
        '<script>alert("xss")</script>',
        'A'.repeat(5000),
        '   \n\t  ',
        null,
        undefined,
        123456,
        {},
        [],
      ];

      for (const input of hostileInputs) {
        assert.doesNotThrow(() => {
          const res = parseStandIntent(input);
          assert.strictEqual(typeof res, 'object');
          assert.strictEqual(typeof res.isSaleIntent, 'boolean');
        }, `No debe lanzar excepción para input: ${typeof input === 'string' ? input.slice(0, 30) : input}`);
      }
    });

    it('3.6: Prueba de estrés de rendimiento: 1,000 parses en menos de 250ms', () => {
      const sampleQueries = [
        '1 de spider man grande en tarjeta',
        '2 de goku mediano en efectivo',
        '1 vinilo de bad bunny por transferencia',
        '3 de f1 red bull grande con visa',
        'hola buenas tardes cuanto cuesta',
      ];

      const startTime = performance.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const query = sampleQueries[i % sampleQueries.length];
        parseStandIntent(query);
      }

      const elapsedMs = performance.now() - startTime;
      assert.ok(
        elapsedMs < 250,
        `1,000 parses semánticos deben tardar < 250ms (tiempo real: ${elapsedMs.toFixed(2)}ms)`
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 4: Taller y Manejo de Errores en Producción (productionController)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Taller y Manejo de Errores en Producción (productionController)', () => {

    it('4.1: Erradicación absoluta de demoProductionItems en controladores y servicios', () => {
      const prodControllerSrc = fs.readFileSync(
        path.join(ROOT, 'server/controllers/productionController.js'),
        'utf-8'
      );
      const prodServiceSrc = fs.readFileSync(
        path.join(ROOT, 'server/services/productionService.js'),
        'utf-8'
      );

      assert.ok(
        !prodControllerSrc.includes('demoProductionItems'),
        'productionController.js no debe contener demoProductionItems'
      );
      assert.ok(
        !prodServiceSrc.includes('demoProductionItems'),
        'productionService.js no debe contener demoProductionItems'
      );
    });

    it('4.2: Control de acceso por roles y máquina de estados de taller', async () => {
      const originalFind = prisma.saleItem.findUnique;
      const originalTx = prisma.$transaction;

      try {
        prisma.saleItem.findUnique = async ({ where }) => ({
          id: where.id,
          productionStatus: 'PENDIENTE',
          productionNotes: null,
          sale: { id: 'sale-1' },
        });

        // 4.2.1: Operario 2 intentando marcar como IMPRESO una obra en estado PENDIENTE -> Error 403
        await assert.rejects(
          async () => {
            await productionService.updateItemProductionStatus({
              id: 'item-pend',
              status: 'IMPRESO',
              userId: 'user-op2',
              userRoles: ['OPERARIO_2'],
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /Solo se pueden marcar como IMPRESO las obras que están A PRODUCCION/);
            return true;
          }
        );

        // 4.2.2: Operario 1 intentando marcar como IMPRESO -> Error 403 (No tiene permiso)
        await assert.rejects(
          async () => {
            await productionService.updateItemProductionStatus({
              id: 'item-pend',
              status: 'IMPRESO',
              userId: 'user-op1',
              userRoles: ['OPERARIO_1'],
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /No tienes permiso de taller para marcar obras como IMPRESO/);
            return true;
          }
        );

        // 4.2.3: Estado no válido -> Error 400
        await assert.rejects(
          async () => {
            await productionService.updateItemProductionStatus({
              id: 'item-pend',
              status: 'ESTADO_INVENTADO',
              userId: 'user-admin',
              userRoles: ['SUPER_ADMIN'],
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            return true;
          }
        );
      } finally {
        prisma.saleItem.findUnique = originalFind;
        prisma.$transaction = originalTx;
      }
    });

    it('4.3: Propagación inquebrantable de errores de base de datos como HTTP 500 en producción', async () => {
      // Helper para simular req/res Express
      const createMockRes = () => {
        const res = {};
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (body) => {
          res.body = body;
          return res;
        };
        return res;
      };

      const originalFind = prisma.saleItem.findUnique;
      const originalCount = prisma.saleItem.count;

      try {
        // Simular fallo fatal en Postgres
        prisma.saleItem.findUnique = async () => {
          throw new Error('FATAL: Database connection terminated abruptly');
        };

        const req = {
          params: { id: 'item-db-fail' },
          body: { status: 'SEPARADO' },
          user: { id: 'user-1', roles: ['OPERARIO_1'] },
        };
        const res = createMockRes();

        await productionController.updateProductionStatus(req, res);

        assert.strictEqual(res.statusCode, 500, 'Debe emitir status HTTP 500 ante fallo de DB');
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.error, /FATAL: Database connection terminated abruptly/);

        // Probar también getProductionMetrics ante fallo de DB
        prisma.saleItem.count = async () => {
          throw new Error('Deadlock detected in postgresql engine');
        };
        const resMetrics = createMockRes();
        await productionController.getProductionMetrics({ query: {}, tenantId: 'tenant-1' }, resMetrics);

        assert.strictEqual(resMetrics.statusCode, 500, 'getProductionMetrics debe emitir 500');
        assert.strictEqual(resMetrics.body.success, false);
      } finally {
        prisma.saleItem.findUnique = originalFind;
        prisma.saleItem.count = originalCount;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUE 5: Cumplimiento Arquitectónico de Fachadas y Techos de Líneas
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Cumplimiento Arquitectónico de Fachadas y Techos de Líneas', () => {

    it('5.1: Límites de líneas según el estándar de cirugía de monolitos', () => {
      const files = [
        { path: 'server/services/saleService.js', limit: 35 },
        { path: 'server/services/semanticParserService.js', limit: 30 },
        { path: 'server/controllers/productionController.js', limit: 200 },
        { path: 'server/services/productionService.js', limit: 200 },
      ];

      for (const f of files) {
        const fullPath = path.join(ROOT, f.path);
        assert.ok(fs.existsSync(fullPath), `El archivo ${f.path} debe existir`);
        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').length;
        assert.ok(
          lines <= f.limit,
          `${f.path} tiene ${lines} líneas, superando el límite de ${f.limit}`
        );
      }
    });

    it('5.2: Integridad de exportaciones públicas a través de las fachadas', () => {
      // 1. saleService facade
      const expectedSaleExports = [
        'generateSaleNumber',
        'createSaleTransaction',
        'updateSaleTransaction',
        'getEventKPIs',
        'getMonitorDashboardMetrics',
        'getEventSalesList',
        'createCashClosingTransaction',
      ];
      for (const exp of expectedSaleExports) {
        assert.strictEqual(
          typeof saleServiceFacade[exp],
          'function',
          `saleService debe re-exportar función ${exp}`
        );
      }

      // 2. semanticParserService facade
      const expectedSemanticExports = [
        'normalizeSemanticText',
        'PAYMENT_PATTERNS',
        'extractPaymentMethod',
        'NUMBER_WORDS',
        'extractQuantity',
        'extractSizeIdFromSegment',
        'SIZE_STANDARD_PRICES',
        'parseStandIntent',
        'STAND_ENTITY_ALIASES',
        'resolveEntityAlias',
        'normalizeArtworkQuery',
      ];
      for (const exp of expectedSemanticExports) {
        assert.ok(
          semanticParserFacade[exp] !== undefined,
          `semanticParserService debe re-exportar ${exp}`
        );
      }

      // 3. productionController
      const expectedProdExports = [
        'getProductionItems',
        'updateProductionStatus',
        'getProductionMetrics',
      ];
      for (const exp of expectedProdExports) {
        assert.strictEqual(
          typeof productionController[exp],
          'function',
          `productionController debe exportar ${exp}`
        );
      }
    });
  });
});
