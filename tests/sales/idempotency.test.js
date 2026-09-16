import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import { createSaleTransaction } from '../../server/services/sales/saleTransactionService.js';
import { createSale } from '../../server/controllers/saleController.js';
import { createSaleSchema } from '../../server/validators/saleValidators.js';
import { generateSaleNumber, invalidateSequenceCache } from '../../server/services/sales/saleNumberGenerator.js';

describe('🛡️ RFC 7231 IDEMPOTENCY & OFFLINE RESILIENCE SUITE', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Validación de Esquema Zod (createSaleSchema)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Validación de Esquema Zod (createSaleSchema)', () => {
    const validBaseSale = {
      eventId: '11111111-1111-4111-8111-111111111111',
      items: [{ description: 'Póster Goku', quantity: 1, unitPrice: 65 }],
      payments: [{ method: 'EFECTIVO', amount: 65 }],
      discount: 0,
    };

    it('1.1: Preserva idempotencyKey válido como string UUID en el payload parseado', () => {
      const key = 'a2c89012-3456-4789-8abc-def012345678';
      const parsed = createSaleSchema.parse({ ...validBaseSale, idempotencyKey: key });
      assert.strictEqual(parsed.idempotencyKey, key);
    });

    it('1.2: Permite idempotencyKey nulo o ausente sin lanzar excepción', () => {
      const parsedNull = createSaleSchema.parse({ ...validBaseSale, idempotencyKey: null });
      assert.strictEqual(parsedNull.idempotencyKey, null);

      const parsedUndefined = createSaleSchema.parse({ ...validBaseSale });
      assert.strictEqual(parsedUndefined.idempotencyKey, undefined);
    });

    it('1.3: Rechaza idempotencyKey si no es string (ej: número, booleano, objeto)', () => {
      assert.throws(() => {
        createSaleSchema.parse({ ...validBaseSale, idempotencyKey: 123456 });
      });
      assert.throws(() => {
        createSaleSchema.parse({ ...validBaseSale, idempotencyKey: { key: 'invalid' } });
      });
    });

    it('1.4: Rechaza idempotencyKey que exceda los 255 caracteres', () => {
      const longKey = 'k'.repeat(256);
      assert.throws(() => {
        createSaleSchema.parse({ ...validBaseSale, idempotencyKey: longKey });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Fast-Path Replay Pre-Transaccional en createSaleTransaction
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Fast-Path Replay Pre-Transaccional en createSaleTransaction', () => {
    it('2.1: Si idempotencyKey ya existe en la BD, retorna inmediatamente la venta previa con idempotentReplay: true sin abrir transacción', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;
      let transactionOpened = false;

      try {
        const mockExistingSale = {
          id: 'sale-existing-1',
          saleNumber: 'CC26-0005',
          idempotencyKey: 'key-replay-1',
          totalAmount: 65,
          items: [{ description: 'Póster Goku', quantity: 1, unitPrice: 65, subtotal: 65 }],
          payments: [{ method: 'EFECTIVO', amount: 65 }],
          seller: { id: 'seller-1', fullName: 'Vendedor Test', email: 'vendedor@test.com' },
        };

        prisma.sale.findUnique = async ({ where }) => {
          if (where.idempotencyKey === 'key-replay-1') {
            return mockExistingSale;
          }
          return null;
        };

        prisma.$transaction = async () => {
          transactionOpened = true;
          throw new Error('NO DEBE ABRIR TRANSACCIÓN EN FAST-PATH');
        };

        const result = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: '11111111-1111-4111-8111-111111111111',
          items: [{ description: 'Póster Goku', quantity: 1, unitPrice: 65 }],
          payments: [{ method: 'EFECTIVO', amount: 65 }],
          idempotencyKey: 'key-replay-1',
        });

        assert.strictEqual(transactionOpened, false, 'La transacción NO debe haberse abierto');
        assert.strictEqual(result.id, 'sale-existing-1');
        assert.strictEqual(result.saleNumber, 'CC26-0005');
        assert.strictEqual(result.idempotentReplay, true, 'Debe marcar el flag idempotentReplay');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });

    it('2.2: Si idempotencyKey es nuevo, ejecuta la transacción y persiste el idempotencyKey en la venta creada', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;
      let persistedData = null;

      try {
        prisma.sale.findUnique = async () => null;

        prisma.$transaction = async (callback) => {
          const txMock = {
            sale: {
              findUnique: async () => null,
              create: async ({ data, include }) => {
                persistedData = data;
                return {
                  id: 'sale-new-1',
                  ...data,
                  items: data.items.create,
                  payments: data.payments.create,
                  seller: { id: data.sellerId, fullName: 'Test', email: 'test@deko.gt' },
                };
              },
            },
            auditLog: {
              create: async () => {},
            },
            $queryRawUnsafe: async () => [{ nextval: 12 }],
            event: {
              findUnique: async () => ({ name: 'Comic Con 2026' }),
            },
          };
          return await callback(txMock);
        };

        const result = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: '11111111-1111-4111-8111-111111111111',
          items: [{ description: 'Póster Vegeta', quantity: 1, unitPrice: 65 }],
          payments: [{ method: 'EFECTIVO', amount: 65 }],
          idempotencyKey: 'key-brand-new-99',
        });

        assert.strictEqual(result.id, 'sale-new-1');
        assert.strictEqual(result.idempotentReplay, undefined);
        assert.strictEqual(persistedData.idempotencyKey, 'key-brand-new-99');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Concurrencia Transaccional y Recuperación de P2002
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Concurrencia Transaccional y Recuperación de P2002', () => {
    it('3.1: Check intra-transacción — si otra transacción guardó la clave justo antes, retorna la venta existente', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;

      try {
        // En pre-check no existe aún
        prisma.sale.findUnique = async () => null;

        const committedSale = {
          id: 'sale-concurrent-win',
          saleNumber: 'COMI-0010',
          idempotencyKey: 'race-key-1',
          totalAmount: 65,
          items: [],
          payments: [],
          seller: { id: 'seller-1', fullName: 'Win', email: 'w@test.com' },
        };

        prisma.$transaction = async (callback) => {
          const txMock = {
            sale: {
              // Simula que la transacción paralela acaba de confirmar la clave
              findUnique: async ({ where }) => {
                if (where.idempotencyKey === 'race-key-1') return committedSale;
                return null;
              },
              create: async () => {
                throw new Error('NO DEBE INTENTAR CREAR SI YA EXISTE');
              },
            },
          };
          return await callback(txMock);
        };

        const result = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: '11111111-1111-4111-8111-111111111111',
          items: [{ description: 'Póster Spider-Man', quantity: 1, unitPrice: 65 }],
          payments: [{ method: 'EFECTIVO', amount: 65 }],
          idempotencyKey: 'race-key-1',
        });

        assert.strictEqual(result.id, 'sale-concurrent-win');
        assert.strictEqual(result.idempotentReplay, true);
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });

    it('3.2: Recuperación ante error P2002 (violación de unicidad en idempotencyKey) por carrera simultánea', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;

      try {
        const winnerSale = {
          id: 'sale-winner-p2002',
          saleNumber: 'COMI-0011',
          idempotencyKey: 'race-p2002-key',
          totalAmount: 65,
          items: [],
          payments: [],
          seller: { id: 'seller-1', fullName: 'Winner', email: 'winner@test.com' },
        };

        let findUniqueCallCount = 0;
        prisma.sale.findUnique = async () => {
          findUniqueCallCount++;
          // En el primer llamado (pre-tx) aún no existe
          if (findUniqueCallCount === 1) return null;
          // En el catch de P2002 ya existe la venta ganadora
          return winnerSale;
        };

        prisma.$transaction = async (callback) => {
          const txMock = {
            sale: {
              findUnique: async () => null,
              create: async () => {
                // Simular excepción Prisma P2002 por colisión en sales_idempotencyKey_key
                const p2002 = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
                p2002.code = 'P2002';
                p2002.meta = { target: ['sales_idempotencyKey_key'] };
                throw p2002;
              },
            },
            $queryRawUnsafe: async () => [{ nextval: 11 }],
            event: { findUnique: async () => ({ name: 'Comic Con' }) },
          };
          return await callback(txMock);
        };

        const result = await createSaleTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          eventId: '11111111-1111-4111-8111-111111111111',
          items: [{ description: 'Póster Batman', quantity: 1, unitPrice: 65 }],
          payments: [{ method: 'EFECTIVO', amount: 65 }],
          idempotencyKey: 'race-p2002-key',
        });

        assert.strictEqual(result.id, 'sale-winner-p2002');
        assert.strictEqual(result.idempotentReplay, true, 'Debe capturar P2002 y retornar replay exitoso');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });

    it('3.3: Errores no relacionados con idempotencyKey son relanzados sin silenciar', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;

      try {
        prisma.sale.findUnique = async () => null;

        prisma.$transaction = async () => {
          const otherError = new Error('Database connection timeout or foreign key failure');
          otherError.code = 'P2003';
          throw otherError;
        };

        await assert.rejects(
          async () => {
            await createSaleTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              eventId: '11111111-1111-4111-8111-111111111111',
              items: [{ description: 'Póster Anime', quantity: 1, unitPrice: 65 }],
              payments: [{ method: 'EFECTIVO', amount: 65 }],
              idempotencyKey: 'some-key',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'P2003');
            return true;
          }
        );
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Controlador HTTP (createSale) y Negociación de Cabeceras
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Controlador HTTP (createSale) y Negociación de Cabeceras', () => {
    it('4.1: Extrae idempotencyKey desde la cabecera HTTP Idempotency-Key y retorna 200 si es replay', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      try {
        const replaySale = {
          id: 'sale-header-replay',
          saleNumber: 'COMI-0001',
          idempotencyKey: 'uuid-header-1',
          idempotentReplay: true,
        };

        prisma.sale.findUnique = async () => replaySale;

        let resStatus = null;
        let resJson = null;

        const req = {
          headers: { 'idempotency-key': 'uuid-header-1' },
          body: {
            eventId: '11111111-1111-4111-8111-111111111111',
            items: [{ description: 'Póster One Piece', quantity: 1, unitPrice: 65 }],
            payments: [{ method: 'EFECTIVO', amount: 65 }],
            discount: 0,
          },
          user: { id: 'seller-1' },
          tenantId: 'tenant-1',
        };

        const res = {
          status: (code) => {
            resStatus = code;
            return res;
          },
          json: (data) => {
            resJson = data;
            return res;
          },
        };

        await createSale(req, res);

        assert.strictEqual(resStatus, 200, 'Debe responder HTTP 200 OK');
        assert.strictEqual(resJson.success, true);
        assert.strictEqual(resJson.idempotentReplay, true);
        assert.strictEqual(resJson.message, 'Venta previamente registrada (Idempotent Replay).');
        assert.strictEqual(resJson.data.id, 'sale-header-replay');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
      }
    });

    it('4.2: Extrae idempotencyKey desde req.body.idempotencyKey si la cabecera no está presente', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      try {
        const replaySale = {
          id: 'sale-body-replay',
          saleNumber: 'COMI-0002',
          idempotencyKey: 'uuid-body-2',
          idempotentReplay: true,
        };

        prisma.sale.findUnique = async () => replaySale;

        let resStatus = null;
        let resJson = null;

        const req = {
          headers: {},
          body: {
            eventId: '11111111-1111-4111-8111-111111111111',
            items: [{ description: 'Póster Naruto', quantity: 1, unitPrice: 65 }],
            payments: [{ method: 'EFECTIVO', amount: 65 }],
            idempotencyKey: 'uuid-body-2',
          },
          user: { id: 'seller-1' },
          tenantId: 'tenant-1',
        };

        const res = {
          status: (code) => { resStatus = code; return res; },
          json: (data) => { resJson = data; return res; },
        };

        await createSale(req, res);

        assert.strictEqual(resStatus, 200);
        assert.strictEqual(resJson.idempotentReplay, true);
        assert.strictEqual(resJson.data.id, 'sale-body-replay');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
      }
    });

    it('4.3: Retorna HTTP 201 Created cuando es una venta nueva y única', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;
      try {
        prisma.sale.findUnique = async () => null;

        prisma.$transaction = async (cb) => {
          return await cb({
            sale: {
              findUnique: async () => null,
              create: async ({ data }) => ({
                id: 'sale-fresh-201',
                saleNumber: 'COMI-0003',
                ...data,
                items: data.items.create,
                payments: data.payments.create,
                seller: { id: data.sellerId, fullName: 'Seller', email: 's@deko.gt' },
              }),
            },
            auditLog: { create: async () => {} },
            $queryRawUnsafe: async () => [{ nextval: 3 }],
            event: { findUnique: async () => ({ name: 'Comic Con' }) },
          });
        };

        let resStatus = null;
        let resJson = null;

        const req = {
          headers: { 'idempotency-key': 'brand-new-uuid-3' },
          body: {
            eventId: '11111111-1111-4111-8111-111111111111',
            items: [{ description: 'Póster Star Wars', quantity: 1, unitPrice: 65 }],
            payments: [{ method: 'EFECTIVO', amount: 65 }],
          },
          user: { id: 'seller-1' },
          tenantId: 'tenant-1',
        };

        const res = {
          status: (code) => { resStatus = code; return res; },
          json: (data) => { resJson = data; return res; },
        };

        await createSale(req, res);

        assert.strictEqual(resStatus, 201, 'Debe responder HTTP 201 Created');
        assert.strictEqual(resJson.success, true);
        assert.strictEqual(resJson.idempotentReplay, undefined);
        assert.strictEqual(resJson.data.id, 'sale-fresh-201');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });

    it('4.4: Normaliza cabeceras con espacios vacíos a null', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      const originalTransaction = prisma.$transaction;
      let recordedKey = undefined;

      try {
        prisma.sale.findUnique = async () => null;
        prisma.$transaction = async (cb) => {
          return await cb({
            sale: {
              findUnique: async () => null,
              create: async ({ data }) => {
                recordedKey = data.idempotencyKey;
                return {
                  id: 'sale-no-key',
                  ...data,
                  items: [],
                  payments: [],
                  seller: { id: 'seller-1' },
                };
              },
            },
            auditLog: { create: async () => {} },
            $queryRawUnsafe: async () => [{ nextval: 4 }],
            event: { findUnique: async () => ({ name: 'Comic Con' }) },
          });
        };

        const req = {
          headers: { 'idempotency-key': '    ' }, // Solo espacios
          body: {
            eventId: '11111111-1111-4111-8111-111111111111',
            items: [{ description: 'Póster Zelda', quantity: 1, unitPrice: 65 }],
            payments: [{ method: 'EFECTIVO', amount: 65 }],
          },
          user: { id: 'seller-1' },
          tenantId: 'tenant-1',
        };

        const res = {
          status: () => res,
          json: () => res,
        };

        await createSale(req, res);
        assert.strictEqual(recordedKey, null, 'Espacios en blanco deben normalizarse a null');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
        prisma.$transaction = originalTransaction;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Resiliencia de Secuencias y Prefijo en saleNumberGenerator
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Resiliencia de Secuencias y Prefijo en saleNumberGenerator', () => {
    beforeEach(() => {
      invalidateSequenceCache();
    });

    it('5.1: Ante error 42P01 en nextval (secuencia inexistente por rollback de transacción previa), reintenta y crea la secuencia', async () => {
      let ddlExecutionCount = 0;
      let queryCallCount = 0;

      const mockClient = {
        $executeRawUnsafe: async () => {
          ddlExecutionCount++;
        },
        $queryRawUnsafe: async (sql) => {
          if (sql.includes('nextval')) {
            queryCallCount++;
            if (queryCallCount === 1) {
              // Primera llamada simula error 42P01
              const err = new Error('relation "sale_seq_event_1" does not exist');
              err.code = '42P01';
              throw err;
            }
            return [{ nextval: 1n }];
          }
          return [];
        },
        event: {
          findUnique: async () => ({ name: 'Feria Anime' }),
        },
      };

      const ticket = await generateSaleNumber('event-1', mockClient);

      assert.strictEqual(ticket, 'FERI-0001');
      assert.strictEqual(ddlExecutionCount, 2, 'Debe haber re-ejecutado la creación tras 42P01');
      assert.strictEqual(queryCallCount, 2, 'Debe haber reintentado nextval');
    });

    it('5.2: Si el nombre del evento solo contiene símbolos, el prefijo hace fallback seguro a "VENTA"', async () => {
      const mockClient = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [{ nextval: 5n }],
        event: {
          findUnique: async () => ({ name: '--- 🎨 ✨' }), // Solo caracteres no alfanuméricos
        },
      };

      const ticket = await generateSaleNumber('event-symbols', mockClient);
      assert.strictEqual(ticket, 'VENTA-0005', 'Debe hacer fallback a VENTA en lugar de ticket vacío');
    });
  });
});
