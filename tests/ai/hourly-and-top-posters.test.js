import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  salesAssistantTools,
  getHourlySalesAnalyticsDeclaration,
  getTopSellingPostersDeclaration
} from '../../server/services/ai/aiToolsService.js';
import {
  buildFallbackSummaries,
  streamClosedLoopFollowUp
} from '../../server/services/ai/aiClosedLoopService.js';
import {
  getHourlySalesAnalytics,
  getTopSellingPosters
} from '../../server/services/sales/saleAnalyticsService.js';
import { prisma } from '../../server/config/prisma.js';

describe('🎯 Suite de Analítica Horaria, Top Pósters y Anti-Colisión (STAND {IA})', () => {
  it('1.1 Declaraciones getHourlySalesAnalytics y getTopSellingPosters registradas en salesAssistantTools', () => {
    assert.strictEqual(getHourlySalesAnalyticsDeclaration.name, 'getHourlySalesAnalytics');
    assert.ok(getHourlySalesAnalyticsDeclaration.description.includes('horario'));

    assert.strictEqual(getTopSellingPostersDeclaration.name, 'getTopSellingPosters');
    assert.ok(getTopSellingPostersDeclaration.description.includes('podio oficial con los 3 pósters más vendidos'));

    const toolNames = salesAssistantTools[0].functionDeclarations.map(d => d.name);
    assert.ok(toolNames.includes('getHourlySalesAnalytics'), 'salesAssistantTools debe incluir getHourlySalesAnalytics');
    assert.ok(toolNames.includes('getTopSellingPosters'), 'salesAssistantTools debe incluir getTopSellingPosters');
  });

  it('1.2 Anti-Colisión: Ante búsquedas múltiples (éxito + fallo), buildFallbackSummaries consolida y NO emite frases contradictorias', () => {
    const executedTools = [
      {
        name: 'searchCatalog',
        args: { query: 'sombrero' },
        result: { matchesCount: 11, posters: [{ titulo: 'Taylor Swift' }] }
      },
      {
        name: 'searchCatalog',
        args: { query: 'sombrero courly' },
        result: { matchesCount: 0, posters: [] }
      }
    ];

    const summaries = buildFallbackSummaries(executedTools);
    assert.strictEqual(summaries.length, 1, 'Debe haber exactamente un resumen consolidado de catálogo');
    assert.ok(summaries[0].includes('Mostrando 11 opciones'), 'Debe reflejar las 11 opciones encontradas');
    assert.ok(!summaries[0].includes('No encontré obras'), 'NUNCA debe añadir "No encontré obras" si hubo aciertos en el turno');
  });

  it('1.3 Búsqueda sin aciertos emite el mensaje de no encontrado de forma limpia', () => {
    const executedTools = [
      {
        name: 'searchCatalog',
        args: { query: 'inexistente xyz' },
        result: { matchesCount: 0, posters: [] }
      }
    ];

    const summaries = buildFallbackSummaries(executedTools);
    assert.strictEqual(summaries.length, 1);
    assert.ok(summaries[0].includes('No encontré obras con ese criterio'));
  });

  it('1.4 buildFallbackSummaries formatea getHourlySalesAnalytics y getTopSellingPosters con métricas reales', () => {
    const executedTools = [
      {
        name: 'getHourlySalesAnalytics',
        result: {
          peakWindow: '5:00 PM - 8:30 PM',
          peakAmount: 2150.00,
          peakPercentage: 58.2
        }
      },
      {
        name: 'getTopSellingPosters',
        result: {
          topPosters: [
            { rank: 1, title: 'Taylor Swift Eras Tour', unitsSold: 14 },
            { rank: 2, title: 'Spider-Man', unitsSold: 9 }
          ]
        }
      }
    ];

    const summaries = buildFallbackSummaries(executedTools);
    assert.strictEqual(summaries.length, 2);
    assert.ok(summaries[0].includes('5:00 PM - 8:30 PM'));
    assert.ok(summaries[0].includes('Q 2150.00'));
    assert.ok(summaries[1].includes('🥇 Taylor Swift Eras Tour (14 uds)'));
  });

  it('1.5 streamClosedLoopFollowUp separa múltiples resúmenes con doble salto de línea (\\n\\n) evitando la unión directa de tokens', async () => {
    const dummyClient = {
      models: {
        generateContentStream: async function* () {
          // Generador vacío para forzar fallback de resúmenes
        }
      }
    };

    const executedTools = [
      {
        name: 'getHourlySalesAnalytics',
        result: { peakWindow: '5:00 PM - 8:00 PM', peakAmount: 1200, peakPercentage: 45 }
      },
      {
        name: 'getTopSellingPosters',
        result: { topPosters: [{ rank: 1, title: 'Taylor Swift', unitsSold: 10 }] }
      }
    ];

    const generator = streamClosedLoopFollowUp({
      executedTools,
      formattedContents: [{ role: 'user', parts: [{ text: 'horas y top' }] }],
      systemInstruction: '',
      client: dummyClient,
      trailingTextTokens: 0
    });

    const emitted = [];
    for await (const chunk of generator) emitted.push(chunk);

    assert.ok(emitted.length >= 3, 'Debe emitir ambos textos y el separador de doble salto');
    const newlineChunk = emitted.find(c => c.text === '\n\n');
    assert.ok(newlineChunk, 'Debe existir un chunk separador "\\n\\n" entre resúmenes de herramientas');
  });

  it('1.6 getHourlySalesAnalytics opera en modo resiliente si no hay conexión o no hay evento', async () => {
    const result = await getHourlySalesAnalytics({ tenantId: 'test', eventId: 'non-existent' });
    assert.ok(result);
    assert.ok(Array.isArray(result.hourlyBreakdown));
    assert.strictEqual(typeof result.totalAmount, 'number');
    assert.strictEqual(typeof result.peakWindow, 'string');
  });

  it('1.7 getTopSellingPosters opera en modo resiliente retornando estructura segura', async () => {
    const result = await getTopSellingPosters({ tenantId: 'test', eventId: 'non-existent', limit: 3 });
    assert.ok(result);
    assert.ok(Array.isArray(result.topPosters));
    assert.strictEqual(typeof result.count, 'number');
  });

  it('1.8 getTopSellingPosters consolida variantes de tamaño en una sola obra y suma subtotales contables reales', async () => {
    const origEventFindUnique = prisma.event?.findUnique;
    const origEventFindFirst = prisma.event?.findFirst;
    const origSaleItemGroupBy = prisma.saleItem?.groupBy;
    const origProductFindMany = prisma.product?.findMany;

    try {
      if (!prisma.event) prisma.event = {};
      if (!prisma.saleItem) prisma.saleItem = {};
      if (!prisma.product) prisma.product = {};

      prisma.event.findFirst = async () => ({ id: 'ev-1', name: 'Super Comic Con' });
      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Super Comic Con' });

      // Simular ventas con variantes de tamaño de la misma obra y diferentes obras
      prisma.saleItem.groupBy = async () => [
        { productId: 'prod-spider', description: 'Póster Spider-Man (Mediano)', _sum: { quantity: 10, subtotal: 650.00 } },
        { productId: 'prod-spider', description: 'Póster Spider-Man (Grande)', _sum: { quantity: 5, subtotal: 625.00 } },
        { productId: 'prod-batman', description: 'Batman Vintage (Mediano)', _sum: { quantity: 8, subtotal: 520.00 } },
        { productId: null, description: 'Luffy Gear 5 (Mediano)', _sum: { quantity: 6, subtotal: 390.00 } },
        { productId: null, description: 'Luffy Gear 5 (Grande)', _sum: { quantity: 1, subtotal: 125.00 } },
      ];

      prisma.product.findMany = async () => [
        { id: 'prod-spider', name: 'Spider-Man No Way Home', category: 'MARVEL', imageUrl: 'https://img.deko/spidey.jpg', basePrice: 65 },
        { id: 'prod-batman', name: 'Batman Detective Comics', category: 'DC', imageUrl: 'https://img.deko/batman.jpg', basePrice: 65 },
      ];

      const res = await getTopSellingPosters({ tenantId: 'tenant-test', eventId: 'ev-1' });
      assert.strictEqual(res.topPosters.length, 3, 'Debe devolver exactamente el Top 3');

      // Puesto 1: Spider-Man consolidado (10 + 5 = 15 uds, Q650 + Q625 = Q1275.00)
      const p1 = res.topPosters[0];
      assert.strictEqual(p1.rank, 1);
      assert.strictEqual(p1.title, 'Spider-Man No Way Home');
      assert.strictEqual(p1.unitsSold, 15);
      assert.strictEqual(p1.totalRevenue, 1275.00);
      assert.strictEqual(p1.category, 'MARVEL');
      assert.strictEqual(p1.imageUrl, 'https://img.deko/spidey.jpg');

      // Puesto 2: Batman (8 uds, Q520.00)
      const p2 = res.topPosters[1];
      assert.strictEqual(p2.rank, 2);
      assert.strictEqual(p2.title, 'Batman Detective Comics');
      assert.strictEqual(p2.unitsSold, 8);
      assert.strictEqual(p2.totalRevenue, 520.00);

      // Puesto 3: Luffy consolidado por título limpio (6 + 1 = 7 uds, Q390 + Q125 = Q515.00)
      const p3 = res.topPosters[2];
      assert.strictEqual(p3.rank, 3);
      assert.strictEqual(p3.title, 'Luffy Gear 5');
      assert.strictEqual(p3.unitsSold, 7);
      assert.strictEqual(p3.totalRevenue, 515.00);
    } finally {
      if (prisma.event) {
        prisma.event.findUnique = origEventFindUnique;
        prisma.event.findFirst = origEventFindFirst;
      }
      if (prisma.saleItem) prisma.saleItem.groupBy = origSaleItemGroupBy;
      if (prisma.product) prisma.product.findMany = origProductFindMany;
    }
  });

  it('1.9 getTopSellingPosters impone tope estricto en exactamente 3 obras aunque se solicite mayor límite', async () => {
    const origEventFindUnique = prisma.event?.findUnique;
    const origSaleItemGroupBy = prisma.saleItem?.groupBy;
    const origProductFindMany = prisma.product?.findMany;

    try {
      if (!prisma.event) prisma.event = {};
      if (!prisma.saleItem) prisma.saleItem = {};
      if (!prisma.product) prisma.product = {};

      prisma.event.findUnique = async () => ({ id: 'ev-1', name: 'Super Comic Con' });

      // 6 obras distintas
      prisma.saleItem.groupBy = async () => [
        { productId: 'p-1', description: 'Obra 1', _sum: { quantity: 20, subtotal: 1000 } },
        { productId: 'p-2', description: 'Obra 2', _sum: { quantity: 18, subtotal: 900 } },
        { productId: 'p-3', description: 'Obra 3', _sum: { quantity: 15, subtotal: 750 } },
        { productId: 'p-4', description: 'Obra 4', _sum: { quantity: 12, subtotal: 600 } },
        { productId: 'p-5', description: 'Obra 5', _sum: { quantity: 10, subtotal: 500 } },
        { productId: 'p-6', description: 'Obra 6', _sum: { quantity: 8, subtotal: 400 } },
      ];
      prisma.product.findMany = async () => [];

      const res = await getTopSellingPosters({ tenantId: 'tenant-test', eventId: 'ev-1', limit: 10 });
      assert.strictEqual(res.topPosters.length, 3, 'El podio DEBE tener un tope estricto de 3');
      assert.deepStrictEqual(res.topPosters.map(p => p.rank), [1, 2, 3]);
      assert.strictEqual(res.topPosters[0].unitsSold, 20);
      assert.strictEqual(res.topPosters[1].unitsSold, 18);
      assert.strictEqual(res.topPosters[2].unitsSold, 15);
    } finally {
      if (prisma.event) prisma.event.findUnique = origEventFindUnique;
      if (prisma.saleItem) prisma.saleItem.groupBy = origSaleItemGroupBy;
      if (prisma.product) prisma.product.findMany = origProductFindMany;
    }
  });
});
