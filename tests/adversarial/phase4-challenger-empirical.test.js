import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Import Phase 4 target modules
import * as catalogSyncService from '../../server/services/catalogSyncService.js';
import * as catalogSizeResolver from '../../server/services/catalog/catalogSizeResolver.js';
import * as catalogCacheStore from '../../server/services/catalog/catalogCacheStore.js';
import * as catalogStringNormalizer from '../../server/services/catalog/catalogStringNormalizer.js';
import * as webCatalogService from '../../server/services/webCatalogService.js';
import * as eventController from '../../server/controllers/eventController.js';
import * as catalogController from '../../server/controllers/catalogController.js';
import * as aiController from '../../server/controllers/aiController.js';
import * as aiChatController from '../../server/controllers/ai/aiChatController.js';
import * as aiMediaController from '../../server/controllers/ai/aiMediaController.js';
import * as saleController from '../../server/controllers/saleController.js';
import * as cashClosingController from '../../server/controllers/cashClosingController.js';
import * as saleKpiService from '../../server/services/sales/saleKpiService.js';
import * as monitorKpiService from '../../server/services/sales/monitorKpiService.js';
import * as saleTransactionService from '../../server/services/sales/saleTransactionService.js';
import * as saleUpdateService from '../../server/services/sales/saleUpdateService.js';
import * as userEventAssignmentService from '../../server/services/userEventAssignmentService.js';
import * as userController from '../../server/controllers/userController.js';

