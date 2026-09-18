import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { constructDraftPayload } from '../../server/services/ai/aiToolsService.js';
import { streamChatWithSalesAssistant } from '../../server/services/ai/aiStreamService.js';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';

const MOCK_CATALOG = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    sku: 'DV-JORD-01',
    name: 'Michael Jordan - La Soberanía 23',
    category: 'DEPORTES',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/jordan.jpg',
    tags: ['jordan', 'michael jordan', 'bulls', '23', 'basketball'],
    isActive: true,
    tenantId: 'tenant-test',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
    ],
  },
  {
    id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sku: 'DV-OROD-01',
    name: 'Olivia Rodrigo - GUTS World Tour',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/olivia.jpg',
    tags: ['olivia', 'olivia rodrigo', 'guts', 'sour', 'musica'],
    isActive: true,
    tenantId: 'tenant-test',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
];

describe('🛡️ Hard Catalog Boundary & Zero Ghost Products Test Suite', () => {
  let originalPrisma = {};

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-key-hard-catalog';
    invalidateCatalogCache();

    originalPrisma = {
      productFindMany: prisma.product?.findMany,
      productUpsert: prisma.product?.upsert,
      eventFindFirst: prisma.event?.findFirst,
      eventFindUnique: prisma.event?.findUnique,
    };

    if (prisma.product) {
      prisma.product.findMany = async () => MOCK_CATALOG;
      prisma.product.upsert = async () => ({});
    }
    if (prisma.event) {
      prisma.event.findFirst = async () => ({
        id: 'event-stand-1',
        name: 'Feria Vintage 2026',
        location: 'Mostrador Stand',
        salesTarget: 15000,
        status: 'ACTIVO',
      });
      prisma.event.findUnique = async () => ({
        id: 'event-stand-1',
        name: 'Feria Vintage 2026',
        location: 'Mostrador Stand',
        salesTarget: 15000,
        status: 'ACTIVO',
      });
    }
  });

  afterEach(() => {
    if (prisma.product && originalPrisma.productFindMany) prisma.product.findMany = originalPrisma.productFindMany;
    if (prisma.product && originalPrisma.productUpsert) prisma.product.upsert = originalPrisma.productUpsert;
    if (prisma.event && originalPrisma.eventFindFirst) prisma.event.findFirst = originalPrisma.eventFindFirst;
    if (prisma.event && originalPrisma.eventFindUnique) prisma.event.findUnique = originalPrisma.eventFindUnique;
  });

  describe('1. constructDraftPayload - Catálogo como Frontera Dura', () => {
    it('1.1 Orden mixta: aísla obra real y obra desconocida en unmatchedItems sin inventar precio', async () => {
      const args = {
        items: [
          { productName: 'olivia uña', quantity: 1, size: 'MEDIANO' },
          { productName: 'jordan 23 grande', quantity: 1, size: 'GRANDE' },
        ],
        paymentMethod: 'TARJETA',
      };

      const result = await constructDraftPayload('tenant-test', args, '1 de olivia uña, y 1 de jordan 23 grande en tarjeta');

      // 1. Debe haber exactamente 1 ítem enriquecido (Jordan)
      assert.equal(result.items.length, 1, 'Solo debe montar 1 obra real en items');
      assert.ok(result.items[0].description.toLowerCase().includes('jordan'), 'El ítem montado debe ser Jordan');
      assert.equal(result.items[0].sizeId, 'GRANDE', 'El tamaño debe ser GRANDE');
      assert.equal(result.items[0].unitPrice, 125, 'El precio de Jordan grande debe ser 125');
      assert.ok(result.items[0].productId !== null, 'El productId no debe ser nulo para obras reales');

      // 2. La obra desconocida debe estar en unmatchedItems
      assert.equal(result.unmatchedItems.length, 1, 'Debe registrar 1 obra en unmatchedItems');
      assert.equal(result.unmatchedItems[0].rawName, 'olivia uña');
      assert.ok(Array.isArray(result.unmatchedItems[0].candidates), 'Debe incluir lista de candidatos cercanos');
      const candidateTitles = result.unmatchedItems[0].candidates.map(c => c.titulo);
      assert.ok(candidateTitles.some(t => t.toLowerCase().includes('olivia')), 'Debe encontrar candidatos con Olivia');

      // 3. El total debe ser ÚNICAMENTE el de Jordan (125.00), CERO precio inventado para olivia uña
      assert.equal(result.total, 125.0, 'El total no debe incluir obras no comprobadas (Q125.00, no Q190.00)');
      assert.equal(result.paymentMethod, 'TARJETA');
    });

    it('1.2 Orden 100% desconocida: items vacío, total 0 y unmatchedItems poblado', async () => {
      const args = {
        items: [
          { productName: 'olivia uña', quantity: 1 },
          { productName: 'diseño inexistente 999', quantity: 2 },
        ],
        paymentMethod: 'EFECTIVO',
      };

      const result = await constructDraftPayload('tenant-test', args, 'dame 1 olivia uña y 2 diseño inexistente 999');

      assert.equal(result.items.length, 0, 'No debe montar ningún ítem ficticio en items');
      assert.equal(result.total, 0, 'El total debe ser 0 cuando ninguna obra existe');
      assert.equal(result.unmatchedItems.length, 2, 'Ambas obras deben ser registradas en unmatchedItems');
      assert.equal(result.unmatchedItems[0].rawName, 'olivia uña');
      assert.equal(result.unmatchedItems[1].rawName, 'diseño inexistente 999');
    });
  });

  describe('2. streamChatWithSalesAssistant - Respuestas Consultivas y Honestidad Comercial', () => {
    it('2.1 Orden mixta: emite advertencia proactiva y sugerencia de candidatos', async () => {
      const mockGeminiClient = {
        models: {
          generateContentStream: async function* () {
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [
                      { productName: 'olivia uña', quantity: 1 },
                      { productName: 'jordan 23 grande', quantity: 1, size: 'GRANDE' },
                    ],
                    paymentMethod: 'TARJETA',
                  },
                },
              ],
            };
          },
        },
      };

      const generator = streamChatWithSalesAssistant(
        '1 de olivia uña, y 1 de jordan 23 grande en tarjeta',
        [],
        null,
        { tenantId: 'tenant-test', sellerName: 'Sebastian' },
        mockGeminiClient
      );

      const events = [];
      for await (const chunk of generator) {
        events.push(chunk);
      }

      // Debe haber emitido evento draft_sale con items reales y unmatchedItems
      const draftEvent = events.find(e => e.type === 'draft_sale');
      assert.ok(draftEvent, 'Debe emitir evento draft_sale');
      assert.equal(draftEvent.data.items.length, 1);
      assert.equal(draftEvent.data.unmatchedItems.length, 1);
      assert.equal(draftEvent.data.total, 125);

      // Debe haber emitido token de advertencia proactiva
      const tokenEvents = events.filter(e => e.type === 'token');
      const fullText = tokenEvents.map(t => t.text).join(' ');

      assert.ok(fullText.includes('⚠️ Monté en el borrador'), 'Debe advertir qué se montó');
      assert.ok(fullText.includes('Jordan'), 'Debe mencionar a Jordan');
      assert.ok(fullText.includes("no encontré 'olivia uña' en el catálogo"), 'Debe reportar que no encontró olivia uña');
      assert.ok(!fullText.includes('¡Listo, Sebastian! Te monté el borrador en pantalla listo para cobrar'), 'NO debe emitir mensaje genérico de éxito ciego');
    });

    it('2.2 Orden 100% desconocida: responde con honestidad comercial', async () => {
      const mockGeminiClient = {
        models: {
          generateContentStream: async function* () {
            yield {
              functionCalls: [
                {
                  name: 'prepareSaleDraft',
                  args: {
                    items: [{ productName: 'termino_totalmente_inexistente_xyz', quantity: 1 }],
                  },
                },
              ],
            };
          },
        },
      };

      const generator = streamChatWithSalesAssistant(
        'dame 1 termino_totalmente_inexistente_xyz',
        [],
        null,
        { tenantId: 'tenant-test', sellerName: 'Sebastian' },
        mockGeminiClient
      );

      const events = [];
      for await (const chunk of generator) {
        events.push(chunk);
      }

      const tokenEvents = events.filter(e => e.type === 'token');
      const fullText = tokenEvents.map(t => t.text).join(' ');

      assert.ok(fullText.includes('No encontré la obra'), 'Debe responder honestamente que no encontró la obra');
      assert.ok(fullText.includes('termino_totalmente_inexistente_xyz'), 'Debe nombrar la obra no encontrada');
      assert.ok(fullText.includes('¿Deseas consultar por otro artista o buscarlo en el catálogo?'), 'Debe ofrecer alternativas consultivas');
    });
  });

  describe('3. buildSalesSystemPrompt - Directivas de Catálogo como Frontera Dura', () => {
    it('3.1 Incluye directiva explícita de CATÁLOGO COMO FRONTERA DURA y unmatchedItems', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Feria Vintage 2026', location: 'Mostrador Stand' },
        resolvedContextData: { vendedorNombre: 'Sebastian' },
      });

      assert.ok(prompt.includes('CATÁLOGO COMO FRONTERA DURA'), 'Debe incluir la directiva de frontera dura');
      assert.ok(prompt.includes('unmatchedItems'), 'Debe mencionar el reporte de unmatchedItems');
      assert.ok(prompt.includes('NUNCA cobrará productos fantasma ni precios inventados'), 'Debe prohibir productos fantasma');
    });
  });
});
