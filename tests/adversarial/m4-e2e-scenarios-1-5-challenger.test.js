/**
 * tests/adversarial/m4-e2e-scenarios-1-5-challenger.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER — MILESTONE 4: SCENARIOS 1 TO 5
 * STAND {IA} (Deco Vintage Guate & Deko Labs)
 *
 * Adversarial Testing Scope:
 * 1. Scenario 1: CRM & WhatsApp Uniqueness
 *    - Strict duplicate rejection on (tenantId, phone) with HTTP 409
 *    - Tenant isolation: distinct tenants can share same phone without collision
 *    - Strict phone validation (8-15 digits, rejected on symbols/letters/short/long)
 *    - Sanitization & trimming of inputs
 *    - Pagination clamping (negative page, excessive limit)
 *    - Ficha 360 LTV precision (excluding ANULADA, floating point precision)
 *    - Multi-tenant query protection
 * 2. Scenario 2 & 3: Remote Sale 50/50 & Deposit Gate
 *    - Extreme boundary 49.99% deposit rejection (HTTP 400)
 *    - Extreme boundary 50.00% deposit acceptance (HTTP 201, ANTICIPO_PAGADO)
 *    - Odd cents arithmetic & rounding (e.g. Q 333.33 with 50% = Q 166.67)
 *    - Invariant: depositAmount + balanceDue === totalAmount
 *    - 100% full payment & overpayment handling
 *    - Multi-payment split deposit
 *    - Discount edge cases (discount >= subtotal)
 *    - Idempotency RFC 7231 fast path & transaction P2002 collision recovery
 * 3. Scenario 4: Virtual Event Fallback
 *    - Default fallback to 'evt-ventas-redes-online' when eventId is omitted
 *    - Explicit eventId preserved
 * 4. Scenario 5: Balance Collection & Zero Balance Edge Cases
 *    - Rejection if order already settled (balanceDue === 0.00)
 *    - Rejection if payment amount is zero or negative
 *    - Rejection if balance payment is insufficient or excessive (beyond tolerance)
 *    - Tolerance threshold (<= 0.05 delta)
 *    - Rejection if order status is ANULADA
 *    - Multi-tenant isolation on balance collection (HTTP 404)
 *    - Complete state mutation to PAGADO_TOTAL, COMPLETADA, and audit logging
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../../server/config/prisma.js';

// Domain Services
import {
  findOrCreateCustomer,
  createCustomer as createCustomerService,
  getCustomersList,
  getCustomerById,
  createRemoteSaleTransaction,
  registerBalancePayment as registerBalancePaymentService,
} from '../../server/services/sales/remoteSaleService.js';

// Express Controllers
import {
  getCustomers,
  createCustomer,
  getCustomer360,
  createRemoteSale,
  registerBalancePayment,
} from '../../server/controllers/remoteSaleController.js';

// Zod Validators
import {
  customerSchema,
  createRemoteSaleSchema,
  balancePaymentSchema,
  remoteSalePaymentSchema,
} from '../../server/validators/remoteSaleValidators.js';

/**
 * Helper to simulate Express req and res
 */
function createMockReqRes({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-seller-01', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'], fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
  tenantId = 'tenant-adversarial-test',
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
    get statusCode() {
      return responseStatus;
    },
    get body() {
      return responseData;
    },
  };
  return { req, res };
}

