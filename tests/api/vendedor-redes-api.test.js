import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';

// Validadores Zod
import {
  customerSchema,
  createRemoteSaleSchema,
  balancePaymentSchema,
} from '../../server/validators/remoteSaleValidators.js';
import {
  createPrintSheetSchema,
  assignItemsToSheetSchema,
  updateSheetStatusSchema,
} from '../../server/validators/printSheetValidators.js';
import {
  settleCommissionSchema,
  paySettlementSchema,
} from '../../server/validators/commissionValidators.js';

// Servicios de Dominio
import {
  findOrCreateCustomer,
  createCustomer as createCustomerService,
  getCustomersList,
  getCustomerById,
  createRemoteSaleTransaction,
  registerBalancePayment as registerBalancePaymentService,
} from '../../server/services/sales/remoteSaleService.js';
import {
  generateSheetCode,
  createPrintSheet as createPrintSheetService,
  assignItemsToSheet,
  updateSheetStatus,
} from '../../server/services/printSheetService.js';
import {
  calculateSaleProductBase,
  generateSettlementNumber,
  getPendingCommissions as getPendingCommissionsService,
  createSettlementTransaction,
  markSettlementPaid,
} from '../../server/services/commissionService.js';

// Controladores HTTP Express
import {
  getCustomers,
  createCustomer,
  getCustomer360,
  createRemoteSale,
  registerBalancePayment,
} from '../../server/controllers/remoteSaleController.js';
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
 * Helper para simular solicitudes y respuestas Express (req, res)
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

