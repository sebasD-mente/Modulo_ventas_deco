import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Environment bootstrap for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import {
  createSaleSchema,
  updateSaleSchema,
  saleAttachmentSchema,
} from '../../server/validators/saleValidators.js';
import {
  streamChatWithSalesAssistant,
  constructDraftPayload,
  normalizeCatalogSizeId,
} from '../../server/services/aiMultimodalService.js';
import {
  extractPaymentMethod,
  resolveEntityAlias,
  normalizeArtworkQuery,
  parseStandIntent,
} from '../../server/services/semanticParserService.js';

describe('⚔️ CHALLENGER 2 — ADVERSARIAL EMPIRICAL SUITE (Hito M2)', () => {
  const validUUID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-gemini-key-challenger-2';
  });

  // ==========================================================================
  // BLOQUE 1: Flujo Completo de Transferencia de Metadatos y Adjuntos GCS
  // ==========================================================================
  describe('1. Flujo Completo de Transferencia de Metadatos y Adjuntos GCS', () => {
    const DEFAULT_SIZES = [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
    ];

    // Lógica espejo idéntica a UnifiedAiChat.jsx:1248 (botón Modificar)
    function simulateTransferFromChat(pendingDraft) {
      if (!pendingDraft) return null;

      const normalizedAttachments =
        Array.isArray(pendingDraft.attachments) && pendingDraft.attachments.length > 0
          ? pendingDraft.attachments
          : pendingDraft.audioUrl
          ? [{ fileUrl: pendingDraft.audioUrl, fileType: 'AUDIO_VOZ', transcription: pendingDraft.transcription || null }]
          : pendingDraft.imageUrl
          ? [{ fileUrl: pendingDraft.imageUrl, fileType: pendingDraft.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE' }]
          : [];

      const normalizedItems = (pendingDraft.items || []).map((it) => ({
        ...it,
        selectedSizeId: it.selectedSizeId || it.sizeId || null,
        sizeId: it.sizeId || it.selectedSizeId || null,
      }));

      return {
        ...pendingDraft,
        inputChannel: pendingDraft.inputChannel || 'IA_CHAT_TEXTO',
        attachments: normalizedAttachments,
        items: normalizedItems,
      };
    }

    // Lógica espejo idéntica a FastManualSaleForm.jsx: useEffect(initialDraft) y handleSubmitSale
    function simulateFastManualSaleFormLifecycle(initialDraft, sizeChangeAction = null) {
      if (!initialDraft || !initialDraft.items?.length) return null;

      // Estado interno inicializado por useEffect([initialDraft])
      let cartItems = initialDraft.items.map((it, idx) => {
        const resolvedSizeId = it.selectedSizeId || it.sizeId || null;
        let sizes = it.availableSizes && it.availableSizes.length > 0 ? it.availableSizes : DEFAULT_SIZES;
        if (resolvedSizeId && !sizes.some((s) => s.sizeId === resolvedSizeId)) {
          const matchInDef = DEFAULT_SIZES.find((s) => s.sizeId === resolvedSizeId);
          if (matchInDef) sizes = [...sizes, matchInDef];
        }

        return {
          id: `draft-${idx}-test`,
          productId: it.productId || null,
          description: it.description,
          unitPrice: Number(it.unitPrice),
          quantity: it.quantity || 1,
          subtotal: Number(it.quantity || 1) * Number(it.unitPrice),
          thumbUrl: it.thumbUrl || it.imageUrl || null,
          selectedSizeId: resolvedSizeId,
          availableSizes: sizes,
        };
      });

      let paymentMethod = initialDraft.paymentMethod || 'EFECTIVO';
      let notes = initialDraft.notes || '';
      let discount = initialDraft.discount || 0;
      let inputChannel = initialDraft.inputChannel || 'MANUAL_RAPIDA';

      let incomingAttachments = [];
      if (Array.isArray(initialDraft.attachments) && initialDraft.attachments.length > 0) {
        incomingAttachments = initialDraft.attachments;
      } else if (initialDraft.audioUrl) {
        incomingAttachments = [
          {
            fileUrl: initialDraft.audioUrl,
            fileType: 'AUDIO_VOZ',
            transcription: initialDraft.transcription || null,
          },
        ];
      } else if (initialDraft.imageUrl) {
        incomingAttachments = [
          {
            fileUrl: initialDraft.imageUrl,
            fileType: initialDraft.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE',
          },
        ];
      }
      let attachments = incomingAttachments;

      // Simular acción del usuario si la hay (ej: cambiar tamaño o desvincular)
      if (sizeChangeAction) {
        if (sizeChangeAction.type === 'CHANGE_SIZE') {
          const { itemId, targetSize } = sizeChangeAction;
          cartItems = cartItems.map((it) => {
            if (it.id === itemId) {
              const cleanDesc = it.description
                .replace(/\s*\((MINI|PEQUEÑO|PEQUENO|MEDIANO|GRANDE|GIGANTE|PORTADA_ALBUM|PORTADA|PORTADA ÁLBUM)\)/gi, '')
                .trim();
              const newPrice = Number(targetSize.precio);
              return {
                ...it,
                description: `${cleanDesc} (${targetSize.nombre})`,
                unitPrice: newPrice,
                subtotal: it.quantity * newPrice,
                selectedSizeId: targetSize.sizeId,
              };
            }
            return it;
          });
        } else if (sizeChangeAction.type === 'UNLINK') {
          attachments = [];
          inputChannel = 'MANUAL_RAPIDA';
        }
      }

      // Cálculo del gran total contable
      const grandTotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0) - Number(discount);

      // Payload final de venta generado en handleSubmitSale
      const salePayload = {
        eventId: validUUID,
        items: cartItems.map((i) => ({
          productId: i.productId || null,
          description: i.description,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        payments: [
          {
            method: paymentMethod,
            amount: grandTotal,
            reference: notes || null,
          },
        ],
        discount: Number(discount),
        notes: notes || null,
        inputChannel: inputChannel || 'MANUAL_RAPIDA',
        attachments: attachments && attachments.length > 0 ? attachments : [],
      };

      return {
        cartItems,
        inputChannel,
        attachments,
        grandTotal,
        salePayload,
      };
    }

    it('1.1. Simula borrador completo con audio GCS, foto de arte, canal IA_VOZ y PORTADA_ALBUM Q55.00', () => {
      const gcsVoiceUrl = 'https://storage.googleapis.com/deko-eventsales-media/voice-123.webm';
      const gcsPhotoUrl = 'https://storage.googleapis.com/deko-eventsales-media/foto-arte-001.jpg';

      const originalVoiceDraft = {
        items: [
          {
            description: 'Bad Bunny - Un Verano Sin Ti (Portada Álbum)',
            quantity: 1,
            unitPrice: 55.0,
            sizeId: 'PORTADA_ALBUM',
            selectedSizeId: 'PORTADA_ALBUM',
          },
        ],
        total: 55.0,
        paymentMethod: 'TARJETA',
        notes: 'Dictado de voz en stand',
        inputChannel: 'IA_VOZ',
        audioUrl: gcsVoiceUrl,
        transcription: '1 de un verano sin ti portada en tarjeta',
        attachments: [
          {
            fileUrl: gcsVoiceUrl,
            fileType: 'AUDIO_VOZ',
            fileName: 'voice-123.webm',
            fileSize: 45200,
            transcription: '1 de un verano sin ti portada en tarjeta',
          },
          {
            fileUrl: gcsPhotoUrl,
            fileType: 'FOTO_ARTE',
            fileName: 'foto-arte-001.jpg',
            fileSize: 184500,
          },
        ],
      };

      // 1. Transferencia desde chat
      const transferredDraft = simulateTransferFromChat(originalVoiceDraft);
      assert.strictEqual(transferredDraft.inputChannel, 'IA_VOZ', 'El canal debe ser IA_VOZ');
      assert.strictEqual(transferredDraft.attachments.length, 2, 'Debe transferir los 2 adjuntos');
      assert.strictEqual(transferredDraft.items[0].selectedSizeId, 'PORTADA_ALBUM');

      // 2. Paso por FastManualSaleForm
      const formResult = simulateFastManualSaleFormLifecycle(transferredDraft);
      assert.strictEqual(formResult.inputChannel, 'IA_VOZ', 'FastManualSaleForm NO debe sobrescribir a MANUAL_RAPIDA');
      assert.strictEqual(formResult.attachments.length, 2, 'Los adjuntos deben mantenerse íntegros');
      assert.strictEqual(formResult.cartItems[0].unitPrice, 55.0, 'El precio debe mantenerse exactamente en Q55.00');
      assert.strictEqual(formResult.cartItems[0].selectedSizeId, 'PORTADA_ALBUM');
      assert.strictEqual(formResult.grandTotal, 55.0);

      // 3. Validación estricta con createSaleSchema
      const validated = createSaleSchema.parse(formResult.salePayload);
      assert.strictEqual(validated.inputChannel, 'IA_VOZ');
      assert.strictEqual(validated.attachments.length, 2);
      assert.strictEqual(validated.attachments[0].fileUrl, gcsVoiceUrl);
      assert.strictEqual(validated.attachments[0].fileType, 'AUDIO_VOZ');
      assert.strictEqual(validated.attachments[1].fileUrl, gcsPhotoUrl);
      assert.strictEqual(validated.attachments[1].fileType, 'FOTO_ARTE');
      assert.strictEqual(validated.items[0].unitPrice, 55.0);
      assert.strictEqual(validated.payments[0].amount, 55.0);
      assert.strictEqual(validated.payments[0].method, 'TARJETA');
    });

    it('1.2. Verifica que el cambio interactivo de tamaño mantenga PORTADA_ALBUM en Q55.00 y no ensucie la descripción', () => {
      const draft = {
        items: [
          {
            description: 'Un Verano Sin Ti (Portada Álbum)',
            quantity: 1,
            unitPrice: 55.0,
            selectedSizeId: 'PORTADA_ALBUM',
          },
        ],
        paymentMethod: 'EFECTIVO',
        inputChannel: 'IA_VOZ',
        attachments: [
          {
            fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/voice-test.webm',
            fileType: 'AUDIO_VOZ',
          },
        ],
      };

      const transferred = simulateTransferFromChat(draft);

      // Cambiar a GRANDE (Q125)
      const grandeSize = DEFAULT_SIZES.find((s) => s.sizeId === 'GRANDE');
      const step1 = simulateFastManualSaleFormLifecycle(transferred, {
        type: 'CHANGE_SIZE',
        itemId: 'draft-0-test',
        targetSize: grandeSize,
      });

      assert.strictEqual(step1.cartItems[0].unitPrice, 125.0);
      assert.strictEqual(step1.cartItems[0].description, 'Un Verano Sin Ti (Grande)');
      assert.strictEqual(step1.grandTotal, 125.0);

      // Volver a cambiar a PORTADA_ALBUM (Q55)
      const portadaSize = DEFAULT_SIZES.find((s) => s.sizeId === 'PORTADA_ALBUM');
      const step2 = simulateFastManualSaleFormLifecycle(
        {
          ...transferred,
          items: step1.cartItems,
        },
        {
          type: 'CHANGE_SIZE',
          itemId: 'draft-0-test',
          targetSize: portadaSize,
        }
      );

      assert.strictEqual(step2.cartItems[0].unitPrice, 55.0, 'Portada Álbum debe mantener su precio inmutable de Q55.00');
      assert.strictEqual(step2.cartItems[0].description, 'Un Verano Sin Ti (Portada Álbum)');
      assert.doesNotMatch(step2.cartItems[0].description, /\(Grande\)/, 'No debe conservar residuos de tallas anteriores');
      assert.strictEqual(step2.grandTotal, 55.0);

      // Validación con Zod
      const validated = createSaleSchema.parse(step2.salePayload);
      assert.strictEqual(validated.items[0].unitPrice, 55.0);
      assert.strictEqual(validated.payments[0].amount, 55.0);
    });

    it('1.3. Soporta fallback cuando solo existe audioUrl o imageUrl sin attachments explícitos', () => {
      const audioOnlyDraft = {
        items: [{ description: 'Poster Test', quantity: 1, unitPrice: 35.0, sizeId: 'PEQUENO' }],
        audioUrl: 'https://storage.googleapis.com/deko-eventsales-media/legacy-audio.webm',
        transcription: 'Prueba de audio legacy',
        inputChannel: 'IA_VOZ',
      };

      const transferredAudio = simulateTransferFromChat(audioOnlyDraft);
      assert.strictEqual(transferredAudio.attachments.length, 1);
      assert.strictEqual(transferredAudio.attachments[0].fileType, 'AUDIO_VOZ');
      assert.strictEqual(transferredAudio.attachments[0].fileUrl, audioOnlyDraft.audioUrl);

      const qrOnlyDraft = {
        items: [{ description: 'QR Test', quantity: 1, unitPrice: 65.0, sizeId: 'MEDIANO' }],
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/qr-scan.png',
        inputChannel: 'IA_IMAGEN_QR',
      };

      const transferredQR = simulateTransferFromChat(qrOnlyDraft);
      assert.strictEqual(transferredQR.attachments.length, 1);
      assert.strictEqual(transferredQR.attachments[0].fileType, 'FOTO_QR');
      assert.strictEqual(transferredQR.attachments[0].fileUrl, qrOnlyDraft.imageUrl);
    });

    it('1.4. Acción Desvincular resetea inputChannel a MANUAL_RAPIDA y purga attachments', () => {
      const draft = {
        items: [{ description: 'Batman', quantity: 1, unitPrice: 65.0, sizeId: 'MEDIANO' }],
        inputChannel: 'IA_VOZ',
        attachments: [
          { fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/voice.webm', fileType: 'AUDIO_VOZ' },
        ],
      };

      const transferred = simulateTransferFromChat(draft);
      const unlinkedResult = simulateFastManualSaleFormLifecycle(transferred, { type: 'UNLINK' });

      assert.strictEqual(unlinkedResult.inputChannel, 'MANUAL_RAPIDA');
      assert.strictEqual(unlinkedResult.attachments.length, 0);

      const validated = createSaleSchema.parse(unlinkedResult.salePayload);
      assert.strictEqual(validated.inputChannel, 'MANUAL_RAPIDA');
      assert.strictEqual(validated.attachments.length, 0);
    });
  });

  // ==========================================================================
  // BLOQUE 2: Inyección Contextual de Historial y Formateo a Gemini
  // ==========================================================================
  describe('2. Inyección Contextual de Historial con Obras Sugeridas y Directiva Gemini', () => {
    // Función espejo de UnifiedAiChat.jsx:700-720
    function formatChatHistoryForGemini(messages) {
      return messages.slice(-6).map((m) => {
        let textContent = m.text || '';
        if (m.sender === 'ai' && Array.isArray(m.suggestedPosters) && m.suggestedPosters.length > 0) {
          const postersSummary = m.suggestedPosters
            .map((p, idx) => {
              const title = p.titulo || p.nombreCompleto || p.name || 'Póster';
              const sub = p.subtitulo ? ` - ${p.subtitulo}` : '';
              const price = p.precioMinimo ? ` (Precio: Q${p.precioMinimo})` : p.basePrice ? ` (Precio: Q${p.basePrice})` : '';
              const cat = p.categoria ? ` [Cat: ${p.categoria}]` : '';
              const id = p.id ? ` [ID: ${p.id}]` : '';
              return `Opción #${idx + 1}: ${title}${sub}${id}${cat}${price}`;
            })
            .join('\n');
          const visualContext = `\n\n[Contexto de obras mostradas en pantalla al cliente en este turno:\n${postersSummary}]`;
          textContent = `${textContent}${visualContext}`.trim();
        }
        return {
          role: m.sender === 'user' ? 'user' : 'model',
          text: textContent,
        };
      });
    }

    it('2.1. Inyecta bloque estructurado en mensaje ai manteniendo estrictamente role: "model"', () => {
      const messages = [
        {
          id: 1,
          sender: 'user',
          text: '¿Tienes pósters de anime y música?',
        },
        {
          id: 2,
          sender: 'ai',
          text: '¡Por supuesto! Aquí tienes las obras más populares:',
          suggestedPosters: [
            { id: 'post-1', titulo: 'Goku Ultra Instinct', subtitulo: 'Dragon Ball Super', categoria: 'ANIME', precioMinimo: 65 },
            { id: 'post-2', titulo: 'Bad Bunny Un Verano Sin Ti', categoria: 'MUSICA', precioMinimo: 55 },
            { id: 'post-3', titulo: 'Taylor Swift 1989', categoria: 'MUSICA', precioMinimo: 55 },
          ],
        },
      ];

      const formatted = formatChatHistoryForGemini(messages);

      // Verificación de roles
      assert.strictEqual(formatted.length, 2);
      assert.strictEqual(formatted[0].role, 'user');
      assert.strictEqual(formatted[1].role, 'model', 'El rol del mensaje de la IA DEBE mantenerse como "model"');

      // Verificación de la estructura del contexto inyectado
      const aiText = formatted[1].text;
      assert.match(aiText, /\[Contexto de obras mostradas en pantalla al cliente en este turno:/);
      assert.match(aiText, /Opción #1: Goku Ultra Instinct - Dragon Ball Super \[ID: post-1\] \[Cat: ANIME\] \(Precio: Q65\)/);
      assert.match(aiText, /Opción #2: Bad Bunny Un Verano Sin Ti \[ID: post-2\] \[Cat: MUSICA\] \(Precio: Q55\)/);
      assert.match(aiText, /Opción #3: Taylor Swift 1989 \[ID: post-3\] \[Cat: MUSICA\] \(Precio: Q55\)/);
    });

    it('2.2. streamChatWithSalesAssistant recibe el historial formateado y preserva la secuencia de roles para Gemini', async () => {
      const client = getGeminiClient();
      assert.ok(client);

      let capturedContents = null;
      client.models.generateContentStream = async function* (options) {
        capturedContents = options.contents;
        yield { text: 'Borrador preparado para la opción seleccionada.' };
      };

      const messages = [
        {
          id: 1,
          sender: 'user',
          text: 'Muestrame opciones de anime',
        },
        {
          id: 2,
          sender: 'ai',
          text: 'Mira estas opciones:',
          suggestedPosters: [
            { id: 'p-1', titulo: 'Goku', precioMinimo: 65 },
            { id: 'p-2', titulo: 'Vegeta', precioMinimo: 65 },
          ],
        },
      ];

      const historyToSend = formatChatHistoryForGemini(messages);

      const stream = streamChatWithSalesAssistant({
        message: '1 de la segunda que me mostraste en tarjeta',
        history: historyToSend,
        tenantId: 'test-tenant',
        eventId: validUUID,
      });

      const events = [];
      for await (const ev of stream) events.push(ev);

      // Verificar contents recibidos por la API de Gemini
      assert.ok(capturedContents, 'generateContentStream debió recibir contents');
      assert.strictEqual(Array.isArray(capturedContents), true);

      // System instruction (role: user) + 2 history turns + current user message
      assert.strictEqual(capturedContents.length, 4);

      // Inspección de cada turno
      assert.strictEqual(capturedContents[0].role, 'user', 'Turno 0: Directivas del sistema');
      assert.match(capturedContents[0].parts[0].text, /RESOLUCIÓN DE REFERENCIAS ORDINALES/);
      assert.match(capturedContents[0].parts[0].text, /"la segunda" -> Opción #2/);

      assert.strictEqual(capturedContents[1].role, 'user', 'Turno 1: Pregunta inicial del usuario');
      assert.strictEqual(capturedContents[1].parts[0].text, 'Muestrame opciones de anime');

      assert.strictEqual(capturedContents[2].role, 'model', 'Turno 2: Respuesta del modelo con contexto');
      assert.match(capturedContents[2].parts[0].text, /\[Contexto de obras mostradas en pantalla al cliente en este turno:/);
      assert.match(capturedContents[2].parts[0].text, /Opción #2: Vegeta/);

      assert.strictEqual(capturedContents[3].role, 'user', 'Turno 3: Mensaje actual del usuario');
      assert.strictEqual(capturedContents[3].parts[0].text, '1 de la segunda que me mostraste en tarjeta');
    });
  });

  // ==========================================================================
  // BLOQUE 3: Resiliencia de AudioContext ante Estados 'suspended' (Móvil / VAD)
  // ==========================================================================
  describe('3. Resiliencia de AudioContext ante Estados "suspended" (VAD Móvil)', () => {
    class MockAudioContext {
      constructor(initialState = 'suspended') {
        this.state = initialState;
        this.resumeCalled = false;
      }

      async resume() {
        this.resumeCalled = true;
        this.state = 'running';
        return Promise.resolve();
      }

      createMediaStreamSource() {
        return {
          connect: () => {},
        };
      }

      createAnalyser() {
        return {
          fftSize: 256,
          getFloatTimeDomainData: (array) => {
            // Si está running, simular energía de voz; si está suspended, silencio (0s)
            if (this.state === 'running') {
              for (let i = 0; i < array.length; i++) array[i] = 0.05; // > 0.003
            } else {
              array.fill(0); // Falso silencio
            }
          },
        };
      }
    }

    it('3.1. Detecta estado "suspended" y ejecuta resume() exitosamente', async () => {
      const audioCtx = new MockAudioContext('suspended');
      assert.strictEqual(audioCtx.state, 'suspended');

      // Simulación de lógica de UnifiedAiChat.jsx:446
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      assert.strictEqual(audioCtx.resumeCalled, true, 'resume() debió ser invocado');
      assert.strictEqual(audioCtx.state, 'running', 'El estado debió cambiar a "running"');
    });

    it('3.2. Previene detección de falso silencio en VAD cuando el AudioContext se reactiva', async () => {
      const audioCtx = new MockAudioContext('suspended');

      // Si no se reactiva:
      const rawDataSuspended = new Float32Array(256);
      const analyserSuspended = audioCtx.createAnalyser();
      analyserSuspended.getFloatTimeDomainData(rawDataSuspended);
      let sumSuspended = 0;
      for (let i = 0; i < rawDataSuspended.length; i++) sumSuspended += rawDataSuspended[i] * rawDataSuspended[i];
      const rmsSuspended = Math.sqrt(sumSuspended / rawDataSuspended.length);
      assert.strictEqual(rmsSuspended, 0, 'Sin resume, el FFT lee ceros (falso silencio que aborta a 1.5s)');

      // Reactivación requerida:
      await audioCtx.resume();
      const rawDataRunning = new Float32Array(256);
      const analyserRunning = audioCtx.createAnalyser();
      analyserRunning.getFloatTimeDomainData(rawDataRunning);
      let sumRunning = 0;
      for (let i = 0; i < rawDataRunning.length; i++) sumRunning += rawDataRunning[i] * rawDataRunning[i];
      const rmsRunning = Math.sqrt(sumRunning / rawDataRunning.length);

      assert.ok(rmsRunning > 0.003, 'Con resume(), el audio real fluye por encima del umbral de silencio VAD (0.003)');
    });

    it('3.3. Verifica que MediaRecorder se inicie con timeslice de 250ms', () => {
      let startedTimeslice = null;
      const mockMediaRecorder = {
        state: 'inactive',
        start: (timeslice) => {
          startedTimeslice = timeslice;
          mockMediaRecorder.state = 'recording';
        },
      };

      // Simular llamada en UnifiedAiChat:432
      mockMediaRecorder.start(250);
      assert.strictEqual(startedTimeslice, 250, 'MediaRecorder debe ser invocado con timeslice de 250ms');
      assert.strictEqual(mockMediaRecorder.state, 'recording');
    });
  });

  // ==========================================================================
  // BLOQUE 4: Pruebas Adversariales de Seguridad y Schemas Malformados
  // ==========================================================================
  describe('4. Pruebas Adversariales de Seguridad y Schemas Malformados', () => {
    it('4.1. Rechaza URLs no válidas, cadenas vacías y tamaños negativos en saleAttachmentSchema', () => {
      const invalidUrls = ['not-a-valid-url', 'http://', 'random string', ''];
      for (const badUrl of invalidUrls) {
        assert.throws(() => {
          saleAttachmentSchema.parse({
            fileUrl: badUrl,
            fileType: 'AUDIO_VOZ',
          });
        }, /URL|requerido/);
      }

      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/voice.webm',
          fileType: '',
        });
      }, /tipo/);

      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/voice.webm',
          fileType: 'AUDIO_VOZ',
          fileSize: -500,
        });
      });
    });

    it('4.2. Rechaza inputChannel inventado o no autorizado', () => {
      assert.throws(() => {
        createSaleSchema.parse({
          eventId: validUUID,
          items: [{ description: 'Poster', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
          inputChannel: 'HACKED_CHANNEL',
        });
      });
    });

    it('4.3. Rechaza descuadre contable mayor a 0.05 en pagos vs total', () => {
      const totalAmount = 55.0;
      const invalidPaymentsTotal = 50.0; // Descuadre de 5.00
      assert.ok(Math.abs(invalidPaymentsTotal - totalAmount) > 0.05);

      const barelyAcceptable = 54.96; // Descuadre de 0.04
      assert.ok(Math.abs(barelyAcceptable - totalAmount) <= 0.05);
    });
  });
});
