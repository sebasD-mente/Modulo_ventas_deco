/**
 * tests/adversarial/m1-domain1-functional-challenger.test.js
 * 
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 1 (DOMAIN 1 FUNCTIONAL VERIFICATION)
 * 
 * Mission Scope:
 * 1. WhatsApp Customer Uniqueness (duplicate phone in same tenant rejected with HTTP 409).
 * 2. 50% Deposit Gate:
 *    - Order of Q300 products + Q40 shipping (Total Q340) with Q100 deposit (<50%) MUST fail with HTTP 400.
 *    - Order with Q170 deposit (>=50%) MUST succeed with:
 *      * paymentStatus: 'ANTICIPO_PAGADO'
 *      * depositAmount: 170.00
 *      * balanceDue: 170.00
 *      * status: 'PENDIENTE'
 * 3. Fallback to virtual event 'evt-ventas-redes-online' when eventId is omitted.
 * 4. Balance Payment:
 *    - Paying Q170 balance must commute sale to balanceDue: 0, paymentStatus: 'PAGADO_TOTAL', status: 'COMPLETADA'.
 * 5. Adversarial Stress & Edge Cases:
 *    - Idempotency replay with duplicate idempotencyKey.
 *    - Multi-tenant phone uniqueness isolation.
 *    - Boundary conditions: Q169.90 deposit (<50%) vs Q170.00 deposit (>=50%).
 *    - Full 100% payment (Q340) upfront.
 *    - Discount subtraction before deposit gate calculation.
 *    - Re-payment of already liquidated balance rejection.
 *    - Zod schema edge cases (empty items, missing customer, invalid phone).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { prisma } from '../../server/config/prisma.js';
import {
  findOrCreateCustomer,
  createCustomer as createCustomerService,
  getCustomersList,
  getCustomerById,
  createRemoteSaleTransaction,
  registerBalancePayment as registerBalancePaymentService,
} from '../../server/services/sales/remoteSaleService.js';
import {
  getCustomers,
  createCustomer as createCustomerController,
  getCustomer360,
  createRemoteSale as createRemoteSaleController,
  registerBalancePayment as registerBalancePaymentController,
} from '../../server/controllers/remoteSaleController.js';
import {
  customerSchema,
  createRemoteSaleSchema,
  balancePaymentSchema,
} from '../../server/validators/remoteSaleValidators.js';

// ============================================================================
// IN-MEMORY HIGH-FIDELITY PRISMA MOCK HARNESS
// ============================================================================
class InMemoryPrismaMock {
  constructor() {
    this.reset();
  }

  reset() {
    this.customers = new Map();
    this.sales = new Map();
    this.salePayments = [];
    this.auditLogs = [];
    this.events = new Map([
      ['evt-ventas-redes-online', {
        id: 'evt-ventas-redes-online',
        name: 'Ventas en Línea y Redes',
        currentSaleSequence: 0,
      }],
      ['evt-feria-2026', {
        id: 'evt-feria-2026',
        name: 'Feria Vintage 2026',
        currentSaleSequence: 0,
      }],
    ]);
  }

  // --- Customer Delegate ---
  get customer() {
    return {
      findUnique: async ({ where }) => {
        if (where.tenantId_phone) {
          const { tenantId, phone } = where.tenantId_phone;
          for (const c of this.customers.values()) {
            if (c.tenantId === tenantId && c.phone === phone) {
              return { ...c };
            }
          }
          return null;
        }
        if (where.id) {
          const c = this.customers.get(where.id);
          return c ? { ...c } : null;
        }
        return null;
      },

      findFirst: async ({ where, include }) => {
        for (const c of this.customers.values()) {
          let match = true;
          if (where.id && c.id !== where.id) match = false;
          if (where.tenantId && c.tenantId !== where.tenantId) match = false;
          if (match) {
            const result = { ...c };
            if (include?.sales) {
              result.sales = Array.from(this.sales.values())
                .filter((s) => s.customerId === c.id)
                .map((s) => ({
                  ...s,
                  items: s.items || [],
                  payments: s.payments || [],
                }));
            }
            return result;
          }
        }
        return null;
      },

      findMany: async ({ where, skip = 0, take = 20, orderBy, include }) => {
        let results = Array.from(this.customers.values()).filter((c) => {
          if (where.tenantId && c.tenantId !== where.tenantId) return false;
          if (where.phone?.contains && !c.phone.includes(where.phone.contains)) return false;
          if (where.OR) {
            const queryMatches = where.OR.some((cond) => {
              if (cond.fullName?.contains) {
                return c.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
              }
              if (cond.phone?.contains) {
                return c.phone.includes(cond.phone.contains);
              }
              return false;
            });
            if (!queryMatches) return false;
          }
          return true;
        });

        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const paginated = results.slice(skip, skip + take);

        return paginated.map((c) => {
          const res = { ...c };
          if (include?._count?.select?.sales) {
            const count = Array.from(this.sales.values()).filter((s) => s.customerId === c.id).length;
            res._count = { sales: count };
          }
          return res;
        });
      },

      count: async ({ where }) => {
        const list = await this.customer.findMany({ where, skip: 0, take: 9999 });
        return list.length;
      },

      create: async ({ data }) => {
        const id = data.id || crypto.randomUUID();
        const record = {
          id,
          tenantId: data.tenantId,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || null,
          deliveryAddress: data.deliveryAddress || null,
          department: data.department || null,
          municipality: data.municipality || null,
          sourceChannel: data.sourceChannel || 'WHATSAPP',
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.customers.set(id, record);
        return { ...record };
      },

      update: async ({ where, data }) => {
        const c = this.customers.get(where.id);
        if (!c) throw new Error('Customer not found for update');
        const updated = {
          ...c,
          ...data,
          updatedAt: new Date(),
        };
        this.customers.set(where.id, updated);
        return { ...updated };
      },
    };
  }

  // --- Event Delegate ---
  get event() {
    return {
      update: async ({ where, data, select }) => {
        let ev = this.events.get(where.id);
        if (!ev) {
          ev = { id: where.id, name: 'Venta Online', currentSaleSequence: 0 };
          this.events.set(where.id, ev);
        }
        if (data.currentSaleSequence?.increment) {
          ev.currentSaleSequence += data.currentSaleSequence.increment;
        }
        return {
          name: ev.name,
          currentSaleSequence: ev.currentSaleSequence,
        };
      },
      findUnique: async ({ where }) => {
        const ev = this.events.get(where.id);
        return ev ? { ...ev } : null;
      },
    };
  }

  // --- Sale Delegate ---
  get sale() {
    return {
      findUnique: async ({ where, include }) => {
        if (where.idempotencyKey) {
          for (const s of this.sales.values()) {
            if (s.idempotencyKey === where.idempotencyKey) {
              return this._hydrateSale(s, include);
            }
          }
          return null;
        }
        if (where.id) {
          const s = this.sales.get(where.id);
          return s ? this._hydrateSale(s, include) : null;
        }
        return null;
      },

      findFirst: async ({ where, include }) => {
        for (const s of this.sales.values()) {
          let match = true;
          if (where.id && s.id !== where.id) match = false;
          if (where.tenantId && s.tenantId !== where.tenantId) match = false;
          if (match) {
            return this._hydrateSale(s, include);
          }
        }
        return null;
      },

      create: async ({ data, include }) => {
        const id = data.id || crypto.randomUUID();
        const items = (data.items?.create || []).map((item) => ({
          id: crypto.randomUUID(),
          saleId: id,
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        const payments = (data.payments?.create || []).map((p) => ({
          id: crypto.randomUUID(),
          saleId: id,
          ...p,
          createdAt: new Date(),
        }));

        const record = {
          id,
          tenantId: data.tenantId,
          eventId: data.eventId,
          sellerId: data.sellerId,
          saleNumber: data.saleNumber,
          totalAmount: data.totalAmount,
          discount: data.discount || 0,
          notes: data.notes || null,
          status: data.status,
          inputChannel: data.inputChannel || 'REDES_SOCIALES',
          idempotencyKey: data.idempotencyKey || null,
          orderType: data.orderType || 'REDES_PERSONALIZADO',
          deliveryMethod: data.deliveryMethod,
          shippingCost: data.shippingCost || 0,
          shippingCourier: data.shippingCourier || null,
          shippingTrackingNumber: data.shippingTrackingNumber || null,
          pickupEventId: data.pickupEventId || null,
          customerId: data.customerId || null,
          paymentStatus: data.paymentStatus,
          depositAmount: data.depositAmount,
          balanceDue: data.balanceDue,
          commissionSettlementId: null,
          commissionPaid: false,
          items,
          payments,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.sales.set(id, record);
        for (const p of payments) {
          this.salePayments.push(p);
        }

        return this._hydrateSale(record, include);
      },

      update: async ({ where, data, include }) => {
        const s = this.sales.get(where.id);
        if (!s) throw new Error('Sale not found for update');
        const updated = {
          ...s,
          ...data,
          updatedAt: new Date(),
        };
        this.sales.set(where.id, updated);
        return this._hydrateSale(updated, include);
      },
    };
  }

  // --- SalePayment Delegate ---
  get salePayment() {
    return {
      createMany: async ({ data }) => {
        for (const p of data) {
          const rec = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            ...p,
          };
          this.salePayments.push(rec);
          const s = this.sales.get(p.saleId);
          if (s) {
            s.payments = s.payments || [];
            s.payments.push(rec);
          }
        }
        return { count: data.length };
      },
    };
  }

  // --- AuditLog Delegate ---
  get auditLog() {
    return {
      create: async ({ data }) => {
        const rec = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
        this.auditLogs.push(rec);
        return rec;
      },
    };
  }

  _hydrateSale(s, include) {
    const copy = { ...s };
    if (include?.items) {
      copy.items = [...(s.items || [])];
    }
    if (include?.payments) {
      copy.payments = [...(s.payments || [])];
    }
    if (include?.customer) {
      copy.customer = s.customerId ? this.customers.get(s.customerId) || null : null;
    }
    if (include?.seller) {
      copy.seller = { id: s.sellerId, fullName: 'Vendedor Test', email: 'test@dekovintage.com' };
    }
    return copy;
  }

  // --- Transaction Runner ---
  async $transaction(fn) {
    if (typeof fn === 'function') {
      return await fn(this);
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
  user = { id: 'usr-seller-01' },
  tenantId = 't-deco-01',
} = {}) {
  const req = {
    body,
    query,
    params,
    headers,
    user,
    tenantId,
  };
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
    get statusValue() {
      return responseStatus;
    },
    get data() {
      return responseData;
    },
  };
  return { req, res };
}

// ============================================================================
// ADVERSARIAL TEST SUITE
// ============================================================================
describe('⚔️ CHALLENGER M1: Functional Verification of Domain 1 (CRM & Ventas 50/50)', () => {
  let mockPrisma;
  let originalPrismaProps = {};

  beforeEach(() => {
    mockPrisma = new InMemoryPrismaMock();

    // Patch prisma singleton properties
    originalPrismaProps = {
      customer: prisma.customer,
      event: prisma.event,
      sale: prisma.sale,
      salePayment: prisma.salePayment,
      auditLog: prisma.auditLog,
      $transaction: prisma.$transaction,
      $queryRawUnsafe: prisma.$queryRawUnsafe,
    };

    prisma.customer = mockPrisma.customer;
    prisma.event = mockPrisma.event;
    prisma.sale = mockPrisma.sale;
    prisma.salePayment = mockPrisma.salePayment;
    prisma.auditLog = mockPrisma.auditLog;
    prisma.$transaction = mockPrisma.$transaction.bind(mockPrisma);
    delete prisma.$queryRawUnsafe; // Forces sequence generator to use event.update fallback
  });

  afterEach(() => {
    // Restore original prisma properties
    Object.assign(prisma, originalPrismaProps);
  });

  // --------------------------------------------------------------------------
  // 1. WHATSAPP CUSTOMER UNIQUENESS
  // --------------------------------------------------------------------------
  describe('1. WhatsApp Customer Uniqueness & CRM Isolation', () => {
    it('1.1 MUST reject duplicate phone number within the same tenant with HTTP 409', async () => {
      const tenantId = 'tenant-deco-gt';
      const customerData = {
        fullName: 'Carlos Gómez',
        phone: '50244445555',
        deliveryAddress: 'Zona 10, Ciudad de Guatemala',
        department: 'Guatemala',
        municipality: 'Guatemala',
      };

      // First creation: Success
      const first = await createCustomerService({ tenantId, customerData });
      assert.ok(first.id, 'First customer must receive a generated ID');
      assert.strictEqual(first.phone, '50244445555');

      // Second creation with same phone in same tenant: MUST FAIL with status 409
      await assert.rejects(
        async () => {
          await createCustomerService({ tenantId, customerData });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409, 'Error statusCode must be 409');
          assert.match(err.message, /Ya existe un cliente registrado con el número de teléfono\/WhatsApp 50244445555/);
          return true;
        }
      );
    });

    it('1.2 Controller MUST return HTTP 409 on duplicate customer registration', async () => {
      const tenantId = 'tenant-deco-gt';
      const body = {
        fullName: 'María Santos',
        phone: '50255556666',
        deliveryAddress: 'Antigua Guatemala, Sacatepéquez',
      };

      // 1st request -> 201
      const { req: req1, res: res1 } = createMockReqRes({ body, tenantId });
      await createCustomerController(req1, res1);
      assert.strictEqual(res1.statusValue, 201);
      assert.strictEqual(res1.data.success, true);
      assert.strictEqual(res1.data.data.phone, '50255556666');

      // 2nd request -> 409
      const { req: req2, res: res2 } = createMockReqRes({ body, tenantId });
      await createCustomerController(req2, res2);
      assert.strictEqual(res2.statusValue, 409);
      assert.strictEqual(res2.data.success, false);
      assert.match(res2.data.error, /Ya existe un cliente registrado/);
    });

    it('1.3 Multi-tenant isolation: Same phone number in a DIFFERENT tenant MUST succeed', async () => {
      const customerData = {
        fullName: 'Juan Pérez',
        phone: '50211112222',
        deliveryAddress: 'Quetzaltenango',
      };

      // Tenant A
      const custA = await createCustomerService({ tenantId: 'tenant-A', customerData });
      assert.ok(custA.id);

      // Tenant B with same phone: MUST SUCCEED (no cross-tenant pollution)
      const custB = await createCustomerService({ tenantId: 'tenant-B', customerData });
      assert.ok(custB.id);
      assert.notStrictEqual(custA.id, custB.id, 'IDs must be distinct across tenants');
    });

    it('1.4 findOrCreateCustomer in remote sale upserts existing customer without 409 collision', async () => {
      const tenantId = 'tenant-deco-gt';
      const initial = await createCustomerService({
        tenantId,
        customerData: { fullName: 'Lucía Morales', phone: '50277778888', deliveryAddress: 'Old Address' },
      });

      // Passing updated deliveryAddress in sale
      const upserted = await findOrCreateCustomer(tenantId, {
        fullName: 'Lucía Morales',
        phone: '50277778888',
        deliveryAddress: 'New Address Zona 14',
      });

      assert.strictEqual(upserted.id, initial.id);
      assert.strictEqual(upserted.deliveryAddress, 'New Address Zona 14');
    });

    it('1.5 Zod validator MUST reject invalid phone numbers (<8 digits or non-numeric)', () => {
      const invalidPhones = ['1234567', 'phone12345', '+502-abcd-efgh', ''];
      for (const phone of invalidPhones) {
        const parsed = customerSchema.safeParse({
          fullName: 'Test User',
          phone,
        });
        assert.strictEqual(parsed.success, false, `Phone "${phone}" should be rejected by schema`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. 50% DEPOSIT GATE
  // --------------------------------------------------------------------------
  describe('2. 50% Deposit Gate (Strict Mathematical Integrity)', () => {
    const sampleItems = [
      {
        description: 'Póster Custom Van Gogh 30x40 (PVC 5mm)',
        quantity: 2,
        unitPrice: 150.00, // Subtotal: Q 300.00
        isCustom: true,
        material: 'PVC_5MM',
      },
    ];
    const shippingCost = 40.00; // Total: Q 340.00
    // Required 50% deposit: Q 170.00

    it('2.1 Order of Q300 products + Q40 shipping with Q100 deposit (<50%) MUST fail with HTTP 400', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        customer: { fullName: 'Ana Estrada', phone: '50288889999' },
        items: sampleItems,
        shippingCost,
        payments: [{ method: 'TRANSFERENCIA', amount: 100.00 }], // Q100 < Q170 (50%)
      };

      // Service Level
      await assert.rejects(
        async () => {
          await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Anticipo insuficiente: Se requiere al menos el 50%/);
          assert.match(err.message, /Q 170\.00/);
          assert.match(err.message, /Q 100\.00/);
          return true;
        }
      );

      // Controller Level (HTTP Response)
      const { req, res } = createMockReqRes({ body: salePayload, tenantId, user: { id: sellerId } });
      await createRemoteSaleController(req, res);

      assert.strictEqual(res.statusValue, 400);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.error, /Anticipo insuficiente/);
    });

    it('2.2 Order with Q170 deposit (>=50%) MUST succeed with ANTICIPO_PAGADO, depositAmount: 170, balanceDue: 170, status: PENDIENTE', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        customer: { fullName: 'Ana Estrada', phone: '50288889999' },
        items: sampleItems,
        shippingCost,
        payments: [{ method: 'TRANSFERENCIA', amount: 170.00 }], // Exactly 50%
      };

      const sale = await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload });

      assert.ok(sale.id, 'Sale must be persisted with ID');
      assert.strictEqual(Number(sale.totalAmount), 340.00, 'Total amount must be Q 340.00');
      assert.strictEqual(Number(sale.depositAmount), 170.00, 'Deposit amount must be Q 170.00');
      assert.strictEqual(Number(sale.balanceDue), 170.00, 'Balance due must be Q 170.00');
      assert.strictEqual(sale.paymentStatus, 'ANTICIPO_PAGADO', 'Payment status must be ANTICIPO_PAGADO');
      assert.strictEqual(sale.status, 'PENDIENTE', 'Order status must be PENDIENTE');
      assert.strictEqual(sale.items.length, 1);
      assert.strictEqual(sale.payments.length, 1);
      assert.strictEqual(Number(sale.payments[0].amount), 170.00);
    });

    it('2.3 Boundary Stress: Q169.90 deposit (<50% by Q0.10) MUST fail with 400', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        customer: { fullName: 'Boundary Tester', phone: '50299990000' },
        items: sampleItems,
        shippingCost,
        payments: [{ method: 'EFECTIVO', amount: 169.90 }], // Under by 10 cents
      };

      await assert.rejects(
        async () => {
          await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('2.4 Full 100% Payment (Q340) upfront MUST commute immediately to PAGADO_TOTAL, balanceDue: 0, status: COMPLETADA', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        customer: { fullName: 'Pago Total', phone: '50212340000' },
        items: sampleItems,
        shippingCost,
        payments: [
          { method: 'TARJETA', amount: 340.00, reference: 'AUTH-9944' },
        ],
      };

      const sale = await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload });

      assert.strictEqual(Number(sale.totalAmount), 340.00);
      assert.strictEqual(Number(sale.depositAmount), 340.00);
      assert.strictEqual(Number(sale.balanceDue), 0.00);
      assert.strictEqual(sale.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(sale.status, 'COMPLETADA');
    });

    it('2.5 Discount correctly reduces base before 50% deposit calculation', async () => {
      // Q300 items - Q50 discount + Q40 shipping = Total Q 290.00.
      // Required 50% deposit = Q 145.00
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const failPayload = {
        customer: { fullName: 'Discount Client', phone: '50211119999' },
        items: sampleItems,
        shippingCost: 40.00,
        discount: 50.00,
        payments: [{ method: 'TRANSFERENCIA', amount: 140.00 }], // Q140 < Q145
      };

      await assert.rejects(async () => {
        await createRemoteSaleTransaction({ tenantId, sellerId, data: failPayload });
      }, { statusCode: 400 });

      const passPayload = {
        ...failPayload,
        payments: [{ method: 'TRANSFERENCIA', amount: 145.00 }], // Exactly 50% of Q290
      };

      const sale = await createRemoteSaleTransaction({ tenantId, sellerId, data: passPayload });
      assert.strictEqual(Number(sale.totalAmount), 290.00);
      assert.strictEqual(Number(sale.depositAmount), 145.00);
      assert.strictEqual(Number(sale.balanceDue), 145.00);
      assert.strictEqual(sale.paymentStatus, 'ANTICIPO_PAGADO');
    });
  });

  // --------------------------------------------------------------------------
  // 3. FALLBACK TO VIRTUAL EVENT 'evt-ventas-redes-online'
  // --------------------------------------------------------------------------
  describe('3. Virtual Event Fallback & Consecutivos', () => {
    it('3.1 When eventId is omitted, sale MUST default to "evt-ventas-redes-online"', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        // eventId omitted
        customer: { fullName: 'Online Buyer', phone: '50233334444' },
        items: [{ description: 'Póster A3', quantity: 1, unitPrice: 100 }],
        payments: [{ method: 'TRANSFERENCIA', amount: 50 }],
      };

      // 1. Zod schema validation sets default
      const parsed = createRemoteSaleSchema.parse(salePayload);
      assert.strictEqual(parsed.eventId, 'evt-ventas-redes-online');

      // 2. Service execution assigns virtual event
      const sale = await createRemoteSaleTransaction({ tenantId, sellerId, data: parsed });
      assert.strictEqual(sale.eventId, 'evt-ventas-redes-online');
      assert.match(sale.saleNumber, /^VENT-\d{4}$/, 'Sale number must use VENT- sequence prefix');
    });

    it('3.2 When explicit eventId is provided, it is respected over virtual default', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';

      const salePayload = {
        eventId: 'evt-feria-2026',
        customer: { fullName: 'Feria Pickup', phone: '50233335555' },
        items: [{ description: 'Póster Feria', quantity: 1, unitPrice: 100 }],
        payments: [{ method: 'TRANSFERENCIA', amount: 50 }],
      };

      const sale = await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload });
      assert.strictEqual(sale.eventId, 'evt-feria-2026');
      assert.match(sale.saleNumber, /^FERI-\d{4}$/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. BALANCE PAYMENT COMMUTATION
  // --------------------------------------------------------------------------
  describe('4. Balance Payment Commutation to PAGADO_TOTAL & COMPLETADA', () => {
    let pendingSale;
    const tenantId = 'tenant-deco-gt';
    const sellerId = 'seller-01';

    beforeEach(async () => {
      // Create order: Q300 items + Q40 shipping = Q340. Deposit: Q170. BalanceDue: Q170.
      pendingSale = await createRemoteSaleTransaction({
        tenantId,
        sellerId,
        data: {
          customer: { fullName: 'Cliente Saldo', phone: '50299887766' },
          items: [{ description: 'Póster Cuadro', quantity: 2, unitPrice: 150 }],
          shippingCost: 40.00,
          payments: [{ method: 'TRANSFERENCIA', amount: 170.00 }],
        },
      });
      assert.strictEqual(Number(pendingSale.balanceDue), 170.00);
      assert.strictEqual(pendingSale.paymentStatus, 'ANTICIPO_PAGADO');
      assert.strictEqual(pendingSale.status, 'PENDIENTE');
    });

    it('4.1 Paying exact Q170 balance MUST commute sale to balanceDue: 0, PAGADO_TOTAL, COMPLETADA', async () => {
      const balancePayments = [
        { method: 'EFECTIVO', amount: 170.00, reference: 'RECIBO-CONTRAENTREGA-01' },
      ];

      const completedSale = await registerBalancePaymentService({
        saleId: pendingSale.id,
        tenantId,
        sellerId,
        payments: balancePayments,
        notes: 'Entregado por courier Forza',
      });

      assert.strictEqual(Number(completedSale.balanceDue), 0.00, 'Balance due must be zero');
      assert.strictEqual(Number(completedSale.depositAmount), 340.00, 'Deposit must now equal totalAmount');
      assert.strictEqual(completedSale.paymentStatus, 'PAGADO_TOTAL', 'Status must be PAGADO_TOTAL');
      assert.strictEqual(completedSale.status, 'COMPLETADA', 'Sale status must be COMPLETADA');
      assert.strictEqual(completedSale.payments.length, 2, 'Must have 2 total payments (anticipo + saldo)');
      assert.match(completedSale.notes, /Entregado por courier Forza/);

      // Verify audit log
      assert.ok(mockPrisma.auditLogs.some((l) => l.action === 'SALDO_VENTA_COBRADO'));
    });

    it('4.2 Controller POST /api/sales/:id/balance-payment returns HTTP 200 with completed sale', async () => {
      const { req, res } = createMockReqRes({
        tenantId,
        user: { id: sellerId },
        params: { id: pendingSale.id },
        body: {
          payments: [{ method: 'TRANSFERENCIA', amount: 170.00, reference: 'TRF-FINAL-99' }],
          notes: 'Pagado por Guatex',
        },
      });

      await registerBalancePaymentController(req, res);

      assert.strictEqual(res.statusValue, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(Number(res.data.data.balanceDue), 0.00);
      assert.strictEqual(res.data.data.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(res.data.data.status, 'COMPLETADA');
    });

    it('4.3 Mismatched balance payment (paying Q100 on Q170 balance) MUST be rejected with HTTP 400', async () => {
      await assert.rejects(
        async () => {
          await registerBalancePaymentService({
            saleId: pendingSale.id,
            tenantId,
            sellerId,
            payments: [{ method: 'EFECTIVO', amount: 100.00 }], // Q100 != Q170
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /El monto pagado \(Q 100\.00\) no coincide con el saldo adeudado de la orden \(Q 170\.00\)/);
          return true;
        }
      );
    });

    it('4.4 Paying balance on already liquidated sale (balanceDue = 0) MUST fail with HTTP 400', async () => {
      // 1st pay: Clears balance
      await registerBalancePaymentService({
        saleId: pendingSale.id,
        tenantId,
        sellerId,
        payments: [{ method: 'EFECTIVO', amount: 170.00 }],
      });

      // 2nd pay: MUST FAIL
      await assert.rejects(
        async () => {
          await registerBalancePaymentService({
            saleId: pendingSale.id,
            tenantId,
            sellerId,
            payments: [{ method: 'EFECTIVO', amount: 170.00 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /ya se encuentra completamente liquidada/);
          return true;
        }
      );
    });

    it('4.5 Paying balance on an ANULADA sale MUST fail with HTTP 400', async () => {
      // Mark sale ANULADA
      mockPrisma.sales.get(pendingSale.id).status = 'ANULADA';

      await assert.rejects(
        async () => {
          await registerBalancePaymentService({
            saleId: pendingSale.id,
            tenantId,
            sellerId,
            payments: [{ method: 'EFECTIVO', amount: 170.00 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /No se puede cobrar el saldo de una venta anulada/);
          return true;
        }
      );
    });

    it('4.6 Cross-tenant protection: Cannot pay balance of a sale belonging to another tenant', async () => {
      await assert.rejects(
        async () => {
          await registerBalancePaymentService({
            saleId: pendingSale.id,
            tenantId: 'different-tenant-hack',
            sellerId,
            payments: [{ method: 'EFECTIVO', amount: 170.00 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /Venta no encontrada/);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. ADVERSARIAL IDEMPOTENCY & SCHEMA INTEGRITY
  // --------------------------------------------------------------------------
  describe('5. Adversarial Idempotency & Schema Refinements', () => {
    it('5.1 Idempotent replay with same idempotencyKey returns existing sale without duplicate records', async () => {
      const tenantId = 'tenant-deco-gt';
      const sellerId = 'seller-01';
      const idempotencyKey = 'idem-challenge-m1-uuid-001';

      const salePayload = {
        idempotencyKey,
        customer: { fullName: 'Idempotent User', phone: '50244440000' },
        items: [{ description: 'Póster Test', quantity: 1, unitPrice: 200 }],
        payments: [{ method: 'TRANSFERENCIA', amount: 100 }],
      };

      // 1st Call -> Created
      const sale1 = await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload, idempotencyKey });
      assert.strictEqual(sale1.idempotentReplay, undefined);

      // 2nd Call -> Replayed
      const sale2 = await createRemoteSaleTransaction({ tenantId, sellerId, data: salePayload, idempotencyKey });
      assert.strictEqual(sale2.idempotentReplay, true);
      assert.strictEqual(sale1.id, sale2.id);
      assert.strictEqual(mockPrisma.sales.size, 1, 'Only 1 sale record must exist in DB');
    });

    it('5.2 createRemoteSaleSchema rejects requests without customerId AND without customer object', () => {
      const invalidPayload = {
        // No customerId, No customer
        items: [{ description: 'Póster', quantity: 1, unitPrice: 100 }],
        payments: [{ method: 'EFECTIVO', amount: 50 }],
      };

      const result = createRemoteSaleSchema.safeParse(invalidPayload);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.errors.some((e) => e.message.includes('Debe especificar el cliente')));
    });

    it('5.3 createRemoteSaleSchema rejects RETIRO_EVENTO when pickupEventId is missing', () => {
      const invalidPickup = {
        customer: { fullName: 'Pickup User', phone: '50277771111' },
        deliveryMethod: 'RETIRO_EVENTO',
        // missing pickupEventId
        items: [{ description: 'Póster', quantity: 1, unitPrice: 100 }],
        payments: [{ method: 'EFECTIVO', amount: 50 }],
      };

      const result = createRemoteSaleSchema.safeParse(invalidPickup);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.errors.some((e) => e.message.includes('pickupEventId')));
    });

    it('5.4 createRemoteSaleSchema rejects empty items or payments arrays', () => {
      const noItems = {
        customer: { fullName: 'No Items', phone: '50277772222' },
        items: [],
        payments: [{ method: 'EFECTIVO', amount: 50 }],
      };
      assert.strictEqual(createRemoteSaleSchema.safeParse(noItems).success, false);

      const noPayments = {
        customer: { fullName: 'No Payments', phone: '50277773333' },
        items: [{ description: 'Póster', quantity: 1, unitPrice: 100 }],
        payments: [],
      };
      assert.strictEqual(createRemoteSaleSchema.safeParse(noPayments).success, false);
    });

    it('5.5 balancePaymentSchema rejects empty payments array', () => {
      assert.strictEqual(balancePaymentSchema.safeParse({ payments: [] }).success, false);
      assert.strictEqual(
        balancePaymentSchema.safeParse({
          payments: [{ method: 'EFECTIVO', amount: 100 }],
        }).success,
        true
      );
    });
  });
});
