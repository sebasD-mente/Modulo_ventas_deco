import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SIZES,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
} from '../../src/components/manual-sale/manualSaleConstants.js';
import {
  createSaleSchema,
  saleItemSchema,
  salePaymentSchema,
  saleAttachmentSchema,
} from '../../server/validators/saleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const hookFilePath = path.join(rootDir, 'src/components/manual-sale/hooks/useManualSaleCart.js');
const masterFilePath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');

// =========================================================================
// REACT HOOK TEST HARNESS: Executes the genuine useManualSaleCart code
// =========================================================================
const hookCode = fs.readFileSync(hookFilePath, 'utf-8');
const transformedCode = hookCode
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+default\s+useManualSaleCart\s*;?/, '')
  .replace(/export\s+function\s+useManualSaleCart/, 'function useManualSaleCart');

function createCartHarness(props = {}) {
  let states = [
    [], // 0: cartItems
    'EFECTIVO', // 1: paymentMethod
    0, // 2: discount
    '', // 3: notes
    'MANUAL_RAPIDA', // 4: inputChannel
    [], // 5: attachments
    false, // 6: isSubmitting
    null, // 7: errorMsg
  ];

  let currentProps = { ...props };
  let lastDraft = Symbol('init');
  let callIdx = 0;
  let interceptedPayload = null;

  const useState = (init) => {
    const idx = callIdx++;
    if (states[idx] === undefined) states[idx] = typeof init === 'function' ? init() : init;
    const setter = (valOrFn) => {
      states[idx] = typeof valOrFn === 'function' ? valOrFn(states[idx]) : valOrFn;
    };
    return [states[idx], setter];
  };

  const useEffect = (cb, deps) => {
    const currentDraft = deps ? deps[0] : null;
    if (currentDraft !== lastDraft) {
      lastDraft = currentDraft;
      cb();
    }
  };

  const defaultAuthFetch = async (url, opts) => {
    if (opts && opts.body) {
      try {
        interceptedPayload = JSON.parse(opts.body);
      } catch (e) {
        interceptedPayload = opts.body;
      }
    }
    return {
      ok: true,
      json: async () => ({ success: true, data: { id: 'sale-test-uuid', saleNumber: 'V-001' } }),
    };
  };

  const useAuth = () => ({
    authFetch: async (url, opts) => {
      if (opts && opts.body) {
        try {
          interceptedPayload = JSON.parse(opts.body);
        } catch (e) {
          interceptedPayload = opts.body;
        }
      }
      if (currentProps.authFetch) {
        return currentProps.authFetch(url, opts);
      }
      return defaultAuthFetch(url, opts);
    },
  });

  const confetti = () => {};

  const factory = new Function(
    'useState', 'useEffect', 'useAuth', 'confetti', 'DEFAULT_SIZES', 'SIZE_CLEANUP_REGEX',
    `${transformedCode}\nreturn useManualSaleCart;`
  );
  const hookFn = factory(useState, useEffect, useAuth, confetti, DEFAULT_SIZES, SIZE_CLEANUP_REGEX);

  function execute() {
    callIdx = 0;
    return hookFn(currentProps);
  }

  // Mount pass (runs useEffect)
  execute();
  // Second pass to reflect state updates from initial useEffect
  execute();

  return {
    get api() {
      return execute();
    },
    get interceptedPayload() {
      return interceptedPayload;
    },
    updateProps(newProps) {
      currentProps = { ...currentProps, ...newProps };
      execute();
      return execute();
    },
  };
}

const VALID_EVENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_PRODUCT_ID = 'b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22';

// Helper to suppress intentional console.error logs during error resilience tests
async function withMutedConsoleError(asyncFn) {
  const origError = console.error;
  console.error = () => {};
  try {
    return await asyncFn();
  } finally {
    console.error = origError;
  }
}

