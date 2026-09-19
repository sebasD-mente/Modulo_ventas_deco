import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import {
  settleCommissionSchema,
  paySettlementSchema,
  SETTLEMENT_STATUS,
  COMMISSION_RATE,
} from '../../server/validators/commissionValidators.js';
import {
  calculateSaleProductBase,
  generateSettlementNumber,
  getPendingCommissions,
  createSettlementTransaction,
  markSettlementPaid,
  getSettlementsList,
  getSettlementById,
} from '../../server/services/commissionService.js';
import {
  getPendingCommissions as getPendingCommissionsController,
  settleCommissions as settleCommissionsController,
  listSettlements as listSettlementsController,
  getSettlement as getSettlementController,
  markPaid as markPaidController,
} from '../../server/controllers/commissionController.js';

function createMockReqRes({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-seller-01', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
  tenantId = 'tenant-test-01',
} = {}) {
  const req = { body, query, params, headers, user, tenantId };
  let responseData = null;
  let responseStatus = 200;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
    get statusCode() {
      return responseStatus;
    },
    get body() {
      return responseData;
    },
  };
  return { req, res };
}

describe('Dominio 3 — Motor Financiero de Liquidaciones y Comisiones', () => {
  describe('1. Validadores Zod (commissionValidators.js)', () => {
    it('settleCommissionSchema debe aceptar payload válido con sellerId y saleIds', () => {
      const payload = {
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
        saleIds: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
        notes: 'Liquidación quincenal',
      };
      const result = settleCommissionSchema.safeParse(payload);
      assert.equal(result.success, true);
    });

    it('settleCommissionSchema debe permitir saleIds opcional (liquidar todo lo pendiente)', () => {
      const payload = {
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = settleCommissionSchema.safeParse(payload);
      assert.equal(result.success, true);
    });

    it('settleCommissionSchema debe rechazar sellerId inválido', () => {
      const result = settleCommissionSchema.safeParse({ sellerId: 'not-a-uuid' });
      assert.equal(result.success, false);
      assert.ok(result.error.issues.some((i) => i.message.includes('UUID válido')));
    });

    it('settleCommissionSchema debe rechazar saleIds con elementos no UUID', () => {
      const result = settleCommissionSchema.safeParse({
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
        saleIds: ['invalid-id'],
      });
      assert.equal(result.success, false);
    });

    it('settleCommissionSchema debe rechazar notas mayores a 500 caracteres', () => {
      const result = settleCommissionSchema.safeParse({
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
        notes: 'a'.repeat(501),
      });
      assert.equal(result.success, false);
    });

    it('paySettlementSchema debe aceptar comprobante bancario válido', () => {
      const payload = {
        paymentReference: 'TRANSF-BAM-987654321',
        notes: 'Transferencia realizada',
      };
      const result = paySettlementSchema.safeParse(payload);
      assert.equal(result.success, true);
    });

    it('paySettlementSchema debe rechazar paymentReference menor a 3 caracteres o vacío', () => {
      const resultEmpty = paySettlementSchema.safeParse({ paymentReference: '' });
      assert.equal(resultEmpty.success, false);

      const resultShort = paySettlementSchema.safeParse({ paymentReference: 'AB' });
      assert.equal(resultShort.success, false);
    });

    it('paySettlementSchema debe rechazar notas mayores a 500 caracteres', () => {
      const result = paySettlementSchema.safeParse({
        paymentReference: 'TRANSF-12345',
        notes: 'b'.repeat(501),
      });
      assert.equal(result.success, false);
    });

    it('Constantes de comisiones deben tener valores correctos', () => {
      assert.equal(COMMISSION_RATE, 0.20);
      assert.equal(SETTLEMENT_STATUS.PENDIENTE_PAGO, 'PENDIENTE_PAGO');
      assert.equal(SETTLEMENT_STATUS.PAGADO, 'PAGADO');
      assert.equal(SETTLEMENT_STATUS.RECHAZADO, 'RECHAZADO');
    });
  });

  describe('2. Invariante Financiero del 20% y Exclusión Total de Flete (calculateSaleProductBase)', () => {
    it('debe excluir estrictamente el 100% de shippingCost de la base imponible', () => {
      // Venta con Q300 en productos y Q40 en flete
      const sale = {
        itemsSubtotal: 300,
        shippingCost: 40,
        discount: 0,
        totalAmount: 340,
      };
      const base = calculateSaleProductBase(sale);
      assert.equal(base, 300.00);

      const commission = Number((base * 0.20).toFixed(2));
      assert.equal(commission, 60.00);
      // Confirmar que NO calcula 20% sobre totalAmount (68.00)
      assert.notEqual(commission, 68.00);
    });

    it('debe aplicar descuento sobre productos antes del cálculo del 20%', () => {
      // itemsSubtotal: Q500, discount: Q100, shippingCost: Q60
      const sale = {
        itemsSubtotal: 500,
        discount: 100,
        shippingCost: 60,
        totalAmount: 460,
      };
      const base = calculateSaleProductBase(sale);
      assert.equal(base, 400.00);

      const commission = Number((base * 0.20).toFixed(2));
      assert.equal(commission, 80.00);
    });

    it('debe manejar descuento mayor a itemsSubtotal sin generar valores negativos', () => {
      const sale = {
        itemsSubtotal: 100,
        discount: 150,
        shippingCost: 35,
        totalAmount: 35,
      };
      const base = calculateSaleProductBase(sale);
      assert.equal(base, 0.00);
      assert.equal(Number((base * 0.20).toFixed(2)), 0.00);
    });

    it('debe deducir la base a partir de items cuando itemsSubtotal no está presente', () => {
      const sale = {
        items: [
          { quantity: 2, unitPrice: 65.00 }, // Q130
          { quantity: 1, unitPrice: 125.00 }, // Q125
        ],
        discount: 15.00,
        shippingCost: 45.00,
      };
      const base = calculateSaleProductBase(sale);
      assert.equal(base, 240.00); // 130 + 125 - 15 = 240
      assert.equal(Number((base * 0.20).toFixed(2)), 48.00);
    });
  });

  describe('3. Consecutivo Oficial Mensual LIQ-YYYYMM-001 (generateSettlementNumber)', () => {
    it('debe generar LIQ-YYYYMM-001 si no hay liquidaciones previas en el mes', async () => {
      const mockTx = {
        commissionSettlement: {
          findFirst: async () => null,
        },
      };
      const code = await generateSettlementNumber('tenant-1', mockTx);
      const now = new Date();
      const expectedPrefix = `LIQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-001`;
      assert.equal(code, expectedPrefix);
    });

    it('debe incrementar correlativo si ya existen liquidaciones en el mes', async () => {
      const now = new Date();
      const prefix = `LIQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      const mockTx = {
        commissionSettlement: {
          findFirst: async () => ({ settlementNumber: `${prefix}008` }),
        },
      };
      const code = await generateSettlementNumber('tenant-1', mockTx);
      assert.equal(code, `${prefix}009`);
    });

    it('debe formatear números con relleno de ceros de 3 dígitos (e.g. 010)', async () => {
      const now = new Date();
      const prefix = `LIQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      const mockTx = {
        commissionSettlement: {
          findFirst: async () => ({ settlementNumber: `${prefix}009` }),
        },
      };
      const code = await generateSettlementNumber('tenant-1', mockTx);
      assert.equal(code, `${prefix}010`);
    });
  });

  describe('4. Consulta de Comisiones Pendientes (getPendingCommissions)', () => {
    it('debe retornar solo ventas con balanceDue === 0 y status COMPLETADA', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-1',
            saleNumber: 'VENT-001',
            sellerId: 'seller-1',
            itemsSubtotal: 300,
            discount: 0,
            shippingCost: 40,
            totalAmount: 340,
            balanceDue: 0,
            status: 'COMPLETADA',
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date('2026-09-01'),
          },
          {
            id: 'sale-2',
            saleNumber: 'VENT-002',
            sellerId: 'seller-1',
            itemsSubtotal: 200,
            discount: 20,
            shippingCost: 35,
            totalAmount: 215,
            balanceDue: 0,
            status: 'COMPLETADA',
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date('2026-09-02'),
          },
        ];

        const report = await getPendingCommissions({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
        });

        assert.equal(report.salesCount, 2);
        // Sale 1: base 300 -> com 60
        // Sale 2: base 180 -> com 36
        // Total products: 480.00
        // Total shipping excluded: 75.00
        // Total commission: 96.00 (20% de 480)
        assert.equal(report.totalProductsAmount, 480.00);
        assert.equal(report.totalShippingExcluded, 75.00);
        assert.equal(report.totalCommission, 96.00);
        assert.equal(report.commissionRate, 0.20);
        assert.equal(report.sales[0].commissionAmount, 60.00);
        assert.equal(report.sales[1].commissionAmount, 36.00);
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });

    it('debe filtrar cualquier venta con balanceDue > 0 en memoria si viniera del query', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-unpaid',
            saleNumber: 'VENT-UNPAID',
            sellerId: 'seller-1',
            itemsSubtotal: 300,
            balanceDue: 170.00, // Saldo pendiente
            status: 'COMPLETADA',
            commissionPaid: false,
            commissionSettlementId: null,
          },
        ];

        const report = await getPendingCommissions({ tenantId: 'tenant-1', sellerId: 'seller-1' });
        assert.equal(report.salesCount, 0);
        assert.equal(report.totalProductsAmount, 0);
        assert.equal(report.totalCommission, 0);
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });
  });

  describe('5. Transacción Atómica de Liquidación (createSettlementTransaction)', () => {
    it('debe rechazar con HTTP 404 si el vendedor no existe en la empresa', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => null },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-unknown',
              saleIds: ['sale-1'],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Vendedor no encontrado/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 422 si alguna venta tiene saldo pendiente (balanceDue > 0)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-001',
                sellerId: 'seller-1',
                itemsSubtotal: 300,
                balanceDue: 150.00, // VIOLACIÓN DE SALDO
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date(),
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              saleIds: ['sale-1'],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 422);
            assert.match(err.message, /no es elegible para liquidación: saldo pendiente/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 422 si alguna venta no está COMPLETADA', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-001',
                sellerId: 'seller-1',
                itemsSubtotal: 300,
                balanceDue: 0,
                status: 'PENDIENTE', // NO COMPLETADA
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date(),
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              saleIds: ['sale-1'],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 422);
            assert.match(err.message, /no es elegible para liquidación/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si alguna venta ya fue liquidada previamente', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-001',
                sellerId: 'seller-1',
                itemsSubtotal: 300,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: true, // YA LIQUIDADA
                commissionSettlementId: 'existing-settlement',
                createdAt: new Date(),
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              saleIds: ['sale-1'],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /ya fue liquidada previamente/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si una venta no pertenece al vendedor seleccionado', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-001',
                sellerId: 'other-seller', // OTRO VENDEDOR
                itemsSubtotal: 300,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date(),
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              saleIds: ['sale-1'],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /no pertenece al vendedor seleccionado/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si no hay ventas elegibles', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }) },
          sale: {
            findMany: async () => [],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-1',
              sellerId: 'seller-1',
              saleIds: [],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /No hay ventas elegibles para liquidar/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe ejecutar liquidación atómica, congelar ventas y generar LIQ-YYYYMM-001', async () => {
      const originalTx = prisma.$transaction;
      try {
        let frozenSaleIds = null;
        let auditLogEntry = null;

        const mockTx = {
          user: {
            findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-001',
                sellerId: 'seller-1',
                itemsSubtotal: 300,
                discount: 0,
                shippingCost: 40, // EXCLUIDO
                totalAmount: 340,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date('2026-09-10'),
              },
              {
                id: 'sale-2',
                saleNumber: 'VENT-002',
                sellerId: 'seller-1',
                itemsSubtotal: 200,
                discount: 50,
                shippingCost: 35, // EXCLUIDO
                totalAmount: 185,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date('2026-09-15'),
              },
            ],
            updateMany: async ({ where, data }) => {
              frozenSaleIds = where.id.in;
              return { count: 2 };
            },
          },
          commissionSettlement: {
            findFirst: async () => null,
            create: async ({ data }) => ({
              id: 'settlement-new-1',
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          auditLog: {
            create: async ({ data }) => {
              auditLogEntry = data;
              return { id: 'audit-1', ...data };
            },
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const settlement = await createSettlementTransaction({
          tenantId: 'tenant-1',
          sellerId: 'seller-1',
          saleIds: ['sale-1', 'sale-2'],
          approvedById: 'admin-1',
          notes: 'Liquidación oficial primera quincena',
        });

        // 1. Número correlativo
        assert.match(settlement.settlementNumber, /^LIQ-\d{6}-001$/);
        // 2. Base imponible: 300 + (200 - 50) = 450.00
        assert.equal(settlement.totalProductsAmount, 450.00);
        // 3. Comisión 20%: 450 * 0.20 = 90.00
        assert.equal(settlement.totalCommission, 90.00);
        assert.equal(settlement.salesCount, 2);
        assert.equal(settlement.status, 'PENDIENTE_PAGO');
        assert.equal(settlement.approvedById, 'admin-1');

        // 4. Congelamiento de ventas
        assert.deepEqual(frozenSaleIds, ['sale-1', 'sale-2']);

        // 5. Registro de auditoría
        assert.equal(auditLogEntry.action, 'SETTLEMENT_CREATED');
        assert.equal(auditLogEntry.entity, 'COMMISSION_SETTLEMENT');
        assert.equal(auditLogEntry.entityId, 'settlement-new-1');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  describe('6. Desembolso / Pago de Liquidación (markSettlementPaid)', () => {
    it('debe rechazar con HTTP 404 si la liquidación no existe', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          commissionSettlement: { findFirst: async () => null },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await markSettlementPaid({
              tenantId: 'tenant-1',
              settlementId: 'liq-nonexistent',
              paymentReference: 'TRANSF-1234',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Liquidación no encontrada/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si la liquidación no está en estado PENDIENTE_PAGO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          commissionSettlement: {
            findFirst: async () => ({
              id: 'liq-1',
              status: 'PAGADO', // YA PAGADA
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await markSettlementPaid({
              tenantId: 'tenant-1',
              settlementId: 'liq-1',
              paymentReference: 'TRANSF-1234',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /no está en estado PENDIENTE_PAGO/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe conmutar estado a PAGADO, registrar referencia y crear auditLog', async () => {
      const originalTx = prisma.$transaction;
      try {
        let auditLogEntry = null;
        let updateData = null;

        const mockTx = {
          commissionSettlement: {
            findFirst: async () => ({
              id: 'liq-1',
              status: 'PENDIENTE_PAGO',
              notes: 'Notas previas',
            }),
            update: async ({ data }) => {
              updateData = data;
              return {
                id: 'liq-1',
                ...data,
                seller: { id: 'seller-1', fullName: 'Vendedor', email: 'vendedor@deko.gt' },
                approvedBy: { id: 'admin-1', fullName: 'Admin', email: 'admin@deko.gt' },
              };
            },
          },
          auditLog: {
            create: async ({ data }) => {
              auditLogEntry = data;
              return { id: 'audit-paid', ...data };
            },
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const paidSettlement = await markSettlementPaid({
          tenantId: 'tenant-1',
          settlementId: 'liq-1',
          paymentReference: '  BANRURAL-TRANS-554433  ',
          userId: 'admin-1',
          notes: 'Transferencia confirmada en portal bancario',
        });

        assert.equal(paidSettlement.status, 'PAGADO');
        assert.equal(updateData.status, 'PAGADO');
        assert.equal(updateData.paymentReference, 'BANRURAL-TRANS-554433');
        assert.ok(updateData.paidAt instanceof Date);
        assert.equal(auditLogEntry.action, 'SETTLEMENT_PAID');
        assert.equal(auditLogEntry.entity, 'COMMISSION_SETTLEMENT');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  describe('7. Consultas Históricas (getSettlementsList y getSettlementById)', () => {
    it('getSettlementsList debe retornar lista paginada', async () => {
      const originalCount = prisma.commissionSettlement.count;
      const originalFindMany = prisma.commissionSettlement.findMany;
      try {
        prisma.commissionSettlement.count = async () => 25;
        prisma.commissionSettlement.findMany = async () => [
          { id: 'liq-1', settlementNumber: 'LIQ-202609-001', status: 'PAGADO' },
        ];

        const result = await getSettlementsList({
          tenantId: 'tenant-1',
          page: 1,
          limit: 10,
        });

        assert.equal(result.total, 25);
        assert.equal(result.page, 1);
        assert.equal(result.limit, 10);
        assert.equal(result.totalPages, 3);
        assert.equal(result.hasNext, true);
        assert.equal(result.hasPrev, false);
      } finally {
        prisma.commissionSettlement.count = originalCount;
        prisma.commissionSettlement.findMany = originalFindMany;
      }
    });

    it('getSettlementById debe rechazar con HTTP 404 si la liquidación no existe', async () => {
      const originalFindFirst = prisma.commissionSettlement.findFirst;
      try {
        prisma.commissionSettlement.findFirst = async () => null;

        await assert.rejects(
          async () => {
            await getSettlementById({ tenantId: 'tenant-1', settlementId: 'non-existent' });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Liquidación no encontrada/);
            return true;
          }
        );
      } finally {
        prisma.commissionSettlement.findFirst = originalFindFirst;
      }
    });
  });

  describe('8. Controlador HTTP y Preservación de Códigos de Estado (commissionController)', () => {
    it('getPendingCommissions debe retornar 200 con reporte y filtrar por sellerId para vendedores', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async ({ where }) => {
          assert.equal(where.sellerId, 'seller-own-id');
          return [];
        };

        const { req, res } = createMockReqRes({
          user: { id: 'seller-own-id', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
          query: { sellerId: 'attempt-other-seller' }, // Intento de consultar a otro
        });

        await getPendingCommissionsController(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.salesCount, 0);
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });

    it('settleCommissions debe retornar 201 y mensaje de éxito', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1', fullName: 'Vendedor', email: 'v@d.gt' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-1',
                sellerId: 'seller-1',
                itemsSubtotal: 200,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date(),
              },
            ],
            updateMany: async () => ({ count: 1 }),
          },
          commissionSettlement: {
            findFirst: async () => null,
            create: async ({ data }) => ({ id: 'liq-created-1', ...data }),
          },
          auditLog: { create: async () => ({}) },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          user: { id: 'admin-1', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
          body: { sellerId: 'seller-1', saleIds: ['sale-1'] },
        });

        await settleCommissionsController(req, res);
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.match(res.body.message, /creada exitosamente/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('settleCommissions debe preservar HTTP 422 ante fallo de compuerta de saldo', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: { findFirst: async () => ({ id: 'seller-1' }) },
          sale: {
            findMany: async () => [
              {
                id: 'sale-1',
                saleNumber: 'VENT-UNPAID',
                sellerId: 'seller-1',
                balanceDue: 50.00,
                status: 'COMPLETADA',
                createdAt: new Date(),
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          user: { id: 'admin-1', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
          body: { sellerId: 'seller-1', saleIds: ['sale-1'] },
        });

        await settleCommissionsController(req, res);
        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /saldo pendiente/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('getSettlement debe retornar 403 si un vendedor intenta consultar liquidación de otro vendedor', async () => {
      const originalFindFirst = prisma.commissionSettlement.findFirst;
      try {
        prisma.commissionSettlement.findFirst = async () => ({
          id: 'liq-other',
          sellerId: 'seller-999', // Pertenece a otro vendedor
          sales: [],
        });

        const { req, res } = createMockReqRes({
          user: { id: 'seller-my-id', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
          params: { id: 'liq-other' },
        });

        await getSettlementController(req, res);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /No tienes permiso/);
      } finally {
        prisma.commissionSettlement.findFirst = originalFindFirst;
      }
    });

    it('markPaid debe retornar 200 y mensaje de confirmación', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          commissionSettlement: {
            findFirst: async () => ({ id: 'liq-1', status: 'PENDIENTE_PAGO' }),
            update: async ({ data }) => ({ id: 'liq-1', ...data }),
          },
          auditLog: { create: async () => ({}) },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          user: { id: 'admin-1', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
          params: { id: 'liq-1' },
          body: { paymentReference: 'REF-BANK-12345' },
        });

        await markPaidController(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.match(res.body.message, /marcada como pagada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
