import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_SIZES,
  CANONICAL_PRICE_MAP,
  SEED_POSTERS,
  getLocalCatalog,
  saveCatalogSnapshot,
  searchLocalCatalog,
  searchPostersWithFallback,
} from '../../src/services/catalogCacheService.js';

import {
  OPUS_BITRATE,
  getSupportedAudioMimeType,
  createOpusMediaRecorder,
  setupAudioAnalyser,
  calculateDecibelsAndLevel,
} from '../../src/components/ai-chat/hooks/useAiChatAudio.js';

describe('Catalog Cache Service & Audio Satellite Suite (M2)', () => {
  let memoryStore = {};

  beforeEach(() => {
    memoryStore = {};
    global.localStorage = {
      getItem: (key) => memoryStore[key] || null,
      setItem: (key, val) => { memoryStore[key] = String(val); },
      removeItem: (key) => { delete memoryStore[key]; },
      clear: () => { memoryStore = {}; },
    };
  });

  afterEach(() => {
    delete global.localStorage;
  });

  describe('1. Precios y Tamaños Canónicos', () => {
    it('1.1. CANONICAL_SIZES contiene exactamente 6 tamaños oficiales', () => {
      assert.equal(CANONICAL_SIZES.length, 6);
      const ids = CANONICAL_SIZES.map((s) => s.sizeId);
      assert.deepEqual(ids, ['MINI', 'PEQUENO', 'PORTADA_ALBUM', 'MEDIANO', 'GRANDE', 'GIGANTE']);
    });

    it('1.2. CANONICAL_PRICE_MAP coincide con los precios oficiales de STAND IA', () => {
      assert.equal(CANONICAL_PRICE_MAP.MINI, 25);
      assert.equal(CANONICAL_PRICE_MAP.PEQUENO, 35);
      assert.equal(CANONICAL_PRICE_MAP.PORTADA_ALBUM, 55);
      assert.equal(CANONICAL_PRICE_MAP.MEDIANO, 65);
      assert.equal(CANONICAL_PRICE_MAP.GRANDE, 125);
      assert.equal(CANONICAL_PRICE_MAP.GIGANTE, 180);
    });

    it('1.3. Cada elemento de CANONICAL_SIZES concuerda con CANONICAL_PRICE_MAP', () => {
      for (const size of CANONICAL_SIZES) {
        assert.equal(size.precio, CANONICAL_PRICE_MAP[size.sizeId]);
      }
    });

    it('1.4. SEED_POSTERS contiene 8 obras de referencia con tamaños canónicos', () => {
      assert.equal(SEED_POSTERS.length, 8);
      for (const poster of SEED_POSTERS) {
        assert.ok(poster.id, 'Póster debe tener id');
        assert.ok(poster.titulo, 'Póster debe tener título');
        assert.ok(poster.categoria, 'Póster debe tener categoría');
        assert.equal(poster.precioMinimo, 25);
        assert.equal(poster.sizes.length, 6);
      }
    });
  });

  describe('2. Búsqueda Local en Snapshot y Catálogo Semilla', () => {
    it('2.1. getLocalCatalog retorna SEED_POSTERS cuando localStorage está vacío', () => {
      const catalog = getLocalCatalog();
      assert.deepEqual(catalog, SEED_POSTERS);
    });

    it('2.2. searchLocalCatalog con consulta vacía retorna los primeros N elementos', () => {
      const results = searchLocalCatalog('', 4);
      assert.equal(results.length, 4);
      assert.equal(results[0].id, 'off-1');
    });

    it('2.3. searchLocalCatalog busca insensible a mayúsculas por título, subtítulo o categoría', () => {
      const animeResults = searchLocalCatalog('anime');
      assert.ok(animeResults.length >= 2);
      assert.ok(animeResults.some((p) => p.titulo === 'Chainsaw Man'));
      assert.ok(animeResults.some((p) => p.titulo === 'Dragon Ball Z'));

      const milesResults = searchLocalCatalog('miles morales');
      assert.equal(milesResults.length, 1);
      assert.equal(milesResults[0].titulo, 'Spider-Man');

      const darthResults = searchLocalCatalog('darth vader');
      assert.equal(darthResults.length, 1);
      assert.equal(darthResults[0].titulo, 'Star Wars');
    });

    it('2.4. searchLocalCatalog retorna arreglo vacío si no hay coincidencias', () => {
      const results = searchLocalCatalog('terminator judas priest');
      assert.equal(results.length, 0);
    });
  });

  describe('3. Persistencia, Normalización y Tolerancia a Fallos en Snapshot', () => {
    it('3.1. saveCatalogSnapshot guarda y normaliza pósters en localStorage', () => {
      const rawPosters = [
        { id: 'custom-1', name: 'Goku Ultra Instinct', category: 'ANIME', price: 65 },
        { id: 'custom-2', titulo: 'Naruto Shippuden', subtitulo: 'Hokage', categoria: 'ANIME' },
      ];
      saveCatalogSnapshot(rawPosters);

      const catalog = getLocalCatalog();
      assert.equal(catalog.length, 2);
      assert.equal(catalog[0].id, 'custom-1');
      assert.equal(catalog[0].titulo, 'Goku Ultra Instinct');
      assert.equal(catalog[0].categoria, 'ANIME');
      assert.equal(catalog[0].sizes.length, 6);
      assert.equal(catalog[1].id, 'custom-2');
      assert.equal(catalog[1].titulo, 'Naruto Shippuden');
    });

    it('3.2. getLocalCatalog recupera SEED_POSTERS si el JSON en localStorage está corrupto', () => {
      memoryStore['deko_local_catalog_snapshot_v1'] = '{ invalid-json :::';
      const catalog = getLocalCatalog();
      assert.deepEqual(catalog, SEED_POSTERS);
    });

    it('3.3. saveCatalogSnapshot y getLocalCatalog operan sin error si localStorage es undefined', () => {
      delete global.localStorage;
      assert.doesNotThrow(() => saveCatalogSnapshot([{ id: 'x', titulo: 'Test' }]));
      const catalog = getLocalCatalog();
      assert.deepEqual(catalog, SEED_POSTERS);
    });

    it('3.4. saveCatalogSnapshot acumula pósters en llamadas sucesivas sin sobreescritura destructiva', () => {
      saveCatalogSnapshot([{ id: 'p-1', titulo: 'Póster 1' }, { id: 'p-2', titulo: 'Póster 2' }]);
      saveCatalogSnapshot([{ id: 'p-3', titulo: 'Póster 3' }]);
      const catalog = getLocalCatalog();
      assert.equal(catalog.length, 3);
      assert.ok(catalog.some((p) => p.id === 'p-1'));
      assert.ok(catalog.some((p) => p.id === 'p-2'));
      assert.ok(catalog.some((p) => p.id === 'p-3'));
    });

    it('3.5. saveCatalogSnapshot respeta el tope FIFO de 300 obras', () => {
      const largeBatch = Array.from({ length: 350 }, (_, i) => ({ id: `bulk-${i}`, titulo: `Bulk ${i}` }));
      saveCatalogSnapshot(largeBatch);
      const catalog = getLocalCatalog();
      assert.equal(catalog.length, 300);
      assert.equal(catalog[0].id, 'bulk-50');
      assert.equal(catalog[299].id, 'bulk-349');
    });

    it('3.6. saveCatalogSnapshot retiene y prioriza obras destacadas (#CAT-001)', () => {
      const largeBatch = Array.from({ length: 350 }, (_, i) => ({
        id: `bulk-${i}`,
        titulo: `Bulk ${i}`,
        destacado: i === 0 || i === 5,
        totalVentas: i === 0 ? 120 : i === 5 ? 80 : 0,
      }));
      saveCatalogSnapshot(largeBatch);
      const catalog = getLocalCatalog();
      assert.equal(catalog.length, 300);
      assert.ok(catalog.some((p) => p.id === 'bulk-0'), 'bulk-0 destacado debe ser retenido');
      assert.ok(catalog.some((p) => p.id === 'bulk-5'), 'bulk-5 destacado debe ser retenido');
    });
  });

  describe('4. Resiliencia de Red y Fallback con Timeout de 2 Segundos', () => {
    it('4.1. searchPostersWithFallback retorna datos de red y actualiza caché si la red responde a tiempo', async () => {
      const mockNetworkPosters = [
        { id: 'net-1', titulo: 'Attack on Titan', subtitulo: 'Eren Jaeger', categoria: 'ANIME', precioMinimo: 25 },
      ];
      const fetchFn = async () => mockNetworkPosters;

      const results = await searchPostersWithFallback(fetchFn, 'titan', 8, 2000);
      assert.deepEqual(results, mockNetworkPosters);

      const cached = getLocalCatalog();
      assert.equal(cached[0].id, 'net-1');
      assert.equal(cached[0].titulo, 'Attack on Titan');
    });

    it('4.2. searchPostersWithFallback cae en el snapshot local si la red excede el timeout', async () => {
      const slowFetchFn = async (signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve([{ id: 'too-late', titulo: 'Tardío' }]), 100);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      };

      const results = await searchPostersWithFallback(slowFetchFn, 'batman', 8, 20);
      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 1);
      assert.equal(results[0].titulo, 'Batman');
    });

    it('4.3. searchPostersWithFallback cae en el snapshot local si fetchFn arroja un error de red', async () => {
      const failingFetch = async () => {
        throw new Error('Failed to fetch: Connection refused');
      };

      const results = await searchPostersWithFallback(failingFetch, 'spider', 8, 2000);
      assert.ok(Array.isArray(results));
      assert.equal(results[0].titulo, 'Spider-Man');
    });
  });

  describe('5. Satélite de Audio (useAiChatAudio)', () => {
    it('5.1. OPUS_BITRATE está fijado exactamente en 24000', () => {
      assert.equal(OPUS_BITRATE, 24000);
    });

    it('5.2. calculateDecibelsAndLevel maneja entradas vacías o nulas', () => {
      assert.deepEqual(calculateDecibelsAndLevel(null, null), { rms: 0, level: 0 });
    });

    it('5.3. calculateDecibelsAndLevel calcula RMS y escala 0-100 con buffer de audio simulado', () => {
      const mockAnalyser = {
        getFloatTimeDomainData: (buf) => {
          for (let i = 0; i < buf.length; i++) buf[i] = 0.05;
        },
      };
      const buffer = new Float32Array(512);
      const res = calculateDecibelsAndLevel(mockAnalyser, buffer);
      assert.ok(res.rms > 0.049 && res.rms < 0.051);
      assert.equal(res.level, 42);
    });

    it('5.4. calculateDecibelsAndLevel satura en 100 para sonidos muy fuertes', () => {
      const loudAnalyser = {
        getFloatTimeDomainData: (buf) => {
          for (let i = 0; i < buf.length; i++) buf[i] = 0.5;
        },
      };
      const buffer = new Float32Array(512);
      const res = calculateDecibelsAndLevel(loudAnalyser, buffer);
      assert.equal(res.level, 100);
    });

    it('5.5. createOpusMediaRecorder utiliza OPUS_BITRATE de 24000 y tolera navegadores antiguos', () => {
      class MockRecorder {
        constructor(stream, options) {
          this.stream = stream;
          this.options = options;
        }
      }
      global.MediaRecorder = MockRecorder;
      try {
        const stream = {};
        const rec = createOpusMediaRecorder(stream, 'audio/webm;codecs=opus');
        assert.equal(rec.options.audioBitsPerSecond, 24000);
        assert.equal(rec.options.mimeType, 'audio/webm;codecs=opus');
      } finally {
        delete global.MediaRecorder;
      }
    });

    it('5.6. setupAudioAnalyser inicializa Web Audio Analyser y buffer', () => {
      class MockAudioCtx {
        createMediaStreamSource() {
          return { connect: () => {} };
        }
        createAnalyser() {
          return { fftSize: 512, smoothingTimeConstant: 0.8 };
        }
      }
      const setup = setupAudioAnalyser({}, MockAudioCtx);
      assert.ok(setup);
      assert.equal(setup.buffer.length, 512);
      assert.equal(setup.analyser.fftSize, 512);
    });
  });
});
