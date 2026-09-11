import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSalesSystemPrompt,
  chatWithSalesAssistant,
  streamChatWithSalesAssistant,
  salesAssistantTools,
  prepareSaleDraftDeclaration,
} from '../../server/services/aiMultimodalService.js';
import {
  MODEL_PRIORITY_POOL,
  isRateLimitOrQuotaError,
  isServiceOverloadedError,
  isTransientNetworkError,
  isRetryableOnSameModel,
  shouldFallbackToNextModel,
  executeWithModelFallback,
  streamWithModelFallback,
} from '../../server/services/geminiPoolService.js';
import {
  PRICING,
  estimateCostUsd,
  recordLlmInteraction,
} from '../../server/services/llmObservabilityService.js';

describe('⚔️ CHALLENGER 2: Verificación Adversarial Empírica para Hito M4 (Prompt J.A.R.V.I.S. & Contingency Pool)', () => {

  // =========================================================================
  // SECCIÓN 1: AUDITORÍA FORENSE DE TONO Y ERRADICACIÓN DE FÓRMULAS CORPORATIVAS
  // =========================================================================
  describe('1. Verificación Rigurosa de Tono J.A.R.V.I.S. y Proscripción de Burocracia', () => {

    it('1.1. buildSalesSystemPrompt prohíbe taxativamente "usted", "su revisión" y fórmulas frías en múltiples contextos', () => {
      const contextsToTest = [
        {}, // vacío
        { event: null, resolvedContextData: null, pendingDraft: null },
        { event: { name: 'Comic-Con Guatemala 2026', location: 'Fórum Majadas' } },
        { resolvedContextData: { evento: 'Feria Pop 2026', totalVendido: 'Q 12,000.00' } },
        {
          pendingDraft: {
            items: [{ baseTitle: 'Spider-Man', quantity: 1, unitPrice: 65, sizeId: 'MEDIANO' }],
            total: 65,
          },
        },
      ];

      for (const ctx of contextsToTest) {
        const prompt = buildSalesSystemPrompt(ctx);

        // 1. Debe contener la regla prohibitiva explícita
        assert.ok(
          prompt.includes('PROHIBIDO terminantemente usar "usted"'),
          'Debe incluir la cláusula prohibitiva expresa de "usted"'
        );
        assert.ok(
          prompt.includes('"su revisión"'),
          'Debe incluir la prohibición de la frase "su revisión"'
        );
        assert.ok(
          prompt.includes('TRATO EXCLUSIVO DE "TÚ"'),
          'Debe fijar el trato exclusivo de "tú"'
        );

        // 2. Extraemos el texto fuera de la cláusula de prohibición para verificar que las instrucciones
        // no utilicen fórmulas de tercera persona dirigidas al interlocutor
        const linesWithoutProhibition = prompt
          .split('\n')
          .filter((line) => !line.includes('PROHIBIDO') && !line.includes('prohibid'))
          .join('\n');

        assert.ok(
          !/\ble asisto\b/i.test(linesWithoutProhibition),
          'No debe contener "le asisto" en las directivas activas'
        );
        assert.ok(
          !/\bsu persona\b/i.test(linesWithoutProhibition),
          'No debe contener "su persona" en las directivas activas'
        );
        assert.ok(
          !/\bestimado cliente\b/i.test(linesWithoutProhibition),
          'No debe contener fórmulas corporativas como "estimado cliente"'
        );
        assert.ok(
          !/\ba su entera disposici[oó]n\b/i.test(linesWithoutProhibition),
          'No debe contener clichés de servicio como "a su entera disposición"'
        );
      }
    });

    it('1.2. El prompt maestro modela personalidad cercana, cómplice y con entusiasmo cultural', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('J.A.R.V.I.S.'), 'Debe definir la personalidad J.A.R.V.I.S.');
      assert.ok(prompt.includes('PASIÓN CULTURAL AUTÉNTICA'), 'Debe exigir pasión cultural');
      assert.ok(prompt.includes('anime'), 'Debe incluir referencias de anime');
      assert.ok(prompt.includes('música'), 'Debe incluir referencias de música');
      assert.ok(prompt.includes('cómics'), 'Debe incluir referencias de cómics');
      assert.ok(prompt.includes('RITMO DE STAND DE EVENTO'), 'Debe calibrar el ritmo dinámico de mostrador');
    });
  });

  // =========================================================================
  // SECCIÓN 2: DESAFÍO ADVERSARIAL DE ORÁCULOS COMERCIALES Y UPSELLING
  // =========================================================================
  describe('2. Oráculos Comerciales y Directivas de Upselling Activo', () => {

    it('2.1. Pilar 1: Mediano Estrella Q65 (30x45 cm / 12x18 pulg) como producto más vendido', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('MEDIANO (30x45 cm / 12x18 pulg a Q65.00)'),
        'Debe enunciar Mediano 30x45 cm / 12x18 pulg a Q65.00'
      );
      assert.ok(
        prompt.includes('más popular y vendido de Deco Vintage') || prompt.includes('más vendido'),
        'Debe argumentar que es el más vendido'
      );
      assert.ok(
        prompt.includes('recomiéndale siempre el Mediano') || prompt.includes('asume por defecto "MEDIANO" (Q65.00)'),
        'Debe tener directiva para empujar el Mediano por defecto'
      );
    });

    it('2.2. Pilar 2: Tintas HP Látex Ecológicas con Durabilidad UV >10 Años', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('HP LÁTEX ECOLÓGICO') || prompt.includes('HP Látex'),
        'Debe destacar la tecnología HP Látex'
      );
      assert.ok(
        prompt.includes('Durabilidad UV superior a 10 años') || prompt.includes('10 años'),
        'Debe argumentar durabilidad UV superior a 10 años'
      );
      assert.ok(
        prompt.includes('sin decoloración'),
        'Debe destacar resistencia a decoloración'
      );
      assert.ok(
        prompt.includes('libres de olores tóxicos') || prompt.includes('ecológicas'),
        'Debe destacar tintas ecológicas/libres de olores'
      );
    });

    it('2.3. Pilar 3: Montaje Rápido con Cinta tesa® Original en 15 Segundos sin Clavos', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('CINTA tesa®') || prompt.includes('tesa®'),
        'Debe nombrar explícitamente la cinta tesa® original'
      );
      assert.ok(
        prompt.includes('15 segundos'),
        'Debe argumentar instalación en sólo 15 segundos'
      );
      assert.ok(
        prompt.includes('sin usar clavos') || prompt.includes('sin clavos'),
        'Debe argumentar instalación sin clavos'
      );
      assert.ok(
        prompt.includes('Cero agujeros') || prompt.includes('cero agujeros') || prompt.includes('cero daños'),
        'Debe argumentar cero agujeros y cero daños a la pintura'
      );
    });

    it('2.4. Pilar 4: Especial Melómanos — Portada de Álbum Vinilo Q55 (30x30 cm)', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)') || prompt.includes('Portada de Álbum'),
        'Debe enunciar Portada de Álbum 30x30 cm a Q55.00'
      );
      assert.ok(
        prompt.includes('Q55.00'),
        'Debe tener el precio inquebrantable de Q55.00'
      );
      assert.ok(
        prompt.includes('vinilo') || prompt.includes('discos'),
        'Debe conectar con formato vinilo para melómanos'
      );
    });

    it('2.5. Catálogo Oficial Completo de 6 Medidas y Reglas Canónicas de Mapeo', () => {
      const prompt = buildSalesSystemPrompt({});

      // Los 6 tamaños y precios oficiales
      assert.ok(prompt.includes('Mini (Q25.00)'));
      assert.ok(prompt.includes('Pequeño (Q35.00)'));
      assert.ok(prompt.includes('Portada de Álbum (Q55.00)'));
      assert.ok(prompt.includes('Mediano [OPCIÓN ESTRELLA] (Q65.00)'));
      assert.ok(prompt.includes('Grande (Q125.00)'));
      assert.ok(prompt.includes('Gigante (Q180.00)'));

      // Reglas canónicas de conversión
      assert.ok(prompt.includes('Si piden "18x24" o "45x60", asignar SIEMPRE tamaño "GRANDE" (Q125.00)'));
      assert.ok(prompt.includes('Si piden "24x36" o "60x90", asignar SIEMPRE tamaño "GIGANTE" (Q180.00)'));
      assert.ok(prompt.includes('Si piden "12x18" o "30x45", asignar SIEMPRE tamaño "MEDIANO" (Q65.00)'));
      assert.ok(prompt.includes('Si piden "portada", "disco", "vinilo", "álbum" o "30x30", asignar SIEMPRE tamaño "PORTADA_ALBUM" (Q55.00)'));
    });
  });

  // =========================================================================
  // SECCIÓN 3: INYECCIÓN DE BORRADOR ACTIVO Y RESILIENCIA ANTE PAYLOADS LÍMITE
  // =========================================================================
  describe('3. Inyección y Modificación Conversacional de Borrador Activo (pendingDraft)', () => {

    it('3.1. Inyección completa y directivas de edición conversacional', () => {
      const pendingDraft = {
        items: [
          { baseTitle: 'Spider-Man Miles Morales', sizeId: 'MEDIANO', quantity: 2, unitPrice: 65, subtotal: 130 },
          { baseTitle: 'Daft Punk Random Access', sizeId: 'PORTADA_ALBUM', quantity: 1, unitPrice: 55, subtotal: 55 },
        ],
        total: 185,
        paymentMethod: 'TARJETA',
        notes: 'Cliente con prisa para regalo',
      };

      const prompt = buildSalesSystemPrompt({ pendingDraft });

      assert.ok(prompt.includes('BORRADOR ACTIVO EN PANTALLA (EDICIÓN CONVERSACIONAL EN CURSO)'));
      assert.ok(prompt.includes('Spider-Man Miles Morales'));
      assert.ok(prompt.includes('Daft Punk Random Access'));
      assert.ok(prompt.includes('185'));
      assert.ok(prompt.includes('TARJETA'));
      assert.ok(prompt.includes('Cliente con prisa para regalo'));

      // Directivas de preservación y actualización
      assert.ok(prompt.includes('Preserva todos los ítems actuales a menos que pidan removerlos'));
      assert.ok(prompt.includes('Modifica cantidades, tamaños o método de pago según lo pedido'));
      assert.ok(prompt.includes('Invoca de inmediato "prepareSaleDraft" con la totalidad de los ítems actualizados y el nuevo total'));
    });

    it('3.2. Casos límite (Boundary testing): Borradores nulos, vacíos o sin items no contaminan el prompt', () => {
      const boundaryDrafts = [
        null,
        undefined,
        {},
        { items: [] },
        { items: null },
        { total: 0 },
      ];

      for (const badDraft of boundaryDrafts) {
        const prompt = buildSalesSystemPrompt({ pendingDraft: badDraft });
        assert.ok(
          !prompt.includes('BORRADOR ACTIVO EN PANTALLA'),
          `Borrador no debe inyectarse ante: ${JSON.stringify(badDraft)}`
        );
      }
    });

    it('3.3. Fallback de título cuando items usan description en vez de baseTitle', () => {
      const draftWithDescription = {
        items: [
          { description: 'Póster Vintage Porsche 911', sizeId: 'MEDIANO', quantity: 1, unitPrice: 65, subtotal: 65 },
        ],
        total: 65,
      };

      const prompt = buildSalesSystemPrompt({ pendingDraft: draftWithDescription });
      assert.ok(prompt.includes('BORRADOR ACTIVO EN PANTALLA'));
      assert.ok(prompt.includes('Póster Vintage Porsche 911'), 'Debe utilizar description si baseTitle no está presente');
    });

    it('3.4. Inyección a través de streamChatWithSalesAssistant y chatWithSalesAssistant hacia config.systemInstruction', async () => {
      let chatSystemInstruction = null;
      let streamSystemInstruction = null;

      const mockClient = {
        models: {
          generateContent: async ({ config }) => {
            chatSystemInstruction = config.systemInstruction;
            return { text: 'Respuesta chat', functionCalls: [] };
          },
          generateContentStream: async ({ config }) => {
            streamSystemInstruction = config.systemInstruction;
            async function* gen() {
              yield { text: 'Token stream' };
            }
            return gen();
          },
        },
      };

      const mockDraft = {
        items: [{ baseTitle: 'Batman Caballero de la Noche', quantity: 1, unitPrice: 65, subtotal: 65 }],
        total: 65,
      };

      // 1. Probar chat unario
      await chatWithSalesAssistant({
        message: 'Agrégame uno de Goku',
        tenantId: 'test-tenant',
        eventId: 'test-event',
        pendingDraft: mockDraft,
        geminiClient: mockClient,
      });

      assert.ok(chatSystemInstruction);
      assert.ok(chatSystemInstruction.includes('BORRADOR ACTIVO EN PANTALLA'));
      assert.ok(chatSystemInstruction.includes('Batman Caballero de la Noche'));

      // 2. Probar stream
      const streamGen = streamChatWithSalesAssistant({
        message: 'Cámbialo a grande',
        tenantId: 'test-tenant',
        eventId: 'test-event',
        pendingDraft: mockDraft,
        geminiClient: mockClient,
      });

      for await (const _ of streamGen) {
        // Consumir
      }

      assert.ok(streamSystemInstruction);
      assert.ok(streamSystemInstruction.includes('BORRADOR ACTIVO EN PANTALLA'));
      assert.ok(streamSystemInstruction.includes('Batman Caballero de la Noche'));
    });
  });

  // =========================================================================
  // SECCIÓN 4: RESOLUCIÓN DE REFERENCIAS ORDINALES ("la segunda que me mostraste")
  // =========================================================================
  describe('4. Resolución de Referencias Ordinales y Contexto Visual en Pantalla', () => {

    it('4.1. El prompt contiene directivas inequívocas para resolver referencias ordinales', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(
        prompt.includes('RESOLUCIÓN DE REFERENCIAS ORDINALES A OBRAS EN PANTALLA'),
        'Debe existir la sección 5 dedicada a ordinales'
      );
      assert.ok(
        prompt.includes('"la segunda que me mostraste"') || prompt.includes('la segunda'),
        'Debe citar el ejemplo "la segunda que me mostraste"'
      );
      assert.ok(
        prompt.includes('[Contexto de obras mostradas en pantalla al cliente en este turno: ...]'),
        'Debe indicar leer el bloque de obras del mensaje previo'
      );
      assert.ok(
        prompt.includes('Opción #1 -> la primera; Opción #2 -> la segunda'),
        'Debe fijar el mapeo ordinal estricto 1-based'
      );
      assert.ok(
        prompt.includes('sin pedirle al usuario que repita el nombre'),
        'Debe instruir proceder de inmediato sin preguntas innecesarias'
      );
    });

    it('4.2. Flujo completo: Historial con obras mostradas permite a Gemini recibir contexto íntegro', async () => {
      let passedContents = null;

      const mockClient = {
        models: {
          generateContent: async ({ contents }) => {
            passedContents = contents;
            return { text: '¡Excelente elección! Te preparé el borrador en pantalla.', functionCalls: [] };
          },
        },
      };

      const contextualHistory = [
        { role: 'user', text: '¿Qué pósters de superhéroes tienes disponibles?' },
        {
          role: 'model',
          text: `Te recomiendo estas opciones increíbles:\n[Contexto de obras mostradas en pantalla al cliente en este turno:\n- Opción #1: Spider-Man No Way Home (ID: sp-1, Mediano Q65)\n- Opción #2: Batman Caballero de la Noche (ID: bat-2, Mediano Q65)\n- Opción #3: Iron Man Arc Reactor (ID: im-3, Mediano Q65)]`,
        },
      ];

      await chatWithSalesAssistant({
        message: '¡Me llevo la segunda! Cobro en tarjeta.',
        history: contextualHistory,
        tenantId: 'test-tenant',
        eventId: 'test-event',
        geminiClient: mockClient,
      });

      assert.ok(Array.isArray(passedContents));
      assert.strictEqual(passedContents.length, 3);
      assert.ok(passedContents[1].parts[0].text.includes('Opción #2: Batman Caballero de la Noche'));
      assert.strictEqual(passedContents[2].parts[0].text, '¡Me llevo la segunda! Cobro en tarjeta.');
    });
  });

  // =========================================================================
  // SECCIÓN 5: PROACTIVIDAD DE prepareSaleDraft ANTE FRASES COLOQUIALES DE COMPRA
  // =========================================================================
  describe('5. Proactividad en Invocación de prepareSaleDraft ante Intención de Compra', () => {

    it('5.1. El prompt maestro lista expresamente frases coloquiales de compra que activan prepareSaleDraft', () => {
      const prompt = buildSalesSystemPrompt({});

      assert.ok(prompt.includes('prepareSaleDraft'));
      assert.ok(prompt.includes('CLARA INTENCIÓN DE COMPRA'));

      // Comprobar ejemplos clave
      assert.ok(prompt.includes('me llevo'), 'Debe incluir "me llevo"');
      assert.ok(prompt.includes('quiero'), 'Debe incluir "quiero"');
      assert.ok(prompt.includes('dame 2') || prompt.includes('dame'), 'Debe incluir "dame 2"');
      assert.ok(prompt.includes('voy a pagar con tarjeta') || prompt.includes('pagar con tarjeta'));
      assert.ok(prompt.includes('¡Sé proactivo y deja listo el borrador para que el vendedor solo lo confirme!'));
    });

    it('5.2. El prompt prohíbe terminantemente generar bloques markdown falsos de venta', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('PROHIBIDO generar bloques de texto markdown falsos') ||
        prompt.includes('```json_sale') ||
        prompt.includes('```json'),
        'Debe prohibir la simulación de venta con markdown crudo'
      );
      assert.ok(
        prompt.includes('La venta se estructura exclusivamente con esta tool') ||
        prompt.includes('prepareSaleDraft'),
        'Debe exigir formalmente la tool'
      );
    });

    it('5.3. Declaración formal de prepareSaleDraftDeclaration y salesAssistantTools', () => {
      assert.strictEqual(prepareSaleDraftDeclaration.name, 'prepareSaleDraft');
      assert.ok(prepareSaleDraftDeclaration.parameters);
      assert.ok(prepareSaleDraftDeclaration.parameters.properties.items);
      assert.ok(prepareSaleDraftDeclaration.parameters.properties.total);
      assert.ok(prepareSaleDraftDeclaration.parameters.properties.paymentMethod);
      assert.deepStrictEqual(
        prepareSaleDraftDeclaration.parameters.properties.paymentMethod.enum,
        ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']
      );
      assert.ok(prepareSaleDraftDeclaration.parameters.required.includes('items'));

      // Verificar que está presente en la lista oficial de tools
      const toolDecl = salesAssistantTools[0].functionDeclarations.find(
        (f) => f.name === 'prepareSaleDraft'
      );
      assert.ok(toolDecl, 'prepareSaleDraft debe estar en salesAssistantTools');
    });
  });

  // =========================================================================
  // SECCIÓN 6: RESILIENCIA DEL POOL MULTI-MODELO Y OBSERVABILIDAD ANTI-429
  // =========================================================================
  describe('6. Resiliencia del Pool Multi-Modelo y Observabilidad de Degradación', () => {

    it('6.1. Prioridad del pool: gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-1.5-flash', () => {
      assert.deepStrictEqual(MODEL_PRIORITY_POOL, [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
      ]);
    });

    it('6.2. Clasificadores de error diferencian cuota (429), saturación (503) y fallas no recuperables', () => {
      // 429
      assert.strictEqual(isRateLimitOrQuotaError({ status: 429 }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ message: 'Resource exhausted: quota exceeded' }), true);
      assert.strictEqual(isRateLimitOrQuotaError({ status: 500 }), false);

      // 503
      assert.strictEqual(isServiceOverloadedError({ status: 503 }), true);
      assert.strictEqual(isServiceOverloadedError({ message: 'The model is overloaded.' }), true);
      assert.strictEqual(isServiceOverloadedError({ status: 429 }), false);

      // Retryable on same model: 503 sí, 429 no
      assert.strictEqual(isRetryableOnSameModel({ status: 503 }), true);
      assert.strictEqual(isRetryableOnSameModel({ status: 429 }), false);

      // Fallback to next model: 429 y 503 sí, 400 no
      assert.strictEqual(shouldFallbackToNextModel({ status: 429 }), true);
      assert.strictEqual(shouldFallbackToNextModel({ status: 503 }), true);
      assert.strictEqual(shouldFallbackToNextModel({ status: 400 }), false);
    });

    it('6.3. Pricing y observabilidad: sin colisión de prefijos entre flash y flash-lite', () => {
      assert.ok(PRICING['gemini-2.5-flash-lite']);
      assert.ok(PRICING['gemini-2.5-flash']);

      const costLite = estimateCostUsd('gemini-2.5-flash-lite', 100000, 100000);
      const costFlash = estimateCostUsd('gemini-2.5-flash', 100000, 100000);

      // Lite debe ser significativamente más económico que Flash ($0.10/$0.40 vs $0.30/$2.50)
      assert.ok(costLite < costFlash, 'Cost de lite debe ser menor que flash');
      assert.strictEqual(costLite, 0.05); // 0.1 * 0.1 + 0.1 * 0.4 = 0.05
      assert.strictEqual(costFlash, 0.28); // 0.1 * 0.3 + 0.1 * 2.5 = 0.28
    });
  });
});
