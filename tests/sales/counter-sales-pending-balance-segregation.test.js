import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import {
  isPhysicalStandEvent,
  partitionEventSalesForPos,
  resolveStandSaleDisplay,
} from '../../src/utils/counterSalesFilter.js';
import { prisma } from '../../server/config/prisma.js';
import { getEventSalesList } from '../../server/services/sales/saleKpiService.js';
import { registerBalancePayment } from '../../server/services/sales/remoteSaleService.js';

describe('🧾 Segregación Estricta de Ventas de Mostrador vs Con Saldo (feat-005)', () => {
  describe('1. Segregación del listado por defecto y pestaña Con Saldo (partitionEventSalesForPos)', () => {
    const standEventId = 'evt-feria-cayala';
    const sellerA = { id: 'usr-mostrador-a', fullName: 'Ana Mostrador', role: 'VENDEDOR' };
    const sellerB = { id: 'usr-mostrador-b', fullName: 'Carlos Mostrador', role: 'VENDEDOR' };

    const sampleSales = [
      {
        id: 'sale-pos-a',
        saleNumber: 'VENT-0001',
        status: 'COMPLETADA',
        orderType: 'FERIA',
        eventId: standEventId,
        sellerId: sellerA.id,
        totalAmount: 105,
        balanceDue: 0,
        paymentStatus: 'PAGADO_TOTAL',
        payments: [{ id: 'p1', method: 'EFECTIVO', amount: 105, reference: null }],
      },
      {
        id: 'sale-pos-b',
        saleNumber: 'VENT-0002',
        status: 'COMPLETADA',
        orderType: 'FERIA',
        eventId: standEventId,
        sellerId: sellerB.id,
        totalAmount: 55,
        balanceDue: 0,
        paymentStatus: 'PAGADO_TOTAL',
        payments: [{ id: 'p2', method: 'TARJETA', amount: 55, reference: null }],
      },
      {
        id: 'sale-redes-pending-here',
        saleNumber: 'VENT-0004',
        status: 'EN_PROCESO',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: standEventId,
        sellerId: 'usr-redes-1',
        totalAmount: 140,
        depositAmount: 70,
        balanceDue: 70,
        paymentStatus: 'ANTICIPO_PAGADO',
        payments: [{ id: 'p4', method: 'TARJETA', amount: 70, reference: 'Anticipo 50%' }],
      },
      {
        id: 'sale-redes-pending-other-stand',
        saleNumber: 'VENT-0005',
        status: 'EN_PROCESO',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: 'evt-feria-miraflores',
        sellerId: 'usr-redes-1',
        totalAmount: 100,
        depositAmount: 50,
        balanceDue: 50,
        paymentStatus: 'ANTICIPO_PAGADO',
        payments: [{ id: 'p5', method: 'TRANSFERENCIA', amount: 50, reference: 'Anticipo' }],
      },
      {
        id: 'sale-redes-settled-by-a',
        saleNumber: 'VENT-0006',
        status: 'COMPLETADA',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: standEventId,
        sellerId: 'usr-redes-1',
        balanceCollectedById: sellerA.id,
        standCollectedAmount: 70,
        totalAmount: 140,
        depositAmount: 140,
        balanceDue: 0,
        paymentStatus: 'PAGADO_TOTAL',
        payments: [
          { id: 'p6-dep', method: 'TARJETA', amount: 70, reference: 'Anticipo Redes' },
          { id: 'p6-sal', method: 'EFECTIVO', amount: 70, reference: '[SALDO]' },
        ],
      },
      {
        id: 'sale-redes-settled-by-b',
        saleNumber: 'VENT-0007',
        status: 'COMPLETADA',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: standEventId,
        sellerId: 'usr-redes-1',
        balanceCollectedById: sellerB.id,
        standCollectedAmount: 50,
        totalAmount: 100,
        depositAmount: 100,
        balanceDue: 0,
        paymentStatus: 'PAGADO_TOTAL',
        payments: [
          { id: 'p7-dep', method: 'TRANSFERENCIA', amount: 50, reference: 'Anticipo Redes' },
          { id: 'p7-sal', method: 'EFECTIVO', amount: 50, reference: '[SALDO]' },
        ],
      },
      {
        id: 'sale-voided',
        saleNumber: 'VENT-0008',
        status: 'ANULADA',
        orderType: 'FERIA',
        eventId: standEventId,
        sellerId: sellerA.id,
        totalAmount: 35,
        balanceDue: 0,
      },
    ];

    it('1.1. Para vendedor de mostrador (VENDEDOR), el listado por defecto excluye toda orden con saldo pendiente y aísla sus propios cobros', () => {
      assert.strictEqual(isPhysicalStandEvent(standEventId), true);
      assert.strictEqual(isPhysicalStandEvent('evt-ventas-redes-online'), false);

      const { isStandPos, defaultSales, pendingSales } = partitionEventSalesForPos({
        sales: sampleSales,
        eventId: standEventId,
        user: sellerA,
        isVendedor: true,
        isSuperAdmin: false,
      });

      assert.strictEqual(isStandPos, true);
      assert.deepStrictEqual(
        defaultSales.map((s) => s.saleNumber),
        ['VENT-0001', 'VENT-0006'],
        'El listado por defecto solo debe incluir ventas cobradas al momento por Ana y saldos liquidados por Ana'
      );
      assert.ok(
        defaultSales.every((s) => Number(s.balanceDue || 0) <= 0),
        'Ninguna venta con saldo pendiente puede mezclarse en el listado por defecto'
      );
      assert.deepStrictEqual(
        pendingSales.map((s) => s.saleNumber),
        ['VENT-0004'],
        'La pestaña Con Saldo solo debe listar órdenes con saldo pendiente asignadas a este punto de venta'
      );
    });

    it('1.2. Para SUPER_ADMIN en un stand físico, el listado por defecto muestra todos los cobros del stand sin mezclar pendientes', () => {
      const { defaultSales, pendingSales } = partitionEventSalesForPos({
        sales: sampleSales,
        eventId: standEventId,
        user: { id: 'usr-admin', fullName: 'Admin', role: 'SUPER_ADMIN' },
        isVendedor: true,
        isSuperAdmin: true,
      });

      assert.deepStrictEqual(
        defaultSales.map((s) => s.saleNumber),
        ['VENT-0001', 'VENT-0002', 'VENT-0006', 'VENT-0007']
      );
      assert.deepStrictEqual(
        pendingSales.map((s) => s.saleNumber),
        ['VENT-0004']
      );
    });

    it('1.3. Resuelve atribución por sello forense en notes cuando balanceCollectedById no está presente', () => {
      const legacySettled = [
        {
          id: 'sale-legacy-saldo',
          saleNumber: 'VENT-0099',
          status: 'COMPLETADA',
          orderType: 'REDES_PERSONALIZADO',
          eventId: 'evt-ventas-redes-online',
          pickupEventId: standEventId,
          sellerId: 'usr-redes-1',
          totalAmount: 140,
          balanceDue: 0,
          notes: '[Saldo Q70.00 cobrado por: Ana Mostrador (VENDEDOR)]',
          payments: [{ id: 'p99', method: 'EFECTIVO', amount: 70, reference: '[SALDO]' }],
        },
      ];

      const forAna = partitionEventSalesForPos({
        sales: legacySettled,
        eventId: standEventId,
        user: sellerA,
        isVendedor: true,
        isSuperAdmin: false,
      });
      const forCarlos = partitionEventSalesForPos({
        sales: legacySettled,
        eventId: standEventId,
        user: sellerB,
        isVendedor: true,
        isSuperAdmin: false,
      });

      assert.strictEqual(forAna.defaultSales.length, 1);
      assert.strictEqual(forCarlos.defaultSales.length, 0);
    });

    it('1.4. En el POS Digital Permanente (evt-ventas-redes-online), conserva las órdenes creadas por VENDEDOR_REDES', () => {
      const redesSales = [sampleSales[2], sampleSales[3]];
      const { isStandPos, defaultSales, pendingSales } = partitionEventSalesForPos({
        sales: redesSales,
        eventId: 'evt-ventas-redes-online',
        user: { id: 'usr-redes-1', fullName: 'Sofía Redes', role: 'VENDEDOR_REDES' },
        isVendedor: false,
        isSuperAdmin: false,
      });

      assert.strictEqual(isStandPos, false);
      assert.strictEqual(defaultSales.length, 2);
      assert.strictEqual(pendingSales.length, 2);
    });
  });

  describe('2. Presentación por Valor del Saldo Cobrado en Mostrador (resolveStandSaleDisplay)', () => {
    it('2.1. Mientras la orden tiene saldo pendiente en Con Saldo, muestra Total de la orden y abono previo', () => {
      const pendingOrder = {
        saleNumber: 'VENT-0004',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: 'evt-feria-cayala',
        totalAmount: 140,
        depositAmount: 70,
        balanceDue: 70,
        createdAt: '2026-10-26T23:31:00.000Z',
        payments: [{ id: 'dep-1', method: 'TARJETA', amount: 70, reference: 'Anticipo' }],
      };

      const display = resolveStandSaleDisplay(pendingOrder, 'evt-feria-cayala');
      assert.strictEqual(display.hasBalance, true);
      assert.strictEqual(display.isStandBalanceCollection, false);
      assert.strictEqual(display.displayedAmount, 140);
      assert.strictEqual(display.previousDepositAmount, 0);
      assert.strictEqual(display.displayedPayments.length, 1);
    });

    it('2.2. Al ser liquidada en mostrador, muestra estrictamente el saldo cobrado (Q 70.00), pago [SALDO] y hora de cobro', () => {
      const settledOrder = {
        saleNumber: 'VENT-0004',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: 'evt-feria-cayala',
        totalAmount: 140,
        depositAmount: 140,
        balanceDue: 0,
        createdAt: '2026-10-26T23:31:00.000Z',
        payments: [
          { id: 'dep-1', method: 'TARJETA', amount: 70, reference: 'Anticipo Redes', createdAt: '2026-10-26T23:31:00.000Z' },
          { id: 'sal-1', method: 'EFECTIVO', amount: 70, reference: '[SALDO]', createdAt: '2026-11-05T14:10:00.000Z' },
        ],
      };

      const display = resolveStandSaleDisplay(settledOrder, 'evt-feria-cayala');
      assert.strictEqual(display.hasBalance, false);
      assert.strictEqual(display.isStandBalanceCollection, true);
      assert.strictEqual(display.displayedAmount, 70);
      assert.strictEqual(display.previousDepositAmount, 70);
      assert.strictEqual(display.displayedPayments.length, 1);
      assert.strictEqual(display.displayedPayments[0].method, 'EFECTIVO');
      assert.strictEqual(display.displayedPayments[0].amount, 70);
      assert.strictEqual(display.displayedTimestamp, '2026-11-05T14:10:00.000Z');
    });

    it('2.3. Soporta cobro de saldo dividido en múltiples métodos de pago en mostrador', () => {
      const splitSettledOrder = {
        saleNumber: 'VENT-0010',
        orderType: 'REDES_PERSONALIZADO',
        eventId: 'evt-ventas-redes-online',
        pickupEventId: 'evt-feria-cayala',
        totalAmount: 140,
        balanceDue: 0,
        payments: [
          { id: 'dep-1', method: 'TRANSFERENCIA', amount: 70, reference: 'Anticipo' },
          { id: 'sal-1', method: 'EFECTIVO', amount: 40, reference: '[SALDO]' },
          { id: 'sal-2', method: 'TARJETA', amount: 30, reference: 'POS [SALDO]' },
        ],
      };

      const display = resolveStandSaleDisplay(splitSettledOrder, 'evt-feria-cayala');
      assert.strictEqual(display.isStandBalanceCollection, true);
      assert.strictEqual(display.displayedAmount, 70);
      assert.strictEqual(display.previousDepositAmount, 70);
      assert.strictEqual(display.displayedPayments.length, 2);
    });
  });

  describe('3. Integración de Servicios Backend (getEventSalesList & registerBalancePayment)', () => {
    it('3.1. getEventSalesList enriquece órdenes liquidadas en stand con standCollectedAmount y balanceCollectedById desde AuditLog', async () => {
      const origCount = prisma.sale.count;
      const origFindMany = prisma.sale.findMany;
      const origAuditFindMany = prisma.auditLog.findMany;

      let capturedWhere = null;
      prisma.sale.count = async ({ where }) => {
        capturedWhere = where;
        return 2;
      };
      prisma.sale.findMany = async () => [
        {
          id: 'sale-direct-today',
          saleNumber: 'VENT-0100',
          eventId: 'evt-feria-cayala',
          pickupEventId: null,
          sellerId: 'usr-mostrador-a',
          orderType: 'FERIA',
          totalAmount: 55,
          balanceDue: 0,
          createdAt: '2026-11-05T15:00:00.000Z',
          payments: [{ id: 'p-100', method: 'EFECTIVO', amount: 55, reference: null, createdAt: '2026-11-05T15:00:00.000Z' }],
          items: [],
        },
        {
          id: 'sale-pickup-settled',
          saleNumber: 'VENT-0004',
          eventId: 'evt-ventas-redes-online',
          pickupEventId: 'evt-feria-cayala',
          sellerId: 'usr-redes-1',
          orderType: 'REDES_PERSONALIZADO',
          totalAmount: 140,
          balanceDue: 0,
          createdAt: '2026-10-26T23:31:00.000Z',
          payments: [
            { id: 'p-dep', method: 'TARJETA', amount: 70, reference: 'Anticipo', createdAt: '2026-10-26T23:31:00.000Z' },
            { id: 'p-sal', method: 'EFECTIVO', amount: 70, reference: '[SALDO]', createdAt: '2026-11-05T16:30:00.000Z' },
          ],
          items: [],
        },
      ];
      prisma.auditLog.findMany = async () => [
        { entityId: 'sale-pickup-settled', userId: 'usr-mostrador-a' },
      ];

      try {
        const res = await getEventSalesList({
          tenantId: 'tenant-1',
          eventId: 'evt-feria-cayala',
          date: '2026-11-05',
        });

        assert.ok(Array.isArray(capturedWhere?.OR), 'Debe construir cláusula OR para stand físico');
        assert.strictEqual(capturedWhere.OR[2].balanceDue?.lte, 0, 'La rama 3 debe exigir balanceDue <= 0');

        // VENT-0004 fue cobrada a las 16:30 UTC (más reciente que VENT-0100 a las 15:00 UTC)
        assert.strictEqual(res.sales[0].saleNumber, 'VENT-0004');
        assert.strictEqual(res.sales[0].standCollectedAmount, 70);
        assert.strictEqual(res.sales[0].balanceCollectedById, 'usr-mostrador-a');
        assert.strictEqual(res.sales[0].standCollectedPayments.length, 1);
        assert.strictEqual(res.sales[0].standCollectedPayments[0].amount, 70);
      } finally {
        prisma.sale.count = origCount;
        prisma.sale.findMany = origFindMany;
        prisma.auditLog.findMany = origAuditFindMany;
      }
    });

    it('3.2. registerBalancePayment estampa [SALDO] y devuelve standCollectedAmount y balanceCollectedById al liquidar en mostrador', async () => {
      let createdPayments = [];
      const mockTx = {
        salePayment: {
          findUnique: async () => null,
          createMany: async ({ data }) => {
            createdPayments = data.map((d, i) => ({
              id: `pay-${i + 1}`,
              ...d,
              createdAt: '2026-11-05T17:00:00.000Z',
            }));
            return { count: data.length };
          },
        },
        sale: {
          findFirst: async () => ({
            id: 'sale-0004',
            tenantId: 'tenant-1',
            saleNumber: 'VENT-0004',
            status: 'EN_PROCESO',
            paymentStatus: 'ANTICIPO_PAGADO',
            eventId: 'evt-ventas-redes-online',
            pickupEventId: 'evt-feria-cayala',
            totalAmount: 140,
            depositAmount: 70,
            balanceDue: 70,
            notes: null,
          }),
          updateMany: async () => ({ count: 1 }),
          update: async ({ data }) => ({
            id: 'sale-0004',
            saleNumber: 'VENT-0004',
            orderType: 'REDES_PERSONALIZADO',
            eventId: 'evt-ventas-redes-online',
            pickupEventId: 'evt-feria-cayala',
            totalAmount: 140,
            ...data,
            items: [{ id: 'it-1', description: 'Póster Iron Man', quantity: 1, subtotal: 35 }],
            payments: [
              { id: 'pay-0', method: 'TARJETA', amount: 70, reference: 'Anticipo' },
              ...createdPayments,
            ],
          }),
        },
        user: {
          findUnique: async () => ({ id: 'usr-mostrador-a', fullName: 'Ana Mostrador', role: 'VENDEDOR' }),
        },
        auditLog: {
          create: async () => ({ id: 'log-1' }),
        },
      };

      const result = await registerBalancePayment({
        tenantId: 'tenant-1',
        saleId: 'sale-0004',
        sellerId: 'usr-mostrador-a',
        userRole: 'VENDEDOR',
        assignedEventId: 'evt-feria-cayala',
        payments: [{ method: 'EFECTIVO', amount: 70 }],
        tx: mockTx,
      });

      assert.strictEqual(createdPayments.length, 1);
      assert.strictEqual(createdPayments[0].reference, '[SALDO]');
      assert.strictEqual(result.balanceDue, 0);
      assert.strictEqual(result.standCollectedAmount, 70);
      assert.strictEqual(result.balanceCollectedById, 'usr-mostrador-a');
      assert.strictEqual(result.standCollectedPayments.length, 1);
      assert.strictEqual(result.standCollectedPayments[0].amount, 70);
    });

    it('3.3. registerBalancePayment también sella [SALDO] si una orden PENDIENTE_PAGO se liquida al 100% en el stand de entrega', async () => {
      let createdPayments = [];
      const mockTx = {
        salePayment: {
          findUnique: async () => null,
          createMany: async ({ data }) => {
            createdPayments = data.map((d, i) => ({ id: `pay-full-${i + 1}`, ...d }));
            return { count: data.length };
          },
        },
        saleItem: {
          findMany: async () => [],
          updateMany: async () => ({ count: 0 }),
        },
        sale: {
          findFirst: async () => ({
            id: 'sale-0009',
            tenantId: 'tenant-1',
            saleNumber: 'VENT-0009',
            status: 'PENDIENTE',
            paymentStatus: 'PENDIENTE_PAGO',
            orderType: 'REDES_PERSONALIZADO',
            eventId: 'evt-ventas-redes-online',
            pickupEventId: 'evt-feria-cayala',
            totalAmount: 100,
            depositAmount: 0,
            balanceDue: 100,
            notes: null,
          }),
          updateMany: async () => ({ count: 1 }),
          update: async ({ data }) => ({
            id: 'sale-0009',
            saleNumber: 'VENT-0009',
            orderType: 'REDES_PERSONALIZADO',
            eventId: 'evt-ventas-redes-online',
            pickupEventId: 'evt-feria-cayala',
            totalAmount: 100,
            ...data,
            items: [],
            payments: createdPayments,
          }),
        },
        user: {
          findUnique: async () => ({ id: 'usr-mostrador-a', fullName: 'Ana Mostrador', role: 'VENDEDOR' }),
        },
        auditLog: {
          create: async () => ({ id: 'log-2' }),
        },
      };

      const result = await registerBalancePayment({
        tenantId: 'tenant-1',
        saleId: 'sale-0009',
        sellerId: 'usr-mostrador-a',
        userRole: 'VENDEDOR',
        assignedEventId: 'evt-feria-cayala',
        payments: [{ method: 'TARJETA', amount: 100 }],
        tx: mockTx,
      });

      assert.strictEqual(createdPayments[0].reference, '[SALDO]');
      assert.strictEqual(result.standCollectedAmount, 100);
      assert.strictEqual(result.balanceCollectedById, 'usr-mostrador-a');
    });
  });

  describe('4. Contratos de UI y Accesibilidad en RecentSalesList.jsx y RecentSaleRow.jsx', () => {
    it('4.1. RecentSalesList.jsx elimina la pestaña "Todas" y conserva únicamente el botón conmutable "⏳ Con Saldo" con aria-pressed y >= 44px', () => {
      const listCode = fs.readFileSync(path.join(ROOT, 'src/components/RecentSalesList.jsx'), 'utf-8');
      assert.ok(!listCode.includes('Todas ('), 'No debe existir el botón/pestaña "Todas (...)"');
      assert.ok(listCode.includes('⏳ Con Saldo ({pendingCount})'), 'Debe existir la pestaña única "⏳ Con Saldo"');
      assert.ok(listCode.includes('aria-pressed={showPendingOnly}'), 'El botón conmutable debe declarar aria-pressed');
      assert.ok(listCode.includes('min-h-[44px]'), 'El botón debe respetar objetivo táctil >= 44px');
      assert.ok(listCode.includes('Ventas de Hoy ({defaultSales.length})'), 'El contador del encabezado debe reflejar únicamente defaultSales');
    });

    it('4.2. RecentSaleRow.jsx presenta "Saldo cobrado:" y displayedAmount cuando la orden fue liquidada en mostrador', () => {
      const rowCode = fs.readFileSync(path.join(ROOT, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      assert.ok(rowCode.includes("isStandBalanceCollection ? 'Saldo cobrado:' : 'Total:'"), 'Debe etiquetar explícitamente Saldo cobrado:');
      assert.ok(rowCode.includes('Q {displayedAmount.toFixed(2)}'), 'Debe renderizar el monto cobrado en mostrador');
      assert.ok(rowCode.includes('✅ Saldo cobrado'), 'Debe incluir distintivo visual de saldo cobrado');
    });
  });
});
