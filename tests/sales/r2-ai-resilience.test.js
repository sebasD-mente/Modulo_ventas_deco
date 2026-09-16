import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('🛡️ Milestone 2 (R2): AI Media & Frontend Resilience Verification Suite', () => {

  // =========================================================================
  // 1. aiMediaService.js Hardening & Mock Eradication
  // =========================================================================
  describe('1. aiMediaService.js Saneamiento y Erradicación de Mocks', () => {
    const mediaPath = path.join(projectRoot, 'server/services/ai/aiMediaService.js');
    const content = fs.readFileSync(mediaPath, 'utf8');
    const lines = content.split('\n').length;

    it('1.1. aiMediaService.js no contiene cadenas mock como "Chainsaw Man" o "Póster Mediano"', () => {
      assert.doesNotMatch(content, /Chainsaw\s*Man/i, 'No debe existir "Chainsaw Man" mock');
      assert.doesNotMatch(content, /P[oó]ster\s*Mediano/i, 'No debe existir "Póster Mediano" mock');
      assert.doesNotMatch(content, /POSTER_MED_45/i, 'No debe existir "POSTER_MED_45" mock');
    });

    it('1.2. aiMediaService.js cumple estrictamente con el techo de <= 200 líneas', () => {
      assert.ok(lines <= 200, `aiMediaService.js debe tener <= 200 líneas (actualmente ${lines})`);
    });

    it('1.3. aiMediaService.js propaga excepciones estructuradas con AI_MEDIA_SERVICE_FAILED', () => {
      assert.match(content, /AI_MEDIA_SERVICE_FAILED/, 'Debe lanzar excepciones con código AI_MEDIA_SERVICE_FAILED');
      assert.match(content, /error\.code\s*=\s*['"]AI_MEDIA_SERVICE_FAILED['"]/, 'Debe asignar error.code = AI_MEDIA_SERVICE_FAILED');
    });

    it('1.4. Invocación de processVoiceSaleAudio con fallo arroja AI_MEDIA_SERVICE_FAILED', async () => {
      const { processVoiceSaleAudio } = await import('../../server/services/ai/aiMediaService.js');
      await assert.rejects(
        async () => {
          await processVoiceSaleAudio({ audioBuffer: Buffer.from('fake-audio'), mimeType: 'audio/webm', tenantId: 'test-tenant' });
        },
        (err) => {
          assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
          assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
          return true;
        }
      );
    });

    it('1.5. Invocación de recognizePosterArtworkFromImage con fallo arroja AI_MEDIA_SERVICE_FAILED', async () => {
      const { recognizePosterArtworkFromImage } = await import('../../server/services/ai/aiMediaService.js');
      await assert.rejects(
        async () => {
          await recognizePosterArtworkFromImage({ imageBuffer: Buffer.from('fake-img'), mimeType: 'image/jpeg', tenantId: 'test-tenant' });
        },
        (err) => {
          assert.strictEqual(err.code, 'AI_MEDIA_SERVICE_FAILED');
          assert.match(err.message, /AI_MEDIA_SERVICE_FAILED/);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. geminiPoolService.js & env.js Model Configuration
  // =========================================================================
  describe('2. Configuración de Modelos Oficiales Google GenAI', () => {
    it('2.1. MODEL_PRIORITY_POOL contiene exclusivamente modelos oficiales gemini-2.5', async () => {
      const { MODEL_PRIORITY_POOL } = await import('../../server/services/geminiPoolService.js');
      assert.deepStrictEqual(MODEL_PRIORITY_POOL, ['gemini-2.5-flash', 'gemini-2.5-pro']);
    });

    it('2.2. server/config/env.js tiene como default GEMINI_MODEL gemini-2.5-flash', () => {
      const envPath = path.join(projectRoot, 'server/config/env.js');
      const envContent = fs.readFileSync(envPath, 'utf8');
      assert.match(envContent, /GEMINI_MODEL:\s*z\.string\(\)\.default\(['"]gemini-2\.5-flash['"]\)/);
    });
  });

  // =========================================================================
  // 3. embeddingService.js Resiliencia 429 & Monolito Saneado
  // =========================================================================
  describe('3. embeddingService.js Resiliencia y Límite de Líneas', () => {
    const embPath = path.join(projectRoot, 'server/services/embeddingService.js');
    const content = fs.readFileSync(embPath, 'utf8');
    const lines = content.split('\n').length;

    it('3.1. embeddingService.js tiene estrictamente <= 200 líneas', () => {
      assert.ok(lines <= 200, `embeddingService.js debe tener <= 200 líneas (actualmente ${lines})`);
    });

    it('3.2. embeddingService.js importa y utiliza executeWithModelFallback', () => {
      assert.match(content, /import\s*\{[^}]*executeWithModelFallback[^}]*\}\s*from\s*['"]\.\/geminiPoolService\.js['"]/);
      assert.match(content, /executeWithModelFallback\(/);
    });
  });

  // =========================================================================
  // 4. Frontend UI Resilience (Banner, Hooks, UnifiedAiChat)
  // =========================================================================
  describe('4. Resiliencia Frontend UI (AiErrorBanner, Hooks, UnifiedAiChat)', () => {
    it('4.1. AiErrorBanner.jsx existe y cumple con el techo de < 50 líneas', () => {
      const bannerPath = path.join(projectRoot, 'src/components/ai-chat/AiErrorBanner.jsx');
      assert.ok(fs.existsSync(bannerPath), 'AiErrorBanner.jsx debe existir');
      const content = fs.readFileSync(bannerPath, 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines < 50, `AiErrorBanner.jsx debe tener < 50 líneas (actualmente ${lines})`);
      assert.match(content, /AlertTriangle/, 'Debe incluir icono AlertTriangle');
      assert.match(content, /ShoppingBag/, 'Debe incluir icono ShoppingBag');
      assert.match(content, /Cargar\s*Manual/, 'Debe incluir texto Cargar Manual');
    });

    it('4.2. useAiChatStream.js cumple con el techo de <= 160 líneas', () => {
      const hookPath = path.join(projectRoot, 'src/components/ai-chat/hooks/useAiChatStream.js');
      const content = fs.readFileSync(hookPath, 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines <= 160, `useAiChatStream.js debe tener <= 160 líneas (actualmente ${lines})`);
      assert.match(content, /aiError/, 'Debe gestionar estado aiError');
      assert.match(content, /clearAiError/, 'Debe exponer función clearAiError');
    });

    it('4.3. UnifiedAiChat.jsx cumple con el techo de < 80 líneas e integra AiErrorBanner', () => {
      const chatPath = path.join(projectRoot, 'src/components/UnifiedAiChat.jsx');
      const content = fs.readFileSync(chatPath, 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines < 80, `UnifiedAiChat.jsx debe tener < 80 líneas (actualmente ${lines})`);
      assert.match(content, /import\s+AiErrorBanner\s+from\s+['"]\.\/ai-chat\/AiErrorBanner['"]/, 'Debe importar AiErrorBanner');
      assert.match(content, /<AiErrorBanner/, 'Debe renderizar AiErrorBanner');
      assert.match(content, /onManualSale/, 'Debe cablear acción onManualSale');
    });
  });
});
