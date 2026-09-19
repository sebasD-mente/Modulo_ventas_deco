/**
 * tests/adversarial/m1-2-domain1-empirical-stress.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL STRESS HARNESS: DOMAIN 1 CONCURRENCY & BOUNDARY VERIFICATION
 *
 * Objective: Empirically stress-test Domain 1 for edge cases:
 * 1. Idempotency key reuse: submitting the same idempotencyKey returns existing sale with idempotentReplay: true.
 * 2. Overpayment or underpayment on balance payment: paying an amount differing from balanceDue by >0.05 rejected with HTTP 400.
 * 3. Paying balance on an already settled sale (balanceDue === 0) rejected with HTTP 400.
 * 4. Paying balance on an ANULADA sale rejected with HTTP 400.
 * 5. High-concurrency race condition and transactional integrity tests.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment before any imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import {
  createRemoteSaleTransaction,
  registerBalancePayment,
} from '../../server/services/sales/remoteSaleService.js';
import {
  createRemoteSale,
  registerBalancePayment as registerBalancePaymentController,
} from '../../server/controllers/remoteSaleController.js';
import {
  createRemoteSaleSchema,
  balancePaymentSchema,
} from '../../server/validators/remoteSaleValidators.js';
import { validate } from '../../server/middleware/validateMiddleware.js';
import { prisma } from '../../server/config/prisma.js';

// =============================================================================
// IN-MEMORY HIGH-FIDELITY PRISMA STORE FOR TRANSACTIONS & CONCURRENCY
// =============================================================================
class MockPrismaStore {
  constructor() {
    this.sales = new Map(); // id -> sale
    this.salesByIdempotency = new Map(); // idempotencyKey -> sale
    this.customers = new Map(); // id -> customer
    this.customersByTenantPhone = new Map(); // `${tenantId}:${phone}` -> customer
    this.auditLogs = [];
    this.salePayments = [];
    this.events = new Map();
    this.events.set('evt-ventas-redes-online', {
      id: 'evt-ventas-redes-online',
      name: 'Ventas en Línea y Redes Sociales',
      currentSaleSequence: 0,
    });
  }

  reset() {
    this.sales.clear();
    this.salesByIdempotency.clear();
    this.customers.clear();
    this.customersByTenantPhone.clear();
    this.auditLogs = [];
    this.salePayments = [];
    this.events.set('evt-ventas-redes-online', {
      id: 'evt-ventas-redes-online',
      name: 'Ventas en Línea y Redes Sociales',
      currentSaleSequence: 0,
    });
  }

  createTxClient() {
    const store = this;
    const client = {
      sale: {
        findUnique: async ({ where }) => {
          if (where.idempotencyKey) {
            const sale = store.salesByIdempotency.get(where.idempotencyKey);
            return sale ? JSON.parse(JSON.stringify(sale)) : null;
          }
          if (where.id) {
            const sale = store.sales.get(where.id);
            return sale ? JSON.parse(JSON.stringify(sale)) : null;
          }
          return null;
        },
        findFirst: async ({ where }) => {
          for (const sale of store.sales.values()) {
            let match = true;
            if (where.id && sale.id !== where.id) match = false;
            if (where.tenantId && sale.tenantId !== where.tenantId) match = false;
            if (where.status && sale.status !== where.status) match = false;
            if (match) return JSON.parse(JSON.stringify(sale));
          }
          return null;
        },
        create: async ({ data, include }) => {
          if (data.idempotencyKey && store.salesByIdempotency.has(data.idempotencyKey)) {
            const err = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
            err.code = 'P2002';
            throw err;
          }

          const saleId = `sale-${Math.random().toString(36).substring(2, 9)}`;
          const items = (data.items?.create || []).map((item, idx) => ({
            id: `item-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            saleId,
            ...item,
          }));

          const payments = (data.payments?.create || []).map((pay, idx) => ({
            id: `pay-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            saleId,
            ...pay,
          }));

          const customer = data.customerId ? store.customers.get(data.customerId) || null : null;

          const created = {
            id: saleId,
            tenantId: data.tenantId,
            eventId: data.eventId,
            sellerId: data.sellerId,
            saleNumber: data.saleNumber,
            totalAmount: data.totalAmount,
            discount: data.discount || 0,
            notes: data.notes || null,
            status: data.status,
            inputChannel: data.inputChannel,
            idempotencyKey: data.idempotencyKey || null,
            orderType: data.orderType,
            deliveryMethod: data.deliveryMethod,
            shippingCost: data.shippingCost || 0,
            shippingCourier: data.shippingCourier || null,
            shippingTrackingNumber: data.shippingTrackingNumber || null,
            pickupEventId: data.pickupEventId || null,
            customerId: data.customerId || null,
            paymentStatus: data.paymentStatus,
            depositAmount: data.depositAmount,
            balanceDue: data.balanceDue,
            items,
            payments,
            customer,
            seller: { id: data.sellerId, fullName: 'Vendedor Redes Test', email: 'vendedor@test.com' },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          store.sales.set(saleId, created);
          if (data.idempotencyKey) {
            store.salesByIdempotency.set(data.idempotencyKey, created);
          }
          return JSON.parse(JSON.stringify(created));
        },
        update: async ({ where, data }) => {
          const sale = store.sales.get(where.id);
          if (!sale) throw new Error('Sale not found for update');
          const updated = {
            ...sale,
            ...data,
            updatedAt: new Date(),
          };
          store.sales.set(where.id, updated);
          if (updated.idempotencyKey) {
            store.salesByIdempotency.set(updated.idempotencyKey, updated);
          }
          return JSON.parse(JSON.stringify(updated));
        },
      },
      customer: {
        findUnique: async ({ where }) => {
          if (where.tenantId_phone) {
            const key = `${where.tenantId_phone.tenantId}:${where.tenantId_phone.phone}`;
            const c = store.customersByTenantPhone.get(key);
            return c ? JSON.parse(JSON.stringify(c)) : null;
          }
          if (where.id) {
            const c = store.customers.get(where.id);
            return c ? JSON.parse(JSON.stringify(c)) : null;
          }
          return null;
        },
        create: async ({ data }) => {
          const key = `${data.tenantId}:${data.phone}`;
          if (store.customersByTenantPhone.has(key)) {
            const err = new Error('Unique constraint failed on (tenantId, phone)');
            err.code = 'P2002';
            throw err;
          }
          const customerId = `cust-${Math.random().toString(36).substring(2, 8)}`;
          const customer = { id: customerId, ...data, createdAt: new Date(), updatedAt: new Date() };
          store.customers.set(customerId, customer);
          store.customersByTenantPhone.set(key, customer);
          return JSON.parse(JSON.stringify(customer));
        },
        update: async ({ where, data }) => {
          const customer = store.customers.get(where.id);
          if (!customer) throw new Error('Customer not found');
          const updated = { ...customer, ...data, updatedAt: new Date() };
          store.customers.set(where.id, updated);
          store.customersByTenantPhone.set(`${updated.tenantId}:${updated.phone}`, updated);
          return JSON.parse(JSON.stringify(updated));
        },
      },
      salePayment: {
        createMany: async ({ data }) => {
          for (const item of data) {
            const paymentRecord = {
              id: `pay-${Math.random().toString(36).substring(2, 8)}`,
              ...item,
              createdAt: new Date(),
            };
            store.salePayments.push(paymentRecord);
            const sale = store.sales.get(item.saleId);
            if (sale) {
              if (!sale.payments) sale.payments = [];
              sale.payments.push(paymentRecord);
            }
          }
          return { count: data.length };
        },
      },
      auditLog: {
        create: async ({ data }) => {
          store.auditLogs.push({ id: `audit-${store.auditLogs.length + 1}`, ...data });
          return { id: `audit-${store.auditLogs.length}` };
        },
      },
      event: {
        update: async ({ where, data }) => {
          const ev = store.events.get(where.id) || {
            id: where.id,
            name: 'Ventas en Línea y Redes Sociales',
            currentSaleSequence: 0,
          };
          if (data.currentSaleSequence?.increment) {
            ev.currentSaleSequence += data.currentSaleSequence.increment;
          }
          store.events.set(where.id, ev);
          return { name: ev.name, currentSaleSequence: ev.currentSaleSequence };
        },
      },
    };

    return client;
  }
}

// Global test store
const testStore = new MockPrismaStore();

// Helper to install mock prisma methods
function installMockPrisma() {
  testStore.reset();
  const txClient = testStore.createTxClient();

  prisma.sale = txClient.sale;
  prisma.customer = txClient.customer;
  prisma.salePayment = txClient.salePayment;
  prisma.auditLog = txClient.auditLog;
  prisma.event = txClient.event;

  prisma.$transaction = async (fn, options) => {
    if (typeof fn === 'function') {
      return await fn(txClient);
    }
    throw new Error('Unsupported $transaction pattern in mock');
  };
}

// Helper to simulate express mock req & res
function createMockHttp() {
  const req = {
    headers: {},
    body: {},
    params: {},
    query: {},
    tenantId: 'tenant-test-uuid',
    user: { id: 'seller-test-uuid', role: 'VENDEDOR_REDES', email: 'seller@test.com' },
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get responseData() {
      return responseData;
    },
  };

  return { req, res };
}

describe('⚔️ ADVERSARIAL STRESS TEST: DOMAIN 1 (CONCURRENCY & BOUNDARY VERIFICATION)', () => {
  beforeEach(() => {
    installMockPrisma();
  });

  // ===========================================================================
  // REQUIREMENT 1: IDEMPOTENCY KEY REUSE & CONCURRENCY
  // ===========================================================================
  describe('1. Idempotency Key Reuse: Submitting same key returns existing sale with idempotentReplay: true', () => {
    const salePayload = {
      eventId: 'evt-ventas-redes-online',
      customer: {
        fullName: 'María Santos López',
        phone: '50255551234',
        deliveryAddress: '5ta Avenida 12-30 Zona 1, Guatemala',
        sourceChannel: 'WHATSAPP',
      },
      deliveryMethod: 'ENVIO_COURIER',
      shippingCost: 35.0,
      items: [
        {
          description: 'Póster Personalizado Bohemian Rhapsody MDF 5.5mm',
          quantity: 2,
          unitPrice: 65.0,
          isCustom: true,
          material: 'MDF_5_5MM',
          customDimensions: '30x40 cm',
        },
      ],
      // Total: 2 * 65.00 + 35.00 = 165.00. 50% deposit = 82.50.
      payments: [
        {
          method: 'TRANSFERENCIA',
          amount: 85.0,
          reference: 'TRANSF-BANK-0091',
        },
      ],
      discount: 0,
    };

    it('1.1: First submission returns 201 Created and registers the sale in DB', async () => {
      const { req, res } = createMockHttp();
      req.headers['idempotency-key'] = 'IDEM-KEY-ALPHA-01';
      req.body = JSON.parse(JSON.stringify(salePayload));

      await createRemoteSale(req, res);

      assert.strictEqual(res.statusCode, 201, 'First remote sale creation must return HTTP 201');
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.idempotentReplay, undefined);
      assert.ok(res.responseData.data.id, 'Sale must have an ID');
      assert.strictEqual(res.responseData.data.idempotencyKey, 'IDEM-KEY-ALPHA-01');
      assert.strictEqual(res.responseData.data.balanceDue, 80.0, 'Balance due must be 165 - 85 = 80');
      assert.strictEqual(res.responseData.data.paymentStatus, 'ANTICIPO_PAGADO');
    });

    it('1.2: Replay with same idempotency-key header returns HTTP 200 and idempotentReplay: true', async () => {
      const idempotencyKey = 'IDEM-KEY-ALPHA-02';

      // 1. Initial creation
      const { req: req1, res: res1 } = createMockHttp();
      req1.headers['idempotency-key'] = idempotencyKey;
      req1.body = JSON.parse(JSON.stringify(salePayload));
      await createRemoteSale(req1, res1);
      assert.strictEqual(res1.statusCode, 201);
      const originalSaleId = res1.responseData.data.id;
      const originalSaleNumber = res1.responseData.data.saleNumber;

      // 2. Immediate Replay via Header
      const { req: req2, res: res2 } = createMockHttp();
      req2.headers['idempotency-key'] = idempotencyKey;
      req2.body = JSON.parse(JSON.stringify(salePayload));
      await createRemoteSale(req2, res2);

      assert.strictEqual(res2.statusCode, 200, 'Replayed sale must return HTTP 200');
      assert.strictEqual(res2.responseData.success, true);
      assert.strictEqual(res2.responseData.idempotentReplay, true, 'idempotentReplay must be true');
      assert.strictEqual(res2.responseData.data.id, originalSaleId, 'Must return the same sale ID');
      assert.strictEqual(res2.responseData.data.saleNumber, originalSaleNumber, 'Must return same saleNumber');
      assert.strictEqual(testStore.sales.size, 1, 'Store must contain exactly 1 sale, no duplicates');
    });

    it('1.3: Replay with idempotencyKey inside body returns HTTP 200 and idempotentReplay: true', async () => {
      const idempotencyKey = 'IDEM-BODY-BETA-03';

      // 1. Initial creation with key in body
      const { req: req1, res: res1 } = createMockHttp();
      req1.body = { ...salePayload, idempotencyKey };
      await createRemoteSale(req1, res1);
      assert.strictEqual(res1.statusCode, 201);

      // 2. Replay with same body
      const { req: req2, res: res2 } = createMockHttp();
      req2.body = { ...salePayload, idempotencyKey };
      await createRemoteSale(req2, res2);

      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res2.responseData.idempotentReplay, true);
      assert.strictEqual(res2.responseData.data.idempotencyKey, idempotencyKey);
    });

    it('1.4: Race Condition Recovery: Concurrent requests hitting P2002 collision return idempotentReplay without 500 error', async () => {
      const idempotencyKey = 'IDEM-RACE-GAMMA-04';

      // Simulate simultaneous calls
      const calls = Array.from({ length: 10 }).map(async () => {
        const { req, res } = createMockHttp();
        req.headers['idempotency-key'] = idempotencyKey;
        req.body = JSON.parse(JSON.stringify(salePayload));
        await createRemoteSale(req, res);
        return { statusCode: res.statusCode, data: res.responseData };
      });

      const results = await Promise.all(calls);

      // Verify that all requests succeeded (either 201 for winner, or 200 for replays)
      const status201s = results.filter((r) => r.statusCode === 201);
      const status200s = results.filter((r) => r.statusCode === 200);

      assert.strictEqual(status201s.length, 1, 'Exactly one concurrent request creates the record (HTTP 201)');
      assert.strictEqual(status200s.length, 9, 'All other 9 concurrent requests gracefully return HTTP 200 idempotent replay');
      for (const r of status200s) {
        assert.strictEqual(r.data.idempotentReplay, true, 'All replays must flag idempotentReplay: true');
      }
      assert.strictEqual(testStore.sales.size, 1, 'Database must have strictly 1 sale record');
    });
  });

  // ===========================================================================
  // REQUIREMENT 2: OVERPAYMENT / UNDERPAYMENT BOUNDARY VALIDATION
  // ===========================================================================
  describe('2. Overpayment or Underpayment on Balance Payment: Differing from balanceDue by >0.05 rejected with HTTP 400', () => {
    let pendingSaleId;
    const balanceDueExact = 140.0;

    beforeEach(async () => {
      // Seed a sale with balanceDue = 140.00
      const sale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-TEST-1001',
          totalAmount: 280.0,
          discount: 0,
          status: 'PENDIENTE',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'ANTICIPO_PAGADO',
          depositAmount: 140.0,
          balanceDue: balanceDueExact,
          items: {
            create: [
              {
                description: 'Póster Grande Vincent Van Gogh',
                quantity: 2,
                unitPrice: 140.0,
                subtotal: 280.0,
              },
            ],
          },
          payments: {
            create: [{ method: 'EFECTIVO', amount: 140.0 }],
          },
        },
      });
      pendingSaleId = sale.id;
    });

    it('2.1: Underpayment by >0.05 (Q 139.94 vs Q 140.00 -> diff 0.06) MUST be rejected with HTTP 400', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 139.94, reference: 'TRANSF-UNDER-01' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400, 'Underpayment differing by 0.06 must be rejected with HTTP 400');
      assert.strictEqual(res.responseData.success, false);
      assert.match(
        res.responseData.error,
        /no coincide con el saldo adeudado/i,
        'Error message must indicate discrepancy with balanceDue'
      );
    });

    it('2.2: Overpayment by >0.05 (Q 140.06 vs Q 140.00 -> diff 0.06) MUST be rejected with HTTP 400', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [{ method: 'TARJETA', amount: 140.06, reference: 'CARD-AUTH-9999' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400, 'Overpayment differing by 0.06 must be rejected with HTTP 400');
      assert.strictEqual(res.responseData.success, false);
      assert.match(
        res.responseData.error,
        /no coincide con el saldo adeudado/i,
        'Error message must indicate discrepancy with balanceDue'
      );
    });

    it('2.3: Large underpayment (Q 50.00 vs Q 140.00) MUST be rejected with HTTP 400', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.responseData.success, false);
    });

    it('2.4: Large overpayment (Q 200.00 vs Q 140.00) MUST be rejected with HTTP 400', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 200.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.responseData.success, false);
    });

    it('2.5: Boundary tolerance of exactly -0.05 on Q 140.00 (Q 139.95, diff = 0.05) MUST be accepted with HTTP 200', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId; // balance is 140.00
      req.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 139.95, reference: 'BOUNDARY-TOLERANCE-MINUS' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 200, 'Boundary payment differing by -0.05 must be accepted with HTTP 200');
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.data.balanceDue, 0.0);
      assert.strictEqual(res.responseData.data.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(res.responseData.data.status, 'COMPLETADA');
    });

    it('2.6: Boundary tolerance of exactly +0.05 on Q 140.00 (Q 140.05, diff = +0.05) MUST be accepted with HTTP 200', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId; // balance is 140.00
      req.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 140.05, reference: 'BOUNDARY-TOLERANCE-PLUS' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 200, 'Boundary payment differing by +0.05 must be accepted with HTTP 200');
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.data.balanceDue, 0.0);
      assert.strictEqual(res.responseData.data.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(res.responseData.data.status, 'COMPLETADA');
    });

    it('2.6b: Boundary tolerance on floating-safe balance Q 100.00 (Q 99.95, diff = -0.05) succeeds when IEEE 754 does not overshoot 0.05', async () => {
      // Seed a sale with balanceDue = 100.00 where 100.0 - 99.95 = 0.04999999999999716 <= 0.05
      const safeSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-SAFE-100',
          totalAmount: 200.0,
          discount: 0,
          status: 'PENDIENTE',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'ANTICIPO_PAGADO',
          depositAmount: 100.0,
          balanceDue: 100.0,
        },
      });

      const { req, res } = createMockHttp();
      req.params.id = safeSale.id;
      req.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 99.95, reference: 'SAFE-TOLERANCE-MINUS' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 200, 'Boundary payment on safe float balance succeeds with HTTP 200');
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.data.balanceDue, 0.0);
    });

    it('2.7: Exact payment (Q 140.00, diff = 0.00) MUST be accepted with HTTP 200', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 140.0, reference: 'EXACT-PAYMENT' }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.data.balanceDue, 0.0);
      assert.strictEqual(res.responseData.data.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(res.responseData.data.status, 'COMPLETADA');
    });

    it('2.8: Split payments summing to balanceDue within tolerance MUST be accepted', async () => {
      const { req, res } = createMockHttp();
      req.params.id = pendingSaleId;
      req.body = {
        payments: [
          { method: 'EFECTIVO', amount: 90.0 },
          { method: 'TRANSFERENCIA', amount: 50.0, reference: 'SPLIT-02' },
        ],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.balanceDue, 0.0);
      assert.strictEqual(testStore.salePayments.length, 2, 'Must record both split payment records');
    });
  });

  // ===========================================================================
  // REQUIREMENT 3: PAYING BALANCE ON ALREADY SETTLED SALE (balanceDue === 0)
  // ===========================================================================
  describe('3. Paying Balance on Already Settled Sale (balanceDue === 0): Rejected with HTTP 400', () => {
    it('3.1: Sale created with 100% full payment (balanceDue === 0) rejects balance payment with HTTP 400', async () => {
      // Seed a sale with balanceDue = 0
      const settledSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-SETTLED-001',
          totalAmount: 150.0,
          discount: 0,
          status: 'COMPLETADA',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'PAGADO_TOTAL',
          depositAmount: 150.0,
          balanceDue: 0.0,
        },
      });

      const { req, res } = createMockHttp();
      req.params.id = settledSale.id;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400, 'Settled sale balance payment must return HTTP 400');
      assert.strictEqual(res.responseData.success, false);
      assert.match(
        res.responseData.error,
        /ya se encuentra completamente liquidada/i,
        'Error must state that the sale is already settled'
      );
    });

    it('3.2: Sale that was settled via balance payment rejects second balance payment with HTTP 400', async () => {
      // 1. Seed partial sale (balanceDue = 75.00)
      const partialSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-PARTIAL-002',
          totalAmount: 150.0,
          discount: 0,
          status: 'PENDIENTE',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'ANTICIPO_PAGADO',
          depositAmount: 75.0,
          balanceDue: 75.0,
        },
      });

      // 2. First balance payment: settles the 75.00
      const { req: req1, res: res1 } = createMockHttp();
      req1.params.id = partialSale.id;
      req1.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 75.0, reference: 'SETTLE-01' }],
      };
      await registerBalancePaymentController(req1, res1);
      assert.strictEqual(res1.statusCode, 200, 'First balance payment must succeed');

      // 3. Second balance payment on same sale: must be rejected with HTTP 400
      const { req: req2, res: res2 } = createMockHttp();
      req2.params.id = partialSale.id;
      req2.body = {
        payments: [{ method: 'TRANSFERENCIA', amount: 75.0, reference: 'SETTLE-02-ATTEMPT' }],
      };
      await registerBalancePaymentController(req2, res2);

      assert.strictEqual(res2.statusCode, 400, 'Subsequent balance payment must return HTTP 400');
      assert.strictEqual(res2.responseData.success, false);
      assert.match(
        res2.responseData.error,
        /ya se encuentra completamente liquidada/i,
        'Must reject attempt to pay settled sale'
      );
    });
  });

  // ===========================================================================
  // REQUIREMENT 4: PAYING BALANCE ON AN ANULADA SALE
  // ===========================================================================
  describe('4. Paying Balance on an ANULADA Sale: Rejected with HTTP 400', () => {
    it('4.1: Anulada sale with balanceDue > 0 rejected with HTTP 400 and explicit annulled message', async () => {
      // Seed an ANULADA sale with balanceDue = 100.00
      const annulledSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-ANULADA-001',
          totalAmount: 200.0,
          discount: 0,
          status: 'ANULADA',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'ANTICIPO_PAGADO',
          depositAmount: 100.0,
          balanceDue: 100.0,
        },
      });

      const { req, res } = createMockHttp();
      req.params.id = annulledSale.id;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 100.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400, 'ANULADA sale balance payment must return HTTP 400');
      assert.strictEqual(res.responseData.success, false);
      assert.match(
        res.responseData.error,
        /No se puede cobrar el saldo de una venta anulada/i,
        'Error must state that annulled sales cannot have balance collected'
      );
    });

    it('4.2: Anulada sale check takes precedence over balance check even if balanceDue === 0', async () => {
      // Seed an ANULADA sale with balanceDue = 0
      const annulledZeroSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-test-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-test-uuid',
          saleNumber: 'VENT-ANULADA-ZERO-002',
          totalAmount: 100.0,
          discount: 0,
          status: 'ANULADA',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'PAGADO_TOTAL',
          depositAmount: 100.0,
          balanceDue: 0.0,
        },
      });

      const { req, res } = createMockHttp();
      req.params.id = annulledZeroSale.id;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 0.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.match(
        res.responseData.error,
        /No se puede cobrar el saldo de una venta anulada/i,
        'Annulled check MUST take precedence over balance calculation'
      );
    });
  });

  // ===========================================================================
  // REQUIREMENT 5: VALIDATORS & INPUT DEFENSE (ZOD SCHEMAS & MIDDLEWARE)
  // ===========================================================================
  describe('5. Input Boundary Defense: Zod Validators for Balance and Remote Sales', () => {
    it('5.1: Balance payment with empty payments array rejected by Zod schema with HTTP 400', () => {
      const parsed = balancePaymentSchema.safeParse({ payments: [] });
      assert.strictEqual(parsed.success, false, 'Empty payments array must fail validation');
      assert.match(parsed.error.errors[0].message, /Debe registrar al menos un método de pago/i);
    });

    it('5.2: Balance payment with negative or zero amount rejected by Zod schema', () => {
      const parsedNegative = balancePaymentSchema.safeParse({
        payments: [{ method: 'EFECTIVO', amount: -10.0 }],
      });
      assert.strictEqual(parsedNegative.success, false);

      const parsedZero = balancePaymentSchema.safeParse({
        payments: [{ method: 'EFECTIVO', amount: 0 }],
      });
      assert.strictEqual(parsedZero.success, false);
    });

    it('5.3: Balance payment with invalid payment method rejected by Zod schema', () => {
      const parsedInvalidMethod = balancePaymentSchema.safeParse({
        payments: [{ method: 'BITCOIN', amount: 100.0 }],
      });
      assert.strictEqual(parsedInvalidMethod.success, false);
      assert.match(parsedInvalidMethod.error.errors[0].message, /EFECTIVO, TARJETA, TRANSFERENCIA u OTRO/i);
    });

    it('5.4: Validate middleware intercepts invalid payload and responds with HTTP 400 before controller', () => {
      const middleware = validate(balancePaymentSchema);
      const req = { body: { payments: [] } };
      let sentStatus = null;
      let sentJson = null;
      const res = {
        status: (c) => {
          sentStatus = c;
          return res;
        },
        json: (d) => {
          sentJson = d;
          return res;
        },
      };
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, 'next() must NOT be called for invalid payload');
      assert.strictEqual(sentStatus, 400, 'Middleware must return HTTP 400');
      assert.strictEqual(sentJson.success, false);
      assert.ok(sentJson.details.length > 0, 'Must include validation details');
    });

    it('5.5: Non-existent saleId rejected with HTTP 404', async () => {
      const { req, res } = createMockHttp();
      req.params.id = 'non-existent-uuid';
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 404, 'Non-existent sale must return HTTP 404');
      assert.strictEqual(res.responseData.success, false);
      assert.match(res.responseData.error, /Venta no encontrada/i);
    });

    it('5.6: Multi-Tenant Isolation: Cannot settle a sale belonging to another tenant', async () => {
      // Seed sale under tenant-other
      const foreignSale = await testStore.createTxClient().sale.create({
        data: {
          tenantId: 'tenant-other-uuid',
          eventId: 'evt-ventas-redes-online',
          sellerId: 'seller-other-uuid',
          saleNumber: 'VENT-FOREIGN-01',
          totalAmount: 100.0,
          discount: 0,
          status: 'PENDIENTE',
          inputChannel: 'REDES_SOCIALES',
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: 'ENVIO_COURIER',
          paymentStatus: 'ANTICIPO_PAGADO',
          depositAmount: 50.0,
          balanceDue: 50.0,
        },
      });

      // Request from tenant-test-uuid
      const { req, res } = createMockHttp();
      req.tenantId = 'tenant-test-uuid';
      req.params.id = foreignSale.id;
      req.body = {
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusCode, 404, 'Cross-tenant sale query must be rejected with HTTP 404');
    });
  });
});
