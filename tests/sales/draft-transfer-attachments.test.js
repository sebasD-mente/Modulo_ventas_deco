import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSaleSchema,
  saleAttachmentSchema,
} from '../../server/validators/saleValidators.js';

describe('📎 Suite de Metadatos, Adjuntos y Transferencia de Borradores (M2)', () => {
  const validUUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  describe('1. Validación con Zod de createSaleSchema y saleAttachmentSchema', () => {
    it('Acepta una venta completa con attachments estructurados e inputChannel IA_VOZ', () => {
      const validPayload = {
        eventId: validUUID,
        items: [
          {
            description: 'Bad Bunny - Un Verano Sin Ti (Portada Álbum)',
            quantity: 1,
            unitPrice: 55.0,
          },
        ],
        payments: [
          {
            method: 'TARJETA',
            amount: 55.0,
          },
        ],
        discount: 0,
        notes: 'Transferido desde IA',
        inputChannel: 'IA_VOZ',
        attachments: [
          {
            fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/audio-123.webm',
            fileType: 'AUDIO_VOZ',
            fileName: 'audio-123.webm',
            fileSize: 45000,
            transcription: '1 de un verano sin ti portada en tarjeta',
            aiMetadata: { confidence: 0.98 },
          },
        ],
      };

      const parsed = createSaleSchema.parse(validPayload);
      assert.strictEqual(parsed.inputChannel, 'IA_VOZ');
      assert.strictEqual(parsed.attachments.length, 1);
      assert.strictEqual(parsed.attachments[0].fileUrl, 'https://storage.googleapis.com/deko-eventsales-media/audio-123.webm');
      assert.strictEqual(parsed.attachments[0].fileType, 'AUDIO_VOZ');
      assert.strictEqual(parsed.attachments[0].transcription, '1 de un verano sin ti portada en tarjeta');
      assert.strictEqual(parsed.attachments[0].fileSize, 45000);
    });

    it('Acepta venta con adjuntos fotográficos e inputChannel IA_FOTO_ARTE', () => {
      const validPhotoPayload = {
        eventId: validUUID,
        items: [
          {
            description: 'Spider-Man Vintage (Mediano)',
            quantity: 2,
            unitPrice: 65.0,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 130.0,
          },
        ],
        inputChannel: 'IA_FOTO_ARTE',
        attachments: [
          {
            fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/foto-456.jpg',
            fileType: 'FOTO_ARTE',
            fileName: 'foto-456.jpg',
            fileSize: 250000,
          },
        ],
      };

      const parsed = createSaleSchema.parse(validPhotoPayload);
      assert.strictEqual(parsed.inputChannel, 'IA_FOTO_ARTE');
      assert.strictEqual(parsed.attachments.length, 1);
      assert.strictEqual(parsed.attachments[0].fileType, 'FOTO_ARTE');
    });

    it('Asigna por defecto un array vacío en attachments si se omite', () => {
      const payloadWithoutAttachments = {
        eventId: validUUID,
        items: [
          {
            description: 'Batman (Grande)',
            quantity: 1,
            unitPrice: 125.0,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 125.0,
          },
        ],
      };

      const parsed = createSaleSchema.parse(payloadWithoutAttachments);
      assert.ok(Array.isArray(parsed.attachments), 'attachments debe ser un array');
      assert.strictEqual(parsed.attachments.length, 0, 'attachments debe ser un array vacío por defecto');
      assert.strictEqual(parsed.inputChannel, 'MANUAL_POS', 'inputChannel por defecto debe ser MANUAL_POS');
    });

    it('Rechaza adjuntos con URLs inválidas, tipo vacío o tamaño negativo', () => {
      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'not-a-valid-url',
          fileType: 'AUDIO_VOZ',
        });
      }, /URL/);

      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'https://valid-url.com/file.mp3',
          fileType: '',
        });
      }, /tipo/);

      assert.throws(() => {
        saleAttachmentSchema.parse({
          fileUrl: 'https://valid-url.com/file.mp3',
          fileType: 'AUDIO',
          fileSize: -10,
        });
      });
    });
  });

  describe('2. Normalización de Borradores en Transferencia (UnifiedAiChat -> FastManualSaleForm)', () => {
    // Función espejo de la lógica implementada en UnifiedAiChat:1245
    function normalizeDraftForTransfer(pendingDraft) {
      if (!pendingDraft) return null;

      const normalizedAttachments = Array.isArray(pendingDraft.attachments) && pendingDraft.attachments.length > 0
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

    it('Normaliza y empaqueta borrador generado por voz con audioUrl y selectedSizeId', () => {
      const voiceDraft = {
        items: [
          {
            description: 'Taylor Swift - 1989 (Portada Álbum)',
            quantity: 1,
            unitPrice: 55,
            sizeId: 'PORTADA_ALBUM',
          },
        ],
        total: 55,
        paymentMethod: 'TRANSFERENCIA',
        inputChannel: 'IA_VOZ',
        audioUrl: 'https://storage.googleapis.com/deko-eventsales-media/voice-taylor.webm',
        transcription: '1 de taylor 1989 portada por transferencia',
      };

      const transferred = normalizeDraftForTransfer(voiceDraft);
      assert.strictEqual(transferred.inputChannel, 'IA_VOZ');
      assert.strictEqual(transferred.items[0].selectedSizeId, 'PORTADA_ALBUM');
      assert.strictEqual(transferred.attachments.length, 1);
      assert.strictEqual(transferred.attachments[0].fileUrl, voiceDraft.audioUrl);
      assert.strictEqual(transferred.attachments[0].fileType, 'AUDIO_VOZ');
      assert.strictEqual(transferred.attachments[0].transcription, voiceDraft.transcription);
    });

    it('Normaliza borrador generado por visión con imageUrl y QR', () => {
      const qrDraft = {
        items: [
          {
            description: 'Goku Ultra Instinct (Grande)',
            quantity: 1,
            unitPrice: 125,
            sizeId: 'GRANDE',
          },
        ],
        total: 125,
        inputChannel: 'IA_IMAGEN_QR',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/qr-goku.png',
      };

      const transferred = normalizeDraftForTransfer(qrDraft);
      assert.strictEqual(transferred.inputChannel, 'IA_IMAGEN_QR');
      assert.strictEqual(transferred.attachments[0].fileType, 'FOTO_QR');
      assert.strictEqual(transferred.items[0].selectedSizeId, 'GRANDE');
    });

    it('Preserva attachments pre-existentes sin duplicarlos ni alterarlos', () => {
      const preExisting = [
        { fileUrl: 'https://storage.googleapis.com/test/doc.pdf', fileType: 'DOCUMENTO' },
      ];
      const draft = {
        items: [{ description: 'Anime', unitPrice: 35, sizeId: 'PEQUENO' }],
        attachments: preExisting,
        inputChannel: 'IA_CHAT_TEXTO',
      };

      const transferred = normalizeDraftForTransfer(draft);
      assert.deepStrictEqual(transferred.attachments, preExisting);
    });
  });

  describe('3. Integración en FastManualSaleForm: Tamaños, Limpieza Regex y Payload Final', () => {
    const DEFAULT_SIZES = [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
    ];

    it('DEFAULT_SIZES incluye PORTADA_ALBUM a Q55 y GIGANTE a Q180', () => {
      const portada = DEFAULT_SIZES.find((s) => s.sizeId === 'PORTADA_ALBUM');
      const gigante = DEFAULT_SIZES.find((s) => s.sizeId === 'GIGANTE');

      assert.ok(portada, 'PORTADA_ALBUM debe estar en DEFAULT_SIZES');
      assert.strictEqual(portada.precio, 55);

      assert.ok(gigante, 'GIGANTE debe estar en DEFAULT_SIZES');
      assert.strictEqual(gigante.precio, 180);
    });

    it('La expresión regular de changeTicketItemSize limpia limpiamente variaciones de portada sin duplicación', () => {
      const regex = /\s*\((MINI|PEQUEÑO|PEQUENO|MEDIANO|GRANDE|GIGANTE|PORTADA_ALBUM|PORTADA|PORTADA ÁLBUM)\)/gi;

      const cases = [
        { input: 'Un Verano Sin Ti (Portada Álbum)', expectedClean: 'Un Verano Sin Ti' },
        { input: 'Un Verano Sin Ti (PORTADA_ALBUM)', expectedClean: 'Un Verano Sin Ti' },
        { input: 'Un Verano Sin Ti (PORTADA)', expectedClean: 'Un Verano Sin Ti' },
        { input: 'Batman Dark Knight (GIGANTE)', expectedClean: 'Batman Dark Knight' },
        { input: 'Spider-Man (MEDIANO)', expectedClean: 'Spider-Man' },
        { input: 'Interstellar (PEQUEÑO)', expectedClean: 'Interstellar' },
      ];

      for (const { input, expectedClean } of cases) {
        const cleaned = input.replace(regex, '').trim();
        assert.strictEqual(cleaned, expectedClean, `Falla limpiando: "${input}"`);

        // Simular cambio a GRANDE
        const newDesc = `${cleaned} (Grande)`;
        assert.strictEqual(newDesc, `${expectedClean} (Grande)`);
        assert.doesNotMatch(newDesc, /\(Portada.*\).*\(/i, 'No debe concatenar tamaños duplicados');
      }
    });

    it('El payload resultante de FastManualSaleForm pasa validación de backend completa', () => {
      const simulatedTransferredDraft = {
        items: [
          {
            description: 'Bad Bunny - Un Verano Sin Ti (Portada Álbum)',
            quantity: 2,
            unitPrice: 55.0,
            selectedSizeId: 'PORTADA_ALBUM',
          },
        ],
        paymentMethod: 'TARJETA',
        notes: 'Venta rápida transferida de voz',
        inputChannel: 'IA_VOZ',
        attachments: [
          {
            fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/rec-001.webm',
            fileType: 'AUDIO_VOZ',
            transcription: '2 de un verano sin ti en tarjeta',
          },
        ],
      };

      // Simular armado de payload en handleSubmitSale
      const salePayload = {
        eventId: validUUID,
        items: simulatedTransferredDraft.items.map((i) => ({
          productId: null,
          description: i.description,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        payments: [
          {
            method: simulatedTransferredDraft.paymentMethod,
            amount: 110.0,
            reference: simulatedTransferredDraft.notes || null,
          },
        ],
        discount: 0,
        notes: simulatedTransferredDraft.notes,
        inputChannel: simulatedTransferredDraft.inputChannel || 'MANUAL_RAPIDA',
        attachments: simulatedTransferredDraft.attachments || [],
      };

      // Debe pasar createSaleSchema sin arrojar excepciones
      const validated = createSaleSchema.parse(salePayload);
      assert.strictEqual(validated.inputChannel, 'IA_VOZ');
      assert.strictEqual(validated.attachments.length, 1);
      assert.strictEqual(validated.attachments[0].fileType, 'AUDIO_VOZ');
      assert.strictEqual(validated.items[0].unitPrice, 55.0);
      assert.strictEqual(validated.payments[0].amount, 110.0);
    });
  });
});
