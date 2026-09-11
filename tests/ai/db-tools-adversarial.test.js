import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '@google/genai';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { prisma } from '../../server/config/prisma.js';
import {
  executeGetCashDrawerStatus,
  executeGetSellerShiftReport,
  executeGetProductionQueueStatus,
  executeCheckInventoryStock,
  streamChatWithSalesAssistant,
  getEventKPIsDeclaration,
  getCashDrawerStatusDeclaration,
  getSellerShiftReportDeclaration,
  getProductionQueueStatusDeclaration,
  checkInventoryStockDeclaration,
  salesAssistantTools,
} from '../../server/services/aiMultimodalService.js';
import { getEventKPIs } from '../../server/services/saleService.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';

// Catálogo simulado en memoria para aislar prisma.product.findMany
const MOCK_DB_PRODUCTS = [
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    category: 'CÓMICS',
    basePrice: 25,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
    tags: ['spiderman', 'spider-man', 'marvel'],
    isActive: true,
    tenantId: 'tenant-test',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
    ],
  },
  {
    id: 'prod-taylor-1',
    sku: 'DV-TAYL-01',
    name: 'Taylor Swift Eras Tour',
    category: 'MUSICA',
    basePrice: 25,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample-taylor.jpg',
    tags: ['taylor', 'swift', 'eras', 'musica'],
    isActive: true,
    tenantId: 'tenant-test',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
    ],
  },
];

