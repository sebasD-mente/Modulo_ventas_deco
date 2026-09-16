/**
 * ⚔️ CHALLENGER 1 — ADVERSARIAL EMPIRICAL STRESS SUITE (Hito M2 / Cirugía 1.2)
 *
 * Comprehensive adversarial challenge validating:
 * 1. Zero tolerance for mock poster fallbacks ("Chainsaw Man", "Póster Mediano", "POSTER_MED_45")
 * 2. Structured error propagation (AI_MEDIA_SERVICE_FAILED) across all 4 multimodal media methods:
 *    - processVoiceSaleAudio
 *    - recognizePosterArtworkFromImage
 *    - recognizePostersFromVideo
 *    - processPostersBatchPhoto
 * 3. 429 quota exhaustion resilience in embeddingService via executeWithModelFallback:
 *    - Automatic key cooldown (markKeyCooldown)
 *    - Key rotation from exhausted key to active key
 *    - RAG hybrid lexical parachute activation on full quota exhaustion
 * 4. Architectural compliance: Line ceilings and UI resilience banner contracts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

import { ENV } from '../../server/config/env.js';
import {
  getClientForKey,
  getNextClient,
  isKeyInCooldown,
  markKeyCooldown,
  getAvailableKeys,
} from '../../server/services/ai/aiKeyPoolService.js';
import {
  MODEL_PRIORITY_POOL,
  executeWithModelFallback,
} from '../../server/services/geminiPoolService.js';
import {
  processVoiceSaleAudio,
  recognizePosterArtworkFromImage,
  recognizePostersFromVideo,
  processPostersBatchPhoto,
} from '../../server/services/ai/aiMediaService.js';
import {
  EMBEDDING_MODEL,
  embedTexts,
  searchPostersByEmbedding,
  clearVectorCache,
} from '../../server/services/embeddingService.js';

describe('⚔️ CHALLENGER 1: Empirical Adversarial Stress Suite — Milestone 2 (Cirugía 1.2)', () => {
  const dummyAudio = Buffer.from('fake-audio-bytes-for-challenger');
  const dummyImage = Buffer.from('fake-image-bytes-for-challenger');
  const dummyVideo = Buffer.from('fake-video-bytes-for-challenger');

  beforeEach(() => {
    clearVectorCache();
  });

  // ==========================================================================
  // SUITE 1: Static Zero-Tolerance Mock Eradication & Code Architecture
  // ==========================================================================
  describe('1. Static Code Analysis: Erradicación Absoluta de Mocks y Límites de Líneas', () => {
    const mediaFile = path.join(ROOT, 'server/services/ai/aiMediaService.js');
    const mediaContent = fs.readFileSync(mediaFile, 'utf8');
    const mediaLines = mediaContent.split('\n').length;

    const embFile = path.join(ROOT, 'server/services/embeddingService.js');
    const embContent = fs.readFileSync(embFile, 'utf8');
    const embLines = embContent.split('\n').length;

    it('1.1 aiMediaService.js no contiene NINGUNA referencia mock ("Chainsaw Man", "Póster Mediano", etc.)', () => {
      assert.doesNotMatch(
        mediaContent,
        /Chainsaw\s*Man/i,
        'CRITICAL: aiMediaService.js contiene "Chainsaw Man" residual'
      );
      assert.doesNotMatch(
        mediaContent,
        /P[oó]ster\s*Mediano/i,
        'CRITICAL: aiMediaService.js contiene "Póster Mediano" quemado'
      );
      assert.doesNotMatch(
        mediaContent,
        /POSTER_MED_45/i,
        'CRITICAL: aiMediaService.js contiene "POSTER_MED_45" quemado'
      );
      assert.doesNotMatch(
        mediaContent,
        /unitPrice:\s*65\.0/i,
        'CRITICAL: aiMediaService.js contiene precio unitario mock quemado'
      );
    });

    it('1.2 aiMediaService.js cumple estrictamente con el techo de <= 200 líneas', () => {
      assert.ok(
        mediaLines <= 200,
        `aiMediaService.js excede el límite de 200 líneas (actualmente ${mediaLines})`
      );
    });

    it('1.3 aiMediaService.js define throwMediaError con código AI_MEDIA_SERVICE_FAILED y lo propaga', () => {
      assert.match(
        mediaContent,
        /throwMediaError/,
        'Debe definir función unificada de error throwMediaError'
      );
      assert.match(
        mediaContent,
        /AI_MEDIA_SERVICE_FAILED/,
        'Debe utilizar el identificador AI_MEDIA_SERVICE_FAILED'
      );
      assert.match(
        mediaContent,
        /error\.code\s*=\s*['"]AI_MEDIA_SERVICE_FAILED['"]/,
        'Debe asignar explícitamente error.code = AI_MEDIA_SERVICE_FAILED'
      );
    });

    it('1.4 embeddingService.js cumple estrictamente con el techo de <= 200 líneas', () => {
      assert.ok(
        embLines <= 200,
        `embeddingService.js excede el límite de 200 líneas (actualmente ${embLines})`
      );
    });

    it('1.5 embeddingService.js delega embedContent a través de executeWithModelFallback', () => {
      assert.match(
        embContent,
        /import\s*\{[^}]*executeWithModelFallback[^}]*\}\s*from\s*['"]\.\/geminiPoolService\.js['"]/,
        'embeddingService debe importar executeWithModelFallback'
      );
      assert.match(
        embContent,
        /executeWithModelFallback\(/,
        'embeddingService debe ejecutar llamadas a través de executeWithModelFallback'
      );
      const embedContentMatches = embContent.match(/models\.embedContent/g) || [];
      assert.strictEqual(
        embedContentMatches.length,
        1,
        'Debe existir exactamente 1 llamada a models.embedContent en todo el archivo, encapsulada en executeWithModelFallback'
      );
    });

    it('1.6 MODEL_PRIORITY_POOL contiene estrictamente modelos 2.5 oficiales', () => {
      assert.deepStrictEqual(
        MODEL_PRIORITY_POOL,
        ['gemini-2.5-flash', 'gemini-2.5-pro'],
        'MODEL_PRIORITY_POOL debe contener exclusivamente gemini-2.5-flash y gemini-2.5-pro'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: Inyección de Fallas Multimodales (Zero Mocks en 4 Funciones)
  // ==========================================================================
  describe('2. Inyección de Fallas en Inferencia Multimodal (Zero Mocks en los 4 Métodos)', () => {

    describe('2.1 processVoiceSaleAudio', () => {
      it('2.1.1 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 429 de cuota y NUNCA retorna mock', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_voice_429';
        const client = getClientForKey('AQ.stress_voice_429');
        client.models.generateContent = async () => {
          const err = new Error('Quota exceeded 429');
          err.status = 429;
          throw err;
        };

        await assert.rejects(
          async () => {
            const res = await processVoiceSaleAudio({
              audioBuffer: dummyAudio,
              mimeType: 'audio/webm',
              tenantId: 't-stress',
            });
            assert.fail(`Inesperadamente retornó datos mock: ${JSON.stringify(res)}`);
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
            assert.doesNotMatch(err.message, /Chainsaw\s*Man/i);
            return true;
          }
        );
      });

      it('2.1.2 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 503 de servicio saturado', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_voice_503';
        const client = getClientForKey('AQ.stress_voice_503');
        client.models.generateContent = async () => {
          const err = new Error('503 Service Unavailable');
          err.status = 503;
          throw err;
        };

        await assert.rejects(
          async () => {
            await processVoiceSaleAudio({
              audioBuffer: dummyAudio,
              mimeType: 'audio/webm',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });

      it('2.1.3 Rechaza con AI_MEDIA_SERVICE_FAILED ante respuesta JSON corrupta de Gemini', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_voice_malformed';
        const client = getClientForKey('AQ.stress_voice_malformed');
        client.models.generateContent = async () => ({
          text: 'NO_ES_JSON_SINO_TEXTO_PLANO_CON_ERROR',
        });

        await assert.rejects(
          async () => {
            await processVoiceSaleAudio({
              audioBuffer: dummyAudio,
              mimeType: 'audio/webm',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /Unexpected token|is not valid JSON/i);
            return true;
          }
        );
      });

      it('2.1.4 Rechaza con AI_MEDIA_SERVICE_FAILED ante corte de red ETIMEDOUT', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_voice_timeout';
        const client = getClientForKey('AQ.stress_voice_timeout');
        client.models.generateContent = async () => {
          const err = new Error('Connection timed out: ETIMEDOUT');
          err.code = 'ETIMEDOUT';
          throw err;
        };

        await assert.rejects(
          async () => {
            await processVoiceSaleAudio({
              audioBuffer: dummyAudio,
              mimeType: 'audio/webm',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /ETIMEDOUT/);
            return true;
          }
        );
      });
    });

    describe('2.2 recognizePosterArtworkFromImage', () => {
      it('2.2.1 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 429 de cuota y NUNCA retorna mock', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_image_429';
        const client = getClientForKey('AQ.stress_image_429');
        client.models.generateContent = async () => {
          const err = new Error('RESOURCE_EXHAUSTED: Rate limit');
          err.status = 429;
          throw err;
        };

        await assert.rejects(
          async () => {
            const res = await recognizePosterArtworkFromImage({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
            assert.fail(`Inesperadamente retornó datos mock: ${JSON.stringify(res)}`);
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
            assert.doesNotMatch(err.message, /P[oó]ster\s*Mediano/i);
            return true;
          }
        );
      });

      it('2.2.2 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 500 interno de Google GenAI', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_image_500';
        const client = getClientForKey('AQ.stress_image_500');
        client.models.generateContent = async () => {
          const err = new Error('500 Internal Server Error');
          err.status = 500;
          throw err;
        };

        await assert.rejects(
          async () => {
            await recognizePosterArtworkFromImage({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });

      it('2.2.3 Rechaza con AI_MEDIA_SERVICE_FAILED ante respuesta JSON corrupta en imagen', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_image_corrupt';
        const client = getClientForKey('AQ.stress_image_corrupt');
        client.models.generateContent = async () => ({
          text: '{ invalid_json: ',
        });

        await assert.rejects(
          async () => {
            await recognizePosterArtworkFromImage({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });

      it('2.2.4 Rechaza con AI_MEDIA_SERVICE_FAILED ante caída de socket ECONNRESET', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_image_reset';
        const client = getClientForKey('AQ.stress_image_reset');
        client.models.generateContent = async () => {
          const err = new Error('Socket hang up: ECONNRESET');
          err.code = 'ECONNRESET';
          throw err;
        };

        await assert.rejects(
          async () => {
            await recognizePosterArtworkFromImage({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /ECONNRESET/);
            return true;
          }
        );
      });
    });

    describe('2.3 recognizePostersFromVideo', () => {
      it('2.3.1 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 429 de cuota y NUNCA retorna mock', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_video_429';
        const client = getClientForKey('AQ.stress_video_429');
        client.models.generateContent = async () => {
          const err = new Error('Quota exceeded 429');
          err.status = 429;
          throw err;
        };

        await assert.rejects(
          async () => {
            const res = await recognizePostersFromVideo({
              videoBuffer: dummyVideo,
              mimeType: 'video/mp4',
              tenantId: 't-stress',
            });
            assert.fail(`Inesperadamente retornó datos mock: ${JSON.stringify(res)}`);
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
            assert.doesNotMatch(err.message, /P[oó]ster\s*Mediano/i);
            return true;
          }
        );
      });

      it('2.3.2 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 504 Gateway Timeout', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_video_504';
        const client = getClientForKey('AQ.stress_video_504');
        client.models.generateContent = async () => {
          const err = new Error('504 Gateway Timeout');
          err.status = 504;
          throw err;
        };

        await assert.rejects(
          async () => {
            await recognizePostersFromVideo({
              videoBuffer: dummyVideo,
              mimeType: 'video/mp4',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });

      it('2.3.3 Rechaza con AI_MEDIA_SERVICE_FAILED ante payload no parseable en video', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_video_corrupt';
        const client = getClientForKey('AQ.stress_video_corrupt');
        client.models.generateContent = async () => ({
          text: '<<<CORRUPTED_XML_OUTPUT>>>',
        });

        await assert.rejects(
          async () => {
            await recognizePostersFromVideo({
              videoBuffer: dummyVideo,
              mimeType: 'video/mp4',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });
    });

    describe('2.4 processPostersBatchPhoto', () => {
      it('2.4.1 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 429 de cuota y NUNCA retorna mock', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_batch_429';
        const client = getClientForKey('AQ.stress_batch_429');
        client.models.generateContent = async () => {
          const err = new Error('Quota exceeded 429');
          err.status = 429;
          throw err;
        };

        await assert.rejects(
          async () => {
            const res = await processPostersBatchPhoto({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
            assert.fail(`Inesperadamente retornó datos mock: ${JSON.stringify(res)}`);
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
            assert.doesNotMatch(err.message, /POSTER_MED_45/i);
            return true;
          }
        );
      });

      it('2.4.2 Rechaza con AI_MEDIA_SERVICE_FAILED ante error 500 en lote de fotos', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_batch_500';
        const client = getClientForKey('AQ.stress_batch_500');
        client.models.generateContent = async () => {
          const err = new Error('500 Internal Server Error');
          err.status = 500;
          throw err;
        };

        await assert.rejects(
          async () => {
            await processPostersBatchPhoto({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });

      it('2.4.3 Rechaza con AI_MEDIA_SERVICE_FAILED ante JSON corrupto en lote de fotos', async () => {
        ENV.GEMINI_API_KEYS = 'AQ.stress_batch_corrupt';
        const client = getClientForKey('AQ.stress_batch_corrupt');
        client.models.generateContent = async () => ({
          text: '{ "items": [ missing_quote ] }',
        });

        await assert.rejects(
          async () => {
            await processPostersBatchPhoto({
              imageBuffer: dummyImage,
              mimeType: 'image/jpeg',
              tenantId: 't-stress',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
            return true;
          }
        );
      });
    });
  });

  // ==========================================================================
  // SUITE 3: Resiliencia en Embeddings: Cooldown 429, Rotación y Paracaídas
  // ==========================================================================
  describe('3. Inyección de Cuotas 429 en embeddingService (Cooldown, Rotación y Paracaídas)', () => {

    it('3.1 Error 429 en clave activa activa markKeyCooldown y rota a la siguiente clave operativa', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.emb_stress_k1, AQ.emb_stress_k2';
      const c1 = getClientForKey('AQ.emb_stress_k1');
      const c2 = getClientForKey('AQ.emb_stress_k2');

      // Configurar c1 para fallar con 429
      c1.models.embedContent = async () => {
        const err = new Error('Resource Exhausted (HTTP 429)');
        err.status = 429;
        throw err;
      };

      // Configurar c2 para responder exitosamente
      const expectedVector = [0.123, 0.456, 0.789];
      c2.models.embedContent = async () => ({
        embeddings: [{ values: expectedVector }],
      });

      // Estado previo: ninguna en cooldown
      assert.strictEqual(isKeyInCooldown('AQ.emb_stress_k1', EMBEDDING_MODEL), false);
      assert.strictEqual(isKeyInCooldown('AQ.emb_stress_k2', EMBEDDING_MODEL), false);

      // Invocación a embedTexts sin cliente (usa pool y fallback)
      const vectors = await embedTexts(['Póster Adversarial Test']);

      // Verificaciones empíricas:
      assert.ok(Array.isArray(vectors), 'Debe retornar un array de vectores');
      assert.strictEqual(vectors.length, 1);
      assert.deepStrictEqual(vectors[0], expectedVector);

      // Clave 1 debe estar en cooldown por 60s
      assert.strictEqual(
        isKeyInCooldown('AQ.emb_stress_k1', EMBEDDING_MODEL),
        true,
        'Clave 1 debe quedar marcada en cooldown tras 429'
      );

      // Clave 2 no debe estar en cooldown
      assert.strictEqual(
        isKeyInCooldown('AQ.emb_stress_k2', EMBEDDING_MODEL),
        false,
        'Clave 2 debe mantenerse activa'
      );
    });

    it('3.2 Agotamiento total de cuota (todas las claves 429) marca todas en cooldown y rechaza limpiamente', async () => {
      ENV.GEMINI_API_KEYS = 'AQ.emb_exhaust_1, AQ.emb_exhaust_2';
      const c1 = getClientForKey('AQ.emb_exhaust_1');
      const c2 = getClientForKey('AQ.emb_exhaust_2');

      c1.models.embedContent = async () => {
        const err = new Error('Quota exceeded 429 on k1');
        err.status = 429;
        throw err;
      };
      c2.models.embedContent = async () => {
        const err = new Error('Quota exceeded 429 on k2');
        err.status = 429;
        throw err;
      };

      await assert.rejects(
        async () => {
          await embedTexts(['Texto sin salida']);
        },
        (err) => {
          assert.strictEqual(err.status, 429);
          return true;
        }
      );

      // Ambas claves deben haber sido puestas en cooldown
      assert.strictEqual(isKeyInCooldown('AQ.emb_exhaust_1', EMBEDDING_MODEL), true);
      assert.strictEqual(isKeyInCooldown('AQ.emb_exhaust_2', EMBEDDING_MODEL), true);
    });

    it('3.3 searchPostersByEmbedding activa el Paracaídas Léxico ante 429 sin arrojar error 500', async () => {
      const mockFailingClient = {
        models: {
          embedContent: async () => {
            const err = new Error('RESOURCE_EXHAUSTED 429');
            err.status = 429;
            throw err;
          },
        },
      };

      const result = await searchPostersByEmbedding({
        tenantId: 'tenant-adversarial',
        query: 'spider man retro',
        client: mockFailingClient,
        limit: 5,
      });

      assert.ok(result, 'El resultado no debe ser nulo ni arrojar excepción no capturada');
      assert.strictEqual(result.source, 'lexical_parachute', 'Debe activar la fuente lexical_parachute');
      assert.ok(Array.isArray(result.results), 'Debe retornar un array estructurado de resultados');
    });
  });

  // ==========================================================================
  // SUITE 4: UI Resilience & Banner Contract
  // ==========================================================================
  describe('4. Frontend UI Resilience: Banner Ámbar/Rojo y Acción Directa "Cargar Manual"', () => {
    const bannerFile = path.join(ROOT, 'src/components/ai-chat/AiErrorBanner.jsx');
    const hookFile = path.join(ROOT, 'src/components/ai-chat/hooks/useAiChatStream.js');
    const unifiedFile = path.join(ROOT, 'src/components/UnifiedAiChat.jsx');

    it('4.1 AiErrorBanner.jsx existe, tiene < 50 líneas y ofrece el botón "Cargar Manual"', () => {
      assert.ok(fs.existsSync(bannerFile), 'AiErrorBanner.jsx debe existir en el proyecto');
      const content = fs.readFileSync(bannerFile, 'utf8');
      const lines = content.split('\n').length;

      assert.ok(lines < 50, `AiErrorBanner.jsx debe tener < 50 líneas (actualmente ${lines})`);
      assert.match(content, /Cargar Manual/, 'Debe contener el texto de acción "Cargar Manual"');
      assert.match(content, /onManualSale/, 'Debe aceptar y disparar callback onManualSale');
    });

    it('4.2 useAiChatStream.js tiene <= 160 líneas y detiene el spinner ante errores de IA', () => {
      assert.ok(fs.existsSync(hookFile), 'useAiChatStream.js debe existir');
      const content = fs.readFileSync(hookFile, 'utf8');
      const lines = content.split('\n').length;

      assert.ok(lines <= 160, `useAiChatStream.js debe tener <= 160 líneas (actualmente ${lines})`);
      assert.match(content, /\[aiError,\s*setAiError\]\s*=\s*useState\(null\)/, 'Debe manejar el estado reactivo aiError');
      assert.match(content, /clearAiError\s*=\s*\(\)\s*=>\s*setAiError\(null\)/, 'Debe exponer función para limpiar el banner');
      assert.match(content, /setAiError\(\{/, 'Debe poblar aiError estructurado en catch');
      assert.match(content, /setIsLoading\(false\)/, 'Debe apagar el spinner en el bloque catch');
    });

    it('4.3 UnifiedAiChat.jsx tiene < 80 líneas, monta <AiErrorBanner /> y cablea onManualSale', () => {
      assert.ok(fs.existsSync(unifiedFile), 'UnifiedAiChat.jsx debe existir');
      const content = fs.readFileSync(unifiedFile, 'utf8');
      const lines = content.split('\n').length;

      assert.ok(lines < 80, `UnifiedAiChat.jsx debe tener < 80 líneas (actualmente ${lines})`);
      assert.match(content, /<AiErrorBanner/, 'Debe renderizar el componente AiErrorBanner');
      assert.match(content, /onManualSale=/, 'Debe conectar el prop onManualSale');
      assert.match(content, /onPopulateManualForm/, 'Debe invocar onPopulateManualForm con inputChannel manual');
    });
  });
});