describe('Suite de Integración API — Sprint 2 VENDEDOR_REDES (10 Escenarios Transaccionales)', () => {
  const tenantId = 'tenant-deko-test';
  const sellerId = 'usr-seller-01';
  const adminId = 'usr-admin-01';

  // =========================================================================
  // ESCENARIO 1: CRM & Unicidad de WhatsApp
  // =========================================================================
  describe('Escenario 1: CRM & Unicidad de WhatsApp', () => {
    it('1.1 Creación exitosa de cliente con teléfono WhatsApp vía POST /api/customers (HTTP 201)', async () => {
      const originalFindUnique = prisma.customer.findUnique;
      const originalCreate = prisma.customer.create;
      try {
        const customerData = {
          fullName: 'María Mercedes Estrada',
          phone: '50255551234',
          email: 'maria.estrada@gmail.com',
          deliveryAddress: '15 Avenida 4-25, Zona 14',
          department: 'Guatemala',
          municipality: 'Guatemala',
          sourceChannel: 'WHATSAPP',
          notes: 'Cliente preferente de cuadros botánicos',
        };

        prisma.customer.findUnique = async () => null; // No existe aún
        prisma.customer.create = async ({ data }) => ({
          id: 'cust-101',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { req, res } = createMockReqRes({ body: customerData, tenantId });
        await createCustomer(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.equal(res.body.message, 'Cliente registrado exitosamente.');
        assert.equal(res.body.data.id, 'cust-101');
        assert.equal(res.body.data.fullName, 'María Mercedes Estrada');
        assert.equal(res.body.data.phone, '50255551234');
        assert.equal(res.body.data.sourceChannel, 'WHATSAPP');
      } finally {
        prisma.customer.findUnique = originalFindUnique;
        prisma.customer.create = originalCreate;
      }
    });

    it('1.2 Reintento de creación con el mismo teléfono bajo el mismo tenant arroja conflicto HTTP 409', async () => {
      const originalFindUnique = prisma.customer.findUnique;
      try {
        const customerData = {
          fullName: 'María Mercedes Estrada (Duplicada)',
          phone: '50255551234',
        };

        prisma.customer.findUnique = async () => ({
          id: 'cust-101',
          tenantId,
          phone: '50255551234',
          fullName: 'María Mercedes Estrada',
        });

        const { req, res } = createMockReqRes({ body: customerData, tenantId });
        await createCustomer(req, res);

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Ya existe un cliente registrado con el número de teléfono\/WhatsApp 50255551234/);
      } finally {
        prisma.customer.findUnique = originalFindUnique;
      }
    });

    it('1.3 Consulta y filtrado de clientes por teléfono y por query vía GET /api/customers (HTTP 200)', async () => {
      const originalFindMany = prisma.customer.findMany;
      const originalCount = prisma.customer.count;
      try {
        prisma.customer.findMany = async ({ where, skip, take }) => {
          assert.equal(where.tenantId, tenantId);
          return [
            {
              id: 'cust-101',
              tenantId,
              fullName: 'María Mercedes Estrada',
              phone: '50255551234',
              _count: { sales: 3 },
            },
          ];
        };
        prisma.customer.count = async () => 1;

        // Búsqueda por query
        const { req: req1, res: res1 } = createMockReqRes({
          query: { query: 'Mercedes', page: '1', limit: '10' },
          tenantId,
        });
        await getCustomers(req1, res1);

        assert.equal(res1.statusCode, 200);
        assert.equal(res1.body.success, true);
        assert.equal(res1.body.data.length, 1);
        assert.equal(res1.body.data[0].fullName, 'María Mercedes Estrada');
        assert.equal(res1.body.pagination.total, 1);
        assert.equal(res1.body.pagination.page, 1);

        // Búsqueda directa por teléfono
        const { req: req2, res: res2 } = createMockReqRes({
          query: { phone: '55551234' },
          tenantId,
        });
        await getCustomers(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.equal(res2.body.success, true);
      } finally {
        prisma.customer.findMany = originalFindMany;
        prisma.customer.count = originalCount;
      }
    });

    it('1.4 Ficha 360 del Cliente con métricas agregadas (LTV, total de órdenes, saldo pendiente) vía GET /api/customers/:id (HTTP 200)', async () => {
      const originalFindFirst = prisma.customer.findFirst;
      try {
        const orderDate1 = new Date('2026-09-01T10:00:00Z');
        const orderDate2 = new Date('2026-09-15T14:30:00Z');
        const annulledDate = new Date('2026-08-20T09:00:00Z');

        prisma.customer.findFirst = async () => ({
          id: 'cust-101',
          tenantId,
          fullName: 'María Mercedes Estrada',
          phone: '50255551234',
          sales: [
            {
              id: 'sale-02',
              saleNumber: 'VENT-0088',
              totalAmount: 400.0,
              balanceDue: 150.0, // Saldo pendiente
              status: 'PENDIENTE',
              createdAt: orderDate2,
              items: [],
              payments: [],
            },
            {
              id: 'sale-01',
              saleNumber: 'VENT-0045',
              totalAmount: 350.0,
              balanceDue: 0.0,
              status: 'COMPLETADA',
              createdAt: orderDate1,
              items: [],
              payments: [],
            },
            {
              id: 'sale-cancelled',
              saleNumber: 'VENT-0010',
              totalAmount: 500.0,
              balanceDue: 500.0,
              status: 'ANULADA', // Debe excluirse de las métricas LTV
              createdAt: annulledDate,
              items: [],
              payments: [],
            },
          ],
        });

        const { req, res } = createMockReqRes({
          params: { id: 'cust-101' },
          tenantId,
        });
        await getCustomer360(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        const { metrics, customer } = res.body.data;
        assert.equal(customer.id, 'cust-101');
        assert.equal(metrics.totalOrders, 2, 'Debe contar únicamente las 2 órdenes válidas');
        assert.equal(metrics.ltv, 750.0, 'LTV debe ser 400 + 350 = 750.00 (excluyendo la anulada)');
        assert.equal(metrics.pendingBalance, 150.0, 'Saldo pendiente debe ser 150.00');
        assert.equal(new Date(metrics.lastOrderDate).toISOString(), orderDate2.toISOString());
      } finally {
        prisma.customer.findFirst = originalFindFirst;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 2: Venta Remota 50/50 Válida
  // =========================================================================
  describe('Escenario 2: Venta Remota 50/50 Válida', () => {
    it('2.1 Registra venta con anticipo >= 50% (Q 300 productos + Q 40 flete = Q 340, anticipo Q 170) con VENT-xxxx y ANTICIPO_PAGADO', async () => {
      const originalTx = prisma.$transaction;
      try {
        let createdSaleData = null;
        let createdAuditLog = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data, include }) => {
              createdSaleData = data;
              return {
                id: 'sale-remota-001',
                ...data,
                items: data.items.create.map((it, idx) => ({ id: `item-${idx + 1}`, ...it })),
                payments: data.payments.create.map((p, idx) => ({ id: `pay-${idx + 1}`, ...p })),
                customer: { id: 'cust-101', fullName: 'María Mercedes Estrada', phone: '50255551234' },
                seller: { id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
              };
            },
          },
          customer: {
            findUnique: async () => ({ id: 'cust-101', tenantId, phone: '50255551234' }),
          },
          event: {
            update: async () => ({ name: 'VENTAS_REDES', currentSaleSequence: 77 }),
          },
          auditLog: {
            create: async ({ data }) => {
              createdAuditLog = data;
              return { id: 'audit-001', ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const requestBody = {
          customerId: 'a0000000-0000-0000-0000-000000000001',
          deliveryMethod: 'ENVIO_COURIER',
          shippingCost: 40.0,
          shippingCourier: 'FORZA',
          shippingTrackingNumber: 'FZ-998877',
          items: [
            {
              description: 'Cuadro El Principito 30x40',
              quantity: 1,
              unitPrice: 180.0,
              isCustom: false,
              material: 'MDF_5_5MM',
            },
            {
              description: 'Cuadro Noche Estrellada 30x40',
              quantity: 1,
              unitPrice: 120.0,
              isCustom: true,
              material: 'PVC_5MM',
              customDimensions: '30x40 cm',
            },
          ],
          payments: [
            {
              method: 'TRANSFERENCIA',
              amount: 170.0, // Exactamente 50% de 340.00
              reference: 'TRANSF-BI-889900',
            },
          ],
          notes: 'Enviar a dirección principal',
        };

        const { req, res } = createMockReqRes({
          body: requestBody,
          tenantId,
          user: { id: sellerId, role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        const sale = res.body.data;
        assert.equal(sale.saleNumber, 'VENT-0077', 'Debe generar consecutivo VENT-xxxx');
        assert.equal(sale.totalAmount, 340.0, 'Total debe ser 300 productos + 40 flete = 340');
        assert.equal(sale.depositAmount, 170.0, 'Anticipo debe ser 170.00');
        assert.equal(sale.balanceDue, 170.0, 'Saldo adeudado debe ser exactamente 170.00');
        assert.equal(sale.paymentStatus, 'ANTICIPO_PAGADO');
        assert.equal(sale.status, 'PENDIENTE');
        assert.equal(sale.orderType, 'REDES_PERSONALIZADO');
        assert.equal(sale.deliveryMethod, 'ENVIO_COURIER');
        assert.equal(sale.shippingCost, 40.0);

        // Verificación de auditoría transaccional
        assert.equal(createdAuditLog.action, 'VENTA_REMOTA_REGISTRADA');
        assert.equal(createdAuditLog.details.balanceDue, 170.0);
        assert.equal(createdAuditLog.details.paymentStatus, 'ANTICIPO_PAGADO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('2.2 Idempotencia RFC 7231: Reenvío con misma idempotencyKey devuelve 200 con idempotentReplay: true', async () => {
      const originalFindUnique = prisma.sale.findUnique;
      try {
        const existingSale = {
          id: 'sale-prev-01',
          saleNumber: 'VENT-0077',
          totalAmount: 340.0,
          depositAmount: 170.0,
          balanceDue: 170.0,
          paymentStatus: 'ANTICIPO_PAGADO',
          status: 'PENDIENTE',
          idempotencyKey: 'idem-key-abc-123',
        };

        prisma.sale.findUnique = async ({ where }) => {
          if (where.idempotencyKey === 'idem-key-abc-123') return existingSale;
          return null;
        };

        const { req, res } = createMockReqRes({
          headers: { 'idempotency-key': 'idem-key-abc-123' },
          body: {
            customerId: 'a0000000-0000-0000-0000-000000000001',
            items: [{ description: 'Test', quantity: 1, unitPrice: 300 }],
            payments: [{ method: 'EFECTIVO', amount: 150 }],
          },
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.idempotentReplay, true);
        assert.equal(res.body.data.id, 'sale-prev-01');
        assert.equal(res.body.data.saleNumber, 'VENT-0077');
      } finally {
        prisma.sale.findUnique = originalFindUnique;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 3: Anticipo Insuficiente (< 50%)
  // =========================================================================
  describe('Escenario 3: Anticipo Insuficiente (< 50%)', () => {
    it('3.1 Rechazo estricto con HTTP 400 cuando el anticipo es menor al 50% (Q 100 de Q 340)', async () => {
      const requestBody = {
        customerId: 'a0000000-0000-0000-0000-000000000001',
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 40.0,
        items: [
          {
            description: 'Cuadro Star Wars 30x40',
            quantity: 1,
            unitPrice: 300.0,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 100.0, // 100 < 170 (50% de 340)
          },
        ],
      };

      const { req, res } = createMockReqRes({
        body: requestBody,
        tenantId,
        user: { id: sellerId, role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
      });

      await createRemoteSale(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(
        res.body.error,
        /Anticipo insuficiente: Se requiere al menos el 50% del total de la orden \(Q 170\.00\), pero se recibió un anticipo de Q 100\.00\./
      );
    });
  });

  // =========================================================================
  // ESCENARIO 4: Evento Virtual Fallback
  // =========================================================================
  describe('Escenario 4: Evento Virtual Fallback', () => {
    it('4.1 Venta remota sin eventId asigna transparentemente "evt-ventas-redes-online"', async () => {
      const originalTx = prisma.$transaction;
      try {
        let persistedEventId = null;

        const mockTx = {
          sale: {
            findUnique: async () => null,
            create: async ({ data }) => {
              persistedEventId = data.eventId;
              return {
                id: 'sale-virtual-fallback',
                ...data,
                items: [],
                payments: [],
                customer: null,
                seller: { id: sellerId, fullName: 'Vendedor', email: 'v@d.gt' },
              };
            },
          },
          customer: {
            findUnique: async () => ({ id: 'cust-101', tenantId, phone: '50255551234' }),
          },
          event: {
            update: async ({ where }) => {
              assert.equal(where.id, 'evt-ventas-redes-online', 'Secuencia debe consultar el evento virtual');
              return { name: 'VENTAS_REDES', currentSaleSequence: 12 };
            },
          },
          auditLog: {
            create: async () => ({ id: 'audit-fallback' }),
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        // Omitimos completamente eventId en el request
        const requestBody = {
          customerId: 'a0000000-0000-0000-0000-000000000001',
          items: [{ description: 'Póster Marvel', quantity: 1, unitPrice: 200 }],
          payments: [{ method: 'TRANSFERENCIA', amount: 100 }],
        };

        const { req, res } = createMockReqRes({
          body: requestBody,
          tenantId,
        });

        await createRemoteSale(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(persistedEventId, 'evt-ventas-redes-online', 'Debe fijar el eventId virtual por defecto');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 5: Cobro de Saldo Restante
  // =========================================================================
  describe('Escenario 5: Cobro de Saldo Restante', () => {
    it('5.1 Cobro de saldo pendiente (Q 170) conmuta a PAGADO_TOTAL, balanceDue 0.00 y status COMPLETADA', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedSaleData = null;
        let createdPayments = null;
        let auditLogEntry = null;

        const initialSale = {
          id: 'sale-with-balance',
          saleNumber: 'VENT-0077',
          tenantId,
          totalAmount: 340.0,
          depositAmount: 170.0,
          balanceDue: 170.0,
          paymentStatus: 'ANTICIPO_PAGADO',
          status: 'PENDIENTE',
          notes: 'Anticipo recibido en feria',
          customer: { id: 'cust-101', fullName: 'María Estrada' },
        };

        const mockTx = {
          sale: {
            findFirst: async () => initialSale,
            update: async ({ data }) => {
              updatedSaleData = data;
              return {
                ...initialSale,
                ...data,
                items: [],
                payments: [],
                seller: { id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
              };
            },
          },
          salePayment: {
            createMany: async ({ data }) => {
              createdPayments = data;
              return { count: data.length };
            },
          },
          auditLog: {
            create: async ({ data }) => {
              auditLogEntry = data;
              return { id: 'audit-balance-paid', ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const requestBody = {
          payments: [
            {
              method: 'EFECTIVO',
              amount: 170.0,
              reference: 'RECIBO-CONTRA-ENTREGA-01',
            },
          ],
          notes: 'Saldo cobrado al momento de la entrega por mensajería',
        };

        const { req, res } = createMockReqRes({
          params: { id: 'sale-with-balance' },
          body: requestBody,
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.message, 'Saldo liquidado y orden completada exitosamente.');

        // Verificación de mutación de base de datos
        assert.equal(updatedSaleData.balanceDue, 0.0);
        assert.equal(updatedSaleData.depositAmount, 340.0);
        assert.equal(updatedSaleData.paymentStatus, 'PAGADO_TOTAL');
        assert.equal(updatedSaleData.status, 'COMPLETADA');
        assert.match(updatedSaleData.notes, /Saldo cobrado al momento de la entrega/);

        // Verificación de pagos y auditoría
        assert.equal(createdPayments.length, 1);
        assert.equal(createdPayments[0].amount, 170.0);
        assert.equal(createdPayments[0].method, 'EFECTIVO');
        assert.equal(auditLogEntry.action, 'SALDO_VENTA_COBRADO');
        assert.equal(auditLogEntry.details.paidAmount, 170.0);
        assert.equal(auditLogEntry.details.previousBalance, 170.0);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.2 Rechazo con HTTP 400 si el monto pagado no coincide con el saldo adeudado', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 'sale-with-balance',
              saleNumber: 'VENT-0077',
              tenantId,
              balanceDue: 170.0,
              status: 'PENDIENTE',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sale-with-balance' },
          body: {
            payments: [{ method: 'EFECTIVO', amount: 100.0 }], // Solo 100 en vez de 170
          },
          tenantId,
        });

        await registerBalancePayment(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /El monto pagado \(Q 100\.00\) no coincide con el saldo adeudado de la orden \(Q 170\.00\)/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('5.3 Rechazo con HTTP 400 si la orden ya está liquidada a saldo cero', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          sale: {
            findFirst: async () => ({
              id: 'sale-with-balance',
              saleNumber: 'VENT-0077',
              tenantId,
              balanceDue: 0.0,
              status: 'COMPLETADA',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sale-with-balance' },
          body: {
            payments: [{ method: 'EFECTIVO', amount: 50.0 }],
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
  });

  // =========================================================================
  // ESCENARIO 6: Freno Inquebrantable de Taller
  // =========================================================================
  describe('Escenario 6: Freno Inquebrantable de Taller', () => {
    it('6.1 Rechaza con HTTP 422 si el ítem pertenece a una orden con PENDIENTE_ANTICIPO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-blocked-1',
                description: 'Retrato Óleo Personalizado',
                sale: {
                  tenantId,
                  saleNumber: 'VENT-1002',
                  status: 'PENDIENTE',
                  paymentStatus: 'PENDIENTE_ANTICIPO', // 🛑 BLOQUEANTE
                },
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-01' },
          body: { saleItemIds: ['item-blocked-1'] },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(
          res.body.error,
          /El ítem 'Retrato Óleo Personalizado' está bloqueado: Orden #VENT-1002 no cuenta con anticipo registrado/
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('6.2 Rechaza con HTTP 422 si el ítem pertenece a una orden ANULADA', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-cancelled-1',
                description: 'Cuadro Spiderman Cancelado',
                sale: {
                  tenantId,
                  saleNumber: 'VENT-1001',
                  status: 'ANULADA', // 🛑 BLOQUEANTE
                  paymentStatus: 'PAGADO_TOTAL',
                },
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-01' },
          body: { saleItemIds: ['item-cancelled-1'] },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /pertenece a una orden anulada \(#VENT-1001\)/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 7: Loteo y Cascada de Impresión
  // =========================================================================
  describe('Escenario 7: Loteo y Cascada de Impresión', () => {
    it('7.1 Creación de pliego con consecutivo diario correlativo PLI-YYYYMMDD-01 (HTTP 201)', async () => {
      const originalTx = prisma.$transaction;
      try {
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const mockTx = {
          printSheet: {
            findFirst: async () => null, // No hay previos hoy -> arrancará en 01
            create: async ({ data }) => ({
              id: 'sheet-pli-01',
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          auditLog: {
            create: async () => ({ id: 'audit-pli-01' }),
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            material: 'PVC_5MM',
            notes: 'Pliego matutino de cuadros PVC',
          },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await createPrintSheet(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.sheetCode, `PLI-${todayStr}-01`);
        assert.equal(res.body.data.status, 'ABIERTO');
        assert.equal(res.body.data.material, 'PVC_5MM');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('7.2 Asignación exitosa de ítems con ANTICIPO_PAGADO y PAGADO_TOTAL a pliego (HTTP 200)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let assignedPrintSheetId = null;
        let assignedProductionStatus = null;
        let productionLogsCount = 0;

        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-pli-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
            findUnique: async () => ({
              id: 'sheet-pli-01',
              sheetCode: 'PLI-20260919-01',
              items: [
                { id: 'item-ok-1', description: 'Item 1', productionStatus: 'A_PRODUCCION' },
                { id: 'item-ok-2', description: 'Item 2', productionStatus: 'A_PRODUCCION' },
              ],
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-ok-1',
                description: 'Obra con 50% anticipo',
                productionStatus: 'PENDIENTE',
                sale: { tenantId, saleNumber: 'VENT-0077', status: 'PENDIENTE', paymentStatus: 'ANTICIPO_PAGADO' },
              },
              {
                id: 'item-ok-2',
                description: 'Obra con 100% pago',
                productionStatus: 'PENDIENTE',
                sale: { tenantId, saleNumber: 'VENT-0078', status: 'COMPLETADA', paymentStatus: 'PAGADO_TOTAL' },
              },
            ],
            update: async ({ where, data }) => {
              assignedPrintSheetId = data.printSheetId;
              assignedProductionStatus = data.productionStatus;
              return { id: where.id, ...data };
            },
          },
          productionLog: {
            create: async () => {
              productionLogsCount++;
              return { id: `log-${productionLogsCount}` };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-pli-01' },
          body: { saleItemIds: ['item-ok-1', 'item-ok-2'] },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await assignItems(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(assignedPrintSheetId, 'sheet-pli-01');
        assert.equal(assignedProductionStatus, 'A_PRODUCCION');
        assert.equal(productionLogsCount, 2);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('7.3 Transición a IMPRESO actualiza en bloque los ítems asociados a productionStatus: IMPRESO con auditoría (HTTP 200)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updateManyData = null;
        let sheetUpdatedData = null;
        let productionLogs = [];

        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-pli-01',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              tenantId,
            }),
            update: async ({ data }) => {
              sheetUpdatedData = data;
              return {
                id: 'sheet-pli-01',
                sheetCode: 'PLI-20260919-01',
                ...data,
                items: [],
              };
            },
          },
          saleItem: {
            findMany: async ({ where }) => {
              assert.equal(where.printSheetId, 'sheet-pli-01');
              return [
                { id: 'item-ok-1', productionStatus: 'A_PRODUCCION' },
                { id: 'item-ok-2', productionStatus: 'A_PRODUCCION' },
              ];
            },
            updateMany: async ({ where, data }) => {
              assert.equal(where.printSheetId, 'sheet-pli-01');
              updateManyData = data;
              return { count: 2 };
            },
          },
          productionLog: {
            create: async ({ data }) => {
              productionLogs.push(data);
              return { id: `prod-log-${productionLogs.length}`, ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'sheet-pli-01' },
          body: { status: 'IMPRESO', notes: 'Pliego impreso en plotter UV Mimaki' },
          tenantId,
          user: { id: 'operario-1', role: 'OPERARIO_1' },
        });

        await updatePrintSheetStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(sheetUpdatedData.status, 'IMPRESO');
        assert.ok(sheetUpdatedData.printedAt instanceof Date);
        assert.equal(sheetUpdatedData.printedById, 'operario-1');

        // Cascada en saleItem
        assert.equal(updateManyData.productionStatus, 'IMPRESO');
        assert.ok(updateManyData.impresoAt instanceof Date);
        assert.equal(updateManyData.impresoById, 'operario-1');

        // Logs de producción
        assert.equal(productionLogs.length, 2);
        assert.equal(productionLogs[0].newStatus, 'IMPRESO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 8: Invariante 20% Comisión Sin Flete
  // =========================================================================
  describe('Escenario 8: Invariante 20% Comisión Sin Flete', () => {
    it('8.1 Calcula comisiones pendientes: Q 300 productos + Q 50 flete -> base Q 300 -> comisión Q 60.00 (flete 100% excluido)', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-comm-1',
            saleNumber: 'VENT-5001',
            sellerId,
            itemsSubtotal: 300.0,
            discount: 0.0,
            shippingCost: 50.0, // Flete debe ser excluido al 100%
            totalAmount: 350.0,
            balanceDue: 0.0,
            status: 'COMPLETADA',
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date('2026-09-10'),
            items: [{ subtotal: 300.0 }],
            seller: { id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
          },
        ];

        const { req, res } = createMockReqRes({
          tenantId,
          user: { id: sellerId, role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        });

        await getPendingCommissions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        const report = res.body.data;
        assert.equal(report.salesCount, 1);
        assert.equal(report.totalProductsAmount, 300.0, 'Base de productos debe ser Q 300.00');
        assert.equal(report.totalShippingExcluded, 50.0, 'Flete excluido debe ser Q 50.00');
        assert.equal(report.totalCommission, 60.0, 'Comisión debe ser exactamente 20% de Q 300 = Q 60.00');
        assert.equal(report.commissionRate, 0.20);
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });

    it('8.2 Con descuento de Q 40: Q 300 productos - Q 40 desc = Q 260 -> comisión Q 52.00 (Flete Q 45 excluido)', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-comm-2',
            saleNumber: 'VENT-5002',
            sellerId,
            itemsSubtotal: 300.0,
            discount: 40.0, // Descuento aplicado a productos
            shippingCost: 45.0, // Flete excluido
            totalAmount: 305.0,
            balanceDue: 0.0,
            status: 'COMPLETADA',
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date('2026-09-11'),
            items: [{ subtotal: 300.0 }],
            seller: { id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
          },
        ];

        const { req, res } = createMockReqRes({
          tenantId,
          user: { id: sellerId, role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        });

        await getPendingCommissions(req, res);

        assert.equal(res.statusCode, 200);
        const report = res.body.data;
        assert.equal(report.totalProductsAmount, 260.0, 'Base de productos neta debe ser Q 260.00');
        assert.equal(report.totalShippingExcluded, 45.0, 'Flete excluido debe ser Q 45.00');
        assert.equal(report.totalCommission, 52.0, 'Comisión debe ser exactamente Q 52.00 (20% de 260)');
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 9: Freno de Saldo en Comisiones
  // =========================================================================
  describe('Escenario 9: Freno de Saldo en Comisiones', () => {
    it('9.1 Intento de liquidar orden con balanceDue > 0 arroja HTTP 422 ("no es elegible para liquidación: saldo pendiente")', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-with-due',
                saleNumber: 'VENT-5003',
                sellerId,
                totalAmount: 340.0,
                balanceDue: 170.0, // 🛑 SALDO PENDIENTE
                status: 'PENDIENTE',
                commissionPaid: false,
                commissionSettlementId: null,
                items: [],
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-with-due'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.match(
          res.body.error,
          /Venta #VENT-5003 no es elegible para liquidación: saldo pendiente o no completada/
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('9.2 getPendingCommissions filtra y excluye automáticamente órdenes con balanceDue > 0 o no completadas', async () => {
      const originalFindMany = prisma.sale.findMany;
      try {
        prisma.sale.findMany = async () => [
          {
            id: 'sale-ok',
            saleNumber: 'VENT-OK',
            sellerId,
            itemsSubtotal: 200.0,
            discount: 0,
            shippingCost: 30.0,
            totalAmount: 230.0,
            balanceDue: 0.0,
            status: 'COMPLETADA',
            items: [{ subtotal: 200.0 }],
          },
          {
            id: 'sale-pending-balance',
            saleNumber: 'VENT-PEND',
            sellerId,
            itemsSubtotal: 500.0,
            discount: 0,
            shippingCost: 50.0,
            totalAmount: 550.0,
            balanceDue: 275.0, // NO ELEGIBLE
            status: 'PENDIENTE',
            items: [{ subtotal: 500.0 }],
          },
        ];

        const { req, res } = createMockReqRes({
          tenantId,
          user: { id: sellerId, role: 'VENDEDOR_REDES', roles: ['VENDEDOR_REDES'] },
        });

        await getPendingCommissions(req, res);

        assert.equal(res.statusCode, 200);
        const report = res.body.data;
        assert.equal(report.salesCount, 1, 'Debe incluir únicamente la venta con balanceDue == 0');
        assert.equal(report.sales[0].saleNumber, 'VENT-OK');
      } finally {
        prisma.sale.findMany = originalFindMany;
      }
    });
  });

  // =========================================================================
  // ESCENARIO 10: Liquidación Exitosa a Saldo Cero
  // =========================================================================
  describe('Escenario 10: Liquidación Exitosa a Saldo Cero', () => {
    it('10.1 POST /api/commissions/settle liquida ventas a saldo cero, genera correlativo LIQ-YYYYMM-001 y congela ventas (HTTP 201)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let frozenSaleIds = null;
        let createdSettlement = null;
        let auditLogEntry = null;

        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-liq-1',
                saleNumber: 'VENT-6001',
                sellerId,
                itemsSubtotal: 300.0,
                discount: 0.0,
                shippingCost: 40.0,
                totalAmount: 340.0,
                balanceDue: 0.0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date('2026-09-10'),
                items: [{ subtotal: 300.0 }],
              },
              {
                id: 'sale-liq-2',
                saleNumber: 'VENT-6002',
                sellerId,
                itemsSubtotal: 260.0,
                discount: 0.0,
                shippingCost: 35.0,
                totalAmount: 295.0,
                balanceDue: 0.0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                createdAt: new Date('2026-09-12'),
                items: [{ subtotal: 260.0 }],
              },
            ],
            updateMany: async ({ where, data }) => {
              frozenSaleIds = where.id.in;
              assert.equal(data.commissionPaid, true);
              return { count: 2 };
            },
          },
          commissionSettlement: {
            findFirst: async () => null, // Primer correlativo del mes
            create: async ({ data }) => {
              createdSettlement = {
                id: 'settlement-001',
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              return createdSettlement;
            },
          },
          auditLog: {
            create: async ({ data }) => {
              auditLogEntry = data;
              return { id: 'audit-settle-01', ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-liq-1', 'sale-liq-2'],
            notes: 'Liquidación oficial primera quincena de septiembre',
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        const settlement = res.body.data;
        assert.match(settlement.settlementNumber, /^LIQ-\d{6}-001$/, 'Debe generar consecutivo mensual LIQ-YYYYMM-001');
        assert.equal(settlement.totalProductsAmount, 560.0, '300 + 260 = 560');
        assert.equal(settlement.commissionRate, 0.20, 'Tasa de comisión debe ser 20%');
        assert.equal(settlement.totalCommission, 112.0, '20% de 560 = 112.00');
        assert.equal(settlement.salesCount, 2);
        assert.equal(settlement.status, 'PENDIENTE_PAGO');

        // Congelación atómica de ventas
        assert.deepEqual(frozenSaleIds, ['sale-liq-1', 'sale-liq-2']);

        // Auditoría
        assert.equal(auditLogEntry.action, 'SETTLEMENT_CREATED');
        assert.equal(auditLogEntry.entityId, 'settlement-001');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('10.2 PATCH /api/commissions/settlements/:id/pay registra referencia bancaria y conmuta a PAGADO (HTTP 200)', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updatedSettlementData = null;
        let auditLogEntry = null;

        const mockTx = {
          commissionSettlement: {
            findFirst: async () => ({
              id: 'settlement-001',
              tenantId,
              settlementNumber: 'LIQ-202609-001',
              status: 'PENDIENTE_PAGO',
              notes: 'Liquidación quincenal',
            }),
            update: async ({ data }) => {
              updatedSettlementData = data;
              return {
                id: 'settlement-001',
                settlementNumber: 'LIQ-202609-001',
                ...data,
                seller: { id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' },
                approvedBy: { id: adminId, fullName: 'Admin', email: 'admin@deko.gt' },
              };
            },
          },
          auditLog: {
            create: async ({ data }) => {
              auditLogEntry = data;
              return { id: 'audit-settle-paid', ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          params: { id: 'settlement-001' },
          body: {
            paymentReference: 'BI-TRANS-987654321',
            notes: 'Comprobante bancario verificado',
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await markPaid(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.message, 'Liquidación marcada como pagada exitosamente.');
        assert.equal(updatedSettlementData.status, 'PAGADO');
        assert.equal(updatedSettlementData.paymentReference, 'BI-TRANS-987654321');
        assert.ok(updatedSettlementData.paidAt instanceof Date);

        assert.equal(auditLogEntry.action, 'SETTLEMENT_PAID');
        assert.equal(auditLogEntry.entityId, 'settlement-001');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('10.3 Bloqueo de re-liquidación: Intento de liquidar venta ya liquidada arroja HTTP 400', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          user: {
            findFirst: async () => ({ id: sellerId, fullName: 'Vendedor Redes', email: 'vendedor@deko.gt' }),
          },
          sale: {
            findMany: async () => [
              {
                id: 'sale-already-liquidated',
                saleNumber: 'VENT-6001',
                sellerId,
                totalAmount: 340.0,
                balanceDue: 0.0,
                status: 'COMPLETADA',
                commissionPaid: true, // 🛑 YA LIQUIDADA
                commissionSettlementId: 'settlement-prev-001',
                items: [],
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const { req, res } = createMockReqRes({
          body: {
            sellerId,
            saleIds: ['sale-already-liquidated'],
          },
          tenantId,
          user: { id: adminId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        });

        await settleCommissions(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.error, /Venta #VENT-6001 ya fue liquidada previamente\./);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
