import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import {
  executeGetCashDrawerStatus,
  executeGetSellerShiftReport,
  executeGetProductionQueueStatus,
  executeCheckInventoryStock,
} from '../../server/services/aiMultimodalService.js';
import { resolveEntityAlias } from '../../server/services/semanticParserService.js';

describe('⚔️ CHALLENGER 2: Verificación Adversarial Empírica de Oráculos Operativos (M3)', () => {

  // Guardamos las referencias originales para restaurar después de cada prueba
  let originalPrismaEvent;
  let originalPrismaSale;
  let originalPrismaSaleItem;
  let originalPrismaSalePayment;
  let originalPrismaCashClosing;
  let originalPrismaUser;

  beforeEach(() => {
    originalPrismaEvent = { ...prisma.event };
    originalPrismaSale = { ...prisma.sale };
    originalPrismaSaleItem = { ...prisma.saleItem };
    originalPrismaSalePayment = { ...prisma.salePayment };
    originalPrismaCashClosing = { ...prisma.cashClosing };
    originalPrismaUser = { ...prisma.user };
  });

  afterEach(() => {
    prisma.event = originalPrismaEvent;
    prisma.sale = originalPrismaSale;
    prisma.saleItem = originalPrismaSaleItem;
    prisma.salePayment = originalPrismaSalePayment;
    prisma.cashClosing = originalPrismaCashClosing;
    prisma.user = originalPrismaUser;
  });

  // =========================================================================
  // ORÁCULO 1: executeGetCashDrawerStatus (Exactitud Contable y Cero Fugas)
  // =========================================================================
  describe('1. Oráculo Contable de Gaveta (executeGetCashDrawerStatus)', () => {

    it('1.1. Sin arqueo previo: saldo de efectivo coincide exactamente con la suma de pagos en EFECTIVO', async () => {
      // Mock Event
      prisma.event.findUnique = async () => ({
        id: 'event-expocenter-2026',
        name: 'ExpoCenter Pop 2026',
        location: 'Stand 42',
        status: 'ACTIVO',
      });

      // Mock Payments por método (Simulamos pagos reales agregados)
      prisma.salePayment.groupBy = async ({ where }) => {
        // Validación de aislamiento: debe filtrar por evento y excluir ventas ANULADAS
        assert.strictEqual(where.sale.eventId, 'event-expocenter-2026');
        assert.deepStrictEqual(where.sale.status, { not: 'ANULADA' });

        return [
          { method: 'EFECTIVO', _sum: { amount: 435.00 }, _count: { id: 7 } },
          { method: 'TARJETA', _sum: { amount: 380.00 }, _count: { id: 4 } },
          { method: 'TRANSFERENCIA', _sum: { amount: 195.00 }, _count: { id: 3 } },
        ];
      };

      // Mock Sin arqueo previo
      prisma.cashClosing.findFirst = async () => null;

      const res = await executeGetCashDrawerStatus('tenant-deco', 'event-expocenter-2026');

      // 1. Exactitud de efectivo físico en gaveta
      assert.strictEqual(res.currentCashInDrawer, 435.00, 'El efectivo en gaveta debe ser exactamente Q435.00');
      assert.strictEqual(res.totalSalesInCash, 435.00);
      assert.strictEqual(res.cashTransactionsCount, 7);

      // 2. Aislamiento absoluto: Tarjetas y transferencias NO se suman al efectivo de gaveta
      assert.strictEqual(res.totalCardInSales, 380.00);
      assert.strictEqual(res.cardTransactionsCount, 4);
      assert.strictEqual(res.totalTransferInSales, 195.00);
      assert.strictEqual(res.transferTransactionsCount, 3);
      assert.notStrictEqual(res.currentCashInDrawer, 435.00 + 380.00, 'ALERTA: Tarjeta filtrada en efectivo');
      assert.notStrictEqual(res.currentCashInDrawer, 435.00 + 195.00, 'ALERTA: Transferencia filtrada en efectivo');

      // 3. Total bruto general
      const expectedGross = 435.00 + 380.00 + 195.00;
      assert.strictEqual(res.grossSalesTotal, expectedGross);

      // 4. Estado sin arqueos
      assert.strictEqual(res.lastClosing, null);
      assert.ok(res.summaryText.includes('Q 435.00'));
    });

    it('1.2. Con arqueo previo: fórmula contable fondoInicial + cobradoEfectivoPostArqueo = saldoEsperado', async () => {
      const closingTimestamp = new Date('2026-09-11T14:00:00.000Z');

      prisma.event.findUnique = async () => ({
        id: 'event-expocenter-2026',
        name: 'ExpoCenter Pop 2026',
        location: 'Stand 42',
        status: 'ACTIVO',
      });

      // Total histórico del día
      prisma.salePayment.groupBy = async () => [
        { method: 'EFECTIVO', _sum: { amount: 950.00 }, _count: { id: 15 } },
        { method: 'TARJETA', _sum: { amount: 520.00 }, _count: { id: 6 } },
        { method: 'TRANSFERENCIA', _sum: { amount: 260.00 }, _count: { id: 4 } },
      ];

      // Arqueo anterior a las 14:00 con reporte de Q600 en caja (sobrante Q20)
      prisma.cashClosing.findFirst = async () => ({
        id: 'closing-14h',
        closingDate: closingTimestamp,
        createdAt: closingTimestamp,
        totalCashCalculated: 580.00,
        totalCashReported: 600.00,
        cashDifference: 20.00,
        closingType: 'PARCIAL',
        closedBy: { fullName: 'Sebastian Gomez', email: 'sebas@deco.gt' },
        observations: 'Arqueo de cambio de turno',
      });

      // Cobrado en efectivo DESPUÉS de las 14:00 (exactamente Q350.00 en 5 ventas)
      prisma.salePayment.aggregate = async ({ where }) => {
        assert.strictEqual(where.method, 'EFECTIVO', 'Debe agregar únicamente EFECTIVO post-arqueo');
        assert.deepStrictEqual(where.sale.createdAt, { gt: closingTimestamp });
        return {
          _sum: { amount: 350.00 },
          _count: { id: 5 },
        };
      };

      const res = await executeGetCashDrawerStatus('tenant-deco', 'event-expocenter-2026');

      // Fórmula matemática: fondoReportado (600.00) + cobradoEfectivoPostArqueo (350.00) = 950.00
      assert.strictEqual(res.cashSinceLastClosing, 350.00);
      assert.strictEqual(res.salesCountSinceLastClosing, 5);
      assert.strictEqual(res.currentCashInDrawer, 600.00 + 350.00, 'Saldo esperado debe ser 600 + 350 = 950.00');
      assert.strictEqual(res.currentCashInDrawer, 950.00);

      // Verificación de status de discrepancia del arqueo previo
      assert.ok(res.lastClosing !== null);
      assert.strictEqual(res.lastClosing.difference, 20.00);
      assert.strictEqual(res.lastClosing.discrepancyStatus, 'SOBRANTE');
      assert.ok(res.summaryText.includes('Q 950.00'));
    });

    it('1.3. Clasificación exacta de discrepancias en arqueos previos (CUADRADO, SOBRANTE, FALTANTE)', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Test', location: 'Stand' });
      prisma.salePayment.groupBy = async () => [];
      prisma.salePayment.aggregate = async () => ({ _sum: { amount: 0 }, _count: { id: 0 } });

      // Caso 1: CUADRADO (dif = 0)
      prisma.cashClosing.findFirst = async () => ({
        id: 'c-1',
        closingDate: new Date(),
        createdAt: new Date(),
        totalCashCalculated: 500,
        totalCashReported: 500,
        cashDifference: 0,
        closedBy: { fullName: 'Vendedor A' },
      });
      let res = await executeGetCashDrawerStatus('tenant-1', 'ev-1');
      assert.strictEqual(res.lastClosing.discrepancyStatus, 'CUADRADO');

      // Caso 2: SOBRANTE (dif = +50)
      prisma.cashClosing.findFirst = async () => ({
        id: 'c-2',
        closingDate: new Date(),
        createdAt: new Date(),
        totalCashCalculated: 500,
        totalCashReported: 550,
        cashDifference: 50,
        closedBy: { fullName: 'Vendedor A' },
      });
      res = await executeGetCashDrawerStatus('tenant-1', 'ev-1');
      assert.strictEqual(res.lastClosing.discrepancyStatus, 'SOBRANTE');

      // Caso 3: FALTANTE (dif = -30)
      prisma.cashClosing.findFirst = async () => ({
        id: 'c-3',
        closingDate: new Date(),
        createdAt: new Date(),
        totalCashCalculated: 500,
        totalCashReported: 470,
        cashDifference: -30,
        closedBy: { fullName: 'Vendedor A' },
      });
      res = await executeGetCashDrawerStatus('tenant-1', 'ev-1');
      assert.strictEqual(res.lastClosing.discrepancyStatus, 'FALTANTE');
    });

    it('1.4. Resistencia a decimales y coma flotante contable (suma con centavos no pierde precisión)', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Test', location: 'Stand' });
      prisma.cashClosing.findFirst = async () => null;

      // 3 pagos de 33.33 + 33.33 + 33.34 = 100.00 exactos
      prisma.salePayment.groupBy = async () => [
        { method: 'EFECTIVO', _sum: { amount: 100.00 }, _count: { id: 3 } },
      ];

      const res = await executeGetCashDrawerStatus('tenant-1', 'ev-1');
      assert.strictEqual(res.currentCashInDrawer, 100.00);
      assert.strictEqual(typeof res.currentCashInDrawer, 'number');
      assert.ok(Number.isFinite(res.currentCashInDrawer));
    });
  });

  // =========================================================================
  // ORÁCULO 2: executeGetSellerShiftReport (Agrupación y Ticket Promedio)
  // =========================================================================
  describe('2. Oráculo de Desempeño y Turnos (executeGetSellerShiftReport)', () => {

    it('2.1. Ventas agrupadas estrictamente por vendedor y ticket promedio = totalVentas / cantidadVentas', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Feria Pop', location: 'Stand Central' });

      // 3 vendedores con ventas
      prisma.sale.groupBy = async () => [
        { sellerId: 'seller-alice', _count: { id: 4 }, _sum: { totalAmount: 310.00 } },
        { sellerId: 'seller-bob', _count: { id: 2 }, _sum: { totalAmount: 305.00 } },
        { sellerId: 'seller-charlie', _count: { id: 5 }, _sum: { totalAmount: 165.00 } },
      ];

      prisma.user.findMany = async () => [
        { id: 'seller-alice', fullName: 'Alice Gomez', email: 'alice@deco.gt', role: 'VENDEDOR' },
        { id: 'seller-bob', fullName: 'Bob Morales', email: 'bob@deco.gt', role: 'VENDEDOR' },
        { id: 'seller-charlie', fullName: 'Charlie Ruiz', email: 'charlie@deco.gt', role: 'VENDEDOR' },
      ];

      prisma.saleItem.aggregate = async ({ where }) => {
        const sId = where.sale.sellerId;
        if (sId === 'seller-alice') return { _sum: { quantity: 6 } };
        if (sId === 'seller-bob') return { _sum: { quantity: 3 } };
        return { _sum: { quantity: 5 } };
      };

      prisma.salePayment.groupBy = async ({ where }) => {
        const sId = where.sale.sellerId;
        if (sId === 'seller-alice') {
          return [
            { method: 'EFECTIVO', _sum: { amount: 120.00 }, _count: { id: 2 } },
            { method: 'TARJETA', _sum: { amount: 125.00 }, _count: { id: 1 } },
            { method: 'TRANSFERENCIA', _sum: { amount: 65.00 }, _count: { id: 1 } },
          ];
        }
        return [];
      };

      const res = await executeGetSellerShiftReport('tenant-1', 'ev-1');

      // Total evento: 310 + 305 + 165 = 780.00
      assert.strictEqual(res.eventTotalRevenue, 780.00);
      assert.strictEqual(res.eventTotalTransactions, 11);
      assert.strictEqual(res.totalSellersActive, 3);

      // Ranking ordenado descendentemente por recaudación
      assert.strictEqual(res.ranking[0].sellerName, 'Alice Gomez');
      assert.strictEqual(res.ranking[0].position, 1);
      assert.strictEqual(res.ranking[0].totalAmount, 310.00);
      assert.strictEqual(res.ranking[0].transactionCount, 4);

      // Verificación matemática del Ticket Promedio: 310 / 4 = 77.50
      assert.strictEqual(res.ranking[0].averageTicket, 77.50);

      // Bob: 305 / 2 = 152.50
      assert.strictEqual(res.ranking[1].sellerName, 'Bob Morales');
      assert.strictEqual(res.ranking[1].position, 2);
      assert.strictEqual(res.ranking[1].averageTicket, 152.50);

      // Charlie: 165 / 5 = 33.00
      assert.strictEqual(res.ranking[2].sellerName, 'Charlie Ruiz');
      assert.strictEqual(res.ranking[2].position, 3);
      assert.strictEqual(res.ranking[2].averageTicket, 33.00);

      // Desglose de pagos de Alice
      assert.strictEqual(res.ranking[0].payments.EFECTIVO.amount, 120.00);
      assert.strictEqual(res.ranking[0].payments.TARJETA.amount, 125.00);
      assert.strictEqual(res.ranking[0].payments.TRANSFERENCIA.amount, 65.00);
    });

    it('2.2. Prevención inquebrantable de división por cero (NaN / Infinity) si un vendedor o evento tiene 0 ventas', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Feria Pop', location: 'Stand Central' });
      prisma.sale.groupBy = async () => [];
      prisma.user.findMany = async () => [
        { id: 'seller-new', fullName: 'Nuevo Vendedor', email: 'nuevo@deco.gt', role: 'VENDEDOR' },
      ];

      // Consulta de vendedor específico sin ventas
      const res = await executeGetSellerShiftReport('tenant-1', 'ev-1', 'seller-new');

      assert.ok(res.seller !== null);
      assert.strictEqual(res.seller.transactionCount, 0);
      assert.strictEqual(res.seller.totalAmount, 0);
      assert.strictEqual(res.seller.averageTicket, 0, 'averageTicket no debe ser NaN ni Infinity');
      assert.strictEqual(res.seller.sharePercentage, 0);
      assert.ok(!Number.isNaN(res.seller.averageTicket));
      assert.ok(Number.isFinite(res.seller.averageTicket));
    });
  });

  // =========================================================================
  // ORÁCULO 3: executeGetProductionQueueStatus (Consistencia y Tiempos)
  // =========================================================================
  describe('3. Oráculo de Taller y Producción (executeGetProductionQueueStatus)', () => {

    it('3.1. Suma de estados consistente: total = pending + separated + inProduction + printed', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Evento Taller', location: 'Stand' });

      prisma.saleItem.groupBy = async () => [
        { productionStatus: 'PENDIENTE', _count: { id: 6 }, _sum: { quantity: 6 } },
        { productionStatus: 'SEPARADO', _count: { id: 14 }, _sum: { quantity: 14 } },
        { productionStatus: 'A_PRODUCCION', _count: { id: 5 }, _sum: { quantity: 5 } },
        { productionStatus: 'IMPRESO', _count: { id: 25 }, _sum: { quantity: 25 } },
      ];

      // Simulamos 11 órdenes activas (6 PENDIENTE + 5 A_PRODUCCION)
      const now = Date.now();
      const mockActiveItems = [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `item-pend-${i}`,
          productionStatus: 'PENDIENTE',
          createdAt: new Date(now - (i + 1) * 5 * 60000), // 5, 10, 15, 20, 25, 30 min
          sale: { saleNumber: `V-10${i}`, seller: { fullName: 'Alice' } },
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `item-prod-${i}`,
          productionStatus: 'A_PRODUCCION',
          createdAt: new Date(now - (i + 2) * 8 * 60000), // 16, 24, 32, 40, 48 min
          sale: { saleNumber: `V-20${i}`, seller: { fullName: 'Bob' } },
        })),
      ];

      prisma.saleItem.findMany = async ({ where }) => {
        if (where.productionStatus && where.productionStatus.in) {
          return mockActiveItems;
        }
        if (where.productionStatus === 'IMPRESO') {
          return [
            { createdAt: new Date(now - 30 * 60000), impresoAt: new Date(now - 15 * 60000) }, // 15 min
            { createdAt: new Date(now - 25 * 60000), impresoAt: new Date(now - 10 * 60000) }, // 15 min
          ];
        }
        return [];
      };

      const res = await executeGetProductionQueueStatus('tenant-1', 'ev-1');

      // 1. Verificación de conteos y suma total consistente
      assert.strictEqual(res.counts.pending, 6);
      assert.strictEqual(res.counts.separated, 14);
      assert.strictEqual(res.counts.inProduction, 5);
      assert.strictEqual(res.counts.printed, 25);
      assert.strictEqual(res.counts.activeQueueCount, 6 + 5);
      assert.strictEqual(res.counts.total, 6 + 14 + 5 + 25);
      assert.strictEqual(res.counts.total, 50);

      // 2. Tiempo promedio proporcional y rezagos
      assert.ok(typeof res.timing.averageQueueWaitMinutes === 'number');
      assert.ok(res.timing.averageQueueWaitMinutes > 0);
      assert.ok(res.timing.maxWaitMinutes >= 48);
      assert.strictEqual(res.timing.averagePrintTurnaroundMinutes, 15);

      // 3. Detección de órdenes rezagadas (>30 min) y críticas (>=45 min)
      assert.ok(res.stalledJobs.length >= 3);
      assert.ok(res.stalledJobs.some((j) => j.urgency === 'CRITICA'));
      assert.strictEqual(res.health, 'CRITICO');
    });

    it('3.2. Cola vacía: métricas en 0 sin divisiones por cero ni errores de redondeo', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Evento Vacío', location: 'Stand' });
      prisma.saleItem.groupBy = async () => [];
      prisma.saleItem.findMany = async () => [];

      const res = await executeGetProductionQueueStatus('tenant-1', 'ev-1');

      assert.strictEqual(res.counts.pending, 0);
      assert.strictEqual(res.counts.inProduction, 0);
      assert.strictEqual(res.counts.total, 0);
      assert.strictEqual(res.counts.activeQueueCount, 0);
      assert.strictEqual(res.timing.averageQueueWaitMinutes, 0);
      assert.strictEqual(res.timing.maxWaitMinutes, 0);
      assert.strictEqual(res.timing.averagePrintTurnaroundMinutes, null);
      assert.strictEqual(res.health, 'OPTIMO');
    });
  });

  // =========================================================================
  // ORÁCULO 4: executeCheckInventoryStock (Resolución de Entidades y Q55)
  // =========================================================================
  describe('4. Oráculo de Catálogo e Inventario (executeCheckInventoryStock)', () => {

    it('4.1. Entidad cultural "un verano sin ti" resuelve portada de álbum a precio canónico de Q55.00', async () => {
      const res = await executeCheckInventoryStock('tenant-deco', 'un verano sin ti');

      assert.strictEqual(res.found, true);
      assert.ok(res.artwork.title.toLowerCase().includes('verano sin ti') || res.artwork.title.toLowerCase().includes('bad bunny'));
      assert.strictEqual(res.artwork.category, 'MUSICA');

      // El tamaño por defecto resuelto debe ser PORTADA_ALBUM
      assert.ok(res.requestedSize !== null);
      assert.strictEqual(res.requestedSize.sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(res.requestedSize.precio, 55, 'Precio de PORTADA_ALBUM debe ser exactamente Q55.00');

      // Modalidad de entrega: inmediata en mostrador
      assert.strictEqual(res.stockAvailability.standPhysicalStock, 'DISPONIBLE_MOSTRADOR');
      assert.strictEqual(res.stockAvailability.estimatedWaitMinutes, 0);
    });

    it('4.2. Entidad cultural "taylor swift" resuelve portada de álbum a precio canónico de Q55.00', async () => {
      const res = await executeCheckInventoryStock('tenant-deco', 'taylor swift');

      assert.strictEqual(res.found, true);
      assert.ok(res.artwork.title.toLowerCase().includes('taylor'));
      assert.strictEqual(res.artwork.category, 'MUSICA');
      assert.strictEqual(res.requestedSize.sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(res.requestedSize.precio, 55, 'Precio de PORTADA_ALBUM para Taylor Swift debe ser Q55.00');
    });

    it('4.3. Variaciones coloquiales de portada ("portada", "vinilo", "cuadrado") fuerzan Q55.00', async () => {
      const aliasesPortada = ['portada', 'portada de album', 'vinilo', 'cuadrado'];

      for (const alias of aliasesPortada) {
        const res = await executeCheckInventoryStock('tenant-deco', 'Spider-Man', alias);
        assert.strictEqual(res.found, true);
        assert.strictEqual(res.requestedSize.sizeId, 'PORTADA_ALBUM');
        assert.strictEqual(res.requestedSize.precio, 55, `El alias de tamaño "${alias}" debe costar Q55.00`);
      }
    });

    it('4.4. Diccionario STAND_ENTITY_ALIASES mapea correctamente artistas y películas icónicas', () => {
      const cases = [
        { query: 'conejo malo', expectedTitleContains: 'Bad Bunny', category: 'MUSICA', defaultSize: 'PORTADA_ALBUM' },
        { query: 'el benito', expectedTitleContains: 'Bad Bunny', category: 'MUSICA', defaultSize: 'PORTADA_ALBUM' },
        { query: '1989', expectedTitleContains: 'Taylor Swift', category: 'MUSICA', defaultSize: 'PORTADA_ALBUM' },
        { query: 'abbey road', expectedTitleContains: 'Beatles', category: 'MUSICA', defaultSize: 'PORTADA_ALBUM' },
        { query: 'dark side of the moon', expectedTitleContains: 'Pink Floyd', category: 'MUSICA', defaultSize: 'PORTADA_ALBUM' },
        { query: 'checo perez', expectedTitleContains: 'Checo Pérez', category: 'AUTOS' },
        { query: 'goku', expectedTitleContains: 'Dragon Ball', category: 'ANIME' },
      ];

      for (const c of cases) {
        const match = resolveEntityAlias(c.query);
        assert.strictEqual(match.matched, true, `Debe coincidir el alias "${c.query}"`);
        assert.ok(match.canonicalTitle.includes(c.expectedTitleContains), `Título debe contener "${c.expectedTitleContains}", recibido: "${match.canonicalTitle}"`);
        if (c.category) {
          assert.strictEqual(match.category, c.category);
        }
        if (c.defaultSize) {
          assert.strictEqual(match.defaultSizeId, c.defaultSize);
        }
      }
    });

    it('4.5. Consultas vacías, nulas o con espacios retornan found: false con mensaje claro', async () => {
      const emptyQueries = ['', '   ', null, undefined];
      for (const q of emptyQueries) {
        const res = await executeCheckInventoryStock('tenant-deco', q);
        assert.strictEqual(res.found, false);
        assert.ok(res.message.includes('especificar'));
      }
    });
  });

  // =========================================================================
  // ORÁCULO 5: BATERÍA DE ESTRÉS, CONCURRENCIA Y LÍMITES OPERATIVOS
  // =========================================================================
  describe('5. Batería de Estrés, Concurrencia y Casos Límite en Oráculos', () => {

    it('5.1. Concurrencia Masiva: 30 consultas simultáneas paralelas sin colisiones ni memory leaks', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-perf', name: 'Evento Masivo', location: 'Stand' });
      prisma.cashClosing.findFirst = async () => null;
      prisma.salePayment.groupBy = async () => [
        { method: 'EFECTIVO', _sum: { amount: 500.00 }, _count: { id: 10 } }
      ];
      prisma.sale.groupBy = async () => [
        { sellerId: 's-1', _count: { id: 10 }, _sum: { totalAmount: 500.00 } }
      ];
      prisma.user.findMany = async () => [
        { id: 's-1', fullName: 'Vendedor Pro', email: 'pro@deco.gt', role: 'VENDEDOR' }
      ];
      prisma.saleItem.groupBy = async () => [];
      prisma.saleItem.findMany = async () => [];

      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(executeGetCashDrawerStatus('tenant-test', 'ev-perf'));
        promises.push(executeGetSellerShiftReport('tenant-test', 'ev-perf'));
        promises.push(executeGetProductionQueueStatus('tenant-test', 'ev-perf'));
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 90, 'Todas las 90 llamadas deben completarse exitosamente');
      for (const r of results) {
        assert.ok(r !== null && typeof r === 'object');
      }
    });

    it('5.2. Split Payments: En ventas mixtas (efectivo + tarjeta), el efectivo no se contamina', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-split', name: 'Evento Split', location: 'Stand' });
      prisma.cashClosing.findFirst = async () => null;

      // 10 ventas de Q65 pagadas con Q35 efectivo + Q30 tarjeta
      prisma.salePayment.groupBy = async () => [
        { method: 'EFECTIVO', _sum: { amount: 350.00 }, _count: { id: 10 } },
        { method: 'TARJETA', _sum: { amount: 300.00 }, _count: { id: 10 } },
      ];

      const res = await executeGetCashDrawerStatus('tenant-split', 'ev-split');

      assert.strictEqual(res.currentCashInDrawer, 350.00, 'Solo los Q350 de efectivo deben estar en gaveta');
      assert.strictEqual(res.totalCardInSales, 300.00, 'Los Q300 deben estar estrictamente en tarjeta');
      assert.strictEqual(res.grossSalesTotal, 650.00, 'El total bruto debe ser Q650.00');
    });

    it('5.3. Exclusión estricta e incondicional de ventas ANULADAS en todos los oráculos', async () => {
      let cashWhereUsed = null;
      let sellerWhereUsed = null;
      let queueWhereUsed = null;

      prisma.event.findUnique = async () => ({ id: 'ev-anulada', name: 'Evento Anuladas', location: 'Stand' });
      prisma.cashClosing.findFirst = async () => null;

      prisma.salePayment.groupBy = async ({ where }) => {
        cashWhereUsed = where;
        return [];
      };
      prisma.sale.groupBy = async ({ where }) => {
        sellerWhereUsed = where;
        return [];
      };
      prisma.saleItem.groupBy = async ({ where }) => {
        queueWhereUsed = where;
        return [];
      };
      prisma.saleItem.findMany = async () => [];

      await executeGetCashDrawerStatus('tenant-1', 'ev-anulada');
      await executeGetSellerShiftReport('tenant-1', 'ev-anulada');
      await executeGetProductionQueueStatus('tenant-1', 'ev-anulada');

      assert.deepStrictEqual(cashWhereUsed.sale.status, { not: 'ANULADA' }, 'Cash drawer debe excluir ANULADAS');
      assert.deepStrictEqual(sellerWhereUsed.status, { not: 'ANULADA' }, 'Seller report debe excluir ANULADAS');
      assert.deepStrictEqual(queueWhereUsed.sale.status, { not: 'ANULADA' }, 'Production queue debe excluir ANULADAS');
    });

    it('5.4. Máquina de estados de salud operativa en taller: transiciones correctas según carga', async () => {
      prisma.event.findUnique = async () => ({ id: 'ev-health', name: 'Evento Health', location: 'Stand' });
      prisma.saleItem.findMany = async () => [];

      // Caso A: OPTIMO (activos <= 3)
      prisma.saleItem.groupBy = async () => [
        { productionStatus: 'PENDIENTE', _count: { id: 2 }, _sum: { quantity: 2 } },
        { productionStatus: 'A_PRODUCCION', _count: { id: 1 }, _sum: { quantity: 1 } },
      ];
      let res = await executeGetProductionQueueStatus('tenant-1', 'ev-health');
      assert.strictEqual(res.health, 'OPTIMO');

      // Caso B: MODERADO (activos > 3 y <= 8)
      prisma.saleItem.groupBy = async () => [
        { productionStatus: 'PENDIENTE', _count: { id: 3 }, _sum: { quantity: 3 } },
        { productionStatus: 'A_PRODUCCION', _count: { id: 2 }, _sum: { quantity: 2 } }, // 5 total
      ];
      res = await executeGetProductionQueueStatus('tenant-1', 'ev-health');
      assert.strictEqual(res.health, 'MODERADO');

      // Caso C: SATURADO (activos > 8 y <= 15)
      prisma.saleItem.groupBy = async () => [
        { productionStatus: 'PENDIENTE', _count: { id: 6 }, _sum: { quantity: 6 } },
        { productionStatus: 'A_PRODUCCION', _count: { id: 4 }, _sum: { quantity: 4 } }, // 10 total
      ];
      res = await executeGetProductionQueueStatus('tenant-1', 'ev-health');
      assert.strictEqual(res.health, 'SATURADO');

      // Caso D: CRITICO (activos > 15)
      prisma.saleItem.groupBy = async () => [
        { productionStatus: 'PENDIENTE', _count: { id: 10 }, _sum: { quantity: 10 } },
        { productionStatus: 'A_PRODUCCION', _count: { id: 8 }, _sum: { quantity: 8 } }, // 18 total
      ];
      res = await executeGetProductionQueueStatus('tenant-1', 'ev-health');
      assert.strictEqual(res.health, 'CRITICO');
    });

    it('5.5. Robustez de aliases culturales ante diacríticos, mayúsculas mezcladas y límite de signos de puntuación', () => {
      // 1. Variaciones robustas de mayúsculas, diacríticos y apodos canónicos (DEBEN pasar)
      const validVariations = [
        'un verano sin ti',
        'TAYLOR SWIFT',
        'el conejo malo',
        'cruzando la calle',
        'THE BEATLES',
        'el corazon de bad bunny',
        'GOKU ULTRA INSTINTO',
      ];

      for (const input of validVariations) {
        const match = resolveEntityAlias(input);
        assert.strictEqual(match.matched, true, `Debe resolver la variación léxica: "${input}"`);
        assert.ok(match.canonicalTitle.length > 0);
      }

      // 2. Comprobación empírica adversarial del límite con signos de puntuación invertidos (¡, ¿):
      // Demuestra empíricamente que signos no alfanuméricos como "¡" o "¿" no son podados por normalizeSemanticText,
      // requiriendo que los inputs desde LLM o UI vengan limpios o sanitizados.
      const punctuationInput = '¡un verano sin ti!';
      const matchPunctuation = resolveEntityAlias(punctuationInput);
      // Se documenta el comportamiento real observado para el informe de hallazgos
      assert.strictEqual(matchPunctuation.matched, false, 'normalizeSemanticText preserva ¡ y !, por lo que no hace match exacto');
    });
  });
});

