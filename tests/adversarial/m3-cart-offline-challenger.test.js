/**
 * ⚔️ EMPIRICAL CHALLENGER TEST SUITE: Milestone 3 (R3)
 * Frontend Cart Hook & Offline Retry Logic (useManualSaleCart.js)
 *
 * Adversarial empirical tests verifying:
 * 1. activeSaleUuidRef preservation across transient retry attempts and manual re-clicks.
 * 2. activeSaleUuidRef invalidation (reset to null) on all cart mutations (add, qty, size, discount, remove, clear).
 * 3. Bounded exponential backoff (3 attempts, 1.5s, 3s, 6s) triggered EXCLUSIVELY on network errors.
 * 4. ZERO retries on HTTP 400/422 validation or client errors.
 * 5. Recovery, pre-flight guards, and payload integrity.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SIZES,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
} from '../../src/components/manual-sale/manualSaleConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const hookFilePath = path.join(rootDir, 'src/components/manual-sale/hooks/useManualSaleCart.js');

const hookCode = fs.readFileSync(hookFilePath, 'utf-8');
const transformedCode = hookCode
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+default\s+useManualSaleCart\s*;?/, '')
  .replace(/export\s+function\s+useManualSaleCart/, 'function useManualSaleCart');

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_EVENT_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Creates an empirical test harness around the genuine useManualSaleCart code.
 */
function createCartTestHarness(initialProps = {}) {
  let states = [
    [],              // 0: cartItems
    'EFECTIVO',      // 1: paymentMethod
    0,               // 2: discount
    '',              // 3: notes
    'MANUAL_RAPIDA', // 4: inputChannel
    [],              // 5: attachments
    false,           // 6: isSubmitting
    null,            // 7: errorMsg
  ];

  let refs = [];
  let currentProps = {
    eventId: VALID_EVENT_ID,
    onSaleRegistered: null,
    initialDraft: null,
    ...initialProps,
  };

  let stateCallIdx = 0;
  let refCallIdx = 0;
  let lastDraft = Symbol('init');
  const fetchCalls = [];
  const delaysWaited = [];

  const useState = (init) => {
    const idx = stateCallIdx++;
    if (states[idx] === undefined) {
      states[idx] = typeof init === 'function' ? init() : init;
    }
    const setter = (valOrFn) => {
      states[idx] = typeof valOrFn === 'function' ? valOrFn(states[idx]) : valOrFn;
    };
    return [states[idx], setter];
  };

  const useRef = (init) => {
    const idx = refCallIdx++;
    if (refs[idx] === undefined) {
      refs[idx] = { current: init };
    }
    return refs[idx];
  };

  const useEffect = (cb, deps) => {
    const currentDraft = deps ? deps[0] : null;
    if (currentDraft !== lastDraft) {
      lastDraft = currentDraft;
      cb();
    }
  };

  const useAuth = () => ({
    authFetch: async (url, opts) => {
      let parsedBody = null;
      if (opts?.body) {
        try {
          parsedBody = JSON.parse(opts.body);
        } catch {
          parsedBody = opts.body;
        }
      }
      const record = {
        url,
        method: opts?.method || 'GET',
        headers: opts?.headers || {},
        idempotencyKeyHeader: opts?.headers?.['Idempotency-Key'] || null,
        body: parsedBody,
      };
      fetchCalls.push(record);

      if (currentProps.mockAuthFetch) {
        return currentProps.mockAuthFetch(url, opts, fetchCalls.length);
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'sale-default-uuid', saleNumber: 'TEST-0001' },
        }),
      };
    },
  });

  const confetti = () => {};

  // Override setTimeout during execution to record requested delays and resolve without slowing test
  const originalSetTimeout = globalThis.setTimeout;

  const factory = new Function(
    'useState',
    'useEffect',
    'useRef',
    'useAuth',
    'confetti',
    'DEFAULT_SIZES',
    'SIZE_CLEANUP_REGEX',
    `${transformedCode}\nreturn useManualSaleCart;`
  );

  const hookFn = factory(
    useState,
    useEffect,
    useRef,
    useAuth,
    confetti,
    DEFAULT_SIZES,
    SIZE_CLEANUP_REGEX
  );

  function execute() {
    stateCallIdx = 0;
    refCallIdx = 0;
    return hookFn(currentProps);
  }

  // Initial mount pass
  execute();
  // Second pass to resolve any state updates from initial draft
  execute();

  return {
    get api() {
      return execute();
    },
    get activeSaleUuidRef() {
      // refs[0] is activeSaleUuidRef
      return refs[0];
    },
    get fetchCalls() {
      return fetchCalls;
    },
    get delaysWaited() {
      return delaysWaited;
    },
    setMockAuthFetch(fn) {
      currentProps.mockAuthFetch = fn;
    },
    setProp(key, val) {
      currentProps[key] = val;
      return execute();
    },
    async runWithFastDelays(asyncFn) {
      const recorded = [];
      const mockSetTimeout = (cb, delay) => {
        recorded.push(delay);
        delaysWaited.push(delay);
        return originalSetTimeout(cb, 1);
      };
      const orig = globalThis.setTimeout;
      globalThis.setTimeout = mockSetTimeout;
      try {
        return await asyncFn();
      } finally {
        globalThis.setTimeout = orig;
      }
    },
  };
}

