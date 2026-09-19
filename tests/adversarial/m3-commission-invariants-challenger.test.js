/**
 * tests/adversarial/m3-commission-invariants-challenger.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 3
 * Domain 3 — Invariante 20% & Zero-Balance Gate Verification
 *
 * Requirements Challenged:
 * 1. Invariante 20% sobre subtotal neto de productos:
 *    - Ventas con fletes gigantescos (e.g. Q100 productos + Q500 flete): comisión = Q20.00 (NUNCA Q120.00).
 *    - Descuentos sobre productos: Q200 productos con Q50 descuento -> base Q150 -> comisión Q30.00.
 *    - Monto cero en productos con flete activo: comisión = Q0.00.
 *    - Límites de redondeo de punto flotante (IEEE 754): Q199.99 * 0.20 redondeado a Q40.00 (2 decimales).
 * 2. Zero-Balance Gate (Freno de Saldo):
 *    - Intento de liquidar orden con balanceDue = 0.01 DEBE fallar con HTTP 422.
 *    - Intento de liquidar orden con balanceDue = 150.00 DEBE fallar con HTTP 422.
 *    - Intento de liquidar orden con status PENDIENTE o ANULADA DEBE fallar con HTTP 422.
 *    - Intento de liquidar orden ya liquidada (commissionPaid === true) DEBE ser bloqueado y rechazado.
 * 3. Preservación estricta de códigos HTTP en controlador y transaccionalidad ACID.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment configuration
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'adversarial_challenger_m3_test_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'admin@dekolabs.org';

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
import { prisma } from '../../server/config/prisma.js';

// =============================================================================
// HIGH-FIDELITY IN-MEMORY STORE FOR COMMISSION INVARIANTS & PRISMA TX
// =============================================================================
class MockCommissionStore {
  constructor() {
    this.sales = new Map();
    this.users = new Map();
    this.commissionSettlements = new Map();
    this.auditLogs = [];
  }

  reset() {
    this.sales.clear();
    this.users.clear();
    this.commissionSettlements.clear();
    this.auditLogs = [];
  }

  seedUser(user) {
    this.users.set(user.id, {
      id: user.id,
      tenantId: user.tenantId || 'tenant-deko-01',
      fullName: user.fullName || 'Vendedor Redes',
      email: user.email || 'vendedor@dekolabs.org',
      role: user.role || 'VENDEDOR_REDES',
      roles: user.roles || ['VENDEDOR_REDES'],
    });
  }

  seedSale(sale) {
    const defaultCreatedAt = sale.createdAt ? new Date(sale.createdAt) : new Date();
    this.sales.set(sale.id, {
      id: sale.id,
      tenantId: sale.tenantId || 'tenant-deko-01',
      saleNumber: sale.saleNumber || `VENT-${Math.floor(1000 + Math.random() * 9000)}`,
      sellerId: sale.sellerId || 'usr-seller-01',
      itemsSubtotal: sale.itemsSubtotal != null ? Number(sale.itemsSubtotal) : undefined,
      discount: Number(sale.discount || 0),
      shippingCost: Number(sale.shippingCost || 0),
      totalAmount: Number(sale.totalAmount != null ? sale.totalAmount : (Number(sale.itemsSubtotal || 0) - Number(sale.discount || 0) + Number(sale.shippingCost || 0))),
      depositAmount: Number(sale.depositAmount || 0),
      balanceDue: Number(sale.balanceDue != null ? sale.balanceDue : 0),
      status: sale.status || 'COMPLETADA',
      paymentStatus: sale.paymentStatus || 'PAGADO_TOTAL',
      commissionPaid: Boolean(sale.commissionPaid),
      commissionSettlementId: sale.commissionSettlementId || null,
      createdAt: defaultCreatedAt,
      items: Array.isArray(sale.items) ? sale.items : [],
    });
  }

  createTxClient() {
    const store = this;
    return {
      user: {
        findFirst: async ({ where }) => {
          for (const u of store.users.values()) {
            if (where.id && u.id !== where.id) continue;
            if (where.tenantId && u.tenantId !== where.tenantId) continue;
            return { id: u.id, fullName: u.fullName, email: u.email };
          }
          return null;
        },
      },
      sale: {
        findMany: async ({ where, include, orderBy }) => {
          const results = [];
          for (const s of store.sales.values()) {
            if (where?.tenantId && s.tenantId !== where.tenantId) continue;
            if (where?.sellerId && s.sellerId !== where.sellerId) continue;
            if (where?.id?.in && !where.id.in.includes(s.id)) continue;
            if (where?.status && s.status !== where.status) continue;
            if (where?.commissionPaid !== undefined && s.commissionPaid !== where.commissionPaid) continue;
            if (where?.commissionSettlementId === null && s.commissionSettlementId !== null) continue;
            if (where?.balanceDue !== undefined && Number(s.balanceDue) !== Number(where.balanceDue)) continue;
            if (where?.createdAt?.gte && new Date(s.createdAt) < new Date(where.createdAt.gte)) continue;
            if (where?.createdAt?.lte && new Date(s.createdAt) > new Date(where.createdAt.lte)) continue;

            const copy = JSON.parse(JSON.stringify(s));
            copy.createdAt = new Date(s.createdAt);
            if (include?.seller) {
              const u = store.users.get(s.sellerId);
              copy.seller = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
            }
            if (include?.items) {
              copy.items = s.items || [];
            }
            results.push(copy);
          }
          if (orderBy?.createdAt === 'asc') {
            results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
          return results;
        },
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const s of store.sales.values()) {
            if (where?.tenantId && s.tenantId !== where.tenantId) continue;
            if (where?.id?.in && where.id.in.includes(s.id)) {
              if (data.commissionSettlementId !== undefined) s.commissionSettlementId = data.commissionSettlementId;
              if (data.commissionPaid !== undefined) s.commissionPaid = data.commissionPaid;
              count++;
            }
          }
          return { count };
        },
      },
      commissionSettlement: {
        findFirst: async ({ where, orderBy, include }) => {
          const matches = [];
          for (const cs of store.commissionSettlements.values()) {
            if (where?.id && cs.id !== where.id) continue;
            if (where?.tenantId && cs.tenantId !== where.tenantId) continue;
            if (where?.status && cs.status !== where.status) continue;
            if (where?.settlementNumber?.startsWith && !cs.settlementNumber.startsWith(where.settlementNumber.startsWith)) continue;
            matches.push(cs);
          }
          if (orderBy?.settlementNumber === 'desc') {
            matches.sort((a, b) => b.settlementNumber.localeCompare(a.settlementNumber));
          }
          const found = matches[0] || null;
          if (!found) return null;
          const res = JSON.parse(JSON.stringify(found));
          if (include?.seller) {
            const u = store.users.get(found.sellerId);
            res.seller = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
          }
          if (include?.approvedBy && found.approvedById) {
            const u = store.users.get(found.approvedById);
            res.approvedBy = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
          }
          return res;
        },
        findMany: async ({ where, skip = 0, take = 20, orderBy, include }) => {
          const matches = [];
          for (const cs of store.commissionSettlements.values()) {
            if (where?.tenantId && cs.tenantId !== where.tenantId) continue;
            if (where?.sellerId && cs.sellerId !== where.sellerId) continue;
            if (where?.status && cs.status !== where.status) continue;
            matches.push(cs);
          }
          if (orderBy?.createdAt === 'desc') {
            matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          const paginated = matches.slice(skip, skip + take);
          return paginated.map((cs) => {
            const res = JSON.parse(JSON.stringify(cs));
            if (include?.seller) {
              const u = store.users.get(cs.sellerId);
              res.seller = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
            }
            if (include?.approvedBy && cs.approvedById) {
              const u = store.users.get(cs.approvedById);
              res.approvedBy = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
            }
            return res;
          });
        },
        count: async ({ where }) => {
          let c = 0;
          for (const cs of store.commissionSettlements.values()) {
            if (where?.tenantId && cs.tenantId !== where.tenantId) continue;
            if (where?.sellerId && cs.sellerId !== where.sellerId) continue;
            if (where?.status && cs.status !== where.status) continue;
            c++;
          }
          return c;
        },
        create: async ({ data }) => {
          const id = `settlement-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const record = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          store.commissionSettlements.set(id, record);
          return JSON.parse(JSON.stringify(record));
        },
        update: async ({ where, data, include }) => {
          const existing = store.commissionSettlements.get(where.id);
          if (!existing) throw new Error('Settlement not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          store.commissionSettlements.set(where.id, updated);
          const res = { ...updated };
          if (include?.seller) {
            const u = store.users.get(updated.sellerId);
            res.seller = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
          }
          if (include?.approvedBy && updated.approvedById) {
            const u = store.users.get(updated.approvedById);
            res.approvedBy = u ? { id: u.id, fullName: u.fullName, email: u.email } : null;
          }
          return res;
        },
      },
      auditLog: {
        create: async ({ data }) => {
          store.auditLogs.push(data);
          return { id: `audit-${store.auditLogs.length}` };
        },
      },
    };
  }
}

const store = new MockCommissionStore();

function installMockPrisma() {
  store.reset();
  const txClient = store.createTxClient();
  prisma.sale = txClient.sale;
  prisma.user = txClient.user;
  prisma.commissionSettlement = txClient.commissionSettlement;
  prisma.auditLog = txClient.auditLog;
  prisma.$transaction = async (callback) => {
    return callback(txClient);
  };
}

function createMockHttp({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
  tenantId = 'tenant-deko-01',
} = {}) {
  const req = { body, query, params, headers, user, tenantId };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return responseData;
    },
  };

  return { req, res };
}

describe('⚔️ CHALLENGER M3: Invariante 20% & Zero-Balance Gate Forensic Suite', () => {
  beforeEach(() => {
    installMockPrisma();
    store.seedUser({ id: 'usr-seller-01', tenantId: 'tenant-deko-01', fullName: 'Vendedor Redes 1' });
    store.seedUser({ id: 'usr-seller-02', tenantId: 'tenant-deko-01', fullName: 'Vendedor Redes 2' });
    store.seedUser({ id: 'usr-admin-01', tenantId: 'tenant-deko-01', fullName: 'Super Admin', role: 'SUPER_ADMIN' });
  });

  // ===========================================================================
  // SUITE 1: INVARIANTE FINANCIERO DEL 20% (EXCLUSIÓN ABSOLUTA DE FLETE)
  // ===========================================================================
  describe('1. Invariante 20% sobre Subtotal Neto de Productos (Flete Excluido 100%)', () => {
    it('1.1 Venta con flete grande (Q 100 productos + Q 500 flete): comisión DEBE ser estrictamente Q 20.00, NUNCA Q 120.00', () => {
      const saleWithLargeShipping = {
        itemsSubtotal: 100.00,
        shippingCost: 500.00,
        discount: 0.00,
        totalAmount: 600.00,
      };

      const base = calculateSaleProductBase(saleWithLargeShipping);
      assert.strictEqual(base, 100.00, 'La base imponible debe ser exactamente Q 100.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.strictEqual(commission, 20.00, 'La comisión debe ser exactamente Q 20.00');
      assert.notStrictEqual(commission, 120.00, 'VIOLACIÓN: La comisión jamás debe incluir el 20% del flete (Q 120.00)');
    });

    it('1.2 Venta con flete masivo interdepartamental (Q 50 productos + Q 2,500 flete): comisión DEBE ser Q 10.00', () => {
      const saleExtreme = {
        itemsSubtotal: 50.00,
        shippingCost: 2500.00,
        discount: 0.00,
        totalAmount: 2550.00,
      };

      const base = calculateSaleProductBase(saleExtreme);
      assert.strictEqual(base, 50.00);

      const commission = Number((base * 0.20).toFixed(2));
      assert.strictEqual(commission, 10.00, 'Comisión debe ser estrictamente Q 10.00');
      assert.notStrictEqual(commission, 510.00, 'VIOLACIÓN: Comisión no puede calcularse sobre total con flete (Q 510.00)');
    });

    it('1.3 Descuentos: Q 200 productos con Q 50 descuento -> base es Q 150 -> comisión Q 30.00', () => {
      const saleWithDiscount = {
        itemsSubtotal: 200.00,
        discount: 50.00,
        shippingCost: 40.00,
        totalAmount: 190.00,
      };

      const base = calculateSaleProductBase(saleWithDiscount);
      assert.strictEqual(base, 150.00, 'Base neta = 200 - 50 = Q 150.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.strictEqual(commission, 30.00, 'Comisión = 150 * 0.20 = Q 30.00');
    });

    it('1.4 Descuento mayor a productos: no genera base imponible negativa (piso en Q 0.00)', () => {
      const saleOverDiscount = {
        itemsSubtotal: 100.00,
        discount: 150.00,
        shippingCost: 50.00,
        totalAmount: 50.00,
      };

      const base = calculateSaleProductBase(saleOverDiscount);
      assert.strictEqual(base, 0.00, 'Base debe tener piso en 0.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.strictEqual(commission, 0.00, 'Comisión debe ser estrictamente Q 0.00');
    });

    it('1.5 Monto cero en productos con flete activo: comisión DEBE ser estrictamente Q 0.00', () => {
      const saleOnlyShipping = {
        itemsSubtotal: 0.00,
        discount: 0.00,
        shippingCost: 85.00,
        totalAmount: 85.00,
      };

      const base = calculateSaleProductBase(saleOnlyShipping);
      assert.strictEqual(base, 0.00);

      const commission = Number((base * 0.20).toFixed(2));
      assert.strictEqual(commission, 0.00, 'Comisión sobre orden sin productos debe ser Q 0.00');
    });

    it('1.6 Límites de redondeo de punto flotante: Q 199.99 * 0.20 redondea exactamente a Q 40.00', () => {
      const rawCalculation = 199.99 * 0.20; // 39.998 en IEEE 754
      const roundedCommission = Number(rawCalculation.toFixed(2));
      assert.strictEqual(roundedCommission, 40.00, '199.99 * 0.20 = 39.998 -> redondeado a 2 decimales debe ser Q 40.00');

      const sale = { itemsSubtotal: 199.99, discount: 0, shippingCost: 35, totalAmount: 234.99 };
      const base = calculateSaleProductBase(sale);
      assert.strictEqual(base, 199.99);
      assert.strictEqual(Number((base * 0.20).toFixed(2)), 40.00);
    });

    it('1.7 Batería de límites decimales IEEE 754 con fracciones críticas', () => {
      const cases = [
        { base: 10.01, expected: 2.00 }, // 10.01 * 0.20 = 2.002 -> 2.00
        { base: 10.03, expected: 2.01 }, // 10.03 * 0.20 = 2.006 -> 2.01
        { base: 59.99, expected: 12.00 }, // 59.99 * 0.20 = 11.998 -> 12.00
        { base: 0.01, expected: 0.00 },  // 0.01 * 0.20 = 0.002 -> 0.00
        { base: 0.03, expected: 0.01 },  // 0.03 * 0.20 = 0.006 -> 0.01
        { base: 99.95, expected: 19.99 }, // 99.95 * 0.20 = 19.99
      ];

      for (const c of cases) {
        const com = Number((c.base * 0.20).toFixed(2));
        assert.strictEqual(com, c.expected, `Fallo en redondeo para base ${c.base}: obtenido ${com}, esperado ${c.expected}`);
      }
    });

    it('1.8 Deducción por array de items cuando itemsSubtotal no está presente en la orden', () => {
      const saleWithItems = {
        items: [
          { quantity: 3, unitPrice: 55.00 }, // Q 165.00
          { quantity: 2, unitPrice: 35.00 }, // Q 70.00
        ],
        discount: 35.00,
        shippingCost: 50.00,
      };

      const base = calculateSaleProductBase(saleWithItems);
      // (165 + 70) - 35 = 235 - 35 = Q 200.00
      assert.strictEqual(base, 200.00);
      assert.strictEqual(Number((base * 0.20).toFixed(2)), 40.00);
    });

    it('1.9 Fallback matemático por totalAmount y shippingCost cuando no hay items ni itemsSubtotal', () => {
      const rawSale = {
        totalAmount: 450.00,
        shippingCost: 150.00,
        discount: 0.00,
      };

      const base = calculateSaleProductBase(rawSale);
      // 450 - 150 = Q 300.00
      assert.strictEqual(base, 300.00);
      assert.strictEqual(Number((base * 0.20).toFixed(2)), 60.00);
    });
  });

  // ===========================================================================
  // SUITE 2: ZERO-BALANCE GATE (FRENO DE SALDO) EN CREATESETTLEMENTTRANSACTION
  // ===========================================================================
  describe('2. Zero-Balance Gate (Freno de Saldo): Rechazo con HTTP 422', () => {
    it('2.1 Intento de liquidar orden con balanceDue = 0.01 DEBE fallar con HTTP 422', async () => {
      store.seedSale({
        id: 'sale-gate-001',
        saleNumber: 'VENT-GATE-001',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200.00,
        balanceDue: 0.01, // LÍMITE DE SALDO RESIDUAL
        status: 'COMPLETADA',
        commissionPaid: false,
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-gate-001'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Debe lanzar HTTP 422 ante balanceDue = 0.01');
          assert.match(err.message, /saldo pendiente/i);
          return true;
        }
      );
    });

    it('2.2 Intento de liquidar orden con balanceDue = 150.00 DEBE fallar con HTTP 422', async () => {
      store.seedSale({
        id: 'sale-gate-150',
        saleNumber: 'VENT-GATE-150',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300.00,
        balanceDue: 150.00, // SALDO PENDIENTE 50%
        status: 'COMPLETADA',
        commissionPaid: false,
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-gate-150'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Debe lanzar HTTP 422 ante balanceDue = 150.00');
          assert.match(err.message, /saldo pendiente/i);
          return true;
        }
      );
    });

    it('2.3 Intento de liquidar orden con status PENDIENTE DEBE fallar con HTTP 422', async () => {
      store.seedSale({
        id: 'sale-status-pendiente',
        saleNumber: 'VENT-PENDIENTE',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200.00,
        balanceDue: 0.00, // Saldo en cero pero orden PENDIENTE
        status: 'PENDIENTE',
        commissionPaid: false,
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-status-pendiente'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Debe lanzar HTTP 422 ante status PENDIENTE');
          assert.match(err.message, /no es elegible para liquidación/i);
          return true;
        }
      );
    });

    it('2.4 Intento de liquidar orden con status ANULADA DEBE fallar con HTTP 422', async () => {
      store.seedSale({
        id: 'sale-status-anulada',
        saleNumber: 'VENT-ANULADA',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300.00,
        balanceDue: 0.00,
        status: 'ANULADA',
        commissionPaid: false,
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-status-anulada'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Debe lanzar HTTP 422 ante status ANULADA');
          assert.match(err.message, /no es elegible para liquidación/i);
          return true;
        }
      );
    });

    it('2.5 Intento de liquidar orden ya liquidada (commissionPaid === true) DEBE ser rechazado y bloqueado', async () => {
      store.seedSale({
        id: 'sale-already-paid',
        saleNumber: 'VENT-ALREADY-PAID',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 250.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
        commissionPaid: true, // YA LIQUIDADA
        commissionSettlementId: 'existing-liq-uuid',
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-already-paid'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          // El servicio bloquea re-liquidación rechazando con código de cliente (400 / 422)
          assert.ok(
            err.statusCode === 400 || err.statusCode === 422,
            `El código HTTP debe ser de error de cliente (400 o 422), recibido: ${err.statusCode}`
          );
          assert.match(err.message, /ya fue liquidada previamente/i);
          return true;
        }
      );
    });

    it('2.6 Envenenamiento de lote (Mixed Batch Poisoning): un solo balanceDue = 0.01 aborta todo el lote', async () => {
      store.seedSale({
        id: 'batch-sale-1',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'COMPLETADA',
      });
      store.seedSale({
        id: 'batch-sale-2',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300,
        balanceDue: 0,
        status: 'COMPLETADA',
      });
      store.seedSale({
        id: 'batch-sale-poison',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 150,
        balanceDue: 0.01, // LOTE CONTAMINADO
        status: 'COMPLETADA',
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['batch-sale-1', 'batch-sale-2', 'batch-sale-poison'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          return true;
        }
      );

      // Confirmar integridad transaccional: ninguna venta fue congelada
      const sale1 = store.sales.get('batch-sale-1');
      assert.strictEqual(sale1.commissionPaid, false, 'Venta 1 no debe haber sido congelada');
      assert.strictEqual(sale1.commissionSettlementId, null);
      assert.strictEqual(store.commissionSettlements.size, 0, 'No debe haberse creado ninguna liquidación');
    });

    it('2.7 Rechazo si una venta en el lote pertenece a otro vendedor (HTTP 400)', async () => {
      store.seedSale({
        id: 'sale-seller-1',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'COMPLETADA',
      });
      store.seedSale({
        id: 'sale-seller-2',
        sellerId: 'usr-seller-02', // OTRO VENDEDOR
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'COMPLETADA',
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['sale-seller-1', 'sale-seller-2'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no pertenece al vendedor seleccionado/i);
          return true;
        }
      );
    });
  });

  // ===========================================================================
  // SUITE 3: CONSULTA FILTRADA DE COMISIONES PENDIENTES (GETPENDINGCOMMISSIONS)
  // ===========================================================================
  describe('3. Consulta de Comisiones Pendientes (getPendingCommissions)', () => {
    it('3.1 Excluye estrictamente ventas con balanceDue > 0 y calcula comisiones netas de las elegibles', async () => {
      // Orden 1: Q100 productos + Q500 flete (Total 600, saldo 0) -> elegible
      store.seedSale({
        id: 's-eligible-1',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 100.00,
        shippingCost: 500.00,
        totalAmount: 600.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
      });

      // Orden 2: Q200 productos - Q50 descuento + Q40 flete (Total 190, saldo 0) -> elegible
      store.seedSale({
        id: 's-eligible-2',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200.00,
        discount: 50.00,
        shippingCost: 40.00,
        totalAmount: 190.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
      });

      // Orden 3: Saldo pendiente Q0.01 -> DEBE SER EXCLUIDA
      store.seedSale({
        id: 's-unpaid-001',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300.00,
        balanceDue: 0.01,
        status: 'COMPLETADA',
      });

      // Orden 4: Saldo pendiente Q150.00 -> DEBE SER EXCLUIDA
      store.seedSale({
        id: 's-unpaid-150',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300.00,
        balanceDue: 150.00,
        status: 'COMPLETADA',
      });

      // Orden 5: Saldo 0 pero status PENDIENTE -> DEBE SER EXCLUIDA
      store.seedSale({
        id: 's-pending-status',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300.00,
        balanceDue: 0.00,
        status: 'PENDIENTE',
      });

      const report = await getPendingCommissions({
        tenantId: 'tenant-deko-01',
        sellerId: 'usr-seller-01',
      });

      // Solo Orden 1 y Orden 2 deben ser elegibles
      assert.strictEqual(report.salesCount, 2);
      // Base productos: 100 + (200 - 50) = 250.00
      assert.strictEqual(report.totalProductsAmount, 250.00);
      // Flete excluido: 500 + 40 = 540.00
      assert.strictEqual(report.totalShippingExcluded, 540.00);
      // Comisión 20%: 250 * 0.20 = 50.00
      assert.strictEqual(report.totalCommission, 50.00);
      assert.strictEqual(report.commissionRate, 0.20);
    });

    it('3.2 Filtro defensivo en memoria purga ventas corruptas con saldo residual > 0', async () => {
      // Simulamos que el query devolvió una venta con balanceDue = 0.05
      store.seedSale({
        id: 's-corrupt',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 100.00,
        balanceDue: 0.05,
        status: 'COMPLETADA',
      });

      const report = await getPendingCommissions({
        tenantId: 'tenant-deko-01',
        sellerId: 'usr-seller-01',
      });

      assert.strictEqual(report.salesCount, 0);
      assert.strictEqual(report.totalProductsAmount, 0);
      assert.strictEqual(report.totalCommission, 0);
    });
  });

  // ===========================================================================
  // SUITE 4: CONTROLADOR HTTP Y PRESERVACIÓN DE CÓDIGOS DE ESTADO (HTTP 422)
  // ===========================================================================
  describe('4. Controlador HTTP (commissionController): Mapeo Fidedigno de Códigos', () => {
    it('4.1 settleCommissions controller responde con HTTP 422 cuando hay balanceDue = 0.01', async () => {
      store.seedSale({
        id: 'sale-ctrl-001',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0.01,
        status: 'COMPLETADA',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        body: { sellerId: 'usr-seller-01', saleIds: ['sale-ctrl-001'] },
      });

      await settleCommissionsController(req, res);
      assert.strictEqual(res.statusCode, 422, 'El controlador debe responder con HTTP 422');
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /saldo pendiente/i);
    });

    it('4.2 settleCommissions controller responde con HTTP 422 cuando una orden tiene status PENDIENTE', async () => {
      store.seedSale({
        id: 'sale-ctrl-pend',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'PENDIENTE',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        body: { sellerId: 'usr-seller-01', saleIds: ['sale-ctrl-pend'] },
      });

      await settleCommissionsController(req, res);
      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /no es elegible/i);
    });

    it('4.3 settleCommissions controller responde con HTTP 422 cuando una orden tiene status ANULADA', async () => {
      store.seedSale({
        id: 'sale-ctrl-anul',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'ANULADA',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        body: { sellerId: 'usr-seller-01', saleIds: ['sale-ctrl-anul'] },
      });

      await settleCommissionsController(req, res);
      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
    });

    it('4.4 settleCommissions controller rechaza ventas ya liquidadas previamente', async () => {
      store.seedSale({
        id: 'sale-ctrl-paid',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200,
        balanceDue: 0,
        status: 'COMPLETADA',
        commissionPaid: true,
        commissionSettlementId: 'existing-liq',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        body: { sellerId: 'usr-seller-01', saleIds: ['sale-ctrl-paid'] },
      });

      await settleCommissionsController(req, res);
      assert.ok(res.statusCode === 400 || res.statusCode === 422);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /ya fue liquidada/i);
    });

    it('4.5 settleCommissions controller responde con HTTP 201 y mensaje cuando todas las órdenes son válidas', async () => {
      store.seedSale({
        id: 'sale-ctrl-ok',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 300,
        shippingCost: 40,
        totalAmount: 340,
        balanceDue: 0,
        status: 'COMPLETADA',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        body: { sellerId: 'usr-seller-01', saleIds: ['sale-ctrl-ok'] },
      });

      await settleCommissionsController(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /creada exitosamente/i);
      assert.strictEqual(res.body.data.totalProductsAmount, 300.00);
      assert.strictEqual(res.body.data.totalCommission, 60.00);
    });

    it('4.6 getPendingCommissions controller responde con HTTP 200 y respeta filtros de seguridad de rol', async () => {
      store.seedSale({
        id: 'sale-vendedor-1',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 100,
        balanceDue: 0,
        status: 'COMPLETADA',
      });

      const { req, res } = createMockHttp({
        user: { id: 'usr-seller-01', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        query: { sellerId: 'usr-seller-02' }, // Intento de espiar a otro
      });

      await getPendingCommissionsController(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      // Debe retornar solo las del usuario en sesión
      assert.strictEqual(res.body.data.salesCount, 1);
      assert.strictEqual(res.body.data.sales[0].sellerId, 'usr-seller-01');
    });
  });

  // ===========================================================================
  // SUITE 5: CONGELAMIENTO ATÓMICO Y PREVENCIÓN DE DOBLE LIQUIDACIÓN
  // ===========================================================================
  describe('5. Congelamiento Atómico de Ventas y Resistencia a Carrera', () => {
    it('5.1 Liquidación exitosa congela ventas marcando commissionSettlementId y commissionPaid = true', async () => {
      store.seedSale({
        id: 'freeze-sale-1',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 199.99,
        shippingCost: 45.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
      });
      store.seedSale({
        id: 'freeze-sale-2',
        sellerId: 'usr-seller-01',
        itemsSubtotal: 200.00,
        discount: 50.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
      });

      const settlement = await createSettlementTransaction({
        tenantId: 'tenant-deko-01',
        sellerId: 'usr-seller-01',
        saleIds: ['freeze-sale-1', 'freeze-sale-2'],
        approvedById: 'usr-admin-01',
        notes: 'Liquidación oficial primera quincena septiembre',
      });

      assert.match(settlement.settlementNumber, /^LIQ-\d{6}-001$/);
      // Base: 199.99 + 150 = 349.99
      assert.strictEqual(settlement.totalProductsAmount, 349.99);
      // Comisión: 349.99 * 0.20 = 69.998 -> 70.00
      assert.strictEqual(settlement.totalCommission, 70.00);

      // Verificar congelamiento en la BD
      const s1 = store.sales.get('freeze-sale-1');
      const s2 = store.sales.get('freeze-sale-2');
      assert.strictEqual(s1.commissionPaid, true);
      assert.strictEqual(s1.commissionSettlementId, settlement.id);
      assert.strictEqual(s2.commissionPaid, true);
      assert.strictEqual(s2.commissionSettlementId, settlement.id);

      // Consulta subsiguiente de comisiones pendientes debe reportar 0 ventas disponibles
      const pendingAfter = await getPendingCommissions({
        tenantId: 'tenant-deko-01',
        sellerId: 'usr-seller-01',
      });
      assert.strictEqual(pendingAfter.salesCount, 0);

      // Segundo intento de liquidar las mismas ventas DEBE ser rechazado
      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            saleIds: ['freeze-sale-1'],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.match(err.message, /ya fue liquidada/i);
          return true;
        }
      );
    });

    it('5.2 Generador correlativo LIQ-YYYYMM-001 incrementa secuencialmente y maneja padding de 3 dígitos', async () => {
      const txClient = store.createTxClient();
      const num1 = await generateSettlementNumber('tenant-deko-01', txClient);
      const now = new Date();
      const expectedPrefix = `LIQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      assert.strictEqual(num1, `${expectedPrefix}001`);

      // Simulamos la inserción
      await txClient.commissionSettlement.create({
        data: {
          tenantId: 'tenant-deko-01',
          sellerId: 'usr-seller-01',
          settlementNumber: num1,
          totalProductsAmount: 100,
          totalCommission: 20,
        },
      });

      const num2 = await generateSettlementNumber('tenant-deko-01', txClient);
      assert.strictEqual(num2, `${expectedPrefix}002`);

      // Simulamos hasta 009 para probar 010
      for (let i = 2; i <= 9; i++) {
        await txClient.commissionSettlement.create({
          data: {
            tenantId: 'tenant-deko-01',
            sellerId: 'usr-seller-01',
            settlementNumber: `${expectedPrefix}${String(i).padStart(3, '0')}`,
            totalProductsAmount: 100,
            totalCommission: 20,
          },
        });
      }

      const num10 = await generateSettlementNumber('tenant-deko-01', txClient);
      assert.strictEqual(num10, `${expectedPrefix}010`);
    });

    it('5.3 Desembolso / Pago de Liquidación (markSettlementPaid) con registro de comprobante', async () => {
      const txClient = store.createTxClient();
      const settlement = await txClient.commissionSettlement.create({
        data: {
          tenantId: 'tenant-deko-01',
          sellerId: 'usr-seller-01',
          settlementNumber: 'LIQ-202609-001',
          totalProductsAmount: 500,
          totalCommission: 100,
          status: 'PENDIENTE_PAGO',
        },
      });

      const paid = await markSettlementPaid({
        tenantId: 'tenant-deko-01',
        settlementId: settlement.id,
        paymentReference: 'TRANSF-BI-99887766',
        userId: 'usr-admin-01',
        notes: 'Transferencia realizada con éxito',
      });

      assert.strictEqual(paid.status, 'PAGADO');
      assert.strictEqual(paid.paymentReference, 'TRANSF-BI-99887766');
      assert.ok(paid.paidAt instanceof Date);

      // Intento de re-pagar liquidación ya pagada DEBE fallar con HTTP 400
      await assert.rejects(
        async () => {
          await markSettlementPaid({
            tenantId: 'tenant-deko-01',
            settlementId: settlement.id,
            paymentReference: 'TRANSF-OTRO-112233',
            userId: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no está en estado PENDIENTE_PAGO/i);
          return true;
        }
      );
    });
  });
});
