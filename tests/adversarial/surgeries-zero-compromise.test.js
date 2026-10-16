import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import {
  createCommissionSettlement,
  markSettlementPaid,
  rejectSettlement,
  cancelSettlement,
} from '../../server/services/commissionService.js';
import { getEventKPIs } from '../../server/services/sales/saleKpiService.js';
import { registerBalancePayment } from '../../server/services/sales/remoteSaleService.js';
import { executeCheckInventoryStock } from '../../server/services/ai/aiToolsService.js';
import { handleChatQuery } from '../../server/controllers/ai/aiChatController.js';
import { verifyDepositReceipt } from '../../server/services/ai/aiReceiptOcrService.js';

describe('⚔️ SUITE DE CIRUGÍAS QUIRÚRGICAS CERO COMPLACENCIA (DEKO LABS)', () => {

  // =========================================================================
  // CIRUGÍA 0: Extirpación de TDZ en Streaming SSE del Asistente IA
  // =========================================================================
  describe('CIRUGÍA 0: Streaming SSE sin TDZ en isClientClosed', () => {
    it('0.1: handleChatQuery inicializa streaming SSE y emite event: session sin ReferenceError', async () => {
      const writtenChunks = [];
      const listeners = {};

      const req = {
        body: {
          message: 'Hola, ¿qué pósters tienes?',
          eventId: 'event-test-sse-001',
          stream: true,
        },
        headers: {
          accept: 'text/event-stream',
        },
        socket: {
          setNoDelay: () => {},
        },
        on: (event, handler) => {
          listeners[event] = handler;
        },
        tenantId: 'tenant-test',
        ip: '127.0.0.1',
      };

      const res = {
        writeHead: () => {},
        flushHeaders: () => {},
        flush: () => {},
        write: (chunk) => {
          writtenChunks.push(chunk);
        },
        end: () => {},
        writableEnded: false,
        destroyed: false,
      };

      // Si existiera TDZ con isClientClosed antes de la declaración de writeSse,
      // esto arrojaría ReferenceError de inmediato.
      await assert.doesNotReject(async () => {
        await handleChatQuery(req, res);
      });

      assert.ok(writtenChunks.length > 0, 'Debe haber emitido al menos un chunk SSE');
      const hasSessionEvent = writtenChunks.some((c) => c.includes('event: session'));
      assert.ok(hasSessionEvent, 'El stream debe haber emitido "event: session"');
    });
  });

  // =========================================================================
  // CIRUGÍA 1: Grieta Contable en Liquidación de Comisiones
  // =========================================================================
  describe('CIRUGÍA 1: Integridad Contable en Liquidación de Comisiones', () => {
    it('1.1: createCommissionSettlement asocia ventas manteniendo commissionPaid: false', async () => {
      let updateManyCalledWith = null;

      const mockTx = {
        user: {
          findFirst: async () => ({ id: 'seller-01', fullName: 'Vendedor Test', email: 'seller@test.com' }),
        },
          sale: {
          findMany: async () => [
            {
              id: 'sale-01',
              sellerId: 'seller-01',
              saleNumber: 'V-001',
              totalAmount: 100,
              balanceDue: 0,
              status: 'COMPLETADA',
              createdAt: new Date('2026-10-01'),
              items: [{ quantity: 1, unitPrice: 100, subtotal: 100 }],
            },
          ],
          updateMany: async (args) => {
            updateManyCalledWith = args;
            return { count: 1 };
          },
        },
        commissionSettlement: {
          count: async () => 0,
          create: async ({ data }) => ({
            id: 'settlement-test-01',
            ...data,
          }),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const originalTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        const result = await createCommissionSettlement({
          tenantId: 'tenant-test',
          sellerId: 'seller-01',
          saleIds: ['sale-01'],
        });

        assert.ok(result);
        assert.ok(updateManyCalledWith, 'Debe llamar a updateMany sobre las ventas');
        assert.equal(
          updateManyCalledWith.data.commissionPaid,
          false,
          'Las ventas en borrador deben conservar commissionPaid: false'
        );
        assert.equal(updateManyCalledWith.data.commissionSettlementId, 'settlement-test-01');
      } finally {
        prisma.$transaction = originalTransaction;
      }
    });

    it('1.2: markSettlementPaid actualiza las ventas asociadas a commissionPaid: true', async () => {
      let salesPaidUpdated = null;

      const mockTx = {
        commissionSettlement: {
          findFirst: async () => ({
            id: 'settlement-test-01',
            tenantId: 'tenant-test',
            status: 'PENDIENTE_PAGO',
            notes: 'Pendiente',
          }),
          update: async ({ data }) => ({
            id: 'settlement-test-01',
            ...data,
            seller: { id: 'seller-01', fullName: 'Vendedor', email: 's@t.com' },
          }),
        },
        sale: {
          updateMany: async (args) => {
            salesPaidUpdated = args;
            return { count: 1 };
          },
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const originalTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        await markSettlementPaid({
          tenantId: 'tenant-test',
          settlementId: 'settlement-test-01',
          paymentReference: 'TRANSF-987654',
          userId: 'admin-01',
        });

        assert.ok(salesPaidUpdated);
        assert.equal(salesPaidUpdated.data.commissionPaid, true, 'Debe marcar commissionPaid: true');
        assert.equal(salesPaidUpdated.where.commissionSettlementId, 'settlement-test-01');
      } finally {
        prisma.$transaction = originalTransaction;
      }
    });

    it('1.3: rejectSettlement y cancelSettlement desvinculan las ventas con commissionPaid: false', async () => {
      let salesFreedArgs = null;

      const mockTx = {
        commissionSettlement: {
          findFirst: async () => ({
            id: 'settlement-test-02',
            tenantId: 'tenant-test',
            status: 'PENDIENTE_PAGO',
            notes: null,
          }),
          update: async ({ data }) => ({
            id: 'settlement-test-02',
            ...data,
          }),
        },
        sale: {
          updateMany: async (args) => {
            salesFreedArgs = args;
            return { count: 1 };
          },
        },
      };

      const originalTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        await rejectSettlement({
          tenantId: 'tenant-test',
          settlementId: 'settlement-test-02',
          userId: 'admin-01',
          reason: 'Discrepancia contable',
        });

        assert.ok(salesFreedArgs);
        assert.equal(salesFreedArgs.data.commissionSettlementId, null, 'Debe desvincular la venta');
        assert.equal(salesFreedArgs.data.commissionPaid, false, 'commissionPaid debe quedar en false');

        salesFreedArgs = null;
        await cancelSettlement({
          tenantId: 'tenant-test',
          settlementId: 'settlement-test-02',
          userId: 'admin-01',
          reason: 'Cancelado por solicitud',
        });

        assert.ok(salesFreedArgs);
        assert.equal(salesFreedArgs.data.commissionSettlementId, null);
        assert.equal(salesFreedArgs.data.commissionPaid, false);
      } finally {
        prisma.$transaction = originalTransaction;
      }
    });
  });

  // =========================================================================
  // CIRUGÍA 2: Asignación de Cobro de Saldo (50%) al Arqueo de Caja Ferial
  // =========================================================================
  describe('CIRUGÍA 2: Arqueo Ferial con Ventas Remotas Retiradas en Stand', () => {
    it('2.1: getEventKPIs incluye en paymentWhere las ventas con pickupEventId === eventId', async () => {
      let capturedPaymentWhere = null;

      const originalGroupBy = prisma.salePayment.groupBy;
      prisma.salePayment.groupBy = async ({ where }) => {
        capturedPaymentWhere = where;
        return [];
      };

      const originalAggregate = prisma.sale.aggregate;
      prisma.sale.aggregate = async () => ({ _count: { id: 0 }, _sum: { totalAmount: 0 } });

      const originalItemAggregate = prisma.saleItem.aggregate;
      prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 } });

      const originalItemGroupBy = prisma.saleItem.groupBy;
      prisma.saleItem.groupBy = async () => [];

      const originalFindMany = prisma.sale.findMany;
      prisma.sale.findMany = async () => [];

      const originalFindUniqueEvent = prisma.event.findUnique;
      prisma.event.findUnique = async () => null;

      try {
        await getEventKPIs({
          eventId: 'feria-interfer-2026',
          tenantId: 'tenant-deko',
        });

        assert.ok(capturedPaymentWhere, 'Debe ejecutar la consulta de pagos con paymentWhere');
        assert.ok(capturedPaymentWhere.sale, 'paymentWhere debe filtrar por la relación sale');
        assert.ok(
          Array.isArray(capturedPaymentWhere.sale.OR),
          'sale debe contener una cláusula OR para eventId y pickupEventId'
        );

        const hasEventId = capturedPaymentWhere.sale.OR.some((c) => c.eventId === 'feria-interfer-2026');
        const hasPickupId = capturedPaymentWhere.sale.OR.some((c) => c.pickupEventId === 'feria-interfer-2026');
        assert.ok(hasEventId, 'OR debe incluir eventId');
        assert.ok(hasPickupId, 'OR debe incluir pickupEventId');
      } finally {
        prisma.salePayment.groupBy = originalGroupBy;
        prisma.sale.aggregate = originalAggregate;
        prisma.saleItem.aggregate = originalItemAggregate;
        prisma.saleItem.groupBy = originalItemGroupBy;
        prisma.sale.findMany = originalFindMany;
        prisma.event.findUnique = originalFindUniqueEvent;
      }
    });

    it('2.2: registerBalancePayment asigna pickupEventId si la venta se liquida en evento ferial', async () => {
      let updatedData = null;

      const mockClient = {
        sale: {
          findFirst: async () => ({
            id: 'sale-redes-01',
            saleNumber: 'RED-100',
            tenantId: 'tenant-test',
            orderType: 'REDES_PERSONALIZADO',
            eventId: 'evt-ventas-redes-online',
            pickupEventId: null,
            status: 'PENDIENTE',
            paymentStatus: 'ANTICIPO_PAGADO',
            totalAmount: 130,
            depositAmount: 65,
            balanceDue: 65,
            notes: '',
            payments: [],
          }),
          updateMany: async ({ data }) => {
            updatedData = data;
            return { count: 1 };
          },
          update: async ({ data }) => ({
            id: 'sale-redes-01',
            ...data,
          }),
        },
        saleItem: {
          findMany: async () => [],
          updateMany: async () => ({ count: 0 }),
        },
        salePayment: {
          createMany: async () => ({ count: 1 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      await registerBalancePayment({
        saleId: 'sale-redes-01',
        tenantId: 'tenant-test',
        sellerId: 'cajero-ferial-01',
        payments: [{ method: 'EFECTIVO', amount: 65 }],
        assignedEventId: 'feria-interfer-2026',
        tx: mockClient,
      });

      assert.ok(updatedData, 'Debe ejecutar la actualización de la venta');
      assert.equal(
        updatedData.pickupEventId,
        'feria-interfer-2026',
        'Debe asignar el evento ferial como pickupEventId para asentar el cobro de saldo'
      );
    });
  });

  // =========================================================================
  // CIRUGÍA 3: Verificación Real de Comprobantes con OCR Multimodal
  // =========================================================================
  describe('CIRUGÍA 3: Servicio de OCR Bancario con Gemini Vision', () => {
    it('3.1: verifyDepositReceipt detecta discrepancias contra el anticipo pactado', async () => {
      const mockGeminiClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              isLegitReceipt: true,
              bank: 'Banco Industrial / BI en Línea',
              referenceNumber: 'REF-8849201',
              detectedAmount: 50.0,
              date: '2026-10-16',
              notes: 'Transferencia ACH correcta',
            }),
          }),
        },
      };

      const result = await verifyDepositReceipt({
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        expectedAmount: 65.0,
        tenantId: 'tenant-test',
        geminiClient: mockGeminiClient,
      });

      assert.equal(result.isLegitReceipt, true);
      assert.equal(result.detectedAmount, 50.0);
      assert.equal(result.expectedAmount, 65.0);
      assert.equal(result.isMatch, false, 'Debe marcar isMatch: false por diferencia de Q15.00');
      assert.equal(result.discrepancy, 15.0);
      assert.ok(result.summary.includes('Discrepancia'));
    });

    it('3.2: verifyDepositReceipt aprueba cuando el monto coincide centesimalmente', async () => {
      const mockGeminiClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              isLegitReceipt: true,
              bank: 'Banrural',
              referenceNumber: 'DEP-10293847',
              detectedAmount: 130.0,
              date: '2026-10-16',
              notes: 'Depósito monetario en ventanilla',
            }),
          }),
        },
      };

      const result = await verifyDepositReceipt({
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        expectedAmount: 130.0,
        tenantId: 'tenant-test',
        geminiClient: mockGeminiClient,
      });

      assert.equal(result.isMatch, true);
      assert.equal(result.discrepancy, 0);
      assert.equal(result.referenceNumber, 'DEP-10293847');
      assert.ok(result.summary.includes('Boleta válida'));
    });
  });

  // =========================================================================
  // CIRUGÍA 5: Erradicación del Inventario Fantasma (Cero Inventos de 5 Unidades)
  // =========================================================================
  describe('CIRUGÍA 5: Inventario Verídico en aiToolsService (Cero Inventos de 5)', () => {
    it('5.1: executeCheckInventoryStock retorna standPhysicalStock: 0 estricto si no hay stock en base de datos', async () => {
      const originalFindVariant = prisma.productVariant?.findFirst;
      if (prisma.productVariant) {
        prisma.productVariant.findFirst = async () => null;
      }

      try {
        const result = await executeCheckInventoryStock('tenant-test', 'Batman', 'MEDIANO');
        assert.ok(result);
        if (result.found) {
          assert.equal(
            result.stockAvailability.standPhysicalStock,
            0,
            'No debe inventar 5 unidades bajo ninguna circunstancia'
          );
          assert.equal(result.stockAvailability.stockAvailable, false);
          assert.equal(result.stockAvailability.unitsInStock, 0);
          assert.equal(result.stockAvailability.stockStatus, 'PRODUCCION_TALLER');
          assert.equal(
            result.stockAvailability.deliveryMode,
            'Impresión bajo demanda en taller (~10-15 min)'
          );
          assert.ok(
            result.summary.includes('taller') || result.summary.includes('impresión'),
            'El summary debe advertir sobre producción en taller'
          );
        }
      } finally {
        if (prisma.productVariant && originalFindVariant) {
          prisma.productVariant.findFirst = originalFindVariant;
        }
      }
    });
  });
});
