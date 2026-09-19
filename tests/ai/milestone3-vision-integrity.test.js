import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { matchPosterEverywhere, findLocalMatch, matchesCatalogWordBoundary } from '../../server/services/catalog/webCatalogService.js';
import { recognizePosterArtworkFromImage } from '../../server/services/ai/aiMediaService.js';
import { resetKeyPool, getClientForKey } from '../../server/services/ai/aiKeyPoolService.js';

const MOCK_CATALOG = [
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
    tenantId: 't-m3-eval',
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
    tenantId: 't-m3-eval',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
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
    tags: ['spiderman', 'spider', 'man', 'marvel', 'comic'],
    isActive: true,
    tenantId: 't-m3-eval',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-starry-night-1',
    sku: 'DV-VANG-01',
    name: 'La Noche Estrellada',
    titulo: 'La Noche Estrellada',
    category: 'ARTE',
    categoria: 'ARTE',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/starry.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/starry.webp',
    tags: ['van gogh', 'arte', 'noche', 'estrellada'],
    isActive: true,
    tenantId: 't-m3-eval',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
  {
    id: 'prod-alien-1',
    sku: 'DV-ALN-01',
    name: 'Alien el Octavo Pasajero',
    titulo: 'Alien el Octavo Pasajero',
    category: 'CINE',
    categoria: 'CINE',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/alien.webp',
    thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/alien.webp',
    tags: ['alien', 'cine', 'terror', 'espacio'],
    isActive: true,
    tenantId: 't-m3-eval',
    sizes: [
      { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
    ],
  },
];

describe('🛡️ MILESTONE 3 INTEGRITY: Erradicación del Falso Positivo en Visión & Blindaje Léxico ("Bug del Ramen")', () => {
  const TENANT_ID = 't-m3-eval';
  const dummyImage = Buffer.from('FAKE_IMAGE_BYTES_FOR_M3_TEST');
  let originalPrismaFindMany;
  let originalPrismaFindFirst;
  let originalPrismaAuditCreate;

  beforeEach(() => {
    resetKeyPool();
    invalidateCatalogCache(TENANT_ID);

    if (prisma?.product) {
      originalPrismaFindMany = prisma.product.findMany;
      originalPrismaFindFirst = prisma.product.findFirst;
      prisma.product.findMany = async () => MOCK_CATALOG;
      prisma.product.findFirst = async () => null;
    }
    if (prisma?.auditLog) {
      originalPrismaAuditCreate = prisma.auditLog.create;
      prisma.auditLog.create = async () => ({ id: 'mock-audit' });
    }

    productCache.set(TENANT_ID, {
      timestamp: Date.now(),
      products: MOCK_CATALOG,
    });
  });

  afterEach(() => {
    invalidateCatalogCache(TENANT_ID);
    if (prisma?.product && originalPrismaFindMany) {
      prisma.product.findMany = originalPrismaFindMany;
      prisma.product.findFirst = originalPrismaFindFirst;
    }
    if (prisma?.auditLog && originalPrismaAuditCreate) {
      prisma.auditLog.create = originalPrismaAuditCreate;
    }
  });

  describe('1. Substring Corto y Protección de Nombres Cortos (< 4 caracteres)', () => {
    it('1.1 Helper matchesCatalogWordBoundary rechaza subcadenas internas y aprueba palabras completas', () => {
      assert.strictEqual(matchesCatalogWordBoundary('traditional japanese tonkotsu ramen', 'it'), false);
      assert.strictEqual(matchesCatalogWordBoundary('edicion limitada', 'it'), false);
      assert.strictEqual(matchesCatalogWordBoundary('cafe caliente', 'alien'), false);
      assert.strictEqual(matchesCatalogWordBoundary('super mario bros', 'up'), false);

      assert.strictEqual(matchesCatalogWordBoundary('quiero el poster de it', 'it'), true);
      assert.strictEqual(matchesCatalogWordBoundary('it', 'it'), true);
      assert.strictEqual(matchesCatalogWordBoundary('poster de up en grande', 'up'), true);
      assert.strictEqual(matchesCatalogWordBoundary('pelicula alien', 'alien'), true);
    });

    it('1.2 "Traditional Japanese Tonkotsu Ramen" retorna null y JAMÁS coincide con "IT"', async () => {
      const directLocal = await findLocalMatch('Traditional Japanese Tonkotsu Ramen', MOCK_CATALOG);
      assert.strictEqual(directLocal, null, 'findLocalMatch no debe emparejar "traditional" con "IT"');

      const fullRes = await matchPosterEverywhere(TENANT_ID, 'Traditional Japanese Tonkotsu Ramen');
      assert.strictEqual(fullRes, null, 'matchPosterEverywhere debe retornar null para ramen');
    });

    it('1.3 "Edición Limitada" retorna null y JAMÁS coincide con "IT"', async () => {
      const directLocal = await findLocalMatch('Edición Limitada', MOCK_CATALOG);
      assert.strictEqual(directLocal, null, 'findLocalMatch no debe emparejar "limitada" con "IT"');

      const fullRes = await matchPosterEverywhere(TENANT_ID, 'Edición Limitada');
      assert.strictEqual(fullRes, null, 'matchPosterEverywhere debe retornar null para edición limitada');
    });

    it('1.4 "Super Mario Bros" retorna null y JAMÁS coincide con "UP"', async () => {
      const directLocal = await findLocalMatch('Super Mario Bros', MOCK_CATALOG);
      assert.strictEqual(directLocal, null, 'findLocalMatch no debe emparejar "super" con "UP"');

      const fullRes = await matchPosterEverywhere(TENANT_ID, 'Super Mario Bros');
      assert.strictEqual(fullRes, null);
    });

    it('1.5 "Café caliente" retorna null y JAMÁS coincide con "Alien"', async () => {
      const directLocal = await findLocalMatch('Café caliente', MOCK_CATALOG);
      assert.strictEqual(directLocal, null, 'findLocalMatch no debe emparejar "caliente" con "Alien"');
    });
  });

  describe('2. Palabra Completa Legítima y Preservación de Obras Cortas', () => {
    it('2.1 "Quiero el póster de IT" coincide legítimamente con "IT"', async () => {
      const res = await matchPosterEverywhere(TENANT_ID, 'Quiero el póster de IT');
      assert.ok(res !== null, 'Debe encontrar el póster de IT');
      assert.strictEqual(res.baseTitle, 'IT');
      assert.strictEqual(res.sizeId, 'MEDIANO');
      assert.strictEqual(res.unitPrice, 65);
    });

    it('2.2 Consulta exacta "IT" coincide legítimamente con "IT"', async () => {
      const res = await matchPosterEverywhere(TENANT_ID, 'IT');
      assert.ok(res !== null);
      assert.strictEqual(res.baseTitle, 'IT');
    });

    it('2.3 "Póster de UP en Grande" coincide legítimamente con "UP" en tamaño GRANDE', async () => {
      const res = await matchPosterEverywhere(TENANT_ID, 'Póster de UP en Grande', 'GRANDE');
      assert.ok(res !== null);
      assert.strictEqual(res.baseTitle, 'UP');
      assert.strictEqual(res.sizeId, 'GRANDE');
      assert.strictEqual(res.unitPrice, 125);
    });

    it('2.4 Sobrecarga dual findLocalMatch(tenantId, clean, requestedSize) vs findLocalMatch(query, catalog)', async () => {
      const resDual1 = await findLocalMatch('Quiero el póster de IT', MOCK_CATALOG);
      assert.ok(resDual1 !== null);
      assert.strictEqual(resDual1.baseTitle, 'IT');

      const resDual2 = await findLocalMatch(TENANT_ID, 'Quiero el póster de IT', 'MEDIANO');
      assert.ok(resDual2 !== null);
      assert.strictEqual(resDual2.baseTitle, 'IT');
    });
  });

  describe('3. Obra Fuera de Giro y Filtro de Dominio Negativo en Visión', () => {
    it('3.1 Análisis de imagen con gastronomía/ramen retorna isArtworkDetected: false, draftSale: null, items: []', async () => {
      const testKey = 'AQ.test_ramen_vision_rejection';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Traditional Japanese Tonkotsu Ramen',
          visualAnalysis: 'Un tazón de caldo ramen con fideos, carne de cerdo y cebollín en mesa de restaurante',
          confidence: 0.95,
          suggestedSize: 'MEDIANO',
          candidates: [],
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'isArtworkDetected debe ser estrictamente false');
      assert.strictEqual(res.draftSale, null, 'draftSale debe ser estrictamente null');
      assert.strictEqual(res.items.length, 0, 'items debe ser array vacío');
      assert.strictEqual(res.total, 0, 'total debe ser 0');
      assert.strictEqual(res.matchedPoster, null, 'matchedPoster debe ser null');
      assert.ok(res.message.includes('no pertenece al catálogo oficial'));
    });

    it('3.2 Foto de comida rápida (hamburguesa) es rechazada sin buscar en catálogo', async () => {
      const testKey = 'AQ.test_burger_rejection';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Hamburguesa doble con papas',
          visualAnalysis: 'Una hamburguesa de carne con queso fundido y papas fritas',
          confidence: 0.92,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
      assert.strictEqual(res.total, 0);
    });

    it('3.3 Foto de calzado o ropa es rechazada por dominio negativo', async () => {
      const testKey = 'AQ.test_shoes_rejection';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Zapatillas deportivas Nike Air',
          visualAnalysis: 'Calzado deportivo sobre el piso de madera',
          confidence: 0.94,
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false);
      assert.strictEqual(res.draftSale, null);
    });
  });

  describe('4. Validación de Relevancia Cruzada y Obras Legítimas', () => {
    it('4.1 Validación de Relevancia Cruzada rechaza falsos positivos con 0% de solapamiento léxico', async () => {
      const testKey = 'AQ.test_cross_relevance_zero';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Ondas Geométricas Abstractas de Neón',
          visualAnalysis: 'Diseño geométrico moderno con ondas vectoriales moradas',
          confidence: 0.88,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, false, 'Debe rechazar por falta de relevancia cruzada con catálogo');
      assert.strictEqual(res.draftSale, null);
      assert.strictEqual(res.items.length, 0);
    });

    it('4.2 Foto de obra legítima ("IT") es reconocida exitosamente con su borrador', async () => {
      const testKey = 'AQ.test_valid_it_recognition';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'IT Pennywise Stephen King',
          visualAnalysis: 'Póster de la película IT con el payaso Pennywise sosteniendo un globo rojo',
          confidence: 0.96,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true, 'Debe detectar la obra legítima');
      assert.ok(res.draftSale !== null, 'draftSale debe existir');
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].baseTitle, 'IT');
      assert.strictEqual(res.total, 65);
    });

    it('4.3 Foto de obra legítima ("Spider-Man Vintage Comic") es reconocida exitosamente', async () => {
      const testKey = 'AQ.test_valid_spidey_recognition';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Spider-Man Vintage Comic',
          visualAnalysis: 'Portada clásica de cómic de Spider-Man trepando un edificio',
          confidence: 0.95,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true);
      assert.strictEqual(res.items[0].baseTitle, 'Spider-Man Vintage Comic');
    });

    it('4.4 Salvaguarda gráfica permite obras de arte con motivos gastronómicos legítimos', async () => {
      const testKey = 'AQ.test_ramen_art_safeguard';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          primaryTitle: 'Póster decorativo La Noche Estrellada con ramen',
          visualAnalysis: 'Cuadro ilustrado de arte gráfico con estilo Van Gogh',
          confidence: 0.91,
          suggestedSize: 'MEDIANO',
        }),
      });

      const res = await recognizePosterArtworkFromImage({
        imageBuffer: dummyImage,
        mimeType: 'image/jpeg',
        tenantId: TENANT_ID,
      });

      assert.strictEqual(res.isArtworkDetected, true);
      assert.strictEqual(res.items[0].baseTitle, 'La Noche Estrellada');
    });
  });
});
