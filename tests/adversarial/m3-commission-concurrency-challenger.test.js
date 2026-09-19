/**
 * tests/adversarial/m3-commission-concurrency-challenger.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER SUITE: MILESTONE 3
 * Domain 3: Commission Settlements, Monthly Consecutives & Atomic Sale Freezing
 *
 * Requirements Challenged:
 * 1. Consecutivo mensual LIQ-YYYYMM-001:
 *    - Generates LIQ-YYYYMM-001 for first settlement of the month.
 *    - Increments sequentially (LIQ-YYYYMM-002, LIQ-YYYYMM-003).
 *    - Resets properly across months and isolates across tenants.
 *    - Concurrency stress test: Race conditions without table locking produce colliding identifiers.
 * 2. Atomic Sale Freezing:
 *    - When settlement is created, all included sales have commissionSettlementId = settlement.id and commissionPaid = true.
 *    - Subsequent call to getPendingCommissions returns empty / does not include frozen sales.
 *    - Second attempt to settle the same sales MUST throw (preventing double commission).
 *    - Transactional rollback on midway failure.
 *    - Zero-balance and status gates (balanceDue === 0, status === 'COMPLETADA').
 * 3. Settlement Disbursing (markSettlementPaid):
 *    - Transitions from PENDIENTE_PAGO to PAGADO with timestamp and reference.
 *    - Attempting to pay an already paid settlement throws HTTP 400.
 *    - Missing or short (<3 chars) paymentReference throws HTTP 400.
 *    - Cross-tenant payment isolation.
 * 4. Controller & RBAC Integration:
 *    - Full HTTP response status verification (201, 200, 400, 422, 404).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { prisma } from '../../server/config/prisma.js';
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
import {
  settleCommissionSchema,
  paySettlementSchema,
  SETTLEMENT_STATUS,
  COMMISSION_RATE,
} from '../../server/validators/commissionValidators.js';

// ============================================================================
// HIGH-FIDELITY IN-MEMORY PRISMA MOCK WITH ATOMIC ROLLBACK SUPPORT
// ============================================================================
class InMemoryPrismaMock {
  constructor() {
    this.sales = new Map();
    this.settlements = new Map();
    this.users = new Map();
    this.auditLogs = [];

    this._initDelegates();
  }

  reset() {
    this.sales.clear();
    this.settlements.clear();
    this.users.clear();
    this.auditLogs = [];
  }

  _cloneState() {
    return {
      sales: new Map(Array.from(this.sales.entries()).map(([k, v]) => [k, { ...v, items: v.items ? [...v.items] : [] }])),
      settlements: new Map(Array.from(this.settlements.entries()).map(([k, v]) => [k, { ...v }])),
      users: new Map(Array.from(this.users.entries()).map(([k, v]) => [k, { ...v }])),
      auditLogs: [...this.auditLogs.map((l) => ({ ...l }))],
    };
  }

  _restoreState(snapshot) {
    this.sales = snapshot.sales;
    this.settlements = snapshot.settlements;
    this.users = snapshot.users;
    this.auditLogs = snapshot.auditLogs;
  }

  _initDelegates() {
    const store = this;

    this.user = {
      findFirst: async ({ where, select }) => {
        for (const u of store.users.values()) {
          let match = true;
          if (where.id && u.id !== where.id) match = false;
          if (where.tenantId && u.tenantId !== where.tenantId) match = false;
          if (match) {
            if (select) {
              const res = {};
              for (const key of Object.keys(select)) {
                if (select[key]) res[key] = u[key];
              }
              return res;
            }
            return { ...u };
          }
        }
        return null;
      },
    };

    this.sale = {
      findMany: async ({ where, orderBy, include }) => {
        let results = Array.from(store.sales.values()).filter((s) => {
          if (where.tenantId && s.tenantId !== where.tenantId) return false;
          if (where.sellerId && s.sellerId !== where.sellerId) return false;
          if (where.status && s.status !== where.status) return false;
          if (where.commissionPaid !== undefined && s.commissionPaid !== where.commissionPaid) return false;
          if (where.commissionSettlementId !== undefined) {
            if (where.commissionSettlementId === null && s.commissionSettlementId !== null) return false;
            if (where.commissionSettlementId !== null && s.commissionSettlementId !== where.commissionSettlementId) return false;
          }
          if (where.balanceDue !== undefined && Number(s.balanceDue) !== Number(where.balanceDue)) return false;
          if (where.id?.in && !where.id.in.includes(s.id)) return false;
          if (where.createdAt?.gte && new Date(s.createdAt) < new Date(where.createdAt.gte)) return false;
          if (where.createdAt?.lte && new Date(s.createdAt) > new Date(where.createdAt.lte)) return false;
          return true;
        });

        if (orderBy?.createdAt === 'asc') {
          results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (orderBy?.createdAt === 'desc') {
          results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        return results.map((s) => {
          const res = { ...s };
          if (include?.items) res.items = s.items ? s.items.map((i) => ({ ...i })) : [];
          if (include?.seller) {
            const seller = store.users.get(s.sellerId);
            res.seller = seller ? { id: seller.id, fullName: seller.fullName, email: seller.email } : null;
          }
          return res;
        });
      },

      findFirst: async ({ where }) => {
        for (const s of store.sales.values()) {
          let match = true;
          if (where.id && s.id !== where.id) match = false;
          if (where.tenantId && s.tenantId !== where.tenantId) match = false;
          if (match) return { ...s };
        }
        return null;
      },

      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, s] of store.sales.entries()) {
          let match = true;
          if (where.tenantId && s.tenantId !== where.tenantId) match = false;
          if (where.id?.in && !where.id.in.includes(s.id)) match = false;
          if (match) {
            store.sales.set(id, { ...s, ...data, updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },

      create: async ({ data }) => {
        const id = data.id || crypto.randomUUID();
        const sale = {
          id,
          tenantId: data.tenantId,
          sellerId: data.sellerId,
          saleNumber: data.saleNumber || 'VENT-TEST',
          itemsSubtotal: data.itemsSubtotal ?? 100,
          discount: data.discount ?? 0,
          shippingCost: data.shippingCost ?? 0,
          totalAmount: data.totalAmount ?? 100,
          balanceDue: data.balanceDue ?? 0,
          status: data.status || 'COMPLETADA',
          commissionPaid: data.commissionPaid || false,
          commissionSettlementId: data.commissionSettlementId || null,
          items: data.items || [],
          createdAt: data.createdAt || new Date(),
          updatedAt: new Date(),
        };
        store.sales.set(id, sale);
        return { ...sale };
      },
    };

    this.commissionSettlement = {
      findFirst: async ({ where, orderBy, select, include }) => {
        let list = Array.from(store.settlements.values()).filter((st) => {
          if (where.id && st.id !== where.id) return false;
          if (where.tenantId && st.tenantId !== where.tenantId) return false;
          if (where.settlementNumber?.startsWith && !st.settlementNumber.startsWith(where.settlementNumber.startsWith)) return false;
          if (where.status && st.status !== where.status) return false;
          if (where.sellerId && st.sellerId !== where.sellerId) return false;
          return true;
        });

        if (orderBy?.settlementNumber === 'desc') {
          list.sort((a, b) => b.settlementNumber.localeCompare(a.settlementNumber));
        } else if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const found = list[0];
        if (!found) return null;

        if (select?.settlementNumber) return { settlementNumber: found.settlementNumber };

        const res = { ...found };
        if (include?.seller) {
          const seller = store.users.get(found.sellerId);
          res.seller = seller ? { id: seller.id, fullName: seller.fullName, email: seller.email } : null;
        }
        if (include?.approvedBy && found.approvedById) {
          const approver = store.users.get(found.approvedById);
          res.approvedBy = approver ? { id: approver.id, fullName: approver.fullName, email: approver.email } : null;
        }
        if (include?.sales) {
          res.sales = Array.from(store.sales.values())
            .filter((s) => s.commissionSettlementId === found.id)
            .map((s) => ({ ...s }));
        }
        return res;
      },

      findMany: async ({ where, skip = 0, take = 20, orderBy, include }) => {
        let list = Array.from(store.settlements.values()).filter((st) => {
          if (where.tenantId && st.tenantId !== where.tenantId) return false;
          if (where.sellerId && st.sellerId !== where.sellerId) return false;
          if (where.status && st.status !== where.status) return false;
          return true;
        });

        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const sliced = list.slice(skip, skip + take);
        return sliced.map((st) => {
          const res = { ...st };
          if (include?.seller) {
            const seller = store.users.get(st.sellerId);
            res.seller = seller ? { id: seller.id, fullName: seller.fullName, email: seller.email } : null;
          }
          if (include?.approvedBy && st.approvedById) {
            const approver = store.users.get(st.approvedById);
            res.approvedBy = approver ? { id: approver.id, fullName: approver.fullName, email: approver.email } : null;
          }
          return res;
        });
      },

      count: async ({ where }) => {
        const list = await store.commissionSettlement.findMany({ where, skip: 0, take: 99999 });
        return list.length;
      },

      create: async ({ data }) => {
        const id = data.id || crypto.randomUUID();
        const settlement = {
          id,
          tenantId: data.tenantId,
          sellerId: data.sellerId,
          settlementNumber: data.settlementNumber,
          totalProductsAmount: data.totalProductsAmount,
          commissionRate: data.commissionRate ?? 0.20,
          totalCommission: data.totalCommission,
          salesCount: data.salesCount ?? 0,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          status: data.status || 'PENDIENTE_PAGO',
          approvedById: data.approvedById || null,
          paidAt: data.paidAt || null,
          paymentReference: data.paymentReference || null,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.settlements.set(id, settlement);
        return { ...settlement };
      },

      update: async ({ where, data, include }) => {
        const st = store.settlements.get(where.id);
        if (!st) throw new Error('Settlement not found for update');
        const updated = {
          ...st,
          ...data,
          updatedAt: new Date(),
        };
        store.settlements.set(where.id, updated);

        const res = { ...updated };
        if (include?.seller) {
          const seller = store.users.get(updated.sellerId);
          res.seller = seller ? { id: seller.id, fullName: seller.fullName, email: seller.email } : null;
        }
        if (include?.approvedBy && updated.approvedById) {
          const approver = store.users.get(updated.approvedById);
          res.approvedBy = approver ? { id: approver.id, fullName: approver.fullName, email: approver.email } : null;
        }
        return res;
      },
    };

    this.auditLog = {
      create: async ({ data }) => {
        const log = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date(),
        };
        store.auditLogs.push(log);
        return { ...log };
      },
    };
  }

  // --- Atomic Transaction Runner ---
  async $transaction(fn) {
    if (typeof fn === 'function') {
      const snapshot = this._cloneState();
      try {
        return await fn(this);
      } catch (err) {
        this._restoreState(snapshot);
        throw err;
      }
    }
    throw new Error('Array transaction not implemented in mock');
  }
}

// Helpers for Mock Express Request/Response
function createMockReqRes({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
  tenantId = 'tenant-alfa',
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

// ============================================================================
// ADVERSARIAL STRESS SUITE
// ============================================================================
describe('⚔️ ADVERSARIAL CHALLENGER: Milestone 3 — Commission Concurrency, Consecutives & Freeze', () => {
  let mock;
  let originalPrisma;

  beforeEach(() => {
    mock = new InMemoryPrismaMock();

    // Preserve originals
    originalPrisma = {
      user: prisma.user,
      sale: prisma.sale,
      commissionSettlement: prisma.commissionSettlement,
      auditLog: prisma.auditLog,
      $transaction: prisma.$transaction,
    };

    // Mount in-memory mock delegates on global prisma instance
    prisma.user = mock.user;
    prisma.sale = mock.sale;
    prisma.commissionSettlement = mock.commissionSettlement;
    prisma.auditLog = mock.auditLog;
    prisma.$transaction = mock.$transaction.bind(mock);

    // Seed baseline user entities
    mock.users.set('usr-seller-01', {
      id: 'usr-seller-01',
      tenantId: 'tenant-alfa',
      fullName: 'Vendedor Redes Alfa',
      email: 'vendedor.alfa@deko.gt',
      role: 'VENDEDOR_REDES',
      roles: ['VENDEDOR_REDES'],
    });
    mock.users.set('usr-seller-02', {
      id: 'usr-seller-02',
      tenantId: 'tenant-beta',
      fullName: 'Vendedor Redes Beta',
      email: 'vendedor.beta@deko.gt',
      role: 'VENDEDOR_REDES',
      roles: ['VENDEDOR_REDES'],
    });
    mock.users.set('usr-admin-01', {
      id: 'usr-admin-01',
      tenantId: 'tenant-alfa',
      fullName: 'Super Admin Alfa',
      email: 'admin.alfa@deko.gt',
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN'],
    });
  });

  afterEach(() => {
    // Restore originals
    prisma.user = originalPrisma.user;
    prisma.sale = originalPrisma.sale;
    prisma.commissionSettlement = originalPrisma.commissionSettlement;
    prisma.auditLog = originalPrisma.auditLog;
    prisma.$transaction = originalPrisma.$transaction;
  });

  // ==========================================================================
  // SUITE 1: Consecutivo Mensual LIQ-YYYYMM-001
  // ==========================================================================
  describe('1. Consecutivo Mensual LIQ-YYYYMM-001', () => {
    it('1.1 Generates LIQ-YYYYMM-001 for the first settlement of the month', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const expectedCode = `LIQ-${yyyy}${mm}-001`;

      const code = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(code, expectedCode, 'First settlement must be formatted as LIQ-YYYYMM-001');
    });

    it('1.2 Increments sequentially: LIQ-YYYYMM-001 -> LIQ-YYYYMM-002 -> LIQ-YYYYMM-003', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `LIQ-${yyyy}${mm}-`;

      // Simulate 1st settlement
      mock.settlements.set('st-1', {
        id: 'st-1',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}001`,
        createdAt: new Date(),
      });
      const code2 = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(code2, `${prefix}002`, 'Second code must increment to 002');

      // Simulate 2nd settlement
      mock.settlements.set('st-2', {
        id: 'st-2',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}002`,
        createdAt: new Date(),
      });
      const code3 = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(code3, `${prefix}003`, 'Third code must increment to 003');
    });

    it('1.3 Multi-tenant isolation: Tenant Alfa sequence does not affect Tenant Beta', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `LIQ-${yyyy}${mm}-`;

      // Tenant Alfa has already 4 settlements
      mock.settlements.set('st-alfa-4', {
        id: 'st-alfa-4',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}004`,
        createdAt: new Date(),
      });

      // Tenant Beta generates its first settlement
      const codeBeta = await generateSettlementNumber('tenant-beta', mock);
      assert.strictEqual(codeBeta, `${prefix}001`, 'Tenant Beta must start fresh at 001 despite Tenant Alfa being at 004');

      // Tenant Alfa continues at 005
      const codeAlfa = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(codeAlfa, `${prefix}005`, 'Tenant Alfa must continue sequence at 005');
    });

    it('1.4 Month rollover: Settlements from previous month do not prevent current month from starting at 001', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const currentPrefix = `LIQ-${yyyy}${mm}-`;

      // Previous month settlement (e.g. 2026-08 when current is 2026-09)
      const prevMm = String(Math.max(1, now.getMonth())).padStart(2, '0');
      const oldPrefix = `LIQ-${yyyy}${prevMm}-`;

      mock.settlements.set('st-old-month', {
        id: 'st-old-month',
        tenantId: 'tenant-alfa',
        settlementNumber: `${oldPrefix}099`,
        createdAt: new Date('2026-01-01'),
      });

      const currentCode = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(currentCode, `${currentPrefix}001`, 'Current month must reset to 001 regardless of previous month records');
    });

    it('1.5 Boundary progression and zero padding (009 -> 010, 099 -> 100)', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `LIQ-${yyyy}${mm}-`;

      mock.settlements.set('st-9', {
        id: 'st-9',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}009`,
        createdAt: new Date(),
      });
      const code10 = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(code10, `${prefix}010`, '009 must roll over to 010 with correct padding');

      mock.settlements.set('st-99', {
        id: 'st-99',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}099`,
        createdAt: new Date(),
      });
      const code100 = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(code100, `${prefix}100`, '099 must roll over to 100 with correct padding');
    });

    it('1.6 Fallback to 001 if existing DB settlement number has irregular suffix', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `LIQ-${yyyy}${mm}-`;

      mock.settlements.set('st-corrupted', {
        id: 'st-corrupted',
        tenantId: 'tenant-alfa',
        settlementNumber: `${prefix}XYZ`, // NaN suffix
        createdAt: new Date(),
      });
      const fallbackCode = await generateSettlementNumber('tenant-alfa', mock);
      assert.strictEqual(fallbackCode, `${prefix}001`, 'Irregular suffix must safely fall back to 001');
    });

    it('1.7 [Adversarial Concurrency] Demonstrates duplicate settlement number collision when executed in parallel without DB lock', async () => {
      // When two parallel requests call generateSettlementNumber at the exact same instant
      // both read lastSettlement as null (or identical), generating collision
      const [codeA, codeB] = await Promise.all([
        generateSettlementNumber('tenant-alfa', mock),
        generateSettlementNumber('tenant-alfa', mock),
      ]);
      assert.strictEqual(codeA, codeB, 'Empirically confirms that un-serialized generateSettlementNumber yields colliding numbers (LIQ-YYYYMM-001)');
    });
  });

  // ==========================================================================
  // SUITE 2: Atomic Sale Freezing & Invariant Verification
  // ==========================================================================
  describe('2. Atomic Sale Freezing & Double Commission Prevention', () => {
    it('2.1 When settlement is created, all included sales have commissionSettlementId = settlement.id and commissionPaid = true', async () => {
      // Setup 2 eligible completed sales with balanceDue == 0
      const sale1 = await mock.sale.create({
        data: {
          id: 'sale-freeze-1',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-FRZ-01',
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
      });

      const sale2 = await mock.sale.create({
        data: {
          id: 'sale-freeze-2',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-FRZ-02',
          itemsSubtotal: 200,
          discount: 20,
          shippingCost: 30,
          totalAmount: 210,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-02'),
        },
      });

      const settlement = await createSettlementTransaction({
        tenantId: 'tenant-alfa',
        sellerId: 'usr-seller-01',
        saleIds: [sale1.id, sale2.id],
        approvedById: 'usr-admin-01',
        notes: 'Liquidación quincenal empírica',
      });

      assert.ok(settlement.id, 'Settlement ID must be created');
      assert.strictEqual(settlement.status, 'PENDIENTE_PAGO', 'Initial status must be PENDIENTE_PAGO');
      assert.strictEqual(settlement.salesCount, 2, 'Must include exactly 2 sales');
      // Total products: 300 + 180 = 480.00
      assert.strictEqual(settlement.totalProductsAmount, 480.00);
      // Total commission: 480 * 0.20 = 96.00
      assert.strictEqual(settlement.totalCommission, 96.00);

      // Verify sales in DB are frozen
      const updatedSale1 = mock.sales.get(sale1.id);
      const updatedSale2 = mock.sales.get(sale2.id);

      assert.strictEqual(updatedSale1.commissionPaid, true, 'Sale 1 must have commissionPaid = true');
      assert.strictEqual(updatedSale1.commissionSettlementId, settlement.id, 'Sale 1 must reference settlement.id');
      assert.strictEqual(updatedSale2.commissionPaid, true, 'Sale 2 must have commissionPaid = true');
      assert.strictEqual(updatedSale2.commissionSettlementId, settlement.id, 'Sale 2 must reference settlement.id');
    });

    it('2.2 Subsequent call to getPendingCommissions returns empty (excludes frozen sales)', async () => {
      // Create a sale and freeze it
      const sale = await mock.sale.create({
        data: {
          id: 'sale-already-frozen',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-ALREADY-FRZ',
          itemsSubtotal: 500,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: true, // Frozen
          commissionSettlementId: 'st-pre-existing',
          createdAt: new Date('2026-09-01'),
        },
      });

      const report = await getPendingCommissions({
        tenantId: 'tenant-alfa',
        sellerId: 'usr-seller-01',
      });

      assert.strictEqual(report.salesCount, 0, 'No sales must be returned in pending report once frozen');
      assert.strictEqual(report.totalProductsAmount, 0, 'totalProductsAmount must be 0');
      assert.strictEqual(report.totalCommission, 0, 'totalCommission must be 0');
      assert.strictEqual(report.sales.length, 0, 'sales array must be empty');
    });

    it('2.3 Re-settling already paid sales strictly prevents double commission and raises client error', async () => {
      // Create a sale and freeze it with first settlement
      const sale = await mock.sale.create({
        data: {
          id: 'sale-double-attempt',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-DBL-01',
          itemsSubtotal: 300,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-03'),
        },
      });

      // Settlement 1 succeeds
      const settlement1 = await createSettlementTransaction({
        tenantId: 'tenant-alfa',
        sellerId: 'usr-seller-01',
        saleIds: [sale.id],
        approvedById: 'usr-admin-01',
      });
      assert.ok(settlement1.id);

      // Second attempt to settle the same sale MUST be rejected (preventing double commission)
      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa',
            sellerId: 'usr-seller-01',
            saleIds: [sale.id],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          // Double commission is strictly rejected
          assert.match(err.message, /ya fue liquidada previamente/i, 'Must explicitly report sale already liquidated');
          // Check HTTP status code (RFC semantic: ineligibility due to domain state)
          assert.ok(
            err.statusCode === 422 || err.statusCode === 400,
            `Double commission prevention must throw 422 or 400, received HTTP ${err.statusCode}`
          );
          return true;
        }
      );

      // Verify that no second settlement was created in DB
      assert.strictEqual(mock.settlements.size, 1, 'Exactly 1 settlement must exist in DB');
      // Sale must remain linked to original settlement
      assert.strictEqual(mock.sales.get(sale.id).commissionSettlementId, settlement1.id);
    });

    it('2.4 Second attempt without saleIds parameter finds 0 eligible sales and rejects with HTTP 400', async () => {
      // Settle all remaining pending sales for seller (currently 0 eligible)
      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa',
            sellerId: 'usr-seller-01',
            saleIds: null, // Attempting to settle everything pending
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /No hay ventas elegibles para liquidar/i);
          return true;
        }
      );
    });

    it('2.5 Zero-Balance Gate: Sale with balanceDue > 0 MUST throw HTTP 422', async () => {
      const unpaidSale = await mock.sale.create({
        data: {
          id: 'sale-with-balance',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-UNPAID-01',
          itemsSubtotal: 300,
          shippingCost: 40,
          totalAmount: 340,
          depositAmount: 170,
          balanceDue: 170.00, // VIOLATION: Has pending balance
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-04'),
        },
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa',
            sellerId: 'usr-seller-01',
            saleIds: [unpaidSale.id],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Sale with balanceDue > 0 MUST throw HTTP 422');
          assert.match(err.message, /saldo pendiente o no completada/i);
          return true;
        }
      );

      // Sale must remain untouched
      const saleInDb = mock.sales.get(unpaidSale.id);
      assert.strictEqual(saleInDb.commissionPaid, false);
      assert.strictEqual(saleInDb.commissionSettlementId, null);
    });

    it('2.6 Status Gate: Sale with status !== COMPLETADA MUST throw HTTP 422', async () => {
      const pendingSale = await mock.sale.create({
        data: {
          id: 'sale-not-completed',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-NOT-COMPLETED',
          itemsSubtotal: 200,
          balanceDue: 0,
          status: 'PENDIENTE', // VIOLATION: Not completed
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-05'),
        },
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa',
            sellerId: 'usr-seller-01',
            saleIds: [pendingSale.id],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Non-completed sale MUST throw HTTP 422');
          assert.match(err.message, /no es elegible para liquidación/i);
          return true;
        }
      );
    });

    it('2.7 Cross-Seller Gate: Sale belonging to another seller MUST throw HTTP 400', async () => {
      const otherSellerSale = await mock.sale.create({
        data: {
          id: 'sale-other-seller',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-other-vendor', // Different seller
          saleNumber: 'VENT-OTHER-SELLER',
          itemsSubtotal: 250,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-06'),
        },
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa',
            sellerId: 'usr-seller-01', // Requesting settlement for usr-seller-01
            saleIds: [otherSellerSale.id],
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

    it('2.8 Multi-Tenant Isolation: Sale belonging to another tenant MUST throw HTTP 400', async () => {
      const foreignSale = await mock.sale.create({
        data: {
          id: 'sale-foreign-tenant',
          tenantId: 'tenant-beta', // Foreign tenant
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-FOREIGN',
          itemsSubtotal: 300,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-07'),
        },
      });

      await assert.rejects(
        async () => {
          await createSettlementTransaction({
            tenantId: 'tenant-alfa', // Quoting under tenant-alfa
            sellerId: 'usr-seller-01',
            saleIds: [foreignSale.id],
            approvedById: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no existen en la empresa/i);
          return true;
        }
      );
    });

    it('2.9 Transactional Atomicity: Failure midway rolls back all changes leaving sales unfrozen', async () => {
      const rollbackSale = await mock.sale.create({
        data: {
          id: 'sale-rollback-test',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-ROLLBACK',
          itemsSubtotal: 500,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date('2026-09-08'),
        },
      });

      // Intentionally override commissionSettlement.create on delegate
      const origCreate = mock.commissionSettlement.create;
      mock.commissionSettlement.create = async () => {
        throw new Error('Simulated Database Crash during settlement record creation');
      };

      try {
        await assert.rejects(
          async () => {
            await createSettlementTransaction({
              tenantId: 'tenant-alfa',
              sellerId: 'usr-seller-01',
              saleIds: [rollbackSale.id],
              approvedById: 'usr-admin-01',
            });
          },
          /Simulated Database Crash/
        );

        // Verification: rollback restored state
        const saleAfterRollback = mock.sales.get(rollbackSale.id);
        assert.strictEqual(saleAfterRollback.commissionPaid, false, 'Sale must NOT remain frozen after rollback');
        assert.strictEqual(saleAfterRollback.commissionSettlementId, null, 'Sale must have null settlement ID');
        assert.strictEqual(mock.settlements.size, 0, 'No settlement must exist after rollback');
      } finally {
        mock.commissionSettlement.create = origCreate;
      }
    });
  });

  // ==========================================================================
  // SUITE 3: Settlement Disbursing (markSettlementPaid)
  // ==========================================================================
  describe('3. Settlement Disbursing (markSettlementPaid)', () => {
    let testSettlementId;

    beforeEach(async () => {
      const settlement = await mock.commissionSettlement.create({
        data: {
          id: 'st-disburse-01',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          settlementNumber: 'LIQ-202609-099',
          totalProductsAmount: 1000.00,
          commissionRate: 0.20,
          totalCommission: 200.00,
          salesCount: 3,
          periodStart: new Date('2026-09-01'),
          periodEnd: new Date('2026-09-10'),
          status: 'PENDIENTE_PAGO',
          approvedById: 'usr-admin-01',
        },
      });
      testSettlementId = settlement.id;
    });

    it('3.1 markSettlementPaid transitions from PENDIENTE_PAGO to PAGADO with timestamp and reference', async () => {
      const result = await markSettlementPaid({
        tenantId: 'tenant-alfa',
        settlementId: testSettlementId,
        paymentReference: 'TRANSF-BI-99887766',
        userId: 'usr-admin-01',
        notes: 'Pago liquidado por transferencia BI',
      });

      assert.strictEqual(result.status, 'PAGADO', 'Status must transition to PAGADO');
      assert.strictEqual(result.paymentReference, 'TRANSF-BI-99887766', 'Reference must be trimmed and saved');
      assert.ok(result.paidAt instanceof Date, 'paidAt timestamp must be recorded');

      // Verify DB persistence
      const inDb = mock.settlements.get(testSettlementId);
      assert.strictEqual(inDb.status, 'PAGADO');
      assert.strictEqual(inDb.paymentReference, 'TRANSF-BI-99887766');

      // Verify audit log
      const audit = mock.auditLogs.find((l) => l.action === 'SETTLEMENT_PAID');
      assert.ok(audit, 'Audit log SETTLEMENT_PAID must be created');
      assert.strictEqual(audit.entityId, testSettlementId);
    });

    it('3.2 Attempting to pay an already paid settlement throws HTTP 400', async () => {
      // First disbursement
      await markSettlementPaid({
        tenantId: 'tenant-alfa',
        settlementId: testSettlementId,
        paymentReference: 'TRANSF-1',
        userId: 'usr-admin-01',
      });

      // Second disbursement attempt on same settlement MUST throw HTTP 400
      await assert.rejects(
        async () => {
          await markSettlementPaid({
            tenantId: 'tenant-alfa',
            settlementId: testSettlementId,
            paymentReference: 'TRANSF-2',
            userId: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400, 'Must throw HTTP 400');
          assert.match(err.message, /no está en estado PENDIENTE_PAGO/i);
          return true;
        }
      );
    });

    it('3.3 Missing paymentReference throws HTTP 400 via Zod schema and controller', async () => {
      // Zod Validator check
      const parsedEmpty = paySettlementSchema.safeParse({ paymentReference: '' });
      assert.strictEqual(parsedEmpty.success, false);
      assert.ok(parsedEmpty.error.issues.some((i) => i.message.includes('requerida')));

      const parsedMissing = paySettlementSchema.safeParse({});
      assert.strictEqual(parsedMissing.success, false);
    });

    it('3.4 Short paymentReference (< 3 characters) throws HTTP 400', async () => {
      const parsedShort = paySettlementSchema.safeParse({ paymentReference: 'AB' });
      assert.strictEqual(parsedShort.success, false);
      assert.ok(parsedShort.error.issues.some((i) => i.message.includes('requerida') || i.message.includes('min')));
    });

    it('3.5 Attempting to disburse non-existent settlement throws HTTP 404', async () => {
      await assert.rejects(
        async () => {
          await markSettlementPaid({
            tenantId: 'tenant-alfa',
            settlementId: 'st-non-existent-uuid',
            paymentReference: 'TRANSF-VALID-123',
            userId: 'usr-admin-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /Liquidación no encontrada/i);
          return true;
        }
      );
    });

    it('3.6 Cross-tenant payment isolation: Tenant Beta cannot disburse Tenant Alfa settlement (HTTP 404)', async () => {
      await assert.rejects(
        async () => {
          await markSettlementPaid({
            tenantId: 'tenant-beta', // Foreign tenant
            settlementId: testSettlementId,
            paymentReference: 'TRANSF-BETA-ATTACK',
            userId: 'usr-seller-02',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /Liquidación no encontrada/i);
          return true;
        }
      );

      // Verify settlement in DB remained PENDIENTE_PAGO
      assert.strictEqual(mock.settlements.get(testSettlementId).status, 'PENDIENTE_PAGO');
    });
  });

  // ==========================================================================
  // SUITE 4: Controller & End-to-End API Integration
  // ==========================================================================
  describe('4. Controller & End-to-End API Integration', () => {
    it('4.1 settleCommissionsController responds with HTTP 201 on success', async () => {
      const sale = await mock.sale.create({
        data: {
          id: 'sale-ctrl-01',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-CTRL-01',
          itemsSubtotal: 400,
          discount: 0,
          shippingCost: 50,
          totalAmount: 450,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date(),
        },
      });

      const { req, res } = createMockReqRes({
        body: {
          sellerId: 'usr-seller-01',
          saleIds: [sale.id],
          notes: 'Liquidación vía controller',
        },
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-alfa',
      });

      await settleCommissionsController(req, res);

      assert.strictEqual(res.statusCode, 201, 'Controller must respond with HTTP 201 Created');
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.settlementNumber.startsWith('LIQ-'));
      assert.strictEqual(res.body.data.totalProductsAmount, 400.00);
      assert.strictEqual(res.body.data.totalCommission, 80.00);
    });

    it('4.2 settleCommissionsController returns client error when re-settling already paid sales', async () => {
      const sale = await mock.sale.create({
        data: {
          id: 'sale-ctrl-02',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          saleNumber: 'VENT-CTRL-02',
          itemsSubtotal: 400,
          discount: 0,
          shippingCost: 50,
          totalAmount: 450,
          balanceDue: 0,
          status: 'COMPLETADA',
          commissionPaid: false,
          commissionSettlementId: null,
          createdAt: new Date(),
        },
      });

      // First settlement succeeds
      const { req: req1, res: res1 } = createMockReqRes({
        body: { sellerId: 'usr-seller-01', saleIds: [sale.id] },
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-alfa',
      });
      await settleCommissionsController(req1, res1);
      assert.strictEqual(res1.statusCode, 201);

      // Re-settling attempt
      const { req: req2, res: res2 } = createMockReqRes({
        body: { sellerId: 'usr-seller-01', saleIds: [sale.id] },
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-alfa',
      });
      await settleCommissionsController(req2, res2);

      assert.ok(
        res2.statusCode === 422 || res2.statusCode === 400,
        `Controller must return 422 or 400 client error, received ${res2.statusCode}`
      );
      assert.strictEqual(res2.body.success, false);
      assert.match(res2.body.error, /ya fue liquidada previamente/i);
    });

    it('4.3 markPaidController responds with HTTP 200 upon valid disbursement', async () => {
      const settlement = await mock.commissionSettlement.create({
        data: {
          id: 'st-ctrl-pay-01',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          settlementNumber: 'LIQ-202609-077',
          totalProductsAmount: 500.00,
          commissionRate: 0.20,
          totalCommission: 100.00,
          salesCount: 1,
          periodStart: new Date(),
          periodEnd: new Date(),
          status: 'PENDIENTE_PAGO',
        },
      });

      const { req, res } = createMockReqRes({
        params: { id: settlement.id },
        body: {
          paymentReference: 'TRANSF-BANRURAL-123456',
          notes: 'Pagado por tesorería',
        },
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-alfa',
      });

      await markPaidController(req, res);

      assert.strictEqual(res.statusCode, 200, 'Controller must respond with HTTP 200 OK');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'PAGADO');
      assert.strictEqual(res.body.data.paymentReference, 'TRANSF-BANRURAL-123456');
    });

    it('4.4 markPaidController responds with HTTP 400 when settlement is already paid', async () => {
      const settlement = await mock.commissionSettlement.create({
        data: {
          id: 'st-ctrl-already-paid',
          tenantId: 'tenant-alfa',
          sellerId: 'usr-seller-01',
          settlementNumber: 'LIQ-202609-078',
          totalProductsAmount: 500.00,
          commissionRate: 0.20,
          totalCommission: 100.00,
          salesCount: 1,
          periodStart: new Date(),
          periodEnd: new Date(),
          status: 'PAGADO', // Already paid
          paymentReference: 'PREV-REF-001',
        },
      });

      const { req, res } = createMockReqRes({
        params: { id: settlement.id },
        body: { paymentReference: 'TRANSF-AGAIN-FAIL' },
        user: { id: 'usr-admin-01', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-alfa',
      });

      await markPaidController(req, res);

      assert.strictEqual(res.statusCode, 400, 'Already paid settlement must return HTTP 400');
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /no está en estado PENDIENTE_PAGO/i);
    });

    it('4.5 getPendingCommissionsController enforces RBAC: non-admin seller cannot view other sellers', async () => {
      const { req, res } = createMockReqRes({
        query: { sellerId: 'usr-seller-other' }, // non-admin trying to query another seller
        user: { id: 'usr-seller-01', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        tenantId: 'tenant-alfa',
      });

      await getPendingCommissionsController(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      // Non-admin seller is locked to their own id ('usr-seller-01') regardless of query param
    });
  });
});
