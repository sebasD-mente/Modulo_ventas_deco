import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as aiMediaService from '../../server/services/ai/aiMediaService.js';
import * as aiController from '../../server/controllers/aiController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ [DEKO-STANDIA-066] BÚSQUEDA DE CATÁLOGO POR VOZ IA (MICRÓFONO JUNTO A CÁMARA)', () => {
  // =========================================================================
  // 1. Producer Backend: cleanVoiceCatalogQuery & transcribeVoiceSearchQuery
  // =========================================================================
  describe('1. Backend Producer: cleanVoiceCatalogQuery & transcribeVoiceSearchQuery en aiMediaService.js', () => {
    it('1.1: cleanVoiceCatalogQuery elimina muletillas de dictado y puntuación', () => {
      assert.strictEqual(typeof aiMediaService.cleanVoiceCatalogQuery, 'function');
      const res1 = aiMediaService.cleanVoiceCatalogQuery('¡Búscame el póster de Spider-Man por favor!');
      assert.strictEqual(res1, 'Spider-Man');

      const res2 = aiMediaService.cleanVoiceCatalogQuery('[ruido] quiero ver cuadros de Van Gogh');
      assert.ok(res2.toLowerCase().includes('van gogh'), `Expected Van Gogh, got: ${res2}`);
    });

    it('1.2: cleanVoiceCatalogQuery resuelve alias semánticos al título canónico ("el hombre motosierra" -> "Chainsaw Man")', () => {
      const res = aiMediaService.cleanVoiceCatalogQuery('búscame el póster de el hombre motosierra');
      assert.strictEqual(res, 'Chainsaw Man');
    });

    it('1.3: transcribeVoiceSearchQuery invoca Gemini con cliente inyectado y retorna { query, transcription } sin crear draftSale', async () => {
      assert.strictEqual(typeof aiMediaService.transcribeVoiceSearchQuery, 'function');

      const fakeGeminiClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              searchQuery: 'búscame el póster de Spider-Man',
              transcription: 'búscame el póster de espiderman',
            }),
          }),
        },
      };

      const audioBuffer = Buffer.from('fake-webm-audio-bytes');
      const result = await aiMediaService.transcribeVoiceSearchQuery({
        audioBuffer,
        mimeType: 'audio/webm;codecs=opus',
        tenantId: 'tenant-test',
        geminiClient: fakeGeminiClient,
      });

      assert.strictEqual(result.query, 'Spider-Man');
      assert.strictEqual(result.transcription, 'búscame el póster de espiderman');
      assert.strictEqual(result.draftSale, undefined, 'No debe construir ni retornar draftSale');
    });
  });

  // =========================================================================
  // 2. Ruta HTTP /ai/voice-search y Controlador handleVoiceCatalogSearch
  // =========================================================================
  describe('2. Ruta /ai/voice-search y Controlador handleVoiceCatalogSearch', () => {
    it('2.1: aiController re-exporta handleVoiceCatalogSearch y valida ausencia de archivo con HTTP 400', async () => {
      assert.strictEqual(typeof aiController.handleVoiceCatalogSearch, 'function');

      let statusCode = 200;
      let jsonBody = null;
      const mockReq = { file: null, tenantId: 'tenant-test' };
      const mockRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          jsonBody = payload;
          return this;
        },
      };

      await aiController.handleVoiceCatalogSearch(mockReq, mockRes);
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(jsonBody?.success, false);
    });

    it('2.2: apiRoutes.js expone POST /ai/voice-search con upload.single("audio") y handleVoiceCatalogSearch', () => {
      const routesCode = fs.readFileSync(path.join(rootDir, 'server/routes/apiRoutes.js'), 'utf-8');
      assert.ok(routesCode.includes("'/ai/voice-search'"), 'apiRoutes.js debe registrar /ai/voice-search');
      assert.ok(routesCode.includes('handleVoiceCatalogSearch'), 'apiRoutes.js debe enlazar handleVoiceCatalogSearch');

      const voiceSearchBlock = routesCode.slice(
        routesCode.indexOf("'/ai/voice-search'"),
        routesCode.indexOf("'/ai/voice-search'") + 260
      );
      assert.ok(voiceSearchBlock.includes("upload.single('audio')"), 'Debe usar upload.single("audio")');
      assert.ok(!voiceSearchBlock.includes('requireEventAccess'), 'No debe bloquear por requireEventAccess para permitir búsqueda ágil en catálogo');
    });
  });

  // =========================================================================
  // 3. Contrato UI y Hooks (CatalogSearchInput.jsx, useCatalogSearch.js, useAiVoiceRecorder.js, FastManualSaleForm.jsx)
  // =========================================================================
  describe('3. Contrato UI y Hook (CatalogSearchInput.jsx y useCatalogSearch.js)', () => {
    it('3.1: CatalogSearchInput.jsx renderiza data-testid="catalog-mic-btn" con ergonomía táctil >= 44x44px junto a catalog-camera-btn', () => {
      const inputCode = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/CatalogSearchInput.jsx'), 'utf-8');

      assert.ok(inputCode.includes('data-testid="catalog-camera-btn"'), 'Debe preservar catalog-camera-btn');
      assert.ok(inputCode.includes('data-testid="catalog-mic-btn"'), 'Debe incluir data-testid="catalog-mic-btn"');

      const micBtnMatch = inputCode.match(/<button[\s\S]*?data-testid="catalog-mic-btn"[\s\S]*?>[\s\S]*?<\/button>/);
      assert.ok(micBtnMatch, 'Debe encontrarse el bloque button de catalog-mic-btn');
      const micBtn = micBtnMatch[0];

      assert.ok(micBtn.includes('min-h-[44px]'), 'El botón de micrófono debe cumplir min-h-[44px]');
      assert.ok(micBtn.includes('min-w-[44px]'), 'El botón de micrófono debe cumplir min-w-[44px]');
      assert.ok(micBtn.includes('shrink-0'), 'El botón de micrófono debe incluir shrink-0');
    });

    it('3.2: useCatalogSearch.js integra useAiVoiceRecorder, invoca /api/ai/voice-search, actualiza setSearchQuery y abre setShowDropdown(true)', () => {
      const hookCode = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/hooks/useCatalogSearch.js'), 'utf-8');

      assert.ok(hookCode.includes('useAiVoiceRecorder'), 'useCatalogSearch debe importar y usar useAiVoiceRecorder');
      assert.ok(hookCode.includes("'/api/ai/voice-search'"), 'useCatalogSearch debe llamar a /api/ai/voice-search');
      assert.ok(hookCode.includes('setSearchQuery(cleanQ)'), 'Debe poblar el buscador con setSearchQuery(cleanQ)');
      assert.ok(hookCode.includes('setShowDropdown(true)'), 'Debe desplegar el dropdown de resultados automáticamente');
      assert.ok(hookCode.includes('startVoiceSearch: voiceRecorder.startRecording'), 'Debe exponer startVoiceSearch');
      assert.ok(hookCode.includes('stopVoiceSearch: voiceRecorder.stopRecording'), 'Debe exponer stopVoiceSearch');
    });

    it('3.3: useAiVoiceRecorder.js soporta silenceThresholdMs y maxDurationMs configurables', () => {
      const recorderCode = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/hooks/useAiVoiceRecorder.js'), 'utf-8');
      assert.ok(recorderCode.includes('silenceThresholdMs = 1600'), 'Debe soportar silenceThresholdMs con default 1600');
      assert.ok(recorderCode.includes('maxDurationMs = 15000'), 'Debe soportar maxDurationMs con default 15000');
      assert.ok(recorderCode.includes('silentMs > silenceThresholdMs'), 'VAD debe evaluar silentMs > silenceThresholdMs');
    });

    it('3.4: FastManualSaleForm.jsx limpia selectedPoster al iniciar nueva búsqueda por voz y respeta el techo de <= 350 líneas', () => {
      const formCode = fs.readFileSync(path.join(rootDir, 'src/components/FastManualSaleForm.jsx'), 'utf-8');
      const lines = formCode.split('\n').length;
      assert.ok(lines <= 350, `FastManualSaleForm.jsx tiene ${lines} líneas (máximo permitido: 350)`);
      assert.ok(
        formCode.includes('onClearSelection: () => setSelectedPoster(null)'),
        'FastManualSaleForm.jsx debe pasar onClearSelection para limpiar selectedPoster y mostrar la lista de pósters'
      );
    });
  });
});
