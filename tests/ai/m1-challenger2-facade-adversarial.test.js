import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';

// 1. Import from the barrel facade
import * as barrel from '../../server/services/aiMultimodalService.js';

// 2. Import from individual submodules
import * as promptSubmodule from '../../server/services/ai/aiPromptService.js';
import * as toolsSubmodule from '../../server/services/ai/aiToolsService.js';
import * as mediaSubmodule from '../../server/services/ai/aiMediaService.js';
import * as streamSubmodule from '../../server/services/ai/aiStreamService.js';

const MOCK_DB_PRODUCTS = [
  {
    id: 'prod-pink-1',
    sku: 'DV-PINK-01',
    name: 'Pink Floyd The Wall',
    category: 'MUSICA',
    basePrice: 55,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/pink.jpg',
    tags: ['pink', 'floyd', 'rock', 'musica'],
    isActive: true,
    tenantId: 'tenant-test',
    sizes: [
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55, badge: 'Formato vinilo' },
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, badge: '⭐ Más vendido' },
    ],
  },
];

describe('⚔️ CHALLENGER 2: Verificación Adversarial Empírica — Fachada Barrel, Retrocompatibilidad y Paridad 27 Símbolos', () => {
  let originalPrismaFindMany;

  beforeEach(() => {
    invalidateCatalogCache();
    if (prisma?.product) {
      originalPrismaFindMany = prisma.product.findMany;
      prisma.product.findMany = async () => MOCK_DB_PRODUCTS;
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    if (prisma?.product && originalPrismaFindMany) {
      prisma.product.findMany = originalPrismaFindMany;
    }
  });

  const EXPECTED_SYMBOLS = [
    // aiPromptService (6)
    'salesAssistantSafetySettings',
    'voiceSaleResponseSchema',
    'artworkRecognitionResponseSchema',
    'videoRecognitionResponseSchema',
    'batchPhotoResponseSchema',
    'buildSalesSystemPrompt',
    // aiToolsService (13)
    'prepareSaleDraftDeclaration',
    'searchCatalogDeclaration',
    'getEventKPIsDeclaration',
    'getCashDrawerStatusDeclaration',
    'getSellerShiftReportDeclaration',
    'getProductionQueueStatusDeclaration',
    'checkInventoryStockDeclaration',
    'salesAssistantTools',
    'constructDraftPayload',
    'executeGetCashDrawerStatus',
    'executeGetSellerShiftReport',
    'executeGetProductionQueueStatus',
    'executeCheckInventoryStock',
    // aiMediaService (6)
    'normalizeCatalogSizeId',
    'matchPosterEverywhere',
    'processVoiceSaleAudio',
    'recognizePosterArtworkFromImage',
    'recognizePostersFromVideo',
    'processPostersBatchPhoto',
    // aiStreamService (2)
    'chatWithSalesAssistant',
    'streamChatWithSalesAssistant',
  ];

  describe('1. Paridad de 27 Símbolos y Referencias de Submódulo', () => {

    it('1.1. La lista de 27 símbolos esperados cuenta con exactamente 27 elementos', () => {
      assert.strictEqual(EXPECTED_SYMBOLS.length, 27, 'Deben ser exactamente 27 símbolos');
    });

    it('1.2. Cada uno de los 27 símbolos está definido en el barrel facade y no es undefined/null', () => {
      for (const sym of EXPECTED_SYMBOLS) {
        assert.ok(
          sym in barrel,
          `El símbolo "${sym}" debe ser re-exportado por server/services/aiMultimodalService.js`
        );
        assert.notStrictEqual(
          barrel[sym],
          undefined,
          `El símbolo "${sym}" en barrel no debe ser undefined`
        );
        assert.notStrictEqual(
          barrel[sym],
          null,
          `El símbolo "${sym}" en barrel no debe ser null`
        );
      }
    });

    it('1.3. Identidad referencial estricta: cada símbolo en el barrel es idéntico (===) a su fuente en el submódulo', () => {
      // 6 de aiPromptService
      assert.strictEqual(barrel.salesAssistantSafetySettings, promptSubmodule.salesAssistantSafetySettings);
      assert.strictEqual(barrel.voiceSaleResponseSchema, promptSubmodule.voiceSaleResponseSchema);
      assert.strictEqual(barrel.artworkRecognitionResponseSchema, promptSubmodule.artworkRecognitionResponseSchema);
      assert.strictEqual(barrel.videoRecognitionResponseSchema, promptSubmodule.videoRecognitionResponseSchema);
      assert.strictEqual(barrel.batchPhotoResponseSchema, promptSubmodule.batchPhotoResponseSchema);
      assert.strictEqual(barrel.buildSalesSystemPrompt, promptSubmodule.buildSalesSystemPrompt);

      // 13 de aiToolsService
      assert.strictEqual(barrel.prepareSaleDraftDeclaration, toolsSubmodule.prepareSaleDraftDeclaration);
      assert.strictEqual(barrel.searchCatalogDeclaration, toolsSubmodule.searchCatalogDeclaration);
      assert.strictEqual(barrel.getEventKPIsDeclaration, toolsSubmodule.getEventKPIsDeclaration);
      assert.strictEqual(barrel.getCashDrawerStatusDeclaration, toolsSubmodule.getCashDrawerStatusDeclaration);
      assert.strictEqual(barrel.getSellerShiftReportDeclaration, toolsSubmodule.getSellerShiftReportDeclaration);
      assert.strictEqual(barrel.getProductionQueueStatusDeclaration, toolsSubmodule.getProductionQueueStatusDeclaration);
      assert.strictEqual(barrel.checkInventoryStockDeclaration, toolsSubmodule.checkInventoryStockDeclaration);
      assert.strictEqual(barrel.salesAssistantTools, toolsSubmodule.salesAssistantTools);
      assert.strictEqual(barrel.constructDraftPayload, toolsSubmodule.constructDraftPayload);
      assert.strictEqual(barrel.executeGetCashDrawerStatus, toolsSubmodule.executeGetCashDrawerStatus);
      assert.strictEqual(barrel.executeGetSellerShiftReport, toolsSubmodule.executeGetSellerShiftReport);
      assert.strictEqual(barrel.executeGetProductionQueueStatus, toolsSubmodule.executeGetProductionQueueStatus);
      assert.strictEqual(barrel.executeCheckInventoryStock, toolsSubmodule.executeCheckInventoryStock);

      // 6 de aiMediaService
      assert.strictEqual(barrel.normalizeCatalogSizeId, mediaSubmodule.normalizeCatalogSizeId);
      assert.strictEqual(barrel.matchPosterEverywhere, mediaSubmodule.matchPosterEverywhere);
      assert.strictEqual(barrel.processVoiceSaleAudio, mediaSubmodule.processVoiceSaleAudio);
      assert.strictEqual(barrel.recognizePosterArtworkFromImage, mediaSubmodule.recognizePosterArtworkFromImage);
      assert.strictEqual(barrel.recognizePostersFromVideo, mediaSubmodule.recognizePostersFromVideo);
      assert.strictEqual(barrel.processPostersBatchPhoto, mediaSubmodule.processPostersBatchPhoto);

      // 2 de aiStreamService
      assert.strictEqual(barrel.chatWithSalesAssistant, streamSubmodule.chatWithSalesAssistant);
      assert.strictEqual(barrel.streamChatWithSalesAssistant, streamSubmodule.streamChatWithSalesAssistant);
    });

    it('1.4. Todos los símbolos exportados por cada submódulo existen en el barrel', () => {
      const submodules = [
        { name: 'aiPromptService', mod: promptSubmodule },
        { name: 'aiToolsService', mod: toolsSubmodule },
        { name: 'aiMediaService', mod: mediaSubmodule },
        { name: 'aiStreamService', mod: streamSubmodule },
      ];

      for (const { name, mod } of submodules) {
        for (const key of Object.keys(mod)) {
          assert.ok(
            key in barrel,
            `El símbolo "${key}" proveniente de "${name}" debe existir en el barrel facade`
          );
          assert.strictEqual(
            barrel[key],
            mod[key],
            `El símbolo "${key}" en el barrel debe coincidir referencialmente con "${name}"`
          );
        }
      }
    });
  });

  describe('2. Retrocompatibilidad Estricta con aiController.js', () => {

    it('2.1. Los 5 símbolos consumidos por server/controllers/aiController.js están presentes con sus tipos correctos', () => {
      const requiredByController = [
        { name: 'processVoiceSaleAudio', type: 'function' },
        { name: 'processPostersBatchPhoto', type: 'function' },
        { name: 'chatWithSalesAssistant', type: 'function' },
        { name: 'streamChatWithSalesAssistant', type: 'function' },
        { name: 'constructDraftPayload', type: 'function' },
      ];

      for (const item of requiredByController) {
        assert.strictEqual(
          typeof barrel[item.name],
          item.type,
          `aiController requiere que "${item.name}" sea de tipo ${item.type}`
        );
      }
    });
  });

  describe('3. Pruebas Adversariales de Funciones y Schemas Re-Exportados', () => {

    it('3.1. normalizeCatalogSizeId maneja entradas extremas, nulas, compuestas y acentos', () => {
      const { normalizeCatalogSizeId } = barrel;
      assert.strictEqual(normalizeCatalogSizeId(null), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(undefined), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(''), 'MEDIANO');
      // Invariante histórico documentado: '   ' es truthy en JS, trim() produce '' y retorna ''
      assert.strictEqual(normalizeCatalogSizeId('   '), '');

      // Equivalencias y medidas
      assert.strictEqual(normalizeCatalogSizeId('18x24'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('45x60'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('24x36'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('60x90'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('12x18'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('30x45'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('30x30'), 'PORTADA_ALBUM');
      assert.strictEqual(normalizeCatalogSizeId('disco de vinilo'), 'PORTADA_ALBUM');
      assert.strictEqual(normalizeCatalogSizeId('álbum'), 'PORTADA_ALBUM');
      assert.strictEqual(normalizeCatalogSizeId('5x7'), 'MINI');
      assert.strictEqual(normalizeCatalogSizeId('14x21 cm'), 'MINI');
      assert.strictEqual(normalizeCatalogSizeId('21x27'), 'PEQUENO');
      assert.strictEqual(normalizeCatalogSizeId('pequeño'), 'PEQUENO');
    });

    it('3.2. buildSalesSystemPrompt valida identidad STAND {IA} y proscribe J.A.R.V.I.S. en bordes nulos', () => {
      const { buildSalesSystemPrompt } = barrel;
      const prompt = buildSalesSystemPrompt({
        event: null,
        resolvedContextData: null,
        pendingDraft: null,
      });

      assert.ok(prompt.includes('STAND {IA}'), 'Debe identificarse como STAND {IA}');
      assert.ok(!prompt.includes('J.A.R.V.I.S.'), 'No debe contener J.A.R.V.I.S.');
      assert.ok(prompt.includes('HP LÁTEX'), 'Debe incluir pilar HP Látex');
      assert.ok(prompt.includes('tesa®'), 'Debe incluir pilar cinta tesa');
      assert.ok(prompt.includes('MEDIANO'), 'Debe incluir tamaño Mediano');
      assert.ok(prompt.includes('PORTADA DE ÁLBUM'), 'Debe incluir Portada de Álbum');
      assert.ok(prompt.includes('TRATO EXCLUSIVO DE "TÚ"'), 'Debe exigir trato exclusivo de tú');
    });

    it('3.3. salesAssistantTools contiene las 7 declaraciones esperadas con parámetros válidos', () => {
      const { salesAssistantTools } = barrel;
      assert.ok(Array.isArray(salesAssistantTools), 'salesAssistantTools debe ser un array');
      assert.strictEqual(salesAssistantTools.length, 1);
      const decls = salesAssistantTools[0].functionDeclarations;
      assert.ok(Array.isArray(decls), 'functionDeclarations debe ser un array');
      assert.strictEqual(decls.length, 7, 'Deben haber exactamente 7 function declarations');

      const expectedNames = [
        'prepareSaleDraft',
        'searchCatalog',
        'getEventKPIs',
        'getCashDrawerStatus',
        'getSellerShiftReport',
        'getProductionQueueStatus',
        'checkInventoryStock',
      ];

      const names = decls.map(d => d.name);
      for (const exp of expectedNames) {
        assert.ok(names.includes(exp), `Declaración faltante: ${exp}`);
      }
    });

    it('3.4. executeCheckInventoryStock maneja consultas vacías sin invocar DB', async () => {
      const { executeCheckInventoryStock } = barrel;
      const res1 = await executeCheckInventoryStock('tenant-test', null);
      assert.strictEqual(res1.found, false);
      assert.ok(res1.message.includes('Debe especificar'));

      const res2 = await executeCheckInventoryStock('tenant-test', '   ');
      assert.strictEqual(res2.found, false);
      assert.ok(res2.message.includes('Debe especificar'));
    });

    it('3.5. chatWithSalesAssistant y streamChatWithSalesAssistant operan en modo offline sin cliente Gemini', async () => {
      const { chatWithSalesAssistant, streamChatWithSalesAssistant } = barrel;

      // chat offline
      const chatRes = await chatWithSalesAssistant({
        message: '¿Cuánto hemos vendido hoy?',
        history: [],
        tenantId: 'mock-tenant',
        eventId: null,
        geminiClient: null,
      });
      assert.ok(chatRes.reply.includes('Modo Offline'), 'chatWithSalesAssistant debe responder en modo offline si geminiClient es null');

      // stream offline
      const stream = streamChatWithSalesAssistant({
        message: 'Véndeme un poster',
        tenantId: 'mock-tenant',
        eventId: null,
        geminiClient: null,
      });

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      assert.ok(chunks.length > 0, 'streamChatWithSalesAssistant debe generar chunks');
      assert.strictEqual(chunks[0].type, 'token');
      assert.ok(chunks[0].text.includes('Modo Offline'));
    });

    it('3.6. Los 4 esquemas estructurados de respuesta Gemini contienen especificaciones de esquema válidas', () => {
      const schemas = [
        barrel.voiceSaleResponseSchema,
        barrel.artworkRecognitionResponseSchema,
        barrel.videoRecognitionResponseSchema,
        barrel.batchPhotoResponseSchema,
      ];

      for (const s of schemas) {
        assert.ok(s, 'El esquema no debe ser nulo');
        assert.ok(s.type, 'El esquema debe tener una propiedad type');
        assert.ok(s.properties && typeof s.properties === 'object', 'El esquema debe tener propiedades');
        assert.ok(Array.isArray(s.required) && s.required.length > 0, 'El esquema debe tener campos requeridos');
      }
    });

    it('3.7. salesAssistantSafetySettings contiene exactamente 4 categorías de protección configuradas', () => {
      const { salesAssistantSafetySettings } = barrel;
      assert.ok(Array.isArray(salesAssistantSafetySettings));
      assert.strictEqual(salesAssistantSafetySettings.length, 4);
      for (const st of salesAssistantSafetySettings) {
        assert.ok(st.category, 'Debe especificar category');
        assert.ok(st.threshold, 'Debe especificar threshold');
      }
    });

    it('3.8. constructDraftPayload maneja alias, Portada de Álbum Q55 y totales con precisión', async () => {
      const { constructDraftPayload } = barrel;
      const draft = await constructDraftPayload('tenant-test', {
        items: [
          { productName: 'Pink Floyd The Wall', size: 'PORTADA_ALBUM', quantity: 2 },
          { productName: 'Póster Genérico Anime', size: 'MEDIANO', quantity: 1, unitPrice: 65 },
        ],
        notes: 'Cliente paga con tarjeta',
      }, 'quiero dos portadas de Pink Floyd y uno de anime pago tarjeta');

      assert.strictEqual(draft.paymentMethod, 'TARJETA');
      assert.strictEqual(draft.items.length, 2);
      // Portada álbum debe ser Q55
      assert.strictEqual(draft.items[0].unitPrice, 55);
      assert.strictEqual(draft.items[0].subtotal, 110);
      // Mediano debe ser Q65
      assert.strictEqual(draft.items[1].unitPrice, 65);
      assert.strictEqual(draft.items[1].subtotal, 65);
      assert.strictEqual(draft.total, 175);
    });
  });

  describe('4. Auditoría Forense de Presupuesto de Líneas y Pureza Arquitectónica', () => {
    it('4.1. Los 5 archivos de STAND {IA} se encuentran estrictamente dentro de sus presupuestos de líneas', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const files = [
        { path: 'server/services/aiMultimodalService.js', max: 40 },
        { path: 'server/services/ai/aiPromptService.js', max: 180 },
        { path: 'server/services/ai/aiMediaService.js', max: 200 },
        { path: 'server/services/ai/aiToolsService.js', max: 200 },
        { path: 'server/services/ai/aiStreamService.js', max: 150 },
      ];

      for (const item of files) {
        const fullPath = path.resolve(process.cwd(), item.path);
        assert.ok(fs.existsSync(fullPath), `El archivo ${item.path} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        assert.ok(
          lines <= item.max,
          `El archivo ${item.path} tiene ${lines} líneas, superando el límite de ${item.max}`
        );
      }
    });

    it('4.2. server/services/aiMultimodalService.js es una fachada pura de re-exportación sin lógica de negocio', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const fullPath = path.resolve(process.cwd(), 'server/services/aiMultimodalService.js');
      const content = fs.readFileSync(fullPath, 'utf8');

      // Solo debe tener comentarios y statements "export * from"
      const nonCommentLines = content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('/*') && !l.startsWith('*') && !l.startsWith('//'));

      for (const line of nonCommentLines) {
        assert.ok(
          line.startsWith('export * from'),
          `Línea no permitida en fachada barrel pura: "${line}"`
        );
      }
      assert.strictEqual(nonCommentLines.length, 4, 'Deben existir exactamente 4 sentencias export *');
    });
  });
});
