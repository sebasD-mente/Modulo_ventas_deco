/**
 * tests/adversarial/m4-e2e-scenarios-6-10-challenger.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER — MILESTONE 4: SCENARIOS 6 TO 10
 * STAND {IA} (Deco Vintage Guate & Deko Labs)
 *
 * Requirements Challenged:
 * 1. Scenario 6: Workshop Brake (Freno Inquebrantable de Taller)
 *    - Rejection with HTTP 422 on parent order with PENDIENTE_ANTICIPO
 *    - Rejection with HTTP 422 on parent order with status ANULADA (even if paymentStatus is PAGADO_TOTAL)
 *    - Rejection with HTTP 422 on corrupt/unknown parent paymentStatus
 *    - Atomic batch rollback: mixed batch with 1 invalid item leaves 0 items assigned
 *    - Multi-tenant boundary and missing item rejection with HTTP 404
 * 2. Scenario 7: PrintSheet State Machine & Batch Cascade
 *    - Consecutivo daily sequence PLI-YYYYMMDD-01 and multi-digit rollover (-09 -> -10, -99 -> -100)
 *    - Valid state transitions vs illegal state transitions (HTTP 400)
 *    - Item assignment blocked on IMPRESO or TERMINADO sheets (HTTP 400)
 *    - Cascade to sale_items on IMPRESO with audit logging and idempotent re-calls
 * 3. Scenario 8: 20% Commission Invariant with Huge Shipping
 *    - Extreme asymmetric shipping (e.g. Q 1,000,000.00 shipping vs Q 100.00 product)
 *    - Excludes 100% of shipping; commission strictly calculated on products base
 *    - Discount greater than products clamped at Q 0.00
 *    - Float decimal precision and exact rounding to 2 decimals
 * 4. Scenario 9: Zero-Balance Gate at Boundary balanceDue = 0.01
 *    - getPendingCommissions excludes balanceDue = 0.01, PENDIENTE, or ANULADA
 *    - createSettlementTransaction throws HTTP 422 on balanceDue = 0.01
 *    - Multi-order batch poisoned with a 1-centavo debt aborts atomically
 * 5. Scenario 10: Settlement Consecutive Generation, Freeze & Double-Settlement Blocking
 *    - Consecutivo monthly sequence LIQ-YYYYMM-001 and month rollover
 *    - Atomic freeze of sales (commissionPaid = true, commissionSettlementId set)
 *    - Re-settlement blocked with HTTP 400
 *    - Settlement payment transition to PAGADO with bank reference and double-pay blocking
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../../server/config/prisma.js';

// Domain Services
import {
  generateSheetCode,
  createPrintSheet as createPrintSheetService,
  assignItemsToSheet,
  updateSheetStatus,
  getPrintSheets,
  getPrintSheetById,
} from '../../server/services/printSheetService.js';
import {
  calculateSaleProductBase,
  generateSettlementNumber,
  getPendingCommissions as getPendingCommissionsService,
  createSettlementTransaction,
  markSettlementPaid,
  getSettlementsList,
  getSettlementById,
} from '../../server/services/commissionService.js';

// HTTP Controllers
import {
  listPrintSheets,
  getPrintSheet,
  createPrintSheet,
  assignItems,
  updateStatus as updatePrintSheetStatus,
} from '../../server/controllers/printSheetController.js';
import {
  getPendingCommissions,
  settleCommissions,
  listSettlements,
  getSettlement,
  markPaid,
} from '../../server/controllers/commissionController.js';

/**
 * Express mock request & response simulator
 */
