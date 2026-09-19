import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { matchPosterEverywhere, findLocalMatch, matchesCatalogWordBoundary } from '../../server/services/catalog/webCatalogService.js';
import { recognizePosterArtworkFromImage } from '../../server/services/ai/aiMediaService.js';
import { resetKeyPool, getClientForKey } from '../../server/services/ai/aiKeyPoolService.js';

const ADVERSARIAL_MOCK_CATALOG = [
  {
    id: 'prod-it-pennywise-1',
    sku: 'DV-IT-01',
    name: 'IT',
    titulo: 'IT',
    category: 'CINE',
    categoria: 'CINE',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/it.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/it.webp',
    tags: ['it', 'pennywise', 'terror', 'payaso', 'stephen', 'king'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-up-pixar-1',
    sku: 'DV-UP-01',
    name: 'UP',
    titulo: 'UP',
    category: 'INFANTILYDIBUJOSANIMADOS',
    categoria: 'INFANTILYDIBUJOSANIMADOS',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/up.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/up.webp',
    tags: ['up', 'pixar', 'globos', 'casa'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-300-sparta-1',
    sku: 'DV-300-01',
    name: '300',
    titulo: '300',
    category: 'CINE',
    categoria: 'CINE',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/300.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/300.webp',
    tags: ['300', 'esparta', 'leonidas', 'xerxes'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
    ],
  },
  {
    id: 'prod-el-clasico-1',
    sku: 'DV-EL-01',
    name: 'EL',
    titulo: 'EL',
    category: 'ARTE',
    categoria: 'ARTE',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/el.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/el.webp',
    tags: ['el', 'arte', 'vintage'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-ramen-anime-poster-1',
    sku: 'DV-RAMEN-01',
    name: 'Póster de Ramen Anime',
    titulo: 'Póster de Ramen Anime',
    category: 'ANIME',
    categoria: 'ANIME',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/ramen-poster.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/ramen-poster.webp',
    tags: ['ramen', 'anime', 'japon', 'fideos', 'ilustracion'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    titulo: 'Spider-Man Vintage Comic',
    category: 'SUPERHEROES',
    categoria: 'SUPERHEROES',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spidey.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/spidey.webp',
    tags: ['spiderman', 'spider', 'man', 'marvel'],
    isActive: true,
    tenantId: 't-challenger2-m3',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
];

describe('⚔️ CHALLENGER 2: ADVERSARIAL STRESS-TEST HARNESS — MILESTONE 3 (R2 & R3)', () => {
  const TENANT_ID = 't-challenger2-m3';
  const dummyBuffer = Buffer.from('CHALLENGER_2_ADVERSARIAL_IMAGE_BUFFER');
  let origFindMany, origFindFirst, origAuditCreate;

  beforeEach(() => {
    resetKeyPool();
    invalidateCatalogCache(TENANT_ID);

    if (prisma?.product) {
      origFindMany = prisma.product.findMany;
      origFindFirst = prisma.product.findFirst;
      prisma.product.findMany = async () => ADVERSARIAL_MOCK_CATALOG;
      prisma.product.findFirst = async () => null;
    }
    if (prisma?.auditLog) {
      origAuditCreate = prisma.auditLog.create;
      prisma.auditLog.create = async () => ({ id: 'mock-audit' });
    }

    productCache.set(TENANT_ID, {
      timestamp: Date.now(),
      products: ADVERSARIAL_MOCK_CATALOG,
    });
  });

  afterEach(() => {
    invalidateCatalogCache(TENANT_ID);
    if (prisma?.product && origFindMany) {
      prisma.product.findMany = origFindMany;
      prisma.product.findFirst = origFindFirst;
    }
    if (prisma?.auditLog && origAuditCreate) {
      prisma.auditLog.create = origAuditCreate;
    }
  });

  describe('🔥 1. Fuzzing Adversarial de Dominio Negativo (R3)', () => {
    const NEGATIVE_DOMAIN_CASES = [
      // Gastronomía
      { title: 'Ramen Tonkotsu', analysis: 'Tazón de fideos con caldo caliente y chashu de cerdo' },
      { title: 'Fideos Yakisoba', analysis: 'Plato de fideos salteados con verduras y salsa' },
      { title: 'Noodles con carne', analysis: 'Noodles servidos en caja para llevar' },
      { title: 'Tacos al pastor', analysis: 'Orden de tacos con cilantro, cebolla y salsa picante' },
      { title: 'Hamburguesa doble con tocino', analysis: 'Burger artesanal con papas fritas y queso' },
      { title: 'Pizza cuatro quesos', analysis: 'Pizza recién horneada cortada en rebanadas' },
      { title: 'Sushi Roll California', analysis: 'Platillo de sushi de salmón y aguacate en bandeja' },
      { title: 'Sopa de tortilla', analysis: 'Caldo tradicional servido con aguacate y queso' },
      { title: 'Caldo de res con verduras', analysis: 'Alimentos calientes servidos en tazón hondo' },
      { title: 'Pastel de chocolate', analysis: 'Postre dulce con crema chantilly y fresas' },
      { title: 'Bebidas carbonatadas', analysis: 'Refrescos y jugos en mesa de comedor' },
      { title: 'Ensalada César con pollo', analysis: 'Plato fresco con lechuga, crutones y aderezo' },
      { title: 'Ceviche de mariscos', analysis: 'Mariscos marinados en limón servidos con tostadas' },
      // Calzado y Ropa
      { title: 'Sneakers Nike Air Max', analysis: 'Calzado deportivo sobre alfombra de tienda' },
      { title: 'Zapatillas de correr', analysis: 'Tenis deportivos para atletismo' },
      { title: 'Botas de cuero para montaña', analysis: 'Calzado resistente en aparador' },
      { title: 'Sandalias de verano', analysis: 'Calzado ligero para playa' },
      { title: 'Calcetines de lana', analysis: 'Ropa interior térmica doblada en cajón' },
      { title: 'Camisa formal manga larga', analysis: 'Ropa ejecutiva colgada en gancho' },
      { title: 'Camiseta de algodón', analysis: 'Prenda de vestir sobre la cama' },
      { title: 'Pantalones de mezclilla', analysis: 'Ropa informal doblada en estante' },
      { title: 'Vestido de noche rojo', analysis: 'Vestido largo de seda en maniquí' },
      // Animales vivos
      { title: 'Perro Golden Retriever', analysis: 'Perros vivos jugando en el jardín' },
      { title: 'Gato Siamés', analysis: 'Gatos vivos durmiendo en tapete' },
      { title: 'Mascota doméstica', analysis: 'Mascotas vivas en el veterinario' },
      { title: 'Animal en zoológico', analysis: 'Animales vivos en su hábitat natural' },
      // Muebles y Utensilios domésticos
      { title: 'Sofá reclinable de cuero', analysis: 'Muebles de sala tapizados en café' },
      { title: 'Cama matrimonial de madera', analysis: 'Cama con sábanas y almohadas blancas' },
      { title: 'Mesa de comedor con sillas', analysis: 'Muebles de comedor listos para cena' },
      { title: 'Sartén de teflón y ollas', analysis: 'Utensilios de cocina sobre estufa de gas' },
      { title: 'Cubiertos de acero inoxidable', analysis: 'Tenedores, cucharas y cuchillos en la mesa' },
      { title: 'Juego de vajilla de porcelana', analysis: 'Platos extendidos y hondos en alacena' },
    ];

    for (let i = 0; i < NEGATIVE_DOMAIN_CASES.length; i++) {
      const tc = NEGATIVE_DOMAIN_CASES[i];
      it(`1.${i + 1} Rechaza estrictamente objeto fuera de giro: "${tc.title}"`, async () => {
        const testKey = `AQ.challenger2_neg_domain_${i}`;
        ENV.GEMINI_API_KEYS = testKey;
        const client = getClientForKey(testKey);

        client.models.generateContent = async () => ({
          text: JSON.stringify({
            primaryTitle: tc.title,
            visualAnalysis: tc.analysis,
            confidence: 0.94,
            suggestedSize: 'MEDIANO',
            candidates: [],
          }),
        });

        const res = await recognizePosterArtworkFromImage({
          imageBuffer: dummyBuffer,
          mimeType: 'image/jpeg',
          tenantId: TENANT_ID,
        });

        assert.strictEqual(res.isArtworkDetected, false, `isArtworkDetected debe ser false para ${tc.title}`);
        assert.strictEqual(res.draftSale, null, `draftSale debe ser null para ${tc.title}`);
        assert.strictEqual(res.items.length, 0, `items debe ser [] para ${tc.title}`);
        assert.strictEqual(res.total, 0, `total debe ser 0 para ${tc.title}`);
        assert.strictEqual(res.matchedPoster, null, `matchedPoster debe ser null para ${tc.title}`);
        assert.ok(res.message.includes('no pertenece al catálogo oficial'));
      });
    }
  });

  describe('🛡️ 2. Salvaguarda Gráfica de Obras que Ilustran Alimentos/Objetos (R3)', () => {
    const GRAPHIC_SAFEGUARD_CASES = [
      {
        title: 'Póster de Ramen Anime',
        analysis: 'Póster impreso con diseño gráfico de un tazón de fideos ramen en estilo anime japonés',
        shouldFindInCatalog: true,
        expectedTitle: 'Póster de Ramen Anime',
      },
      {
        title: 'Cuadro de Sushi Minimalista',
        analysis: 'Cuadro enmarcado con ilustración moderna de sushi y caligrafía japonesa',
        shouldFindInCatalog: false, // Not in mock catalog
      },
      {
        title: 'Lámina de Pizza Pop Art',
        analysis: 'Lámina decorativa de pared con arte gráfico retro de una rebanada de pizza',
        shouldFindInCatalog: false,
      },
      {
        title: 'Diseño gráfico de Hamburguesa Vintage',
        analysis: 'Diseño gráfico publicitario estilo años 50 con hamburguesa y malteada',
        shouldFindInCatalog: false,
      },
      {
        title: 'Wall art de Tacos Mexicanos',
        analysis: 'Wall art impreso en lienzo con ilustración vectorial de tacos al pastor',
        shouldFindInCatalog: false,
      },
      {
        title: 'Print artístico de Café y Donas',
        analysis: 'Impresión artística para cafetería con acuarela de café latte',
        shouldFindInCatalog: false,
      },
    ];

    for (let i = 0; i < GRAPHIC_SAFEGUARD_CASES.length; i++) {
      const tc = GRAPHIC_SAFEGUARD_CASES[i];
      it(`2.${i + 1} Salvaguarda gráfica opera en "${tc.title}"`, async () => {
        const testKey = `AQ.challenger2_safeguard_${i}`;
        ENV.GEMINI_API_KEYS = testKey;
        const client = getClientForKey(testKey);

        client.models.generateContent = async () => ({
          text: JSON.stringify({
            primaryTitle: tc.title,
            visualAnalysis: tc.analysis,
            confidence: 0.95,
            suggestedSize: 'MEDIANO',
          }),
        });

        const res = await recognizePosterArtworkFromImage({
          imageBuffer: dummyBuffer,
          mimeType: 'image/jpeg',
          tenantId: TENANT_ID,
        });

        if (tc.shouldFindInCatalog) {
          assert.strictEqual(res.isArtworkDetected, true, `Debe reconocerse como obra al estar en catálogo: ${tc.title}`);
          assert.ok(res.draftSale !== null, 'draftSale no debe ser null');
          assert.strictEqual(res.items.length, 1);
          assert.strictEqual(res.items[0].baseTitle, tc.expectedTitle);
        } else {
          // It passed the negative domain pre-filter, but since it's not in catalog, it safely rejected
          assert.strictEqual(res.isArtworkDetected, false);
          assert.strictEqual(res.draftSale, null);
          assert.strictEqual(res.items.length, 0);
        }
      });
    }
  });

  describe('⚡ 3. Fuzzing de Relevancia Cruzada (R2)', () => {
    it('3.1 Título legítimo ausente de catálogo pero forzado por mock a devolver "IT" es rechazado por 0% solapamiento léxico', async () => {
      const testKey = 'AQ.challenger2_cross_relevance_it';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      // Gemini identifies something completely unrelated to IT
      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'El Señor de los Anillos La Comunidad del Anillo',
          franchiseOrCategory: 'FANTASIA',
          visualAnalysis: 'Póster con los nueve miembros de la comunidad caminando hacia Mordor',
          confidence: 0.93,
          suggestedSize: 'MEDIANO',
          candidates: ['Frodo', 'Gandalf', 'Aragorn'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      // Even if catalog had returned "IT", token overlap between LOTR tokens and IT is 0%
      assert.strictEqual(res.isArtworkDetected, false, 'Debe rechazar por falta de relevancia cruzada');
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
    });

    it('3.2 Geometría abstracta neón evaluada contra Spider-Man es rechazada por relevancia cruzada', async () => {
      const testKey = 'AQ.challenger2_cross_relevance_spidey';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Vórtice Psicodélico Fractal 4K',
          visualAnalysis: 'Póster de arte fractal caleidoscópico multicolor',
          confidence: 0.89,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
    });
  });

  describe('🎯 4. Reconocimiento Exitoso de Obras Cortas Legítimas ("IT", "UP", "300", "EL")', () => {
    it('4.1 Obra legítima "IT" con detalles de Pennywise se reconoce con éxito', async () => {
      const testKey = 'AQ.challenger2_legit_it';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'IT',
          franchiseOrCategory: 'CINE',
          visualAnalysis: 'Póster de la película IT de Stephen King con Pennywise y globo rojo',
          confidence: 0.96,
          suggestedSize: 'MEDIANO',
          candidates: ['Pennywise', 'Stephen King', 'IT 2017'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'Debe reconocer IT legítimo');
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].baseTitle, 'IT');
      assert.strictEqual(res.total, 65);
    });

    it('4.2 Obra legítima "UP" de Pixar se reconoce con éxito', async () => {
      const testKey = 'AQ.challenger2_legit_up';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'UP',
          franchiseOrCategory: 'INFANTILYDIBUJOSANIMADOS',
          visualAnalysis: 'Póster de la película UP de Pixar con la casa flotando con miles de globos',
          confidence: 0.95,
          suggestedSize: 'MEDIANO',
          candidates: ['Pixar UP', 'Carl Fredricksen'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'Debe reconocer UP legítimo');
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].baseTitle, 'UP');
    });

    it('4.3 Obra legítima "300" de Zack Snyder se reconoce con éxito', async () => {
      const testKey = 'AQ.challenger2_legit_300';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: '300',
          franchiseOrCategory: 'CINE',
          visualAnalysis: 'Póster de la película 300 con el rey Leónidas y su ejército espartano',
          confidence: 0.95,
          suggestedSize: 'GRANDE',
          candidates: ['300 Leónidas', 'Esparta'],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'Debe reconocer 300 legítimo');
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].baseTitle, '300');
      assert.strictEqual(res.items[0].sizeId, 'GRANDE');
      assert.strictEqual(res.total, 125);
    });

    it('4.4 Obra legítima "300" en consulta exacta se reconoce con éxito', async () => {
      const testKey = 'AQ.challenger2_legit_300_exact';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: '300',
          visualAnalysis: 'Póster de 300 Leónidas',
          confidence: 0.95,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'Debe reconocer 300 en consulta exacta');
      assert.ok(res.draftSale !== null);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].baseTitle, '300');
    });

    it('4.5 Fuzzing de fuga de tokens de tamaño: "Obra Desconocida Mediano" NO debe emparejar con "IT" por la palabra "Mediano"', async () => {
      const testKey = 'AQ.challenger2_size_token_leakage';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Obra Desconocida Mediano',
          visualAnalysis: 'Póster con dibujo abstracto no catalogado',
          confidence: 0.90,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'No debe validar falsamente por coincidencia del token "Mediano"');
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
    });
  });

  describe('🔍 5. Fuzzing Adversarial de Substrings en Catálogo Local (R1)', () => {
    const SUBSTRING_ATTACKS = [
      // Substrings accidentales de "IT"
      { query: 'Traditional Japanese Tonkotsu Ramen', shouldMatch: null },
      { query: 'Edición Limitada Coleccionista', shouldMatch: null },
      { query: 'Titán de Ataque', shouldMatch: null },
      { query: 'Hábito de lectura', shouldMatch: null },
      { query: 'Guitarra eléctrica vintage', shouldMatch: null },
      { query: 'Visitante del espacio', shouldMatch: null },
      { query: 'Capítulo veintidós', shouldMatch: null },
      // Substrings accidentales de "UP"
      { query: 'Super Mario Bros Colección', shouldMatch: null },
      { query: 'Grupo musical de rock', shouldMatch: null },
      { query: 'Ocupado en el trabajo', shouldMatch: null },
      { query: 'Guapo galán de cine', shouldMatch: null },
      // Substrings accidentales de "300"
      { query: '1300 A.C. Antiguo Egipto', shouldMatch: null },
      { query: '3000 Millas al cielo', shouldMatch: null },
      { query: 'Carrera a 300km por hora', shouldMatch: null },
      // Substrings accidentales de "EL"
      { query: 'Circuito Eléctrico', shouldMatch: null },
      { query: 'Hotel de lujo en la playa', shouldMatch: null },
      { query: 'Peluche gigante de felpa', shouldMatch: null },
    ];

    for (let i = 0; i < SUBSTRING_ATTACKS.length; i++) {
      const sa = SUBSTRING_ATTACKS[i];
      it(`5.${i + 1} Rechaza substring accidental: "${sa.query}"`, async () => {
        const localMatch = await findLocalMatch(sa.query, ADVERSARIAL_MOCK_CATALOG);
        assert.strictEqual(localMatch, null, `findLocalMatch no debe emparejar "${sa.query}" con ningún producto corto`);

        const everywhereMatch = await matchPosterEverywhere(TENANT_ID, sa.query);
        assert.strictEqual(everywhereMatch, null, `matchPosterEverywhere debe retornar null para "${sa.query}"`);
      });
    }
  });

  describe('🚨 6. Pruebas de Estrés en Fronteras y Casos de Esquina', () => {
    it('6.1 Confianza menor a 0.60 rechaza la detección de forma segura', async () => {
      const testKey = 'AQ.challenger2_low_confidence';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Spider-Man Vintage Comic',
          visualAnalysis: 'Imagen borrosa e ininteligible',
          confidence: 0.55,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'Confianza < 0.60 debe ser rechazada');
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
    });

    it('6.2 Título vacío o solo espacios en blanco rechaza limpiamente sin arrojar excepción', async () => {
      const testKey = 'AQ.challenger2_empty_title';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: '   ',
          visualAnalysis: 'Fondo blanco sin elementos reconocibles',
          confidence: 0.80,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
    });

    it('6.3 Caracteres especiales extremos y acentos en mayúsculas se filtran correctamente', async () => {
      const testKey = 'AQ.challenger2_uppercase_accents';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: '¡¡¡RÁMEN CALDÓ Y FÍDÉOS!!!',
          visualAnalysis: 'GASTRONOMÍA JAPONESA CON CALDOS CALIENTES',
          confidence: 0.95,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyBuffer,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
    });
  });
});
