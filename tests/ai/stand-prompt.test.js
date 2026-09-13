import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSalesSystemPrompt,
  chatWithSalesAssistant,
  streamChatWithSalesAssistant,
} from '../../server/services/aiMultimodalService.js';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';

describe('🧠 Suite de Pruebas: STAND {IA} Commercial Prompt Engineering (M4)', () => {
  let origPrisma = {};

  beforeEach(() => {
    origPrisma = {
      eventFindUnique: prisma.event?.findUnique,
      saleAggregate: prisma.sale?.aggregate,
      saleFindMany: prisma.sale?.findMany,
      saleItemAggregate: prisma.saleItem?.aggregate,
      saleItemGroupBy: prisma.saleItem?.groupBy,
      salePaymentGroupBy: prisma.salePayment?.groupBy,
    };
    if (prisma.event) {
      prisma.event.findUnique = async () => ({
        id: 'test-event',
        name: 'Comic-Con Guatemala 2026',
        location: 'Fórum Majadas',
        salesTarget: 25000,
      });
    }
    if (prisma.sale) {
      prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
      prisma.sale.findMany = async () => [];
    }
    if (prisma.saleItem) {
      prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 }, _count: { id: 0 } });
      prisma.saleItem.groupBy = async () => [];
    }
    if (prisma.salePayment) {
      prisma.salePayment.groupBy = async () => [];
    }
  });

  afterEach(() => {
    if (prisma.event && origPrisma.eventFindUnique) prisma.event.findUnique = origPrisma.eventFindUnique;
    if (prisma.sale && origPrisma.saleAggregate) prisma.sale.aggregate = origPrisma.saleAggregate;
    if (prisma.sale && origPrisma.saleFindMany) prisma.sale.findMany = origPrisma.saleFindMany;
    if (prisma.saleItem && origPrisma.saleItemAggregate) prisma.saleItem.aggregate = origPrisma.saleItemAggregate;
    if (prisma.saleItem && origPrisma.saleItemGroupBy) prisma.saleItem.groupBy = origPrisma.saleItemGroupBy;
    if (prisma.salePayment && origPrisma.salePaymentGroupBy) prisma.salePayment.groupBy = origPrisma.salePaymentGroupBy;
  });

  describe('1. Estructura, Tono y Directivas Comerciales de buildSalesSystemPrompt', () => {
    it('1.1 Personalidad STAND {IA} y Trato Exclusivo de "Tú" (Cero "Usted" / "Su revisión")', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Comic-Con Guatemala 2026', location: 'Fórum Majadas' },
        resolvedContextData: { evento: 'Comic-Con Guatemala 2026' },
      });

      assert.ok(prompt.includes('STAND {IA}'), 'Debe definir la identidad oficial de STAND {IA}');
      assert.ok(!prompt.includes('J.A.R.V.I.S.'), 'Debe tener cero menciones de J.A.R.V.I.S.');
      assert.ok(prompt.includes('Curador de Arte Pop') || prompt.includes('Asistente Estrella de Ventas'), 'Debe identificarse como curador y consultor comercial');
      assert.ok(prompt.includes('TRATO EXCLUSIVO DE "TÚ"'), 'Debe fijar la directiva taxativa de tú');
      assert.ok(prompt.includes('PROHIBIDO terminantemente usar "usted"'), 'Debe prohibir expresamente usted');
      assert.ok(prompt.includes('"su revisión"'), 'Debe erradicar la fórmula "su revisión"');
      assert.ok(prompt.includes('Comic-Con Guatemala 2026'), 'Debe inyectar el nombre del evento');
      assert.ok(prompt.includes('Fórum Majadas'), 'Debe inyectar la ubicación del stand');
    });

    it('1.2 Política Estricta de Precios Fijos y Formatos de Obra', () => {
      const prompt = buildSalesSystemPrompt({});

      // Precios Fijos
      assert.ok(prompt.includes('PRECIOS 100% FIJOS'), 'Debe incluir política de precios 100% fijos');
      assert.ok(prompt.includes('CERO COMBOS'), 'Debe prohibir terminantemente los combos');
      assert.ok(prompt.includes('Q130 (2 × Q65)'), 'Debe especificar que 2 medianos son Q130');
      assert.ok(prompt.includes('Q195 (3 × Q65)'), 'Debe especificar que 3 medianos son Q195');

      // Portada de Álbum
      assert.ok(prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)'), 'Debe incluir portada de álbum Q55');
      assert.ok(prompt.includes('Q55.00'), 'Debe especificar precio exacto de Q55.00');
      assert.ok(prompt.includes('vinilo'), 'Debe conectar con formato vinilo exclusivo para música');

      // Variedad de tamaños
      assert.ok(prompt.includes('VARIEDAD'), 'Debe instruir variedad de tamaños');
      assert.ok(prompt.includes('Cero obsesión con el Mediano'), 'Debe prohibir la obsesión con el Mediano');
    });

    it('1.3 Catálogo Completo de Medidas Canónicas y Mapeo de Precios', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(prompt.includes('Mini (Q25.00)'), 'Debe incluir Mini Q25');
      assert.ok(prompt.includes('Pequeño (Q35.00)'), 'Debe incluir Pequeño Q35');
      assert.ok(prompt.includes('Portada de Álbum (Q55.00)'), 'Debe incluir Portada de Álbum Q55');
      assert.ok(prompt.includes('Mediano (Q65.00)'), 'Debe incluir Mediano Q65');
      assert.ok(prompt.includes('Grande (Q125.00)'), 'Debe incluir Grande Q125');
      assert.ok(prompt.includes('Gigante (Q180.00)'), 'Debe incluir Gigante Q180');

      // Reglas de mapeo
      assert.ok(prompt.includes('18x24') && prompt.includes('GRANDE'));
      assert.ok(prompt.includes('24x36') && prompt.includes('GIGANTE'));
    });

    it('1.4 Protocolo de las 7 Herramientas Oficiales (@google/genai)', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(prompt.includes('prepareSaleDraft'));
      assert.ok(prompt.includes('searchCatalog'));
      assert.ok(prompt.includes('checkInventoryStock'));
      assert.ok(prompt.includes('getEventKPIs'));
      assert.ok(prompt.includes('getCashDrawerStatus'));
      assert.ok(prompt.includes('getSellerShiftReport'));
      assert.ok(prompt.includes('getProductionQueueStatus'));
    });

    it('1.5 Inyección y Directivas de Borrador Activo (pendingDraft)', () => {
      const mockDraft = {
        items: [
          { baseTitle: 'Spider-Man 2099', sizeId: 'MEDIANO', quantity: 1, unitPrice: 65, subtotal: 65 },
          { baseTitle: 'Taylor Swift Eras', sizeId: 'PORTADA_ALBUM', quantity: 2, unitPrice: 55, subtotal: 110 },
        ],
        total: 175,
        paymentMethod: 'EFECTIVO',
        notes: 'Cliente con prisa',
      };

      const promptWithDraft = buildSalesSystemPrompt({ pendingDraft: mockDraft });

      assert.ok(promptWithDraft.includes('BORRADOR ACTIVO EN PANTALLA'));
      assert.ok(promptWithDraft.includes('Spider-Man 2099'));
      assert.ok(promptWithDraft.includes('Taylor Swift Eras'));
      assert.ok(promptWithDraft.includes('175'));
      assert.ok(promptWithDraft.includes('Preserva todos los ítems actuales a menos que pidan removerlos'));
    });

    it('1.6 Inyección de Métricas Operativas de PostgreSQL (resolvedContextData)', () => {
      const mockContext = {
        evento: 'Anime Expo 2026',
        ubicacion: 'Parque de la Industria',
        totalVendido: 'Q 15,450.00',
        transaccionesTotales: 142,
        unidadesVendidas: 215,
      };

      const prompt = buildSalesSystemPrompt({ resolvedContextData: mockContext });

      assert.ok(prompt.includes('DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL)'));
      assert.ok(prompt.includes('Anime Expo 2026'));
      assert.ok(prompt.includes('Q 15,450.00'));
      assert.ok(prompt.includes('142'));
    });

    it('1.7 Prohibición Estricta de Combos y Descuentos Automáticos (Precios Fijos)', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(prompt.includes('PRECIOS 100% FIJOS'), 'Debe exigir precios 100% fijos');
      assert.ok(prompt.includes('PROHIBIDO 2x Q120, 3x Q180'), 'Debe prohibir expresamente 2x Q120 y 3x Q180');
      assert.ok(prompt.includes('Q130 (2 × Q65)'), 'Debe confirmar que 2 medianos son Q130');
      assert.ok(prompt.includes('Q195 (3 × Q65)'), 'Debe confirmar que 3 medianos son Q195');
    });
  });

  describe('2. Inyección Estricta en config.systemInstruction en SDK @google/genai', () => {
    it('2.1 chatWithSalesAssistant inyecta systemPrompt en config.systemInstruction y no en formattedContents', async () => {
      let capturedConfig = null;
      let capturedContents = null;

      const mockClient = {
        models: {
          generateContent: async ({ contents, config }) => {
            capturedContents = contents;
            capturedConfig = config;
            return {
              text: '¡Por supuesto! Con gusto te muestro las opciones.',
              functionCalls: [],
            };
          },
        },
      };

      const result = await chatWithSalesAssistant({
        message: 'Hola, ¿qué pósters de Batman tienes?',
        history: [{ role: 'user', text: 'Buenas tardes' }, { role: 'model', text: '¡Hola!' }],
        tenantId: 'test-tenant',
        eventId: 'test-event',
        geminiClient: mockClient,
      });

      assert.ok(result);
      assert.ok(capturedConfig, 'config debe haberse pasado al SDK');
      assert.ok(capturedConfig.systemInstruction, 'config.systemInstruction debe contener la instrucción');
      assert.ok(capturedConfig.systemInstruction.includes('STAND {IA}'), 'systemInstruction debe ser el prompt STAND {IA}');
      assert.ok(!capturedConfig.systemInstruction.includes('J.A.R.V.I.S.'), 'systemInstruction no debe contener J.A.R.V.I.S.');
      assert.ok(capturedConfig.systemInstruction.includes('Mediano (Q65.00)'));

      assert.ok(Array.isArray(capturedContents));
      const firstMsg = capturedContents[0];
      assert.notStrictEqual(
        firstMsg.parts?.[0]?.text,
        capturedConfig.systemInstruction,
        'El primer mensaje de contents NO debe ser el systemInstruction'
      );
    });

    it('2.2 streamChatWithSalesAssistant inyecta systemInstruction en config y limpia formattedContents', async () => {
      let capturedStreamConfig = null;
      let capturedStreamContents = null;

      async function* mockStreamGen() {
        yield { text: '¡Hola! ' };
        yield { text: 'Te recomiendo el Mediano en Q65.' };
      }

      const mockStreamClient = {
        models: {
          generateContentStream: async ({ contents, config }) => {
            capturedStreamContents = contents;
            capturedStreamConfig = config;
            return mockStreamGen();
          },
        },
      };

      const generator = streamChatWithSalesAssistant({
        message: 'Recomiéndame una medida',
        history: [{ role: 'user', text: 'Hola' }],
        tenantId: 'test-tenant',
        eventId: 'test-event',
        geminiClient: mockStreamClient,
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length > 0, 'Debe haber emitido chunks');
      assert.ok(chunks.some(c => c.type === 'token'), 'Debe emitir eventos de tipo token');
      assert.ok(capturedStreamConfig, 'config debe haberse pasado al stream');
      assert.ok(capturedStreamConfig.systemInstruction.includes('STAND {IA}'), 'Stream debe inyectar el prompt STAND {IA}');
      assert.ok(!capturedStreamConfig.systemInstruction.includes('J.A.R.V.I.S.'), 'Stream no debe contener J.A.R.V.I.S.');
      assert.ok(Array.isArray(capturedStreamContents));
      assert.notStrictEqual(
        capturedStreamContents[0]?.parts?.[0]?.text,
        capturedStreamConfig.systemInstruction,
        'formattedContents no debe contener el systemInstruction como rol user'
      );
    });
  });
});
