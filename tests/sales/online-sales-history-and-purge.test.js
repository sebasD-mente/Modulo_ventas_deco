import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../server/config/prisma.js';
import { getEventSalesList, getGuatemalaMonthRange } from '../../server/services/sales/saleKpiService.js';
import { purgeEventSalesTransaction } from '../../server/services/sales/salePurgeService.js';

const rootDir = process.cwd();

describe('Historial Mensual de Ventas en Línea, Fix React #310 y Sin UI Destructiva', () => {
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

  it('4. No existe botón Reiniciar en 0 ni endpoint/servicio de borrado masivo para Ventas en Línea y se preserva 403 en purgeEventSalesTransaction', async () => {
    const eventsView = fs.readFileSync(path.join(rootDir, 'src/components/EventsManagementView.jsx'), 'utf-8');
    assert.ok(!eventsView.includes('Reiniciar en 0'), 'No debe existir botón Reiniciar en 0 en EventsManagementView.jsx');
    assert.ok(!eventsView.includes('handleConfirmOnlineReset'), 'No debe existir handleConfirmOnlineReset');
    assert.ok(!eventsView.includes('isConfirmingOnlineReset'), 'No debe existir modal isConfirmingOnlineReset');
    assert.ok(!eventsView.includes('purge-online-test-data'), 'No debe llamarse a /api/sales/purge-online-test-data desde UI');

    const apiRoutes = fs.readFileSync(path.join(rootDir, 'server/routes/apiRoutes.js'), 'utf-8');
    const saleController = fs.readFileSync(path.join(rootDir, 'server/controllers/saleController.js'), 'utf-8');
    const saleService = fs.readFileSync(path.join(rootDir, 'server/services/saleService.js'), 'utf-8');
    const salePurgeService = fs.readFileSync(path.join(rootDir, 'server/services/sales/salePurgeService.js'), 'utf-8');

    assert.ok(!apiRoutes.includes('purge-online-test-data'), 'No debe existir ruta /sales/purge-online-test-data');
    assert.ok(!apiRoutes.includes('purgeOnlinePosTestData'), 'No debe importarse purgeOnlinePosTestData en apiRoutes.js');
    assert.ok(!saleController.includes('purgeOnlinePosTestData'), 'No debe existir purgeOnlinePosTestData en saleController.js');
    assert.ok(!saleService.includes('purgeOnlinePosTestDataTransaction'), 'No debe re-exportarse purgeOnlinePosTestDataTransaction');
    assert.ok(!salePurgeService.includes('purgeOnlinePosTestDataTransaction'), 'No debe existir purgeOnlinePosTestDataTransaction en salePurgeService.js');

    const origTx = prisma.$transaction;
    prisma.$transaction = async (fn) => fn({
      event: { findFirst: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea y Redes Sociales' }) },
    });
    try {
      await assert.rejects(
        () => purgeEventSalesTransaction({ tenantId: 't-1', eventId: 'evt-ventas-redes-online', userId: 'u-admin' }),
        (err) => err?.statusCode === 403
      );
    } finally {
      prisma.$transaction = origTx;
    }
  });
});