describe('⚔️ ADVERSARIAL EMPIRICAL CHALLENGER: FASE 4 ARCHITECTURE & MODULAR INTEGRITY', () => {

  // =========================================================================
  // BLOQUE 1: CUMPLIMIENTO MILIMÉTRICO DE TECHOS DE LÍNEAS
  // =========================================================================
  describe('1. Cumplimiento Milimétrico de Techos de Líneas (Fase 4)', () => {
    const fileCeilings = [
      { file: 'server/services/catalog/catalogSizeResolver.js', max: 80 },
      { file: 'server/services/catalog/liveCatalogSyncService.js', max: 200 },
      { file: 'server/services/catalogSyncService.js', max: 25 },
      { file: 'server/services/catalog/catalogCacheStore.js', max: 110 },
      { file: 'server/services/catalog/catalogStringNormalizer.js', max: 130 },
      { file: 'server/services/webCatalogService.js', max: 180 },
      { file: 'server/controllers/eventController.js', max: 190 },
      { file: 'server/controllers/catalogController.js', max: 90 },
      { file: 'server/controllers/ai/aiChatController.js', max: 170 },
      { file: 'server/controllers/ai/aiMediaController.js', max: 180 },
      { file: 'server/controllers/aiController.js', max: 30 },
      { file: 'server/controllers/saleController.js', max: 160 },
      { file: 'server/services/sales/monitorKpiService.js', max: 130 },
      { file: 'server/services/sales/saleKpiService.js', max: 190 },
      { file: 'server/services/sales/saleUpdateService.js', max: 170 },
      { file: 'server/services/sales/saleTransactionService.js', max: 170 },
      { file: 'server/services/userEventAssignmentService.js', max: 80 },
      { file: 'server/controllers/userController.js', max: 170 },
      { file: 'src/components/sales/RecentSaleRow.jsx', max: 90 },
      { file: 'src/components/RecentSalesList.jsx', max: 130 },
    ];

    for (const { file, max } of fileCeilings) {
      it(`1.x ${file} debe existir y tener <= ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `Archivo no encontrado: ${file}`);
        const lineCount = fs.readFileSync(fullPath, 'utf-8').split('\n').length;
        assert.ok(
          lineCount <= max,
          `Exceso de líneas en ${file}: ${lineCount} (límite máximo permitido: ${max})`
        );
      });
    }
  });

  // =========================================================================
  // BLOQUE 2: CATÁLOGO Y RETROCOMPATIBILIDAD DE FACHADAS (EJE A & B.1)
  // =========================================================================
  describe('2. Integridad de Sincronización y Normalización de Catálogo', () => {

    it('2.1 catalogSyncService reexporta fielmente todos los símbolos de catalogSizeResolver y liveCatalogSyncService', () => {
      assert.equal(typeof catalogSyncService.resolvePosterSizes, 'function');
      assert.ok(Array.isArray(catalogSyncService.STANDARD_EVENT_SIZES));
      assert.ok(typeof catalogSyncService.ALBUM_COVER_SIZE === 'object');
      assert.equal(typeof catalogSyncService.syncCatalogFromWeb, 'function');
      assert.equal(typeof catalogSyncService.normalizeAndUpsertPoster, 'function');
      assert.equal(typeof catalogSyncService.deltaSyncRecentPosters, 'function');
      assert.equal(typeof catalogSyncService.searchLiveWebParachute, 'function');
    });

    it('2.2 resolvePosterSizes sobrevive a entradas hostiles (null, undefined, malformados)', () => {
      // Entradas vacías / nulas
      const resNull = catalogSizeResolver.resolvePosterSizes(null);
      assert.ok(Array.isArray(resNull));
      assert.equal(resNull.length, catalogSizeResolver.STANDARD_EVENT_SIZES.length);

      const resEmpty = catalogSizeResolver.resolvePosterSizes({});
      assert.ok(Array.isArray(resEmpty));
      assert.equal(resEmpty.length, catalogSizeResolver.STANDARD_EVENT_SIZES.length);

      // Entradas con datos corruptos
      const corrupted = { sizes: [{ size: null, price: 'invalido' }, { foo: 'bar' }] };
      const resCorrupted = catalogSizeResolver.resolvePosterSizes(corrupted);
      assert.ok(Array.isArray(resCorrupted));
      assert.ok(resCorrupted.length > 0);

      // Portada de álbum
      const resAlbum = catalogSizeResolver.resolvePosterSizes({ availableSizes: ['PORTADA_ALBUM'] });
      assert.equal(resAlbum.length, 1);
      assert.equal(resAlbum[0].sizeId, 'PORTADA_ALBUM');
      assert.equal(resAlbum[0].precio, 55);
    });

    it('2.3 catalogCacheStore garantiza aislamiento estricto entre tenants y soporte TTL', async () => {
      const tenantA = 'tenant-test-a-' + Date.now();
      const tenantB = 'tenant-test-b-' + Date.now();

      // Invalida ambos
      catalogCacheStore.invalidateCatalogCache(tenantA);
      catalogCacheStore.invalidateCatalogCache(tenantB);

      // Setea manualmente en el Map expuesto
      catalogCacheStore.productCache.set(tenantA, {
        timestamp: Date.now(),
        data: [{ id: 'pA', titulo: 'Obra A' }],
      });
      catalogCacheStore.productCache.set(tenantB, {
        timestamp: Date.now(),
        data: [{ id: 'pB', titulo: 'Obra B' }],
      });

      assert.equal(catalogCacheStore.productCache.get(tenantA).data[0].id, 'pA');
      assert.equal(catalogCacheStore.productCache.get(tenantB).data[0].id, 'pB');

      // Invalidación selectiva de tenantA no borra tenantB
      catalogCacheStore.invalidateCatalogCache(tenantA);
      assert.equal(catalogCacheStore.productCache.has(tenantA), false);
      assert.equal(catalogCacheStore.productCache.has(tenantB), true);

      // Invalidación total (null)
      catalogCacheStore.invalidateCatalogCache(null);
      assert.equal(catalogCacheStore.productCache.has(tenantB), false);
    });

    it('2.4 catalogStringNormalizer maneja strings hostiles y deduplica correctamente', () => {
      // Slugs patológicos
      assert.equal(catalogStringNormalizer.extractImageSlug(''), null);
      assert.equal(catalogStringNormalizer.extractImageSlug(null), null);
      assert.equal(
        catalogStringNormalizer.extractImageSlug('https://bucket.gcs.com/photos/batman-dark-knight-400x600.webp?v=123'),
        'batman-dark-knight'
      );

      // Normalización de títulos con acentos y caracteres raros
      assert.equal(catalogStringNormalizer.normalizePosterTitle('¡El Señor de los Anillos: Las Dos Torres!'), 'el senor de los anillos las dos torres');
      assert.equal(catalogStringNormalizer.normalizePosterTitle(null), '');

      // Deduplicación bicapa
      const duplicates = [
        { id: '1', titulo: 'Spider-Man Vintage', imageUrl: 'https://img.com/spider-vintage.webp' },
        { id: '1', titulo: 'Spider-Man Vintage', imageUrl: 'https://img.com/spider-vintage.webp' }, // Duplicado id
        { id: '2', titulo: 'Spider-Man Retro', imageUrl: 'https://img.com/spider-vintage-300x400.webp' }, // Duplicado slug imagen
        { id: '3', titulo: 'Spider Man Vintage', imageUrl: 'https://img.com/otra.webp' }, // Duplicado título normalizado
        { id: '4', titulo: 'Batman Begins', imageUrl: 'https://img.com/batman.webp' }, // Único
      ];
      const deduped = catalogStringNormalizer.deduplicatePosters(duplicates);
      assert.equal(deduped.length, 2);
      assert.equal(deduped[0].id, '1');
      assert.equal(deduped[1].id, '4');
    });
  });

  // =========================================================================
  // BLOQUE 3: CONTROLADORES DE EVENTOS Y CATÁLOGO (EJE B.2 & B.3)
  // =========================================================================
  describe('3. Despiece de Controladores: Catálogo vs Eventos vs IA', () => {

    it('3.1 catalogController exporta exclusivamente funciones de catálogo', () => {
      assert.equal(typeof catalogController.getProducts, 'function');
      assert.equal(typeof catalogController.searchWebPostersCatalog, 'function');
      assert.equal(typeof catalogController.triggerCatalogSync, 'function');
      // No debe contener funciones de eventos
      assert.equal(catalogController.getActiveEvent, undefined);
      assert.equal(catalogController.getEventsList, undefined);
      assert.equal(catalogController.createEvent, undefined);
    });

    it('3.2 eventController exporta todas las operaciones del ciclo de vida de eventos', () => {
      assert.equal(typeof eventController.getActiveEvent, 'function');
      assert.equal(typeof eventController.getEventsList, 'function');
      assert.equal(typeof eventController.createEvent, 'function');
      assert.equal(typeof eventController.activateEvent, 'function');
      assert.equal(typeof eventController.archiveEvent, 'function');
      assert.equal(typeof eventController.unarchiveEvent, 'function');
      assert.equal(typeof eventController.deleteEvent, 'function');
    });

    it('3.3 aiController actúa como fachada reexportadora limpia para SSE y medios', () => {
      assert.equal(typeof aiController.handleChatQuery, 'function');
      assert.equal(typeof aiController.handleVoiceSale, 'function');
      assert.equal(typeof aiController.handleBatchPhoto, 'function');
      assert.equal(typeof aiController.handleArtworkRecognition, 'function');
      assert.equal(typeof aiController.handleVideoRecognition, 'function');

      // Coincidencia con controladores subyacentes
      assert.strictEqual(aiController.handleChatQuery, aiChatController.handleChatQuery);
      assert.strictEqual(aiController.handleVoiceSale, aiMediaController.handleVoiceSale);
      assert.strictEqual(aiController.handleBatchPhoto, aiMediaController.handleBatchPhoto);
    });
  });

  // =========================================================================
  // BLOQUE 4: VENTAS, ARQUEOS Y ASIGNACIÓN DE USUARIOS (EJE B.4 & B.5)
  // =========================================================================
  describe('4. Despiece de Servicios y Controladores de Ventas y Usuarios', () => {

    it('4.1 saleController reexporta arqueos de caja desde cashClosingController', () => {
      assert.equal(typeof saleController.postCashClosing, 'function');
      assert.equal(typeof saleController.getCashClosingsList, 'function');
      assert.strictEqual(saleController.postCashClosing, cashClosingController.postCashClosing);
      assert.strictEqual(saleController.getCashClosingsList, cashClosingController.getCashClosingsList);
    });

    it('4.2 saleKpiService reexporta getMonitorDashboardMetrics desde monitorKpiService', () => {
      assert.equal(typeof saleKpiService.getMonitorDashboardMetrics, 'function');
      assert.strictEqual(saleKpiService.getMonitorDashboardMetrics, monitorKpiService.getMonitorDashboardMetrics);
    });

    it('4.3 saleTransactionService reexporta updateSaleTransaction desde saleUpdateService', () => {
      assert.equal(typeof saleTransactionService.updateSaleTransaction, 'function');
      assert.strictEqual(saleTransactionService.updateSaleTransaction, saleUpdateService.updateSaleTransaction);
    });

    it('4.4 userController y userEventAssignmentService validan roles y asignaciones', () => {
      const roles1 = userEventAssignmentService.resolveTargetRoles(['VENDEDOR'], null);
      assert.deepEqual(roles1, ['VENDEDOR']);

      const roles2 = userEventAssignmentService.resolveTargetRoles(null, 'SUPER_ADMIN');
      assert.deepEqual(roles2, ['SUPER_ADMIN']);

      const rolesEmpty = userEventAssignmentService.resolveTargetRoles([], null);
      assert.deepEqual(rolesEmpty, []);
    });

    it('4.5 getGuatemalaDayRange calcula bordes de tiempo precisos UTC-6', () => {
      const { targetDate, startOfDay, endOfDay } = saleKpiService.getGuatemalaDayRange('2026-09-15');
      assert.equal(targetDate, '2026-09-15');
      assert.ok(startOfDay instanceof Date);
      assert.ok(endOfDay instanceof Date);
      assert.ok(startOfDay.getTime() < endOfDay.getTime());
    });
  });

  // =========================================================================
  // BLOQUE 5: FRONTEND MODULAR RECENT SALES LIST Y LIMPIEZA DE TIMERS (EJE B.6)
  // =========================================================================
  describe('5. Frontend Modular: RecentSalesList & RecentSaleRow', () => {

    it('5.1 RecentSalesList.jsx implementa useRef para toastTimer y cleanup en useEffect', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/RecentSalesList.jsx'), 'utf-8');
      assert.match(content, /toastTimerRef\s*=\s*useRef/);
      assert.match(content, /clearTimeout\(toastTimerRef\.current\)/);
      assert.match(content, /import\s+RecentSaleRow\s+from/);
    });

    it('5.2 RecentSaleRow.jsx exporta componente funcional por defecto', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      assert.match(content, /export\s+default\s+function\s+RecentSaleRow/);
      assert.match(content, /isSaleFromToday/);
      assert.match(content, /formatSaleTime/);
      assert.match(content, /getPaymentBadge/);
    });
  });
});
