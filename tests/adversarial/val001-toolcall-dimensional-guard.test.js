/**
 * tests/adversarial/val001-toolcall-dimensional-guard.test.js
 * 
 * 🛡️ TEST ADVERSARIAL: BLINDAJE DIMENSIONAL PRE-TOOLCALL (TICKET VAL-001 / VAL-001b)
 * 
 * Verifica que:
 * 1. El system prompt contenga la guardia dimensional explícita contra toolCalls fantasma.
 * 2. executeToolCall en aiClosedLoopService emita data: null y result: null cuando no hay ítems válidos.
 * 3. aiStreamService sanitize toolCalls suprimiendo prepareSaleDraft cuando el borrador es nulo por incompatibilidad dimensional.
 * 4. Las solicitudes válidas (ej. Portada de Álbum Q55 o Spider-Man Mediano Q65) operen limpiamente sin supresión.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';
import { executeToolCall } from '../../server/services/ai/aiClosedLoopService.js';
import { chatWithSalesAssistant } from '../../server/services/ai/aiStreamService.js';

const MOCK_CATALOG = [
  {
    id: 'prod-cruel-summer-1',
    sku: 'DV-TAYL-CS',
    name: 'Taylor Swift Cruel Summer',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/taylor-cs.jpg',
    tags: ['taylor', 'swift', 'cruel', 'summer', 'lover'],
    isActive: true,
    tenantId: 'tenant-val001',
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
    tenantId: 'tenant-val001',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: 'Formato vinilo' },
    ],
  },
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    category: 'CÓMICS',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spidey.jpg',
    tags: ['spiderman', 'marvel', 'comic'],
    isActive: true,
    tenantId: 'tenant-val001',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
    ],
  },
];

describe('🛡️ TICKET VAL-001: Blindaje Dimensional Pre-ToolCall', () => {
  let originalPrismaFindMany;
  let originalEventFindFirst;
  let originalEventFindUnique;

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-val001-key';
    invalidateCatalogCache();
    if (prisma?.product) {
      originalPrismaFindMany = prisma.product.findMany;
      prisma.product.findMany = async () => MOCK_CATALOG;
    }
    if (prisma?.event) {
      originalEventFindFirst = prisma.event.findFirst;
      originalEventFindUnique = prisma.event.findUnique;
      prisma.event.findFirst = async () => ({ id: 'event-val001', status: 'ACTIVO', name: 'Stand Cayalá' });
      prisma.event.findUnique = async () => ({ id: 'event-val001', status: 'ACTIVO', name: 'Stand Cayalá', location: 'Plaza' });
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    if (prisma?.product && originalPrismaFindMany) {
      prisma.product.findMany = originalPrismaFindMany;
    }
    if (prisma?.event && originalEventFindFirst) {
      prisma.event.findFirst = originalEventFindFirst;
      prisma.event.findUnique = originalEventFindUnique;
    }
  });

  describe('1. Verificación de Directivas en System Prompt', () => {
    test('1.1 El system prompt contiene la directiva prohibitiva explícita contra toolCalls con deformación dimensional', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Cayalá Plaza Central', location: 'Plaza Central' },
        resolvedContextData: { vendedorNombre: 'Sebastián' },
        pendingDraft: null,
        message: 'Quiero un Cruel Summer en tamaño grande en tarjeta',
      });

      assert.ok(
        prompt.includes('GUARDIA PREVENTIVA DIMENSIONAL (CERO TOOLCALL FANTASMA)'),
        'El system prompt debe contener la sección de guardia preventiva dimensional'
      );
      assert.ok(
        prompt.includes('PROHIBIDO terminantemente invocar "prepareSaleDraft" si piden una portada de música'),
        'Debe prohibir terminantemente invocar prepareSaleDraft para portadas de música en tamaños estándar'
      );
      assert.ok(
        prompt.includes('Portada de Álbum (30x30 cm / Q55)'),
        'Debe especificar que las portadas de música son exclusivas de 30x30 cm a Q55'
      );
    });
  });

  describe('2. Sanitización en Closed Loop y executeToolCall', () => {
    test('2.1 executeToolCall devuelve data: null y result: null si la obra solicitada no tiene el tamaño disponible', async () => {
      const call = {
        name: 'prepareSaleDraft',
        args: {
          items: [{ productName: 'Taylor Swift Cruel Summer', size: 'GRANDE', quantity: 1, unitPrice: 125 }],
          paymentMethod: 'TARJETA',
          total: 125,
        },
      };

      const { event, toolRecord } = await executeToolCall(call, {
        tenantId: 'tenant-val001',
        eventId: 'event-val001',
        date: '2026-09-18',
        message: 'Quiero un Cruel Summer en tamaño grande en tarjeta',
        resolved: { evento: 'Cayalá' },
      });

      assert.equal(event?.type, 'draft_sale');
      assert.equal(event?.data, null, 'El event.data debe ser null si el tamaño solicitado no está disponible');
      assert.equal(toolRecord?.result, null, 'toolRecord.result debe ser null cuando todos los ítems fallaron por dimensión');
    });

    test('2.2 executeToolCall preserva el borrador legítimo si el tamaño solicitado es PORTADA_ALBUM para música', async () => {
      const call = {
        name: 'prepareSaleDraft',
        args: {
          items: [{ productName: 'Taylor Swift Cruel Summer', size: 'PORTADA_ALBUM', quantity: 1 }],
          paymentMethod: 'TARJETA',
        },
      };

      const { event, toolRecord } = await executeToolCall(call, {
        tenantId: 'tenant-val001',
        eventId: 'event-val001',
        date: '2026-09-18',
        message: '1 Cruel Summer portada de álbum',
        resolved: { evento: 'Cayalá' },
      });

      assert.equal(event?.type, 'draft_sale');
      assert.ok(event?.data?.items?.length > 0, 'Debe haber ítems en el borrador');
      assert.equal(event.data.items[0].sizeId, 'PORTADA_ALBUM');
      assert.equal(event.data.items[0].unitPrice, 55.0);
      assert.equal(toolRecord?.result?.total, 55.0);
    });
  });

  describe('3. Sanitización de toolCalls en chatWithSalesAssistant', () => {
    test('3.1 chatWithSalesAssistant suprime prepareSaleDraft de toolCalls si el borrador fue rechazado por tamaño', async () => {
      const mockGeminiClient = {
        models: {
          generateContent: async () => ({
            text: 'Oye, la obra Cruel Summer de Taylor Swift es una portada de disco y solo se fabrica en Portada de Álbum (30x30 cm) a Q55. No la fabricamos en tamaño grande.',
            functionCalls: [{
              name: 'prepareSaleDraft',
              args: {
                items: [{ productName: 'Taylor Swift Cruel Summer', size: 'GRANDE', quantity: 1, unitPrice: 125 }],
                total: 125,
                paymentMethod: 'TARJETA',
              },
            }],
          }),
        },
      };

      const res = await chatWithSalesAssistant({
        message: 'Quiero un Cruel Summer en tamaño grande en tarjeta',
        tenantId: 'tenant-val001',
        eventId: 'event-val001',
        geminiClient: mockGeminiClient,
      });

      assert.equal(res.draftSale, null, 'draftSale debe ser null');
      const prepareCall = (res.toolCalls || []).find((c) => c.name === 'prepareSaleDraft');
      assert.equal(prepareCall, undefined, 'prepareSaleDraft debe haber sido suprimido de toolCalls al ser rechazado');
      assert.ok(res.reply.includes('Portada de Álbum') || res.reply.includes('Cruel Summer'));
    });

    test('3.2 chatWithSalesAssistant conserva prepareSaleDraft en toolCalls si el pedido es legítimo', async () => {
      const mockGeminiClient = {
        models: {
          generateContent: async () => ({
            text: '¡Excelente! Te preparé el borrador en pantalla con Spider-Man mediano.',
            functionCalls: [{
              name: 'prepareSaleDraft',
              args: {
                items: [{ productName: 'Spider-Man Vintage Comic', size: 'MEDIANO', quantity: 1, unitPrice: 65 }],
                total: 65,
                paymentMethod: 'EFECTIVO',
              },
            }],
          }),
        },
      };

      const res = await chatWithSalesAssistant({
        message: '1 Spiderman mediano en efectivo',
        tenantId: 'tenant-val001',
        eventId: 'event-val001',
        geminiClient: mockGeminiClient,
      });

      assert.ok(res.draftSale !== null, 'draftSale debe existir');
      assert.equal(res.draftSale.items.length, 1);
      assert.equal(res.draftSale.items[0].unitPrice, 65);

      const prepareCall = (res.toolCalls || []).find((c) => c.name === 'prepareSaleDraft');
      assert.ok(prepareCall !== undefined, 'prepareSaleDraft debe mantenerse en toolCalls cuando es legítimo');
    });
  });

});
