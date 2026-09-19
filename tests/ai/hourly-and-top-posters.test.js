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

describe('🎯 Suite de Analítica Horaria, Top Pósters y Anti-Colisión (STAND {IA})', () => {
  it('1.1 Declaraciones getHourlySalesAnalytics y getTopSellingPosters registradas en salesAssistantTools', () => {
    assert.strictEqual(getHourlySalesAnalyticsDeclaration.name, 'getHourlySalesAnalytics');
    assert.ok(getHourlySalesAnalyticsDeclaration.description.includes('horario'));

    assert.strictEqual(getTopSellingPostersDeclaration.name, 'getTopSellingPosters');
    assert.ok(getTopSellingPostersDeclaration.description.includes('ranking') || getTopSellingPostersDeclaration.description.includes('pósters más vendidos'));

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
});
