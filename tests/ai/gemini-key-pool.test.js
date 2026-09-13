import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableKeys,
  isKeyInCooldown,
  markKeyCooldown,
  getClientForKey,
  getNextClient,
  resetKeyPool,
} from '../../server/services/ai/aiKeyPoolService.js';
import { ENV } from '../../server/config/env.js';

describe('🛡️ Suite de Pruebas: Gemini Key Pool Service (Multi-Key & 429 Cooldown)', () => {
  const originalKey = ENV.GEMINI_API_KEY;
  const originalKeys = ENV.GEMINI_API_KEYS;
  const originalEnvKey = process.env.GEMINI_API_KEY;
  const originalEnvKeys = process.env.GEMINI_API_KEYS;

  beforeEach(() => {
    resetKeyPool();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEYS;
    ENV.GEMINI_API_KEY = undefined;
    ENV.GEMINI_API_KEYS = undefined;
  });

  afterEach(() => {
    resetKeyPool();
    ENV.GEMINI_API_KEY = originalKey;
    ENV.GEMINI_API_KEYS = originalKeys;
    if (originalEnvKey !== undefined) process.env.GEMINI_API_KEY = originalEnvKey;
    if (originalEnvKeys !== undefined) process.env.GEMINI_API_KEYS = originalEnvKeys;
  });

  describe('1. Detección y Parseo de Claves', () => {
    it('1.1 Retorna array vacío cuando no hay claves configuradas', () => {
      const keys = getAvailableKeys();
      assert.deepStrictEqual(keys, []);
    });

    it('1.2 Detecta monoclave desde GEMINI_API_KEY', () => {
      ENV.GEMINI_API_KEY = '  AQ.single_test_key_123  ';
      const keys = getAvailableKeys();
      assert.deepStrictEqual(keys, ['AQ.single_test_key_123']);
    });

    it('1.3 Prioriza GEMINI_API_KEYS separadas por coma sobre monoclave', () => {
      ENV.GEMINI_API_KEY = 'AQ.single_key';
      ENV.GEMINI_API_KEYS = 'AQ.key_one, AQ.key_two , AQ.key_three';
      const keys = getAvailableKeys();
      assert.deepStrictEqual(keys, ['AQ.key_one', 'AQ.key_two', 'AQ.key_three']);
    });

    it('1.4 Filtra elementos vacíos o espacios en blanco en GEMINI_API_KEYS', () => {
      ENV.GEMINI_API_KEYS = 'AQ.key1, ,  , AQ.key2, ';
      const keys = getAvailableKeys();
      assert.deepStrictEqual(keys, ['AQ.key1', 'AQ.key2']);
    });
  });

  describe('2. Rotación Round-Robin y Caché de Instancias', () => {
    it('2.1 Distribuye equitativamente entre claves disponibles en orden circular', () => {
      ENV.GEMINI_API_KEYS = 'AQ.key_A, AQ.key_B, AQ.key_C';
      const c1 = getNextClient();
      const c2 = getNextClient();
      const c3 = getNextClient();
      const c4 = getNextClient();

      assert.strictEqual(c1.apiKey, 'AQ.key_A');
      assert.strictEqual(c1.keyIndex, 0);
      assert.strictEqual(c2.apiKey, 'AQ.key_B');
      assert.strictEqual(c2.keyIndex, 1);
      assert.strictEqual(c3.apiKey, 'AQ.key_C');
      assert.strictEqual(c3.keyIndex, 2);
      assert.strictEqual(c4.apiKey, 'AQ.key_A');
      assert.strictEqual(c4.keyIndex, 0);
    });

    it('2.2 Cachea las instancias de cliente por clave (singleton por apiKey)', () => {
      ENV.GEMINI_API_KEY = 'AQ.key_cached_test';
      const instance1 = getClientForKey('AQ.key_cached_test');
      const instance2 = getClientForKey('AQ.key_cached_test');
      assert.ok(instance1 !== null);
      assert.strictEqual(instance1, instance2, 'Debe reutilizar la misma instancia en caché');
    });

    it('2.3 Retorna null cuando no hay claves disponibles para getNextClient', () => {
      const client = getNextClient();
      assert.strictEqual(client, null);
    });
  });

  describe('3. Manejo de Cooldown ante HTTP 429', () => {
    it('3.1 markKeyCooldown activa cooldown de 60s por defecto y es detectado por isKeyInCooldown', () => {
      const key = 'AQ.rate_limited_key';
      assert.strictEqual(isKeyInCooldown(key), false);

      markKeyCooldown(key, 60000);
      assert.strictEqual(isKeyInCooldown(key), true);
    });

    it('3.2 getNextClient salta automáticamente claves en cooldown y entrega la siguiente activa', () => {
      ENV.GEMINI_API_KEYS = 'AQ.key_1, AQ.key_2, AQ.key_3';

      // Ponemos key_1 en cooldown
      markKeyCooldown('AQ.key_1', 60000);

      const next = getNextClient();
      assert.strictEqual(next.apiKey, 'AQ.key_2', 'Debe saltar key_1 y retornar key_2');

      const nextAgain = getNextClient();
      assert.strictEqual(nextAgain.apiKey, 'AQ.key_3', 'Debe continuar con key_3');

      const looped = getNextClient();
      assert.strictEqual(looped.apiKey, 'AQ.key_2', 'Al ciclar debe volver a key_2 porque key_1 sigue en cooldown');
    });

    it('3.3 Cooldown expira tras la duración especificada', async () => {
      const key = 'AQ.short_cooldown_key';
      markKeyCooldown(key, 50); // 50ms cooldown para test rápido
      assert.strictEqual(isKeyInCooldown(key), true);

      await new Promise((r) => setTimeout(r, 60));
      assert.strictEqual(isKeyInCooldown(key), false, 'Debe expirar tras la duración');
    });

    it('3.4 Si todas las claves están en cooldown, getNextClient retorna null', () => {
      ENV.GEMINI_API_KEYS = 'AQ.k1, AQ.k2';
      markKeyCooldown('AQ.k1', 60000);
      markKeyCooldown('AQ.k2', 60000);

      const client = getNextClient();
      assert.strictEqual(client, null, 'Sin claves activas debe retornar null');
    });
  });

  describe('4. Reset del Pool', () => {
    it('4.1 resetKeyPool limpia mapas de cooldown, caché y reinicia índice circular', () => {
      ENV.GEMINI_API_KEYS = 'AQ.first_key, AQ.second_key';
      markKeyCooldown('AQ.first_key', 60000);
      getClientForKey('AQ.first_key');

      assert.strictEqual(isKeyInCooldown('AQ.first_key'), true);

      resetKeyPool();

      assert.strictEqual(isKeyInCooldown('AQ.first_key'), false, 'Cooldown debe haberse reseteado');
      const next = getNextClient();
      assert.strictEqual(next.apiKey, 'AQ.first_key', 'Índice debe reiniciarse en 0');
    });
  });

  describe('5. Cooldown por Modelo (Model-Scoped Cooldown para Cascada Gen 3)', () => {
    it('5.1 markKeyCooldown con modelo bloquea solo ese modelo y no otros', () => {
      const key = 'AQ.model_scoped_key';
      markKeyCooldown(key, 60000, 'gemini-3.8-flash');

      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.8-flash'), true, 'Debe estar en cooldown para 3.8');
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.7-flash'), false, 'NO debe estar en cooldown para 3.7');
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.6-flash'), false, 'NO debe estar en cooldown para 3.6');
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.1-flash-lite'), false, 'NO debe estar en cooldown para 3.1-lite');
      assert.strictEqual(isKeyInCooldown(key), false, 'NO debe estar en cooldown global');
    });

    it('5.2 getNextClient(model) entrega claves sanas para el modelo solicitado aunque otro modelo esté agotado', () => {
      ENV.GEMINI_API_KEYS = 'AQ.k_alpha, AQ.k_beta';

      markKeyCooldown('AQ.k_alpha', 60000, 'gemini-3.8-flash');
      markKeyCooldown('AQ.k_beta', 60000, 'gemini-3.8-flash');

      assert.strictEqual(getNextClient('gemini-3.8-flash'), null, 'Para 3.8 ambas claves están agotadas');

      const client37 = getNextClient('gemini-3.7-flash');
      assert.ok(client37 !== null, 'Para 3.7 debe haber cliente disponible');
      assert.ok(['AQ.k_alpha', 'AQ.k_beta'].includes(client37.apiKey), 'Debe entregar una clave del pool');
    });

    it('5.3 Cooldown global sigue bloqueando todos los modelos', () => {
      const key = 'AQ.global_lock_key';
      markKeyCooldown(key, 60000);

      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.8-flash'), true, 'Global bloquea 3.8');
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.7-flash'), true, 'Global bloquea 3.7');
      assert.strictEqual(isKeyInCooldown(key), true, 'Global bloquea genérico');
    });

    it('5.4 Soporta firma abreviada markKeyCooldown(key, modelString)', () => {
      const key = 'AQ.string_model_key';
      markKeyCooldown(key, 'gemini-3.8-flash');

      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.8-flash'), true);
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.7-flash'), false);
    });

    it('5.5 Expiración independiente por modelo', async () => {
      const key = 'AQ.expiring_model_key';
      markKeyCooldown(key, 50, 'gemini-3.8-flash');
      markKeyCooldown(key, 5000, 'gemini-3.7-flash');

      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.8-flash'), true);
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.7-flash'), true);

      await new Promise((r) => setTimeout(r, 60));
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.8-flash'), false, '3.8 expira');
      assert.strictEqual(isKeyInCooldown(key, 'gemini-3.7-flash'), true, '3.7 activo');
    });
  });
});
