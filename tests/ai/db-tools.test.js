import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '@google/genai';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import {
  salesAssistantTools,
  getEventKPIsDeclaration,
  getCashDrawerStatusDeclaration,
  getSellerShiftReportDeclaration,
  getProductionQueueStatusDeclaration,
  checkInventoryStockDeclaration,
  executeGetCashDrawerStatus,
  executeGetSellerShiftReport,
  executeGetProductionQueueStatus,
  executeCheckInventoryStock,
  streamChatWithSalesAssistant,
} from '../../server/services/aiMultimodalService.js';

describe('🤖 Suite de Herramientas de Base de Datos y Operaciones para STAND {IA} (M3)', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-gemini-key-for-m3-db-tools';
  });

  describe('1. Validación de Schemas y Declaraciones con @google/genai (Type Object)', () => {
    it('1.1 getEventKPIsDeclaration define schema con Type.OBJECT y parámetros opcionales eventId y date', () => {
      assert.strictEqual(getEventKPIsDeclaration.name, 'getEventKPIs');
      assert.ok(getEventKPIsDeclaration.description.includes('métricas'));
      assert.strictEqual(getEventKPIsDeclaration.parameters.type, Type.OBJECT);
      assert.ok(getEventKPIsDeclaration.parameters.properties.eventId);
      assert.ok(getEventKPIsDeclaration.parameters.properties.date);
      assert.ok(!getEventKPIsDeclaration.parameters.required || getEventKPIsDeclaration.parameters.required.length === 0, 'eventId debe ser opcional para permitir resolución por contexto');
    });

    it('1.2 getCashDrawerStatusDeclaration define schema con Type.OBJECT y parámetro eventId', () => {
      assert.strictEqual(getCashDrawerStatusDeclaration.name, 'getCashDrawerStatus');
      assert.ok(getCashDrawerStatusDeclaration.description.includes('efectivo en gaveta'));
      assert.strictEqual(getCashDrawerStatusDeclaration.parameters.type, Type.OBJECT);
      assert.ok(getCashDrawerStatusDeclaration.parameters.properties.eventId);
      assert.strictEqual(getCashDrawerStatusDeclaration.parameters.properties.eventId.type, Type.STRING);
    });

    it('1.3 getSellerShiftReportDeclaration define schema con Type.OBJECT y parámetros eventId y sellerId', () => {
      assert.strictEqual(getSellerShiftReportDeclaration.name, 'getSellerShiftReport');
      assert.ok(getSellerShiftReportDeclaration.description.includes('ranking y métricas de ventas por vendedor'));
      assert.strictEqual(getSellerShiftReportDeclaration.parameters.type, Type.OBJECT);
      assert.ok(getSellerShiftReportDeclaration.parameters.properties.eventId);
      assert.ok(getSellerShiftReportDeclaration.parameters.properties.sellerId);
      assert.strictEqual(getSellerShiftReportDeclaration.parameters.properties.sellerId.type, Type.STRING);
    });

    it('1.4 getProductionQueueStatusDeclaration define schema con Type.OBJECT y parámetro eventId', () => {
      assert.strictEqual(getProductionQueueStatusDeclaration.name, 'getProductionQueueStatus');
      assert.ok(getProductionQueueStatusDeclaration.description.includes('cola de impresión y producción'));
      assert.strictEqual(getProductionQueueStatusDeclaration.parameters.type, Type.OBJECT);
      assert.ok(getProductionQueueStatusDeclaration.parameters.properties.eventId);
      assert.strictEqual(getProductionQueueStatusDeclaration.parameters.properties.eventId.type, Type.STRING);
    });

    it('1.5 checkInventoryStockDeclaration define schema con Type.OBJECT, query requerido y sizeId opcional', () => {
      assert.strictEqual(checkInventoryStockDeclaration.name, 'checkInventoryStock');
      assert.ok(checkInventoryStockDeclaration.description.includes('existencias y disponibilidad física'));
      assert.strictEqual(checkInventoryStockDeclaration.parameters.type, Type.OBJECT);
      assert.ok(checkInventoryStockDeclaration.parameters.properties.query);
      assert.ok(checkInventoryStockDeclaration.parameters.properties.sizeId);
      assert.deepStrictEqual(checkInventoryStockDeclaration.parameters.required, ['query']);
    });

    it('1.6 salesAssistantTools incluye las 7 herramientas oficiales del asistente', () => {
      assert.ok(Array.isArray(salesAssistantTools));
      const decls = salesAssistantTools[0].functionDeclarations;
      assert.strictEqual(decls.length, 7);
      const names = decls.map(d => d.name);
      assert.ok(names.includes('prepareSaleDraft'));
      assert.ok(names.includes('searchCatalog'));
      assert.ok(names.includes('getEventKPIs'));
      assert.ok(names.includes('getCashDrawerStatus'));
      assert.ok(names.includes('getSellerShiftReport'));
      assert.ok(names.includes('getProductionQueueStatus'));
      assert.ok(names.includes('checkInventoryStock'));
    });
  });

  describe('2. Verificación de Funciones Ejecutoras y Resiliencia Multitenant', () => {
    it('2.1 executeGetCashDrawerStatus retorna estructura completa aún sin BD o con evento no encontrado', async () => {
      const res = await executeGetCashDrawerStatus('tenant-test', 'event-nonexistent');
      assert.ok(res !== null && typeof res === 'object');
      assert.strictEqual(res.currency, 'GTQ');
      assert.strictEqual(res.currencySymbol, 'Q');
      assert.ok(typeof res.currentCashInDrawer === 'number');
      assert.ok(typeof res.totalSalesInCash === 'number');
      assert.ok(typeof res.totalCardInSales === 'number');
      assert.ok(typeof res.totalTransferInSales === 'number');
      assert.ok(typeof res.summaryText === 'string');
    });

    it('2.2 executeGetSellerShiftReport retorna estructura completa de ranking y soporte para sellerId', async () => {
      const resAll = await executeGetSellerShiftReport('tenant-test', 'event-nonexistent');
      assert.ok(resAll !== null && typeof resAll === 'object');
      assert.ok(Array.isArray(resAll.ranking));
      assert.ok(typeof resAll.eventTotalRevenue === 'number');
      assert.ok(typeof resAll.summaryText === 'string');

      const resSingle = await executeGetSellerShiftReport('tenant-test', 'event-nonexistent', 'user-123');
      assert.ok(resSingle !== null && typeof resSingle === 'object');
      assert.ok(resSingle.seller !== undefined);
    });

    it('2.3 executeGetProductionQueueStatus retorna estados de cola, conteos y métricas de espera', async () => {
      const res = await executeGetProductionQueueStatus('tenant-test', 'event-nonexistent');
      assert.ok(res !== null && typeof res === 'object');
      assert.ok(['OPTIMO', 'MODERADO', 'SATURADO', 'CRITICO'].includes(res.health));
      assert.ok(res.counts !== undefined);
      assert.ok(typeof res.counts.pending === 'number');
      assert.ok(typeof res.counts.separated === 'number');
      assert.ok(typeof res.counts.inProduction === 'number');
      assert.ok(typeof res.counts.printed === 'number');
      assert.ok(typeof res.counts.activeQueueCount === 'number');
      assert.ok(res.timing !== undefined);
      assert.ok(typeof res.timing.averageQueueWaitMinutes === 'number');
      assert.ok(Array.isArray(res.stalledJobs));
      assert.ok(typeof res.summary === 'string');
    });

    it('2.4 executeCheckInventoryStock resuelve alias culturales, catálogo y calcula modalidad de entrega', async () => {
      // 1. Consulta vacía
      const resEmpty = await executeCheckInventoryStock('tenant-test', '');
      assert.strictEqual(resEmpty.found, false);

      // 2. Consulta de obra icónica: Spider-Man en 18x24
      const resSpiderman = await executeCheckInventoryStock('tenant-test', 'Spider-Man', '18x24');
      assert.strictEqual(resSpiderman.found, true);
      assert.ok(resSpiderman.artwork.title.toLowerCase().includes('spider'));
      assert.strictEqual(resSpiderman.requestedSize.sizeId, 'GRANDE');
      assert.strictEqual(resSpiderman.requestedSize.precio, 125);
      assert.strictEqual(resSpiderman.stockAvailability.standPhysicalStock, 'PRODUCCION_TALLER');
      assert.strictEqual(resSpiderman.stockAvailability.estimatedWaitMinutes, 12);

      // 3. Consulta de música: Bad Bunny (Un Verano Sin Ti)
      const resMusica = await executeCheckInventoryStock('tenant-test', 'un verano sin ti', 'portada');
      assert.strictEqual(resMusica.found, true);
      assert.strictEqual(resMusica.requestedSize.sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(resMusica.requestedSize.precio, 55);
      assert.strictEqual(resMusica.stockAvailability.standPhysicalStock, 'DISPONIBLE_MOSTRADOR');
      assert.strictEqual(resMusica.stockAvailability.estimatedWaitMinutes, 0);
    });
  });

  describe('3. Verificación de Emisión de Eventos SSE en streamChatWithSalesAssistant', () => {
    it('3.1 Emite evento event_kpis cuando Gemini invoca getEventKPIs', async () => {
      const client = getGeminiClient();
      assert.ok(client);

      const fakeChunks = [
        { text: 'Consultando métricas en vivo...' },
        { functionCalls: [{ name: 'getEventKPIs', args: { eventId: 'test-event-id' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Cómo van las ventas hoy?',
        tenantId: 'test-tenant',
        eventId: 'test-event-id',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const kpisEvents = emitted.filter(e => e.type === 'event_kpis');
      assert.strictEqual(kpisEvents.length, 1, 'Debe emitir 1 evento event_kpis');
      assert.ok(kpisEvents[0].data !== undefined);
      assert.ok(emitted.some(e => e.type === 'token'), 'Debe emitir síntesis conversacional en tokens');
    });

    it('3.2 Emite evento cash_drawer_status cuando Gemini invoca getCashDrawerStatus', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        { text: 'Verificando gaveta...' },
        { functionCalls: [{ name: 'getCashDrawerStatus', args: { eventId: 'test-event-id' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Cuánto dinero hay en la gaveta?',
        tenantId: 'test-tenant',
        eventId: 'test-event-id',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const cashEvents = emitted.filter(e => e.type === 'cash_drawer_status');
      assert.strictEqual(cashEvents.length, 1, 'Debe emitir 1 evento cash_drawer_status');
      assert.ok(cashEvents[0].data.currentCashInDrawer !== undefined);
      assert.ok(emitted.some(e => e.type === 'token'), 'Debe emitir texto resumen del estado de caja');
    });

    it('3.3 Emite evento seller_shift_report cuando Gemini invoca getSellerShiftReport', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        { text: 'Calculando desempeño...' },
        { functionCalls: [{ name: 'getSellerShiftReport', args: { eventId: 'test-event-id' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Quién va ganando en ventas hoy?',
        tenantId: 'test-tenant',
        eventId: 'test-event-id',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const reportEvents = emitted.filter(e => e.type === 'seller_shift_report');
      assert.strictEqual(reportEvents.length, 1, 'Debe emitir 1 evento seller_shift_report');
      assert.ok(Array.isArray(reportEvents[0].data.ranking));
    });

    it('3.4 Emite evento production_queue_status cuando Gemini invoca getProductionQueueStatus', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        { text: 'Revisando taller de impresión...' },
        { functionCalls: [{ name: 'getProductionQueueStatus', args: { eventId: 'test-event-id' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Cómo está la cola de impresión en el taller?',
        tenantId: 'test-tenant',
        eventId: 'test-event-id',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const queueEvents = emitted.filter(e => e.type === 'production_queue_status');
      assert.strictEqual(queueEvents.length, 1, 'Debe emitir 1 evento production_queue_status');
      assert.ok(queueEvents[0].data.counts !== undefined);
      assert.ok(emitted.some(e => e.type === 'token'), 'Debe emitir resumen del taller en tokens');
    });

    it('3.5 Emite evento inventory_stock y suggested_posters cuando Gemini invoca checkInventoryStock', async () => {
      const client = getGeminiClient();

      const fakeChunks = [
        { text: 'Verificando existencia en catálogo y mostrador...' },
        { functionCalls: [{ name: 'checkInventoryStock', args: { query: 'Spider-Man', sizeId: 'MEDIANO' } }] },
      ];

      client.models.generateContentStream = async function* () {
        for (const chunk of fakeChunks) {
          yield chunk;
        }
      };

      const stream = streamChatWithSalesAssistant({
        message: '¿Tienes de Spiderman en mediano para llevar ya?',
        tenantId: 'test-tenant',
        eventId: 'test-event-id',
      });

      const emitted = [];
      for await (const chunk of stream) {
        emitted.push(chunk);
      }

      const stockEvents = emitted.filter(e => e.type === 'inventory_stock');
      assert.strictEqual(stockEvents.length, 1, 'Debe emitir 1 evento inventory_stock');
      assert.strictEqual(stockEvents[0].data.found, true);
      const postersEvents = emitted.filter(e => e.type === 'suggested_posters');
      assert.strictEqual(postersEvents.length, 0, 'No debe emitir suggested_posters redundantes para checkInventoryStock (R5)');
    });

  });
});
