/**
 * tests/adversarial/m2-printing-cascade-consecutive-challenger.test.js
 *
 * ⚔️ EMPIRICAL ADVERSARIAL CHALLENGER 2: MILESTONE 2
 * Objective: Deep Empirical Verification of:
 * 1. Scenario 7: Full Printing Cascade to IMPRESO (atomically updates sale_items, timestamps, users, and audit logs).
 * 2. Daily Consecutive Numbering (PLI-YYYYMMDD-01, multi-tenant isolation, date boundaries, sequence overflow).
 * 3. Item Assignment moving items to 'A_PRODUCCION' with audit logs.
 * 4. State Machine Transition Guardrails (invalid transitions rejected with HTTP 400, non-existent sheet 404).
 * 5. Controller & Route Integration.
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
  createPrintSheet as createPrintSheetController,
  assignItems as assignItemsController,
  updateStatus as updatePrintSheetStatusController,
  getPrintSheet as getPrintSheetController,
  listPrintSheets as listPrintSheetsController,
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
      findFirst: async ({ where, orderBy, select }) => {
        let list = Array.from(this.sheets.values()).filter((s) => {
          if (where.id && s.id !== where.id) return false;
          if (where.tenantId && s.tenantId !== where.tenantId) return false;
          if (where.sheetCode?.startsWith && !s.sheetCode.startsWith(where.sheetCode.startsWith)) return false;
          if (where.status && where.status !== 'ALL' && s.status !== where.status) return false;
          if (where.material && where.material !== 'ALL' && s.material !== where.material) return false;
          return true;
        });

        if (orderBy?.sheetCode === 'desc') {
          list.sort((a, b) => b.sheetCode.localeCompare(a.sheetCode));
        } else if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const found = list[0];
        if (!found) return null;
        if (select?.sheetCode) return { sheetCode: found.sheetCode };
        return { ...found };
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
          if (where.OR) {
            const matchOr = where.OR.some((clause) => {
              if (clause.sheetCode?.contains && s.sheetCode.toLowerCase().includes(clause.sheetCode.contains.toLowerCase())) return true;
              if (clause.notes?.contains && s.notes && s.notes.toLowerCase().includes(clause.notes.contains.toLowerCase())) return true;
              return false;
            });
            if (!matchOr) return false;
          }
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
    if (!this._productionLogDelegate) {
      this._productionLogDelegate = {
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
    return this._productionLogDelegate;
  }

  // --- Transaction Runner with Rollback ---
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
  tenantId = 'tenant-deko-workshop',
  user = { id: 'usr-operario-01', role: 'OPERARIO_1' },
} = {}) {
  const req = {
    body,
    query,
    params,
    headers,
    tenantId,
    user,
  };

  let responseStatus = 200;
  let responseData = null;

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
// ADVERSARIAL TEST SUITE FOR MILESTONE 2 (CHALLENGER 2)
// ============================================================================
describe('⚔️ CHALLENGER M2: Printing Cascade & Daily Consecutive Empirical Verification', () => {
  let mockPrisma;
  let originalPrismaProps = {};
  const defaultTenant = 'tenant-deko-workshop';
  const tenantBeta = 'tenant-beta-workshop';
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

  // --------------------------------------------------------------------------
  // 1. DAILY CONSECUTIVE NUMBERING VERIFICATION (generateSheetCode & createPrintSheet)
  // --------------------------------------------------------------------------
  describe('1. Consecutivo Diario de Pliegos (PLI-YYYYMMDD-01)', () => {
    it('1.1 Primer pliego del día debe tener formato PLI-YYYYMMDD-01', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
        notes: 'Primer pliego del día',
      });

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const expectedCode = `PLI-${todayStr}-01`;

      assert.equal(sheet.sheetCode, expectedCode);
      assert.match(sheet.sheetCode, /^PLI-\d{8}-01$/);
      assert.equal(sheet.status, 'ABIERTO');
      assert.equal(sheet.material, 'PVC_5MM');
      assert.equal(sheet.createdById, defaultUserId);
    });

    it('1.2 Pliegos sucesivos dentro del mismo día deben incrementar: 01 -> 02 -> 03', async () => {
      const sheet1 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });
      const sheet2 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MDF_5_5MM',
      });
      const sheet3 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'VINILO_SOLO',
      });

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      assert.equal(sheet1.sheetCode, `PLI-${todayStr}-01`);
      assert.equal(sheet2.sheetCode, `PLI-${todayStr}-02`);
      assert.equal(sheet3.sheetCode, `PLI-${todayStr}-03`);
    });

    it('1.3 Aislamiento Multi-Tenant: Tenant Beta no hereda correlativo de Tenant Alfa', async () => {
      // Tenant Alfa crea 2 pliegos
      const alfa1 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });
      const alfa2 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      // Tenant Beta crea su primer pliego hoy
      const beta1 = await createPrintSheet({
        tenantId: tenantBeta,
        userId: 'usr-operario-beta',
        material: 'MIXTO',
      });

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      assert.equal(alfa1.sheetCode, `PLI-${todayStr}-01`);
      assert.equal(alfa2.sheetCode, `PLI-${todayStr}-02`);
      // Tenant Beta DEBE iniciar en 01 para su empresa
      assert.equal(beta1.sheetCode, `PLI-${todayStr}-01`);

      // Tenant Beta crea segundo pliego
      const beta2 = await createPrintSheet({
        tenantId: tenantBeta,
        userId: 'usr-operario-beta',
        material: 'MIXTO',
      });
      assert.equal(beta2.sheetCode, `PLI-${todayStr}-02`);
    });

    it('1.4 Transición de Fecha: Pliegos de ayer no bloquean reinicio a 01 hoy', async () => {
      // Simular un pliego existente de una fecha previa (ayer)
      mockPrisma.sheets.set('sheet-yesterday', {
        id: 'sheet-yesterday',
        tenantId: defaultTenant,
        sheetCode: 'PLI-20260101-99',
        material: 'PVC_5MM',
        status: 'TERMINADO',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      });

      const todayCode = await generateSheetCode(defaultTenant, mockPrisma);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      assert.equal(todayCode, `PLI-${todayStr}-01`);
    });

    it('1.5 Progresión de doble dígito (09 -> 10) y soporte hasta 99', async () => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      mockPrisma.sheets.set('sheet-09', {
        id: 'sheet-09',
        tenantId: defaultTenant,
        sheetCode: `PLI-${todayStr}-09`,
        material: 'PVC_5MM',
        status: 'TERMINADO',
      });

      const nextCode = await generateSheetCode(defaultTenant, mockPrisma);
      assert.equal(nextCode, `PLI-${todayStr}-10`);
    });

    it('1.6 Código con sufijo anómalo o corrupto en DB hace fallback seguro a 01', async () => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      mockPrisma.sheets.set('sheet-corrupt', {
        id: 'sheet-corrupt',
        tenantId: defaultTenant,
        sheetCode: `PLI-${todayStr}-CORRUPT`,
        material: 'PVC_5MM',
        status: 'ABIERTO',
      });

      const safeCode = await generateSheetCode(defaultTenant, mockPrisma);
      assert.equal(safeCode, `PLI-${todayStr}-01`);
    });
  });

  // --------------------------------------------------------------------------
  // 2. ASIGNACIÓN DE ÍTEMS Y TRANSICIÓN A 'A_PRODUCCION'
  // --------------------------------------------------------------------------
  describe('2. Asignación de Ítems a Pliego (productionStatus = A_PRODUCCION)', () => {
    it('2.1 Asignar un ítem con anticipo pagado actualiza su productionStatus a A_PRODUCCION', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      // Crear venta y saleItem
      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-5001',
        status: 'EN_PROCESO',
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Cuadro Star Wars 30x40',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      const result = await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [itemId],
        userId: defaultUserId,
      });

      const updatedItem = mockPrisma.saleItems.get(itemId);
      assert.equal(updatedItem.productionStatus, 'A_PRODUCCION');
      assert.equal(updatedItem.printSheetId, sheet.id);
      assert.ok(updatedItem.statusChangedAt instanceof Date);
      assert.equal(updatedItem.statusChangedById, defaultUserId);

      // Verificar resultado de la llamada
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].id, itemId);
    });

    it('2.2 Asignación genera registro auditable exacto en production_logs', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MDF_5_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-5002',
        status: 'EN_PROCESO',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Lámina Marvel A3',
        productionStatus: 'EN_DISENO',
        printSheetId: null,
      });

      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [itemId],
        userId: defaultUserId,
      });

      assert.equal(mockPrisma.productionLogs.length, 1);
      const log = mockPrisma.productionLogs[0];
      assert.equal(log.saleItemId, itemId);
      assert.equal(log.previousStatus, 'EN_DISENO');
      assert.equal(log.newStatus, 'A_PRODUCCION');
      assert.equal(log.userId, defaultUserId);
      assert.ok(log.notes.includes(sheet.sheetCode));
    });

    it('2.3 Asignación de lote múltiple (3 ítems) actualiza todos y genera 3 logs', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-5003',
        status: 'EN_PROCESO',
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const itemIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
      for (let i = 0; i < itemIds.length; i++) {
        mockPrisma.saleItems.set(itemIds[i], {
          id: itemIds[i],
          saleId,
          description: `Obra ${i + 1}`,
          productionStatus: 'PENDIENTE',
          printSheetId: null,
        });
      }

      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: itemIds,
        userId: defaultUserId,
      });

      for (const id of itemIds) {
        const it = mockPrisma.saleItems.get(id);
        assert.equal(it.productionStatus, 'A_PRODUCCION');
        assert.equal(it.printSheetId, sheet.id);
      }

      assert.equal(mockPrisma.productionLogs.length, 3);
      assert.ok(mockPrisma.productionLogs.every((l) => l.newStatus === 'A_PRODUCCION'));
    });

    it('2.4 Asignación con IDs duplicados en el array debe ser rechazada con HTTP 404', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-DUP',
        status: 'EN_PROCESO',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Obra Duplicada',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      // Pasar [itemId, itemId] genera discrepancia entre findMany.length y saleItemIds.length
      await assert.rejects(
        assignItemsToSheet({
          tenantId: defaultTenant,
          sheetId: sheet.id,
          saleItemIds: [itemId, itemId],
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.match(err.message, /Uno o más ítems no fueron encontrados/);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. CASCADA ATÓMICA DE IMPRESIÓN (SCENARIO 7: updateSheetStatus a IMPRESO)
  // --------------------------------------------------------------------------
  describe('3. Cascada Atómica a IMPRESO (Scenario 7)', () => {
    it('3.1 Al actualizar pliego a IMPRESO, se actualiza el pliego con printedAt y printedById', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const operarioImpresionId = 'usr-operario-impresion-99';
      const updatedSheet = await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: operarioImpresionId,
        notes: 'Impresión en cama plana UV completada',
      });

      assert.equal(updatedSheet.status, 'IMPRESO');
      assert.equal(updatedSheet.notes, 'Impresión en cama plana UV completada');
      assert.equal(updatedSheet.printedById, operarioImpresionId);
      assert.ok(updatedSheet.printedAt instanceof Date);
    });

    it('3.2 Cascada en bloque: Todos los ítems asignados pasan a IMPRESO con timestamps y auditoría', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-CASCADE-01',
        status: 'EN_PROCESO',
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const item1Id = crypto.randomUUID();
      const item2Id = crypto.randomUUID();
      mockPrisma.saleItems.set(item1Id, {
        id: item1Id,
        saleId,
        description: 'Póster A',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });
      mockPrisma.saleItems.set(item2Id, {
        id: item2Id,
        saleId,
        description: 'Póster B',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      // Asignar al pliego
      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [item1Id, item2Id],
        userId: defaultUserId,
      });

      assert.equal(mockPrisma.saleItems.get(item1Id).productionStatus, 'A_PRODUCCION');
      assert.equal(mockPrisma.saleItems.get(item2Id).productionStatus, 'A_PRODUCCION');

      // Transición a IMPRESO
      const operarioImpresion = 'usr-operario-uv';
      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: operarioImpresion,
      });

      // 🔍 Verificación empírica de ítems en sale_items
      const savedItem1 = mockPrisma.saleItems.get(item1Id);
      const savedItem2 = mockPrisma.saleItems.get(item2Id);

      assert.equal(savedItem1.productionStatus, 'IMPRESO');
      assert.equal(savedItem1.impresoById, operarioImpresion);
      assert.ok(savedItem1.impresoAt instanceof Date);
      assert.equal(savedItem1.statusChangedById, operarioImpresion);
      assert.ok(savedItem1.statusChangedAt instanceof Date);

      assert.equal(savedItem2.productionStatus, 'IMPRESO');
      assert.equal(savedItem2.impresoById, operarioImpresion);
      assert.ok(savedItem2.impresoAt instanceof Date);
      assert.equal(savedItem2.statusChangedById, operarioImpresion);

      // 🔍 Verificación empírica de production_logs
      // Deberían existir 2 logs de asignación (A_PRODUCCION) y 2 logs de cascada (IMPRESO)
      assert.equal(mockPrisma.productionLogs.length, 4);

      const cascadeLogs = mockPrisma.productionLogs.filter((l) => l.newStatus === 'IMPRESO');
      assert.equal(cascadeLogs.length, 2);

      const logItem1 = cascadeLogs.find((l) => l.saleItemId === item1Id);
      assert.ok(logItem1, 'Log para item1 debe existir');
      assert.equal(logItem1.previousStatus, 'A_PRODUCCION');
      assert.equal(logItem1.newStatus, 'IMPRESO');
      assert.equal(logItem1.userId, operarioImpresion);
      assert.match(logItem1.notes, /marcado como IMPRESO/);

      const logItem2 = cascadeLogs.find((l) => l.saleItemId === item2Id);
      assert.ok(logItem2, 'Log para item2 debe existir');
      assert.equal(logItem2.previousStatus, 'A_PRODUCCION');
      assert.equal(logItem2.newStatus, 'IMPRESO');
      assert.equal(logItem2.userId, operarioImpresion);
    });

    it('3.3 Aislamiento de Cascada: Ítems de otros pliegos o sin asignar NO deben mutar', async () => {
      const sheet1 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });
      const sheet2 = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MDF_5_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-ISOLATION',
        status: 'EN_PROCESO',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const itemSheet1 = crypto.randomUUID();
      const itemSheet2 = crypto.randomUUID();
      const itemUnassigned = crypto.randomUUID();

      mockPrisma.saleItems.set(itemSheet1, {
        id: itemSheet1,
        saleId,
        description: 'Item Sheet 1',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });
      mockPrisma.saleItems.set(itemSheet2, {
        id: itemSheet2,
        saleId,
        description: 'Item Sheet 2',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });
      mockPrisma.saleItems.set(itemUnassigned, {
        id: itemUnassigned,
        saleId,
        description: 'Item Huérfano',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      // Asignar itemSheet1 a sheet1, itemSheet2 a sheet2
      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet1.id,
        saleItemIds: [itemSheet1],
        userId: defaultUserId,
      });
      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet2.id,
        saleItemIds: [itemSheet2],
        userId: defaultUserId,
      });

      // Pasar ÚNICAMENTE sheet1 a IMPRESO
      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet1.id,
        status: 'IMPRESO',
        userId: 'usr-operario-print',
      });

      // ItemSheet1 debe ser IMPRESO
      assert.equal(mockPrisma.saleItems.get(itemSheet1).productionStatus, 'IMPRESO');

      // ItemSheet2 DEBE PERMANECER en A_PRODUCCION sin alteración
      assert.equal(mockPrisma.saleItems.get(itemSheet2).productionStatus, 'A_PRODUCCION');
      assert.equal(mockPrisma.saleItems.get(itemSheet2).impresoAt, undefined);

      // ItemUnassigned DEBE PERMANECER en PENDIENTE
      assert.equal(mockPrisma.saleItems.get(itemUnassigned).productionStatus, 'PENDIENTE');
      assert.equal(mockPrisma.saleItems.get(itemUnassigned).printSheetId, null);
    });

    it('3.4 Pliego vacío sin ítems puede pasar a IMPRESO sin fallar', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'VINILO_SOLO',
      });

      const updated = await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: defaultUserId,
      });

      assert.equal(updated.status, 'IMPRESO');
      assert.ok(updated.printedAt instanceof Date);
      // No debe haber logs de items
      assert.equal(mockPrisma.productionLogs.length, 0);
    });

    it('3.5 Transición desde EN_PRODUCCION a IMPRESO cascada correctamente', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-PROD-STEP',
        status: 'EN_PROCESO',
        paymentStatus: 'ANTICIPO_PAGADO',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Obra Intermedia',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [itemId],
        userId: defaultUserId,
      });

      // Mover primero a EN_PRODUCCION
      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'EN_PRODUCCION',
        userId: defaultUserId,
      });
      assert.equal(mockPrisma.sheets.get(sheet.id).status, 'EN_PRODUCCION');

      // Ahora mover a IMPRESO
      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: defaultUserId,
      });

      assert.equal(mockPrisma.sheets.get(sheet.id).status, 'IMPRESO');
      assert.equal(mockPrisma.saleItems.get(itemId).productionStatus, 'IMPRESO');
    });
  });

  // --------------------------------------------------------------------------
  // 4. MATRIZ DE TRANSICIONES Y VALIDACIÓN DE ESTADOS INVÁLIDOS
  // --------------------------------------------------------------------------
  describe('4. Matriz de Estados y Rechazo de Transiciones Inválidas', () => {
    it('4.1 Intentar retroceder de IMPRESO a ABIERTO debe lanzar error HTTP 400', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: defaultUserId,
      });

      await assert.rejects(
        updateSheetStatus({
          tenantId: defaultTenant,
          sheetId: sheet.id,
          status: 'ABIERTO',
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Transición de estado no válida de IMPRESO a ABIERTO/);
          return true;
        }
      );
    });

    it('4.2 Intentar retroceder de IMPRESO a EN_PRODUCCION debe lanzar error HTTP 400', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'IMPRESO',
        userId: defaultUserId,
      });

      await assert.rejects(
        updateSheetStatus({
          tenantId: defaultTenant,
          sheetId: sheet.id,
          status: 'EN_PRODUCCION',
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Transición de estado no válida de IMPRESO a EN_PRODUCCION/);
          return true;
        }
      );
    });

    it('4.3 Pliego en TERMINADO no admite ninguna transición posterior (HTTP 400)', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'TERMINADO',
        userId: defaultUserId,
      });

      const invalidTargetStatuses = ['ABIERTO', 'EN_PRODUCCION', 'IMPRESO'];
      for (const target of invalidTargetStatuses) {
        await assert.rejects(
          updateSheetStatus({
            tenantId: defaultTenant,
            sheetId: sheet.id,
            status: target,
            userId: defaultUserId,
          }),
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, new RegExp(`Transición de estado no válida de TERMINADO a ${target}`));
            return true;
          }
        );
      }
    });

    it('4.4 Estado arbitrario desconocido lanza HTTP 400 en servicio y falla en Zod', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      // Prueba en Zod schema
      const zodValidation = updateSheetStatusSchema.safeParse({ status: 'ESTADO_INVENTADO' });
      assert.equal(zodValidation.success, false);
      assert.ok(zodValidation.error.issues.some((i) => i.message.includes('Estado debe ser')));

      // Prueba directa en servicio
      await assert.rejects(
        updateSheetStatus({
          tenantId: defaultTenant,
          sheetId: sheet.id,
          status: 'ESTADO_INVENTADO',
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Transición de estado no válida/);
          return true;
        }
      );
    });

    it('4.5 Actualizar pliego inexistente lanza HTTP 404', async () => {
      await assert.rejects(
        updateSheetStatus({
          tenantId: defaultTenant,
          sheetId: crypto.randomUUID(),
          status: 'IMPRESO',
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.match(err.message, /Pliego de impresión no encontrado/);
          return true;
        }
      );
    });

    it('4.6 Pliego de otro tenant no puede ser actualizado (Aislamiento HTTP 404)', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      await assert.rejects(
        updateSheetStatus({
          tenantId: tenantBeta, // Contexto ajeno
          sheetId: sheet.id,
          status: 'IMPRESO',
          userId: 'usr-operario-beta',
        }),
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.match(err.message, /Pliego de impresión no encontrado/);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. INTEGRACIÓN DE CONTROLADOR (printSheetController)
  // --------------------------------------------------------------------------
  describe('5. Integración de Controlador y Respuestas HTTP', () => {
    it('5.1 createPrintSheetController responde HTTP 201 con formato correcto', async () => {
      const { req, res } = createMockReqRes({
        body: { material: 'PVC_5MM', notes: 'Pliego urgente turno mañana' },
      });

      await createPrintSheetController(req, res);

      assert.equal(res.statusValue, 201);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.sheetCode.startsWith('PLI-'));
      assert.match(res.data.message, /creado exitosamente/);
    });

    it('5.2 assignItemsController responde HTTP 200 con ítems asignados', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-CTRL-01',
        status: 'EN_PROCESO',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Obra Controlador',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      const { req, res } = createMockReqRes({
        params: { id: sheet.id },
        body: { saleItemIds: [itemId] },
      });

      await assignItemsController(req, res);

      assert.equal(res.statusValue, 200);
      assert.equal(res.data.success, true);
      assert.match(res.data.message, /1 obra\(s\) asignadas exitosamente/);
    });

    it('5.3 updatePrintSheetStatusController responde HTTP 200 al marcar IMPRESO', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MDF_5_5MM',
      });

      const { req, res } = createMockReqRes({
        params: { id: sheet.id },
        body: { status: 'IMPRESO', notes: 'Impreso en cama plana' },
      });

      await updatePrintSheetStatusController(req, res);

      assert.equal(res.statusValue, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.status, 'IMPRESO');
      assert.match(res.data.message, /actualizado a estado IMPRESO/);
    });

    it('5.4 updatePrintSheetStatusController responde HTTP 400 ante transición inválida', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MDF_5_5MM',
      });

      await updateSheetStatus({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        status: 'TERMINADO',
        userId: defaultUserId,
      });

      const { req, res } = createMockReqRes({
        params: { id: sheet.id },
        body: { status: 'ABIERTO' },
      });

      await updatePrintSheetStatusController(req, res);

      assert.equal(res.statusValue, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /Transición de estado no válida/);
    });

    it('5.5 getPrintSheetController responde HTTP 200 con detalle íntegro y 404 si no existe', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'MIXTO',
      });

      const { req: reqOk, res: resOk } = createMockReqRes({
        params: { id: sheet.id },
      });
      await getPrintSheetController(reqOk, resOk);
      assert.equal(resOk.statusValue, 200);
      assert.equal(resOk.data.data.id, sheet.id);

      const { req: reqFail, res: resFail } = createMockReqRes({
        params: { id: crypto.randomUUID() },
      });
      await getPrintSheetController(reqFail, resFail);
      assert.equal(resFail.statusValue, 404);
      assert.equal(resFail.data.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. STRESS ADVERSARIAL: ROLLBACK TRANSACCIONAL & CONSULTAS MULTI-TENANT
  // --------------------------------------------------------------------------
  describe('6. Stress Adversarial: Rollback Transaccional & Consultas Multi-Tenant', () => {
    it('6.1 Falla a mitad de cascada (ej. error en log) revierte atómicamente todo el pliego e ítems', async () => {
      const sheet = await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });

      const saleId = crypto.randomUUID();
      mockPrisma.sales.set(saleId, {
        id: saleId,
        tenantId: defaultTenant,
        saleNumber: 'VENT-ROLLBACK-01',
        status: 'EN_PROCESO',
        paymentStatus: 'PAGADO_TOTAL',
      });

      const itemId = crypto.randomUUID();
      mockPrisma.saleItems.set(itemId, {
        id: itemId,
        saleId,
        description: 'Obra Rollback',
        productionStatus: 'PENDIENTE',
        printSheetId: null,
      });

      await assignItemsToSheet({
        tenantId: defaultTenant,
        sheetId: sheet.id,
        saleItemIds: [itemId],
        userId: defaultUserId,
      });

      assert.equal(mockPrisma.sheets.get(sheet.id).status, 'ABIERTO');
      assert.equal(mockPrisma.saleItems.get(itemId).productionStatus, 'A_PRODUCCION');
      const initialLogsCount = mockPrisma.productionLogs.length;

      // Inyectar fallo en productionLog.create cuando se marque IMPRESO
      const originalCreate = mockPrisma.productionLog.create;
      mockPrisma.productionLog.create = async ({ data }) => {
        if (data.newStatus === 'IMPRESO') {
          throw new Error('SIMULATED_DB_DISK_FULL_ERROR');
        }
        return originalCreate({ data });
      };

      await assert.rejects(
        updateSheetStatus({
          tenantId: defaultTenant,
          sheetId: sheet.id,
          status: 'IMPRESO',
          userId: defaultUserId,
        }),
        (err) => {
          assert.equal(err.message, 'SIMULATED_DB_DISK_FULL_ERROR');
          return true;
        }
      );

      // Restaurar mock
      mockPrisma.productionLog.create = originalCreate;

      // 🔍 VERIFICACIÓN DE ROLLBACK ATÓMICO:
      // 1. El pliego NO debe haber pasado a IMPRESO, debe seguir en ABIERTO
      assert.equal(mockPrisma.sheets.get(sheet.id).status, 'ABIERTO');
      assert.equal(mockPrisma.sheets.get(sheet.id).printedAt, null);

      // 2. El ítem NO debe haber quedado como IMPRESO, debe seguir en A_PRODUCCION
      assert.equal(mockPrisma.saleItems.get(itemId).productionStatus, 'A_PRODUCCION');
      assert.equal(mockPrisma.saleItems.get(itemId).impresoAt, undefined);

      // 3. No deben haberse persistido logs parciales de IMPRESO
      assert.equal(mockPrisma.productionLogs.length, initialLogsCount);
      assert.ok(!mockPrisma.productionLogs.some((l) => l.newStatus === 'IMPRESO'));
    });

    it('6.2 getPrintSheets respeta paginación, filtros de material y búsqueda por sheetCode', async () => {
      // Crear varios pliegos
      for (let i = 1; i <= 5; i++) {
        await createPrintSheet({
          tenantId: defaultTenant,
          userId: defaultUserId,
          material: i % 2 === 0 ? 'PVC_5MM' : 'MDF_5_5MM',
          notes: `Lote de prueba ${i}`,
        });
      }

      // Filtro por material
      const pvcSheets = await getPrintSheets({
        tenantId: defaultTenant,
        material: 'PVC_5MM',
      });
      assert.equal(pvcSheets.sheets.length, 2);
      assert.ok(pvcSheets.sheets.every((s) => s.material === 'PVC_5MM'));

      // Paginación: limit 2
      const page1 = await getPrintSheets({
        tenantId: defaultTenant,
        page: 1,
        limit: 2,
      });
      assert.equal(page1.sheets.length, 2);
      assert.equal(page1.total, 5);
      assert.equal(page1.totalPages, 3);
      assert.equal(page1.hasNext, true);
      assert.equal(page1.hasPrev, false);

      // Búsqueda por notas
      const searchResult = await getPrintSheets({
        tenantId: defaultTenant,
        search: 'prueba 3',
      });
      assert.equal(searchResult.sheets.length, 1);
      assert.ok(searchResult.sheets[0].notes.includes('prueba 3'));
    });

    it('6.3 getPrintSheets aísla estrictamente pliegos entre diferentes tenants', async () => {
      await createPrintSheet({
        tenantId: defaultTenant,
        userId: defaultUserId,
        material: 'PVC_5MM',
      });
      await createPrintSheet({
        tenantId: tenantBeta,
        userId: 'usr-operario-beta',
        material: 'MDF_5_5MM',
      });

      const defaultTenantSheets = await getPrintSheets({ tenantId: defaultTenant });
      const betaTenantSheets = await getPrintSheets({ tenantId: tenantBeta });

      assert.ok(defaultTenantSheets.sheets.every((s) => s.tenantId === defaultTenant));
      assert.ok(betaTenantSheets.sheets.every((s) => s.tenantId === tenantBeta));
    });
  });
});

