import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { prisma } from '../../server/config/prisma.js';
import {
  createSaleSchema,
  saleItemSchema,
  salePaymentSchema,
  updateSaleSchema,
} from '../../server/validators/saleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saleServicePath = path.resolve(__dirname, '../../server/services/saleService.js');
const productionControllerPath = path.resolve(__dirname, '../../server/controllers/productionController.js');
const webCatalogServicePath = path.resolve(__dirname, '../../server/services/webCatalogService.js');
const authControllerPath = path.resolve(__dirname, '../../server/controllers/authController.js');
const uploadMiddlewarePath = path.resolve(__dirname, '../../server/middleware/uploadMiddleware.js');
const apiRoutesPath = path.resolve(__dirname, '../../server/routes/apiRoutes.js');

describe('⚔️ Desafío Empírico de Ventas, Reconciliación y Taller (Milestone 2)', () => {

  // ==========================================================================
  // SUITE 1: C-04 — Validación Inquebrantable de Pagos vs Total Adeudado
  // ==========================================================================
  describe('1. C-04: Validación Inquebrantable de Pagos vs Total Adeudado', () => {

    it('C-04.1: Ventas con pagos menores parciales deben ser invariablemente rechazadas', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-1', ...d }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Total: Q100, Pagado: Q50 (Descuadre Q50)
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 1, unitPrice: 100, description: 'Póster Vintage' }],
              payments: [{ method: 'EFECTIVO', amount: 50 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 50\.00\) no coincide con el total de la venta \(Q 100\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.2: Bug histórico — Un pago de Q1 sobre una venta de Q500 DEBE ser rechazado (antes eludía con paymentsTotal === 0)', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-1', ...d }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Total: Q500, Pagado: Q1
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 5, unitPrice: 100, description: 'Póster Vintage Colección' }],
              payments: [{ method: 'EFECTIVO', amount: 1 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 1\.00\) no coincide con el total de la venta \(Q 500\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.3: Ventas con descuadre de centavos menor al límite (> 0.05) deben ser rechazadas', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-1', ...d }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Total: Q100.00, Pagado: Q99.94 (Diferencia = 0.06 > 0.05)
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 1, unitPrice: 100, description: 'Póster Vintage' }],
              payments: [{ method: 'EFECTIVO', amount: 99.94 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 99\.94\) no coincide con el total de la venta \(Q 100\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.4: Ventas con pagos múltiples insuficientes deben ser rechazadas', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-1', ...d }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Total: Q150.00, Pagos: [Q50, Q40, Q30] = Q120.00 (Faltan Q30)
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 1, unitPrice: 150, description: 'Póster Enmarcado' }],
              payments: [
                { method: 'EFECTIVO', amount: 50 },
                { method: 'TARJETA', amount: 40 },
                { method: 'TRANSFERENCIA', amount: 30 },
              ],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 120\.00\) no coincide con el total de la venta \(Q 150\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.5: Ventas con sobrepagos por encima de la tolerancia (> 0.05) deben ser rechazadas', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-1', ...d }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Total: Q100.00, Pagado: Q100.06
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 1, unitPrice: 100, description: 'Póster Vintage' }],
              payments: [{ method: 'EFECTIVO', amount: 100.06 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 100\.06\) no coincide con el total de la venta \(Q 100\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.6: Ventas con pagos exactos y dentro de la tolerancia de ±Q0.05 deben ser aceptadas', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 42 }) },
            sale: {
              create: async (data) => {
                return { id: 'sale-accepted-1', ...data.data };
              },
            },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Caso exacto
        const resExact = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: 'event-1',
          items: [{ quantity: 2, unitPrice: 50, description: '2 Pósters' }],
          payments: [{ method: 'EFECTIVO', amount: 100.0 }],
        });
        assert.ok(resExact);

        // Caso tolerancia superior: Q100.04
        const resUpper = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: 'event-1',
          items: [{ quantity: 1, unitPrice: 100, description: 'Póster' }],
          payments: [{ method: 'EFECTIVO', amount: 100.04 }],
        });
        assert.ok(resUpper);

        // Caso tolerancia inferior: Q99.96
        const resLower = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: 'event-1',
          items: [{ quantity: 1, unitPrice: 100, description: 'Póster' }],
          payments: [{ method: 'EFECTIVO', amount: 99.96 }],
        });
        assert.ok(resLower);

        // Pagos divididos exactos
        const resSplit = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: 'event-1',
          items: [{ quantity: 1, unitPrice: 150, description: 'Póster' }],
          payments: [
            { method: 'EFECTIVO', amount: 90.0 },
            { method: 'TARJETA', amount: 60.0 },
          ],
        });
        assert.ok(resSplit);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.7: Manejo riguroso con descuentos aplicados', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 10 }) },
            sale: { create: async (d) => ({ id: 'sale-disc', ...d.data }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        // Items: Q200, Descuento: Q50 -> Total adeudado: Q150.
        // Pago de Q150 debe ser aceptado
        const res = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: 'event-1',
          items: [{ quantity: 2, unitPrice: 100, description: 'Pósteres' }],
          discount: 50,
          payments: [{ method: 'EFECTIVO', amount: 150 }],
        });
        assert.ok(res);

        // Pago de Q200 (ignorando el descuento) debe ser rechazado
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 2, unitPrice: 100, description: 'Pósteres' }],
              discount: 50,
              payments: [{ method: 'EFECTIVO', amount: 200 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 200\.00\) no coincide con el total de la venta \(Q 150\.00\)/);
            return true;
          }
        );

        // Pago menor de Q100 debe ser rechazado
        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: 'event-1',
              items: [{ quantity: 2, unitPrice: 100, description: 'Pósteres' }],
              discount: 50,
              payments: [{ method: 'EFECTIVO', amount: 100 }],
            });
          },
          (err) => {
            assert.match(err.message, /El monto pagado \(Q 100\.00\) no coincide con el total de la venta \(Q 150\.00\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.8: Prueba de estrés Monte Carlo — 200 casos aleatorios con pagos menores DEBEN fallar sin excepción', async () => {
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (cb) => {
          return await cb({
            event: { update: async () => ({ name: 'TEST', currentSaleSequence: 1 }) },
            sale: { create: async (d) => ({ id: 'sale-test', ...d.data }) },
            auditLog: { create: async () => {} },
          });
        };

        const { createSaleTransaction } = await import('../../server/services/saleService.js');

        let rejectedCount = 0;
        const totalCases = 200;

        for (let i = 0; i < totalCases; i++) {
          const unitPrice = Math.floor(Math.random() * 500) + 10; // Q10 a Q510
          const quantity = Math.floor(Math.random() * 5) + 1; // 1 a 5
          const totalAmount = unitPrice * quantity;

          // Generar un pago menor que esté al menos Q0.06 por debajo del total
          const shortage = 0.06 + Math.random() * (totalAmount - 0.06);
          const paymentAmount = Number((totalAmount - shortage).toFixed(2));

          try {
            await createSaleTransaction({
              tenantId: 'tenant-stress',
              sellerId: 'seller-stress',
              eventId: 'event-stress',
              items: [{ quantity, unitPrice, description: `Item-${i}` }],
              payments: [{ method: 'EFECTIVO', amount: paymentAmount }],
            });
            assert.fail(`El caso ${i} no falló con total Q${totalAmount} y pago Q${paymentAmount}`);
          } catch (err) {
            if (err.message.includes('no coincide con el total de la venta')) {
              rejectedCount++;
            } else {
              throw err;
            }
          }
        }

        assert.equal(
          rejectedCount,
          totalCases,
          `Se esperaba el rechazo del 100% de los ${totalCases} casos con pagos menores. Se rechazaron: ${rejectedCount}`
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-04.9: Verificación de código fuente estático en saleService.js', () => {
      const content = fs.readFileSync(saleServicePath, 'utf-8');

      // Comprobar erradicación absoluta de `&& paymentsTotal === 0`
      assert.ok(
        !content.includes('paymentsTotal === 0'),
        'CRÍTICO: saleService.js aún contiene la condición corrupta `&& paymentsTotal === 0`'
      );

      // Comprobar presencia estricta de la validación matemática
      assert.ok(
        content.includes('Math.abs(paymentsTotal - totalAmount) > 0.05'),
        'saleService.js debe contener la validación `Math.abs(paymentsTotal - totalAmount) > 0.05`'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: C-05 — Aceptación de Canales IA y Validación Zod
  // ==========================================================================
  describe('2. C-05: Canales IA y Validación Zod de Ventas', () => {

    const validPayloadBase = {
      eventId: '11111111-1111-4111-a111-111111111111',
      items: [
        {
          description: 'Póster Clásico Impreso',
          quantity: 1,
          unitPrice: 120.5,
        },
      ],
      payments: [
        {
          method: 'EFECTIVO',
          amount: 120.5,
        },
      ],
    };

    it('C-05.1: Los 8 canales oficiales deben ser aceptados por createSaleSchema.parse()', () => {
      const channels = [
        'MANUAL_POS',
        'MANUAL_RAPIDA',
        'IA_VOZ',
        'IA_IMAGEN_QR',
        'IA_TEXTO',
        'IA_CHAT_TEXTO',
        'IA_FOTO_ARTE',
        'IA_VIDEO_MOSTRADOR',
      ];

      for (const channel of channels) {
        const payload = {
          ...validPayloadBase,
          inputChannel: channel,
        };
        const parsed = createSaleSchema.parse(payload);
        assert.equal(parsed.inputChannel, channel, `Canal ${channel} no fue parseado correctamente`);
      }
    });

    it('C-05.2: Ausencia de inputChannel debe asignar por defecto MANUAL_POS', () => {
      const payload = { ...validPayloadBase };
      delete payload.inputChannel;
      const parsed = createSaleSchema.parse(payload);
      assert.equal(parsed.inputChannel, 'MANUAL_POS');
    });

    it('C-05.3: Canales inventados, no autorizados o malformados deben ser rechazados', () => {
      const invalidChannels = [
        'IA_INVENTADO',
        'WHATSAPP',
        'TIKTOK',
        'BOT_TELEGRAM',
        'manual_pos', // case-sensitive
        'ia_chat_texto',
        '',
        null,
        12345,
      ];

      for (const invalid of invalidChannels) {
        const payload = {
          ...validPayloadBase,
          inputChannel: invalid,
        };
        assert.throws(
          () => createSaleSchema.parse(payload),
          (err) => {
            assert.ok(err.name === 'ZodError');
            return true;
          },
          `Se esperaba que el canal '${invalid}' fuera rechazado por Zod`
        );
      }
    });

    it('C-05.4: saleItemSchema debe aceptar id UUID opcional y nulo (necesario para reconciliación)', () => {
      // Con UUID válido
      const itemWithId = saleItemSchema.parse({
        id: '22222222-2222-4222-a222-222222222222',
        description: 'Póster Porsche 911',
        quantity: 2,
        unitPrice: 150,
      });
      assert.equal(itemWithId.id, '22222222-2222-4222-a222-222222222222');

      // Con id null
      const itemWithNullId = saleItemSchema.parse({
        id: null,
        description: 'Póster Botánico',
        quantity: 1,
        unitPrice: 80,
      });
      assert.equal(itemWithNullId.id, null);

      // Sin id (nuevo ítem)
      const itemWithoutId = saleItemSchema.parse({
        description: 'Póster Nuevo',
        quantity: 1,
        unitPrice: 90,
      });
      assert.equal(itemWithoutId.id, undefined);

      // Con id inválido (no UUID)
      assert.throws(
        () =>
          saleItemSchema.parse({
            id: 'not-a-uuid-string',
            description: 'Póster Malo',
            quantity: 1,
            unitPrice: 90,
          }),
        (err) => {
          assert.ok(err.name === 'ZodError');
          return true;
        }
      );
    });

    it('C-05.5: saleItemSchema debe rechazar cantidades <= 0 y precios negativos', () => {
      // Cantidad 0
      assert.throws(() =>
        saleItemSchema.parse({ description: 'A', quantity: 0, unitPrice: 50 })
      );
      // Cantidad negativa
      assert.throws(() =>
        saleItemSchema.parse({ description: 'A', quantity: -1, unitPrice: 50 })
      );
      // Precio negativo
      assert.throws(() =>
        saleItemSchema.parse({ description: 'A', quantity: 1, unitPrice: -10 })
      );
      // Descripción vacía
      assert.throws(() =>
        saleItemSchema.parse({ description: '', quantity: 1, unitPrice: 50 })
      );
    });

    it('C-05.6: updateSaleSchema permite actualizaciones parciales de ítems, pagos y notas', () => {
      // Solo notas
      const p1 = updateSaleSchema.parse({ notes: 'Cliente solicitó empaque especial' });
      assert.equal(p1.notes, 'Cliente solicitó empaque especial');

      // Solo descuento
      const p2 = updateSaleSchema.parse({ discount: 25 });
      assert.equal(p2.discount, 25);

      // Actualización de ítems con IDs existentes
      const p3 = updateSaleSchema.parse({
        items: [
          {
            id: '33333333-3333-4333-a333-333333333333',
            description: 'Póster Editado',
            quantity: 3,
            unitPrice: 100,
          },
        ],
      });
      assert.equal(p3.items.length, 1);
      assert.equal(p3.items[0].quantity, 3);
    });
  });

  // ==========================================================================
  // SUITE 3: C-06 — Edición de Ticket sin borrado/reseteo de ProductionLog
  // ==========================================================================
  describe('3. C-06: Edición de Ticket sin borrado/reseteo de ProductionLog', () => {

    function createRelationalDatabase() {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        CREATE TABLE sales (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          totalAmount REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          notes TEXT
        );

        CREATE TABLE sale_items (
          id TEXT PRIMARY KEY,
          saleId TEXT NOT NULL,
          productId TEXT,
          description TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unitPrice REAL NOT NULL,
          subtotal REAL NOT NULL,
          productionStatus TEXT NOT NULL DEFAULT 'PENDIENTE',
          productionNotes TEXT,
          FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
        );

        CREATE TABLE production_logs (
          id TEXT PRIMARY KEY,
          saleItemId TEXT NOT NULL,
          previousStatus TEXT NOT NULL,
          newStatus TEXT NOT NULL,
          userId TEXT,
          notes TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (saleItemId) REFERENCES sale_items(id) ON DELETE CASCADE
        );

        CREATE TABLE sale_payments (
          id TEXT PRIMARY KEY,
          saleId TEXT NOT NULL,
          method TEXT NOT NULL,
          amount REAL NOT NULL,
          FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
        );

        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          action TEXT NOT NULL,
          entityId TEXT NOT NULL,
          details TEXT
        );
      `);

      return db;
    }

    it('C-06.1: Oráculo Relacional en Vivo — Modificar una venta PRESERVA los ProductionLogs y el productionStatus de los ítems existentes', async () => {
      const db = createRelationalDatabase();

      // 1. Estado inicial
      const saleId = 'sale-001';
      const tenantId = 'tenant-deko';
      const item1Id = 'item-porsche-001';
      const item2Id = 'item-botanica-002';

      db.exec(`
        INSERT INTO sales (id, tenantId, totalAmount, discount, notes)
        VALUES ('${saleId}', '${tenantId}', 285.00, 0, 'Venta inicial feria');

        INSERT INTO sale_items (id, saleId, productId, description, quantity, unitPrice, subtotal, productionStatus, productionNotes)
        VALUES 
          ('${item1Id}', '${saleId}', 'prod-porsche', 'Póster Vintage Porsche 911', 1, 200.00, 200.00, 'IMPRESO', 'Impresión en lienzo fino'),
          ('${item2Id}', '${saleId}', 'prod-botanica', 'Póster Monstera Deliciosa', 1, 85.00, 85.00, 'A_PRODUCCION', 'Esperando papel satinado');

        INSERT INTO production_logs (id, saleItemId, previousStatus, newStatus, userId, notes)
        VALUES 
          ('log-1', '${item1Id}', 'PENDIENTE', 'A_PRODUCCION', 'operario-1', 'Paso a impresión'),
          ('log-2', '${item1Id}', 'A_PRODUCCION', 'IMPRESO', 'operario-2', 'Impreso y cortado'),
          ('log-3', '${item2Id}', 'PENDIENTE', 'A_PRODUCCION', 'operario-1', 'Separado material');

        INSERT INTO sale_payments (id, saleId, method, amount)
        VALUES ('pay-1', '${saleId}', 'EFECTIVO', 285.00);
      `);

      // Verificar estado previo
      const prevLogsCount = db.prepare('SELECT COUNT(*) as count FROM production_logs WHERE saleItemId = ?').get(item1Id).count;
      assert.equal(prevLogsCount, 2, 'Debe haber 2 logs iniciales para item 1');

      // 2. Interceptar prisma con un adaptador que ejecuta la lógica transaccional de saleService.js
      // sobre la base de datos relacional SQLite activa
      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (callback) => {
          const tx = {
            sale: {
              findFirst: async ({ where }) => {
                const s = db.prepare('SELECT * FROM sales WHERE id = ? AND tenantId = ?').get(where.id, where.tenantId);
                if (!s) return null;
                const items = db.prepare('SELECT * FROM sale_items WHERE saleId = ?').all(s.id);
                const payments = db.prepare('SELECT * FROM sale_payments WHERE saleId = ?').all(s.id);
                return { ...s, items, payments };
              },
              update: async ({ where, data }) => {
                db.prepare('UPDATE sales SET totalAmount = ?, discount = ? WHERE id = ?').run(
                  data.totalAmount,
                  data.discount,
                  where.id
                );
                return { id: where.id, ...data, payments: [{ method: 'EFECTIVO', amount: data.totalAmount }] };
              },
            },
            saleItem: {
              update: async ({ where, data }) => {
                // Actualiza montos y cantidades SIN alterar productionStatus ni productionNotes
                db.prepare(`
                  UPDATE sale_items 
                  SET productId = ?, description = ?, quantity = ?, unitPrice = ?, subtotal = ?
                  WHERE id = ?
                `).run(
                  data.productId,
                  data.description,
                  data.quantity,
                  data.unitPrice,
                  data.subtotal,
                  where.id
                );
                return { id: where.id, ...data };
              },
              create: async ({ data }) => {
                const newId = `item-new-${Date.now()}`;
                db.prepare(`
                  INSERT INTO sale_items (id, saleId, productId, description, quantity, unitPrice, subtotal, productionStatus)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  newId,
                  data.saleId,
                  data.productId,
                  data.description,
                  data.quantity,
                  data.unitPrice,
                  data.subtotal,
                  data.productionStatus || 'PENDIENTE'
                );
                return { id: newId, ...data };
              },
              deleteMany: async ({ where }) => {
                if (where.id?.in) {
                  for (const did of where.id.in) {
                    db.prepare('DELETE FROM sale_items WHERE id = ?').run(did);
                  }
                }
              },
            },
            salePayment: {
              deleteMany: async () => {},
              createMany: async () => {},
              update: async ({ where, data }) => {
                db.prepare('UPDATE sale_payments SET amount = ? WHERE id = ?').run(data.amount, where.id);
              },
            },
            auditLog: {
              create: async ({ data }) => {
                db.prepare('INSERT INTO audit_logs (id, tenantId, action, entityId, details) VALUES (?, ?, ?, ?, ?)').run(
                  `audit-${Date.now()}`,
                  data.tenantId,
                  data.action,
                  data.entityId,
                  JSON.stringify(data.details)
                );
              },
            },
          };

          return await callback(tx);
        };

        const { updateSaleTransaction } = await import('../../server/services/saleService.js');

        // 3. Ejecutar edición de venta:
        // - Item 1 (Porsche): Se actualiza su cantidad a 2 (precio 200 c/u = subtotal 400). Se conserva su id!
        // - Item 2 (Monstera): Se omite (descartado).
        // - Item 3 (Nuevo arte): Se agrega un nuevo póster (Q120).
        const updatePayload = {
          saleId,
          tenantId,
          userId: 'vendedor-feria',
          items: [
            {
              id: item1Id,
              productId: 'prod-porsche',
              description: 'Póster Vintage Porsche 911 (Modificado)',
              quantity: 2,
              unitPrice: 200.0,
            },
            {
              productId: 'prod-audi',
              description: 'Póster Vintage Audi Quattro',
              quantity: 1,
              unitPrice: 120.0,
            },
          ],
        };

        await updateSaleTransaction(updatePayload);

        // 4. COMPROBACIONES EMPÍRICAS INQUEBRANTABLES:

        // A) Los ProductionLogs del Item 1 siguen existiendo INTACTOS
        const logsItem1 = db.prepare('SELECT * FROM production_logs WHERE saleItemId = ?').all(item1Id);
        assert.equal(
          logsItem1.length,
          2,
          `CRÍTICO: Los logs de producción de item 1 fueron borrados o corrompidos. Quedaron: ${logsItem1.length}`
        );
        assert.equal(logsItem1[0].newStatus, 'A_PRODUCCION');
        assert.equal(logsItem1[1].newStatus, 'IMPRESO');

        // B) El productionStatus del Item 1 sigue siendo 'IMPRESO' (NO fue reseteado a 'PENDIENTE')
        const item1After = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(item1Id);
        assert.equal(
          item1After.productionStatus,
          'IMPRESO',
          `CRÍTICO: El estado de producción del item 1 fue reseteado a '${item1After.productionStatus}'. Debió permanecer 'IMPRESO'`
        );
        assert.equal(item1After.quantity, 2, 'La cantidad del item 1 debió actualizarse a 2');
        assert.equal(item1After.subtotal, 400.0, 'El subtotal del item 1 debió actualizarse a 400');
        assert.equal(item1After.productionNotes, 'Impresión en lienzo fino', 'Las notas de producción debieron preservarse');

        // C) El ítem descartado (Item 2) fue eliminado limpiamente junto con sus logs en cascada
        const item2After = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(item2Id);
        assert.equal(item2After, undefined, 'El item 2 descartado debió ser eliminado');
        const logsItem2After = db.prepare('SELECT * FROM production_logs WHERE saleItemId = ?').all(item2Id);
        assert.equal(logsItem2After.length, 0, 'Los logs del item 2 debieron eliminarse con la cascada');

        // D) El nuevo ítem fue creado con estado 'PENDIENTE'
        const newItem = db.prepare('SELECT * FROM sale_items WHERE productId = ?').get('prod-audi');
        assert.ok(newItem, 'El nuevo ítem debió ser insertado');
        assert.equal(newItem.productionStatus, 'PENDIENTE', 'El nuevo ítem debe nacer en estado PENDIENTE');

        // E) El total de la venta fue recalculado fielmente (400 + 120 = 520)
        const saleAfter = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        assert.equal(saleAfter.totalAmount, 520.0);

        // F) El registro de auditoría VENTA_MODIFICADA fue creado
        const auditLog = db.prepare('SELECT * FROM audit_logs WHERE entityId = ?').get(saleId);
        assert.ok(auditLog, 'Debe existir un AuditLog');
        assert.equal(auditLog.action, 'VENTA_MODIFICADA');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-06.2: CONTRAFACTUAL ADVERSARIAL — Demostración empírica de que la implementación antigua destruía los ProductionLogs', () => {
      const db = createRelationalDatabase();

      // Poblar venta inicial idéntica
      const saleId = 'sale-vulnerable';
      const item1Id = 'item-vuln-001';

      db.exec(`
        INSERT INTO sales (id, tenantId, totalAmount) VALUES ('${saleId}', 'tenant-1', 200);
        INSERT INTO sale_items (id, saleId, productId, description, quantity, unitPrice, subtotal, productionStatus)
        VALUES ('${item1Id}', '${saleId}', 'p1', 'Porsche', 1, 200, 200, 'IMPRESO');
        INSERT INTO production_logs (id, saleItemId, previousStatus, newStatus, userId)
        VALUES 
          ('log-v1', '${item1Id}', 'PENDIENTE', 'A_PRODUCCION', 'u1'),
          ('log-v2', '${item1Id}', 'A_PRODUCCION', 'IMPRESO', 'u2');
      `);

      // Simular exactamente la lógica antigua previa a C-06:
      // await tx.saleItem.deleteMany({ where: { saleId } });
      // await tx.saleItem.createMany({ data: itemsData });
      db.prepare('DELETE FROM sale_items WHERE saleId = ?').run(saleId);

      const brandNewItemId = 'item-new-generated-uuid';
      db.prepare(`
        INSERT INTO sale_items (id, saleId, productId, description, quantity, unitPrice, subtotal, productionStatus)
        VALUES ('${brandNewItemId}', '${saleId}', 'p1', 'Porsche', 2, 200, 400, 'PENDIENTE')
      `).run();

      // Comprobar la destrucción causada por la implementación antigua:
      const survivingLogs = db.prepare('SELECT * FROM production_logs WHERE saleItemId = ?').all(item1Id);
      assert.equal(
        survivingLogs.length,
        0,
        'En la implementación antigua, los logs eran completamente purgados por ON DELETE CASCADE'
      );

      const restoredItem = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(brandNewItemId);
      assert.equal(
        restoredItem.productionStatus,
        'PENDIENTE',
        'En la implementación antigua, la obra que ya estaba IMPRESA se reseteaba catastróficamente a PENDIENTE'
      );
    });

    it('C-06.3: Reconciliación por coincidencia secundaria cuando el frontend no envía item.id', async () => {
      const db = createRelationalDatabase();

      const saleId = 'sale-secondary-match';
      const item1Id = 'item-match-by-product';
      const item2Id = 'item-match-by-desc';

      db.exec(`
        INSERT INTO sales (id, tenantId, totalAmount) VALUES ('${saleId}', 'tenant-1', 300);
        INSERT INTO sale_items (id, saleId, productId, description, quantity, unitPrice, subtotal, productionStatus)
        VALUES 
          ('${item1Id}', '${saleId}', 'PROD-UUID-1', 'Obra Alfa', 1, 100, 100, 'IMPRESO'),
          ('${item2Id}', '${saleId}', NULL, 'Obra Especial Personalizada', 1, 200, 200, 'SEPARADO');
        INSERT INTO production_logs (id, saleItemId, previousStatus, newStatus)
        VALUES 
          ('l1', '${item1Id}', 'PENDIENTE', 'IMPRESO'),
          ('l2', '${item2Id}', 'PENDIENTE', 'SEPARADO');
      `);

      const originalTx = prisma.$transaction;
      try {
        prisma.$transaction = async (callback) => {
          const tx = {
            sale: {
              findFirst: async () => {
                const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
                const items = db.prepare('SELECT * FROM sale_items WHERE saleId = ?').all(saleId);
                return { ...s, items, payments: [{ id: 'p1', method: 'EFECTIVO', amount: 300 }] };
              },
              update: async ({ where, data }) => {
                db.prepare('UPDATE sales SET totalAmount = ? WHERE id = ?').run(data.totalAmount, where.id);
                return { id: where.id, ...data, payments: [{ method: 'EFECTIVO', amount: data.totalAmount }] };
              },
            },
            saleItem: {
              update: async ({ where, data }) => {
                db.prepare('UPDATE sale_items SET quantity = ?, subtotal = ? WHERE id = ?').run(
                  data.quantity,
                  data.subtotal,
                  where.id
                );
              },
              create: async () => {},
              deleteMany: async () => {},
            },
            salePayment: { deleteMany: async () => {}, createMany: async () => {}, update: async () => {} },
            auditLog: { create: async () => {} },
          };
          return await callback(tx);
        };

        const { updateSaleTransaction } = await import('../../server/services/saleService.js');

        // Frontend envía items SIN el campo 'id'
        await updateSaleTransaction({
          saleId,
          tenantId: 'tenant-1',
          items: [
            // Coincide por productId: 'PROD-UUID-1'
            { productId: 'PROD-UUID-1', description: 'Obra Alfa Renombrada', quantity: 3, unitPrice: 100 },
            // Coincide por descripción: 'Obra Especial Personalizada'
            { description: '  Obra Especial Personalizada  ', quantity: 2, unitPrice: 200 },
          ],
        });

        // Verificar que los IDs se preservaron
        const item1 = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(item1Id);
        assert.equal(item1.productionStatus, 'IMPRESO');
        assert.equal(item1.quantity, 3);

        const logs1 = db.prepare('SELECT * FROM production_logs WHERE saleItemId = ?').all(item1Id);
        assert.equal(logs1.length, 1);

        const item2 = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(item2Id);
        assert.equal(item2.productionStatus, 'SEPARADO');
        assert.equal(item2.quantity, 2);

        const logs2 = db.prepare('SELECT * FROM production_logs WHERE saleItemId = ?').all(item2Id);
        assert.equal(logs2.length, 1);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('C-06.4: Verificación de código fuente estático en saleService.js', () => {
      const content = fs.readFileSync(saleServicePath, 'utf-8');

      // Comprobar que en updateSaleTransaction NO hay deleteMany ciego sobre saleId
      const updateSaleTxSlice = content.slice(content.indexOf('updateSaleTransaction'));
      assert.ok(
        !updateSaleTxSlice.includes('await tx.saleItem.deleteMany({ where: { saleId } })'),
        'CRÍTICO: updateSaleTransaction aún contiene `deleteMany({ where: { saleId } })` ciego'
      );

      // Comprobar presencia de la lógica de reconciliación en 3 fases
      assert.ok(
        updateSaleTxSlice.includes('matchedExistingIds'),
        'Debe implementar conjunto matchedExistingIds'
      );
      assert.ok(
        updateSaleTxSlice.includes('discardedItemIds'),
        'Debe filtrar y eliminar únicamente discardedItemIds'
      );
      assert.ok(
        updateSaleTxSlice.includes('tx.saleItem.update'),
        'Debe actualizar ítems existentes mediante tx.saleItem.update'
      );
    });
  });

  // ==========================================================================
  // SUITE 4: C-07 — Retorno Estricto de HTTP 500 ante Fallos de DB en Taller
  // ==========================================================================
  describe('4. C-07: Manejo de Fallos de Base de Datos en Taller (HTTP 500)', () => {

    function createMockRes() {
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };
      return res;
    }

    it('C-07.1: updateProductionStatus ante fallo en prisma.saleItem.findUnique DEBE retornar HTTP 500 con error real', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      try {
        // Simular fallo fatal de base de datos
        prisma.saleItem.findUnique = async () => {
          throw new Error('FATAL: Database connection terminated abruptly (5432)');
        };

        const { updateProductionStatus } = await import('../../server/controllers/productionController.js');

        const req = {
          params: { id: 'real-uuid-item-123' },
          body: { status: 'IMPRESO' },
          user: { id: 'user-op-2', roles: ['OPERARIO_2'] },
        };
        const res = createMockRes();

        await updateProductionStatus(req, res);

        assert.equal(
          res.statusCode,
          500,
          `CRÍTICO: Se esperaba HTTP 500 ante fallo de base de datos, pero se obtuvo HTTP ${res.statusCode}`
        );
        assert.equal(res.body?.success, false);
        assert.match(res.body?.error, /Database connection terminated abruptly/);
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
      }
    });

    it('C-07.2: updateProductionStatus ante fallo dentro de prisma.$transaction DEBE retornar HTTP 500', async () => {
      const originalFindUnique = prisma.saleItem.findUnique;
      const originalTransaction = prisma.$transaction;
      try {
        prisma.saleItem.findUnique = async () => ({
          id: 'real-uuid-item-456',
          productionStatus: 'A_PRODUCCION',
          productionNotes: null,
          sale: { id: 'sale-1' },
        });

        prisma.$transaction = async () => {
          throw new Error('Deadlock detected in postgresql engine');
        };

        const { updateProductionStatus } = await import('../../server/controllers/productionController.js');

        const req = {
          params: { id: 'real-uuid-item-456' },
          body: { status: 'IMPRESO' },
          user: { id: 'user-op-2', roles: ['OPERARIO_2'] },
        };
        const res = createMockRes();

        await updateProductionStatus(req, res);

        assert.equal(
          res.statusCode,
          500,
          `CRÍTICO: Se esperaba HTTP 500 ante fallo en transacción, pero se obtuvo HTTP ${res.statusCode}`
        );
        assert.equal(res.body?.success, false);
        assert.match(res.body?.error, /Deadlock detected in postgresql engine/);
      } finally {
        prisma.saleItem.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });

    it('C-07.3: CONTRAFACTUAL ADVERSARIAL — Demostración de que la versión antigua emitía falsos positivos HTTP 200', () => {
      // Simulación del bloque catch antiguo:
      // } catch (dbErr) {
      //   return res.status(200).json({ success: true, message: `Obra actualizada a estado ${status}` });
      // }
      const resOld = createMockRes();
      const status = 'IMPRESO';

      // Código vulnerable previo:
      const vulnerableCatchHandler = (err) => {
        return resOld.status(200).json({
          success: true,
          message: `Obra actualizada a estado ${status}`,
        });
      };

      vulnerableCatchHandler(new Error('Postgres disconnected'));
      assert.equal(resOld.statusCode, 200, 'El código antiguo retornaba falsamente 200');
      assert.equal(resOld.body.success, true, 'El código antiguo engañaba al frontend afirmando éxito');
    });

    it('C-07.4: Verificación estática en productionController.js', () => {
      const content = fs.readFileSync(productionControllerPath, 'utf-8');

      // Buscar el bloque catch (dbErr) dentro de updateProductionStatus
      const updateFnSlice = content.slice(content.indexOf('export async function updateProductionStatus'));
      const dbErrCatchIndex = updateFnSlice.indexOf('catch (dbErr)');
      assert.ok(dbErrCatchIndex !== -1, 'Debe existir catch (dbErr) en updateProductionStatus');

      const catchBlock = updateFnSlice.slice(dbErrCatchIndex, dbErrCatchIndex + 300);

      // Comprobar que contiene status(500)
      assert.ok(
        catchBlock.includes('res.status(500)'),
        'CRÍTICO: catch (dbErr) debe invocar estrictamente res.status(500)'
      );

      // Comprobar que NO contiene status(200)
      assert.ok(
        !catchBlock.includes('res.status(200)'),
        'CRÍTICO: catch (dbErr) contiene status(200) fraudulento'
      );
    });
  });

  // ==========================================================================
  // SUITE 5: Verificaciones Complementarias de Seguridad y Aislamiento M2
  // ==========================================================================
  describe('5. Verificaciones Complementarias de Seguridad y Aislamiento M2 (A-01, A-10, A-12, A-14)', () => {

    it('A-01: Rutas con eventId deben estar protegidas con requireEventAccess en apiRoutes.js', () => {
      const content = fs.readFileSync(apiRoutesPath, 'utf-8');

      // Comprobar que requireEventAccess está importado
      assert.ok(
        content.includes('requireEventAccess'),
        'apiRoutes.js debe importar requireEventAccess'
      );

      // Comprobar rutas clave protegidas (usando regex para tolerancia a formateo multilinea)
      assert.ok(
        /['"]\/sales\/events\/:eventId['"][\s\S]*?requireRole[\s\S]*?requireEventAccess/.test(content),
        'Ruta /sales/events/:eventId debe exigir requireEventAccess'
      );
      assert.ok(
        /['"]\/sales\/events\/:eventId\/metrics['"][\s\S]*?requireRole[\s\S]*?requireEventAccess/.test(content),
        'Ruta /sales/events/:eventId/metrics debe exigir requireEventAccess'
      );
      assert.ok(
        /['"]\/closings\/events\/:eventId['"][\s\S]*?requireRole[\s\S]*?requireEventAccess/.test(content),
        'Ruta /closings/events/:eventId debe exigir requireEventAccess'
      );

      // Comprobar que en rutas de IA con multipart upload va antes de requireEventAccess
      assert.ok(
        /upload\.single\('audio'\)[\s\S]*?requireEventAccess/.test(content),
        'Ruta /ai/voice-sale debe ejecutar upload.single antes de requireEventAccess'
      );
    });

    it('A-10: webCatalogService debe particionar el caché por tenantId usando Map evitando fugas', async () => {
      const content = fs.readFileSync(webCatalogServicePath, 'utf-8');

      // Comprobar ausencia de variable global `let productCache = null`
      assert.ok(
        !content.includes('let productCache = null'),
        'CRÍTICO: webCatalogService.js aún contiene la variable global única let productCache = null'
      );

      // Comprobar presencia de Map()
      assert.ok(
        content.includes('new Map()'),
        'webCatalogService.js debe utilizar Map para productCache'
      );

      // Importar servicios de catálogo exportados
      const {
        invalidateCatalogCache,
        searchWebPosters,
        getAllWebPostersCatalogSummary,
        getWebPosterById,
      } = await import('../../server/services/webCatalogService.js');

      assert.equal(typeof invalidateCatalogCache, 'function');
      assert.equal(typeof searchWebPosters, 'function');
      assert.equal(typeof getAllWebPostersCatalogSummary, 'function');
      assert.equal(typeof getWebPosterById, 'function');

      // Invalidación granular y general
      invalidateCatalogCache('tenant-test-1');
      invalidateCatalogCache(); // Limpia todo el Map
    });

    it('A-12: authController.js debe tener CERO ocurrencias de jwt.decode y exigir verifyIdToken', () => {
      const content = fs.readFileSync(authControllerPath, 'utf-8');

      // Erradicación absoluta de jwt.decode
      assert.ok(
        !content.includes('jwt.decode'),
        'CRÍTICO: authController.js aún contiene jwt.decode (bypass criptográfico)'
      );

      // Exigencia de OAuth2Client y verifyIdToken
      assert.ok(
        content.includes('verifyIdToken'),
        'authController.js debe verificar tokens estrictamente con verifyIdToken'
      );
    });

    it('A-14: uploadMiddleware.js debe contar con fileFilter estricto que admita audio iOS Safari y rechace ejecutables', () => {
      const content = fs.readFileSync(uploadMiddlewarePath, 'utf-8');

      // Presencia de fileFilter
      assert.ok(content.includes('fileFilter'), 'uploadMiddleware.js debe definir fileFilter');

      // Soporte explícito para formatos de audio iOS Safari / iPhone
      assert.ok(
        content.includes('audio/mp4') && content.includes('audio/m4a'),
        'uploadMiddleware.js debe soportar audio/mp4 y audio/m4a para iOS Safari'
      );

      // Código de error estructurado
      assert.ok(
        content.includes('UNSUPPORTED_MEDIA_TYPE'),
        'uploadMiddleware.js debe emitir UNSUPPORTED_MEDIA_TYPE'
      );
    });
  });

});