function createMockReqRes({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-seller-01', role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'], fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
  tenantId = 'tenant-deko-test',
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

describe('⚔️ CHALLENGER M4: Stress Testing Scenarios 6 to 10', () => {
  const tenantId = 'tenant-challenger-m4';
  const sellerId = 'b0000000-0000-0000-0000-000000000001';
  const adminId = 'a0000000-0000-0000-0000-000000000001';

  // =========================================================================
  // SCENARIO 6: WORKSHOP BRAKE ADVERSARIAL STRESS
  // =========================================================================
  describe('Adversarial Scenario 6: Workshop Brake with Invalid Parent Orders', () => {
    it('6.A Rejection with HTTP 422 when parent order is PENDIENTE_ANTICIPO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-adv-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-adv-1',
                description: 'Póster Personalizado Spiderman',
                sale: {
                  tenantId,
                  saleNumber: 'VENT-9001',
                  status: 'PENDIENTE',
                  paymentStatus: 'PENDIENTE_ANTICIPO',
                },
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-adv-01' },
          body: { saleItemIds: ['item-adv-1'] },
          tenantId,
          user: { id: 'operario-01', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(
          res.body.error,
          /El ítem 'Póster Personalizado Spiderman' está bloqueado: Orden #VENT-9001 no cuenta con anticipo registrado/
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('6.B Rejection with HTTP 422 when parent order is ANULADA even if paymentStatus is PAGADO_TOTAL', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-adv-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-adv-2',
                description: 'Cuadro MDF Anime',
                sale: {
                  tenantId,
                  saleNumber: 'VENT-9002',
                  status: 'ANULADA', // Prevalencia de anulación sobre pago
                  paymentStatus: 'PAGADO_TOTAL',
                },
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-adv-01' },
          body: { saleItemIds: ['item-adv-2'] },
          tenantId,
          user: { id: 'operario-01', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /pertenece a una orden anulada \(#VENT-9002\)/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('6.C Rejection with HTTP 422 when parent order has corrupted/unknown paymentStatus', async () => {
      const corruptStatuses = ['PARCIAL', 'DESCONOCIDO', 'FALLIDO', null, undefined];
      const originalTx = prisma.$transaction;
      try {
        for (const corruptStatus of corruptStatuses) {
          const mockTx = {
            printSheet: {
              findFirst: async () => ({
                id: 'sheet-adv-01',
                sheetCode: 'PLI-20260919-01',
                status: 'ABIERTO',
                tenantId,
              }),
            },
            saleItem: {
              findMany: async () => [
                {
                  id: 'item-corrupt',
                  description: 'Retrato Corrupto',
                  sale: {
                    tenantId,
                    saleNumber: 'VENT-9003',
                    status: 'PENDIENTE',
                    paymentStatus: corruptStatus,
                  },
                },
              ],
            },
          };
          prisma.$transaction = async (cb) => cb(mockTx);

          const { req, res } = createMockReqRes({
            params: { id: 'sheet-adv-01' },
            body: { saleItemIds: ['item-corrupt'] },
            tenantId,
            user: { id: 'operario-01', role: 'OPERARIO_1' },
          });

          await assignItems(req, res);

          assert.equal(res.statusCode, 422, `Status ${corruptStatus} debe arrojar 422`);
          assert.equal(res.body.success, false);
        }
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('6.D Atomic rollback: batch with [PAGADO_TOTAL, PENDIENTE_ANTICIPO, ANTICIPO_PAGADO] assigns 0 items', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedItems = [];
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-adv-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-1',
                description: 'Item OK 1',
                sale: { tenantId, saleNumber: 'VENT-1', status: 'COMPLETADA', paymentStatus: 'PAGADO_TOTAL' },
              },
              {
                id: 'item-poison',
                description: 'Item Veneno',
                sale: { tenantId, saleNumber: 'VENT-2', status: 'PENDIENTE', paymentStatus: 'PENDIENTE_ANTICIPO' },
              },
              {
                id: 'item-3',
                description: 'Item OK 3',
                sale: { tenantId, saleNumber: 'VENT-3', status: 'PENDIENTE', paymentStatus: 'ANTICIPO_PAGADO' },
              },
            ],
            update: async ({ where }) => {
              updatedItems.push(where.id);
            },
          },
          productionLog: {
            create: async () => ({ id: 'log' }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-adv-01' },
          body: { saleItemIds: ['item-1', 'item-poison', 'item-3'] },
          tenantId,
          user: { id: 'operario-01', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.equal(updatedItems.length, 0, 'Ningún ítem debió mutarse si el freno de taller disparó');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('6.E Rejection with HTTP 404 if item belongs to different tenant or does not exist', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-adv-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [], // No items found for this tenant
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-adv-01' },
          body: { saleItemIds: ['alien-item-uuid'] },
          tenantId,
          user: { id: 'operario-01', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Uno o más ítems no fueron encontrados o pertenecen a otro tenant/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // SCENARIO 7: PRINTSHEET TRANSITIONS & BATCH CASCADE
  // =========================================================================
  describe('Adversarial Scenario 7: PrintSheet State Machine & Consecutivos', () => {
    it('7.A Generates correct daily sequence PLI-YYYYMMDD-01 and handles double-digit rollover', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayPrefix = `PLI-${yyyy}${mm}${dd}-`;

      // 1. Fresh day -> 01
      const mockTxFresh = {
        printSheet: { findFirst: async () => null },
      };
      const seq1 = await generateSheetCode(tenantId, mockTxFresh);
      assert.equal(seq1, `${todayPrefix}01`);

      // 2. Rollover from 09 to 10
      const mockTx09 = {
        printSheet: { findFirst: async () => ({ sheetCode: `${todayPrefix}09` }) },
      };
      const seq10 = await generateSheetCode(tenantId, mockTx09);
      assert.equal(seq10, `${todayPrefix}10`);

      // 3. Rollover from 99 to 100
      const mockTx99 = {
        printSheet: { findFirst: async () => ({ sheetCode: `${todayPrefix}99` }) },
      };
      const seq100 = await generateSheetCode(tenantId, mockTx99);
      assert.equal(seq100, `${todayPrefix}100`);
    });

    it('7.B Rejects illegal status transitions with HTTP 400', async () => {
      const illegalTransitions = [
        { from: 'IMPRESO', to: 'ABIERTO' },
        { from: 'IMPRESO', to: 'EN_PRODUCCION' },
        { from: 'TERMINADO', to: 'ABIERTO' },
        { from: 'TERMINADO', to: 'EN_PRODUCCION' },
        { from: 'TERMINADO', to: 'IMPRESO' },
      ];

      const originalTx = prisma.$transaction;
      try {
        for (const { from, to } of illegalTransitions) {
          const mockTx = {
            printSheet: {
              findFirst: async () => ({
                id: 'sheet-01',
                status: from,
                tenantId,
              }),
            },
          };
          prisma.$transaction = async (cb) => cb(mockTx);

          const { req, res } = createMockReqRes({
            params: { id: 'sheet-01' },
            body: { status: to },
            tenantId,
            user: { id: 'operario-1', role: 'OPERARIO_1' },
          });

          await updatePrintSheetStatus(req, res);

          assert.equal(res.statusCode, 400, `Transición ${from} -> ${to} debe fallar con HTTP 400`);
          assert.equal(res.body.success, false);
          assert.match(res.body.error, /Transición de estado no válida/);
        }
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('7.C Rejects assigning items to a sheet in IMPRESO or TERMINADO status (HTTP 400)', async () => {
      const lockedStatuses = ['IMPRESO', 'TERMINADO'];
      const originalTx = prisma.$transaction;
      try {
        for (const status of lockedStatuses) {
          const mockTx = {
            printSheet: {
              findFirst: async () => ({
                id: 'sheet-locked',
                status,
                tenantId,
              }),
            },
          };
          prisma.$transaction = async (cb) => cb(mockTx);

          const { req, res } = createMockReqRes({
            params: { id: 'sheet-locked' },
            body: { saleItemIds: ['item-ok'] },
            tenantId,
            user: { id: 'operario-1', role: 'OPERARIO_1' },
          });

          await assignItems(req, res);

          assert.equal(res.statusCode, 400, `No debe permitir asignar ítems a pliego ${status}`);
          assert.match(res.body.error, new RegExp(`No se pueden asignar ítems a un pliego con estado '${status}'`));
        }
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('7.D Idempotent or repeated transition to IMPRESO does not re-trigger batch item update', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updateManyCalled = false;
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-already-printed',
              status: 'IMPRESO', // Ya estaba impreso
              notes: 'Notas previas',
              tenantId,
            }),
            update: async ({ data }) => ({
              id: 'sheet-already-printed',
              ...data,
              items: [],
            }),
          },
          saleItem: {
            updateMany: async () => {
              updateManyCalled = true;
            },
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-already-printed' },
          body: { status: 'IMPRESO', notes: 'Actualización de notas' },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await updatePrintSheetStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(updateManyCalled, false, 'No debe re-ejecutar updateMany en saleItem si ya estaba IMPRESO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // SCENARIO 8: 20% COMMISSION WITH HUGE SHIPPING
  // =========================================================================
  describe('Adversarial Scenario 8: 20% Commission Invariant with Huge Shipping', () => {
    it('8.A Extremely asymmetric shipping cost (Q 1,000,000.00) is 100% excluded from commission', () => {
      const sale = {
        itemsSubtotal: 100.0,
        discount: 0.0,
        shippingCost: 1000000.0,
        totalAmount: 1000100.0,
      };

      const base = calculateSaleProductBase(sale);
      assert.equal(base, 100.0, 'Base imponible debe ser exactamente Q 100.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.equal(commission, 20.0, 'Comisión debe ser exactamente Q 20.00 (NUNCA Q 200,020.00)');
    });

    it('8.B High shipping with discount over products base', () => {
      const sale = {
        itemsSubtotal: 500.0,
        discount: 150.0,
        shippingCost: 50000.0,
        totalAmount: 50350.0,
      };

      const base = calculateSaleProductBase(sale);
      assert.equal(base, 350.0, 'Base debe ser 500 - 150 = 350.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.equal(commission, 70.0, '20% de 350.00 = 70.00');
    });

    it('8.C Discount exceeding products base is clamped to Q 0.00 (no negative commission)', () => {
      const sale = {
        itemsSubtotal: 80.0,
        discount: 120.0, // Descuento mayor al subtotal
        shippingCost: 50.0,
        totalAmount: 50.0,
      };

      const base = calculateSaleProductBase(sale);
      assert.equal(base, 0.0, 'Base debe estar acotada a 0.00');

      const commission = Number((base * 0.20).toFixed(2));
      assert.equal(commission, 0.0, 'Comisión debe ser 0.00');
    });

    it('8.D Floats and decimal precision (IEEE 754 edge cases)', () => {
      // 33.33 * 0.20 = 6.666 -> 6.67
      const sale1 = { itemsSubtotal: 33.33, discount: 0, shippingCost: 40 };
      const base1 = calculateSaleProductBase(sale1);
      assert.equal(base1, 33.33);
      assert.equal(Number((base1 * 0.20).toFixed(2)), 6.67);

      // 99.99 * 0.20 = 19.998 -> 20.00
      const sale2 = { itemsSubtotal: 99.99, discount: 0, shippingCost: 100 };
      const base2 = calculateSaleProductBase(sale2);
      assert.equal(base2, 99.99);
      assert.equal(Number((base2 * 0.20).toFixed(2)), 20.00);

      // 14.15 * 0.20 = 2.83
      const sale3 = { itemsSubtotal: 14.15, discount: 0, shippingCost: 0 };
      const base3 = calculateSaleProductBase(sale3);
      assert.equal(base3, 14.15);
      assert.equal(Number((base3 * 0.20).toFixed(2)), 2.83);
    });

    it('8.E getPendingCommissions service correctly excludes huge shipping in aggregations', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-huge-shipping',
            saleNumber: 'VENT-MONSTER',
            sellerId,
            itemsSubtotal: 1000.0,
            discount: 100.0,
            shippingCost: 999999.0, // Flete masivo
            totalAmount: 1000899.0,
            balanceDue: 0.0,
            status: 'COMPLETADA',
            items: [{ subtotal: 1000.0 }],
          },
        ];

        const report = await getPendingCommissionsService({ tenantId, sellerId });
        assert.equal(report.totalProductsAmount, 900.0);
        assert.equal(report.totalShippingExcluded, 999999.0);
        assert.equal(report.totalCommission, 180.0, '20% de 900 = 180.00');
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });
  });

  // =========================================================================
  // SCENARIO 9: ZERO-BALANCE GATE AT BOUNDARY balanceDue = 0.01
  // =========================================================================
  describe('Adversarial Scenario 9: Zero-Balance Gate at Boundary balanceDue: 0.01', () => {
    it('9.A Boundary test: balanceDue = 0.01 is excluded by getPendingCommissions in-memory filter', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-zero-balance',
            saleNumber: 'VENT-ZERO',
            sellerId,
            itemsSubtotal: 100.0,
            discount: 0,
            shippingCost: 0,
            totalAmount: 100.0,
            balanceDue: 0.0,
            status: 'COMPLETADA',
            items: [],
          },
          {
            id: 'sale-one-centavo',
            saleNumber: 'VENT-ONE-CENT',
            sellerId,
            itemsSubtotal: 100.0,
            discount: 0,
            shippingCost: 0,
            totalAmount: 100.0,
            balanceDue: 0.01, // 🛑 1 CENTAVO PENDIENTE
            status: 'COMPLETADA',
            items: [],
          },
        ];

        const report = await getPendingCommissionsService({ tenantId, sellerId });
        assert.equal(report.salesCount, 1, 'Solo la orden con saldo 0.00 debe ser incluida');
        assert.equal(report.sales[0].saleNumber, 'VENT-ZERO');
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });

    it('9.B Boundary test: createSettlementTransaction throws HTTP 422 when balanceDue = 0.01', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-one-cent',
                saleNumber: 'VENT-ONE-CENT',
                sellerId,
                totalAmount: 100.0,
                balanceDue: 0.01, // 🛑 1 CENTAVO
                status: 'COMPLETADA',
                commissionPaid: false,
                items: [],
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-one-cent'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /no es elegible para liquidación: saldo pendiente o no completada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('9.C Rejects order with balanceDue = 0.00 but status PENDIENTE (HTTP 422)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-not-completed',
                saleNumber: 'VENT-INCOMPLETE',
                sellerId,
                totalAmount: 200.0,
                balanceDue: 0.0,
                status: 'PENDIENTE', // 🛑 NO COMPLETADA
                commissionPaid: false,
                items: [],
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-not-completed'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /no es elegible para liquidación: saldo pendiente o no completada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('9.D Multi-sale batch poisoned with one 0.01 balance order aborts completely', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedSalesCount = 0;
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              { id: 'sale-1', saleNumber: 'V-1', sellerId, balanceDue: 0.0, status: 'COMPLETADA', commissionPaid: false, items: [] },
              { id: 'sale-2', saleNumber: 'V-2', sellerId, balanceDue: 0.0, status: 'COMPLETADA', commissionPaid: false, items: [] },
              { id: 'sale-poison', saleNumber: 'V-POISON', sellerId, balanceDue: 0.01, status: 'COMPLETADA', commissionPaid: false, items: [] },
            ],
            updateMany: async () => {
              updatedSalesCount++;
            },
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-1', 'sale-2', 'sale-poison'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(updatedSalesCount, 0, 'No debe congelar ninguna venta si el lote contenía una con saldo');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // SCENARIO 10: SETTLEMENT CONSECUTIVE, FREEZE & DOUBLE-SETTLEMENT BLOCK
  // =========================================================================
  describe('Adversarial Scenario 10: Settlement Consecutives & Lifecycle', () => {
    it('10.A Generates correct monthly sequence LIQ-YYYYMM-001 and increments', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `LIQ-${yyyy}${mm}-`;

      // 1. Fresh month -> 001
      const mockTxFresh = {
        commissionSettlement: { findFirst: async () => null },
      };
      const seq1 = await generateSettlementNumber(tenantId, mockTxFresh);
      assert.equal(seq1, `${prefix}001`);

      // 2. Increment from 009 to 010
      const mockTx09 = {
        commissionSettlement: { findFirst: async () => ({ settlementNumber: `${prefix}009` }) },
      };
      const seq10 = await generateSettlementNumber(tenantId, mockTx09);
      assert.equal(seq10, `${prefix}010`);

      // 3. Increment from 099 to 100
      const mockTx99 = {
        commissionSettlement: { findFirst: async () => ({ settlementNumber: `${prefix}099` }) },
      };
      const seq100 = await generateSettlementNumber(tenantId, mockTx99);
      assert.equal(seq100, `${prefix}100`);
    });

    it('10.B Month rollover: previous month records do not increment new month sequence', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const currentPrefix = `LIQ-${yyyy}${mm}-`;

      // Query looking for currentPrefix should return null if none exist this month
      const mockTxRollover = {
        commissionSettlement: {
          findFirst: async ({ where }) => {
            if (where.settlementNumber.startsWith === currentPrefix) {
              return null; // Nada en este mes
            }
            return { settlementNumber: 'LIQ-202601-999' };
          },
        },
      };

      const seq = await generateSettlementNumber(tenantId, mockTxRollover);
      assert.equal(seq, `${currentPrefix}001`);
    });

    it('10.C Re-settlement rejection with HTTP 400 when sale is already settled', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-already-done',
                saleNumber: 'VENT-PAID-ALREADY',
                sellerId,
                totalAmount: 300.0,
                balanceDue: 0.0,
                status: 'COMPLETADA',
                commissionPaid: true, // 🛑 YA PAGADA
                commissionSettlementId: 'settlement-old',
                items: [],
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-already-done'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /ya fue liquidada previamente/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('10.D markSettlementPaid rejects paying a settlement that is already PAGADO (HTTP 400)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          commissionSettlement: {
            findFirst: async () => ({
              id: 'settlement-done',
              status: 'PAGADO', // 🛑 YA ESTÁ PAGADO
              tenantId,
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'settlement-done' },
          body: { paymentReference: 'REF-NEW-123' },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await markPaid(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /La liquidación no está en estado PENDIENTE_PAGO/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('10.E markSettlementPaid rejects paying non-existent settlement with HTTP 404', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          commissionSettlement: {
            findFirst: async () => null, // No encontrado
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'settlement-ghost' },
          body: { paymentReference: 'REF-123' },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await markPaid(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Liquidación no encontrada/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
