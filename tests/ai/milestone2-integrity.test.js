import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '@google/genai';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';
import { matchPosterEverywhere } from '../../server/services/catalog/webCatalogService.js';
import {
  salesAssistantTools,
  discardSaleDraftDeclaration,
  constructDraftPayload,
} from '../../server/services/ai/aiToolsService.js';
import { executeToolCall, buildFallbackSummaries } from '../../server/services/ai/aiClosedLoopService.js';
import { streamChatWithSalesAssistant } from '../../server/services/ai/aiStreamService.js';

const MOCK_EXCLUSIVE_CATALOG = [
  {
    id: 'prod-cruel-summer-1',
    sku: 'DV-TAYL-CS',
    name: 'Taylor Swift Cruel Summer',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/taylor-cs.jpg',
    tags: ['taylor', 'swift', 'cruel', 'summer', 'lover'],
    isActive: true,
    tenantId: 'tenant-m2',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: 'Formato vinilo' },
    ],
  },
  {
    id: 'prod-pink-floyd-1',
    sku: 'DV-PINK-01',
    name: 'Pink Floyd The Wall',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/pink.jpg',
    tags: ['pink', 'floyd', 'rock', 'the wall'],
    isActive: true,
    tenantId: 'tenant-m2',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: 'Formato vinilo' },
    ],
  },
  {
    id: 'prod-spiderman-standard',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    category: 'CÓMICS',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spidey.jpg',
    tags: ['spiderman', 'marvel', 'comic'],
    isActive: true,
    tenantId: 'tenant-m2',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
    ],
  },
];