// =========================================================================
// CHALLENGER 2 CONTRACT TEST SUITE
// =========================================================================
describe('🔥 CHALLENGER 2: Contract Boundaries, Draft Ingestion & Settlement API Resilience', () => {

  // =========================================================================
  // 1. INITIAL DRAFT INGESTION EDGE CASES
  // =========================================================================
  describe('1. initialDraft Ingestion Edge Cases', () => {
    it('1.1. Maneja initialDraft null sin arrojar excepciones y mantiene estado limpio', () => {
      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: null });
      const api = harness.api;

      assert.deepEqual(api.cartItems, [], 'cartItems debe iniciar vacío');
      assert.equal(api.paymentMethod, 'EFECTIVO');
      assert.equal(api.discount, 0);
      assert.equal(api.notes, '');
      assert.equal(api.inputChannel, 'MANUAL_RAPIDA');
      assert.deepEqual(api.attachments, []);
      assert.equal(api.grandTotal, 0);
    });

    it('1.2. Maneja initialDraft undefined sin arrojar excepciones', () => {
      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: undefined });
      const api = harness.api;

      assert.deepEqual(api.cartItems, []);
      assert.equal(api.inputChannel, 'MANUAL_RAPIDA');
      assert.deepEqual(api.attachments, []);
    });

    it('1.3. Maneja initialDraft con items vacío ({ items: [] }) sin mutar estado', () => {
      const harness = createCartHarness({
        eventId: VALID_EVENT_ID,
        initialDraft: { items: [], notes: 'Borrador vacío', inputChannel: 'IA_CHAT_TEXTO' },
      });
      const api = harness.api;

      assert.deepEqual(api.cartItems, []);
      assert.equal(api.inputChannel, 'MANUAL_RAPIDA', 'Si items está vacío, useEffect hace return temprano');
    });

    it('1.4. Ingesta ítems con tallas ausentes y resuelve fallback a DEFAULT_SIZES', () => {
      const draftWithMissingSizes = {
        items: [
          {
            description: 'Póster Anime Sin Talla',
            unitPrice: 65,
            quantity: 1,
            // selectedSizeId and sizeId are omitted
            // availableSizes is omitted
          },
        ],
        inputChannel: 'IA_CHAT_TEXTO',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draftWithMissingSizes });
      const api = harness.api;

      assert.equal(api.cartItems.length, 1);
      const item = api.cartItems[0];
      assert.equal(item.description, 'Póster Anime Sin Talla');
      assert.equal(item.unitPrice, 65);
      assert.equal(item.quantity, 1);
      assert.equal(item.selectedSizeId, null);
      assert.equal(item.availableSizes.length, DEFAULT_SIZES.length, 'Debe asignar DEFAULT_SIZES si availableSizes falta');
      assert.equal(item.subtotal, 65);
    });

    it('1.5. Ingesta tallas especiales fuera de availableSizes agregándolas desde DEFAULT_SIZES', () => {
      const draftWithCustomSizes = {
        items: [
          {
            description: 'Bad Bunny - Un Verano Sin Ti (Portada Álbum)',
            unitPrice: 55,
            quantity: 2,
            sizeId: 'PORTADA_ALBUM',
            availableSizes: [
              { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
              { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            ],
          },
        ],
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draftWithCustomSizes });
      const item = harness.api.cartItems[0];

      assert.equal(item.selectedSizeId, 'PORTADA_ALBUM');
      assert.ok(
        item.availableSizes.some((s) => s.sizeId === 'PORTADA_ALBUM'),
        'availableSizes debe haberse ampliado con PORTADA_ALBUM de DEFAULT_SIZES'
      );
      assert.equal(item.subtotal, 110);
    });

    it('1.6. Ingesta borrador con legacy audioUrl convirtiéndolo en adjunto AUDIO_VOZ', () => {
      const legacyVoiceDraft = {
        items: [{ description: 'Póster Batman', unitPrice: 125, quantity: 1, sizeId: 'GRANDE' }],
        audioUrl: 'https://storage.googleapis.com/deko-eventsales-media/audios/batman-voice.webm',
        transcription: '1 de batman grande',
        inputChannel: 'IA_VOZ',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: legacyVoiceDraft });
      const api = harness.api;

      assert.equal(api.attachments.length, 1);
      assert.equal(api.attachments[0].fileUrl, legacyVoiceDraft.audioUrl);
      assert.equal(api.attachments[0].fileType, 'AUDIO_VOZ');
      assert.equal(api.attachments[0].transcription, legacyVoiceDraft.transcription);
    });

    it('1.7. Ingesta borrador con legacy imageUrl y canal IA_IMAGEN_QR mapeando a FOTO_QR', () => {
      const legacyQrDraft = {
        items: [{ description: 'Póster Goku QR', unitPrice: 65, quantity: 1, sizeId: 'MEDIANO' }],
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/fotos/qr-goku.jpg',
        inputChannel: 'IA_IMAGEN_QR',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: legacyQrDraft });
      const api = harness.api;

      assert.equal(api.attachments.length, 1);
      assert.equal(api.attachments[0].fileUrl, legacyQrDraft.imageUrl);
      assert.equal(api.attachments[0].fileType, 'FOTO_QR');
    });

    it('1.8. Ingesta borrador con legacy imageUrl y canal IA_FOTO_ARTE mapeando a FOTO_ARTE', () => {
      const legacyArtDraft = {
        items: [{ description: 'Póster Mona Lisa Pop', unitPrice: 35, quantity: 1, sizeId: 'PEQUENO' }],
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/fotos/art-mona.jpg',
        inputChannel: 'IA_FOTO_ARTE',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: legacyArtDraft });
      const api = harness.api;

      assert.equal(api.attachments.length, 1);
      assert.equal(api.attachments[0].fileUrl, legacyArtDraft.imageUrl);
      assert.equal(api.attachments[0].fileType, 'FOTO_ARTE');
    });

    it('1.9. Preserva array de attachments estructurado pre-existente sin sobreescribirlo con legacy', () => {
      const structuredAttachments = [
        {
          fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/docs/custom.pdf',
          fileType: 'DOCUMENTO',
          fileName: 'custom.pdf',
        },
      ];
      const draft = {
        items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }],
        attachments: structuredAttachments,
        audioUrl: 'https://ignored.url',
        imageUrl: 'https://ignored2.url',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draft });
      assert.deepEqual(harness.api.attachments, structuredAttachments);
    });
  });

  // =========================================================================
  // 2. PRESERVING INPUT CHANNEL
  // =========================================================================
  describe('2. Preserving inputChannel Integrity', () => {
    it('2.1. Preserva IA_VOZ cuando proviene de initialDraft y NO lo sobrescribe a MANUAL_RAPIDA', () => {
      const voiceDraft = {
        items: [{ description: 'Póster Spiderman', unitPrice: 65, quantity: 1 }],
        inputChannel: 'IA_VOZ',
      };
      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: voiceDraft });
      assert.equal(harness.api.inputChannel, 'IA_VOZ');
    });

    it('2.2. Preserva IA_IMAGEN_QR cuando proviene de initialDraft y NO lo clobbea a MANUAL_RAPIDA', () => {
      const qrDraft = {
        items: [{ description: 'Póster QR', unitPrice: 125, quantity: 1 }],
        inputChannel: 'IA_IMAGEN_QR',
      };
      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: qrDraft });
      assert.equal(harness.api.inputChannel, 'IA_IMAGEN_QR');
    });

    it('2.3. Preserva otros canales de IA (IA_CHAT_TEXTO, IA_FOTO_ARTE, IA_VIDEO_MOSTRADOR)', () => {
      const channels = ['IA_CHAT_TEXTO', 'IA_FOTO_ARTE', 'IA_VIDEO_MOSTRADOR'];
      for (const channel of channels) {
        const draft = {
          items: [{ description: 'Test', unitPrice: 35, quantity: 1 }],
          inputChannel: channel,
        };
        const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draft });
        assert.equal(harness.api.inputChannel, channel);
      }
    });

    it('2.4. Aplica MANUAL_RAPIDA por defecto cuando initialDraft omite inputChannel o es null', () => {
      const draftWithoutChannel = {
        items: [{ description: 'Test', unitPrice: 35, quantity: 1 }],
      };
      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draftWithoutChannel });
      assert.equal(harness.api.inputChannel, 'MANUAL_RAPIDA');
    });
  });

  // =========================================================================
  // 3. ATTACHMENT UNLINKING & CART RESET
  // =========================================================================
  describe('3. Attachment Unlinking & Cart Reset Behavior', () => {
    it('3.1. unlinkAttachments() vacía los adjuntos y resetea inputChannel a MANUAL_RAPIDA', () => {
      const draftWithAttachment = {
        items: [{ description: 'Taylor Swift', unitPrice: 55, quantity: 1 }],
        inputChannel: 'IA_VOZ',
        audioUrl: 'https://storage.googleapis.com/deko-eventsales-media/audios/ts.webm',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draftWithAttachment });
      assert.equal(harness.api.attachments.length, 1);
      assert.equal(harness.api.inputChannel, 'IA_VOZ');

      // Ejecutar desenlace
      harness.api.unlinkAttachments();

      assert.deepEqual(harness.api.attachments, []);
      assert.equal(harness.api.inputChannel, 'MANUAL_RAPIDA');
    });

    it('3.2. clearCart() vacía ítems, descuento, notas, adjuntos y resetea canal y errorMsg', () => {
      const draft = {
        items: [{ description: 'Póster', unitPrice: 65, quantity: 2 }],
        inputChannel: 'IA_IMAGEN_QR',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/fotos/qr.jpg',
        paymentMethod: 'TARJETA',
        notes: 'Nota importante',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: draft });
      harness.api.setDiscount(15);
      harness.api.setErrorMsg('Error previo');

      assert.equal(harness.api.cartItems.length, 1);
      assert.equal(harness.api.discount, 15);
      assert.equal(harness.api.notes, 'Nota importante');
      assert.equal(harness.api.inputChannel, 'IA_IMAGEN_QR');

      // Ejecutar clearCart
      harness.api.clearCart();

      assert.deepEqual(harness.api.cartItems, []);
      assert.equal(harness.api.discount, 0);
      assert.equal(harness.api.notes, '');
      assert.deepEqual(harness.api.attachments, []);
      assert.equal(harness.api.inputChannel, 'MANUAL_RAPIDA');
      assert.equal(harness.api.errorMsg, null);
    });
  });

  // =========================================================================
  // 4. ZOD SCHEMA VALIDATION (createSaleSchema in saleValidators.js)
  // =========================================================================
  describe('4. Schema Validation against Zod createSaleSchema', () => {
    it('4.1. Payload generado por confirmSale en venta manual satisface estrictamente createSaleSchema', async () => {
      const harness = createCartHarness({ eventId: VALID_EVENT_ID });
      const fakePoster = {
        id: VALID_PRODUCT_ID,
        titulo: 'Interstellar',
        subtitulo: 'Gargantua Minimalist',
        sizes: DEFAULT_SIZES,
      };

      harness.api.addItemFromPoster(fakePoster, DEFAULT_SIZES[2], 2); // Mediano Q65 x 2 = 130
      harness.api.setPaymentMethod('EFECTIVO');
      harness.api.setNotes('Venta de mostrador');

      await harness.api.confirmSale();
      const payload = harness.interceptedPayload;

      assert.ok(payload, 'El payload debe haber sido interceptado en authFetch');
      const validation = createSaleSchema.safeParse(payload);
      assert.ok(validation.success, `Fallo validación Zod: ${JSON.stringify(validation.error?.issues)}`);

      assert.equal(validation.data.eventId, VALID_EVENT_ID);
      assert.equal(validation.data.inputChannel, 'MANUAL_RAPIDA');
      assert.equal(validation.data.items.length, 1);
      assert.equal(validation.data.items[0].unitPrice, 65);
      assert.equal(validation.data.items[0].quantity, 2);
      assert.equal(validation.data.payments[0].method, 'EFECTIVO');
      assert.equal(validation.data.payments[0].amount, 130);
      assert.equal(validation.data.discount, 0);
      assert.deepEqual(validation.data.attachments, []);
    });

    it('4.2. Payload generado a partir de draft IA_VOZ con audio satisface estrictamente createSaleSchema', async () => {
      const voiceDraft = {
        items: [
          {
            productId: VALID_PRODUCT_ID,
            description: 'Póster Un Verano Sin Ti (Portada Álbum)',
            unitPrice: 55,
            quantity: 1,
            sizeId: 'PORTADA_ALBUM',
          },
        ],
        paymentMethod: 'TARJETA',
        notes: 'Pago con tarjeta POS Visa',
        inputChannel: 'IA_VOZ',
        audioUrl: 'https://storage.googleapis.com/deko-eventsales-media/audios/voice-rec-99.webm',
        transcription: '1 portada de un verano sin ti en tarjeta',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: voiceDraft });
      await harness.api.confirmSale();
      const payload = harness.interceptedPayload;

      const validation = createSaleSchema.safeParse(payload);
      assert.ok(validation.success, `Fallo validación Zod: ${JSON.stringify(validation.error?.issues)}`);

      assert.equal(validation.data.inputChannel, 'IA_VOZ');
      assert.equal(validation.data.payments[0].method, 'TARJETA');
      assert.equal(validation.data.payments[0].amount, 55);
      assert.equal(validation.data.attachments.length, 1);
      assert.equal(validation.data.attachments[0].fileType, 'AUDIO_VOZ');
      assert.equal(validation.data.attachments[0].fileUrl, voiceDraft.audioUrl);
      assert.equal(validation.data.attachments[0].transcription, voiceDraft.transcription);
    });

    it('4.3. Payload generado a partir de draft IA_IMAGEN_QR con foto satisface createSaleSchema', async () => {
      const qrDraft = {
        items: [
          {
            description: 'Póster Spider-Man (Grande)',
            unitPrice: 125,
            quantity: 2,
            sizeId: 'GRANDE',
          },
        ],
        paymentMethod: 'TRANSFERENCIA',
        inputChannel: 'IA_IMAGEN_QR',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/fotos/qr-scan-101.jpg',
        notes: 'Transferencia comprobante #883921',
      };

      const harness = createCartHarness({ eventId: VALID_EVENT_ID, initialDraft: qrDraft });
      harness.api.setDiscount(20); // 250 - 20 = 230

      await harness.api.confirmSale();
      const payload = harness.interceptedPayload;

      const validation = createSaleSchema.safeParse(payload);
      assert.ok(validation.success, `Fallo validación Zod: ${JSON.stringify(validation.error?.issues)}`);

      assert.equal(validation.data.inputChannel, 'IA_IMAGEN_QR');
      assert.equal(validation.data.discount, 20);
      assert.equal(validation.data.payments[0].amount, 230);
      assert.equal(validation.data.attachments[0].fileType, 'FOTO_QR');
    });

    it('4.4. Rechaza payloads adversariales malformados según el contrato del backend', () => {
      // Falta eventId
      assert.throws(() => {
        createSaleSchema.parse({
          eventId: 'not-a-uuid',
          items: [{ description: 'Test', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        });
      }, /UUID/i);

      // Items vacío
      assert.throws(() => {
        createSaleSchema.parse({
          eventId: VALID_EVENT_ID,
          items: [],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        });
      }, /al menos un producto/i);

      // Cantidad negativa o cero
      assert.throws(() => {
        saleItemSchema.parse({
          description: 'Póster',
          quantity: 0,
          unitPrice: 50,
        });
      }, /mayor a 0/i);

      // Método de pago inválido
      assert.throws(() => {
        salePaymentSchema.parse({
          method: 'CRIPTO_BITCOIN',
          amount: 50,
        });
      }, /Método de pago/i);

      // URL de attachment inválida
      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'storage-invalido',
          fileType: 'AUDIO_VOZ',
        });
      }, /URL/i);
    });
  });

  // =========================================================================
  // 5. API FAILURE RESILIENCE & ERROR HANDLING
  // =========================================================================
  describe('5. API Failure Resilience in Settlement Flow', () => {
    it('5.1. Protege ante intento de confirmar venta con carrito vacío sin invocar authFetch', async () => {
      let fetchCalled = false;
      const harness = createCartHarness({
        eventId: VALID_EVENT_ID,
        authFetch: async () => {
          fetchCalled = true;
          return { ok: true, json: async () => ({ success: true }) };
        },
      });

      const result = await harness.api.confirmSale();
      assert.equal(result, false, 'confirmSale debe retornar false ante carrito vacío');
      assert.equal(fetchCalled, false, 'authFetch NUNCA debe ser llamado con carrito vacío');
      assert.equal(harness.api.errorMsg, 'Debes agregar al menos un póster a la venta.');
      assert.equal(harness.api.isSubmitting, false);
    });

    it('5.2. Protege ante intento de confirmar venta sin eventId activo sin invocar authFetch', async () => {
      let fetchCalled = false;
      const harness = createCartHarness({
        eventId: null,
        initialDraft: { items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }] },
        authFetch: async () => {
          fetchCalled = true;
          return { ok: true, json: async () => ({ success: true }) };
        },
      });

      const result = await harness.api.confirmSale();
      assert.equal(result, false, 'confirmSale debe retornar false si no hay eventId');
      assert.equal(fetchCalled, false, 'authFetch NUNCA debe ser llamado sin eventId');
      assert.equal(harness.api.errorMsg, 'No hay un evento activo seleccionado.');
      assert.equal(harness.api.isSubmitting, false);
    });

    it('5.3. Captura respuesta HTTP 400 Bad Request y expone el mensaje de error sin crashear', async () => {
      await withMutedConsoleError(async () => {
        const harness = createCartHarness({
          eventId: VALID_EVENT_ID,
          initialDraft: { items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }] },
          authFetch: async () => ({
            ok: false,
            json: async () => ({ success: false, error: 'El evento ha sido finalizado por el administrador' }),
          }),
        });

        const result = await harness.api.confirmSale();
        assert.equal(result, null, 'confirmSale debe retornar null ante fallo de API');
        assert.equal(harness.api.errorMsg, 'El evento ha sido finalizado por el administrador');
        assert.equal(harness.api.isSubmitting, false, 'isSubmitting debe restablecerse a false');
      });
    });

    it('5.4. Captura respuesta HTTP 500 Internal Server Error y expone el error en UI', async () => {
      await withMutedConsoleError(async () => {
        const harness = createCartHarness({
          eventId: VALID_EVENT_ID,
          initialDraft: { items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }] },
          authFetch: async () => ({
            ok: false,
            json: async () => ({ success: false, error: 'Error interno en la base de datos PostgreSQL' }),
          }),
        });

        const result = await harness.api.confirmSale();
        assert.equal(result, null);
        assert.equal(harness.api.errorMsg, 'Error interno en la base de datos PostgreSQL');
        assert.equal(harness.api.isSubmitting, false);
      });
    });

    it('5.5. Maneja rechazos de red (Network Error / TypeError) sin arrojar excepciones no controladas', async () => {
      await withMutedConsoleError(async () => {
        const harness = createCartHarness({
          eventId: VALID_EVENT_ID,
          initialDraft: { items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }] },
          authFetch: async () => {
            throw new Error('TypeError: Failed to fetch (Dispositivo fuera de línea)');
          },
        });

        const result = await harness.api.confirmSale();
        assert.equal(result, null);
        assert.match(harness.api.errorMsg, /Failed to fetch/);
        assert.equal(harness.api.isSubmitting, false, 'isSubmitting debe liberarse tras fallo de red');
      });
    });

    it('5.6. Maneja abortos por timeout (AbortError) restaurando el estado reactivo', async () => {
      await withMutedConsoleError(async () => {
        const harness = createCartHarness({
          eventId: VALID_EVENT_ID,
          initialDraft: { items: [{ description: 'Póster', unitPrice: 65, quantity: 1 }] },
          authFetch: async () => {
            const abortErr = new Error('The operation was aborted due to timeout');
            abortErr.name = 'AbortError';
            throw abortErr;
          },
        });

        const result = await harness.api.confirmSale();
        assert.equal(result, null);
        assert.match(harness.api.errorMsg, /aborted/);
        assert.equal(harness.api.isSubmitting, false);
      });
    });

    it('5.7. En caso de éxito, dispara onSaleRegistered callback con los datos de la venta y limpia carrito', async () => {
      let registeredSaleData = null;
      const returnedData = { id: 'sale-999', saleNumber: 'V-2026-999', total: 65 };

      const harness = createCartHarness({
        eventId: VALID_EVENT_ID,
        initialDraft: { items: [{ description: 'Póster Star Wars', unitPrice: 65, quantity: 1 }] },
        onSaleRegistered: (data) => {
          registeredSaleData = data;
        },
        authFetch: async () => ({
          ok: true,
          json: async () => ({ success: true, data: returnedData }),
        }),
      });

      const result = await harness.api.confirmSale();
      assert.deepEqual(result, returnedData);
      assert.deepEqual(registeredSaleData, returnedData, 'onSaleRegistered debe invocarse con la venta');
      assert.deepEqual(harness.api.cartItems, [], 'El carrito debe limpiarse tras venta exitosa');
      assert.equal(harness.api.isSubmitting, false);
    });
  });

  // =========================================================================
  // 6. MASTER CONTAINER & HOOK CONTRACT COHERENCE
  // =========================================================================
  describe('6. Master Container & Submodule Prop Contract Coherence', () => {
    it('6.1. FastManualSaleForm.jsx exporta default function con firma { eventId, onSaleRegistered, initialDraft = null }', () => {
      const content = fs.readFileSync(masterFilePath, 'utf-8');
      assert.match(
        content,
        /export\s+default\s+function\s+FastManualSaleForm\s*\(\s*\{\s*eventId,\s*onSaleRegistered,\s*initialDraft\s*=\s*null\s*\}\s*\)/
      );
    });

    it('6.2. FastManualSaleForm pasa { eventId, onSaleRegistered, initialDraft } directamente a useManualSaleCart', () => {
      const content = fs.readFileSync(masterFilePath, 'utf-8');
      assert.match(
        content,
        /useManualSaleCart\s*\(\s*\{\s*eventId,\s*onSaleRegistered,\s*initialDraft\s*\}\s*\)/
      );
    });

    it('6.3. FastManualSaleForm conecta SaleCartList con attachments, inputChannel y unlinkAttachments', () => {
      const content = fs.readFileSync(masterFilePath, 'utf-8');
      assert.ok(content.includes('attachments={cart.attachments}'));
      assert.ok(content.includes('inputChannel={cart.inputChannel}'));
      assert.ok(content.includes('onUnlinkAttachments={cart.unlinkAttachments}'));
    });

    it('6.4. FastManualSaleForm conecta PaymentSummaryBar con confirmSale, isSubmitting y disabled', () => {
      const content = fs.readFileSync(masterFilePath, 'utf-8');
      assert.ok(content.includes('onConfirmSale={cart.confirmSale}'));
      assert.ok(content.includes('isSubmitting={cart.isSubmitting}'));
      assert.ok(content.includes('disabled={cart.cartItems.length === 0}'));
    });

    it('6.5. FastManualSaleForm renderiza cart.errorMsg en alerta visual cuando hay fallos', () => {
      const content = fs.readFileSync(masterFilePath, 'utf-8');
      assert.ok(content.includes('{cart.errorMsg && ('));
      assert.ok(content.includes('{cart.errorMsg}'));
    });
  });
});
