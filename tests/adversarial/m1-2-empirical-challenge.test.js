import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Ensure dummy envs for safe imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import { prisma } from '../../server/config/prisma.js';
import * as saleService from '../../server/services/saleService.js';
import * as semanticParserService from '../../server/services/semanticParserService.js';
import * as productionController from '../../server/controllers/productionController.js';
import * as productionService from '../../server/services/productionService.js';
import { generateSaleNumber } from '../../server/services/sales/saleNumberGenerator.js';
import { createSaleTransaction, updateSaleTransaction } from '../../server/services/sales/saleTransactionService.js';
import { getEventKPIs, getMonitorDashboardMetrics, getEventSalesList } from '../../server/services/sales/saleKpiService.js';
import { createCashClosingTransaction } from '../../server/services/sales/cashClosingService.js';
import { extractPaymentMethod, parseStandIntent, normalizeSemanticText } from '../../server/services/semantic/paymentExtractor.js';
import { resolveEntityAlias, normalizeArtworkQuery, STAND_ENTITY_ALIASES } from '../../server/services/semantic/entityAliases.js';

describe('⚔️ ADVERSARIAL STRESS CHALLENGE: MILESTONE 1 (Worker M1 Refactoring)', () => {

  // ==========================================================================
  // BLOQUE 1: Verificación Arquitectónica, Límites de Líneas y Erradicación de Mocks
  // ==========================================================================
  describe('1. Límites Arquitectónicos y Erradicación de Deuda', () => {

    it('1.1: saleService.js fachada canónica debe tener < 35 líneas', () => {
      const filePath = path.join(ROOT, 'server/services/saleService.js');
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      assert.ok(lines < 35, `saleService.js excede el límite: ${lines} líneas (debe ser < 35)`);
    });

    it('1.2: semanticParserService.js fachada canónica debe tener < 30 líneas', () => {
      const filePath = path.join(ROOT, 'server/services/semanticParserService.js');
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      assert.ok(lines < 30, `semanticParserService.js excede el límite: ${lines} líneas (debe ser < 30)`);
    });

    it('1.3: productionController.js debe tener <= 200 líneas', () => {
      const filePath = path.join(ROOT, 'server/controllers/productionController.js');
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      assert.ok(lines <= 200, `productionController.js excede el límite: ${lines} líneas (debe ser <= 200)`);
    });

    it('1.4: productionService.js debe tener <= 200 líneas', () => {
      const filePath = path.join(ROOT, 'server/services/productionService.js');
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      assert.ok(lines <= 200, `productionService.js excede el límite: ${lines} líneas (debe ser <= 200)`);
    });

    it('1.5: Erradicación absoluta de demoProductionItems y datos simulados en producción', () => {
      const ctrlCode = fs.readFileSync(path.join(ROOT, 'server/controllers/productionController.js'), 'utf-8');
      const srvCode = fs.readFileSync(path.join(ROOT, 'server/services/productionService.js'), 'utf-8');
      assert.strictEqual(ctrlCode.includes('demoProductionItems'), false, 'productionController.js aún contiene demoProductionItems');
      assert.strictEqual(srvCode.includes('demoProductionItems'), false, 'productionService.js aún contiene demoProductionItems');
      assert.strictEqual(ctrlCode.includes('demoItems'), false, 'productionController.js contiene demoItems');
      assert.strictEqual(srvCode.includes('demoItems'), false, 'productionService.js contiene demoItems');
    });

    it('1.6: Contrato público intacto en fachadas re-exportadas', () => {
      // saleService exports
      assert.strictEqual(typeof saleService.generateSaleNumber, 'function');
      assert.strictEqual(typeof saleService.createSaleTransaction, 'function');
      assert.strictEqual(typeof saleService.updateSaleTransaction, 'function');
      assert.strictEqual(typeof saleService.getEventKPIs, 'function');
      assert.strictEqual(typeof saleService.getMonitorDashboardMetrics, 'function');
      assert.strictEqual(typeof saleService.getEventSalesList, 'function');
      assert.strictEqual(typeof saleService.createCashClosingTransaction, 'function');

      // semanticParserService exports
      assert.strictEqual(typeof semanticParserService.normalizeSemanticText, 'function');
      assert.strictEqual(typeof semanticParserService.extractPaymentMethod, 'function');
      assert.strictEqual(typeof semanticParserService.extractQuantity, 'function');
      assert.strictEqual(typeof semanticParserService.extractSizeIdFromSegment, 'function');
      assert.strictEqual(typeof semanticParserService.parseStandIntent, 'function');
      assert.strictEqual(typeof semanticParserService.resolveEntityAlias, 'function');
      assert.strictEqual(typeof semanticParserService.normalizeArtworkQuery, 'function');
      assert.ok(Array.isArray(semanticParserService.STAND_ENTITY_ALIASES));
    });
  });

  // ==========================================================================
  // BLOQUE 2: Concurrencia, Atomics y Robustez de Tickets (generateSaleNumber)
  // ==========================================================================
  describe('2. Concurrencia y Atomics en generateSaleNumber', () => {

    it('2.1: 50 llamadas simultáneas concurrentes no colisionan y son atómicas', async () => {
      let currentSeq = 0;
      const mockTx = {
        event: {
          update: async ({ where, data }) => {
            currentSeq += (data.currentSaleSequence.increment || 1);
            return {
              name: 'Comic Con 2026',
              currentSaleSequence: currentSeq,
            };
          },
        },
      };

      const promises = Array.from({ length: 50 }).map(() =>
        generateSaleNumber('event-uuid-123', mockTx)
      );

      const results = await Promise.all(promises);
      const uniqueTickets = new Set(results);

      assert.strictEqual(uniqueTickets.size, 50, 'Cada número de ticket debe ser único e irrepetible');
      assert.strictEqual(results[results.length - 1], 'COMI-0050', 'El ticket final debe coincidir con la secuencia acumulada');
    });

    it('2.2: Manejo de nombres de evento extremos (emojis, puntuación, caracteres vacíos)', async () => {
      const cases = [
        { eventName: '¡Super Feria 2026! 🔥', expectedPrefix: 'SUPE' },
        { eventName: '🎪 Mega Evento', expectedPrefix: 'MEGA' },
        { eventName: 'F1', expectedPrefix: 'F1' },
        { eventName: '', expectedPrefix: 'VENTA' },
        // Si el nombre contiene solo símbolos no alfanuméricos, replace() produce cadena vacía
        { eventName: '!!!###$$$', expectedPrefix: '' },
      ];

      for (const { eventName, expectedPrefix } of cases) {
        const mockTx = {
          event: {
            update: async () => ({ name: eventName, currentSaleSequence: 7 }),
          },
        };
        const ticket = await generateSaleNumber('ev-1', mockTx);
        assert.ok(ticket.startsWith(expectedPrefix), `Para '${eventName}', esperaba prefijo '${expectedPrefix}', pero obtuvo '${ticket}'`);
        assert.ok(ticket.endsWith('-0007'), `Secuencia debe ser -0007, obtuvo '${ticket}'`);
      }
    });

    it('2.3: Formateo con secuencias superiores a 4 dígitos (sin truncar)', async () => {
      const mockTx = {
        event: {
          update: async () => ({ name: 'DEKO', currentSaleSequence: 12500 }),
        },
      };
      const ticket = await generateSaleNumber('ev-1', mockTx);
      assert.strictEqual(ticket, 'DEKO-12500');
    });
  });

  // ==========================================================================
  // BLOQUE 3: Integridad Matemática y Transaccional de Ventas (createSaleTransaction)
  // ==========================================================================
  describe('3. Integridad Matemática y Transaccional de Ventas', () => {

    it('3.1: Descuadre mínimo > 0.05 es rechazado invariablemente', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
          sale: { create: async (d) => ({ id: 'sale-1', ...d.data }) },
          auditLog: { create: async () => {} },
        });

        // Total: Q100.00, Pagos: Q100.06 (diferencia 0.06 > 0.05)
        await assert.rejects(async () => {
          await createSaleTransaction({
            tenantId: 't1',
            sellerId: 's1',
            eventId: 'e1',
            items: [{ description: 'Poster', quantity: 1, unitPrice: 100 }],
            payments: [{ method: 'EFECTIVO', amount: 100.06 }],
          });
        }, /no coincide con el total/);

        // Total: Q100.00, Pagos: Q99.94 (diferencia -0.06 > 0.05)
        await assert.rejects(async () => {
          await createSaleTransaction({
            tenantId: 't1',
            sellerId: 's1',
            eventId: 'e1',
            items: [{ description: 'Poster', quantity: 1, unitPrice: 100 }],
            payments: [{ method: 'EFECTIVO', amount: 99.94 }],
          });
        }, /no coincide con el total/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('3.2: Descuadre de tolerancia <= 0.05 es aceptado', async () => {
      const originalTx = prisma.$transaction;
      try {
        let createdSale = null;
        prisma.$transaction = async (cb) => cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
          sale: {
            create: async ({ data }) => {
              createdSale = { id: 'sale-1', ...data };
              return createdSale;
            },
          },
          auditLog: { create: async () => {} },
        });

        // Total: Q100.00, Pago: Q100.04 (diferencia 0.04 <= 0.05)
        const sale = await createSaleTransaction({
          tenantId: 't1',
          sellerId: 's1',
          eventId: 'e1',
          items: [{ description: 'Poster', quantity: 1, unitPrice: 100 }],
          payments: [{ method: 'EFECTIVO', amount: 100.04 }],
        });

        assert.ok(sale, 'La venta debió ser aprobada dentro del margen de tolerancia');
        assert.strictEqual(sale.totalAmount, 100);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('3.3: Pagos mixtos divididos (Efectivo + Tarjeta + Transferencia)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let createdPayments = null;
        prisma.$transaction = async (cb) => cb({
          event: { update: async () => ({ name: 'TEST', currentSaleSequence: 2 }) },
          sale: {
            create: async ({ data }) => {
              createdPayments = data.payments.create;
              return { id: 'sale-mix', ...data };
            },
          },
          auditLog: { create: async () => {} },
        });

        const sale = await createSaleTransaction({
          tenantId: 't1',
          sellerId: 's1',
          eventId: 'e1',
          items: [
            { description: 'Póster Grande', quantity: 2, unitPrice: 100 }, // 200
            { description: 'Póster Mediano', quantity: 1, unitPrice: 65 }, // 65
          ], // Total: 265
          payments: [
            { method: 'EFECTIVO', amount: 100 },
            { method: 'TARJETA', amount: 100, reference: 'AUTH-999' },
            { method: 'TRANSFERENCIA', amount: 65, reference: 'BANRURAL-123' },
          ],
        });

        assert.strictEqual(sale.totalAmount, 265);
        assert.strictEqual(createdPayments.length, 3);
        assert.strictEqual(createdPayments[1].reference, 'AUTH-999');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // ==========================================================================
  // BLOQUE 4: Reconciliación Transaccional en Edición de Ventas (updateSaleTransaction)
  // ==========================================================================
  describe('4. Reconciliación No Destructiva de Taller en updateSaleTransaction', () => {

    it('4.1: Modificación de ítems preserva ID de ítems coincidentes y borra sólo los descartados', async () => {
      const originalTx = prisma.$transaction;
      try {
        const updatedItemRecords = [];
        const createdItemRecords = [];
        let deletedItemIds = [];

        const mockExistingSale = {
          id: 'sale-recon-1',
          tenantId: 'tenant-1',
          sellerId: 'user-1',
          totalAmount: 185,
          discount: 0,
          notes: 'Venta inicial',
          items: [
            { id: 'item-1', productId: 'p1', description: 'Goku Ultra', quantity: 1, unitPrice: 65, subtotal: 65, productionStatus: 'A_PRODUCCION' },
            { id: 'item-2', productId: 'p2', description: 'Spider-Man', quantity: 1, unitPrice: 65, subtotal: 65, productionStatus: 'IMPRESO' },
            { id: 'item-3', productId: 'p3', description: 'Bad Bunny', quantity: 1, unitPrice: 55, subtotal: 55, productionStatus: 'PENDIENTE' },
          ],
          payments: [{ id: 'pay-1', method: 'EFECTIVO', amount: 185 }],
        };

        prisma.$transaction = async (cb) => cb({
          sale: {
            findFirst: async () => mockExistingSale,
            update: async ({ data }) => ({ ...mockExistingSale, ...data }),
          },
          saleItem: {
            update: async ({ where, data }) => {
              updatedItemRecords.push({ id: where.id, data });
              return { id: where.id, ...data };
            },
            create: async ({ data }) => {
              createdItemRecords.push(data);
              return { id: 'item-new', ...data };
            },
            deleteMany: async ({ where }) => {
              deletedItemIds = where.id.in;
              return { count: deletedItemIds.length };
            },
          },
          salePayment: {
            deleteMany: async () => {},
            createMany: async () => {},
            update: async () => {},
          },
          auditLog: { create: async () => {} },
        });

        // Modificamos la venta:
        // - Goku (item-1) se actualiza de Q65 a 2x65 = 130
        // - Spider-Man (item-2) se elimina (descartado)
        // - Bad Bunny (item-3) se mantiene
        // - Batman (nuevo) se agrega
        await updateSaleTransaction({
          saleId: 'sale-recon-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          items: [
            { id: 'item-1', productId: 'p1', description: 'Goku Ultra', quantity: 2, unitPrice: 65 },
            { id: 'item-3', productId: 'p3', description: 'Bad Bunny', quantity: 1, unitPrice: 55 },
            { productId: 'p4', description: 'Batman Arkham', quantity: 1, unitPrice: 65 },
          ],
        });

        // Verificaciones
        assert.strictEqual(updatedItemRecords.length, 2, 'Debe haber actualizado exactamente 2 ítems existentes');
        assert.strictEqual(updatedItemRecords[0].id, 'item-1', 'Item 1 debe ser actualizado preservando su ID');
        assert.strictEqual(updatedItemRecords[1].id, 'item-3', 'Item 3 debe ser actualizado preservando su ID');

        assert.strictEqual(createdItemRecords.length, 1, 'Debe haber creado exactamente 1 ítem nuevo');
        assert.strictEqual(createdItemRecords[0].description, 'Batman Arkham');
        assert.strictEqual(createdItemRecords[0].productionStatus, 'PENDIENTE');

        assert.strictEqual(deletedItemIds.length, 1, 'Debe haber borrado exactamente 1 ítem descartado');
        assert.strictEqual(deletedItemIds[0], 'item-2', 'El ítem borrado debe ser item-2 (Spider-Man)');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // ==========================================================================
  // BLOQUE 5: Robustez Semántica y Fuzzing de Métodos de Pago
  // ==========================================================================
  describe('5. Fuzzing y Robustez del Parser Semántico', () => {

    it('5.1: extractPaymentMethod no se rompe ante entradas nulas, vacías o malformadas', () => {
      assert.strictEqual(extractPaymentMethod(null), null);
      assert.strictEqual(extractPaymentMethod(undefined), null);
      assert.strictEqual(extractPaymentMethod(''), null);
      assert.strictEqual(extractPaymentMethod(12345), null);
      assert.strictEqual(extractPaymentMethod({}), null);
      assert.strictEqual(extractPaymentMethod('solo viendo'), null);
    });

    it('5.2: Inmunidad ante "quetzales" confundiéndose con "efectivo"', () => {
      const q1 = '50 quetzales con tarjeta';
      assert.strictEqual(extractPaymentMethod(q1), 'TARJETA');

      const q2 = '100 quetzales por transferencia banrural';
      assert.strictEqual(extractPaymentMethod(q2), 'TRANSFERENCIA');

      const q3 = 'pago 100 quetzales en efectivo';
      assert.strictEqual(extractPaymentMethod(q3), 'EFECTIVO');
    });

    it('5.3: Resiliencia ante caracteres de regex especiales en normalizeArtworkQuery', () => {
      const weirdQueries = [
        'Spider-Man (2023) [Marvel] + Poster * Edicion especial?',
        'Demon Slayer: Kimetsu \\ Mugen Train ^',
        'F1 {Checo Perez} | Red Bull $',
      ];

      for (const q of weirdQueries) {
        assert.doesNotThrow(() => {
          const res = normalizeArtworkQuery(q);
          assert.strictEqual(typeof res, 'string');
          assert.ok(res.length > 0);
        });
      }
    });

    it('5.4: parseStandIntent con múltiples órdenes combinadas y tamaños mixtos', () => {
      const query = '2 de goku mediano tarjeta y 1 de bad bunny portada transferencia';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true);
      assert.strictEqual(parsed.items.length, 2);
      assert.strictEqual(parsed.items[0].quantity, 2);
      assert.strictEqual(parsed.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(parsed.items[1].quantity, 1);
      assert.strictEqual(parsed.items[1].sizeId, 'PORTADA_ALBUM');
    });
  });

  // ==========================================================================
  // BLOQUE 6: Seguridad de Roles y Manejo de Errores en Taller (productionService/Controller)
  // ==========================================================================
  describe('6. Seguridad de Roles y Errores 500 en Taller', () => {

    it('6.1: VENDEDOR no puede cambiar estado a IMPRESO (HTTP 403)', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      try {
        prisma.saleItem.findUnique = async () => ({
          id: 'item-1',
          productionStatus: 'A_PRODUCCION',
          sale: { id: 's1' },
        });

        await assert.rejects(async () => {
          await productionService.updateItemProductionStatus({
            id: 'item-1',
            status: 'IMPRESO',
            userId: 'user-vendedor',
            userRoles: ['VENDEDOR'],
          });
        }, (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('No tienes permiso de taller'));
          return true;
        });
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
      }
    });

    it('6.2: OPERARIO_2 no puede marcar IMPRESO si el ítem aún está en PENDIENTE (HTTP 403)', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      try {
        prisma.saleItem.findUnique = async () => ({
          id: 'item-1',
          productionStatus: 'PENDIENTE',
          sale: { id: 's1' },
        });

        await assert.rejects(async () => {
          await productionService.updateItemProductionStatus({
            id: 'item-1',
            status: 'IMPRESO',
            userId: 'user-op2',
            userRoles: ['OPERARIO_2'],
          });
        }, (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('Solo se pueden marcar como IMPRESO las obras que están A PRODUCCION'));
          return true;
        });
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
      }
    });

    it('6.3: OPERARIO_2 exitoso al marcar IMPRESO cuando está A_PRODUCCION', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      const originalTx = prisma.$transaction;
      try {
        prisma.saleItem.findUnique = async () => ({
          id: 'item-1',
          productionStatus: 'A_PRODUCCION',
          productionNotes: null,
          sale: { id: 's1' },
        });

        let updatedStatus = null;
        let createdLog = null;

        prisma.$transaction = async (cb) => cb({
          saleItem: {
            update: async ({ data }) => {
              updatedStatus = data.productionStatus;
              return { id: 'item-1', ...data };
            },
          },
          productionLog: {
            create: async ({ data }) => {
              createdLog = data;
              return { id: 'log-1', ...data };
            },
          },
        });

        const result = await productionService.updateItemProductionStatus({
            id: 'item-1',
            status: 'IMPRESO',
            notes: 'Impreso en látex',
            userId: 'user-op2',
            userRoles: ['OPERARIO_2'],
        });

        assert.strictEqual(updatedStatus, 'IMPRESO');
        assert.strictEqual(createdLog.previousStatus, 'A_PRODUCCION');
        assert.strictEqual(createdLog.newStatus, 'IMPRESO');
        assert.strictEqual(result.productionStatus, 'IMPRESO');
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
        prisma.$transaction = originalTx;
      }
    });

    it('6.4: Fallo de conexión o crash de DB en productionController retorna HTTP 500 real (no fake 200)', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      try {
        prisma.saleItem.findUnique = async () => {
          throw new Error('FATAL: Database connection timeout in postgresql pool');
        };

        let responseStatus = null;
        let responseJson = null;

        const req = {
          params: { id: 'item-1' },
          body: { status: 'A_PRODUCCION' },
          user: { id: 'user-op1', roles: ['OPERARIO_1'] },
        };
        const res = {
          status: (s) => {
            responseStatus = s;
            return {
              json: (j) => {
                responseJson = j;
              },
            };
          },
        };

        await productionController.updateProductionStatus(req, res);

        assert.strictEqual(responseStatus, 500, 'Debe responder HTTP 500 ante error no controlado de BD');
        assert.strictEqual(responseJson.success, false);
        assert.ok(responseJson.error.includes('Database connection timeout'));
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
      }
    });

    it('6.5: productionService.getProductionItems maneja páginas negativas o límites gigantes con sanitización', async () => {
      const originalCount = prisma.saleItem.count;
      const originalFindMany = prisma.saleItem.findMany;
      try {
        let capturedSkip = null;
        let capturedTake = null;

        prisma.saleItem.count = async () => 10;
        prisma.saleItem.findMany = async ({ skip, take }) => {
          capturedSkip = skip;
          capturedTake = take;
          return [];
        };

        const res = await productionService.getProductionItems({
          tenantId: 't1',
          page: -10,
          limit: 99999,
          userRoles: ['SUPER_ADMIN'],
        });

        assert.strictEqual(capturedSkip, 0, 'Página negativa debe normalizarse a página 1 (skip 0)');
        assert.strictEqual(capturedTake, 100, 'Límite gigante debe toparse a máximo 100');
        assert.strictEqual(res.page, 1);
        assert.strictEqual(res.limit, 100);
      } finally {
        prisma.saleItem.count = originalCount;
        prisma.saleItem.findMany = originalFindMany;
      }
    });
  });

});
