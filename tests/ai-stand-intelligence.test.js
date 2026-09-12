import { describe, it } from 'node:test';
import assert from 'node:assert';
import { streamChatWithSalesAssistant, chatWithSalesAssistant } from '../server/services/ai/aiStreamService.js';
import { normalizeArtworkQuery, resolveEntityAlias } from '../server/services/semanticParserService.js';
import { searchWebPosters } from '../server/services/webCatalogService.js';

describe('🧠 STAND {IA} Intelligence & Proactive Sales Engine', () => {

  it('1. Alias resolution for "spiderman" produces clean search query "Spider-Man"', () => {
    const alias = resolveEntityAlias('mustrame lo que tenemos de spiderman');
    assert.strictEqual(alias.matched, true);
    assert.strictEqual(alias.searchQuery, 'Spider-Man');
    const norm = normalizeArtworkQuery('mustrame lo que tenemos de spiderman');
    assert.strictEqual(norm, 'Spider-Man');
  });

  it('2. searchWebPosters finds Spider-Man and deduplicates correctly', async () => {
    const results = await searchWebPosters({ query: 'Spider-Man' });
    assert.ok(results.length > 0, 'Must find at least 1 poster for Spider-Man');
    assert.match(results[0].titulo, /Spider-Man/i);
    assert.ok(results[0].precioMinimo > 0);
  });

  it('3. Streaming assistant emits rich seller tokens and suggested_posters for searchCatalog simulation', async () => {
    const fakeClient = {
      models: {
        generateContentStream: async function* () {
          // Gemini returns a function call chunk with no text (real-world behavior)
          yield {
            functionCalls: [{ name: 'searchCatalog', args: { query: 'spiderman' } }],
          };
        },
        generateContent: async () => ({
          functionCalls: [{ name: 'searchCatalog', args: { query: 'spiderman' } }],
          text: '',
        }),
      },
    };

    const stream = streamChatWithSalesAssistant({
      message: 'mustrame lo que tenemos de spiderman',
      eventId: 'evt-test',
      geminiClient: fakeClient,
    });

    const events = [];
    let fullText = '';
    for await (const chunk of stream) {
      events.push(chunk);
      if (chunk.type === 'token') {
        fullText += chunk.text;
      }
    }

    // Must yield suggested_posters
    const posterEvent = events.find(e => e.type === 'suggested_posters');
    assert.ok(posterEvent, 'Must yield suggested_posters event');
    assert.ok(Array.isArray(posterEvent.data) && posterEvent.data.length > 0, 'suggested_posters must contain items');

    // Must emit rich seller tokens, NEVER silence or "Entendido."
    assert.ok(fullText.length > 30, 'Must emit rich conversational seller text');
    assert.ok(!fullText.includes('Entendido.'), 'Must NEVER output dry "Entendido."');
    assert.match(fullText, /Mediano/i, 'Must recommend Mediano size');
    assert.match(fullText, /Q65|65/i, 'Must mention Mediano price Q65');
  });

  it('4. Streaming assistant emits rich confirmation and draft_sale for prepareSaleDraft simulation', async () => {
    const fakeClient = {
      models: {
        generateContentStream: async function* () {
          yield {
            functionCalls: [{
              name: 'prepareSaleDraft',
              args: {
                items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                total: 65,
                paymentMethod: 'EFECTIVO',
              },
            }],
          };
        },
        generateContent: async () => ({
          functionCalls: [{
            name: 'prepareSaleDraft',
            args: {
              items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
              total: 65,
              paymentMethod: 'EFECTIVO',
            },
          }],
          text: '',
        }),
      },
    };

    const stream = streamChatWithSalesAssistant({
      message: '1 mediano de spiderman en efectivo',
      eventId: 'evt-test',
      geminiClient: fakeClient,
    });

    const events = [];
    let fullText = '';
    for await (const chunk of stream) {
      events.push(chunk);
      if (chunk.type === 'token') fullText += chunk.text;
    }

    const draftEvent = events.find(e => e.type === 'draft_sale');
    assert.ok(draftEvent, 'Must yield draft_sale event');
    assert.strictEqual(draftEvent.data.total, 65);
    assert.strictEqual(draftEvent.data.paymentMethod, 'EFECTIVO');

    assert.ok(fullText.length > 20, 'Must emit confirmation text');
    assert.match(fullText, /borrador/i, 'Must mention borrador');
    assert.match(fullText, /Confirmar Venta/i, 'Must instruct seller to confirm');
    assert.ok(!fullText.includes('Entendido.'), 'Must never say "Entendido."');
  });

  it('5. Non-streaming assistant provides rich cleanReply for suggestedPosters and drafts', async () => {
    const fakeClient = {
      models: {
        generateContent: async () => ({
          functionCalls: [{ name: 'searchCatalog', args: { query: 'Spider-Man' } }],
          text: '',
        }),
      },
    };

    const res = await chatWithSalesAssistant({
      message: 'muéstrame de spider-man',
      eventId: 'evt-test',
      geminiClient: fakeClient,
    });

    assert.ok(res.suggestedPosters.length > 0);
    assert.ok(res.reply.length > 30);
    assert.ok(!res.reply.includes('Entendido.'));
    assert.match(res.reply, /Mediano/i);
  });
});