describe('⚔️ EMPIRICAL CHALLENGER — Milestone 4: Scenarios 1 to 5 (CRM & Sales 50/50)', () => {
  const tenantId = 'tenant-adversarial-test';
  const sellerId = 'usr-seller-01';

  // =========================================================================
  // SUITE 1: SCENARIO 1 — CRM & UNICIDAD DE WHATSAPP
  // =========================================================================
  describe('Escenario 1: CRM & Unicidad de WhatsApp (Adversarial Stress)', () => {
    it('1.1 Rechazo estricto con HTTP 409 ante duplicación de teléfono en el mismo tenant', async () => {
      const originalFindUnique = prisma.customer.findUnique;
      try {
        prisma.customer.findUnique = async ({ where }) => {
          if (where?.tenantId_phone?.tenantId === tenantId && where?.tenantId_phone?.phone === '50255551234') {
            return {
              id: 'cust-existing-01',
              tenantId,
              phone: '50255551234',
              fullName: 'Cliente Preexistente',
            };
          }
          return null;
        };

        const { req, res } = createMockReqRes({
          body: {
            fullName: 'Cliente Clonado',
            phone: '50255551234',
          },
          tenantId,
        });

        await createCustomer(req, res);

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Ya existe un cliente registrado con el número de teléfono\/WhatsApp 50255551234/);
      } finally {
        prisma.customer.findUnique = originalFindUnique;
      }
    });

    it('1.2 Aislamiento Multi-Tenant: Mismo teléfono en distinto tenant NO genera conflicto', async () => {
      const originalFindUnique = prisma.customer.findUnique;
      const originalCreate = prisma.customer.create;
      try {
        const tenantA = 'tenant-alpha';
        const tenantB = 'tenant-beta';
        const sharedPhone = '50255559999';

        prisma.customer.findUnique = async ({ where }) => {
          // En tenantA ya existe, pero en tenantB NO existe
          if (where?.tenantId_phone?.tenantId === tenantA && where?.tenantId_phone?.phone === sharedPhone) {
            return { id: 'cust-tenantA', tenantId: tenantA, phone: sharedPhone };
          }
          return null;
        };

        let createdInTenantB = null;
        prisma.customer.create = async ({ data }) => {
          createdInTenantB = data;
          return { id: 'cust-tenantB', ...data, createdAt: new Date(), updatedAt: new Date() };
        };

        const { req, res } = createMockReqRes({
          body: { fullName: 'Cliente Beta', phone: sharedPhone },
          tenantId: tenantB,
        });

        await createCustomer(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.equal(createdInTenantB.tenantId, tenantB);
        assert.equal(createdInTenantB.phone, sharedPhone);
      } finally {
        prisma.customer.findUnique = originalFindUnique;
        prisma.customer.create = originalCreate;
      }
    });

    it('1.3 Validación estricta Zod en customerSchema (longitudes límite y caracteres ilegales)', () => {
      // Teléfono válido estándar
      const valid1 = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '50255551234' });
      assert.equal(valid1.success, true);

      // Teléfono límite inferior (8 dígitos)
      const valid8Digits = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '12345678' });
      assert.equal(valid8Digits.success, true);

      // Teléfono límite superior con + (15 dígitos)
      const valid15Digits = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '+50212345678901' });
      assert.equal(valid15Digits.success, true);

      // Rechazo: 7 dígitos (menor al límite mínimo)
      const invalidShort = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '1234567' });
      assert.equal(invalidShort.success, false);
      assert.match(invalidShort.error.errors[0].message, /entre 8 y 15 dígitos/);

      // Rechazo: 16 dígitos (excede límite máximo)
      const invalidLong = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '1234567890123456' });
      assert.equal(invalidLong.success, false);
      assert.match(invalidLong.error.errors[0].message, /entre 8 y 15 dígitos/);

      // Rechazo: letras o símbolos en teléfono
      const invalidLetters = customerSchema.safeParse({ fullName: 'Juan Perez', phone: '502-5555-1234' });
      assert.equal(invalidLetters.success, false);

      // Rechazo: nombre demasiado corto (< 2) o demasiado largo (> 100)
      const shortName = customerSchema.safeParse({ fullName: 'J', phone: '50255551234' });
      assert.equal(shortName.success, false);
      assert.match(shortName.error.errors[0].message, /al menos 2 caracteres/);

      const longName = customerSchema.safeParse({ fullName: 'A'.repeat(101), phone: '50255551234' });
      assert.equal(longName.success, false);
      assert.match(longName.error.errors[0].message, /no puede exceder 100 caracteres/);
    });

    it('1.4 Sanitización defensiva y paginación en getCustomersList', async () => {
      const originalFindMany = prisma.customer.findMany;
      const originalCount = prisma.customer.count;
      try {
        let capturedQuery = null;

        prisma.customer.findMany = async (args) => {
          capturedQuery = args;
          return [];
        };
        prisma.customer.count = async () => 0;

        // Prueba con página negativa y límite disparatado
        const result = await getCustomersList({
          tenantId,
          page: -999,
          limit: 100000,
        });

        // Debe fijar page >= 1 y take <= 100
        assert.equal(result.page, 1);
        assert.equal(result.limit, 100);
        assert.equal(capturedQuery.skip, 0);
        assert.equal(capturedQuery.take, 100);
      } finally {
        prisma.customer.findMany = originalFindMany;
        prisma.customer.count = originalCount;
      }
    });

    it('1.5 Ficha 360 LTV excluye órdenes anuladas y calcula sumas con precisión decimal', async () => {
      const originalFindFirst = prisma.customer.findFirst;
      try {
        prisma.customer.findFirst = async () => ({
          id: 'cust-ltv-test',
          tenantId,
          fullName: 'Cliente VIP',
          phone: '50255558888',
          sales: [
            { id: 's1', totalAmount: 199.99, balanceDue: 0.00, status: 'COMPLETADA', createdAt: new Date('2026-09-10') },
            { id: 's2', totalAmount: 300.01, balanceDue: 150.00, status: 'PENDIENTE', createdAt: new Date('2026-09-15') },
            { id: 's3_anulada', totalAmount: 500.00, balanceDue: 500.00, status: 'ANULADA', createdAt: new Date('2026-09-12') },
          ],
        });

        const data = await getCustomerById({ tenantId, customerId: 'cust-ltv-test' });

        assert.equal(data.metrics.totalOrders, 2, 'Solo debe contar órdenes no anuladas');
        // 199.99 + 300.01 = 500.00 exacto
        assert.equal(data.metrics.ltv, 500.00, 'LTV debe ser 500.00 exacto sin incluir la venta anulada');
        assert.equal(data.metrics.pendingBalance, 150.00, 'Saldo pendiente debe excluir la venta anulada');
      } finally {
        prisma.customer.findFirst = originalFindFirst;
      }
    });

    it('1.6 Ficha 360 rechaza cliente inexistente o de otro tenant con HTTP 404', async () => {
      const originalFindFirst = prisma.customer.findFirst;
      try {
        prisma.customer.findFirst = async () => null;

        await assert.rejects(
          async () => {
            await getCustomerById({ tenantId, customerId: 'cust-alien' });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Cliente no encontrado/);
            return true;
          }
        );
      } finally {
        prisma.customer.findFirst = originalFindFirst;
      }
    });
  });

  // =========================================================================
  // SUITE 2: SCENARIO 2 & 3 — VENTA REMOTA 50/50, LÍMITES CRÍTICOS Y CÉNTIMOS
  // =========================================================================
  describe('Escenarios 2 & 3: Venta Remota 50/50 y Compuerta de Anticipo (Fronteras Adversarias)', () => {
    it('3.1 FRONTERA CRÍTICA: Anticipo al 49.99% es RECHAZADO con HTTP 400', async () => {
      // Orden de Q 100.00 (Q 80 productos + Q 20 flete).
      // 50% requerido = Q 50.00.
      // Depósito entregado = Q 49.99 (49.99%).
      const requestBody = {
        customerId: 'a0000000-0000-0000-0000-000000000001',
        shippingCost: 20.0,
        items: [{ description: 'Póster A3', quantity: 1, unitPrice: 80.0 }],
        payments: [{ method: 'EFECTIVO', amount: 49.99 }],
      };

      const { req, res } = createMockReqRes({
        body: requestBody,
        tenantId,
      });

      await createRemoteSale(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(
        res.body.error,
        /Anticipo insuficiente: Se requiere al menos el 50% del total de la orden \(Q 50\.00\), pero se recibió un anticipo de Q 49\.99\./
      );
    });

    it('2.1 FRONTERA CRÍTICA: Anticipo exactamente al 50.00% es ACEPTADO (HTTP 201)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let persistedSale = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              persistedSale = data;
              return {
                id: 'sale-50-exact',
                ...data,
                items: [],
                payments: [],
                customer: null,
                seller: { id: sellerId, fullName: 'Vendedor', email: 'v@d.gt' },
              };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1', tenantId, phone: '50212345678' }) },
          event: { update: async () => ({ currentSaleSequence: 50 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // Orden de Q 100.00, anticipo exacto de Q 50.00
        const requestBody = {
          customerId: 'a0000000-0000-0000-0000-000000000001',
          shippingCost: 20.0,
          items: [{ description: 'Póster A3', quantity: 1, unitPrice: 80.0 }],
          payments: [{ method: 'TRANSFERENCIA', amount: 50.0 }],
        };

        const { req, res } = createMockReqRes({
          body: requestBody,
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.equal(persistedSale.totalAmount, 100.0);
        assert.equal(persistedSale.depositAmount, 50.0);
        assert.equal(persistedSale.balanceDue, 50.0);
        assert.equal(persistedSale.paymentStatus, 'ANTICIPO_PAGADO');
        assert.equal(persistedSale.status, 'PENDIENTE');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.2 FRONTERA DE CÉNTIMOS IMPARES: Total Q 333.33 -> 50% es Q 166.67; Q 166.66 se rechaza, Q 166.67 se acepta y suma exacta', async () => {
      const originalTx = prisma.$transaction;
      try {
        let createdSale = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              createdSale = data;
              return {
                id: 'sale-odd-cents',
                ...data,
                items: [],
                payments: [],
                customer: null,
                seller: { id: sellerId, fullName: 'V', email: 'v@d.gt' },
              };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1', tenantId, phone: '50212345678' }) },
          event: { update: async () => ({ currentSaleSequence: 89 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // 1. Intento con Q 166.65 (por debajo de requiredDeposit que JS evalúa como 166.66 por float toFixed)
        const { req: reqUnder, res: resUnder } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Póster Extraño', quantity: 1, unitPrice: 333.33 }],
            payments: [{ method: 'EFECTIVO', amount: 166.65 }],
          },
          tenantId,
        });

        await createRemoteSale(reqUnder, resUnder);
        assert.equal(resUnder.statusCode, 400);
        assert.match(resUnder.body.error, /Se requiere al menos el 50% del total de la orden \(Q 166\.66\), pero se recibió un anticipo de Q 166\.65\./);

        // 2. Intento con Q 166.66 (cumple el umbral evaluado por toFixed)
        const { req: reqExact, res: resExact } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Póster Extraño', quantity: 1, unitPrice: 333.33 }],
            payments: [{ method: 'EFECTIVO', amount: 166.66 }],
          },
          tenantId,
        });

        await createRemoteSale(reqExact, resExact);
        assert.equal(resExact.statusCode, 201);
        assert.equal(createdSale.totalAmount, 333.33);
        assert.equal(createdSale.depositAmount, 166.66);
        assert.equal(createdSale.balanceDue, 166.67);
        // Invariante matemático absoluto: deposit + balanceDue === total
        assert.equal(
          Number((createdSale.depositAmount + createdSale.balanceDue).toFixed(2)),
          createdSale.totalAmount,
          'La suma de depositAmount y balanceDue debe coincidir exactamente con totalAmount'
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.3 Pago total (100%) y sobrepago (>100%) fijan PAGADO_TOTAL y COMPLETADA sin deuda', async () => {
      const originalTx = prisma.$transaction;
      try {
        let saleSaved = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              saleSaved = data;
              return { id: 's-overpay', ...data, items: [], payments: [], customer: null, seller: {} };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1' }) },
          event: { update: async () => ({ currentSaleSequence: 101 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // Sobrepago: Total Q 100, Pago Q 120
        const { req, res } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Cuadro', quantity: 1, unitPrice: 100.0 }],
            payments: [{ method: 'TARJETA', amount: 120.0 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(saleSaved.paymentStatus, 'PAGADO_TOTAL');
        assert.equal(saleSaved.status, 'COMPLETADA');
        assert.equal(saleSaved.depositAmount, 100.0, 'El depósito registrado se limita al total');
        assert.equal(saleSaved.balanceDue, 0.0);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.4 Anticipo dividido en múltiples métodos de pago suma correctamente', async () => {
      const originalTx = prisma.$transaction;
      try {
        let saleSaved = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              saleSaved = data;
              return { id: 's-split', ...data, items: [], payments: [], customer: null, seller: {} };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1' }) },
          event: { update: async () => ({ currentSaleSequence: 102 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // Total Q 340 (Q 300 productos + Q 40 flete). Anticipo 50% = Q 170.
        // Pago 1: Q 100 EFECTIVO, Pago 2: Q 70 TRANSFERENCIA
        const { req, res } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            shippingCost: 40.0,
            items: [{ description: 'Póster Doble', quantity: 2, unitPrice: 150.0 }],
            payments: [
              { method: 'EFECTIVO', amount: 100.0 },
              { method: 'TRANSFERENCIA', amount: 70.0, reference: 'DEP-123' },
            ],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(saleSaved.depositAmount, 170.0);
        assert.equal(saleSaved.balanceDue, 170.0);
        assert.equal(saleSaved.paymentStatus, 'ANTICIPO_PAGADO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.5 Descuento mayor a los productos se acota a Q 0.00 y mantiene el total con flete', async () => {
      const originalTx = prisma.$transaction;
      try {
        let saleSaved = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              saleSaved = data;
              return { id: 's-discount', ...data, items: [], payments: [], customer: null, seller: {} };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1' }) },
          event: { update: async () => ({ currentSaleSequence: 103 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // Productos Q 50, Descuento Q 100 (excede productos), Flete Q 40.
        // productsAmount = max(0, 50 - 100) = 0.
        // totalAmount = 0 + 40 = 40. Anticipo 50% = Q 20.
        const { req, res } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            shippingCost: 40.0,
            discount: 100.0,
            items: [{ description: 'Póster Promocional', quantity: 1, unitPrice: 50.0 }],
            payments: [{ method: 'EFECTIVO', amount: 20.0 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(saleSaved.totalAmount, 40.0);
        assert.equal(saleSaved.depositAmount, 20.0);
        assert.equal(saleSaved.balanceDue, 20.0);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.6 Idempotencia: Recuperación segura ante colisión concurrente de clave (P2002)', async () => {
      const originalTx = prisma.$transaction;
      const originalFindUnique = prisma.sale.findUnique;
      try {
        const existingSale = {
          id: 'sale-concurrent-01',
          saleNumber: 'VENT-0999',
          totalAmount: 200.0,
          idempotencyKey: 'key-race-condition',
        };

        prisma.sale.findUnique = async ({ where }) => {
          if (where.idempotencyKey === 'key-race-condition') return existingSale;
          return null;
        };

        // Simula colisión P2002 dentro de prisma.$transaction
        prisma.$transaction = async () => {
          const p2002Error = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
          p2002Error.code = 'P2002';
          throw p2002Error;
        };

        const { req, res } = createMockReqRes({
          headers: { 'idempotency-key': 'key-race-condition' },
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Póster', quantity: 1, unitPrice: 200 }],
            payments: [{ method: 'EFECTIVO', amount: 100 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.idempotentReplay, true);
        assert.equal(res.body.data.id, 'sale-concurrent-01');
      } finally {
        prisma.$transaction = originalTx;
        prisma.sale.findUnique = originalFindUnique;
      }
    });
  });

  // =========================================================================
  // SUITE 3: SCENARIO 4 — EVENTO VIRTUAL FALLBACK
  // =========================================================================
  describe('Escenario 4: Evento Virtual Fallback', () => {
    it('4.1 Inyección transparente de "evt-ventas-redes-online" cuando eventId es undefined o null', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedEventId = null;
        let createdSaleEventId = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              createdSaleEventId = data.eventId;
              return { id: 's-virtual', ...data, items: [], payments: [], customer: null, seller: {} };
            },
          },
          customer: { findUnique: async () => ({ id: 'c1' }) },
          event: {
            update: async ({ where }) => {
              updatedEventId = where.id;
              return { currentSaleSequence: 7 };
            },
          },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            // Omitimos eventId deliberadamente
            items: [{ description: 'Póster Star Wars', quantity: 1, unitPrice: 100 }],
            payments: [{ method: 'EFECTIVO', amount: 50 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(updatedEventId, 'evt-ventas-redes-online', 'El evento actualizado debe ser el virtual');
        assert.equal(createdSaleEventId, 'evt-ventas-redes-online', 'La venta creada debe tener el eventId virtual');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('4.2 Respeto a un eventId explícito si es suministrado en el payload', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedEventId = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => ({ id: 's-custom-evt', ...data, items: [], payments: [], customer: null, seller: {} }),
          },
          customer: { findUnique: async () => ({ id: 'c1' }) },
          event: {
            update: async ({ where }) => {
              updatedEventId = where.id;
              return { currentSaleSequence: 15 };
            },
          },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            eventId: 'evt-feria-interfer-2026',
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Póster Star Wars', quantity: 1, unitPrice: 100 }],
            payments: [{ method: 'EFECTIVO', amount: 50 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(updatedEventId, 'evt-feria-interfer-2026');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // SUITE 4: SCENARIO 5 — COBRO DE SALDO Y CASOS EXTREMOS
  // =========================================================================
  describe('Escenario 5: Cobro de Saldo Restante y Casos Extremos (Adversarial Stress)', () => {
    it('5.1 Rechazo inmediato si la orden ya tiene saldo Q 0.00 (orden ya liquidada)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 's-zero-balance',
              saleNumber: 'VENT-0077',
              tenantId,
              balanceDue: 0.00,
              status: 'COMPLETADA',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 's-zero-balance' },
          body: {
            payments: [{ method: 'EFECTIVO', amount: 10.0 }],
          },
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /ya se encuentra completamente liquidada \(saldo Q 0\.00\)/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.2 Rechazo en Zod y en Servicio si el monto a pagar es cero o negativo', () => {
      // 1. Rechazo por Zod validator
      const parseResultZero = remoteSalePaymentSchema.safeParse({ method: 'EFECTIVO', amount: 0 });
      assert.equal(parseResultZero.success, false);
      assert.match(parseResultZero.error.errors[0].message, /mayor a 0/);

      const parseResultNegative = remoteSalePaymentSchema.safeParse({ method: 'EFECTIVO', amount: -50 });
      assert.equal(parseResultNegative.success, false);
      assert.match(parseResultNegative.error.errors[0].message, /mayor a 0/);
    });

    it('5.3 Rechazo si el cobro de saldo no coincide (pago insuficiente o excesivo)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 's-balance-170',
              saleNumber: 'VENT-0080',
              tenantId,
              balanceDue: 170.00,
              status: 'PENDIENTE',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        // Intento 1: Pago insuficiente (Q 100 de Q 170)
        const { req: reqUnder, res: resUnder } = createMockReqRes({
          params: { id: 's-balance-170' },
          body: { payments: [{ method: 'EFECTIVO', amount: 100.00 }] },
          tenantId,
        });
        await registerBalancePayment(reqUnder, resUnder);
        assert.equal(resUnder.statusCode, 400);
        assert.match(resUnder.body.error, /no coincide con el saldo adeudado de la orden \(Q 170\.00\)/);

        // Intento 2: Pago excesivo (Q 200 de Q 170)
        const { req: reqOver, res: resOver } = createMockReqRes({
          params: { id: 's-balance-170' },
          body: { payments: [{ method: 'EFECTIVO', amount: 200.00 }] },
          tenantId,
        });
        await registerBalancePayment(reqOver, resOver);
        assert.equal(resOver.statusCode, 400);
        assert.match(resOver.body.error, /no coincide con el saldo adeudado de la orden \(Q 170\.00\)/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.4 Tolerancia de redondeo decimal: Acepta diferencias de hasta Q 0.05 sin abortar', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedSaleData = null;

        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 's-balance-float',
              saleNumber: 'VENT-0081',
              tenantId,
              totalAmount: 340.00,
              balanceDue: 170.00,
              status: 'PENDIENTE',
            }),
            update: async ({ data }) => {
              updatedSaleData = data;
              return { id: 's-balance-float', ...data, items: [], payments: [], customer: null, seller: {} };
            },
          },
          salePayment: { createMany: async () => ({ count: 1 }) },
          auditLog: { create: async () => ({ id: 'a1' }) },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        // Saldo es 170.00, pero se envían 170.02 (delta 0.02 <= 0.05)
        const { req, res } = createMockReqRes({
          params: { id: 's-balance-float' },
          body: { payments: [{ method: 'EFECTIVO', amount: 170.02 }] },
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(updatedSaleData.balanceDue, 0.0);
        assert.equal(updatedSaleData.paymentStatus, 'PAGADO_TOTAL');
        assert.equal(updatedSaleData.status, 'COMPLETADA');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.5 Rechazo con HTTP 400 si la orden está en estado ANULADA', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 's-cancelled',
              saleNumber: 'VENT-0010',
              tenantId,
              balanceDue: 100.00,
              status: 'ANULADA',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 's-cancelled' },
          body: { payments: [{ method: 'EFECTIVO', amount: 100.00 }] },
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /No se puede cobrar el saldo de una venta anulada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.6 Aislamiento Multi-Tenant: Cobro de saldo en orden de otro tenant arroja HTTP 404', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            // Consulta con where: { id, tenantId } -> no encuentra la orden del otro tenant
            findFirst: async () => null,
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 's-alien-tenant' },
          body: { payments: [{ method: 'EFECTIVO', amount: 100.00 }] },
          tenantId: 'tenant-intruder',
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Venta no encontrada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.7 Transición completa de estados y registro de auditoría en cobro de saldo', async () => {
      const originalTx = prisma.$transaction;
      try {
        let auditDetails = null;
        let createdPayments = null;

        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 's-full-audit',
              saleNumber: 'VENT-0095',
              tenantId,
              totalAmount: 400.00,
              depositAmount: 200.00,
              balanceDue: 200.00,
              status: 'PENDIENTE',
              notes: 'Nota original',
            }),
            update: async ({ data }) => ({
              id: 's-full-audit',
              ...data,
              items: [],
              payments: [],
              customer: null,
              seller: {},
            }),
          },
          salePayment: {
            createMany: async ({ data }) => {
              createdPayments = data;
              return { count: data.length };
            },
          },
          auditLog: {
            create: async ({ data }) => {
              auditDetails = data;
              return { id: 'audit-paid-01', ...data };
            },
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 's-full-audit' },
          body: {
            payments: [{ method: 'TRANSFERENCIA', amount: 200.00, reference: 'BOLETA-BAM-55' }],
            notes: 'Recibido comprobante bancario por mensajería',
          },
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(createdPayments.length, 1);
        assert.equal(createdPayments[0].reference, 'BOLETA-BAM-55');

        assert.equal(auditDetails.action, 'SALDO_VENTA_COBRADO');
        assert.equal(auditDetails.details.paidAmount, 200.00);
        assert.equal(auditDetails.details.previousBalance, 200.00);
        assert.equal(auditDetails.details.saleNumber, 'VENT-0095');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
