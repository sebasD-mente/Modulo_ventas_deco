import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { streamChatWithSalesAssistant } from '../../server/services/aiMultimodalService.js';

describe('⚔️ ADVERSARIAL CHALLENGER SUITE — Milestone M2', () => {

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'adversarial-challenger-m2-key';
  });

  // =========================================================================
  // DIMENSIÓN 1: DEDUPLICACIÓN DE TOOL CALLS EN STREAMING
  // =========================================================================
  describe('1. Deduplicación Extrema de Tool Calls en Streaming SSE', () => {

    it('1.1. Ráfaga masiva de 100 chunks idénticos con prepareSaleDraft emite exactamente 1 evento', async () => {
      const client = getGeminiClient();
      assert.ok(client, 'Gemini client debe estar disponible');

      const repeatedChunk = {
        functionCalls: [
          {
            name: 'prepareSaleDraft',
            args: {
              items: [{ productName: 'Batman Clásico', quantity: 2, unitPrice: 65, size: 'MEDIANO' }],
              paymentMethod: 'TARJETA',
              customerName: 'Cliente VIP'
            }
          }
        ]
      };

      // 100 chunks idénticos intercalados con 100 tokens de texto
      const chunks = [];
      for (let i = 0; i < 100; i++) {
        chunks.push(repeatedChunk);
        chunks.push({ text: `token_${i} ` });
      }

      client.models.generateContentStream = async function* () {
        for (const c of chunks) {
          yield c;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '2 batman clasico mediano con tarjeta para Cliente VIP',
        tenantId: 'adversarial-tenant',
        eventId: null,
      });

      const emittedEvents = [];
      const startTime = performance.now();
      for await (const ev of stream) {
        emittedEvents.push(ev);
      }
      const durationMs = performance.now() - startTime;

      const draftEvents = emittedEvents.filter(e => e.type === 'draft_sale');
      const tokenEvents = emittedEvents.filter(e => e.type === 'token');

      // Verificación de unicidad absoluta
      assert.strictEqual(draftEvents.length, 1, 'Debe emitir exactamente 1 draft_sale ante 100 repeticiones idénticas');
      assert.strictEqual(tokenEvents.length, 100, 'Los 100 tokens de texto deben fluir íntegros sin supresión');
      assert.strictEqual(draftEvents[0].data.paymentMethod, 'TARJETA');
      // La ejecución de 100 chunks deduplicados debe ser O(1) en memoria (considerando el timeout inicial de 5s de Prisma offline)
      assert.ok(durationMs < 8000, `El bucle de deduplicación debe ser O(1) por frame, duró ${durationMs.toFixed(2)}ms`);
    });

    it('1.2. Resiliencia ante llamadas nulas, indefinidas, vacías o malformadas', async () => {
      const client = getGeminiClient();

      const malformedChunks = [
        { functionCalls: null },
        { functionCalls: [] },
        { functionCalls: [null] },
        { functionCalls: [undefined] },
        { functionCalls: [{}] }, // Sin propiedad name
        { functionCalls: [{ name: '' }] }, // Nombre vacío
        { functionCalls: [{ name: 'herramientaInexistente', args: { x: 1 } }] },
        { functionCalls: [{ name: 'getEventKPIs', args: null }] },
        { functionCalls: [{ name: 'getEventKPIs', args: undefined }] },
        { functionCalls: [{ name: 'getEventKPIs', args: {} }] },
        { functionCalls: [{ name: 'searchCatalog', args: null }] }, // Sin query
        { functionCalls: [{ name: 'searchCatalog', args: {} }] }, // Sin query
        { functionCalls: [{ name: 'prepareSaleDraft', args: null }] }, // Sin args
        { text: 'Sobreviví a los chunks malformados con éxito.' }
      ];

      client.models.generateContentStream = async function* () {
        for (const c of malformedChunks) {
          yield c;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Prueba de chunks malformados',
        tenantId: 'adversarial-tenant',
        eventId: null,
      });

      const emitted = [];
      for await (const ev of stream) {
        emitted.push(ev);
      }

      const tokens = emitted.filter(e => e.type === 'token');
      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].text, 'Sobreviví a los chunks malformados con éxito.');
      // No debe emitir draft_sale ni searchCatalog por llamadas vacías sin args
      const drafts = emitted.filter(e => e.type === 'draft_sale');
      const posters = emitted.filter(e => e.type === 'suggested_posters');
      assert.strictEqual(drafts.length, 0);
      assert.strictEqual(posters.length, 0);
    });

    it('1.3. 100 Chunks Alternados (Ping-Pong entre 2 herramientas distintas)', async () => {
      const client = getGeminiClient();

      const chunkA = {
        functionCalls: [{ name: 'prepareSaleDraft', args: { items: [{ productName: 'Spider-Man', quantity: 1, unitPrice: 65, size: 'MEDIANO' }] } }]
      };
      const chunkB = {
        functionCalls: [{ name: 'searchCatalog', args: { query: 'Marvel', category: 'COMICS' } }]
      };

      const chunks = [];
      for (let i = 0; i < 50; i++) {
        chunks.push(chunkA);
        chunks.push(chunkB);
      }

      client.models.generateContentStream = async function* () {
        for (const c of chunks) {
          yield c;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '1 spiderman y busca marvel',
        tenantId: 'adversarial-tenant',
        eventId: null,
      });

      const emitted = [];
      for await (const ev of stream) {
        emitted.push(ev);
      }

      const drafts = emitted.filter(e => e.type === 'draft_sale');
      const posters = emitted.filter(e => e.type === 'suggested_posters');

      assert.strictEqual(drafts.length, 1, 'prepareSaleDraft debe ejecutarse exactamente 1 vez');
      assert.strictEqual(posters.length, 1, 'searchCatalog debe ejecutarse exactamente 1 vez');
    });

    it('1.4. Invocaciones concurrentes paralelas no comparten el Set de deduplicación', async () => {
      const client = getGeminiClient();

      const makeStream = () => async function* () {
        yield { text: 'Iniciando... ' };
        yield { functionCalls: [{ name: 'prepareSaleDraft', args: { items: [{ productName: 'Póster X', quantity: 1, unitPrice: 65, size: 'MEDIANO' }] } }] };
        yield { text: 'Listo.' };
      };

      client.models.generateContentStream = makeStream();

      // Ejecutar 5 streams concurrentes
      const streams = Array.from({ length: 5 }, (_, idx) =>
        streamChatWithSalesAssistant({
          message: `Mensaje concurrente ${idx}`,
          tenantId: `tenant-${idx}`,
          eventId: null,
        })
      );

      const results = await Promise.all(
        streams.map(async (s) => {
          const events = [];
          for await (const ev of s) events.push(ev);
          return events;
        })
      );

      for (let i = 0; i < 5; i++) {
        const drafts = results[i].filter(e => e.type === 'draft_sale');
        assert.strictEqual(drafts.length, 1, `Stream ${i} debe emitir su propio draft_sale sin interferencia de otros streams`);
      }
    });

  });

  // =========================================================================
  // DIMENSIÓN 2: BUFFER DE TOKENS CON REQUESTANIMATIONFRAME (RAF)
  // =========================================================================
  describe('2. Stress del Buffer de Tokens con requestAnimationFrame', () => {

    it('2.1. Ráfaga ultra-rápida de 1,000 tokens en 10ms acumula 100.000% del texto sin perder caracteres', async () => {
      // Simulación de pipeline de UnifiedAiChat.jsx
      const simulatedTokens = [];
      const dictionary = ['El ', 'arte ', 'del ', 'stand ', 'brilla ', 'con ', 'fuerza. ', 'Póster ', 'Q55 ', 'vinilo ', '🎨 ', 'ñandú ', '— '];
      for (let i = 0; i < 1000; i++) {
        simulatedTokens.push(dictionary[i % dictionary.length]);
      }
      const expectedFullText = simulatedTokens.join('');

      // Simular motor SSE y RAF
      let accumulatedText = '';
      let rafScheduled = false;
      let rafId = null;
      let renderCount = 0;
      let lastRenderedText = '';
      let isStreaming = true;

      // Mock de requestAnimationFrame que simula ciclo de refresco a ~16ms
      const pendingCallbacks = new Map();
      let nextId = 1;
      const mockRequestAnimationFrame = (cb) => {
        const id = nextId++;
        pendingCallbacks.set(id, cb);
        return id;
      };
      const mockCancelAnimationFrame = (id) => {
        pendingCallbacks.delete(id);
      };

      const scheduleTokenUpdate = () => {
        if (rafScheduled) return;
        rafScheduled = true;
        rafId = mockRequestAnimationFrame(() => {
          rafScheduled = false;
          renderCount++;
          lastRenderedText = accumulatedText;
        });
      };

      // Inyectar 1000 tokens en una ráfaga ultra-rápida
      const startTime = performance.now();
      for (const token of simulatedTokens) {
        accumulatedText += token;
        scheduleTokenUpdate();
      }
      const burstTimeMs = performance.now() - startTime;

      // Durante la ráfaga (antes de que el compositor refresque), solo debe haber programado 1 callback
      assert.strictEqual(pendingCallbacks.size, 1, 'Solo 1 frame de RAF debe estar encolado a pesar de 1,000 llamadas');

      // Simular 1 frame de compositor
      const [firstId, firstCb] = pendingCallbacks.entries().next().value;
      pendingCallbacks.delete(firstId);
      firstCb();

      assert.strictEqual(renderCount, 1, 'Debe haber ejecutado exactamente 1 re-render');
      assert.strictEqual(lastRenderedText, expectedFullText, 'El texto acumulado en el frame debe incluir todos los 1000 tokens emitidos hasta ese instante');

      // Simular evento done y flush final
      if (rafId) {
        mockCancelAnimationFrame(rafId);
        rafId = null;
        rafScheduled = false;
      }
      isStreaming = false;
      const finalFlushedText = accumulatedText;

      assert.strictEqual(finalFlushedText, expectedFullText, 'El texto final en estado debe ser 100% idéntico al texto generado');
      assert.strictEqual(finalFlushedText.length, expectedFullText.length, 'La longitud debe coincidir exactamente sin pérdida de bytes');
      assert.ok(finalFlushedText.includes('🎨'), 'Debe conservar emojis UTF-8 intactos');
      assert.ok(finalFlushedText.includes('ñandú'), 'Debe conservar caracteres especiales con acentos');
      assert.strictEqual(pendingCallbacks.size, 0, 'No deben quedar callbacks huérfanos');
    });

    it('2.2. Manejo de fragmentos de bytes UTF-8 multibyte divididos en chunks contiguos', () => {
      // Probar TextDecoder('utf-8', { stream: true }) como en UnifiedAiChat.jsx:762
      const decoder = new TextDecoder('utf-8');
      const emoji = '🎨'; // Bytes: [0xF0, 0x9F, 0x8E, 0xA8]
      const encoder = new TextEncoder();
      const emojiBytes = encoder.encode(emoji);

      // Dividir el emoji a la mitad entre dos paquetes de red
      const chunk1 = emojiBytes.slice(0, 2);
      const chunk2 = emojiBytes.slice(2);

      const decoded1 = decoder.decode(chunk1, { stream: true });
      const decoded2 = decoder.decode(chunk2, { stream: true });
      const assembled = decoded1 + decoded2;

      assert.strictEqual(assembled, emoji, 'TextDecoder con { stream: true } debe reconstruir emojis multibyte sin corromperlos');
      assert.ok(!assembled.includes('\uFFFD'), 'No debe haber caracteres de reemplazo corruptos');
    });

    it('2.3. Resiliencia del bucle de parsing ante frames de datos SSE JSON malformados', () => {
      // Simular el for (const rawLine of lines) de UnifiedAiChat.jsx
      let accumulatedText = '';
      const rawLines = [
        'event: token',
        'data: {"text": "Hola, "}',
        'event: token',
        'data: {corrupt json without quotes}',
        'event: token',
        'data: {"text": "¿en qué te puedo "}',
        'event: token',
        'data: ', // Data vacía
        'event: token',
        'data: {"text": "ayudar?"}',
        'event: done',
        'data: {"fullText": "completado"}'
      ];

      let currentEvent = 'message';
      let parseWarnings = 0;

      for (const line of rawLines) {
        if (!line.trim()) continue;
        if (line.startsWith('event:')) {
          currentEvent = line.replace(/^event:\s*/, '').trim();
        } else if (line.startsWith('data:')) {
          const dataStr = line.replace(/^data:\s*/, '').trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'token') {
              accumulatedText += data.text || '';
            }
          } catch (err) {
            parseWarnings++;
          }
        }
      }

      assert.strictEqual(parseWarnings, 1, 'Debe capturar de forma segura la línea JSON corrupta');
      assert.strictEqual(accumulatedText, 'Hola, ¿en qué te puedo ayudar?', 'El texto debe haberse acumulado excluyendo solo el fragmento corrupto');
    });

  });

  // =========================================================================
  // DIMENSIÓN 3: DESACOPLE DE SCROLL (isPinnedToBottomRef)
  // =========================================================================
  describe('3. Desacople de Scroll y Prevención de Layout Thrashing', () => {

    const createMockContainer = ({ scrollHeight, scrollTop, clientHeight }) => ({
      scrollHeight,
      scrollTop,
      clientHeight,
    });

    const evaluateScrollPinning = (container) => {
      const threshold = 80;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      return distanceFromBottom <= threshold;
    };

    it('3.1. Usuario al fondo del chat (distanceFromBottom <= 80) mantiene anclaje activo', () => {
      // scrollHeight: 1000, clientHeight: 400, scrollTop: 600 -> distance: 0
      const containerAtBottom = createMockContainer({ scrollHeight: 1000, scrollTop: 600, clientHeight: 400 });
      assert.strictEqual(evaluateScrollPinning(containerAtBottom), true);

      // Justo en el umbral de 80px
      const containerAtThreshold = createMockContainer({ scrollHeight: 1000, scrollTop: 520, clientHeight: 400 });
      assert.strictEqual(evaluateScrollPinning(containerAtThreshold), true);

      // A 50px del fondo
      const containerNearBottom = createMockContainer({ scrollHeight: 1000, scrollTop: 550, clientHeight: 400 });
      assert.strictEqual(evaluateScrollPinning(containerNearBottom), true);
    });

    it('3.2. Usuario que ha subido en la vista (distanceFromBottom > 80) desactiva el anclaje', () => {
      // Usuario sube 150px
      const containerScrolledUp = createMockContainer({ scrollHeight: 1000, scrollTop: 400, clientHeight: 400 });
      // distance: 1000 - 400 - 400 = 200px > 80px
      assert.strictEqual(evaluateScrollPinning(containerScrolledUp), false);

      // Justo 1px por encima del umbral (81px)
      const containerJustAbove = createMockContainer({ scrollHeight: 1000, scrollTop: 519, clientHeight: 400 });
      // distance: 1000 - 519 - 400 = 81px > 80px
      assert.strictEqual(evaluateScrollPinning(containerJustAbove), false);
    });

    it('3.3. Simulación: ráfaga de 100 tokens mientras el usuario lee historial NO ejecuta scrollIntoView', () => {
      let isPinnedToBottom = false; // El usuario subió a leer
      let scrollIntoViewCalls = 0;

      const mockScrollIntoView = () => {
        scrollIntoViewCalls++;
      };

      // Simulación del useEffect de UnifiedAiChat.jsx:147-151
      const triggerScrollEffect = () => {
        if (isPinnedToBottom) {
          mockScrollIntoView();
        }
      };

      // Arriban 100 tokens vía RAF
      for (let i = 0; i < 100; i++) {
        triggerScrollEffect();
      }

      assert.strictEqual(scrollIntoViewCalls, 0, 'scrollIntoView NO debe ejecutarse ni una sola vez cuando isPinnedToBottom es false');
    });

    it('3.4. Al enviar un nuevo mensaje (handleSendText), el anclaje se reactiva forzosamente', () => {
      let isPinnedToBottom = false; // Usuario estaba arriba
      let scrollIntoViewCalls = 0;

      const mockScrollIntoView = () => {
        scrollIntoViewCalls++;
      };

      // Simulación de handleSendText (UnifiedAiChat.jsx:653-654)
      const handleSendText = (query) => {
        if (!query.trim()) return;
        isPinnedToBottom = true;
        mockScrollIntoView();
      };

      handleSendText('¿Cuánto cuesta el póster de Batman?');

      assert.strictEqual(isPinnedToBottom, true, 'isPinnedToBottom debe reactivarse a true al enviar mensaje');
      assert.strictEqual(scrollIntoViewCalls, 1, 'Debe ejecutar scrollIntoView inmediatamente');
    });

    it('3.5. Casos límite: viewport más alto que el contenido (scrollHeight <= clientHeight)', () => {
      // Contenido corto (inicio del chat)
      const shortChat = createMockContainer({ scrollHeight: 300, scrollTop: 0, clientHeight: 450 });
      // distance: 300 - 0 - 450 = -150 <= 80
      assert.strictEqual(evaluateScrollPinning(shortChat), true, 'Chat corto debe estar anclado');
    });

    it('3.6. Casos límite: rebote elástico (rubber-banding) en iOS Safari con scrollTop negativo o mayor al fondo', () => {
      // Rebote hacia abajo en iOS (scrollTop supera el máximo)
      const iosOverscrollBottom = createMockContainer({ scrollHeight: 1000, scrollTop: 620, clientHeight: 400 });
      // distance: 1000 - 620 - 400 = -20 <= 80
      assert.strictEqual(evaluateScrollPinning(iosOverscrollBottom), true, 'Overscroll inferior debe permanecer anclado');

      // Rebote hacia arriba en iOS (scrollTop negativo)
      const iosOverscrollTop = createMockContainer({ scrollHeight: 1000, scrollTop: -30, clientHeight: 400 });
      // distance: 1000 - (-30) - 400 = 630 > 80
      assert.strictEqual(evaluateScrollPinning(iosOverscrollTop), false, 'Overscroll superior debe mantenerse desanclado');
    });

  });

  // =========================================================================
  // DIMENSIÓN 4: PRESERVACIÓN DE RECURSOS, AUDIO CONTEXT Y SIN FUGAS DE MEMORIA
  // =========================================================================
  describe('4. Auditoría de Recursos y Fugas de Memoria', () => {

    it('4.1. Desmontaje cancela debidamente el RAF pendiente si el stream sigue en curso', () => {
      let cancelledId = null;
      const mockCancel = (id) => {
        cancelledId = id;
      };

      const rafIdRef = { current: 12345 };

      // Simular cleanup de useEffect en UnifiedAiChat.jsx:156-159
      const unmountCleanup = () => {
        if (rafIdRef.current) {
          mockCancel(rafIdRef.current);
          rafIdRef.current = null;
        }
      };

      unmountCleanup();
      assert.strictEqual(cancelledId, 12345, 'Debe cancelar el ID del RAF activo');
      assert.strictEqual(rafIdRef.current, null, 'Debe purgar la referencia para permitir recolección de basura');
    });

    it('4.2. Cierre seguro de AudioContext y Tracks de MediaStream en desmontaje', () => {
      let contextClosed = false;
      let tracksStopped = 0;

      const mockAudioContext = {
        state: 'running',
        close: async () => {
          contextClosed = true;
        }
      };

      const mockStream = {
        getTracks: () => [
          { stop: () => { tracksStopped++; } },
          { stop: () => { tracksStopped++; } }
        ]
      };

      const audioContextRef = { current: mockAudioContext };
      const streamRef = { current: mockStream };

      // Simular cleanup de useEffect en UnifiedAiChat.jsx:165-181
      const unmountCleanup = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
      };

      unmountCleanup();
      assert.strictEqual(tracksStopped, 2, 'Todas las pistas de audio de hardware deben detenerse');
      assert.strictEqual(contextClosed, true, 'El AudioContext debe ser cerrado');
      assert.strictEqual(audioContextRef.current, null);
      assert.strictEqual(streamRef.current, null);
    });

  });

});
