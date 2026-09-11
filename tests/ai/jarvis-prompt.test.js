import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSalesSystemPrompt,
  chatWithSalesAssistant,
  streamChatWithSalesAssistant,
} from '../../server/services/aiMultimodalService.js';
import { ENV } from '../../server/config/env.js';

describe('🧠 Suite de Pruebas: J.A.R.V.I.S. Prompt Engineering para STAND {IA} (M4)', () => {
  describe('1. Estructura, Tono y Directivas Comerciales de buildSalesSystemPrompt', () => {
    it('1.1 Personalidad J.A.R.V.I.S. y Trato Exclusivo de "Tú" (Cero "Usted" / "Su revisión")', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Comic-Con Guatemala 2026', location: 'Fórum Majadas' },
        resolvedContextData: { evento: 'Comic-Con Guatemala 2026' },
      });

      assert.ok(prompt.includes('J.A.R.V.I.S.'), 'Debe mencionar la inspiración en J.A.R.V.I.S.');
      assert.ok(prompt.includes('TRATO EXCLUSIVO DE "TÚ"'), 'Debe fijar la directiva taxativa de tú');
      assert.ok(prompt.includes('PROHIBIDO terminantemente usar "usted"'), 'Debe prohibir expresamente usted');
      assert.ok(prompt.includes('"su revisión"'), 'Debe erradicar la fórmula "su revisión"');
      assert.ok(prompt.includes('Comic-Con Guatemala 2026'), 'Debe inyectar el nombre del evento');
      assert.ok(prompt.includes('Fórum Majadas'), 'Debe inyectar la ubicación del stand');
    });

    it('1.2 Los 4 Pilares Comerciales y Directivas de Upselling Activo', () => {
      const prompt = buildSalesSystemPrompt({});

      // Pilar 1: Mediano Estrella Q65.00
      assert.ok(prompt.includes('MEDIANO (30x45 cm / 12x18 pulg a Q65.00)'), 'Debe incluir tamaño estrella mediano');
      assert.ok(prompt.includes('Q65.00'), 'Debe especificar el precio Q65.00 para Mediano');
      assert.ok(prompt.includes('más vendido'), 'Debe argumentar que es el más vendido');

      // Pilar 2: HP Látex >10 años
      assert.ok(prompt.includes('HP LÁTEX ECOLÓGICO'), 'Debe destacar tecnología HP Látex');
      assert.ok(prompt.includes('Durabilidad UV superior a 10 años'), 'Debe argumentar durabilidad UV >10 años');
      assert.ok(prompt.includes('sin decoloración'), 'Debe resaltar que no se decolora');

      // Pilar 3: Cinta tesa® 15 segundos
      assert.ok(prompt.includes('CINTA tesa® ORIGINAL EN 15 SEGUNDOS'), 'Debe incluir montaje con cinta tesa®');
      assert.ok(prompt.includes('15 segundos'), 'Debe indicar que se coloca en 15 segundos');
      assert.ok(prompt.includes('clavos') && prompt.includes('agujeros'), 'Debe resaltar sin clavos ni agujeros');

      // Pilar 4: Portada de Álbum Q55.00
      assert.ok(prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)'), 'Debe incluir portada de álbum Q55');
      assert.ok(prompt.includes('Q55.00'), 'Debe especificar precio exacto de Q55.00');
      assert.ok(prompt.includes('vinilo'), 'Debe conectar con formato vinilo para melómanos');
    });

    it('1.3 Catálogo Completo de Medidas Canónicas y Mapeo de Precios', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(prompt.includes('Mini (Q25.00)'), 'Debe incluir Mini Q25');
      assert.ok(prompt.includes('Pequeño (Q35.00)'), 'Debe incluir Pequeño Q35');
      assert.ok(prompt.includes('Portada de Álbum (Q55.00)'), 'Debe incluir Portada de Álbum Q55');
      assert.ok(prompt.includes('Mediano [OPCIÓN ESTRELLA] (Q65.00)'), 'Debe incluir Mediano Q65');
      assert.ok(prompt.includes('Grande (Q125.00)'), 'Debe incluir Grande Q125');
      assert.ok(prompt.includes('Gigante (Q180.00)'), 'Debe incluir Gigante Q180');

      // Reglas de mapeo
      assert.ok(prompt.includes('Si piden "18x24" o "45x60", asignar SIEMPRE tamaño "GRANDE" (Q125.00)'));
      assert.ok(prompt.includes('Si piden "24x36" o "60x90", asignar SIEMPRE tamaño "GIGANTE" (Q180.00)'));
      assert.ok(prompt.includes('Si no especifican tamaño al ordenar una venta general, asume por defecto "MEDIANO" (Q65.00)'));
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
      assert.ok(prompt.includes('CLARA INTENCIÓN DE COMPRA'), 'Debe ordenar detección proactiva de compra');
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
  });

  describe('2. Inyección Estricta en config.systemInstruction en SDK @google/genai', () => {
    it('2.1 chatWithSalesAssistant inyecta systemPrompt en config.systemInstruction y no en formattedContents', async () => {
      let capturedConfig = null;
      let capturedContents = null;

      // Mock gemini client to inspect generateContent call arguments
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

      // Run chat with mocked client
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
      assert.ok(capturedConfig.systemInstruction.includes('J.A.R.V.I.S.'), 'systemInstruction debe ser el prompt J.A.R.V.I.S.');
      assert.ok(capturedConfig.systemInstruction.includes('MEDIANO (30x45 cm / 12x18 pulg a Q65.00)'));

      // Verify formattedContents does NOT have systemInstruction injected as a user role
      assert.ok(Array.isArray(capturedContents));
      const firstMsg = capturedContents[0];
      assert.notStrictEqual(
        firstMsg.parts?.[0]?.text,
        capturedConfig.systemInstruction,
        'El primer mensaje de contents NO debe ser el systemInstruction (erradicación de falsos turnos user)'
      );
    });

    it('2.2 streamChatWithSalesAssistant inyecta systemInstruction en config y limpia formattedContents', async () => {
      let capturedStreamConfig = null;
      let capturedStreamContents = null;

      // Mock generateContentStream generator
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

      // We test through streamChatWithSalesAssistant with mock client
      const generator = streamChatWithSalesAssistant({
        message: 'Recomiéndame una medida',
        history: [{ role: 'user', text: 'Hola' }],
        tenantId: 'test-tenant',
        eventId: 'test-event',
        geminiClient: mockStreamClient,
      });

      // Verify the stream returns tokens smoothly
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length > 0, 'Debe haber emitido chunks');
      assert.ok(chunks.some(c => c.type === 'token'), 'Debe emitir eventos de tipo token');
      assert.ok(capturedStreamConfig, 'config debe haberse pasado al stream');
      assert.ok(capturedStreamConfig.systemInstruction.includes('J.A.R.V.I.S.'));
      assert.ok(Array.isArray(capturedStreamContents));
      assert.notStrictEqual(
        capturedStreamContents[0]?.parts?.[0]?.text,
        capturedStreamConfig.systemInstruction,
        'formattedContents no debe contener el systemInstruction como rol user'
      );
    });
  });
});
