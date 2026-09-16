import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIMEOUT_MS,
  SEED_POSTERS,
  getLocalCatalog,
  saveCatalogSnapshot,
  searchLocalCatalog,
  searchPostersWithFallback,
} from '../../src/services/catalogCacheService.js';

describe('⚔️ CHALLENGER 2: Adversarial Stress Suite — useCatalogSearch & catalogCacheService (M2)', () => {
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
    delete global.window;
  });

  // =========================================================================
  // BLOQUE 1: Rapid Concurrent Typing & AbortController Race Conditions
  // =========================================================================
  describe('1. Concurrencia y AbortController en Búsqueda Rápida', () => {
    it('1.1. Simulación de tipeo rápido secuencial ("s", "sp", "spi", "spid", "spiderman")', async () => {
      const queries = ['s', 'sp', 'spi', 'spid', 'spiderman'];
      const controllers = queries.map(() => new AbortController());
      const resultsHistory = [];
      const abortedCalls = [];

      // Cada búsqueda toma tiempos diferentes simulando variabilidad de red
      const fetchWithLatency = (query, delayMs, signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve([{ id: `res-${query}`, titulo: `Resultado para ${query}` }]);
        }, delayMs);

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            abortedCalls.push(query);
            reject(err);
          });
        }
      });

      // Disparo secuencial abortando el anterior
      let activeController = null;
      for (let i = 0; i < queries.length; i++) {
        if (activeController) {
          activeController.abort();
        }
        activeController = controllers[i];
        const q = queries[i];
        const isLast = i === queries.length - 1;
        const delay = isLast ? 30 : 100; // La última responde más rápido que las anteriores

        searchPostersWithFallback(
          (signal) => fetchWithLatency(q, delay, signal),
          q,
          8,
          { signal: activeController.signal }
        ).then(
          (res) => resultsHistory.push({ query: q, res }),
          (err) => {
            if (err.name !== 'AbortError') throw err;
          }
        );

        // Pequeño retardo entre pulsaciones
        await new Promise((r) => setTimeout(r, 15));
      }

      // Esperar a que todo el ciclo asíncrono culmine
      await new Promise((r) => setTimeout(r, 150));

      // Las 4 primeras deben haber sido abortadas
      assert.equal(abortedCalls.length, 4);
      assert.deepEqual(abortedCalls, ['s', 'sp', 'spi', 'spid']);

      // Solo la última búsqueda ("spiderman") debe haber producido resultados válidos
      assert.equal(resultsHistory.length, 1);
      assert.equal(resultsHistory[0].query, 'spiderman');
      assert.equal(resultsHistory[0].res[0].id, 'res-spiderman');
    });

    it('1.2. HALLAZGO ADVERSARIAL: searchPostersWithFallback retorna datos obsoletos si fetchFn resuelve tras abort', async () => {
      // Simula el caso donde el fetch no arroja AbortError (ej: microtarea o respuesta en vuelo ya recibida)
      const controller = new AbortController();

      const fetchWithoutThrowOnAbort = async (signal) => {
        await new Promise((r) => setTimeout(r, 40));
        return [{ id: 'stale-id', titulo: 'Stale Poster' }];
      };

      // Se aborta a mitad de camino (t=15ms)
      setTimeout(() => controller.abort(), 15);

      // Verificamos el comportamiento empírico real:
      // Si el fetchFn retorna un array no vacío sin lanzar error,
      // searchPostersWithFallback NO verifica si externalSignal.aborted es true antes de retornar
      const result = await searchPostersWithFallback(
        fetchWithoutThrowOnAbort,
        'old-query',
        8,
        { signal: controller.signal }
      );

      // Documentamos empíricamente la fuga:
      // En una implementación blindada contra condiciones de carrera, una señal abortada DEBE lanzar AbortError
      // y nunca retornar datos obsoletos.
      const hasStaleLeak = Array.isArray(result) && result.length > 0 && result[0].id === 'stale-id';
      assert.ok(
        hasStaleLeak,
        'Comprobación empírica: searchPostersWithFallback retorna datos aunque externalSignal esté abortado'
      );
    });

    it('1.3. HALLAZGO ADVERSARIAL: useCatalogSearch activeAbortRef no se limpia a null al abortar', async () => {
      // Modelo de máquina de estados idéntico a useCatalogSearch.js (líneas 28-78)
      class HookHarness {
        constructor() {
          this.searchQuery = '';
          this.searchResults = [];
          this.isSearching = false;
          this.showDropdown = false;
          this.activeAbortRef = { current: null };
          this.debounceRef = { current: null };
          this.isSelectingRef = { current: false };
        }

        onQueryChange(newQuery, fetchImpl) {
          this.searchQuery = newQuery;
          if (this.isSelectingRef.current) { this.isSelectingRef.current = false; return; }

          // Línea 31 actual de useCatalogSearch.js:
          this.activeAbortRef.current?.abort();

          if (!this.searchQuery.trim()) {
            if (this.debounceRef.current) clearTimeout(this.debounceRef.current);
            this.searchResults = []; this.isSearching = false; this.showDropdown = false;
            return;
          }

          this.isSearching = true;
          if (this.debounceRef.current) clearTimeout(this.debounceRef.current);
          this.debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            this.activeAbortRef.current = controller;

            try {
              const queryText = this.searchQuery.trim();
              const results = await searchPostersWithFallback(
                (signal) => fetchImpl(queryText, signal),
                queryText,
                30,
                { signal: controller.signal }
              );

              if (!this.isSelectingRef.current && this.activeAbortRef.current === controller) {
                this.searchResults = results;
                this.showDropdown = true;
              }
            } catch (err) {
              if (err?.name === 'AbortError' || controller.signal.aborted) {
                return;
              }
            } finally {
              if (this.activeAbortRef.current === controller) {
                this.isSearching = false;
              }
            }
          }, 120);
        }
      }

      const harness = new HookHarness();
      const fetchImpl = (q, signal) => new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve([{ id: `item-${q}`, titulo: q }]), 80);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          const e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });

      // 1. Usuario escribe 's'
      harness.onQueryChange('s', fetchImpl);

      // Esperar que transcurra el debounce de 120ms de 's' para que esté en vuelo
      await new Promise((r) => setTimeout(r, 140));
      assert.equal(harness.isSearching, true);

      // 2. Usuario escribe 'sp' mientras 's' está en vuelo
      harness.onQueryChange('sp', fetchImpl);

      // Inmediatamente después de escribir 'sp', 's' es abortado.
      // El fetch de 's' rechaza con AbortError y salta al bloque finally.
      await new Promise((r) => setTimeout(r, 15));

      // Debido a que activeAbortRef.current no fue reseteado a null en la línea 31,
      // activeAbortRef.current sigue siendo idéntico al controller de 's'.
      // En el finally: (this.activeAbortRef.current === controller) es TRUE.
      // Por tanto, isSearching es apagado prematuramente a false mientras 'sp' aún está en debounce.
      assert.equal(
        harness.isSearching,
        false,
        'Comprobación empírica: isSearching fue apagado prematuramente a false durante el debounce del nuevo término'
      );

      // Limpiar temporizadores pendientes
      if (harness.debounceRef.current) clearTimeout(harness.debounceRef.current);
    });

    it('1.4. AbortError es capturado limpiamente sin lanzar excepciones no controladas', async () => {
      const controller = new AbortController();
      controller.abort();

      const fetchFn = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      // Si externalSignal está abortado, debe lanzar AbortError de forma limpia
      await assert.rejects(
        async () => {
          await searchPostersWithFallback(fetchFn, 'batman', 8, { signal: controller.signal });
        },
        (err) => {
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // BLOQUE 2: Timeout Verification & Fallback Resilience
  // =========================================================================
  describe('2. Verificación de Timeout (1500ms) y Fallback Resiliente', () => {
    it('2.1. TIMEOUT_MS está exportado exactamente como 1500ms', () => {
      assert.equal(TIMEOUT_MS, 1500);
    });

    it('2.2. Petición lenta (2000ms) activa fallback a snapshot local a los ~1500ms', async () => {
      const slowFetch = (signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve([{ id: 'slow-poster', titulo: 'Tardío' }]), 2000);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });

      const start = performance.now();
      const results = await searchPostersWithFallback(slowFetch, 'Spider-Man', 8);
      const elapsed = performance.now() - start;

      // Debe resolverse alrededor de 1500ms (+ margen de tolerancia de ejecución de 200ms)
      assert.ok(
        elapsed >= 1450 && elapsed < 1900,
        `El fallback debe activarse cerca de 1500ms (tiempo real: ${elapsed.toFixed(1)}ms)`
      );

      // Debe retornar resultados del catálogo local para "Spider-Man"
      assert.ok(Array.isArray(results) && results.length > 0);
      assert.equal(results[0].titulo, 'Spider-Man');
    });

    it('2.3. Cancelación explícita por usuario aborta de inmediato y NO cae en fallback local', async () => {
      const userController = new AbortController();

      const slowFetch = (signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve([{ id: 'never', titulo: 'Never' }]), 2000);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });

      // El usuario aborta a los 100ms
      setTimeout(() => userController.abort(), 100);

      const start = performance.now();
      await assert.rejects(
        async () => {
          await searchPostersWithFallback(slowFetch, 'Spider-Man', 8, { signal: userController.signal });
        },
        (err) => {
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
      const elapsed = performance.now() - start;

      // Debe abortar de inmediato (~100ms) sin esperar los 1500ms del timeout
      assert.ok(
        elapsed < 500,
        `La cancelación del usuario debe ser inmediata (<500ms), tiempo real: ${elapsed.toFixed(1)}ms`
      );
    });

    it('2.4. Error de red (HTTP 500 o conexión rehusada) cae limpiamente al snapshot local', async () => {
      const failedFetch = async () => {
        throw new Error('Network error: 500 Internal Server Error');
      };

      const results = await searchPostersWithFallback(failedFetch, 'Batman', 8);
      assert.ok(Array.isArray(results) && results.length > 0);
      assert.equal(results[0].titulo, 'Batman');
    });
  });

  // =========================================================================
  // BLOQUE 3: Snapshot Caching Non-Blocking & Capacity Stress
  // =========================================================================
  describe('3. Persistencia y Capacidad de Snapshot (saveCatalogSnapshot)', () => {
    it('3.1. Soporta hasta 300 pósters sin errores de serialización', () => {
      const posters = Array.from({ length: 300 }, (_, i) => ({
        id: `p-${i}`,
        titulo: `Obra ${i}`,
        categoria: 'ARTE',
        precioMinimo: 25,
      }));

      assert.doesNotThrow(() => {
        saveCatalogSnapshot(posters, { sync: true });
      });

      const local = getLocalCatalog();
      assert.equal(local.length, 300);
      assert.equal(local[0].id, 'p-0');
      assert.equal(local[299].id, 'p-299');
    });

    it('3.2. Respeta el tope FIFO de 300 obras descartando las más antiguas al superar el límite', () => {
      const posters350 = Array.from({ length: 350 }, (_, i) => ({
        id: `p-${i}`,
        titulo: `Obra ${i}`,
      }));

      saveCatalogSnapshot(posters350, { sync: true });
      const local = getLocalCatalog();
      assert.equal(local.length, 300);
      assert.equal(local[0].id, 'p-50');
      assert.equal(local[299].id, 'p-349');
    });

    it('3.3. En entorno de navegador, la persistencia se difiere de forma no bloqueante con setTimeout', async () => {
      global.window = {}; // Simular navegador
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      memoryStore = {}; // Limpiar
      saveCatalogSnapshot([{ id: 'async-1', titulo: 'Obra Diferida' }]);

      // Síncronamente justo después de llamar a la función: NO debe estar aún guardado
      assert.equal(memoryStore['deko_local_catalog_snapshot_v1'], undefined);

      // Esperar a la siguiente macrotarea (setTimeout)
      await new Promise((r) => setTimeout(r, 10));

      // Ahora sí debe haberse persistido
      assert.ok(memoryStore['deko_local_catalog_snapshot_v1']);
      const parsed = JSON.parse(memoryStore['deko_local_catalog_snapshot_v1']);
      assert.equal(parsed[0].id, 'async-1');

      process.env.NODE_ENV = origEnv;
    });

    it('3.4. En entorno de test, la persistencia es síncrona de forma determinista', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      memoryStore = {};
      saveCatalogSnapshot([{ id: 'sync-1', titulo: 'Obra Síncrona' }]);

      // Debe persistirse inmediatamente
      assert.ok(memoryStore['deko_local_catalog_snapshot_v1']);
      const parsed = JSON.parse(memoryStore['deko_local_catalog_snapshot_v1']);
      assert.equal(parsed[0].id, 'sync-1');

      process.env.NODE_ENV = origEnv;
    });

    it('3.5. Tolera JSON corrupto en localStorage sin lanzar excepciones', () => {
      memoryStore['deko_local_catalog_snapshot_v1'] = 'INVALID_JSON_CORRUPTED{}}';
      assert.doesNotThrow(() => {
        saveCatalogSnapshot([{ id: 'recover-1', titulo: 'Recuperado' }], { sync: true });
      });

      const catalog = getLocalCatalog();
      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].id, 'recover-1');
    });

    it('3.6. Tolera QuotaExceededError en localStorage sin lanzar excepciones', () => {
      global.localStorage.setItem = () => {
        const quotaErr = new Error('QuotaExceededError: DOMException');
        quotaErr.name = 'QuotaExceededError';
        throw quotaErr;
      };

      assert.doesNotThrow(() => {
        saveCatalogSnapshot([{ id: 'quota-test', titulo: 'Quota Test' }], { sync: true });
      });
    });
  });

  // =========================================================================
  // BLOQUE 4: Ráfaga de Alta Concurrencia y Limpieza de Event Listeners
  // =========================================================================
  describe('4. Ráfaga de Concurrencia y Verificación de Fuga de Memoria', () => {
    it('4.1. Ráfaga de 50 peticiones concurrentes con cancelaciones masivas', async () => {
      const burstSize = 50;
      const controllers = Array.from({ length: burstSize }, () => new AbortController());
      let abortedCount = 0;
      let completedCount = 0;

      const promises = controllers.map((ctrl, i) => {
        const query = `query-${i}`;
        const delay = 10 + (i % 5) * 10;

        const p = searchPostersWithFallback(
          (signal) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve([{ id: `res-${i}` }]), delay);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
          query,
          8,
          { signal: ctrl.signal }
        ).then(
          () => { completedCount++; },
          (err) => {
            if (err.name === 'AbortError') abortedCount++;
            else throw err;
          }
        );

        // Abortar el 80% de las peticiones en vuelo rápidamente
        if (i % 5 !== 0) {
          setTimeout(() => ctrl.abort(), 5);
        }

        return p;
      });

      await Promise.allSettled(promises);

      assert.equal(abortedCount + completedCount, burstSize);
      assert.ok(abortedCount >= 35, `Se esperaba la cancelación de al menos 35 peticiones, abortadas: ${abortedCount}`);
    });

    it('4.2. Limpieza estricta de listener abort en externalSignal tras completar', async () => {
      const controller = new AbortController();
      let listenerCount = 0;

      // Interceptar addEventListener y removeEventListener en signal
      const origAdd = controller.signal.addEventListener.bind(controller.signal);
      const origRemove = controller.signal.removeEventListener.bind(controller.signal);

      controller.signal.addEventListener = (type, fn, opts) => {
        if (type === 'abort') listenerCount++;
        return origAdd(type, fn, opts);
      };
      controller.signal.removeEventListener = (type, fn, opts) => {
        if (type === 'abort') listenerCount--;
        return origRemove(type, fn, opts);
      };

      // Ejecutar una búsqueda que completa normalmente
      await searchPostersWithFallback(
        async () => [{ id: 'test-listener', titulo: 'Listener' }],
        'test',
        8,
        { signal: controller.signal }
      );

      // El listener debe haberse removido limpiamente para prevenir memory leaks
      assert.equal(
        listenerCount,
        0,
        `Se detectó fuga de event listener en AbortSignal: ${listenerCount} listeners residuales`
      );
    });
  });
});