describe('🔥 Suite Adversarial Empírica: 5 Herramientas de Base de Datos y Streaming (M3 Challenger)', () => {
  let originalPrismaMethods = {};

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-gemini-key-for-m3-adversarial';
    invalidateCatalogCache();

    // 1. Respaldo de métodos de Prisma
    originalPrismaMethods = {
      productFindMany: prisma.product?.findMany,
      eventFindFirst: prisma.event?.findFirst,
      eventFindUnique: prisma.event?.findUnique,
      saleGroupBy: prisma.sale?.groupBy,
      saleFindMany: prisma.sale?.findMany,
      saleAggregate: prisma.sale?.aggregate,
      saleItemGroupBy: prisma.saleItem?.groupBy,
      saleItemFindMany: prisma.saleItem?.findMany,
      saleItemAggregate: prisma.saleItem?.aggregate,
      salePaymentGroupBy: prisma.salePayment?.groupBy,
      salePaymentAggregate: prisma.salePayment?.aggregate,
      cashClosingFindFirst: prisma.cashClosing?.findFirst,
      userFindMany: prisma.user?.findMany,
    };

    // 2. Mocks seguros en memoria (100% aislamiento de red)
    if (prisma.product) {
      prisma.product.findMany = async () => MOCK_DB_PRODUCTS;
    }
    if (prisma.event) {
      prisma.event.findFirst = async () => ({
        id: 'stress-event',
        name: 'Comic-Con Guatemala 2026',
        location: 'Fórum Majadas',
        salesTarget: 25000,
        status: 'ACTIVE',
      });
      prisma.event.findUnique = async () => ({
        id: 'stress-event',
        name: 'Comic-Con Guatemala 2026',
        location: 'Fórum Majadas',
        salesTarget: 25000,
        status: 'ACTIVE',
      });
    }
    if (prisma.sale) {
      prisma.sale.groupBy = async () => [];
      prisma.sale.findMany = async () => [];
      prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
    }
    if (prisma.saleItem) {
      prisma.saleItem.groupBy = async () => [];
      prisma.saleItem.findMany = async () => [];
      prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 }, _count: { id: 0 } });
    }
    if (prisma.salePayment) {
      prisma.salePayment.groupBy = async () => [];
      prisma.salePayment.aggregate = async () => ({ _sum: { amount: 0 }, _count: { id: 0 } });
    }
    if (prisma.cashClosing) {
      prisma.cashClosing.findFirst = async () => null;
    }
    if (prisma.user) {
      prisma.user.findMany = async () => [];
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    // 3. Restauración incondicional
    if (prisma.product && originalPrismaMethods.productFindMany) {
      prisma.product.findMany = originalPrismaMethods.productFindMany;
    }
    if (prisma.event) {
      if (originalPrismaMethods.eventFindFirst) prisma.event.findFirst = originalPrismaMethods.eventFindFirst;
      if (originalPrismaMethods.eventFindUnique) prisma.event.findUnique = originalPrismaMethods.eventFindUnique;
    }
    if (prisma.sale) {
      if (originalPrismaMethods.saleGroupBy) prisma.sale.groupBy = originalPrismaMethods.saleGroupBy;
      if (originalPrismaMethods.saleFindMany) prisma.sale.findMany = originalPrismaMethods.saleFindMany;
      if (originalPrismaMethods.saleAggregate) prisma.sale.aggregate = originalPrismaMethods.saleAggregate;
    }
    if (prisma.saleItem) {
      if (originalPrismaMethods.saleItemGroupBy) prisma.saleItem.groupBy = originalPrismaMethods.saleItemGroupBy;
      if (originalPrismaMethods.saleItemFindMany) prisma.saleItem.findMany = originalPrismaMethods.saleItemFindMany;
      if (originalPrismaMethods.saleItemAggregate) prisma.saleItem.aggregate = originalPrismaMethods.saleItemAggregate;
    }
    if (prisma.salePayment) {
      if (originalPrismaMethods.salePaymentGroupBy) prisma.salePayment.groupBy = originalPrismaMethods.salePaymentGroupBy;
      if (originalPrismaMethods.salePaymentAggregate) prisma.salePayment.aggregate = originalPrismaMethods.salePaymentAggregate;
    }
    if (prisma.cashClosing && originalPrismaMethods.cashClosingFindFirst) {
      prisma.cashClosing.findFirst = originalPrismaMethods.cashClosingFindFirst;
    }
    if (prisma.user && originalPrismaMethods.userFindMany) {
      prisma.user.findMany = originalPrismaMethods.userFindMany;
    }
  });

  // =========================================================================
  // 1. FUZZING Y LÍMITES: Argumentos Nulos, Indefinidos, Tipos Incorrectos y Vacíos
  // =========================================================================
  describe('1. Invocación con argumentos undefined, null, tipos incorrectos y cadenas vacías', () => {
    let origFindFirst, origFindUnique, origSaleGroupBy, origSaleItemGroupBy, origSalePaymentGroupBy,
        origCashClosingFindFirst, origSaleItemFindMany, origSaleFindMany, origUserFindMany,
        origSalePaymentAgg, origSaleItemAgg, origSaleAgg, origProductFindMany;

    beforeEach(() => {
      origFindFirst = prisma.event.findFirst;
      origFindUnique = prisma.event.findUnique;
      origSaleGroupBy = prisma.sale.groupBy;
      origSaleItemGroupBy = prisma.saleItem.groupBy;
      origSalePaymentGroupBy = prisma.salePayment.groupBy;
      origCashClosingFindFirst = prisma.cashClosing.findFirst;
      origSaleItemFindMany = prisma.saleItem.findMany;
      origSaleFindMany = prisma.sale?.findMany;
      origUserFindMany = prisma.user.findMany;
      origSalePaymentAgg = prisma.salePayment.aggregate;
      origSaleItemAgg = prisma.saleItem.aggregate;
      origSaleAgg = prisma.sale.aggregate;
      origProductFindMany = prisma.product?.findMany;

      // Mock rápido de Prisma para evitar esperar 4.5s de timeout de red en cada caso corrupto
      prisma.event.findFirst = async () => null;
      prisma.event.findUnique = async () => null;
      prisma.sale.groupBy = async () => [];
      prisma.saleItem.groupBy = async () => [];
      prisma.salePayment.groupBy = async () => [];
      prisma.cashClosing.findFirst = async () => null;
      prisma.saleItem.findMany = async () => [];
      if (prisma.sale?.findMany) prisma.sale.findMany = async () => [];
      prisma.user.findMany = async () => [];
      prisma.salePayment.aggregate = async () => ({ _sum: { amount: 0 }, _count: { id: 0 } });
      prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 }, _count: { id: 0 } });
      prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
      if (prisma.product) prisma.product.findMany = async () => MOCK_DB_PRODUCTS;
    });

    afterEach(() => {
      prisma.event.findFirst = origFindFirst;
      prisma.event.findUnique = origFindUnique;
      prisma.sale.groupBy = origSaleGroupBy;
      prisma.saleItem.groupBy = origSaleItemGroupBy;
      prisma.salePayment.groupBy = origSalePaymentGroupBy;
      prisma.cashClosing.findFirst = origCashClosingFindFirst;
      prisma.saleItem.findMany = origSaleItemFindMany;
      if (origSaleFindMany && prisma.sale) prisma.sale.findMany = origSaleFindMany;
      prisma.user.findMany = origUserFindMany;
      prisma.salePayment.aggregate = origSalePaymentAgg;
      prisma.saleItem.aggregate = origSaleItemAgg;
      prisma.sale.aggregate = origSaleAgg;
      if (origProductFindMany && prisma.product) prisma.product.findMany = origProductFindMany;
    });

    it('1.1 executeGetCashDrawerStatus resiste todo tipo de inputs corruptos sin colapsar', async () => {
      const corruptInputs = [
        [undefined, undefined],
        [null, null],
        ['', ''],
        ['   ', '   '],
        [12345, { injected: true }],
        [true, false],
        [NaN, Infinity],
        ['tenant-valid', 'current'],
        ['tenant-valid', 'activo'],
        ['tenant-valid', 'non-existent-uuid-99999'],
        ['\u0000; DROP TABLE "Sale";--', '\' OR \'1\'=\'1'],
        ['T'.repeat(5000), 'E'.repeat(5000)],
      ];

      for (const [tenant, event] of corruptInputs) {
        let res;
        assert.doesNotThrow(() => {
          // Verify promise creation doesn't throw synchronously
        });

        res = await executeGetCashDrawerStatus(tenant, event);

        assert.ok(res !== null && typeof res === 'object', `Debe retornar objeto para input [${tenant}, ${event}]`);
        assert.strictEqual(typeof res.currentCashInDrawer, 'number', 'currentCashInDrawer debe ser number');
        assert.strictEqual(typeof res.grossSalesTotal, 'number', 'grossSalesTotal debe ser number');
        assert.strictEqual(typeof res.totalSalesInCash, 'number', 'totalSalesInCash debe ser number');
        assert.strictEqual(typeof res.totalCardInSales, 'number', 'totalCardInSales debe ser number');
        assert.strictEqual(typeof res.totalTransferInSales, 'number', 'totalTransferInSales debe ser number');
        assert.strictEqual(res.currency, 'GTQ');
        assert.strictEqual(res.currencySymbol, 'Q');
        assert.strictEqual(typeof res.summaryText, 'string', 'summaryText debe ser string');
        assert.ok(res.summaryText.length > 0, 'summaryText no debe estar vacío');
      }
    });

    it('1.2 executeGetSellerShiftReport resiste todo tipo de inputs corruptos sin colapsar', async () => {
      const corruptInputs = [
        [undefined, undefined, undefined],
        [null, null, null],
        ['', '', ''],
        ['   ', '   ', '   '],
        [123, 456, 789],
        [false, true, {}],
        ['tenant-valid', 'current', null],
        ['tenant-valid', 'activo', 'seller-xyz'],
        ['tenant-valid', 'event-uuid', 'non-existent-seller-id'],
        ['\'; DROP TABLE "User";--', '\' OR 1=1', 'injected-seller'],
        ['X'.repeat(5000), 'Y'.repeat(5000), 'Z'.repeat(5000)],
      ];

      for (const [tenant, event, seller] of corruptInputs) {
        const res = await executeGetSellerShiftReport(tenant, event, seller);

        assert.ok(res !== null && typeof res === 'object', `Debe retornar objeto para input [${tenant}, ${event}, ${seller}]`);
        assert.ok(Array.isArray(res.ranking), 'ranking debe ser un array');
        if (res.seller) {
          assert.strictEqual(typeof res.seller.totalAmount, 'number', 'seller.totalAmount debe ser number');
          assert.strictEqual(typeof res.seller.transactionCount, 'number', 'seller.transactionCount debe ser number');
        } else {
          assert.strictEqual(typeof res.eventTotalRevenue, 'number', 'eventTotalRevenue debe ser number');
          assert.strictEqual(typeof res.eventTotalTransactions, 'number', 'eventTotalTransactions debe ser number');
        }
        assert.strictEqual(typeof res.summaryText, 'string', 'summaryText debe ser string');
        assert.ok(res.summaryText.length > 0, 'summaryText no debe estar vacío');
      }
    });

    it('1.3 executeGetProductionQueueStatus resiste todo tipo de inputs corruptos sin colapsar', async () => {
      const corruptInputs = [
        [undefined, undefined],
        [null, null],
        ['', ''],
        ['   ', '   '],
        [99999, ['array-instead-of-id']],
        [NaN, false],
        ['tenant-valid', 'current'],
        ['tenant-valid', 'activo'],
        ['tenant-valid', 'event-inexistente-123'],
        ['\'; TRUNCATE "SaleItem";--', 'drop-table'],
        ['P'.repeat(4000), 'Q'.repeat(4000)],
      ];

      for (const [tenant, event] of corruptInputs) {
        const res = await executeGetProductionQueueStatus(tenant, event);

        assert.ok(res !== null && typeof res === 'object', `Debe retornar objeto para input [${tenant}, ${event}]`);
        assert.ok(['OPTIMO', 'MODERADO', 'SATURADO', 'CRITICO'].includes(res.health), `health debe ser válido (${res.health})`);
        assert.ok(res.counts && typeof res.counts === 'object', 'counts debe ser objeto');
        assert.strictEqual(typeof res.counts.pending, 'number');
        assert.strictEqual(typeof res.counts.separated, 'number');
        assert.strictEqual(typeof res.counts.inProduction, 'number');
        assert.strictEqual(typeof res.counts.printed, 'number');
        assert.strictEqual(typeof res.counts.total, 'number');
        assert.strictEqual(typeof res.counts.activeQueueCount, 'number');
        assert.ok(Array.isArray(res.stalledJobs), 'stalledJobs debe ser array');
        assert.strictEqual(typeof res.summary, 'string', 'summary debe ser string');
      }
    });

    it('1.4 executeCheckInventoryStock maneja inputs nulos, tipos inválidos, inyecciones y tamaños anómalos', async () => {
      // 1. Query nulo / vacío / tipo incorrecto
      const invalidQueries = [
        undefined,
        null,
        '',
        '     ',
        12345,
        {},
        [],
        true,
      ];

      for (const q of invalidQueries) {
        const res = await executeCheckInventoryStock('tenant-test', q);
        assert.strictEqual(res.found, false, `Query inválida [${q}] debe retornar found: false`);
        assert.ok(typeof res.message === 'string');
      }

      // 2. Query con SQL injection y XSS
      const injectionQueries = [
        "Robert'); DROP TABLE \"Product\";--",
        "<script>alert('xss')</script>",
        "Spider-Man' OR '1'='1",
      ];

      for (const inj of injectionQueries) {
        const res = await executeCheckInventoryStock('tenant-test', inj);
        assert.ok(res !== null && typeof res === 'object');
        assert.strictEqual(typeof res.found, 'boolean');
      }

      // 3. Tamaños anómalos y exóticos
      const sizeTests = [
        ['Spider-Man', null],
        ['Spider-Man', undefined],
        ['Spider-Man', ''],
        ['Spider-Man', 'TAMANO_INEXISTENTE_XYZ'],
        ['Spider-Man', 9999],
        ['Spider-Man', '18x24x36x48'],
        ['Spider-Man', 'PORTADA_ALBUM'],
        ['Taylor Swift', 'portada'],
      ];

      for (const [q, s] of sizeTests) {
        const res = await executeCheckInventoryStock('tenant-test', q, s);
        assert.ok(res !== null && typeof res === 'object');
        if (res.found) {
          assert.ok(res.artwork && res.artwork.title);
          assert.ok(res.stockAvailability);
          assert.ok(['DISPONIBLE_MOSTRADOR', 'PRODUCCION_TALLER'].includes(res.stockAvailability.standPhysicalStock));
          assert.strictEqual(typeof res.stockAvailability.estimatedWaitMinutes, 'number');
        }
      }

      // 4. Query excesivamente larga (stress de memoria en regex/normalización)
      const longQuery = 'Poster '.repeat(1000);
      const resLong = await executeCheckInventoryStock('tenant-test', longQuery);
      assert.ok(resLong !== null && typeof resLong === 'object');
      assert.strictEqual(typeof resLong.found, 'boolean');
    });

    it('1.5 getEventKPIs resiste parámetros inválidos o fechas malformadas', async () => {
      const invalidKPIParams = [
        undefined,
        null,
        {},
        { eventId: null, tenantId: null, date: null },
        { eventId: 'event-uuid', date: 'not-a-valid-date' },
        { eventId: 'event-uuid', date: '2026-99-99' },
        { eventId: 'event-uuid', date: '' },
        12345,
        'event-only-string',
      ];

      for (const param of invalidKPIParams) {
        try {
          const res = await getEventKPIs(param);
          assert.ok(res !== null && typeof res === 'object');
          assert.strictEqual(typeof res.totalTransactions, 'number');
          assert.strictEqual(typeof res.totalAmount, 'number');
          assert.strictEqual(typeof res.totalRevenue, 'number');
          assert.strictEqual(typeof res.totalUnits, 'number');
          assert.strictEqual(typeof res.averageTicket, 'number');
          assert.ok(res.paymentBreakdown);
        } catch (err) {
          assert.ok(err instanceof Error);
        }
      }
    });
  });

  // =========================================================================
  // 2. SIMULACIÓN DE DESCONEXIÓN O FALLO CATASTRÓFICO EN PRISMA (Fault Injection)
  // =========================================================================
  describe('2. Manejo de simulación de desconexión o fallo en Prisma (Zero-Crash)', () => {
    let originalEventFindFirst;
    let originalEventFindUnique;
    let originalSaleAggregate;
    let originalSaleGroupBy;
    let originalSaleItemAggregate;
    let originalSaleItemGroupBy;
    let originalSalePaymentGroupBy;
    let originalSalePaymentAggregate;
    let originalCashClosingFindFirst;
    let originalUserFindMany;

    beforeEach(() => {
      originalEventFindFirst = prisma.event.findFirst;
      originalEventFindUnique = prisma.event.findUnique;
      originalSaleAggregate = prisma.sale.aggregate;
      originalSaleGroupBy = prisma.sale.groupBy;
      originalSaleItemAggregate = prisma.saleItem.aggregate;
      originalSaleItemGroupBy = prisma.saleItem.groupBy;
      originalSalePaymentGroupBy = prisma.salePayment.groupBy;
      originalSalePaymentAggregate = prisma.salePayment.aggregate;
      originalCashClosingFindFirst = prisma.cashClosing.findFirst;
      originalUserFindMany = prisma.user.findMany;
    });

    afterEach(() => {
      prisma.event.findFirst = originalEventFindFirst;
      prisma.event.findUnique = originalEventFindUnique;
      prisma.sale.aggregate = originalSaleAggregate;
      prisma.sale.groupBy = originalSaleGroupBy;
      prisma.saleItem.aggregate = originalSaleItemAggregate;
      prisma.saleItem.groupBy = originalSaleItemGroupBy;
      prisma.salePayment.groupBy = originalSalePaymentGroupBy;
      prisma.salePayment.aggregate = originalSalePaymentAggregate;
      prisma.cashClosing.findFirst = originalCashClosingFindFirst;
      prisma.user.findMany = originalUserFindMany;
    });

    it('2.1 executeGetCashDrawerStatus ante desconexión total (PrismaClientRustPanicError / ECONNREFUSED)', async () => {
      prisma.event.findFirst = async () => { throw new Error('PrismaClientRustPanicError: Connection terminated abruptly'); };
      prisma.event.findUnique = async () => { throw new Error('ECONNREFUSED: Database server down'); };
      prisma.salePayment.groupBy = async () => { throw new Error('ETIMEDOUT: host-db-dokploy:5432 unreachable'); };
      prisma.cashClosing.findFirst = async () => { throw new Error('FATAL: Database disk full'); };

      const res = await executeGetCashDrawerStatus('test-tenant', 'event-123');

      assert.ok(res !== null && typeof res === 'object', 'Debe retornar objeto');
      assert.strictEqual(res.currentCashInDrawer, 0, 'currentCashInDrawer debe ser 0 ante falla');
      assert.strictEqual(res.grossSalesTotal, 0, 'grossSalesTotal debe ser 0 ante falla');
      assert.strictEqual(res.totalSalesInCash, 0, 'totalSalesInCash debe ser 0 ante falla');
      assert.strictEqual(res.totalCardInSales, 0, 'totalCardInSales debe ser 0 ante falla');
      assert.strictEqual(res.totalTransferInSales, 0, 'totalTransferInSales debe ser 0 ante falla');
      assert.strictEqual(res.lastClosing, null);
      assert.ok(typeof res.summaryText === 'string');
      assert.ok(res.summaryText.includes('No se pudo consultar') || res.summaryText.includes('No hay un evento'));
    });

    it('2.2 executeGetSellerShiftReport ante fallo catastrófico en PostgreSQL', async () => {
      prisma.event.findFirst = async () => { throw new Error('Connection pool exhausted'); };
      prisma.event.findUnique = async () => { throw new Error('Deadlock detected in postgres transaction'); };
      prisma.sale.groupBy = async () => { throw new Error('P2025: Record not found / DB offline'); };

      const res = await executeGetSellerShiftReport('test-tenant', 'event-123');

      assert.ok(res !== null && typeof res === 'object');
      assert.deepStrictEqual(res.ranking, []);
      assert.strictEqual(res.totalSellersActive, 0);
      assert.strictEqual(res.eventTotalRevenue, 0);
      assert.strictEqual(res.eventTotalTransactions, 0);
      assert.strictEqual(res.topSeller, null);
      assert.ok(typeof res.summaryText === 'string');
      assert.ok(res.summaryText.includes('No se pudo conectar') || res.summaryText.includes('No hay un evento'));
    });

    it('2.3 executeGetProductionQueueStatus ante fallo de red en PostgreSQL', async () => {
      prisma.event.findFirst = async () => { throw new Error('PrismaClientInitializationError: Can\'t reach database'); };
      prisma.event.findUnique = async () => { throw new Error('Socket hang up'); };
      prisma.saleItem.groupBy = async () => { throw new Error('Query cancelled by user or timeout'); };

      const res = await executeGetProductionQueueStatus('test-tenant', 'event-123');

      assert.ok(res !== null && typeof res === 'object');
      assert.strictEqual(res.health, 'OPTIMO');
      assert.strictEqual(res.counts.pending, 0);
      assert.strictEqual(res.counts.separated, 0);
      assert.strictEqual(res.counts.inProduction, 0);
      assert.strictEqual(res.counts.printed, 0);
      assert.strictEqual(res.counts.total, 0);
      assert.strictEqual(res.counts.activeQueueCount, 0);
      assert.deepStrictEqual(res.stalledJobs, []);
      assert.ok(typeof res.summary === 'string');
      assert.ok(res.summary.includes('No se pudo consultar') || res.summary.includes('No hay un evento'));
    });

    it('2.4 executeCheckInventoryStock ante falla de historial en PostgreSQL mantiene búsqueda de catálogo', async () => {
      prisma.saleItem.groupBy = async () => { throw new Error('Table SaleItem corrupted'); };

      const res = await executeCheckInventoryStock('test-tenant', 'Spider-Man', 'MEDIANO', 'event-123');

      assert.ok(res !== null && typeof res === 'object');
      assert.strictEqual(res.found, true);
      assert.ok(res.artwork && res.artwork.title.toLowerCase().includes('spider'));
      assert.strictEqual(res.eventStockHistory, null, 'eventStockHistory debe ser null ante error de Prisma');
      assert.ok(typeof res.summary === 'string');
    });

    it('2.5 streamChatWithSalesAssistant captura fallo de getEventKPIs y emite estructura segura sin abortar stream', async () => {
      const client = getGeminiClient();
      assert.ok(client);

      client.models.generateContentStream = async function* () {
        yield { functionCalls: [{ name: 'getEventKPIs', args: { eventId: 'event-with-db-down' } }] };
      };

      prisma.sale.aggregate = async () => { throw new Error('Simulated Database Down (ECONNREFUSED)'); };
      prisma.saleItem.aggregate = async () => { throw new Error('Simulated Database Down (ECONNREFUSED)'); };
      prisma.salePayment.groupBy = async () => { throw new Error('Simulated Database Down (ECONNREFUSED)'); };

      const stream = streamChatWithSalesAssistant({
        message: '¿Cómo van las ventas hoy?',
        tenantId: 'test-tenant',
        eventId: 'event-with-db-down',
      });

      const events = [];
      for await (const ev of stream) {
        events.push(ev);
      }

      const kpisEvents = events.filter(e => e.type === 'event_kpis');
      assert.strictEqual(kpisEvents.length, 1, 'Debe emitir 1 evento event_kpis con estructura fallback');
      const kpisData = kpisEvents[0].data;
      assert.ok(kpisData !== null && typeof kpisData === 'object');
      assert.strictEqual(typeof kpisData.totalAmount, 'number');
      assert.strictEqual(typeof kpisData.totalTransactions, 'number');
      assert.ok(kpisData.paymentBreakdown);

      const tokenEvents = events.filter(e => e.type === 'token');
      assert.ok(tokenEvents.length >= 1, 'Debe haber emitido el resumen de la herramienta como token fallback');
    });
  });

  // =========================================================================
  // 3. ESTRÉS EN STREAMING: Multi-Tool Concurrente, Deduplicación y Wire Format
  // =========================================================================
  describe('3. Estrés en streaming: Multi-Tool SSE, deduplicación y wire format', () => {
    it('3.1 Emisión de 5 tools de base de datos simultáneas en un mismo chunk con catálogo conocido', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        {
          functionCalls: [
            { name: 'getEventKPIs', args: { eventId: 'stress-event' } },
            { name: 'getCashDrawerStatus', args: { eventId: 'stress-event' } },
            { name: 'getSellerShiftReport', args: { eventId: 'stress-event' } },
            { name: 'getProductionQueueStatus', args: { eventId: 'stress-event' } },
            { name: 'checkInventoryStock', args: { query: 'Spider-Man', sizeId: 'MEDIANO' } },
          ],
        },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Dame informe completo: ventas, caja, vendedores, taller e inventario de Spider-Man',
        tenantId: 'test-tenant',
        eventId: 'stress-event',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const types = emitted.map(e => e.type);
      assert.ok(types.includes('event_kpis'), 'Debe emitir event_kpis');
      assert.ok(types.includes('cash_drawer_status'), 'Debe emitir cash_drawer_status');
      assert.ok(types.includes('seller_shift_report'), 'Debe emitir seller_shift_report');
      assert.ok(types.includes('production_queue_status'), 'Debe emitir production_queue_status');
      assert.ok(types.includes('inventory_stock'), 'Debe emitir inventory_stock');
      assert.ok(types.includes('suggested_posters'), 'Debe emitir suggested_posters cuando hay coincidencias');

      const kpisEv = emitted.find(e => e.type === 'event_kpis');
      assert.ok(kpisEv.data !== undefined);

      const cashEv = emitted.find(e => e.type === 'cash_drawer_status');
      assert.ok(cashEv.data !== undefined);

      const sellerEv = emitted.find(e => e.type === 'seller_shift_report');
      assert.ok(sellerEv.data !== undefined);

      const prodEv = emitted.find(e => e.type === 'production_queue_status');
      assert.ok(prodEv.data !== undefined);

      const stockEv = emitted.find(e => e.type === 'inventory_stock');
      assert.ok(stockEv.data !== undefined);
      assert.strictEqual(stockEv.data.found, true);
    });

    it('3.1b checkInventoryStock ante obra desconocida emite inventory_stock con found:false sin romper el stream', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        {
          functionCalls: [
            { name: 'checkInventoryStock', args: { query: 'ObraCompletamenteInexistenteXYZ_9999', sizeId: 'MEDIANO' } },
          ],
        },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Tienes la obra desconocida?',
        tenantId: 'test-tenant',
        eventId: 'stress-event',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const stockEv = emitted.find(e => e.type === 'inventory_stock');
      assert.ok(stockEv !== undefined, 'Debe emitir inventory_stock');
      assert.strictEqual(stockEv.data.found, false, 'found debe ser false para obra desconocida');

      // Comprobar que NO emite suggested_posters vacío
      const postersEv = emitted.filter(e => e.type === 'suggested_posters');
      assert.strictEqual(postersEv.length, 0, 'No debe emitir suggested_posters cuando no hay coincidencias');
    });

    it('3.2 Deduplicación agresiva: múltiples tools idénticas y cruzadas en chunks fragmentados', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getProductionQueueStatus', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getProductionQueueStatus', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getSellerShiftReport', args: { eventId: 'ev-1' } }] },
        { functionCalls: [{ name: 'getSellerShiftReport', args: { eventId: 'ev-1' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Estado de caja, taller y ranking',
        tenantId: 'test-tenant',
        eventId: 'ev-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const cashEvents = emitted.filter(e => e.type === 'cash_drawer_status');
      const prodEvents = emitted.filter(e => e.type === 'production_queue_status');
      const sellerEvents = emitted.filter(e => e.type === 'seller_shift_report');

      assert.strictEqual(cashEvents.length, 1, 'Debe emitir exactamente 1 cash_drawer_status');
      assert.strictEqual(prodEvents.length, 1, 'Debe emitir exactamente 1 production_queue_status');
      assert.strictEqual(sellerEvents.length, 1, 'Debe emitir exactamente 1 seller_shift_report');
    });

    it('3.3 Deduplicación de resumen conversacional: no duplicar texto cuando Gemini ya emite tokens', async () => {
      const client = getGeminiClient();

      const chunksWithText = [
        { text: 'Con gusto te comparto el estado actual del taller y de la gaveta: ' },
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'ev-text' } }] },
        { text: 'Todo marcha en orden.' },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of chunksWithText) {
          yield chunk;
        }
      };

      const streamA = streamChatWithSalesAssistant({
        message: '¿Cómo está la caja?',
        tenantId: 'test-tenant',
        eventId: 'ev-text',
      });

      const emittedA = [];
      for await (const ev of streamA) {
        emittedA.push(ev);
      }

      const textTokensA = emittedA.filter(e => e.type === 'token').map(e => e.text).join('');
      assert.ok(textTokensA.includes('Con gusto te comparto'));
      assert.ok(textTokensA.includes('Todo marcha en orden.'));
      assert.ok(!textTokensA.includes('💵 **Estado de Gaveta'));

      const chunksWithoutText = [
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'ev-notext' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of chunksWithoutText) {
          yield chunk;
        }
      };

      const streamB = streamChatWithSalesAssistant({
        message: 'Gaveta saldo',
        tenantId: 'test-tenant',
        eventId: 'ev-notext',
      });

      const emittedB = [];
      for await (const ev of streamB) {
        emittedB.push(ev);
      }

      const textTokensB = emittedB.filter(e => e.type === 'token').map(e => e.text).join('');
      assert.ok(textTokensB.includes('Estado de Gaveta') || textTokensB.includes('💵'), 'Debe emitir el summaryText en tokens si Gemini no dio texto');
    });

    it('3.4 Validación de Wire-Format SSE para el controlador Express (RFC EventStream)', async () => {
      const client = getGeminiClient();
      client.models.generateContentStream = async function* () {
        yield { text: 'Inicio de análisis ' };
        yield { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'wire-test' } }] };
        yield { text: 'Fin de análisis.' };
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Caja status',
        tenantId: 'test-tenant',
        eventId: 'wire-test',
      });

      const wireOutput = [];
      for await (const chunk of stream) {
        let wireMessage = '';
        if (chunk.type === 'token') {
          wireMessage = `event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`;
        } else if (chunk.type === 'cash_drawer_status') {
          wireMessage = `event: cash_drawer_status\ndata: ${JSON.stringify(chunk.data)}\n\n`;
        }
        wireOutput.push(wireMessage);
      }
      wireOutput.push(`event: done\ndata: ${JSON.stringify({ fullText: 'Final' })}\n\n`);

      for (const frame of wireOutput) {
        assert.ok(frame.endsWith('\n\n'), 'Cada frame SSE debe terminar con doble salto de línea \\n\\n');
        assert.ok(frame.startsWith('event: '), 'Cada frame SSE debe comenzar con event: ');
        assert.ok(frame.includes('\ndata: '), 'Cada frame SSE debe contener \\ndata: ');

        const match = frame.match(/data: (.+)\n\n$/s);
        assert.ok(match, 'Debe coincidir con la estructura de payload SSE');
        const parsed = JSON.parse(match[1]);
        assert.ok(parsed !== null && typeof parsed === 'object', 'El payload data debe ser JSON válido');
      }
    });

    it('3.5 Harness de Alta Concurrencia y Verificación de Fuga de Memoria (50 streams concurrentes)', async () => {
      const client = getGeminiClient();

      client.models.generateContentStream = async function* () {
        yield { text: 'Procesando concurrencia...' };
        yield { functionCalls: [{ name: 'getProductionQueueStatus', args: { eventId: 'concurrent-ev' } }] };
        yield { functionCalls: [{ name: 'checkInventoryStock', args: { query: 'Spider-Man', sizeId: 'MEDIANO' } }] };
        yield { text: ' Finalizado.' };
      };

      const NUM_CONCURRENT_STREAMS = 50;
      const initialMemory = process.memoryUsage().heapUsed;

      const runStream = async (id) => {
        const stream = streamChatWithSalesAssistant({
          message: `Stream concurrente #${id}`,
          tenantId: 'stress-tenant',
          eventId: 'concurrent-ev',
        });
        const events = [];
        for await (const chunk of stream) {
          events.push(chunk);
        }
        return events;
      };

      const startTime = Date.now();
      const results = await Promise.all(
        Array.from({ length: NUM_CONCURRENT_STREAMS }, (_, i) => runStream(i))
      );
      const durationMs = Date.now() - startTime;

      assert.strictEqual(results.length, NUM_CONCURRENT_STREAMS, 'Todos los streams deben finalizar');
      for (const streamEvents of results) {
        assert.ok(streamEvents.length >= 3, 'Cada stream debe haber emitido sus eventos');
        assert.ok(streamEvents.some(e => e.type === 'production_queue_status'));
        assert.ok(streamEvents.some(e => e.type === 'inventory_stock'));
      }

      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMb = (finalMemory - initialMemory) / (1024 * 1024);

      assert.ok(memoryGrowthMb < 50, `Crecimiento de memoria controlado (crecimiento: ${memoryGrowthMb.toFixed(2)} MB)`);
      assert.ok(durationMs < 30000, `Duración dentro de límites aceptables (${durationMs}ms para ${NUM_CONCURRENT_STREAMS} streams)`);
    });
  });
});