describe('🛡️ MILESTONE 2 INTEGRITY: Fidelidad Dimensional y Cancelación Determinista', () => {
  let originalPrismaFindMany;

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-m2-integrity-key';
    invalidateCatalogCache();
    if (prisma?.product) {
      originalPrismaFindMany = prisma.product.findMany;
      prisma.product.findMany = async () => MOCK_EXCLUSIVE_CATALOG;
    }
    if (prisma?.event) {
      prisma.event.findFirst = async () => ({ id: 'event-m2', status: 'ACTIVO' });
      prisma.event.findUnique = async () => ({ id: 'event-m2', status: 'ACTIVO', name: 'Stand Event' });
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    if (prisma?.product && originalPrismaFindMany) {
      prisma.product.findMany = originalPrismaFindMany;
    }
  });

  describe('1. Fidelidad Dimensional Estricta en Catálogo', () => {
    it('1.1 matchPosterEverywhere rechaza tamaño Grande en obra exclusiva de Portada de Álbum', async () => {
      const res = await matchPosterEverywhere('tenant-m2', 'Taylor Swift Cruel Summer', 'GRANDE');
      assert.ok(res !== null, 'Debe encontrar la obra en catálogo');
      assert.strictEqual(res.sizeAvailable, false, 'sizeAvailable debe ser false');
      assert.ok(res.unavailableReason.includes('exclusivo en: Portada de Álbum (30 x 30 cm)'));
      assert.ok(res.unavailableReason.includes('No se fabrica en GRANDE'));
      assert.strictEqual(res.sizeId, 'PORTADA_ALBUM', 'selectedSize debe anclarse al formato oficial');
    });

    it('1.2 matchPosterEverywhere aprueba Portada de Álbum en obra exclusiva', async () => {
      const res = await matchPosterEverywhere('tenant-m2', 'Taylor Swift Cruel Summer', 'PORTADA_ALBUM');
      assert.ok(res !== null);
      assert.strictEqual(res.sizeAvailable, true);
      assert.strictEqual(res.unavailableReason, null);
      assert.strictEqual(res.unitPrice, 55);
      assert.strictEqual(res.sizeId, 'PORTADA_ALBUM');
    });

    it('1.3 constructDraftPayload excluye obras con sizeAvailable: false de items y las aísla', async () => {
      const args = {
        items: [{ productName: 'Pink Floyd The Wall', quantity: 1, size: 'GRANDE' }],
      };
      const draft = await constructDraftPayload('tenant-m2', args, '1 de Pink Floyd The Wall en grande');
      assert.strictEqual(draft.items.length, 0, 'No debe agregar al borrador ítems con tamaño no fabricado');
      assert.strictEqual(draft.total, 0);
      assert.strictEqual(draft.unmatchedItems.length, 1);
      assert.strictEqual(draft.unmatchedItems[0].sizeAvailable, false);
      assert.ok(draft.unmatchedItems[0].unavailableReason.includes('exclusivo'));
    });

    it('1.4 constructDraftPayload procesa orden mixta: admite estándar y aísla exclusiva en tamaño inválido', async () => {
      const args = {
        items: [
          { productName: 'Spider-Man Vintage', quantity: 1, size: 'GRANDE' },
          { productName: 'Taylor Swift Cruel Summer', quantity: 1, size: 'GRANDE' },
        ],
        paymentMethod: 'TARJETA',
      };
      const draft = await constructDraftPayload('tenant-m2', args, '1 spiderman grande y 1 taylor cruel summer grande pago tarjeta');
      assert.strictEqual(draft.items.length, 1, 'Solo debe entrar Spider-Man');
      assert.strictEqual(draft.items[0].unitPrice, 125);
      assert.strictEqual(draft.total, 125);
      assert.strictEqual(draft.unmatchedItems.length, 1, 'Taylor Swift debe quedar aislada');
      assert.strictEqual(draft.unmatchedItems[0].sizeAvailable, false);
    });
  });

  describe('2. Herramienta discardSaleDraft y Cancelación Determinista', () => {
    it('2.1 Declaración formal de discardSaleDraftDeclaration con Type.OBJECT y reason', () => {
      assert.strictEqual(discardSaleDraftDeclaration.name, 'discardSaleDraft');
      assert.ok(discardSaleDraftDeclaration.description.includes('Descarta'));
      assert.strictEqual(discardSaleDraftDeclaration.parameters.type, Type.OBJECT);
      assert.strictEqual(discardSaleDraftDeclaration.parameters.properties.reason.type, Type.STRING);
    });

    it('2.2 salesAssistantTools incluye las 8 herramientas oficiales', () => {
      const decls = salesAssistantTools[0].functionDeclarations;
      assert.strictEqual(decls.length, 8);
      const names = decls.map(d => d.name);
      assert.ok(names.includes('discardSaleDraft'));
    });

    it('2.3 executeToolCall ejecuta discardSaleDraft y retorna draft_sale: null', async () => {
      const res = await executeToolCall(
        { name: 'discardSaleDraft', args: { reason: 'Cliente cancela la compra' } },
        { tenantId: 'tenant-m2', eventId: 'event-m2' }
      );
      assert.deepStrictEqual(res.event, { type: 'draft_sale', data: null });
      assert.strictEqual(res.toolRecord.name, 'discardSaleDraft');
      assert.strictEqual(res.toolRecord.result.discarded, true);
      assert.strictEqual(res.toolRecord.result.reason, 'Cliente cancela la compra');
    });

    it('2.4 buildFallbackSummaries resume el descarte de la orden', () => {
      const summaries = buildFallbackSummaries([
        { name: 'discardSaleDraft', result: { discarded: true, reason: 'cancelación' } },
      ]);
      assert.ok(summaries.length > 0);
      assert.ok(summaries.some(s => s.toLowerCase().includes('descartado') || s.toLowerCase().includes('cancelad')));
    });

    it('2.5 streamChatWithSalesAssistant emite evento draft_sale con data null ante descarte', async () => {
      const fakeChunks = [
        { functionCalls: [{ name: 'discardSaleDraft', args: { reason: 'No quiero nada' } }] },
      ];
      const mockGeminiClient = {
        models: {
          generateContentStream: async function* () {
            for (const c of fakeChunks) yield c;
          },
        },
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Cancela la orden, ya no quiero nada',
        tenantId: 'tenant-m2',
        eventId: 'event-m2',
        geminiClient: mockGeminiClient,
      });

      const events = [];
      for await (const chunk of stream) events.push(chunk);

      const draftEvents = events.filter(e => e.type === 'draft_sale');
      assert.strictEqual(draftEvents.length, 1);
      assert.strictEqual(draftEvents[0].data, null, 'draft_sale data debe ser null');
    });
  });
});
