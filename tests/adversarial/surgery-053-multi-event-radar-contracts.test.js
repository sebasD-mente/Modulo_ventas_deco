import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../server/config/prisma.js';
import {
  assignUserToEventService,
  syncEventAssignedSellersMetadata,
} from '../../server/services/userEventAssignmentService.js';
import { getEventKPIs } from '../../server/services/sales/saleKpiService.js';
import { createCashClosingTransaction } from '../../server/services/sales/cashClosingService.js';
import {
  calculateEventFinancials,
  normalizeExpenseCategory,
  ALL_ACCEPTED_EXPENSE_CATEGORIES,
} from '../../server/services/eventFinanceService.js';
import { createEventExpenseSchema } from '../../server/validators/saleValidators.js';
import { deleteEvent } from '../../server/controllers/eventController.js';

const rootDir = process.cwd();

describe('⚔️ [DEKO-STANDIA-053] SUITE DE CONTRATOS: MULTI-EVENTO, MULTI-VENDEDOR, LENTE POS, COPILOTO IA Y RADAR 20%', () => {

  // =========================================================================
  // 1. Contrato DOM/Props de MonitorDashboardView.jsx y EventFinancialRadar.jsx
  // =========================================================================
  describe('1. Contrato DOM/Props de MonitorDashboardView.jsx y EventFinancialRadar.jsx', () => {
    it('1.1: MonitorDashboardView.jsx incluye data-testid="toggle-ai-copilot-btn" y enlaza eventDetails[0]?.eventId', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'MonitorDashboardView.jsx'), 'utf-8');
      assert.ok(
        code.includes('data-testid="toggle-ai-copilot-btn"'),
        'Debe contener el atributo data-testid="toggle-ai-copilot-btn"'
      );
      assert.ok(
        code.includes('eventDetails[0]?.eventId'),
        'Debe pasar eventDetails[0]?.eventId a UnifiedAiChat'
      );
      assert.ok(
        !code.includes('eventDetails[0]?.event?.id'),
        'PROHIBIDO pasar eventDetails[0]?.event?.id (contrato roto erradicado)'
      );
      assert.ok(
        code.includes('selectedEventId={activeEvent?.id}'),
        'Debe pasar selectedEventId={activeEvent?.id} a EventFinancialRadar'
      );
    });

    it('1.2: EventFinancialRadar.jsx sincroniza selectedStandId con selectedEventId mediante useEffect', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'monitor', 'EventFinancialRadar.jsx'), 'utf-8');
      assert.ok(
        code.includes('selectedEventId'),
        'EventFinancialRadar debe recibir selectedEventId'
      );
      assert.ok(
        code.includes('useEffect(') && code.includes('setSelectedStandId(selectedEventId)'),
        'EventFinancialRadar debe sincronizar selectedStandId cuando selectedEventId cambie'
      );
    });
  });

  // =========================================================================
  // 2. Contrato DOM/Hook de CatalogSearchInput.jsx y useCatalogSearch.js
  // =========================================================================
  describe('2. Contrato DOM/Hook de CatalogSearchInput.jsx y useCatalogSearch.js', () => {
    it('2.1: CatalogSearchInput.jsx incluye data-testid de cámara para input y botón', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'manual-sale', 'CatalogSearchInput.jsx'), 'utf-8');
      assert.ok(
        code.includes('data-testid="catalog-camera-input"'),
        'Debe contener data-testid="catalog-camera-input"'
      );
      assert.ok(
        code.includes('data-testid="catalog-camera-btn"'),
        'Debe contener data-testid="catalog-camera-btn"'
      );
    });

    it('2.2: useCatalogSearch.js implementa fallback a evt-ventas-redes-online para reconocimiento fotográfico', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'manual-sale', 'hooks', 'useCatalogSearch.js'), 'utf-8');
      assert.ok(
        code.includes("'evt-ventas-redes-online'"),
        'handlePhotoSearch debe contener fallback a evt-ventas-redes-online'
      );
    });
  });

  // =========================================================================
  // 3. Contrato de Sincronización Multi-Stand en App.jsx y Header.jsx
  // =========================================================================
  describe('3. Contrato de Sincronización Multi-Stand en App.jsx y Header.jsx', () => {
    it('3.1: App.jsx define syncEventsList, enlaza onEventsChanged y pasa override a refreshMetrics', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf-8');
      assert.ok(code.includes('syncEventsList'), 'App.jsx debe definir syncEventsList');
      assert.ok(code.includes('onEventsChanged={syncEventsList}'), 'App.jsx debe pasar onEventsChanged a EventsManagementView');
      assert.ok(code.includes('refreshMetrics(ev)'), 'handleSelectEvent debe pasar ev a refreshMetrics para evitar stale closure');
    });

    it('3.2: Header.jsx implementa standSelectorRef, click-outside y data-testids', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Header.jsx'), 'utf-8');
      assert.ok(code.includes('standSelectorRef'), 'Header.jsx debe usar standSelectorRef');
      assert.ok(code.includes('handleClickOutside'), 'Header.jsx debe tener manejador de click outside');
      assert.ok(code.includes('data-testid="header-stand-selector-btn"'), 'Debe tener data-testid="header-stand-selector-btn"');
      assert.ok(code.includes('data-testid="header-stand-selector-menu"'), 'Debe tener data-testid="header-stand-selector-menu"');
    });
  });

  // =========================================================================
  // 4. Sincronización Bidireccional de Vendedores (userEventAssignmentService)
  // =========================================================================
  describe('4. Sincronización Bidireccional de Vendedores en Eventos', () => {
    it('4.1: Desasignar al último vendedor de un evento limpia assignedSellerEmail y assignedSellerName', async () => {
      const origUserFindFirst = prisma.user.findFirst;
      const origUserFindMany = prisma.user.findMany;
      const origUserUpdate = prisma.user.update;
      const origEventUpdate = prisma.event.update;

      let eventUpdateData = null;

      try {
        prisma.user.findFirst = async () => ({
          id: 'user-vendedor-1',
          tenantId: 'tenant-test',
          assignedEventId: 'event-previo-1',
          status: 'ACTIVO',
        });

        prisma.user.update = async ({ data }) => ({
          id: 'user-vendedor-1',
          assignedEventId: data.assignedEventId,
          assignedEvent: null,
        });

        // Simulamos que al desasignar, ya no quedan vendedores activos en event-previo-1
        prisma.user.findMany = async () => [];

        prisma.event.update = async ({ where, data }) => {
          if (where.id === 'event-previo-1') {
            eventUpdateData = data;
          }
          return { id: where.id, ...data };
        };

        const result = await assignUserToEventService({
          userId: 'user-vendedor-1',
          eventId: null,
          tenantId: 'tenant-test',
        });

        assert.strictEqual(result.assignedEventId, null);
        assert.ok(eventUpdateData !== null, 'Debe haber sincronizado el evento previo');
        assert.strictEqual(eventUpdateData.assignedSellerEmail, null);
        assert.strictEqual(eventUpdateData.assignedSellerName, null);
      } finally {
        prisma.user.findFirst = origUserFindFirst;
        prisma.user.findMany = origUserFindMany;
        prisma.user.update = origUserUpdate;
        prisma.event.update = origEventUpdate;
      }
    });

    it('4.2: EventCard.jsx y eventController.js protegen eventos históricos con assignedSellers vacíos', () => {
      const cardCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'events', 'EventCard.jsx'), 'utf-8');
      assert.ok(
        cardCode.includes('!hasRelationalArray && (event.assignedSellerName || event.assignedSellerEmail)'),
        'EventCard.jsx debe condicionar el encargado legacy con !hasRelationalArray'
      );
      assert.ok(
        cardCode.includes('const hasRelationalArray = Array.isArray(event.assignedSellers);'),
        'EventCard.jsx debe detectar si assignedSellers es un arreglo relacional'
      );

      const ctrlCode = fs.readFileSync(path.join(rootDir, 'server', 'controllers', 'eventController.js'), 'utf-8');
      assert.ok(
        ctrlCode.includes('const hasRel = Array.isArray(ev.assignedSellers);'),
        'eventController.js debe verificar si assignedSellers es array relacional'
      );
    });
  });

  // =========================================================================
  // 5. Desglose Multi-Vendedor en KPIs y Reconciliación de Arqueos de Turno
  // =========================================================================
  describe('5. Desglose Multi-Vendedor en getEventKPIs y Reconciliación de Cierre', () => {
    it('5.1: getEventKPIs retorna sellerBreakdown ordenado con desglose de métodos', async () => {
      const origSaleAgg = prisma.sale.aggregate;
      const origItemAgg = prisma.saleItem.aggregate;
      const origPayGroup = prisma.salePayment.groupBy;
      const origItemGroup = prisma.saleItem.groupBy;
      const origSaleFindMany = prisma.sale.findMany;
      const origEventFind = prisma.event.findUnique;

      try {
        prisma.sale.aggregate = async () => ({ _count: { id: 2 }, _sum: { totalAmount: 130 } });
        prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 2 } });
        prisma.salePayment.groupBy = async () => [
          { method: 'EFECTIVO', _count: { id: 1 }, _sum: { amount: 65 } },
          { method: 'TARJETA', _count: { id: 1 }, _sum: { amount: 65 } },
        ];
        prisma.saleItem.groupBy = async () => [];
        prisma.sale.findMany = async () => [
          {
            id: 'sale-1',
            sellerId: 'seller-a',
            totalAmount: 65,
            seller: { id: 'seller-a', fullName: 'Carlos Vendedor' },
            payments: [{ method: 'EFECTIVO', amount: 65 }],
          },
          {
            id: 'sale-2',
            sellerId: 'seller-b',
            totalAmount: 65,
            seller: { id: 'seller-b', fullName: 'Ana Vendedora' },
            payments: [{ method: 'TARJETA', amount: 65 }],
          },
        ];
        prisma.event.findUnique = async () => ({ id: 'evt-1', name: 'Stand Central' });

        const kpis = await getEventKPIs({ tenantId: 'tenant-test', eventId: 'evt-1', date: '2026-10-19' });
        assert.ok(Array.isArray(kpis.sellerBreakdown), 'Debe incluir sellerBreakdown como array');
        assert.strictEqual(kpis.sellerBreakdown.length, 2);
        assert.strictEqual(kpis.sellerBreakdown[0].cashCollected + kpis.sellerBreakdown[1].cashCollected, 65);
      } finally {
        prisma.sale.aggregate = origSaleAgg;
        prisma.saleItem.aggregate = origItemAgg;
        prisma.salePayment.groupBy = origPayGroup;
        prisma.saleItem.groupBy = origItemGroup;
        prisma.sale.findMany = origSaleFindMany;
        prisma.event.findUnique = origEventFind;
      }
    });

    it('5.2: CashClosingView.jsx renderiza data-testid="closing-seller-breakdown"', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CashClosingView.jsx'), 'utf-8');
      assert.ok(
        code.includes('data-testid="closing-seller-breakdown"'),
        'CashClosingView debe renderizar data-testid="closing-seller-breakdown"'
      );
    });

    it('5.3: createCashClosingTransaction actualiza el cierre diario si ya existe para soportar relevos de turno', async () => {
      const origFindFirst = prisma.cashClosing.findFirst;
      const origUpdate = prisma.cashClosing.update;
      const origSaleAgg = prisma.sale.aggregate;
      const origItemAgg = prisma.saleItem.aggregate;
      const origPayGroup = prisma.salePayment.groupBy;
      const origItemGroup = prisma.saleItem.groupBy;
      const origSaleFindMany = prisma.sale.findMany;
      const origEventFind = prisma.event.findUnique;

      let updateInvoked = false;

      try {
        prisma.cashClosing.findFirst = async () => ({
          id: 'closing-existing-01',
          totalCashReported: 500,
          totalSalesCount: 10,
          observations: 'Turno Mañana',
        });

        prisma.cashClosing.update = async ({ where, data }) => {
          updateInvoked = true;
          return { id: where.id, ...data, closedBy: { fullName: 'Supervisor' }, event: { name: 'Stand 1' } };
        };

        prisma.sale.aggregate = async () => ({ _count: { id: 15 }, _sum: { totalAmount: 975 } });
        prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 15 } });
        prisma.salePayment.groupBy = async () => [{ method: 'EFECTIVO', _count: { id: 15 }, _sum: { amount: 975 } }];
        prisma.saleItem.groupBy = async () => [];
        prisma.sale.findMany = async () => [];
        prisma.event.findUnique = async () => ({ id: 'event-1', name: 'Stand 1' });

        const result = await createCashClosingTransaction({
          tenantId: 'tenant-test',
          eventId: 'event-1',
          closedById: 'user-relevo',
          totalCashReported: 975,
          date: '2026-10-19',
        });

        assert.strictEqual(updateInvoked, true, 'Debe haber invocado prisma.cashClosing.update');
        assert.strictEqual(result.totalSalesCount, 15);
      } finally {
        prisma.cashClosing.findFirst = origFindFirst;
        prisma.cashClosing.update = origUpdate;
        prisma.sale.aggregate = origSaleAgg;
        prisma.saleItem.aggregate = origItemAgg;
        prisma.salePayment.groupBy = origPayGroup;
        prisma.saleItem.groupBy = origItemGroup;
        prisma.sale.findMany = origSaleFindMany;
        prisma.event.findUnique = origEventFind;
      }
    });
  });

  // =========================================================================
  // 6. Precisión Histórica (lte: endOfDay) y Consolidado en monitorKpiService
  // =========================================================================
  describe('6. Precisión Histórica y Consolidado en monitorKpiService', () => {
    it('6.1: monitorKpiService.js filtra createdAt lte endOfDay en cumulativeAgg', () => {
      const code = fs.readFileSync(path.join(rootDir, 'server', 'services', 'sales', 'monitorKpiService.js'), 'utf-8');
      assert.ok(
        code.includes('createdAt: { lte: endOfDay }'),
        'cumulativeAgg debe filtrar con createdAt: { lte: endOfDay }'
      );
      assert.ok(
        code.includes('acc.requiredDailyRunRate'),
        'globalFinancials debe acumular requiredDailyRunRate'
      );
      assert.ok(
        code.includes('acc.requiredDailyMediumPosters'),
        'globalFinancials debe acumular requiredDailyMediumPosters'
      );
    });
  });

  // =========================================================================
  // 7. Contrato Zod y Normalización en Gastos Operativos (Anti-P2020)
  // =========================================================================
  describe('7. Contrato Zod y Normalización de Gastos Operativos', () => {
    it('7.1: createEventExpenseSchema rechaza desbordamiento Decimal P2020 y categorías inválidas', () => {
      // Intento de desborde Decimal(10, 2)
      const overflow = createEventExpenseSchema.safeParse({
        amount: 99999999999.99,
        description: 'Desborde malicioso',
        category: 'ARRENDAMIENTO_STAND',
      });
      assert.strictEqual(overflow.success, false, 'Debe rechazar montos gigantes anti-P2020');

      // Monto negativo
      const negative = createEventExpenseSchema.safeParse({
        amount: -50,
        description: 'Monto negativo',
        category: 'ARRENDAMIENTO_STAND',
      });
      assert.strictEqual(negative.success, false, 'Debe rechazar montos negativos');

      // Categoría inválida
      const invalidCat = createEventExpenseSchema.safeParse({
        amount: 50,
        description: 'Gasto hack',
        category: 'HACK_CATEGORY',
      });
      assert.strictEqual(invalidCat.success, false, 'Debe rechazar categorías fuera de allowlist');

      // Descripción > 300 chars
      const longDesc = createEventExpenseSchema.safeParse({
        amount: 50,
        description: 'A'.repeat(301),
        category: 'ARRENDAMIENTO_STAND',
      });
      assert.strictEqual(longDesc.success, false, 'Debe rechazar descripciones mayores a 300 caracteres');

      // Caso válido con alias en inglés
      const validAlias = createEventExpenseSchema.safeParse({
        amount: 1200,
        description: 'Alquiler de stand ferial',
        category: 'STAND_RENT',
      });
      assert.strictEqual(validAlias.success, true, 'Debe aceptar alias legítimos como STAND_RENT');
    });

    it('7.2: normalizeExpenseCategory mapea correctamente alias al arriendo de stand y calcula el 20%', () => {
      assert.strictEqual(normalizeExpenseCategory('STAND_RENT'), 'ARRENDAMIENTO_STAND');
      assert.strictEqual(normalizeExpenseCategory('ARRENDAMIENTO_STAND'), 'ARRENDAMIENTO_STAND');

      const fin = calculateEventFinancials({
        event: { startDate: '2026-10-19', endDate: '2026-10-21' },
        cumulativeSold: 10000,
        expenses: [
          { category: 'STAND_RENT', amount: 2000 },
          { category: 'FOOD', amount: 300 },
        ],
      });

      assert.strictEqual(fin.standRentCost, 2000);
      assert.strictEqual(fin.otherOperationalCost, 300);
      assert.strictEqual(fin.totalExpenses, 2300);
      // Meta 20% = Arriendo * 5 = 10,000
      assert.strictEqual(fin.healthySalesTarget20Pct, 10000);
    });

    it('7.3: apiRoutes.js inyecta validate(createEventExpenseSchema) en POST /events/:id/expenses', () => {
      const code = fs.readFileSync(path.join(rootDir, 'server', 'routes', 'apiRoutes.js'), 'utf-8');
      assert.ok(
        code.includes("router.post('/events/:id/expenses', requireRole(['SUPER_ADMIN']), validate(createEventExpenseSchema), createEventExpense);"),
        'La ruta POST /events/:id/expenses debe tener validate(createEventExpenseSchema)'
      );
    });
  });

  // =========================================================================
  // 8. Contrato de Inmutabilidad de evt-ventas-redes-online en deleteEvent
  // =========================================================================
  describe('8. Inmutabilidad de evt-ventas-redes-online en deleteEvent', () => {
    it('8.1: deleteEvent bloquea con HTTP 400 cualquier intento de eliminar el canal permanente', async () => {
      let resStatus = null;
      let resJson = null;

      const req = {
        params: { id: 'evt-ventas-redes-online' },
        query: { force: 'true' },
        user: { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
        tenantId: 'tenant-test',
      };

      const res = {
        status: (code) => {
          resStatus = code;
          return res;
        },
        json: (data) => {
          resJson = data;
          return res;
        },
      };

      await deleteEvent(req, res);

      assert.strictEqual(resStatus, 400, 'Debe responder con HTTP 400 Bad Request');
      assert.strictEqual(resJson.success, false);
      assert.strictEqual(resJson.error, 'El Punto de Venta Digital Permanente no puede ser eliminado.');
    });
  });
});
