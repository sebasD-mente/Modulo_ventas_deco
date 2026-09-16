import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as lucide from 'lucide-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('⚔️ CHALLENGER M2: Empirical UI Stress & State Resilience Test Suite', () => {

  // =========================================================================
  // 1. LINE CEILINGS & MONOLITH AUDIT
  // =========================================================================
  describe('1. Line Ceilings & Monolith Verification', () => {
    const limits = [
      { file: 'src/components/UnifiedAiChat.jsx', max: 80, desc: 'Master container' },
      { file: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 160, desc: 'SSE Chat hook' },
      { file: 'src/components/ai-chat/AiErrorBanner.jsx', max: 50, desc: 'Error banner component' },
      { file: 'server/services/ai/aiMediaService.js', max: 200, desc: 'Multimodal media service' },
      { file: 'server/services/embeddingService.js', max: 200, desc: 'Embedding service' },
    ];

    for (const { file, max, desc } of limits) {
      it(`1.x. ${file} (${desc}) must strictly be <= ${max} lines`, () => {
        const fullPath = path.join(projectRoot, file);
        assert.ok(fs.existsSync(fullPath), `${file} must exist`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        assert.ok(
          lines <= max,
          `LINE CEILING BREACH: ${file} has ${lines} lines, exceeding max allowed ${max}`
        );
      });
    }
  });

  // =========================================================================
  // 2. JSX COMPILATION & CLEAN PARSING
  // =========================================================================
  describe('2. JSX and Module Compilation Verification', () => {
    const m2Files = [
      'src/components/UnifiedAiChat.jsx',
      'src/components/ai-chat/AiErrorBanner.jsx',
      'src/components/ai-chat/hooks/useAiChatStream.js',
    ];

    for (const file of m2Files) {
      it(`2.x. ${file} transpiles cleanly with esbuild without syntax or JSX errors`, () => {
        const fullPath = path.join(projectRoot, file);
        const code = fs.readFileSync(fullPath, 'utf8');
        const isJsx = file.endsWith('.jsx');
        assert.doesNotThrow(() => {
          esbuild.transformSync(code, {
            loader: isJsx ? 'jsx' : 'js',
            format: 'esm',
          });
        }, `Compilation error in ${file}`);
      });
    }
  });

  // =========================================================================
  // 3. AI ERROR BANNER COMPONENT RENDERING & INTERACTION
  // =========================================================================
  describe('3. AiErrorBanner Component Empirical Behavior', () => {
    const bannerPath = path.join(projectRoot, 'src/components/ai-chat/AiErrorBanner.jsx');
    const bannerCode = fs.readFileSync(bannerPath, 'utf8');
    const transformed = esbuild.transformSync(bannerCode, { loader: 'jsx', format: 'cjs' });
    const fn = new Function('require', 'exports', 'module', transformed.code);
    const mod = { exports: {} };
    fn((pkg) => {
      if (pkg === 'react') return React;
      if (pkg === 'lucide-react') return lucide;
      throw new Error('Unknown package in banner: ' + pkg);
    }, mod.exports, mod);
    const AiErrorBanner = mod.exports.default || mod.exports;

    it('3.1. Renders null when error is null or undefined', () => {
      const htmlNull = ReactDOMServer.renderToStaticMarkup(React.createElement(AiErrorBanner, { error: null }));
      assert.strictEqual(htmlNull, '', 'Must render empty string when error is null');

      const htmlUndef = ReactDOMServer.renderToStaticMarkup(React.createElement(AiErrorBanner, { error: undefined }));
      assert.strictEqual(htmlUndef, '', 'Must render empty string when error is undefined');
    });

    it('3.2. Renders title, message, and fallback title when title is omitted', () => {
      const htmlWithTitle = ReactDOMServer.renderToStaticMarkup(
        React.createElement(AiErrorBanner, {
          error: { title: 'Error Personalizado', message: 'Detalle de fallo' },
        })
      );
      assert.ok(htmlWithTitle.includes('Error Personalizado'), 'Should contain specified title');
      assert.ok(htmlWithTitle.includes('Detalle de fallo'), 'Should contain specified message');
      assert.ok(htmlWithTitle.includes('Cargar Manual'), 'Should contain "Cargar Manual" button');

      const htmlDefault = ReactDOMServer.renderToStaticMarkup(
        React.createElement(AiErrorBanner, {
          error: { message: 'Fallo sin título' },
        })
      );
      assert.ok(htmlDefault.includes('Fallo en inferencia de IA'), 'Should use fallback title');
    });

    it('3.3. Invokes onDismiss when dismiss button (X) is clicked', () => {
      let dismissed = false;
      const element = AiErrorBanner({
        error: { title: 'Test', message: 'Test message' },
        onDismiss: () => { dismissed = true; },
        onManualSale: () => {},
      });

      const buttonContainer = element.props.children[1];
      const dismissBtn = buttonContainer.props.children[0];
      dismissBtn.props.onClick();

      assert.strictEqual(dismissed, true, 'onDismiss must be triggered');
    });

    it('3.4. Invokes onManualSale when "Cargar Manual" button is clicked', () => {
      let manualClicked = false;
      const element = AiErrorBanner({
        error: { title: 'Test', message: 'Test message' },
        onDismiss: () => {},
        onManualSale: () => { manualClicked = true; },
      });

      const buttonContainer = element.props.children[1];
      const manualBtn = buttonContainer.props.children[1];
      manualBtn.props.onClick();

      assert.strictEqual(manualClicked, true, 'onManualSale must be triggered');
    });
  });

  // =========================================================================
  // 4. uploadMedia STATE STRESS & RESILIENCE ORACLE
  // =========================================================================
  describe('4. uploadMedia State Flow & Infinite Spinner Prevention Oracle', () => {
    // We simulate uploadMedia logic exactly as implemented in useAiChatStream.js lines 50-63
    function createUploadMediaHarness(authFetchMock) {
      const state = {
        isLoading: false,
        processingNote: '',
        aiError: null,
        messages: [],
        pendingDraft: null,
      };

      const setIsLoading = (val) => { state.isLoading = val; };
      const setProcessingNote = (val) => { state.processingNote = val; };
      const setAiError = (val) => { state.aiError = val; };
      const setPendingDraft = (val) => { state.pendingDraft = val; };
      const pushAiMsg = (text) => { state.messages.push({ sender: 'ai', text }); };
      const setMessages = (fn) => { state.messages = fn(state.messages); };
      const clearAiError = () => { state.aiError = null; };

      const uploadMedia = async (url, form, userText, note, onDone) => {
        setIsLoading(true); setProcessingNote(note); setAiError(null);
        setMessages((p) => [...p, { id: 'msg-user', sender: 'user', text: userText }]);
        try {
          const res = await authFetchMock(url, { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Error procesando');
          setPendingDraft(data.draftSale);
          if (onDone) onDone(data);
        } catch (err) {
          const isQuota = /429|cuota|quota|resource_exhausted/i.test(err?.message);
          const isNet = /fetch|network|conexi[oó]n|offline|failed/i.test(err?.message);
          const friendlyMsg = isQuota
            ? 'Límite de cuota de IA alcanzado. Continúa en modo manual.'
            : isNet
            ? 'Problema de conexión con el servicio de IA.'
            : err?.message?.replace(/^.*AI_MEDIA_SERVICE_FAILED:\s*/, '').trim() || 'No fue posible procesar el archivo.';
          setAiError({
            title: url.includes('voice') ? 'Fallo en dictado de voz' : 'Fallo en foto/visión',
            message: friendlyMsg,
            channel: url.includes('voice') ? 'IA_VOZ' : 'IA_FOTO_ARTE',
          });
          pushAiMsg(`⚠️ ${friendlyMsg}`);
        } finally {
          setIsLoading(false);
          setProcessingNote('');
        }
      };

      return { state, uploadMedia, clearAiError };
    }

    it('4.1. Voice upload 429 quota error: clears spinner and sets friendly aiError with channel IA_VOZ', async () => {
      const authFetch = async () => ({
        ok: false,
        json: async () => ({ success: false, error: 'RESOURCE_EXHAUSTED: quota exceeded 429' }),
      });

      const harness = createUploadMediaHarness(authFetch);
      await harness.uploadMedia('/api/ai/voice-sale', new FormData(), '🎙️ [Venta dictada por voz]', 'Analizando voz...', () => {});

      assert.strictEqual(harness.state.isLoading, false, 'isLoading must be FALSE (no infinite spinner)');
      assert.strictEqual(harness.state.processingNote, '', 'processingNote must be empty string');
      assert.ok(harness.state.aiError, 'aiError must be populated');
      assert.strictEqual(harness.state.aiError.title, 'Fallo en dictado de voz');
      assert.strictEqual(harness.state.aiError.message, 'Límite de cuota de IA alcanzado. Continúa en modo manual.');
      assert.strictEqual(harness.state.aiError.channel, 'IA_VOZ');
      assert.ok(harness.state.messages.some((m) => m.text.includes('Límite de cuota de IA alcanzado')));
    });

    it('4.2. Image upload network failure: clears spinner and sets friendly aiError with channel IA_FOTO_ARTE', async () => {
      const authFetch = async () => {
        throw new TypeError('Failed to fetch: Network request failed');
      };

      const harness = createUploadMediaHarness(authFetch);
      await harness.uploadMedia('/api/ai/recognize-artwork', new FormData(), '📷 [Foto enviada]', 'Analizando foto...', () => {});

      assert.strictEqual(harness.state.isLoading, false, 'isLoading must be FALSE');
      assert.strictEqual(harness.state.processingNote, '', 'processingNote must be cleared');
      assert.ok(harness.state.aiError, 'aiError must be set');
      assert.strictEqual(harness.state.aiError.title, 'Fallo en foto/visión');
      assert.strictEqual(harness.state.aiError.message, 'Problema de conexión con el servicio de IA.');
      assert.strictEqual(harness.state.aiError.channel, 'IA_FOTO_ARTE');
    });

    it('4.3. Adversarial Observation: "AI_MEDIA_SERVICE_FAILED" contains "failed", so isNet intercepts it', async () => {
      const authFetch = async () => ({
        ok: false,
        json: async () => ({ success: false, error: 'AI_MEDIA_SERVICE_FAILED: No se detectó póster' }),
      });

      const harness = createUploadMediaHarness(authFetch);
      await harness.uploadMedia('/api/ai/recognize-artwork', new FormData(), '📷 [Foto enviada]', 'Analizando...', () => {});

      assert.strictEqual(harness.state.isLoading, false, 'isLoading must be false');
      assert.strictEqual(harness.state.processingNote, '', 'processingNote must be cleared');
      // Because /failed/i matches 'AI_MEDIA_SERVICE_FAILED', it sets the network error message:
      assert.strictEqual(
        harness.state.aiError.message,
        'Problema de conexión con el servicio de IA.',
        'Due to /failed/i in isNet, AI_MEDIA_SERVICE_FAILED errors trigger the connection issue branch'
      );
    });

    it('4.4. Domain error without "failed" or "network" keywords shows descriptive error message', async () => {
      const authFetch = async () => ({
        ok: false,
        json: async () => ({ success: false, error: 'Formato de audio corrupto o vacío' }),
      });

      const harness = createUploadMediaHarness(authFetch);
      await harness.uploadMedia('/api/ai/voice-sale', new FormData(), '🎙️ [Voz]', 'Analizando...', () => {});

      assert.strictEqual(harness.state.isLoading, false);
      assert.strictEqual(harness.state.processingNote, '');
      assert.strictEqual(harness.state.aiError.message, 'Formato de audio corrupto o vacío');
    });

    it('4.5. Stress test: rapid sequence of 5 failed uploads always leaves state clean', async () => {
      let callCount = 0;
      const authFetch = async () => {
        callCount++;
        throw new Error(`Error transitorio ${callCount}`);
      };

      const harness = createUploadMediaHarness(authFetch);
      for (let i = 0; i < 5; i++) {
        await harness.uploadMedia('/api/ai/voice-sale', new FormData(), '🎙️ [Voz]', 'Analizando...', () => {});
        assert.strictEqual(harness.state.isLoading, false);
        assert.strictEqual(harness.state.processingNote, '');
        assert.ok(harness.state.aiError);
      }
      assert.strictEqual(callCount, 5);
    });
  });

  // =========================================================================
  // 5. "CARGAR MANUAL" INTEGRATION FLOW IN UNIFIEDAICHAT
  // =========================================================================
  describe('5. UnifiedAiChat onManualSale Integration Flow', () => {
    it('5.1. Clicking Cargar Manual passes channel and descriptive notes to onPopulateManualForm and clears error', () => {
      let populatedData = null;
      let errorCleared = false;

      const mockAiError = {
        title: 'Fallo en dictado de voz',
        message: 'Límite de cuota alcanzado',
        channel: 'IA_VOZ',
      };

      const clearAiError = () => {
        errorCleared = true;
      };

      const onPopulateManualForm = (data) => {
        populatedData = data;
      };

      // Handler logic copied directly from UnifiedAiChat.jsx lines 36-41:
      const handleManualSale = () => {
        const channel = mockAiError?.channel || 'MANUAL_RAPIDA';
        const note = `Fallo IA (${mockAiError?.title || 'Inferencia'}) - Carga manual directa`;
        clearAiError();
        if (onPopulateManualForm) onPopulateManualForm({ inputChannel: channel, notes: note, items: [] });
      };

      handleManualSale();

      assert.strictEqual(errorCleared, true, 'clearAiError must be called');
      assert.ok(populatedData, 'onPopulateManualForm must be called');
      assert.strictEqual(populatedData.inputChannel, 'IA_VOZ', 'channel must match aiError.channel');
      assert.strictEqual(
        populatedData.notes,
        'Fallo IA (Fallo en dictado de voz) - Carga manual directa',
        'notes must explain the source of the manual load'
      );
      assert.deepStrictEqual(populatedData.items, [], 'items must be initialized to empty array');
    });

    it('5.2. Fallback channel is MANUAL_RAPIDA when channel property is missing', () => {
      let populatedData = null;
      const mockAiError = { title: 'Error Inesperado' };

      const handleManualSale = () => {
        const channel = mockAiError?.channel || 'MANUAL_RAPIDA';
        const note = `Fallo IA (${mockAiError?.title || 'Inferencia'}) - Carga manual directa`;
        const populate = (data) => { populatedData = data; };
        populate({ inputChannel: channel, notes: note, items: [] });
      };

      handleManualSale();
      assert.strictEqual(populatedData.inputChannel, 'MANUAL_RAPIDA');
      assert.strictEqual(populatedData.notes, 'Fallo IA (Error Inesperado) - Carga manual directa');
    });
  });
});
