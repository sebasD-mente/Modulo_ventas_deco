import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../server/config/prisma.js';
import { getEventSalesList, getGuatemalaMonthRange } from '../../server/services/sales/saleKpiService.js';
import { purgeOnlinePosTestDataTransaction } from '../../server/services/sales/salePurgeService.js';

const rootDir = process.cwd();

describe('Historial Mensual de Ventas en Línea, Fix React #310 y Limpieza en 0', () => {
  it('1. EventSalesModal.jsx ejecuta todos los hooks antes del retorno temprano (sin React error #310)', () => {
    const content = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');
    const earlyReturnIdx = content.indexOf('if (!event) return null;');
    assert.ok(earlyReturnIdx > -1, 'Debe existir el retorno temprano if (!event) return null;');

    const afterReturn = content.slice(earlyReturnIdx);
    assert.ok(!/\buseState\s*\(/.test(afterReturn), 'No debe haber useState después de if (!event) return null;');
    assert.ok(!/\buseMemo\s*\(/.test(afterReturn), 'No debe haber useMemo después de if (!event) return null;');
    assert.ok(!/\buseEffect\s*\(/.test(afterReturn), 'No debe haber useEffect después de if (!event) return null;');
  });

  it('2. OnlineSalesHistoryModal.jsx integra selector de mes, estado de pago, comisión y entrega', () => {
    const content = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/OnlineSalesHistoryModal.jsx'), 'utf-8');
    assert.match(content, /type="month"/);
    assert.match(content, /shiftMonth/);
    assert.match(content, /Pagado Total/);
    assert.match(content, /Saldo Pendiente/);
    assert.match(content, /Comisión Pagada/);
    assert.match(content, /commissionSettlement/);
    assert.match(content, /deliveryMethod/);
    assert.match(content, /shippingTrackingNumber/);
  });

  it('3. getGuatemalaMonthRange y getEventSalesList filtran por mes e incluyen cliente, stand de retiro y comisión', async () => {
    const range = getGuatemalaMonthRange('2026-02');
    assert.equal(range.targetMonth, '2026-02');
    assert.equal(range.startOfMonth.toISOString(), '2026-02-01T06:00:00.000Z');
    assert.equal(range.endOfMonth.toISOString(), '2026-03-01T05:59:59.999Z');

    const origCount = prisma.sale.count;
    const origFindMany = prisma.sale.findMany;
    let capturedWhere = null;
    let capturedInclude = null;

    prisma.sale.count = async ({ where }) => {
      capturedWhere = where;
      return 1;
    };
    prisma.sale.findMany = async ({ include }) => {
      capturedInclude = include;
      return [{ id: 's-1', eventId: 'evt-ventas-redes-online', totalAmount: 150, balanceDue: 0 }];
    };

    try {
      const res = await getEventSalesList({
        tenantId: 't-1',
        eventId: 'evt-ventas-redes-online',
        month: '2026-02',
        limit: 500,
      });
      assert.equal(res.sales.length, 1);
      assert.equal(capturedWhere.eventId, 'evt-ventas-redes-online');
      assert.equal(capturedWhere.createdAt.gte.toISOString(), '2026-02-01T06:00:00.000Z');
      assert.equal(capturedWhere.createdAt.lte.toISOString(), '2026-03-01T05:59:59.999Z');
      assert.ok(capturedInclude.customer, 'Debe incluir relación customer');
      assert.ok(capturedInclude.pickupEvent, 'Debe incluir relación pickupEvent');
      assert.ok(capturedInclude.commissionSettlement, 'Debe incluir relación commissionSettlement');
    } finally {
      prisma.sale.count = origCount;
      prisma.sale.findMany = origFindMany;
    }
  });

  it('4. purgeOnlinePosTestDataTransaction limpia ventas de redes, clientes huérfanos, liquidaciones, cierres y secuencia', async () => {
    const origTx = prisma.$transaction;
    const calls = [];

    prisma.$transaction = async (fn) => {
      const tx = {
        event: {
          findFirst: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea y Redes Sociales' }),
          update: async (args) => { calls.push({ op: 'event.update', args }); return args; },
        },
        sale: {
          count: async () => 12,
          deleteMany: async (args) => { calls.push({ op: 'sale.deleteMany', args }); return { count: 12 }; },
        },
        cashClosing: {
          deleteMany: async (args) => { calls.push({ op: 'cashClosing.deleteMany', args }); return { count: 3 }; },
        },
        printSheet: {
          deleteMany: async (args) => { calls.push({ op: 'printSheet.deleteMany', args }); return { count: 2 }; },
        },
        commissionSettlement: {
          deleteMany: async (args) => { calls.push({ op: 'commissionSettlement.deleteMany', args }); return { count: 1 }; },
        },
        customer: {
          deleteMany: async (args) => { calls.push({ op: 'customer.deleteMany', args }); return { count: 9 }; },
        },
        $executeRawUnsafe: async (sql) => { calls.push({ op: '$executeRawUnsafe', sql }); },
        auditLog: {
          create: async (args) => { calls.push({ op: 'auditLog.create', args }); return args; },
        },
      };
      return await fn(tx);
    };

    try {
      const result = await purgeOnlinePosTestDataTransaction({ tenantId: 't-1', userId: 'u-admin' });
      assert.equal(result.purgedSalesCount, 12);
      assert.equal(result.purgedCustomersCount, 9);
      assert.equal(result.purgedClosingsCount, 3);
      assert.equal(result.currentSaleSequence, 0);

      assert.ok(calls.some((c) => c.op === 'sale.deleteMany'));
      assert.ok(calls.some((c) => c.op === 'customer.deleteMany'));
      assert.ok(calls.some((c) => c.op === 'commissionSettlement.deleteMany'));
      assert.ok(calls.some((c) => c.op === 'event.update' && c.args.data.currentSaleSequence === 0));
      assert.ok(calls.some((c) => c.op === 'auditLog.create' && c.args.data.action === 'VENTAS_REDES_PRUEBA_PURGADAS'));
    } finally {
      prisma.$transaction = origTx;
    }
  });
});
