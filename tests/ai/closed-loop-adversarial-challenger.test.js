import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { prisma } from '../../server/config/prisma.js';
import {
  streamChatWithSalesAssistant,
  chatWithSalesAssistant,
} from '../../server/services/ai/aiStreamService.js';
import {
  executeToolCall,
  streamClosedLoopFollowUp,
} from '../../server/services/ai/aiClosedLoopService.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';

// Catálogo en memoria para eliminar dependencias externas y latencia
const MOCK_DB_PRODUCTS = [
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    category: 'CÓMICS',
    basePrice: 25,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
    tags: ['spiderman', 'spider-man', 'marvel'],
    isActive: true,
    tenantId: 'adversarial-tenant',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
    ],
  },
  {
    id: 'prod-badbunny-1',
    sku: 'DV-BBNY-01',
    name: 'Un Verano Sin Ti - Bad Bunny',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/badbunny.jpg',
    tags: ['bad bunny', 'un verano sin ti', 'musica', 'portada'],
    isActive: true,
    tenantId: 'adversarial-tenant',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55, badge: '🎵 Vinilo / 30x30' },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
];

describe('🛡️ ADVERSARIAL CHALLENGER: Closed-Loop Tool Execution & Dual Streaming', () => {
  let originalPrisma = {};

  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'adversarial-test-key-closed-loop';
    invalidateCatalogCache();

    // Guardar métodos de prisma
    originalPrisma = {
      productFindMany: prisma.product?.findMany,
      eventFindFirst: prisma.event?.findFirst,
      eventFindUnique: prisma.event?.findUnique,
      saleGroupBy: prisma.sale?.groupBy,
      saleFindMany: prisma.sale?.findMany,
      saleAggregate: prisma.sale?.aggregate,
      saleItemGroupBy: prisma.saleItem?.groupBy,
      saleItemFindMany: prisma.saleItem?.findMany,
      saleItemAggregate: prisma.saleItem?.aggregate,
      salePaymentGroupBy: prisma.salePayment?.groupBy,
      salePaymentAggregate: prisma.salePayment?.aggregate,
      cashClosingFindFirst: prisma.cashClosing?.findFirst,
      userFindMany: prisma.user?.findMany,
    };

    // Mocks seguros en memoria (Zero-Network-Leakage)
    if (prisma.product) {
      prisma.product.findMany = async () => MOCK_DB_PRODUCTS;
    }
    if (prisma.event) {
      prisma.event.findFirst = async () => ({
        id: 'adversarial-event-1',
        name: 'Evento Challenger 2026',
        location: 'Stand Principal',
        salesTarget: 10000,
        status: 'ACTIVO',
      });
      prisma.event.findUnique = async () => ({
        id: 'adversarial-event-1',
        name: 'Evento Challenger 2026',
        location: 'Stand Principal',
        salesTarget: 10000,
        status: 'ACTIVO',
      });
    }
    if (prisma.sale) {
      prisma.sale.groupBy = async () => [];
      prisma.sale.findMany = async () => [];
      prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 1500 }, _count: { id: 10 } });
    }
    if (prisma.saleItem) {
      prisma.saleItem.groupBy = async () => [];
      prisma.saleItem.findMany = async () => [];
      prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 15 }, _count: { id: 15 } });
    }
    if (prisma.salePayment) {
      prisma.salePayment.groupBy = async () => [
        { method: 'EFECTIVO', _sum: { amount: 800 }, _count: { id: 6 } },
        { method: 'TARJETA', _sum: { amount: 500 }, _count: { id: 3 } },
        { method: 'TRANSFERENCIA', _sum: { amount: 200 }, _count: { id: 1 } },
      ];
      prisma.salePayment.aggregate = async () => ({ _sum: { amount: 1500 }, _count: { id: 10 } });
    }
    if (prisma.cashClosing) {
      prisma.cashClosing.findFirst = async () => null;
    }
    if (prisma.user) {
      prisma.user.findMany = async () => [
        { id: 'user-seller-1', fullName: 'Carlos Vendedor', email: 'carlos@deko.gt' }
      ];
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    if (prisma.product && originalPrisma.productFindMany) prisma.product.findMany = originalPrisma.productFindMany;
    if (prisma.event) {
      if (originalPrisma.eventFindFirst) prisma.event.findFirst = originalPrisma.eventFindFirst;
      if (originalPrisma.eventFindUnique) prisma.event.findUnique = originalPrisma.eventFindUnique;
    }
    if (prisma.sale) {
      if (originalPrisma.saleGroupBy) prisma.sale.groupBy = originalPrisma.saleGroupBy;
      if (originalPrisma.saleFindMany) prisma.sale.findMany = originalPrisma.saleFindMany;
      if (originalPrisma.saleAggregate) prisma.sale.aggregate = originalPrisma.saleAggregate;
    }
    if (prisma.saleItem) {
      if (originalPrisma.saleItemGroupBy) prisma.saleItem.groupBy = originalPrisma.saleItemGroupBy;
      if (originalPrisma.saleItemFindMany) prisma.saleItem.findMany = originalPrisma.saleItemFindMany;
      if (originalPrisma.saleItemAggregate) prisma.saleItem.aggregate = originalPrisma.saleItemAggregate;
    }
    if (prisma.salePayment) {
      if (originalPrisma.salePaymentGroupBy) prisma.salePayment.groupBy = originalPrisma.salePaymentGroupBy;
      if (originalPrisma.salePaymentAggregate) prisma.salePayment.aggregate = originalPrisma.salePaymentAggregate;
    }
    if (prisma.cashClosing && originalPrisma.cashClosingFindFirst) prisma.cashClosing.findFirst = originalPrisma.cashClosingFindFirst;
    if (prisma.user && originalPrisma.userFindMany) prisma.user.findMany = originalPrisma.userFindMany;
  });

  // =========================================================================
  // 1. EMISIÓN INMEDIATA DE EVENTOS ESTRUCTURADOS ANTES DE TEXTO
  // =========================================================================
  describe('1. Emisión Inmediata de Eventos Estructurados antes del Texto', () => {

    it('1.1 prepareSaleDraft emite event: draft_sale INMEDIATAMENTE antes de los tokens del follow-up', async () => {
      const client = getGeminiClient();
      assert.ok(client);

      let streamCallCount = 0;
      client.models.generateContentStream = async function* (params) {
        streamCallCount++;
        if (streamCallCount === 1) {
          // Primer turno: Gemini decide llamar a la herramienta prepareSaleDraft
          yield {
            functionCalls: [
              {
                name: 'prepareSaleDraft',
                args: {
                  items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
                  paymentMethod: 'EFECTIVO',
                },
              },
            ],
          };
        } else {
          // Segundo turno (closed-loop): Gemini genera tokens explicativos
          yield { text: '¡Excelente elección! ' };
          yield { text: 'He preparado el borrador en tu pantalla.' };
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '1 póster de Spider-Man mediano en efectivo',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      assert.strictEqual(streamCallCount, 2, 'Debe haber invocado generateContentStream exactamente 2 veces (closed-loop)');
      assert.ok(emitted.length >= 2, 'Debe haber emitido al menos el evento estructurado y los tokens');

      // VERIFICACIÓN CRÍTICA DE ORDEN: El primer chunk debe ser draft_sale, NO un token
      assert.strictEqual(emitted[0].type, 'draft_sale', 'El primer evento emitido DEBE ser draft_sale');
      assert.ok(emitted[0].data, 'El draft_sale debe contener los datos del borrador');
      assert.strictEqual(emitted[0].data.total, 65);
      assert.strictEqual(emitted[0].data.paymentMethod, 'EFECTIVO');

      // Los siguientes chunks deben ser tokens de texto
      const tokenChunks = emitted.slice(1).filter(e => e.type === 'token');
      assert.ok(tokenChunks.length >= 1, 'Los tokens explicativos deben fluir tras el evento estructurado');
      const fullText = tokenChunks.map(t => t.text).join('');
      assert.ok(fullText.includes('borrador en tu pantalla'));
    });

    it('1.2 checkInventoryStock emite event: inventory_stock INMEDIATAMENTE antes del follow-up', async () => {
      const client = getGeminiClient();

      let streamCallCount = 0;
      client.models.generateContentStream = async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          yield {
            functionCalls: [
              {
                name: 'checkInventoryStock',
                args: { query: 'Spider-Man', sizeId: 'MEDIANO' },
              },
            ],
          };
        } else {
          yield { text: 'Tenemos existencias listas en mostrador.' };
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Tienes stock de Spider-Man en mediano?',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      assert.strictEqual(streamCallCount, 2);
      assert.strictEqual(emitted[0].type, 'inventory_stock', 'El primer evento DEBE ser inventory_stock');
      assert.strictEqual(emitted[0].data.found, true);
      assert.strictEqual(emitted[0].data.requestedSize.sizeId, 'MEDIANO');

      // Seguido por tokens
      assert.strictEqual(emitted[1].type, 'token');
      assert.ok(emitted[1].text.includes('existencias'));
    });

    it('1.3 searchCatalog emite event: suggested_posters INMEDIATAMENTE antes del follow-up', async () => {
      const client = getGeminiClient();

      let streamCallCount = 0;
      client.models.generateContentStream = async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          yield {
            functionCalls: [
              {
                name: 'searchCatalog',
                args: { query: 'Spider-Man', category: 'CÓMICS' },
              },
            ],
          };
        } else {
          yield { text: 'Aquí tienes los pósters encontrados en catálogo.' };
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: 'Muéstrame opciones de Spider-Man',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      assert.strictEqual(streamCallCount, 2);
      assert.strictEqual(emitted[0].type, 'suggested_posters', 'El primer evento DEBE ser suggested_posters');
      assert.ok(Array.isArray(emitted[0].data));
      assert.ok(emitted[0].data.length > 0);
      assert.strictEqual(emitted[1].type, 'token');
    });

    it('1.4 getSellerShiftReport emite event: seller_shift_report INMEDIATAMENTE antes del follow-up', async () => {
      const client = getGeminiClient();

      let streamCallCount = 0;
      client.models.generateContentStream = async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          yield {
            functionCalls: [
              {
                name: 'getSellerShiftReport',
                args: { eventId: 'adversarial-event-1', sellerId: 'user-seller-1' },
              },
            ],
          };
        } else {
          yield { text: 'Carlos lleva un excelente ritmo en este turno.' };
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Cómo va el turno de Carlos?',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      assert.strictEqual(streamCallCount, 2);
      assert.strictEqual(emitted[0].type, 'seller_shift_report', 'El primer evento DEBE ser seller_shift_report');
      assert.ok(emitted[0].data.ranking !== undefined);
      assert.strictEqual(emitted[1].type, 'token');
    });

  });

  // =========================================================================
  // 2. ANTI-DUPLICACIÓN (R5): checkInventoryStock NO DEBE EMITIR suggested_posters
  // =========================================================================
  describe('2. Anti-Duplicación (R5): checkInventoryStock vs suggested_posters', () => {

    it('2.1 checkInventoryStock emite inventory_stock y NUNCA emite suggested_posters redundante', async () => {
      const client = getGeminiClient();

      client.models.generateContentStream = async function* () {
        yield {
          functionCalls: [
            {
              name: 'checkInventoryStock',
              args: { query: 'Spider-Man', sizeId: 'MEDIANO' },
            },
          ],
        };
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Tienes de Spiderman en mediano para llevar ya?',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const inventoryEvents = emitted.filter(e => e.type === 'inventory_stock');
      const posterEvents = emitted.filter(e => e.type === 'suggested_posters');

      assert.strictEqual(inventoryEvents.length, 1, 'Debe emitir exactamente 1 evento inventory_stock');
      assert.strictEqual(posterEvents.length, 0, 'R5 INFRANGIBLE: checkInventoryStock NO debe emitir suggested_posters redundante');
    });

    it('2.2 checkInventoryStock ante obra inexistente emite inventory_stock (found:false) y CERO suggested_posters', async () => {
      const client = getGeminiClient();

      client.models.generateContentStream = async function* () {
        yield {
          functionCalls: [
            {
              name: 'checkInventoryStock',
              args: { query: 'ObraTotalmenteInexistenteXYZ999', sizeId: 'MEDIANO' },
            },
          ],
        };
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Tienes póster de ObraTotalmenteInexistenteXYZ999?',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const inventoryEvents = emitted.filter(e => e.type === 'inventory_stock');
      const posterEvents = emitted.filter(e => e.type === 'suggested_posters');

      assert.strictEqual(inventoryEvents.length, 1);
      assert.strictEqual(inventoryEvents[0].data.found, false);
      assert.strictEqual(posterEvents.length, 0, 'No debe haber suggested_posters para obra no encontrada');
    });

  });

  // =========================================================================
  // 3. CONTRATO @google/genai: PAYLOAD DEL SEGUNDO TURNO ({ role: 'tool', parts: [{ functionResponse }] })
  // =========================================================================
  describe('3. Verificación de Contrato Oficial @google/genai para Closed-Loop Payload', () => {

    it('3.1 streamClosedLoopFollowUp construye exactamente el payload { role: "model", parts: [functionCall] } seguido de { role: "tool", parts: [functionResponse] }', async () => {
      let interceptedContents = null;

      const dummyClient = {
        models: {
          generateContentStream: async function* ({ contents }) {
            interceptedContents = contents;
            yield { text: 'Confirmado.' };
          },
        },
      };

      const executedTools = [
        {
          name: 'prepareSaleDraft',
          args: { items: [{ productName: 'Spider-Man', quantity: 1 }], paymentMethod: 'EFECTIVO' },
          result: { total: 65, items: [{ description: 'Spider-Man', quantity: 1, unitPrice: 65 }] },
        },
      ];

      const initialHistory = [
        { role: 'user', parts: [{ text: '1 póster de Spider-Man' }] },
      ];

      const generator = streamClosedLoopFollowUp({
        executedTools,
        formattedContents: initialHistory,
        systemInstruction: 'Eres STAND IA',
        client: dummyClient,
        trailingTextTokens: 0,
      });

      const chunks = [];
      for await (const c of generator) chunks.push(c);

      assert.ok(interceptedContents, 'Debe haber invocado el modelo con contents');
      assert.strictEqual(interceptedContents.length, 3, 'contents debe tener 3 elementos: [user, model, tool]');

      // Turno 0: Usuario original
      assert.strictEqual(interceptedContents[0].role, 'user');
      assert.deepStrictEqual(interceptedContents[0].parts, [{ text: '1 póster de Spider-Man' }]);

      // Turno 1: Turno sintético del modelo con functionCall
      assert.strictEqual(interceptedContents[1].role, 'model');
      assert.ok(Array.isArray(interceptedContents[1].parts));
      assert.strictEqual(interceptedContents[1].parts.length, 1);
      assert.strictEqual(interceptedContents[1].parts[0].functionCall.name, 'prepareSaleDraft');
      assert.deepStrictEqual(interceptedContents[1].parts[0].functionCall.args, {
        items: [{ productName: 'Spider-Man', quantity: 1 }],
        paymentMethod: 'EFECTIVO',
      });

      // Turno 2: Turno de herramienta con functionResponse según especificación @google/genai
      assert.strictEqual(interceptedContents[2].role, 'tool', 'El role DEBE ser estrictamente "tool"');
      assert.ok(Array.isArray(interceptedContents[2].parts));
      assert.strictEqual(interceptedContents[2].parts.length, 1);
      assert.ok(interceptedContents[2].parts[0].functionResponse, 'parts[0] DEBE contener el objeto functionResponse');
      assert.strictEqual(interceptedContents[2].parts[0].functionResponse.name, 'prepareSaleDraft');
      assert.deepStrictEqual(interceptedContents[2].parts[0].functionResponse.response, {
        total: 65,
        items: [{ description: 'Spider-Man', quantity: 1, unitPrice: 65 }],
      });
    });

    it('3.2 Soporta múltiples tools ejecutadas en el mismo turno en modelParts y toolParts', async () => {
      let interceptedContents = null;

      const dummyClient = {
        models: {
          generateContentStream: async function* ({ contents }) {
            interceptedContents = contents;
            yield { text: 'Informe y stock listos.' };
          },
        },
      };

      const executedTools = [
        {
          name: 'checkInventoryStock',
          args: { query: 'Spider-Man', sizeId: 'MEDIANO' },
          result: { found: true, stockAvailability: { standPhysicalStock: 'DISPONIBLE_MOSTRADOR' } },
        },
        {
          name: 'getEventKPIs',
          args: { eventId: 'adversarial-event-1' },
          result: { totalAmount: 1500, totalTransactions: 10 },
        },
      ];

      const initialHistory = [
        { role: 'user', parts: [{ text: 'Verifica stock de Spiderman y cómo van las ventas' }] },
      ];

      const generator = streamClosedLoopFollowUp({
        executedTools,
        formattedContents: initialHistory,
        systemInstruction: 'Eres STAND IA',
        client: dummyClient,
        trailingTextTokens: 0,
      });

      for await (const _ of generator) {}

      assert.ok(interceptedContents);
      const modelTurn = interceptedContents[1];
      const toolTurn = interceptedContents[2];

      assert.strictEqual(modelTurn.role, 'model');
      assert.strictEqual(modelTurn.parts.length, 2, 'Debe agrupar las 2 llamadas en parts');
      assert.strictEqual(modelTurn.parts[0].functionCall.name, 'checkInventoryStock');
      assert.strictEqual(modelTurn.parts[1].functionCall.name, 'getEventKPIs');

      assert.strictEqual(toolTurn.role, 'tool');
      assert.strictEqual(toolTurn.parts.length, 2, 'Debe agrupar las 2 respuestas en parts');
      assert.strictEqual(toolTurn.parts[0].functionResponse.name, 'checkInventoryStock');
      assert.strictEqual(toolTurn.parts[1].functionResponse.name, 'getEventKPIs');
    });

    it('3.3 Si el resultado de la tool es primitivo o no-objeto, lo normaliza a { result: val }', async () => {
      let interceptedContents = null;
      const dummyClient = {
        models: {
          generateContentStream: async function* ({ contents }) {
            interceptedContents = contents;
            yield { text: 'Ok.' };
          },
        },
      };

      const generator = streamClosedLoopFollowUp({
        executedTools: [{ name: 'customPrimitiveTool', args: {}, result: 'OK_SUCCESS' }],
        formattedContents: [{ role: 'user', parts: [{ text: 'hola' }] }],
        systemInstruction: '',
        client: dummyClient,
        trailingTextTokens: 0,
      });

      for await (const _ of generator) {}

      const toolPart = interceptedContents[2].parts[0];
      assert.deepStrictEqual(toolPart.functionResponse.response, { result: 'OK_SUCCESS' });
    });

  });

  // =========================================================================
  // 4. RESILIENCIA ANTE TIMEOUTS, ERRORES Y HERRAMIENTAS DESCONOCIDAS
  // =========================================================================
  describe('4. Resiliencia ante Fallos de Red, Timeouts y Herramientas Desconocidas', () => {

    it('4.1 Interrupción mid-stream en el follow-up no rompe el SSE y emite mensaje cordial', async () => {
      const client = getGeminiClient();

      let streamCallCount = 0;
      client.models.generateContentStream = async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          yield {
            functionCalls: [
              {
                name: 'prepareSaleDraft',
                args: {
                  items: [{ productName: 'Un Verano Sin Ti', quantity: 1, size: 'PORTADA_ALBUM', unitPrice: 55 }],
                  paymentMethod: 'TARJETA',
                },
              },
            ],
          };
        } else {
          // El segundo turno de Gemini colapsa (ej. rate limit 429 / ECONNRESET / timeout mid-stream)
          throw new Error('Gemini quota exceeded 429: Resource has been exhausted');
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '1 portada de album un verano sin ti con tarjeta',
        tenantId: 'adversarial-tenant',
        eventId: 'adversarial-event-1',
      });

      const emitted = [];
      let thrownError = null;
      try {
        for await (const chunk of stream) {
          emitted.push(chunk);
        }
      } catch (err) {
        thrownError = err;
      }

      assert.strictEqual(thrownError, null, 'El stream SSE NO debe lanzar excepción no manejada');
      assert.strictEqual(emitted[0].type, 'draft_sale', 'Debe haber emitido el borrador antes de que fallara Gemini');

      // Resiliencia: Al interrumpirse Gemini, streamWithModelFallback emite token de cierre cordial
      const fallbackTokens = emitted.filter(e => e.type === 'token');
      assert.ok(fallbackTokens.length >= 1, 'Debe haber emitido al menos un token de cierre de contingencia');
    });

    it('4.1b streamClosedLoopFollowUp ante 0 tokens emitidos por Gemini emite buildFallbackSummaries con total e items', async () => {
      const dummyClient = {
        models: {
          generateContentStream: async function* () {
            // Generador que no emite tokens (retorna vacío)
          },
        },
      };

      const executedTools = [
        {
          name: 'prepareSaleDraft',
          args: { items: [{ productName: 'Spider-Man', quantity: 2, unitPrice: 65, size: 'MEDIANO' }] },
          result: {
            total: 130,
            paymentMethod: 'TARJETA',
            items: [{ description: 'Spider-Man', quantity: 2, unitPrice: 65, sizeId: 'MEDIANO' }],
          },
        },
      ];

      const generator = streamClosedLoopFollowUp({
        executedTools,
        formattedContents: [{ role: 'user', parts: [{ text: '2 spiderman' }] }],
        systemInstruction: '',
        client: dummyClient,
        trailingTextTokens: 0,
      });

      const emitted = [];
      for await (const c of generator) emitted.push(c);

      assert.ok(emitted.length >= 1, 'Debe emitir fallback summary cuando Gemini emite 0 tokens');
      const text = emitted.map(e => e.text).join(' ');
      assert.ok(text.includes('Q 130.00'), 'Debe incluir el total en el fallback summary');
      assert.ok(text.includes('TARJETA'), 'Debe incluir el método de pago en el fallback summary');
    });

    it('4.2 Herramienta no reconocida ("searchProducts" / desconocida) no colapsa executeToolCall', async () => {
      const res = await executeToolCall(
        { name: 'searchProducts', args: { query: 'pósters vintage' } },
        { tenantId: 'adversarial-tenant', eventId: 'adversarial-event-1' }
      );

      assert.deepStrictEqual(res, { event: null, toolRecord: null }, 'Herramienta desconocida debe retornar null sin lanzar');
    });

    it('4.3 Tool que lanza excepción interna (ej. error crítico) es capturada limpiamente', async () => {
      // Simular falla catastrófica en Prisma durante executeGetCashDrawerStatus
      if (prisma.salePayment) {
        prisma.salePayment.groupBy = async () => {
          throw new Error('Postgres connection terminated unexpectedly');
        };
      }

      const res = await executeToolCall(
        { name: 'getCashDrawerStatus', args: { eventId: 'adversarial-event-1' } },
        { tenantId: 'adversarial-tenant', eventId: 'adversarial-event-1' }
      );

      // executeGetCashDrawerStatus maneja internamente la falla o executeToolCall la atrapa
      assert.ok(res !== undefined, 'No debe colapsar el proceso');
    });

    it('4.4 Si Gemini ya emitió trailing text tokens en el turno 1, NO duplica el follow-up stream', async () => {
      let secondTurnCalled = false;
      const dummyClient = {
        models: {
          generateContentStream: async function* () {
            secondTurnCalled = true;
            yield { text: 'Texto redundante' };
          },
        },
      };

      const generator = streamClosedLoopFollowUp({
        executedTools: [{ name: 'prepareSaleDraft', args: {}, result: { total: 50 } }],
        formattedContents: [],
        systemInstruction: '',
        client: dummyClient,
        trailingTextTokens: 5, // Ya se emitieron 5 tokens tras la herramienta
      });

      const emitted = [];
      for await (const c of generator) emitted.push(c);

      assert.strictEqual(secondTurnCalled, false, 'No debe llamar al segundo turno si ya hubo trailing text tokens');
      assert.strictEqual(emitted.length, 0, 'No debe emitir tokens adicionales');
    });

  });

});
