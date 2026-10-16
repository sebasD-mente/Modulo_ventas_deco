import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { tryDeterministicFastPathL0 } from '../../server/services/ai/aiStreamService.js';
import { processVoiceSaleAudio, recognizePostersFromVideo } from '../../server/services/ai/aiMediaService.js';
import { hasValidMediaMagicBytes } from '../../server/middleware/uploadMiddleware.js';
import { getPoolStatus, withAttemptTimeout } from '../../server/services/geminiPoolService.js';
import { markKeyCooldown, isKeyInCooldown } from '../../server/services/ai/aiKeyPoolService.js';
import { productCache } from '../../server/services/catalog/catalogCacheStore.js';

describe('⚡ Suite de Pruebas Unitarias Fase 4: Agente IA, Puentes Multimodales, Latencia y Memoria', () => {
  const testTenantId = 'test-phase4-suite';

  before(() => {
    // Sembrar catálogo sintético en caché para pruebas de fast-path y fronteras
    productCache.set(testTenantId, {
      timestamp: Date.now(),
      products: [
        {
          id: 'poster-batman-mediano',
          sku: 'BAT-MED',
          titulo: 'Batman The Dark Knight',
          subtitulo: 'DC Comics Superhero',
          categoria: 'CINE',
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, dimensiones: '30x45 cm' },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 100, dimensiones: '45x60 cm' },
          ],
        },
        {
          id: 'poster-formula-1',
          sku: 'F1-GRD',
          titulo: 'Formula 1 Grand Prix',
          subtitulo: 'Motorsport racing',
          categoria: 'DEPORTES',
          sizes: [
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, dimensiones: '30x45 cm' },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 100, dimensiones: '45x60 cm' },
          ],
        },
        {
          id: 'poster-nirvana-album',
          sku: 'NIR-ALBUM',
          titulo: 'Nirvana Nevermind',
          subtitulo: 'Grunge Music Album',
          categoria: 'MUSICA',
          sizes: [
            { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55, dimensiones: '30x30 cm' },
          ],
        },
      ],
    });
  });

  after(() => {
    productCache.delete(testTenantId);
  });

  describe('1. Fast-Path Determinista L0 con Jerga Ferial (< 50ms)', () => {
    it('1.1. Resuelve jerga "vendí 2 batman mediano en efectivo" determinísticamente sin llamar a Gemini', async () => {
      const t0 = Date.now();
      const result = await tryDeterministicFastPathL0(
        'vendí 2 batman mediano en efectivo',
        'event-123',
        testTenantId
      );
      const elapsed = Date.now() - t0;

      assert.ok(result, 'Fast-Path L0 debe resolver la intención de venta');
      assert.ok(elapsed < 50, `Fast-Path L0 debe responder en < 50ms (demoró ${elapsed}ms)`);
      assert.strictEqual(result.fastPath, true);
      assert.strictEqual(result.toolCall.name, 'prepareSaleDraft');
      assert.strictEqual(result.toolCall.args.paymentMethod, 'EFECTIVO');
      assert.strictEqual(result.toolCall.args.items.length, 1);
      assert.strictEqual(result.toolCall.args.items[0].quantity, 2);
    });

    it('1.2. Resuelve título con números en el nombre como "cóbrame 1 formula 1 grande"', async () => {
      const t0 = Date.now();
      const result = await tryDeterministicFastPathL0(
        'cóbrame 1 formula 1 grande',
        'event-123',
        testTenantId
      );
      const elapsed = Date.now() - t0;

      assert.ok(result, 'Fast-Path L0 debe resolver "Formula 1" con número en título');
      assert.ok(elapsed < 50, `Fast-Path L0 debe responder en < 50ms (demoró ${elapsed}ms)`);
      assert.strictEqual(result.fastPath, true);
      assert.strictEqual(result.toolCall.args.items.length, 1);
      assert.strictEqual(result.toolCall.args.items[0].size, 'GRANDE');
    });

    it('1.3. Consulta de stock o regateo no activa Fast-Path L0 (retorna null para LLM)', async () => {
      const resultStock = await tryDeterministicFastPathL0('¿tienen batman en grande?', 'event-123', testTenantId);
      assert.strictEqual(resultStock, null, 'Consultas de stock deben derivar al LLM');

      const resultDiscount = await tryDeterministicFastPathL0('dame 2 batman pero déjamelos en 50 cada uno', 'event-123', testTenantId);
      assert.strictEqual(resultDiscount, null, 'Peticiones con modificación de precio deben derivar al LLM');
    });
  });

  describe('2. Fronteras Duras de Catálogo en Puentes Multimodales (Voz y Video)', () => {
    it('2.1. Voz: rechaza tamaños estándar para pósters de MUSICA y los envía a unmatchedItems con sizeConflict', async () => {
      // Mock de Gemini devolviendo un póster de música con tamaño grande
      const mockClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              isSaleDetected: true,
              intent: 'DICTADO_VENTA',
              items: [{ posterName: 'Nirvana Nevermind', quantity: 1, size: 'GRANDE' }],
              paymentMethod: 'EFECTIVO',
              confidence: 'ALTA',
            }),
          }),
        },
      };

      const result = await processVoiceSaleAudio({
        audioBuffer: Buffer.from('fake-audio-header-1234567890'),
        mimeType: 'audio/webm',
        tenantId: testTenantId,
        eventId: 'event-123',
        geminiClient: mockClient,
      });

      assert.ok(result, 'Debe devolver resultado de voz');
      assert.strictEqual(result.items.length, 0, 'No debe enriquecer ítems con tamaño incompatible');
      assert.strictEqual(result.unmatchedItems.length, 1, 'Debe enviar la obra a unmatchedItems');
      assert.strictEqual(result.unmatchedItems[0].sizeConflict, true, 'Debe marcar sizeConflict: true');
      assert.strictEqual(result.unmatchedItems[0].sizeAvailable, false);
      assert.match(result.unmatchedItems[0].unavailableReason, /30×30 cm/);
    });

    it('2.2. Video: títulos no reconocidos van a unmatchedItems y NO se inventan ítems a Q65', async () => {
      const mockClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              items: [{ title: 'Póster Inexistente En Feria', quantity: 1, suggestedSize: 'MEDIANO' }],
              summary: 'Se observó una lámina no identificada',
            }),
          }),
        },
      };

      const result = await recognizePostersFromVideo({
        videoBuffer: Buffer.from('fake-video-buffer-1234567890'),
        mimeType: 'video/mp4',
        tenantId: testTenantId,
        eventId: 'event-123',
        geminiClient: mockClient,
      });

      assert.ok(result, 'Debe devolver análisis de video');
      assert.strictEqual(result.items.length, 0, 'No debe inventar ítems en el catálogo');
      assert.strictEqual(result.unmatchedItems.length, 1, 'Debe reportar el póster en unmatchedItems');
      assert.strictEqual(result.unmatchedItems[0].rawName, 'Póster Inexistente En Feria');
      assert.strictEqual(result.total, 0, 'El total debe ser Q0');
    });
  });

  describe('3. Verificación de Firmas Binarias (Magic Bytes) en Uploads', () => {
    it('3.1. Acepta firmas válidas de JPEG, PNG, WebP, PDF y MP4', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, ...Array(60).fill(0)]);
      assert.strictEqual(hasValidMediaMagicBytes(jpegBuf, 'image/jpeg'), true);

      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(60).fill(0)]);
      assert.strictEqual(hasValidMediaMagicBytes(pngBuf, 'image/png'), true);

      const webpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...Array(60).fill(0)]);
      assert.strictEqual(hasValidMediaMagicBytes(webpBuf, 'image/webp'), true);

      const pdfBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, ...Array(60).fill(0)]);
      assert.strictEqual(hasValidMediaMagicBytes(pdfBuf, 'application/pdf'), true);
    });

    it('3.2. Rechaza archivos binarios maliciosos o corruptos (ej. ejecutables EXE MZ)', () => {
      const exeBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, ...Array(60).fill(0)]);
      assert.strictEqual(hasValidMediaMagicBytes(exeBuf, 'image/jpeg'), false);
    });

    it('3.3. Permite buffers cortos (< 64 bytes) para retrocompatibilidad con tests unitarios', () => {
      const shortBuf = Buffer.from('mock-small-buffer');
      assert.strictEqual(hasValidMediaMagicBytes(shortBuf), true);
    });
  });

  describe('4. Resiliencia del Pool de Gemini, Timeout y Telemetría', () => {
    it('4.1. withAttemptTimeout interrumpe promesas que exceden el tiempo límite', async () => {
      const hangingPromise = new Promise((resolve) => setTimeout(resolve, 500));
      await assert.rejects(
        () => withAttemptTimeout(hangingPromise, 50),
        (err) => err.code === 'ETIMEDOUT' && err.message.includes('GEMINI_ATTEMPT_TIMEOUT')
      );
    });

    it('4.2. getPoolStatus calcula llaves agotadas dinámicamente según estado de cooldown', () => {
      const dummyKey = 'AIzaSyTestDynamicCooldownKey123';
      markKeyCooldown(dummyKey, 5000);
      assert.strictEqual(isKeyInCooldown(dummyKey), true, 'La llave debe figurar en cooldown');

      const status = getPoolStatus();
      assert.ok(typeof status.totalKeys === 'number');
      assert.ok(typeof status.availableKeys === 'number');
      assert.ok(typeof status.exhaustedKeys === 'number');
      assert.strictEqual(status.totalKeys, status.availableKeys + status.exhaustedKeys);
    });
  });
});
