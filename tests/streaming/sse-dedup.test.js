import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { streamChatWithSalesAssistant } from '../../server/services/aiMultimodalService.js';

describe('⚡ Suite de Deduplicación SSE en Function Calling (M2)', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-gemini-key-for-m2-dedup';
  });

  it('1. Deduplica functionCalls idénticas recibidas en múltiples chunks consecutivos', async () => {
    const client = getGeminiClient();
    assert.ok(client, 'El cliente de Gemini debe estar inicializado');

    const fakeChunks = [
      { text: 'Buscando en el catálogo... ' },
      { functionCalls: [{ name: 'searchCatalog', args: { query: 'batman', category: 'CINE' } }] },
      { text: 'Encontré estas opciones: ', functionCalls: [{ name: 'searchCatalog', args: { query: 'batman', category: 'CINE' } }] },
      { functionCalls: [{ name: 'searchCatalog', args: { query: 'batman', category: 'CINE' } }] },
      { text: '¿Deseas alguna en especial?' }
    ];

    client.models.generateContentStream = async function* () {
      for (const chunk of fakeChunks) {
        yield chunk;
      }
    };

    const stream = streamChatWithSalesAssistant({
      message: 'Tienes pósters de batman?',
      tenantId: 'test-tenant',
      eventId: null,
    });

    const emittedEvents = [];
    for await (const event of stream) {
      emittedEvents.push(event);
    }

    // Contar eventos emitidos
    const suggestedPostersEvents = emittedEvents.filter(e => e.type === 'suggested_posters');
    const tokenEvents = emittedEvents.filter(e => e.type === 'token');

    assert.strictEqual(suggestedPostersEvents.length, 1, 'Debe emitir exactamente 1 evento suggested_posters a pesar de estar repetido en 3 chunks');
    assert.strictEqual(tokenEvents.length, 3, 'Debe emitir los 3 tokens de texto sin supresión');
    assert.strictEqual(tokenEvents[0].text, 'Buscando en el catálogo... ');
    assert.strictEqual(tokenEvents[1].text, 'Encontré estas opciones: ');
    assert.strictEqual(tokenEvents[2].text, '¿Deseas alguna en especial?');
  });

  it('2. Deduplica prepareSaleDraft cuando la llamada a herramienta se repite en chunks subsecuentes', async () => {
    const client = getGeminiClient();

    const fakeChunks = [
      { text: 'He preparado el borrador: ' },
      {
        functionCalls: [
          {
            name: 'prepareSaleDraft',
            args: {
              items: [{ productName: 'Spider-Man', quantity: 1, unitPrice: 65, size: 'MEDIANO' }],
              paymentMethod: 'EFECTIVO'
            }
          }
        ]
      },
      {
        functionCalls: [
          {
            name: 'prepareSaleDraft',
            args: {
              items: [{ productName: 'Spider-Man', quantity: 1, unitPrice: 65, size: 'MEDIANO' }],
              paymentMethod: 'EFECTIVO'
            }
          }
        ]
      },
      { text: 'Por favor confirma en mostrador.' }
    ];

    client.models.generateContentStream = async function* () {
      for (const chunk of fakeChunks) {
        yield chunk;
      }
    };

    const stream = streamChatWithSalesAssistant({
      message: '1 póster de Spiderman mediano en efectivo',
      tenantId: 'test-tenant',
      eventId: null,
    });

    const emittedEvents = [];
    for await (const event of stream) {
      emittedEvents.push(event);
    }

    const draftEvents = emittedEvents.filter(e => e.type === 'draft_sale');
    assert.strictEqual(draftEvents.length, 1, 'Debe emitir exactamente 1 evento draft_sale');
    assert.ok(draftEvents[0].data, 'El evento draft_sale debe contener los datos del borrador');
    assert.strictEqual(draftEvents[0].data.paymentMethod, 'EFECTIVO');
  });

  it('3. Emite múltiples eventos si las functionCalls son legítimamente diferentes en el mismo stream', async () => {
    const client = getGeminiClient();

    const fakeChunks = [
      {
        functionCalls: [
          { name: 'searchCatalog', args: { query: 'Goku' } },
          { name: 'searchCatalog', args: { query: 'Vegeta' } }
        ]
      },
      // Repetir Goku (debe ignorarse) y agregar Spiderman (nuevo, debe procesarse)
      {
        functionCalls: [
          { name: 'searchCatalog', args: { query: 'Goku' } },
          { name: 'searchCatalog', args: { query: 'Spiderman' } }
        ]
      }
    ];

    client.models.generateContentStream = async function* () {
      for (const chunk of fakeChunks) {
        yield chunk;
      }
    };

    const stream = streamChatWithSalesAssistant({
      message: 'Busca Goku, Vegeta y Spiderman',
      tenantId: 'test-tenant',
      eventId: null,
    });

    const emittedEvents = [];
    for await (const event of stream) {
      emittedEvents.push(event);
    }

    const suggestedEvents = emittedEvents.filter(e => e.type === 'suggested_posters');
    assert.strictEqual(suggestedEvents.length, 3, 'Debe emitir 3 eventos (Goku, Vegeta, Spiderman), deduplicando el segundo Goku');
  });

  it('4. Manejo resiliente de functionCalls sin argumentos o con args nulos/vacíos', async () => {
    const client = getGeminiClient();

    const fakeChunks = [
      { functionCalls: [{ name: 'getEventKPIs', args: null }] },
      { functionCalls: [{ name: 'getEventKPIs', args: undefined }] },
      { functionCalls: [{ name: 'getEventKPIs' }] },
      { text: 'Datos procesados.' }
    ];

    client.models.generateContentStream = async function* () {
      for (const chunk of fakeChunks) {
        yield chunk;
      }
    };

    const stream = streamChatWithSalesAssistant({
      message: 'Cómo van los KPIs?',
      tenantId: 'test-tenant',
      eventId: null,
    });

    const emittedEvents = [];
    for await (const event of stream) {
      emittedEvents.push(event);
    }

    const tokens = emittedEvents.filter(e => e.type === 'token');
    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0].text, 'Datos procesados.');
  });

  it('5. Aislamiento por invocación: cada llamada a streamChatWithSalesAssistant tiene su propio Set', async () => {
    const client = getGeminiClient();

    const fakeChunks = [
      { functionCalls: [{ name: 'searchCatalog', args: { query: 'Star Wars' } }] }
    ];

    client.models.generateContentStream = async function* () {
      for (const chunk of fakeChunks) {
        yield chunk;
      }
    };

    // Primera invocación
    const stream1 = streamChatWithSalesAssistant({
      message: 'Pósters de Star Wars',
      tenantId: 'test-tenant',
      eventId: null,
    });
    const events1 = [];
    for await (const ev of stream1) events1.push(ev);
    assert.strictEqual(events1.filter(e => e.type === 'suggested_posters').length, 1);

    // Segunda invocación con la misma query (nuevo turno del usuario)
    const stream2 = streamChatWithSalesAssistant({
      message: 'Vuelve a mostrar Star Wars',
      tenantId: 'test-tenant',
      eventId: null,
    });
    const events2 = [];
    for await (const ev of stream2) events2.push(ev);
    assert.strictEqual(events2.filter(e => e.type === 'suggested_posters').length, 1, 'No debe ser suprimido en una segunda invocación independiente');
  });
});
