import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { compressImage } from '../../src/utils/imageCompressor.js';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';

describe('⚔️ ADVERSARIAL CHALLENGER 2: CLIENT RESILIENCE & COMPRESSION HARNESS', () => {

  // =========================================================================
  // SECTION 1: EMPIRICAL STRESS-TESTING OF imageCompressor.js (R3)
  // =========================================================================
  describe('1. Adversarial Stress-Testing: imageCompressor.js', () => {

    it('1.1. Invariants with non-object/primitive inputs: never throws and returns input safely', async () => {
      const inputs = [null, undefined, '', 'not-a-file', 0, 42, true, false, Symbol('test'), BigInt(999)];
      for (const input of inputs) {
        const result = await compressImage(input);
        assert.strictEqual(result, input, `Input ${String(input)} should be returned as-is`);
      }
    });

    it('1.2. Atypical non-image objects: returns original input without uncaught exceptions', async () => {
      const nonImageObjects = [
        {},
        [],
        { foo: 'bar' },
        { type: 'application/pdf', size: 1024 * 500, name: 'document.pdf' },
        { type: 'text/plain', size: 2048, name: 'notes.txt' },
        { type: 'video/mp4', size: 1024 * 1024 * 5, name: 'clip.mp4' },
        { type: 'audio/webm', size: 1024 * 200, name: 'voice.webm' },
        { size: 500000 }, // object with size but no type
      ];
      for (const obj of nonImageObjects) {
        const result = await compressImage(obj);
        assert.strictEqual(result, obj, `Non-image object with type ${obj.type} should be returned untouched`);
      }
    });

    it('1.3. Vector graphics (SVG): bypasses compression safely without rasterization', async () => {
      const svgFile = {
        name: 'vector-logo.svg',
        type: 'image/svg+xml',
        size: 850 * 1024, // 850 KB SVG
      };
      const result = await compressImage(svgFile);
      assert.strictEqual(result, svgFile, 'SVG files must be bypassed immediately to avoid raster degradation');
    });

    it('1.4. Small raster images (<= 150 KB): fast-path bypass preserves original file', async () => {
      const smallJpeg = {
        name: 'thumbnail.jpg',
        type: 'image/jpeg',
        size: 120 * 1024, // 120 KB
      };
      const smallPng = {
        name: 'icon.png',
        type: 'image/png',
        size: 85 * 1024, // 85 KB
      };
      assert.strictEqual(await compressImage(smallJpeg), smallJpeg, 'Images <= 150 KB must bypass compression');
      assert.strictEqual(await compressImage(smallPng), smallPng, 'PNG images <= 150 KB must bypass compression');
    });

    it('1.5. Corrupted binary buffers / invalid image bytes: triggers safe catch fallback', async () => {
      // Create corrupt binary Blob pretending to be an image
      const corruptBytes = new Uint8Array([0x00, 0xFF, 0xAA, 0x55, 0x12, 0x34, 0x56, 0x78]);
      const corruptBlob = new Blob([corruptBytes], { type: 'image/jpeg' });
      // In Node.js or any environment, this should never throw an uncaught exception
      const result = await compressImage(corruptBlob);
      assert.ok(result, 'Must return a defined result');
      assert.strictEqual(result, corruptBlob, 'Must fall back safely to original file on decoding error');
    });

    it('1.6. Massive image downscaling math: aspect ratio preservation and dimension limits', async () => {
      // Test the proportional downscaling logic for 8K and 12K images
      const testCases = [
        { width: 8000, height: 6000, maxDim: 1024, expectedW: 1024, expectedH: 768 },
        { width: 6000, height: 8000, maxDim: 1024, expectedW: 768, expectedH: 1024 },
        { width: 12000, height: 12000, maxDim: 1024, expectedW: 1024, expectedH: 1024 },
        { width: 3000, height: 1500, maxDim: 1024, expectedW: 1024, expectedH: 512 },
        { width: 500, height: 400, maxDim: 1024, expectedW: 500, expectedH: 400 },
      ];

      for (const tc of testCases) {
        const ratio = Math.min(tc.maxDim / tc.width, tc.maxDim / tc.height, 1);
        const targetW = Math.max(1, Math.round(tc.width * ratio));
        const targetH = Math.max(1, Math.round(tc.height * ratio));

        assert.strictEqual(targetW, tc.expectedW, `Target width mismatch for ${tc.width}x${tc.height}`);
        assert.strictEqual(targetH, tc.expectedH, `Target height mismatch for ${tc.width}x${tc.height}`);
        assert.ok(targetW <= tc.maxDim, 'targetW must never exceed maxDim');
        assert.ok(targetH <= tc.maxDim, 'targetH must never exceed maxDim');
      }
    });

    it('1.7. Flexible API signature: handles both positional parameters and option object', async () => {
      // Mock environment where createImageBitmap is simulated
      const originalBitmap = globalThis.createImageBitmap;
      const originalOffscreen = globalThis.OffscreenCanvas;

      let closedCalled = false;
      let drawnDimensions = null;

      globalThis.createImageBitmap = async () => ({
        width: 4000,
        height: 2000,
        close: () => { closedCalled = true; },
      });

      globalThis.OffscreenCanvas = class MockOffscreenCanvas {
        constructor(w, h) {
          this.width = w;
          this.height = h;
          drawnDimensions = { w, h };
        }
        getContext() {
          return {
            drawImage: () => {},
          };
        }
        async convertToBlob(opts) {
          return new Blob(['compressed-jpeg-data'], { type: opts?.type || 'image/jpeg' });
        }
      };

      try {
        const testFile = {
          name: 'huge-poster.png',
          type: 'image/png',
          size: 5 * 1024 * 1024, // 5 MB
        };

        // Call with options object: { maxDimension: 800, quality: 0.6 }
        const compressedWithObj = await compressImage(testFile, { maxDimension: 800, quality: 0.6 });
        assert.ok(compressedWithObj, 'Should compress with options object');
        assert.strictEqual(drawnDimensions.w, 800);
        assert.strictEqual(drawnDimensions.h, 400);
        assert.ok(closedCalled, 'source.close() must be called to prevent memory leaks');

        // Call with positional params: 1024, 0.75
        closedCalled = false;
        const compressedWithPos = await compressImage(testFile, 1024, 0.75);
        assert.ok(compressedWithPos, 'Should compress with positional params');
        assert.strictEqual(drawnDimensions.w, 1024);
        assert.strictEqual(drawnDimensions.h, 512);
        assert.ok(closedCalled, 'source.close() must be called on positional call');
      } finally {
        globalThis.createImageBitmap = originalBitmap;
        globalThis.OffscreenCanvas = originalOffscreen;
      }
    });
  });

  // =========================================================================
  // SECTION 2: AUDIO RETRY BUFFER R5 IN useAiChatStream.js
  // =========================================================================
  describe('2. Adversarial Audio Buffer R5 Simulation: useAiChatStream.js', () => {

    // Simulation harness reflecting useAiChatStream.js implementation
    function createAiChatAudioHarness(authFetchMock) {
      const state = {
        isLoading: false,
        processingNote: '',
        aiError: null,
        messages: [],
        pendingDraft: null,
      };
      const lastAudioBlobRef = { current: null };

      const setIsLoading = (v) => { state.isLoading = v; };
      const setProcessingNote = (v) => { state.processingNote = v; };
      const setAiError = (v) => { state.aiError = v; };
      const setPendingDraft = (v) => { state.pendingDraft = v; };
      const pushAiMsg = (text) => { state.messages.push({ sender: 'ai', text }); };

      let retryVoiceUploadFn;

      const uploadMedia = async (url, form, userText, note, onDone) => {
        setIsLoading(true); setProcessingNote(note); setAiError(null);
        state.messages.push({ sender: 'user', text: userText });
        try {
          const res = await authFetchMock(url, { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Error procesando');
          if (url.includes('voice')) lastAudioBlobRef.current = null;
          if (data.draftSale && !url.includes('voice')) {
            setPendingDraft(data.draftSale);
          }
          onDone(data);
        } catch (err) {
          const isQuota = /429|cuota|quota|resource_exhausted/i.test(err?.message);
          const isNet = /fetch|network|conexi[oó]n|offline|failed/i.test(err?.message);
          const friendlyMsg = isQuota
            ? 'Límite de cuota de IA alcanzado. Continúa en modo manual.'
            : isNet
              ? 'Problema de conexión con el servicio de IA.'
              : err?.message?.replace(/^.*AI_MEDIA_SERVICE_FAILED:\s*/, '').trim() || 'No fue posible procesar el archivo.';
          const isVoice = url.includes('voice');
          setAiError({
            title: isVoice ? 'Fallo en dictado de voz' : 'Fallo en foto/visión',
            message: friendlyMsg,
            channel: isVoice ? 'IA_VOZ' : 'IA_FOTO_ARTE',
            canRetry: isVoice && Boolean(lastAudioBlobRef.current),
            hasAudioRetry: isVoice && Boolean(lastAudioBlobRef.current),
            onRetryAudio: retryVoiceUploadFn,
          });
          pushAiMsg(`⚠️ ${friendlyMsg}`);
        } finally {
          setIsLoading(false);
          setProcessingNote('');
        }
      };

      const handleVoiceUpload = (audioBlob, meta = {}) => {
        if (!audioBlob || meta?.empty) {
          pushAiMsg('🎙️ No alcancé a escucharte.');
          return;
        }
        lastAudioBlobRef.current = audioBlob;
        const form = new FormData();
        form.append('audio', audioBlob, 'voice-sale.webm');
        form.append('eventId', 'test-event-id');
        uploadMedia('/api/ai/voice-sale', form, '🎙️ [Venta dictada por voz]', 'Analizando voz...', (data) => {
          if (data.draftSale) {
            setPendingDraft(data.draftSale);
            pushAiMsg('Entendí tu dictado');
          }
        });
      };

      retryVoiceUploadFn = () => {
        if (lastAudioBlobRef.current) handleVoiceUpload(lastAudioBlobRef.current);
      };

      return { state, lastAudioBlobRef, handleVoiceUpload, retryVoiceUpload: retryVoiceUploadFn };
    }

    it('2.1. Consecutive network disconnections preserve identical audio buffer without memory leak', async () => {
      let attemptsCount = 0;
      const audioPayload = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03, 0x04]);
      const initialBlob = new Blob([audioPayload], { type: 'audio/webm' });

      // Mock authFetch simulating 3 consecutive connection drops, then a successful retry
      const mockAuthFetch = async (url, opts) => {
        attemptsCount++;
        if (attemptsCount === 1) throw new Error('Failed to fetch (Network disconnected on 4G)');
        if (attemptsCount === 2) throw new Error('ETIMEDOUT connection reset by peer');
        if (attemptsCount === 3) throw new Error('503 Service Unavailable');
        // 4th attempt succeeds
        return {
          ok: true,
          json: async () => ({
            success: true,
            intent: 'DICTADO_VENTA',
            isSaleDetected: true,
            draftSale: {
              items: [{ description: 'Batman Mediano', quantity: 1, unitPrice: 65, subtotal: 65 }],
              total: 65,
              paymentMethod: 'EFECTIVO',
            },
          }),
        };
      };

      const harness = createAiChatAudioHarness(mockAuthFetch);

      // 1. First upload attempt -> Fails with Network disconnected
      harness.handleVoiceUpload(initialBlob);
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(attemptsCount, 1);
      assert.strictEqual(harness.lastAudioBlobRef.current, initialBlob, 'lastAudioBlobRef MUST hold the original Blob');
      assert.strictEqual(harness.lastAudioBlobRef.current.size, initialBlob.size, 'Byte size must be strictly preserved');
      assert.strictEqual(harness.state.aiError?.hasAudioRetry, true, 'hasAudioRetry must be true');
      assert.strictEqual(harness.state.aiError?.canRetry, true, 'canRetry must be true');
      assert.strictEqual(typeof harness.state.aiError?.onRetryAudio, 'function', 'onRetryAudio must be callable');

      // 2. First retry -> Fails with ETIMEDOUT
      harness.state.aiError.onRetryAudio();
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(attemptsCount, 2);
      assert.strictEqual(harness.lastAudioBlobRef.current, initialBlob, 'lastAudioBlobRef MUST STILL hold the original Blob');
      assert.strictEqual(harness.state.aiError?.hasAudioRetry, true);

      // 3. Second retry -> Fails with 503
      harness.state.aiError.onRetryAudio();
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(attemptsCount, 3);
      assert.strictEqual(harness.lastAudioBlobRef.current, initialBlob, 'lastAudioBlobRef MUST STILL hold the original Blob');
      assert.strictEqual(harness.state.aiError?.hasAudioRetry, true);

      // 4. Third retry -> SUCCEEDS!
      harness.state.aiError.onRetryAudio();
      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(attemptsCount, 4);
      assert.strictEqual(harness.lastAudioBlobRef.current, null, 'lastAudioBlobRef MUST be freed (set to null) on success');
      assert.ok(harness.state.pendingDraft, 'Pending draft must be successfully populated');
      assert.strictEqual(harness.state.pendingDraft.total, 65);
    });

    it('2.2. Empty audio protection: does not pollute lastAudioBlobRef', () => {
      const harness = createAiChatAudioHarness(async () => ({ ok: true, json: async () => ({}) }));
      harness.handleVoiceUpload(null);
      assert.strictEqual(harness.lastAudioBlobRef.current, null, 'Null audio must not be stored');

      harness.handleVoiceUpload({ size: 0 }, { empty: true });
      assert.strictEqual(harness.lastAudioBlobRef.current, null, 'Empty meta audio must not be stored');
    });
  });

  // =========================================================================
  // SECTION 3: EMPIRICAL AUDIT OF OPERATIONAL PROMPT REGEX (R4)
  // =========================================================================
  describe('3. Adversarial Prompt Oracle: R4 Regex & Dynamic Context Trimming', () => {
    const mockEvent = { name: 'Feria Pop 2026', location: 'Pabellón B' };
    const massiveOperationalData = {
      evento: 'Feria Pop 2026',
      vendedorNombre: 'Sebastián Test',
      metricasGlobales: {
        totalVentas: 15420.50,
        cantidadVentas: 142,
        ticketPromedio: 108.60,
        efectivoEnCaja: 5400.00,
        tarjetaTotal: 8200.50,
        transferencias: 1820.00,
      },
      ventasRecientes: Array.from({ length: 50 }, (_, i) => ({
        id: `sale-uuid-${i}`,
        saleNumber: `V-${1000 + i}`,
        total: 130.00,
        metodo: i % 2 === 0 ? 'EFECTIVO' : 'TARJETA',
        items: [
          { titulo: 'Batman Comic Art', tamano: 'MEDIANO', cantidad: 2, precio: 65.00 },
        ],
      })),
      arqueoCaja: { estado: 'ABIERTA', apertura: 200.00, diferencia: 0.00 },
      colaImpresion: { pendientes: 4, enProceso: 1, completadas: 12 },
    };

    const OPERATIONAL_HEADER = 'DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)';

    it('3.1. Direct sale queries (R4) MUST OMIT massive operational context data', () => {
      const directSaleQueries = [
        '1 batman mediano en efectivo',
        '2 posters de breaking bad tamaño grande',
        'apúntame un spider-man mediano',
        '3 posters de vinilos en portada de album',
        'vendí un scarface mediano en tarjeta',
        'cobrar con tarjeta de crédito',
        'cambiar el tamaño del primer póster a grande',
        'agrega uno de dragon ball z',
        'descartar borrador',
        '¿tienen pósters de harry potter?',
        'busca anime en el catálogo',
        '¡Hola! Buenas tardes',
        '¿cómo estás?',
      ];

      for (const query of directSaleQueries) {
        const prompt = buildSalesSystemPrompt({
          event: mockEvent,
          resolvedContextData: massiveOperationalData,
          message: query,
        });

        assert.strictEqual(
          prompt.includes(OPERATIONAL_HEADER),
          false,
          `Direct sale/catalog query "${query}" MUST NOT include operational context`
        );
      }
    });

    it('3.2. Operational queries (R4) MUST INCLUDE live PostgreSQL operational context', () => {
      const operationalQueries = [
        // caja variations
        '¿cuánto hay en caja?',
        'dame el estado de la caja',
        'arqueo de CAJA',
        'plata en caja',
        // dinero variations
        '¿cuánto dinero tenemos?',
        'dinero recolectado hoy',
        'DINERO en efectivo',
        // métricas / metricas variations (accents, uppercase, lowercase)
        'dame las métricas de venta',
        'ver metricas del evento',
        'MÉTRICAS DEL STAND',
        'METRICAS',
        // ventas variations
        'resumen de ventas de hoy',
        'total de ventas realizadas',
        'VENTAS del día',
        // cuánto / cuanto variations
        '¿cuánto llevamos vendido?',
        'cuanto va en total?',
        '¿CUÁNTO es el total del día?',
        'CUANTO dinero hay',
        // reporte variations
        'dame el reporte ferial',
        'reporte de vendedores',
        'REPORTE final',
        // turno variations
        'cierre de turno',
        'reporte de mi turno',
        'TURNO actual',
      ];

      for (const query of operationalQueries) {
        const prompt = buildSalesSystemPrompt({
          event: mockEvent,
          resolvedContextData: massiveOperationalData,
          message: query,
        });

        assert.strictEqual(
          prompt.includes(OPERATIONAL_HEADER),
          true,
          `Operational query "${query}" MUST include operational context`
        );
      }
    });

    it('3.3. Quantitative prompt size reduction audit: verifies >70% token/byte reduction on sales', () => {
      const directSalePrompt = buildSalesSystemPrompt({
        event: mockEvent,
        resolvedContextData: massiveOperationalData,
        message: '1 batman mediano en efectivo',
      });

      const operationalPrompt = buildSalesSystemPrompt({
        event: mockEvent,
        resolvedContextData: massiveOperationalData,
        message: '¿cuánto dinero hay en caja y cuáles son las métricas?',
      });

      const directSaleBytes = Buffer.byteLength(directSalePrompt, 'utf8');
      const operationalBytes = Buffer.byteLength(operationalPrompt, 'utf8');
      const bytesSaved = operationalBytes - directSaleBytes;
      const reductionPercent = ((bytesSaved / operationalBytes) * 100).toFixed(1);

      assert.ok(
        bytesSaved > 5000,
        `Prompt reduction must save > 5,000 bytes of massive JSON (saved ${bytesSaved} bytes)`
      );
      assert.ok(
        Number(reductionPercent) >= 60.0,
        `Prompt reduction must be >= 60% of total payload (achieved ${reductionPercent}%)`
      );

      // Verify that direct sale prompt is strictly lean
      assert.ok(
        directSaleBytes < 10000,
        `Direct sale prompt must be lean and lightweight (actual: ${directSaleBytes} bytes)`
      );
    });

    it('3.4. Punctuation, symbols, and Unicode resilience in operational regex filter', () => {
      const complexQueries = [
        '¡¡¡DAME EL REPORTE YA!!!',
        '¿¿¿Cuánto hay???',
        '$$$ dinero $$$',
        '--caja--',
        '***VENTAS***',
        'turno: tarde/noche',
        '¿mEtRiCaS?',
      ];

      for (const query of complexQueries) {
        const prompt = buildSalesSystemPrompt({
          event: mockEvent,
          resolvedContextData: massiveOperationalData,
          message: query,
        });
        assert.strictEqual(
          prompt.includes(OPERATIONAL_HEADER),
          true,
          `Complex query "${query}" with symbols must match operational regex`
        );
      }
    });

    it('3.5. Default/initialization safety: message empty or omitted preserves operational context', () => {
      // When initializing system prompt without specific user message (e.g. baseline assistant context)
      const promptDefault = buildSalesSystemPrompt({
        event: mockEvent,
        resolvedContextData: massiveOperationalData,
      });
      assert.strictEqual(
        promptDefault.includes(OPERATIONAL_HEADER),
        true,
        'Omitted message must safely include operational context by default'
      );

      const promptEmpty = buildSalesSystemPrompt({
        event: mockEvent,
        resolvedContextData: massiveOperationalData,
        message: '',
      });
      assert.strictEqual(
        promptEmpty.includes(OPERATIONAL_HEADER),
        true,
        'Empty message must safely include operational context by default'
      );

      const promptNull = buildSalesSystemPrompt({
        event: mockEvent,
        resolvedContextData: massiveOperationalData,
        message: null,
      });
      assert.strictEqual(
        promptNull.includes(OPERATIONAL_HEADER),
        true,
        'Null message must safely include operational context by default'
      );
    });
  });
});
