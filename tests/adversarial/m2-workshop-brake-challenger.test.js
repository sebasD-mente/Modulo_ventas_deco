/**
 * tests/adversarial/m2-workshop-brake-challenger.test.js
 * 
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 2 (WORKSHOP BRAKE VERIFICATION)
 * 
 * Objectives:
 * 1. Empirically verify Scenario 6 of Sprint 2:
 *    - Assigning item with parent sale paymentStatus === 'PENDIENTE_ANTICIPO' FAILS with HTTP status 422.
 *    - Assigning item from an 'ANULADA' sale FAILS with HTTP status 422.
 *    - Assigning items from sales with 'ANTICIPO_PAGADO' or 'PAGADO_TOTAL' are ACCEPTED (HTTP 200).
 * 2. Adversarial Stress & Edge Cases:
 *    - Mixed batch poisoning: Batch with [ANTICIPO_PAGADO, PENDIENTE_ANTICIPO, PAGADO_TOTAL] must atomically abort with 422 and leave 0 items assigned.
 *    - Sale ANULADA even if paymentStatus is PAGADO_TOTAL: Order cancellation takes precedence and fails with 422.
 *    - Invalid / unexpected paymentStatus (e.g. 'RECHAZADO'): Fails with 422.
 *    - Sheet status boundary: Sheets in 'IMPRESO' or 'TERMINADO' reject assignments with HTTP 400. Sheets in 'ABIERTO' or 'EN_PRODUCCION' accept.
 *    - Multi-tenant boundary: Items belonging to a different tenant must fail with HTTP 404.
 *    - Controller integration: printSheetController.assignItems returns exact HTTP 422 / 400 / 404 / 200 statuses and payload structure.
 *    - Cascade to IMPRESO: Updating sheet to IMPRESO cascades productionStatus to 'IMPRESO' on all items with audit logs.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { prisma } from '../../server/config/prisma.js';
import {
  generateSheetCode,
  createPrintSheet,
  assignItemsToSheet,
  updateSheetStatus,
  getPrintSheets,
  getPrintSheetById,
} from '../../server/services/printSheetService.js';
import {
  listPrintSheets,
  getPrintSheet,
  createPrintSheet as createPrintSheetController,
  assignItems as assignItemsController,
  updateStatus as updatePrintSheetStatusController,
} from '../../server/controllers/printSheetController.js';
import {
  createPrintSheetSchema,
  assignItemsToSheetSchema,
  updateSheetStatusSchema,
} from '../../server/validators/printSheetValidators.js';

// ============================================================================
// HIGH-FIDELITY IN-MEMORY PRISMA MOCK WITH ATOMIC ROLLBACK SUPPORT
// ============================================================================
class InMemoryPrismaMock {
  constructor() {
    this.reset();
  }

  reset() {
    this.sheets = new Map();
    this.sales = new Map();
    this.saleItems = new Map();
    this.productionLogs = [];
  }

  _cloneState() {
    return {
      sheets: new Map(Array.from(this.sheets.entries()).map(([k, v]) => [k, { ...v }])),
      sales: new Map(Array.from(this.sales.entries()).map(([k, v]) => [k, { ...v }])),
      saleItems: new Map(Array.from(this.saleItems.entries()).map(([k, v]) => [k, { ...v }])),
      productionLogs: [...this.productionLogs.map((l) => ({ ...l }))],
    };
  }

  _restoreState(snapshot) {
    this.sheets = snapshot.sheets;
    this.sales = snapshot.sales;
    this.saleItems = snapshot.saleItems;
    this.productionLogs = snapshot.productionLogs;
  }

  // --- PrintSheet Delegate ---
  get printSheet() {
    return {
      findFirst: async ({ where }) => {
        for (const s of this.sheets.values()) {
          let match = true;
          if (where.id && s.id !== where.id) match = false;
          if (where.tenantId && s.tenantId !== where.tenantId) match = false;
          if (where.sheetCode?.startsWith && !s.sheetCode.startsWith(where.sheetCode.startsWith)) match = false;
          if (where.status && where.status !== 'ALL' && s.status !== where.status) match = false;
          if (where.material && where.material !== 'ALL' && s.material !== where.material) match = false;
          if (match) return { ...s };
        }
        return null;
      },

      findUnique: async ({ where, include }) => {
        const s = this.sheets.get(where.id);
        if (!s) return null;
        const res = { ...s };
        if (include?.items) {
          const items = Array.from(this.saleItems.values()).filter((i) => i.printSheetId === s.id);
          res.items = items.map((item) => {
            const itemCopy = { ...item };
            if (include.items.include?.sale) {
              const sale = this.sales.get(item.saleId);
              itemCopy.sale = sale ? { ...sale } : null;
            }
            return itemCopy;
          });
        }
        return res;
      },

      findMany: async ({ where, skip = 0, take = 50, orderBy, include }) => {
        let list = Array.from(this.sheets.values()).filter((s) => {
          if (where.tenantId && s.tenantId !== where.tenantId) return false;
          if (where.status && where.status !== 'ALL' && s.status !== where.status) return false;
          if (where.material && where.material !== 'ALL' && s.material !== where.material) return false;
          return true;
        });

        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (orderBy?.sheetCode === 'desc') {
          list.sort((a, b) => b.sheetCode.localeCompare(a.sheetCode));
        }

        const sliced = list.slice(skip, skip + take);
        return sliced.map((s) => {
          const res = { ...s };
          if (include?._count?.select?.items) {
            const count = Array.from(this.saleItems.values()).filter((i) => i.printSheetId === s.id).length;
            res._count = { items: count };
          }
          return res;
        });
      },

      count: async ({ where }) => {
        const list = await this.printSheet.findMany({ where, skip: 0, take: 9999 });
        return list.length;
      },

      create: async ({ data }) => {
        const id = data.id || crypto.randomUUID();
        const sheet = {
          id,
          tenantId: data.tenantId,
          sheetCode: data.sheetCode,
          material: data.material,
          status: data.status || 'ABIERTO',
          notes: data.notes || null,
          createdById: data.createdById || null,
          printedById: data.printedById || null,
          printedAt: data.printedAt || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.sheets.set(id, sheet);
        return { ...sheet };
      },

      update: async ({ where, data, include }) => {
        const s = this.sheets.get(where.id);
        if (!s) throw new Error('Sheet not found for update');
        const updated = {
          ...s,
          ...data,
          updatedAt: new Date(),
        };
        this.sheets.set(where.id, updated);
        return this.printSheet.findUnique({ where: { id: where.id }, include });
      },
    };
  }

  // --- SaleItem Delegate ---
  get saleItem() {
    return {
      findMany: async ({ where, include }) => {
        let results = Array.from(this.saleItems.values()).filter((item) => {
          if (where.id?.in && !where.id.in.includes(item.id)) return false;
          if (where.printSheetId && item.printSheetId !== where.printSheetId) return false;
          if (where.sale?.tenantId) {
            const parentSale = this.sales.get(item.saleId);
            if (!parentSale || parentSale.tenantId !== where.sale.tenantId) return false;
          }
          return true;
        });

        return results.map((item) => {
          const res = { ...item };
          if (include?.sale) {
            const sale = this.sales.get(item.saleId);
            res.sale = sale ? { ...sale } : null;
          }
          return res;
        });
      },

      update: async ({ where, data }) => {
        const item = this.saleItems.get(where.id);
        if (!item) throw new Error('SaleItem not found');
        const updated = { ...item, ...data, updatedAt: new Date() };
        this.saleItems.set(where.id, updated);
        return { ...updated };
      },

      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, item] of this.saleItems.entries()) {
          if (where.printSheetId && item.printSheetId === where.printSheetId) {
            this.saleItems.set(id, { ...item, ...data, updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
    };
  }

  // --- ProductionLog Delegate ---
  get productionLog() {
    return {
      create: async ({ data }) => {
        const log = {
          id: crypto.randomUUID(),
          saleItemId: data.saleItemId,
          previousStatus: data.previousStatus || null,
          newStatus: data.newStatus,
          userId: data.userId || null,
          notes: data.notes || null,
          createdAt: new Date(),
        };
        this.productionLogs.push(log);
        return { ...log };
      },
    };
  }

  // --- Transaction Runner with Rollback ---
  async $transaction(fn) {
    if (typeof fn === 'function') {
      const snapshot = this._cloneState();
      try {
        return await fn(this);
      } catch (err) {
        // Rollback state on error
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
  user = { id: 'usr-operario-01', role: 'OPERARIO_1' },
  tenantId = 'tenant-test-01',
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
// ADVERSARIAL TEST SUITE FOR MILESTONE 2
// ============================================================================
describe('⚔️ CHALLENGER M2: Empirical Verification of Workshop Brake & PrintSheet Management', () => {
  let mockPrisma;
  let originalPrismaProps = {};
  const defaultTenant = 'tenant-deko-workshop';
  const defaultUserId = 'usr-operario-01';

  beforeEach(() => {
    mockPrisma = new InMemoryPrismaMock();

    originalPrismaProps = {
      printSheet: prisma.printSheet,
      saleItem: prisma.saleItem,
      productionLog: prisma.productionLog,
      $transaction: prisma.$transaction,
    };

    prisma.printSheet = mockPrisma.printSheet;
    prisma.saleItem = mockPrisma.saleItem;
    prisma.productionLog = mockPrisma.productionLog;
    prisma.$transaction = mockPrisma.$transaction.bind(mockPrisma);
  });

  afterEach(() => {
    Object.assign(prisma, originalPrismaProps);
  });

  // Helper to seed a sheet
  function seedSheet({
    id = crypto.randomUUID(),
    tenantId = defaultTenant,
    sheetCode = 'PLI-20260919-01',
    material = 'PVC_5MM',
    status = 'ABIERTO',
  } = {}) {
    const sheet = {
      id,
      tenantId,
      sheetCode,
      material,
      status,
      notes: null,
      createdById: defaultUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.sheets.set(id, sheet);
    return sheet;
  }

  // Helper to seed a sale and its item
  function seedSaleAndItem({
    itemId = crypto.randomUUID(),
    saleId = crypto.randomUUID(),
    tenantId = defaultTenant,
    saleNumber = 'VENT-0001',
    description = 'Póster Cuadro Cyberpunk 30x40',
    status = 'PENDIENTE',
    paymentStatus = 'ANTICIPO_PAGADO',
    productionStatus = 'PENDIENTE',
    printSheetId = null,
  } = {}) {
    const sale = {
      id: saleId,
      tenantId,
      saleNumber,
      status,
      paymentStatus,
      createdAt: new Date(),
    };
    mockPrisma.sales.set(saleId, sale);

    const item = {
      id: itemId,
      saleId,
      description,
      quantity: 1,
      unitPrice: 150.00,
      productionStatus,
      printSheetId,
      createdAt: new Date(),
    };
    mockPrisma.saleItems.set(itemId, item);

    return { sale, item };
  }

  // --------------------------------------------------------------------------
  // 1. SCENARIO 6 CORE SPECIFICATION VERIFICATION
  // --------------------------------------------------------------------------
  describe('1. Scenario 6 Specification Verification: Freno de Pliego de Taller', () => {
    it('1.1 MUST fail with HTTP status 422 when attempting to assign an item whose parent sale has paymentStatus === "PENDIENTE_ANTICIPO"', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-1001',
        description: 'Obra Sin Anticipo',
        status: 'PENDIENTE',
        paymentStatus: 'PENDIENTE_ANTICIPO',
      });

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            saleItemIds: [item.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Expected HTTP status 422 Unprocessable Entity');
          assert.match(
            err.message,
            /está bloqueado: Orden #VENT-1001 no cuenta con anticipo registrado/,
            'Error message must match domain spec'
          );
          return true;
        }
      );
    });

    it('1.2 MUST fail with HTTP status 422 when attempting to assign an item whose parent sale is "ANULADA"', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-1002',
        description: 'Obra Cancelada',
        status: 'ANULADA',
        paymentStatus: 'PAGADO_TOTAL', // Even if paid, order was canceled!
      });

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            saleItemIds: [item.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422, 'Expected HTTP status 422 Unprocessable Entity');
          assert.match(
            err.message,
            /pertenece a una orden anulada \(#VENT-1002\)/,
            'Error message must clearly identify the canceled order'
          );
          return true;
        }
      );
    });

    it('1.3 MUST succeed when assigning an item from a sale with paymentStatus === "ANTICIPO_PAGADO"', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-1003',
        description: 'Obra 50% Confirmada',
        status: 'PENDIENTE',
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const result = await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [item.id],
        userId: defaultUserId,
      });

      assert.ok(result, 'Resulting sheet must be returned');
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].id, item.id);

      // Verify item persistence and status change
      const updatedItem = mockPrisma.saleItems.get(item.id);
      assert.strictEqual(updatedItem.printSheetId, sheet.id);
      assert.strictEqual(updatedItem.productionStatus, 'A_PRODUCCION');
      assert.strictEqual(updatedItem.statusChangedById, defaultUserId);

      // Verify production log entry
      const log = mockPrisma.productionLogs.find((l) => l.saleItemId === item.id);
      assert.ok(log, 'ProductionLog must be written');
      assert.strictEqual(log.newStatus, 'A_PRODUCCION');
      assert.match(log.notes, new RegExp(`Asignado a pliego ${sheet.sheetCode}`));
    });

    it('1.4 MUST succeed when assigning an item from a sale with paymentStatus === "PAGADO_TOTAL"', async () => {
      const sheet = seedSheet({ status: 'EN_PRODUCCION' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-1004',
        description: 'Obra 100% Pagada',
        status: 'COMPLETADA',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const result = await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [item.id],
        userId: defaultUserId,
      });

      assert.ok(result);
      const updatedItem = mockPrisma.saleItems.get(item.id);
      assert.strictEqual(updatedItem.printSheetId, sheet.id);
      assert.strictEqual(updatedItem.productionStatus, 'A_PRODUCCION');
    });
  });

  // --------------------------------------------------------------------------
  // 2. ADVERSARIAL STRESS & CORNER CASES
  // --------------------------------------------------------------------------
  describe('2. Adversarial Stress & Atomic Transaction Integrity', () => {
    it('2.1 Mixed Batch Poisoning: A single PENDIENTE_ANTICIPO item in a multi-item batch must abort atomically', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });

      const item1 = seedSaleAndItem({
        itemId: 'item-valid-1',
        saleNumber: 'VENT-2001',
        description: 'Valid Item 1',
        paymentStatus: 'ANTICIPO_PAGADO',
      }).item;

      const item2 = seedSaleAndItem({
        itemId: 'item-poison-2',
        saleNumber: 'VENT-2002',
        description: 'Poison Item 2',
        paymentStatus: 'PENDIENTE_ANTICIPO', // This should poison the batch!
      }).item;

      const item3 = seedSaleAndItem({
        itemId: 'item-valid-3',
        saleNumber: 'VENT-2003',
        description: 'Valid Item 3',
        paymentStatus: 'PAGADO_TOTAL',
      }).item;

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            saleItemIds: [item1.id, item2.id, item3.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          assert.match(err.message, /Orden #VENT-2002 no cuenta con anticipo/);
          return true;
        }
      );

      // CRITICAL ASSERTION: Zero items assigned, zero logs recorded (ATOMIC ROLLBACK)
      assert.strictEqual(mockPrisma.saleItems.get('item-valid-1').printSheetId, null);
      assert.strictEqual(mockPrisma.saleItems.get('item-valid-1').productionStatus, 'PENDIENTE');
      assert.strictEqual(mockPrisma.saleItems.get('item-poison-2').printSheetId, null);
      assert.strictEqual(mockPrisma.saleItems.get('item-valid-3').printSheetId, null);
      assert.strictEqual(mockPrisma.saleItems.get('item-valid-3').productionStatus, 'PENDIENTE');
      assert.strictEqual(mockPrisma.productionLogs.length, 0, 'No partial production logs allowed!');
    });

    it('2.2 Order ANULADA takes absolute precedence over paymentStatus PAGADO_TOTAL', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-ANULADA-PAID',
        description: 'Order paid then canceled',
        status: 'ANULADA',
        paymentStatus: 'PAGADO_TOTAL',
      });

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            saleItemIds: [item.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          assert.match(err.message, /pertenece a una orden anulada/);
          return true;
        }
      );
    });

    it('2.3 Unexpected or corrupted paymentStatus (e.g. "RECHAZADO") must fail with HTTP 422', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-CORRUPTED',
        description: 'Corrupted Payment Item',
        status: 'PENDIENTE',
        paymentStatus: 'RECHAZADO',
      });

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            saleItemIds: [item.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          assert.match(err.message, /no cuenta con anticipo válido/);
          return true;
        }
      );
    });

    it('2.4 Sheet Status Protection: Cannot assign items to a sheet in status "IMPRESO" or "TERMINADO"', async () => {
      const { item } = seedSaleAndItem({
        paymentStatus: 'PAGADO_TOTAL',
      });

      for (const closedStatus of ['IMPRESO', 'TERMINADO']) {
        const closedSheet = seedSheet({ id: `sheet-${closedStatus}`, status: closedStatus });

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: defaultTenant,
              sheetId: closedSheet.id,
              saleItemIds: [item.id],
              userId: defaultUserId,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            assert.match(err.message, new RegExp(`No se pueden asignar ítems a un pliego con estado '${closedStatus}'`));
            return true;
          }
        );
      }
    });

    it('2.5 Multi-tenant Security: Attempting to assign item belonging to another tenant MUST throw 404', async () => {
      const sheet = seedSheet({ tenantId: 'tenant-A', status: 'ABIERTO' });
      const foreignItem = seedSaleAndItem({
        tenantId: 'tenant-B', // Belongs to different tenant
        paymentStatus: 'PAGADO_TOTAL',
      }).item;

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: 'tenant-A',
            sheetId: sheet.id,
            saleItemIds: [foreignItem.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /Uno o más ítems no fueron encontrados o pertenecen a otro tenant/);
          return true;
        }
      );
    });

    it('2.6 Non-existent sheetId MUST throw 404', async () => {
      const { item } = seedSaleAndItem({ paymentStatus: 'PAGADO_TOTAL' });

      await assert.rejects(
        async () => {
          await assignItemsToSheet({
            tenantId: defaultTenant,
            sheetId: 'non-existent-sheet-id',
            saleItemIds: [item.id],
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /Pliego de impresión no encontrado/);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. CONTROLLER INTEGRATION & HTTP STATUS CODES
  // --------------------------------------------------------------------------
  describe('3. Controller Integration: printSheetController.assignItems', () => {
    it('3.1 Controller MUST return HTTP 422 when item sale has PENDIENTE_ANTICIPO', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-HTTP-422',
        paymentStatus: 'PENDIENTE_ANTICIPO',
      });

      const { req, res } = createMockReqRes({
        tenantId: defaultTenant,
        params: { id: sheet.id },
        body: { saleItemIds: [item.id] },
      });

      await assignItemsController(req, res);

      assert.strictEqual(res.statusValue, 422, 'Controller must respond with HTTP status 422');
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.error, /no cuenta con anticipo registrado/);
    });

    it('3.2 Controller MUST return HTTP 422 when item sale is ANULADA', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        saleNumber: 'VENT-HTTP-ANULADA',
        status: 'ANULADA',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const { req, res } = createMockReqRes({
        tenantId: defaultTenant,
        params: { id: sheet.id },
        body: { saleItemIds: [item.id] },
      });

      await assignItemsController(req, res);

      assert.strictEqual(res.statusValue, 422);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.error, /pertenece a una orden anulada/);
    });

    it('3.3 Controller MUST return HTTP 200 with success payload when items are valid', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });
      const { item } = seedSaleAndItem({
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const { req, res } = createMockReqRes({
        tenantId: defaultTenant,
        params: { id: sheet.id },
        body: { saleItemIds: [item.id] },
      });

      await assignItemsController(req, res);

      assert.strictEqual(res.statusValue, 200);
      assert.strictEqual(res.data.success, true);
      assert.match(res.data.message, /1 obra\(s\) asignadas exitosamente al pliego/);
      assert.ok(res.data.data);
    });

    it('3.4 Controller MUST return HTTP 400 when tenantId context is missing', async () => {
      const { req, res } = createMockReqRes({
        tenantId: null, // Missing tenant context
        params: { id: 'sheet-1' },
        body: { saleItemIds: [crypto.randomUUID()] },
      });

      await assignItemsController(req, res);

      assert.strictEqual(res.statusValue, 400);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.error, /Contexto de empresa no válido/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CASCADE TO IMPRESO & FULL DOMAIN 2 LIFECYCLE
  // --------------------------------------------------------------------------
  describe('4. PrintSheet Lifecycle & Cascade to IMPRESO', () => {
    it('4.1 Moving sheet to IMPRESO cascades productionStatus to "IMPRESO" on all assigned items', async () => {
      const sheet = seedSheet({ status: 'EN_PRODUCCION' });

      const item1 = seedSaleAndItem({
        itemId: 'item-casc-1',
        paymentStatus: 'ANTICIPO_PAGADO',
      }).item;
      const item2 = seedSaleAndItem({
        itemId: 'item-casc-2',
        paymentStatus: 'PAGADO_TOTAL',
      }).item;

      // Assign items to sheet
      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [item1.id, item2.id],
        userId: defaultUserId,
      });

      assert.strictEqual(mockPrisma.saleItems.get('item-casc-1').productionStatus, 'A_PRODUCCION');
      assert.strictEqual(mockPrisma.saleItems.get('item-casc-2').productionStatus, 'A_PRODUCCION');

      // Update sheet status to IMPRESO
      const updatedSheet = await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: defaultUserId,
        notes: 'Impresión en cama plana completada',
      });

      assert.strictEqual(updatedSheet.status, 'IMPRESO');
      assert.ok(updatedSheet.printedAt);
      assert.strictEqual(updatedSheet.printedById, defaultUserId);

      // Check items cascaded
      const postItem1 = mockPrisma.saleItems.get('item-casc-1');
      const postItem2 = mockPrisma.saleItems.get('item-casc-2');
      assert.strictEqual(postItem1.productionStatus, 'IMPRESO');
      assert.strictEqual(postItem1.impresoById, defaultUserId);
      assert.ok(postItem1.impresoAt);

      assert.strictEqual(postItem2.productionStatus, 'IMPRESO');
      assert.strictEqual(postItem2.impresoById, defaultUserId);

      // Verify productionLogs created for both items
      const logs = mockPrisma.productionLogs.filter((l) => l.newStatus === 'IMPRESO');
      assert.strictEqual(logs.length, 2);
    });

    it('4.2 Invalid state transition (e.g. ABIERTO directly to invalid state) throws 400', async () => {
      const sheet = seedSheet({ status: 'ABIERTO' });

      await assert.rejects(
        async () => {
          await updateSheetStatus({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            status: 'CANCELADO',
            userId: defaultUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Transición de estado no válida/);
          return true;
        }
      );
    });
  });
});