function setNavigatorOnline(val) {
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: val,
      configurable: true,
      writable: true,
    });
  } catch {}
}

describe('⚔️ EMPIRICAL CHALLENGE: Milestone 3 (R3) — useManualSaleCart & Offline Resilience', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    setNavigatorOnline(true);
    console.error = () => {}; // Mute expected error logs in tests
  });

  afterEach(() => {
    setNavigatorOnline(true);
    console.error = originalConsoleError;
  });

  const samplePoster = {
    id: 'poster-db-uuid-001',
    titulo: 'Póster Goku Super Saiyajin',
    subtitulo: 'Edición Especial',
    imageUrl: 'https://storage.googleapis.com/test/goku.webp',
    sizes: DEFAULT_SIZES,
  };

  const sampleSize = { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. activeSaleUuidRef Preservation across Retries and Manual Re-clicks
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Preservación de activeSaleUuidRef entre Reintentos y Re-clicks', () => {
    it('1.1: Los 3 reintentos internos de una misma llamada a confirmSale transmiten EXACTAMENTE el mismo UUID en Idempotency-Key y payload', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      // Simular fallo de red en los 3 intentos
      harness.setMockAuthFetch(() => {
        const netErr = new TypeError('Failed to fetch');
        throw netErr;
      });

      await harness.runWithFastDelays(async () => {
        const result = await harness.api.confirmSale();
        assert.strictEqual(result, null, 'Debe retornar null cuando se agotan los reintentos');
      });

      assert.strictEqual(harness.fetchCalls.length, 3, 'Debe haber ejecutado exactamente 3 intentos');

      const firstKey = harness.fetchCalls[0].idempotencyKeyHeader;
      assert.ok(firstKey, 'El primer intento debe incluir cabecera Idempotency-Key');
      assert.match(firstKey, UUID_V4_REGEX, 'Debe tener formato UUID v4');

      for (let i = 0; i < 3; i++) {
        assert.strictEqual(
          harness.fetchCalls[i].idempotencyKeyHeader,
          firstKey,
          `Intento ${i + 1} debe transmitir el mismo UUID en cabecera`
        );
        assert.strictEqual(
          harness.fetchCalls[i].body.idempotencyKey,
          firstKey,
          `Intento ${i + 1} debe transmitir el mismo UUID en body.idempotencyKey`
        );
      }
    });

    it('1.2: Si se agotan los 3 reintentos por red, activeSaleUuidRef.current NO se borra (retiene el UUID para re-click)', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => {
        throw new TypeError('Failed to fetch');
      });

      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      const retainedRef = harness.activeSaleUuidRef.current;
      assert.ok(retainedRef, 'activeSaleUuidRef.current no debe ser null tras fallo de red');
      assert.match(retainedRef, UUID_V4_REGEX, 'Debe retener un UUID v4 válido');
    });

    it('1.3: Cuando el vendedor vuelve a pulsar "Confirmar Venta" (segunda invocación) con carrito inalterado, reutiliza el mismo UUID', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      let callCount = 0;
      // Los primeros 3 intentos (primera llamada) fallan con error de red
      // En la segunda llamada, el intento 1 tiene éxito
      harness.setMockAuthFetch(() => {
        callCount++;
        if (callCount <= 3) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'sale-recovered-uuid', saleNumber: 'VENTA-0042' },
          }),
        };
      });

      // Primera pulsación: falla
      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });
      const firstSubmissionUuid = harness.activeSaleUuidRef.current;
      assert.ok(firstSubmissionUuid);

      // Segunda pulsación manual: el vendedor reintenta tras restablecerse la red
      let secondResult;
      await harness.runWithFastDelays(async () => {
        secondResult = await harness.api.confirmSale();
      });

      assert.strictEqual(harness.fetchCalls.length, 4, 'Total 4 llamadas (3 en primera pulsación, 1 en segunda)');
      assert.strictEqual(
        harness.fetchCalls[3].idempotencyKeyHeader,
        firstSubmissionUuid,
        'La segunda pulsación manual DEBE reutilizar la misma clave de idempotencia'
      );
      assert.strictEqual(secondResult.id, 'sale-recovered-uuid');
    });

    it('1.4: Tras confirmación exitosa, activeSaleUuidRef.current se resetea a null y limpia el carrito', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'sale-success', saleNumber: 'V-001' },
        }),
      }));

      await harness.api.confirmSale();

      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'activeSaleUuidRef debe ser null tras venta exitosa');
      assert.strictEqual(harness.api.cartItems.length, 0, 'El carrito debe quedar vacío');
    });

    it('1.5: Respuesta del backend con idempotentReplay: true es aceptada como éxito, limpia carrito y resetea ref', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      let callbackData = null;
      harness.setProp('onSaleRegistered', (data) => {
        callbackData = data;
      });

      harness.setMockAuthFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          idempotentReplay: true,
          message: 'Venta previamente registrada (Idempotent Replay).',
          data: { id: 'sale-existing-idempotent', saleNumber: 'VENTA-0010' },
        }),
      }));

      const res = await harness.api.confirmSale();

      assert.strictEqual(res.id, 'sale-existing-idempotent');
      assert.strictEqual(harness.activeSaleUuidRef.current, null);
      assert.strictEqual(harness.api.cartItems.length, 0);
      assert.strictEqual(callbackData?.saleNumber, 'VENTA-0010');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Invalidación de activeSaleUuidRef por Mutaciones del Carrito
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Invalidación de activeSaleUuidRef ante Mutaciones del Carrito', () => {
    async function setupFailedSaleState() {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      // Simular fallo de red para que activeSaleUuidRef quede asignado
      harness.setMockAuthFetch(() => {
        throw new TypeError('Failed to fetch');
      });
      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      const initialKey = harness.activeSaleUuidRef.current;
      assert.ok(initialKey, 'Pre-condición: activeSaleUuidRef debe estar establecido');
      return { harness, initialKey };
    }

    it('2.1: addItemFromPoster resetea activeSaleUuidRef.current a null', async () => {
      const { harness, initialKey } = await setupFailedSaleState();
      const anotherPoster = { id: 'poster-002', titulo: 'Póster Vegeta', sizes: DEFAULT_SIZES };

      harness.api.addItemFromPoster(anotherPoster, sampleSize, 1);
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'addItemFromPoster debe resetear el ref a null');

      // Nueva confirmación debe generar un UUID fresco y distinto
      harness.setMockAuthFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: 'sale-new' } }),
      }));
      await harness.api.confirmSale();

      const newKey = harness.fetchCalls[harness.fetchCalls.length - 1].idempotencyKeyHeader;
      assert.notStrictEqual(newKey, initialKey, 'El nuevo UUID debe ser distinto al anterior');
    });

    it('2.2: updateItemQty (+1) resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();
      const itemId = harness.api.cartItems[0].id;

      harness.api.updateItemQty(itemId, 1);
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'updateItemQty (+1) debe resetear el ref a null');
      assert.strictEqual(harness.api.cartItems[0].quantity, 2);
    });

    it('2.3: updateItemQty (-1) resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();
      const itemId = harness.api.cartItems[0].id;

      // Incrementar a 2 y luego decrementar a 1
      harness.api.updateItemQty(itemId, 1);
      harness.activeSaleUuidRef.current = 'dummy-key';
      harness.api.updateItemQty(itemId, -1);

      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'updateItemQty (-1) debe resetear el ref a null');
      assert.strictEqual(harness.api.cartItems[0].quantity, 1);
    });

    it('2.4: changeItemSize resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();
      const itemId = harness.api.cartItems[0].id;
      const grandeSize = { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 };

      harness.api.changeItemSize(itemId, grandeSize);
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'changeItemSize debe resetear el ref a null');
      assert.strictEqual(harness.api.cartItems[0].selectedSizeId, 'GRANDE');
      assert.strictEqual(harness.api.cartItems[0].unitPrice, 125);
    });

    it('2.5: setDiscount (handleSetDiscount) resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();

      harness.api.setDiscount(15);
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'setDiscount debe resetear el ref a null');
      assert.strictEqual(harness.api.discount, 15);
      assert.strictEqual(harness.api.grandTotal, 50); // 65 - 15 = 50
    });

    it('2.6: removeItem resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();
      const itemId = harness.api.cartItems[0].id;

      harness.api.removeItem(itemId);
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'removeItem debe resetear el ref a null');
      assert.strictEqual(harness.api.cartItems.length, 0);
    });

    it('2.7: clearCart resetea activeSaleUuidRef.current a null', async () => {
      const { harness } = await setupFailedSaleState();

      harness.api.clearCart();
      assert.strictEqual(harness.activeSaleUuidRef.current, null, 'clearCart debe resetear el ref a null');
      assert.strictEqual(harness.api.cartItems.length, 0);
      assert.strictEqual(harness.api.discount, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Lógica de Reintentos Acotados (Backoff) y Discriminación de Errores
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Backoff Exponencial y Filtro de Errores (Red vs Validación HTTP)', () => {
    it('3.1: Error de red por TypeError (Failed to fetch) ejecuta exactamente 3 intentos y solicita backoff [1500, 3000]', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => {
        throw new TypeError('Failed to fetch');
      });

      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      assert.strictEqual(harness.fetchCalls.length, 3, 'Debe intentar 3 veces');
      assert.deepStrictEqual(harness.delaysWaited, [1500, 3000], 'Los delays solicitados deben ser exactamente 1500ms y 3000ms');
    });

    it('3.2: Error de red con navigator.onLine = false ejecuta exactamente 3 intentos', async () => {
      setNavigatorOnline(false);
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => {
        throw new Error('Cualquier error en estado offline');
      });

      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      assert.strictEqual(harness.fetchCalls.length, 3, 'Debe reintentar 3 veces cuando navigator.onLine es false');
      assert.deepStrictEqual(harness.delaysWaited, [1500, 3000]);
    });

    it('3.3: Error con mensaje "Network" ejecuta reintentos acotados', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => {
        throw new Error('Network request failed');
      });

      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      assert.strictEqual(harness.fetchCalls.length, 3);
      assert.deepStrictEqual(harness.delaysWaited, [1500, 3000]);
    });

    it('3.4: HTTP 400 Bad Request NUNCA reintenta (se detiene inmediatamente en intento 1)', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => ({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Error de validación: El monto recibido no coincide.',
        }),
      }));

      await harness.runWithFastDelays(async () => {
        const res = await harness.api.confirmSale();
        assert.strictEqual(res, null);
      });

      assert.strictEqual(harness.fetchCalls.length, 1, 'HTTP 400 debe ejecutarse exactamente 1 vez (0 reintentos)');
      assert.strictEqual(harness.delaysWaited.length, 0, 'No debe esperar ningún delay en HTTP 400');
      assert.strictEqual(harness.api.errorMsg, 'Error de validación: El monto recibido no coincide.');
    });

    it('3.5: HTTP 422 Unprocessable Entity NUNCA reintenta (0 reintentos)', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => ({
        ok: false,
        status: 422,
        json: async () => ({
          success: false,
          error: 'Unprocessable Entity: Formato de ítem no válido.',
        }),
      }));

      await harness.runWithFastDelays(async () => {
        const res = await harness.api.confirmSale();
        assert.strictEqual(res, null);
      });

      assert.strictEqual(harness.fetchCalls.length, 1, 'HTTP 422 debe ejecutarse exactamente 1 vez (0 reintentos)');
      assert.strictEqual(harness.delaysWaited.length, 0);
      assert.strictEqual(harness.api.errorMsg, 'Unprocessable Entity: Formato de ítem no válido.');
    });

    it('3.6: HTTP 500 Internal Server Error con conexión activa NO es tratado como error de red y no reintenta', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      harness.setMockAuthFetch(() => ({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Error interno de base de datos en el servidor.',
        }),
      }));

      await harness.runWithFastDelays(async () => {
        const res = await harness.api.confirmSale();
        assert.strictEqual(res, null);
      });

      assert.strictEqual(harness.fetchCalls.length, 1, 'HTTP 500 del servidor no debe disparar reintentos en cliente online');
      assert.strictEqual(harness.delaysWaited.length, 0);
      assert.strictEqual(harness.api.errorMsg, 'Error interno de base de datos en el servidor.');
    });

    it('3.7: Recuperación a medio camino (intento 1 falla por red, intento 2 tiene éxito) detiene el loop en intento 2', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      let attempts = 0;
      harness.setMockAuthFetch(() => {
        attempts++;
        if (attempts === 1) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'sale-recovered-midway', saleNumber: 'VENTA-0099' },
          }),
        };
      });

      let res;
      await harness.runWithFastDelays(async () => {
        res = await harness.api.confirmSale();
      });

      assert.strictEqual(harness.fetchCalls.length, 2, 'Debe detenerse exactamente en el intento 2');
      assert.deepStrictEqual(harness.delaysWaited, [1500], 'Solo debe haber esperado el primer delay de 1500ms');
      assert.strictEqual(res.id, 'sale-recovered-midway');
      assert.strictEqual(harness.activeSaleUuidRef.current, null);
      assert.strictEqual(harness.api.cartItems.length, 0);
    });

    it('3.8: Durante reintentos por red, errorMsg notifica al usuario con el número de intento', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      const observedErrorMessages = [];
      let attempts = 0;
      harness.setMockAuthFetch(() => {
        attempts++;
        observedErrorMessages.push(harness.api.errorMsg);
        if (attempts < 3) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'sale-attempt-3' } }),
        };
      });

      await harness.runWithFastDelays(async () => {
        await harness.api.confirmSale();
      });

      // En el intento 2 debe verse el mensaje de reintento
      assert.ok(
        observedErrorMessages.some((msg) => msg?.includes('Reintentando venta tras parpadeo de red (intento 2/3)')),
        'Debe notificar al usuario sobre el intento 2/3'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Guardas Previas, Integridad del Payload y Ciclo de Vida
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Guardas Previas, Integridad del Payload y Ciclo de Vida', () => {
    it('4.1: Carrito vacío rechaza confirmación sin llamar a la red ni crear UUID', async () => {
      const harness = createCartTestHarness();
      const res = await harness.api.confirmSale();

      assert.strictEqual(res, false);
      assert.strictEqual(harness.fetchCalls.length, 0, 'No debe invocar authFetch');
      assert.strictEqual(harness.activeSaleUuidRef.current, null);
      assert.strictEqual(harness.api.errorMsg, 'Debes agregar al menos un póster a la venta.');
    });

    it('4.2: Sin eventId rechaza confirmación sin llamar a la red', async () => {
      const harness = createCartTestHarness({ eventId: null });
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      const res = await harness.api.confirmSale();

      assert.strictEqual(res, false);
      assert.strictEqual(harness.fetchCalls.length, 0);
      assert.strictEqual(harness.api.errorMsg, 'No hay un evento activo seleccionado.');
    });

    it('4.3: Payload enviado a /api/sales contiene todos los campos canónicos y coincidencia de clave de idempotencia', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 2);
      harness.api.setDiscount(10);
      harness.api.setPaymentMethod('TARJETA');

      harness.setMockAuthFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: 'sale-integrity-check' } }),
      }));

      await harness.api.confirmSale();

      const call = harness.fetchCalls[0];
      assert.strictEqual(call.method, 'POST');
      assert.strictEqual(call.url, '/api/sales');
      assert.strictEqual(call.headers['Content-Type'], 'application/json');

      const body = call.body;
      assert.strictEqual(body.eventId, VALID_EVENT_ID);
      assert.strictEqual(body.items.length, 1);
      assert.strictEqual(body.items[0].quantity, 2);
      assert.strictEqual(body.items[0].unitPrice, 65);
      assert.strictEqual(body.discount, 10);
      assert.strictEqual(body.payments[0].method, 'TARJETA');
      assert.strictEqual(body.payments[0].amount, 120); // (2 * 65) - 10 = 120
      assert.strictEqual(body.idempotencyKey, call.idempotencyKeyHeader);
      assert.match(body.idempotencyKey, UUID_V4_REGEX);
    });

    it('4.4: isSubmitting pasa a true durante confirmación y se restaura a false en finally', async () => {
      const harness = createCartTestHarness();
      harness.api.addItemFromPoster(samplePoster, sampleSize, 1);

      let wasSubmittingDuringCall = false;
      harness.setMockAuthFetch(() => {
        wasSubmittingDuringCall = harness.api.isSubmitting;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'sale-ok' } }),
        };
      });

      assert.strictEqual(harness.api.isSubmitting, false, 'Inicialmente isSubmitting debe ser false');
      await harness.api.confirmSale();
      assert.strictEqual(wasSubmittingDuringCall, true, 'Durante la petición isSubmitting debe ser true');
      assert.strictEqual(harness.api.isSubmitting, false, 'Al finalizar isSubmitting debe restaurarse a false');
    });
  });
});
