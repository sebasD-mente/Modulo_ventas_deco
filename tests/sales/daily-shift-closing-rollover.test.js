import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { prisma } from '../../server/config/prisma.js';
import {
  getGuatemalaDayRange,
  shiftGuatemalaDateStr,
  getEventKPIs,
  getEventSalesList,
} from '../../server/services/sales/saleKpiService.js';
import { createCashClosingTransaction } from '../../server/services/sales/cashClosingService.js';
import { updateSaleTransaction } from '../../server/services/sales/saleUpdateService.js';
import {
  getGuatemalaClockParts,
  runMidnightClosingAudit,
} from '../../server/services/sales/midnightClosingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Construye un almacén en memoria para simular con fidelidad matemática las consultas Prisma
 * de ventas, pagos, ítems y cierres de caja en jornadas consecutivas D y D+1.
 */
function installInMemoryPrismaHarness({ initialSales = [], initialClosings = [], events = [] } = {}) {
  const state = {
    sales: initialSales.map((s) => ({ ...s })),
    closings: initialClosings.map((c) => ({ ...c })),
    events: events.length > 0 ? events : [{ id: 'evt-stand-1', name: 'Feria Cayalá', tenantId: 'tenant-1', status: 'ACTIVO' }],
    updateClosingCalls: 0,
    auditLogs: [],
  };

  const originals = {
    saleFindMany: prisma.sale.findMany,
    saleCount: prisma.sale.count,
    saleAggregate: prisma.sale.aggregate,
    saleItemAggregate: prisma.saleItem.aggregate,
    saleItemGroupBy: prisma.saleItem.groupBy,
    salePaymentGroupBy: prisma.salePayment.groupBy,
    cashClosingFindFirst: prisma.cashClosing.findFirst,
    cashClosingFindMany: prisma.cashClosing.findMany,
    cashClosingCreate: prisma.cashClosing.create,
    cashClosingUpdate: prisma.cashClosing.update,
    eventFindUnique: prisma.event.findUnique,
    eventFindMany: prisma.event.findMany,
    auditLogCreate: prisma.auditLog.create,
    auditLogFindMany: prisma.auditLog.findMany,
    transaction: prisma.$transaction,
  };

  const matchesDateFilter = (val, filter) => {
    if (!filter) return true;
    const ms = new Date(val).getTime();
    if (filter.gte && ms < new Date(filter.gte).getTime()) return false;
    if (filter.gt && ms <= new Date(filter.gt).getTime()) return false;
    if (filter.lte && ms > new Date(filter.lte).getTime()) return false;
    if (filter.lt && ms >= new Date(filter.lt).getTime()) return false;
    return true;
  };

  const filterSales = (where = {}) => {
    return state.sales.filter((s) => {
      if (where.status?.not && s.status === where.status.not) return false;
      if (where.tenantId && s.tenantId !== where.tenantId) return false;
      if (where.eventId && typeof where.eventId === 'string' && s.eventId !== where.eventId) return false;
      if (where.createdAt && !matchesDateFilter(s.createdAt, where.createdAt)) return false;
      if (Array.isArray(where.OR)) {
        return where.OR.some((branch) => {
          if (branch.eventId && s.eventId !== branch.eventId) return false;
          if (branch.pickupEventId && s.pickupEventId !== branch.pickupEventId) return false;
          if (branch.balanceDue?.gt !== undefined && !(Number(s.balanceDue || 0) > branch.balanceDue.gt)) return false;
          if (branch.balanceDue?.lte !== undefined && !(Number(s.balanceDue || 0) <= branch.balanceDue.lte)) return false;
          if (branch.createdAt && !matchesDateFilter(s.createdAt, branch.createdAt)) return false;
          if (branch.payments?.some) {
            const someSpec = branch.payments.some;
            const ok = (s.payments || []).some((p) => {
              if (someSpec.reference?.contains && !String(p.reference || '').includes(someSpec.reference.contains)) return false;
              if (someSpec.createdAt && !matchesDateFilter(p.createdAt, someSpec.createdAt)) return false;
              return true;
            });
            if (!ok) return false;
          }
          return true;
        });
      }
      return true;
    });
  };

  const filterClosings = (where = {}) => {
    return state.closings
      .filter((c) => {
        if (where.tenantId && c.tenantId !== where.tenantId) return false;
        if (where.eventId && c.eventId !== where.eventId) return false;
        if (where.closingType && c.closingType !== where.closingType) return false;
        if (where.closingDate && !matchesDateFilter(c.closingDate, where.closingDate)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime());
  };

  prisma.sale.findMany = async ({ where } = {}) =>
    filterSales(where).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  prisma.sale.count = async ({ where } = {}) => filterSales(where).length;
  prisma.sale.aggregate = async ({ where } = {}) => {
    const rows = filterSales(where);
    const sum = rows.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    return { _count: { id: rows.length }, _sum: { totalAmount: sum } };
  };
  prisma.saleItem.aggregate = async ({ where } = {}) => {
    const rows = filterSales(where?.sale || {});
    const qty = rows.reduce((acc, s) => acc + (s.items || []).reduce((ia, it) => ia + Number(it.quantity || 0), 0), 0);
    return { _sum: { quantity: qty } };
  };
  prisma.saleItem.groupBy = async () => [];
  prisma.salePayment.groupBy = async ({ where } = {}) => {
    const buckets = new Map();
    for (const s of state.sales) {
      if (s.status === 'ANULADA') continue;
      if (where?.sale?.tenantId && s.tenantId !== where.sale.tenantId) continue;
      if (Array.isArray(where?.sale?.OR)) {
        const matchesStand = where.sale.OR.some(
          (b) => (b.eventId && s.eventId === b.eventId) || (b.pickupEventId && s.pickupEventId === b.pickupEventId)
        );
        if (!matchesStand) continue;
      }
      for (const p of s.payments || []) {
        const payCreated = p.createdAt || s.createdAt;
        if (where?.createdAt && !matchesDateFilter(payCreated, where.createdAt)) continue;
        const targetStandId = where?.sale?.OR?.[0]?.eventId;
        if (targetStandId && s.eventId !== targetStandId && s.pickupEventId === targetStandId) {
          if (!String(p.reference || '').includes('[SALDO]')) continue;
        }
        const cur = buckets.get(p.method) || { count: 0, amount: 0 };
        cur.count += 1;
        cur.amount = Number((cur.amount + Number(p.amount || 0)).toFixed(2));
        buckets.set(p.method, cur);
      }
    }
    return Array.from(buckets.entries()).map(([method, v]) => ({
      method,
      _count: { id: v.count },
      _sum: { amount: v.amount },
    }));
  };

  prisma.cashClosing.findFirst = async ({ where } = {}) => filterClosings(where)[0] || null;
  prisma.cashClosing.findMany = async ({ where } = {}) => filterClosings(where);
  prisma.cashClosing.create = async ({ data }) => {
    const created = {
      id: `closing-${state.closings.length + 1}`,
      ...data,
      closedBy: { fullName: 'Ana Mostrador', email: 'ana@deko.gt' },
      event: { name: 'Feria Cayalá' },
    };
    state.closings.push(created);
    return created;
  };
  prisma.cashClosing.update = async () => {
    state.updateClosingCalls += 1;
    throw new Error('PROHIBIDO sobreescribir un cierre existente mediante prisma.cashClosing.update');
  };
  prisma.event.findUnique = async ({ where }) => state.events.find((e) => e.id === where?.id) || null;
  prisma.event.findMany = async () => state.events;
  prisma.auditLog.create = async ({ data }) => {
    state.auditLogs.push(data);
    return { id: `log-${state.auditLogs.length}` };
  };
  prisma.auditLog.findMany = async () => [];

  const restore = () => {
    prisma.sale.findMany = originals.saleFindMany;
    prisma.sale.count = originals.saleCount;
    prisma.sale.aggregate = originals.saleAggregate;
    prisma.saleItem.aggregate = originals.saleItemAggregate;
    prisma.saleItem.groupBy = originals.saleItemGroupBy;
    prisma.salePayment.groupBy = originals.salePaymentGroupBy;
    prisma.cashClosing.findFirst = originals.cashClosingFindFirst;
    prisma.cashClosing.findMany = originals.cashClosingFindMany;
    prisma.cashClosing.create = originals.cashClosingCreate;
    prisma.cashClosing.update = originals.cashClosingUpdate;
    prisma.event.findUnique = originals.eventFindUnique;
    prisma.event.findMany = originals.eventFindMany;
    prisma.auditLog.create = originals.auditLogCreate;
    prisma.auditLog.findMany = originals.auditLogFindMany;
    prisma.$transaction = originals.transaction;
  };

  return { state, restore };
}

describe('🔒 Ciclo Contable Estricto de Jornada Diaria y Traspaso Post-Cierre D -> D+1 (feat-013)', () => {
  it('1. Unicidad estricta: permite 1 cierre por jornada, soporta replay por idempotencyKey y bloquea con 409 cualquier segundo cierre', async () => {
    const dayD = getGuatemalaDayRange().targetDate;
    const harness = installInMemoryPrismaHarness({
      initialSales: [
        {
          id: 'sale-1',
          saleNumber: 'CAYA-0001',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          sellerId: 'seller-1',
          status: 'COMPLETADA',
          totalAmount: 130,
          balanceDue: 0,
          createdAt: `${dayD}T11:00:00.000-06:00`,
          items: [{ id: 'it-1', description: 'Póster Mediano', quantity: 2, unitPrice: 65, subtotal: 130 }],
          payments: [{ id: 'p-1', method: 'EFECTIVO', amount: 130, createdAt: `${dayD}T11:00:00.000-06:00` }],
        },
      ],
    });

    try {
      const firstClosing = await createCashClosingTransaction({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        closedById: 'seller-1',
        closingType: 'DIARIO',
        totalCashReported: 130,
        idempotencyKey: 'idem-close-day-d',
      });

      assert.equal(firstClosing.totalCashCalculated, 130);
      assert.equal(firstClosing.cashDifference, 0);
      assert.equal(harness.state.closings.length, 1);
      assert.equal(harness.state.updateClosingCalls, 0);

      // Replay exacto con la misma idempotencyKey no duplica ni lanza 409
      const replay = await createCashClosingTransaction({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        closedById: 'seller-1',
        closingType: 'DIARIO',
        totalCashReported: 130,
        idempotencyKey: 'idem-close-day-d',
      });
      assert.equal(replay.idempotentReplay, true);
      assert.equal(harness.state.closings.length, 1);

      // Intento de segundo cierre en la misma jornada (mismo o distinto monto) DEBE fallar con 409
      await assert.rejects(
        () =>
          createCashClosingTransaction({
            tenantId: 'tenant-1',
            eventId: 'evt-stand-1',
            closedById: 'seller-1',
            closingType: 'DIARIO',
            totalCashReported: 130,
          }),
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /Ya existe un cierre de caja registrado para esta jornada/);
          return true;
        }
      );

      await assert.rejects(
        () =>
          createCashClosingTransaction({
            tenantId: 'tenant-1',
            eventId: 'evt-stand-1',
            closedById: 'seller-1',
            closingType: 'DIARIO',
            totalCashReported: 250,
          }),
        (err) => err.statusCode === 409
      );

      assert.equal(harness.state.updateClosingCalls, 0, 'Jamás debe invocar prisma.cashClosing.update');
    } finally {
      harness.restore();
    }
  });

  it('2. Limpieza inmediata de Nueva Venta al cerrar caja y traspaso íntegro de venta post-cierre a D+1', async () => {
    const dayD = '2026-11-16';
    const dayDPlus1 = shiftGuatemalaDateStr(dayD, 1);
    assert.equal(dayDPlus1, '2026-11-17');

    const harness = installInMemoryPrismaHarness({
      initialSales: [
        {
          id: 'sale-early',
          saleNumber: 'CAYA-0010',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          sellerId: 'seller-1',
          status: 'COMPLETADA',
          totalAmount: 125,
          balanceDue: 0,
          createdAt: `${dayD}T15:00:00.000-06:00`,
          items: [{ id: 'it-10', description: 'Póster Grande', quantity: 1, unitPrice: 125, subtotal: 125 }],
          payments: [{ id: 'p-10', method: 'EFECTIVO', amount: 125, createdAt: `${dayD}T15:00:00.000-06:00` }],
        },
        {
          id: 'sale-pending-pickup',
          saleNumber: 'REDE-0099',
          tenantId: 'tenant-1',
          eventId: 'evt-ventas-redes-online',
          pickupEventId: 'evt-stand-1',
          sellerId: 'seller-redes',
          orderType: 'REDES_PERSONALIZADO',
          status: 'EN_PROCESO',
          totalAmount: 130,
          depositAmount: 65,
          balanceDue: 65,
          createdAt: '2026-11-14T10:00:00.000-06:00',
          items: [],
          payments: [{ id: 'p-99', method: 'TRANSFERENCIA', amount: 65, createdAt: '2026-11-14T10:00:00.000-06:00' }],
        },
      ],
    });

    try {
      // Antes de cerrar D: Ventas de Hoy tiene sale-early (Q 125)
      const beforeCloseList = await getEventSalesList({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayD,
        now: new Date(`${dayD}T19:00:00.000-06:00`),
      });
      const counterBefore = beforeCloseList.sales.filter((s) => Number(s.balanceDue || 0) <= 0);
      assert.equal(counterBefore.length, 1);
      assert.equal(counterBefore[0].id, 'sale-early');
      assert.equal(counterBefore[0].isEditableInOpenShift, true);

      // Se ejecuta el cierre manual de D a las 19:30 CST
      const closingD = await createCashClosingTransaction({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        closedById: 'seller-1',
        closingType: 'DIARIO',
        totalCashReported: 125,
        date: new Date(`${dayD}T19:30:00.000-06:00`),
      });
      assert.equal(closingD.grossTotal, 125);
      assert.equal(closingD.totalCashCalculated, 125);

      // Inmediatamente después del cierre (19:31 CST): Nueva Venta queda limpia en 0 ventas de mostrador
      const afterCloseList = await getEventSalesList({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayD,
        now: new Date(`${dayD}T19:31:00.000-06:00`),
      });
      const counterAfterClose = afterCloseList.sales.filter((s) => Number(s.balanceDue || 0) <= 0);
      const pendingAfterClose = afterCloseList.sales.filter((s) => Number(s.balanceDue || 0) > 0);
      assert.equal(counterAfterClose.length, 0, 'Ventas de Hoy debe limpiarse a 0 tras el cierre');
      assert.equal(pendingAfterClose.length, 1, 'Los retiros Con Saldo deben seguir disponibles');

      const liveKpisAfterClose = await getEventKPIs({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayD,
        now: new Date(`${dayD}T19:31:00.000-06:00`),
      });
      assert.equal(liveKpisAfterClose.totalTransactions, 0);
      assert.equal(liveKpisAfterClose.totalAmount, 0);
      assert.equal(liveKpisAfterClose.shiftClosedToday, true);
      assert.equal(liveKpisAfterClose.activeShiftDate, dayDPlus1);

      // A las 19:45 CST llega un cliente de último minuto (post-cierre de D)
      harness.state.sales.push({
        id: 'sale-post-close',
        saleNumber: 'CAYA-0011',
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        sellerId: 'seller-1',
        status: 'COMPLETADA',
        totalAmount: 65,
        balanceDue: 0,
        createdAt: `${dayD}T19:45:00.000-06:00`,
        items: [{ id: 'it-11', description: 'Póster Mediano', quantity: 1, unitPrice: 65, subtotal: 65 }],
        payments: [{ id: 'p-11', method: 'EFECTIVO', amount: 65, createdAt: `${dayD}T19:45:00.000-06:00` }],
      });

      // Esa misma noche (19:50 CST), la venta post-cierre aparece en Nueva Venta marcada para D+1 y editable
      const tonightPostCloseList = await getEventSalesList({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayD,
        now: new Date(`${dayD}T19:50:00.000-06:00`),
      });
      const tonightCounter = tonightPostCloseList.sales.filter((s) => Number(s.balanceDue || 0) <= 0);
      assert.equal(tonightCounter.length, 1);
      assert.equal(tonightCounter[0].id, 'sale-post-close');
      assert.equal(tonightCounter[0].effectiveShiftDate, dayDPlus1);
      assert.equal(tonightCounter[0].isEditableInOpenShift, true);
      assert.equal(tonightCounter[0].isPostClosingRollover, true);

      // Al día siguiente D+1 (11:00 AM), se registra otra venta de Q 35 en efectivo
      harness.state.sales.push({
        id: 'sale-next-day',
        saleNumber: 'CAYA-0012',
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        sellerId: 'seller-1',
        status: 'COMPLETADA',
        totalAmount: 35,
        balanceDue: 0,
        createdAt: `${dayDPlus1}T11:00:00.000-06:00`,
        items: [{ id: 'it-12', description: 'Póster Pequeño', quantity: 1, unitPrice: 35, subtotal: 35 }],
        payments: [{ id: 'p-12', method: 'EFECTIVO', amount: 35, createdAt: `${dayDPlus1}T11:00:00.000-06:00` }],
      });

      // En D+1, tanto el listado de Nueva Venta como el KPI/Arqueo de D+1 suman ambas (Q 65 + Q 35 = Q 100)
      const nextDayList = await getEventSalesList({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayDPlus1,
        now: new Date(`${dayDPlus1}T12:00:00.000-06:00`),
      });
      const nextDayCounter = nextDayList.sales.filter((s) => Number(s.balanceDue || 0) <= 0);
      assert.deepEqual(
        nextDayCounter.map((s) => s.id),
        ['sale-next-day', 'sale-post-close']
      );
      assert.ok(nextDayCounter.every((s) => s.isEditableInOpenShift === true));

      const closingDPlus1 = await createCashClosingTransaction({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        closedById: 'seller-1',
        closingType: 'DIARIO',
        totalCashReported: 100,
        date: new Date(`${dayDPlus1}T20:00:00.000-06:00`),
      });
      assert.equal(closingDPlus1.totalSalesCount, 2);
      assert.equal(closingDPlus1.grossTotal, 100);
      assert.equal(closingDPlus1.totalCashCalculated, 100);
      assert.equal(closingDPlus1.cashDifference, 0);

      // Y el histórico contable de D conserva exactamente Q 125 sin contaminarse
      const historicalDayDKpis = await getEventKPIs({
        tenantId: 'tenant-1',
        eventId: 'evt-stand-1',
        date: dayD,
        now: new Date(`${dayDPlus1}T21:00:00.000-06:00`),
      });
      assert.equal(historicalDayDKpis.totalTransactions, 1);
      assert.equal(historicalDayDKpis.totalAmount, 125);
    } finally {
      harness.restore();
    }
  });

  it('3. Editabilidad post-cierre (200) vs Inmutabilidad pre-cierre (403) en updateSaleTransaction', async () => {
    const todayStr = getGuatemalaDayRange().targetDate;
    const yesterdayStr = shiftGuatemalaDateStr(todayStr, -1);
    const originalTx = prisma.$transaction;

    try {
      // Caso A: Venta creada HOY después del cierre de hoy -> pertenece a mañana (D+1 abierta) -> EDITABLE
      prisma.$transaction = async (cb) =>
        cb({
          sale: {
            findFirst: async () => ({
              id: 'sale-tonight-post-close',
              saleNumber: 'CAYA-0020',
              tenantId: 'tenant-1',
              eventId: 'evt-stand-1',
              sellerId: 'seller-1',
              status: 'COMPLETADA',
              totalAmount: 65,
              discount: 0,
              createdAt: `${todayStr}T20:15:00.000-06:00`,
              items: [{ id: 'it-20', description: 'Póster Mediano', quantity: 1, unitPrice: 65, subtotal: 65 }],
              payments: [{ id: 'p-20', method: 'EFECTIVO', amount: 65 }],
            }),
            update: async ({ data }) => ({
              id: 'sale-tonight-post-close',
              saleNumber: 'CAYA-0020',
              ...data,
              items: [{ id: 'it-20', description: 'Póster Grande', quantity: 1, unitPrice: 125, subtotal: 125 }],
              payments: [{ id: 'p-20', method: 'EFECTIVO', amount: 125 }],
            }),
          },
          saleItem: { update: async () => ({}), create: async () => ({}), deleteMany: async () => ({}) },
          salePayment: { update: async () => ({}), deleteMany: async () => ({}), createMany: async () => ({}) },
          auditLog: { create: async () => ({}) },
          cashClosing: {
            findFirst: async ({ where }) => {
              const todayRange = getGuatemalaDayRange(todayStr);
              if (where.closingDate.gte.getTime() === todayRange.startOfDay.getTime()) {
                return { id: 'close-today', closingType: 'DIARIO', closingDate: new Date(`${todayStr}T19:30:00.000-06:00`) };
              }
              return null; // Mañana D+1 no tiene cierre aún
            },
          },
        });

      const updatedTonight = await updateSaleTransaction({
        saleId: 'sale-tonight-post-close',
        tenantId: 'tenant-1',
        userId: 'seller-1',
        userRole: 'VENDEDOR',
        assignedEventId: 'evt-stand-1',
        items: [{ id: 'it-20', description: 'Póster Grande', quantity: 1, unitPrice: 125 }],
      });
      assert.equal(updatedTonight.totalAmount, 125);

      // Caso B: Venta creada AYER después del cierre de ayer -> pertenece a HOY (abierta) -> EDITABLE hoy
      prisma.$transaction = async (cb) =>
        cb({
          sale: {
            findFirst: async () => ({
              id: 'sale-yesterday-rollover',
              saleNumber: 'CAYA-0019',
              tenantId: 'tenant-1',
              eventId: 'evt-stand-1',
              sellerId: 'seller-1',
              status: 'COMPLETADA',
              totalAmount: 65,
              discount: 0,
              createdAt: `${yesterdayStr}T20:10:00.000-06:00`,
              items: [{ id: 'it-19', description: 'Póster Mediano', quantity: 1, unitPrice: 65, subtotal: 65 }],
              payments: [{ id: 'p-19', method: 'EFECTIVO', amount: 65 }],
            }),
            update: async ({ data }) => ({
              id: 'sale-yesterday-rollover',
              ...data,
              payments: [{ id: 'p-19', method: 'TARJETA', amount: 65 }],
            }),
          },
          salePayment: { deleteMany: async () => ({}), createMany: async () => ({}) },
          auditLog: { create: async () => ({}) },
          cashClosing: {
            findFirst: async ({ where }) => {
              const yRange = getGuatemalaDayRange(yesterdayStr);
              if (where.closingDate.gte.getTime() === yRange.startOfDay.getTime()) {
                return { id: 'close-yesterday', closingType: 'DIARIO', closingDate: new Date(`${yesterdayStr}T19:00:00.000-06:00`) };
              }
              return null; // Hoy sigue abierta
            },
          },
        });

      const updatedRollover = await updateSaleTransaction({
        saleId: 'sale-yesterday-rollover',
        tenantId: 'tenant-1',
        userId: 'seller-1',
        userRole: 'VENDEDOR',
        assignedEventId: 'evt-stand-1',
        payments: [{ method: 'TARJETA', amount: 65 }],
      });
      assert.equal(updatedRollover.id, 'sale-yesterday-rollover');

      // Caso C: Esa misma venta rollover de ayer queda BLOQUEADA (403) en cuanto HOY se cierra
      prisma.$transaction = async (cb) =>
        cb({
          sale: {
            findFirst: async () => ({
              id: 'sale-yesterday-rollover',
              tenantId: 'tenant-1',
              eventId: 'evt-stand-1',
              sellerId: 'seller-1',
              createdAt: `${yesterdayStr}T20:10:00.000-06:00`,
              totalAmount: 65,
              discount: 0,
              items: [],
              payments: [],
            }),
          },
          cashClosing: {
            findFirst: async ({ where }) => {
              const yRange = getGuatemalaDayRange(yesterdayStr);
              if (where.closingDate.gte.getTime() === yRange.startOfDay.getTime()) {
                return { id: 'close-yesterday', closingType: 'DIARIO', closingDate: new Date(`${yesterdayStr}T19:00:00.000-06:00`) };
              }
              return { id: 'close-today', closingType: 'DIARIO', closingDate: new Date(`${todayStr}T18:00:00.000-06:00`) };
            },
          },
        });

      await assert.rejects(
        () =>
          updateSaleTransaction({
            saleId: 'sale-yesterday-rollover',
            tenantId: 'tenant-1',
            userId: 'seller-1',
            notes: 'Intento tardío',
          }),
        (err) => err.statusCode === 403
      );
    } finally {
      prisma.$transaction = originalTx;
    }
  });

  it('4. Corte automático puntual a las 11:59 PM CST (23:59 America/Guatemala) y respeto a ventas rollover', async () => {
    const dayD = '2026-11-16';
    const parts2359 = getGuatemalaClockParts(new Date(`${dayD}T23:59:15.000-06:00`));
    assert.deepEqual(
      { dateStr: parts2359.dateStr, hour: parts2359.hour, minute: parts2359.minute },
      { dateStr: '2026-11-16', hour: 23, minute: 59 }
    );

    // Escenario A: Stand sin cierre manual en D -> a las 23:58 no cierra, a las 23:59 sí cierra automáticamente
    const harnessUnclosed = installInMemoryPrismaHarness({
      events: [
        { id: 'evt-stand-1', name: 'Feria Miraflores', tenantId: 'tenant-1', status: 'ACTIVO' },
        { id: 'evt-ventas-redes-online', name: 'Ventas en Línea', tenantId: 'tenant-1', status: 'ACTIVO' },
      ],
      initialSales: [
        {
          id: 'sale-open-d',
          saleNumber: 'MIRA-0001',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          sellerId: 'seller-1',
          status: 'COMPLETADA',
          totalAmount: 210,
          balanceDue: 0,
          createdAt: `${dayD}T16:20:00.000-06:00`,
          items: [{ id: 'i1', description: 'Póster Gigante', quantity: 1, unitPrice: 210, subtotal: 210 }],
          payments: [{ id: 'p1', method: 'EFECTIVO', amount: 210, createdAt: `${dayD}T16:20:00.000-06:00` }],
        },
      ],
    });

    try {
      const before2359 = await runMidnightClosingAudit({ now: new Date(`${dayD}T23:58:40.000-06:00`) });
      assert.equal(before2359.closingsCreated, 0, 'No debe cerrar la jornada actual antes de las 23:59 CST');

      const at2359 = await runMidnightClosingAudit({ now: new Date(`${dayD}T23:59:10.000-06:00`) });
      assert.equal(at2359.closingsCreated, 1, 'Debe generar cierre automático puntual a las 23:59 CST');
      assert.equal(harnessUnclosed.state.closings.length, 1);
      assert.equal(harnessUnclosed.state.closings[0].closingType, 'AUTOMATICO_MEDIANOCHE');
      assert.equal(harnessUnclosed.state.closings[0].grossTotal, 210);

      // Si vuelve a correr en el mismo minuto 23:59, no duplica el cierre
      const repeat2359 = await runMidnightClosingAudit({ now: new Date(`${dayD}T23:59:45.000-06:00`) });
      assert.equal(repeat2359.closingsCreated, 0);
      assert.equal(harnessUnclosed.state.closings.length, 1);
    } finally {
      harnessUnclosed.restore();
    }

    // Escenario B: Stand que cerró manualmente a las 19:30 y tuvo venta post-cierre a las 19:45:
    // a las 23:59 de D NO genera segundo cierre en D, y a las 23:59 de D+1 SÍ cierra D+1 con esa venta rollover
    const dayDPlus1 = '2026-11-17';
    const harnessRollover = installInMemoryPrismaHarness({
      initialSales: [
        {
          id: 'sale-d-closed',
          saleNumber: 'CAYA-0001',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          sellerId: 'seller-1',
          status: 'COMPLETADA',
          totalAmount: 100,
          balanceDue: 0,
          createdAt: `${dayD}T14:00:00.000-06:00`,
          items: [{ id: 'i1', description: 'Póster', quantity: 1, unitPrice: 100, subtotal: 100 }],
          payments: [{ id: 'p1', method: 'EFECTIVO', amount: 100, createdAt: `${dayD}T14:00:00.000-06:00` }],
        },
        {
          id: 'sale-d-late',
          saleNumber: 'CAYA-0002',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          sellerId: 'seller-1',
          status: 'COMPLETADA',
          totalAmount: 65,
          balanceDue: 0,
          createdAt: `${dayD}T19:45:00.000-06:00`,
          items: [{ id: 'i2', description: 'Póster Mediano', quantity: 1, unitPrice: 65, subtotal: 65 }],
          payments: [{ id: 'p2', method: 'EFECTIVO', amount: 65, createdAt: `${dayD}T19:45:00.000-06:00` }],
        },
      ],
      initialClosings: [
        {
          id: 'manual-closing-d',
          tenantId: 'tenant-1',
          eventId: 'evt-stand-1',
          closingType: 'DIARIO',
          closingDate: new Date(`${dayD}T19:30:00.000-06:00`),
          grossTotal: 100,
          totalCashCalculated: 100,
          totalCashReported: 100,
          cashDifference: 0,
          totalSalesCount: 1,
        },
      ],
    });

    try {
      const dNight = await runMidnightClosingAudit({ now: new Date(`${dayD}T23:59:20.000-06:00`) });
      assert.equal(dNight.closingsCreated, 0, 'No debe tocar D ni cerrar prematuramente D+1 en la noche de D');

      const dPlus1Night = await runMidnightClosingAudit({ now: new Date(`${dayDPlus1}T23:59:20.000-06:00`) });
      assert.equal(dPlus1Night.closingsCreated, 1, 'A las 23:59 de D+1 debe cerrar D+1 incluyendo la venta rollover');
      assert.equal(harnessRollover.state.closings.length, 2);
      assert.equal(harnessRollover.state.closings[1].grossTotal, 65);
    } finally {
      harnessRollover.restore();
    }
  });

  it('5. Contratos Frontend: EventSalesModal agrupa ventas post-cierre en D+1 y RecentSaleRow habilita Editar en turno abierto', () => {
    const modalCode = fs.readFileSync(path.join(ROOT, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');
    assert.ok(modalCode.includes('shiftGuatemalaDateStr(rawDateStr, 1)'), 'EventSalesModal debe desplazar ventas post-cierre a D+1');
    assert.ok(modalCode.includes('new Date(sale.createdAt).getTime() > new Date(dayClosing.closingDate).getTime()'));

    const rowCode = fs.readFileSync(path.join(ROOT, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
    assert.ok(rowCode.includes('isSaleEditableInOpenShift(sale, standEventId)'), 'RecentSaleRow debe habilitar edición por jornada abierta');
    assert.ok(rowCode.includes('↪ Jornada siguiente'), 'RecentSaleRow debe señalizar ventas cargadas a la jornada siguiente');

    const indexCode = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf-8');
    assert.ok(indexCode.includes('hour === 23 && minute === 59'), 'server/index.js debe vigilar puntualmente las 23:59 CST');
  });
});
