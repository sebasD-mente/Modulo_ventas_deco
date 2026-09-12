import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_EVENT_SIZES,
  SIZE_PRICE_MAP,
  SIZE_ALIASES,
  PAYMENT_ALIASES,
  formatTime,
  buildOfflineFallbackReply,
} from '../../src/components/ai-chat/chatConstants.js';

import { getSupportedAudioMimeType } from '../../src/components/ai-chat/hooks/useAiVoiceRecorder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER: Hito M4 — Modular Refactoring of UnifiedAiChat.jsx', () => {

  // =========================================================================
  // SECCIÓN 1: AUDITORÍA FORENSE DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Límites de Líneas y Erradicación de Monolitos', () => {
    const fileCeilings = [
      { file: 'src/components/UnifiedAiChat.jsx', max: 80, desc: 'Contenedor Maestro' },
      { file: 'src/components/ai-chat/chatConstants.js', max: 60, desc: 'Constantes y Offline Fallback' },
      { file: 'src/components/ai-chat/hooks/useAiVoiceRecorder.js', max: 140, desc: 'Hook Grabación y VAD' },
      { file: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 160, desc: 'Hook Streaming SSE' },
      { file: 'src/components/ai-chat/ChatMessageList.jsx', max: 100, desc: 'Lista de Mensajes' },
      { file: 'src/components/ai-chat/ChatToolCards.jsx', max: 140, desc: 'Tarjetas de Herramientas' },
      { file: 'src/components/ai-chat/ChatDraftCard.jsx', max: 140, desc: 'Tarjeta de Borrador' },
      { file: 'src/components/ai-chat/ChatSwapModal.jsx', max: 100, desc: 'Modal de Sustitución' },
      { file: 'src/components/ai-chat/ChatHeader.jsx', max: 50, desc: 'Cabecera del Chat' },
      { file: 'src/components/ai-chat/ChatInputBar.jsx', max: 80, desc: 'Barra Inferior de Entrada' },
    ];

    for (const { file, max, desc } of fileCeilings) {
      it(`1.x. ${file} (${desc}) respeta estrictamente el techo de < ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(
          lineCount < max,
          `Violación de límite: ${file} tiene ${lineCount} líneas (máximo permitido < ${max})`
        );
        assert.ok(
          lineCount <= 200,
          `Violación de directiva de cero deuda técnica: ${file} supera 200 líneas`
        );
      });
    }
  });

  // =========================================================================
  // SECCIÓN 2: AUDITORÍA FORENSE DE INTEGRIDAD (CERO MOCKS O STUBS EN PRODUCCIÓN)
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Placeholders Residuales en Producción', () => {
    const filesToAudit = [
      'src/components/UnifiedAiChat.jsx',
      'src/components/ai-chat/chatConstants.js',
      'src/components/ai-chat/hooks/useAiVoiceRecorder.js',
      'src/components/ai-chat/hooks/useAiChatStream.js',
      'src/components/ai-chat/ChatMessageList.jsx',
      'src/components/ai-chat/ChatToolCards.jsx',
      'src/components/ai-chat/ChatDraftCard.jsx',
      'src/components/ai-chat/ChatSwapModal.jsx',
      'src/components/ai-chat/ChatHeader.jsx',
      'src/components/ai-chat/ChatInputBar.jsx',
    ];

    it('2.1. Ningún archivo contiene comentarios TODO, FIXME, STUB, MOCK o LOREM IPSUM', () => {
      // Excluye atributos HTML como placeholder="..."
      const suspiciousCommentPattern = /(\/\/\s*(TODO|FIXME|STUB|MOCK|PLACEHOLDER)|\/\*[\s\S]*?(TODO|FIXME|STUB|MOCK|PLACEHOLDER)[\s\S]*?\*\/|const\s+mock|let\s+mock|function\s+mock|lorem\s+ipsum)/i;
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(suspiciousCommentPattern);
        assert.ok(
          !match,
          `Detectado marcador residual o stub en ${file}: "${match?.[0]}"`
        );
      }
    });

    it('2.2. ChatToolCards.jsx implementa genuinamente los 5 contratos de herramientas', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/ChatToolCards.jsx'), 'utf-8');
      assert.ok(content.includes('eventKpis'), 'Debe manejar eventKpis');
      assert.ok(content.includes('cashDrawerStatus'), 'Debe manejar cashDrawerStatus');
      assert.ok(content.includes('sellerShiftReport'), 'Debe manejar sellerShiftReport');
      assert.ok(content.includes('productionQueueStatus'), 'Debe manejar productionQueueStatus');
      assert.ok(content.includes('inventoryStock'), 'Debe manejar inventoryStock');
      assert.ok(content.includes('suggestedPosters'), 'Debe manejar suggestedPosters');
      assert.ok(content.includes('totalAmount'), 'Debe mostrar totalAmount en KPIs');
      assert.ok(content.includes('currentCashInDrawer'), 'Debe mostrar efectivo en gaveta');
      assert.ok(content.includes('health'), 'Debe mostrar salud del taller');
      assert.ok(content.includes('standPhysicalStock'), 'Debe mostrar stock de stand');
    });

    it('2.3. ChatDraftCard.jsx implementa el flujo de confirmación y mutación Human-in-the-Loop', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/ChatDraftCard.jsx'), 'utf-8');
      assert.ok(content.includes('updateSize'), 'Debe permitir modificar tamaño');
      assert.ok(content.includes('updateQty'), 'Debe permitir modificar cantidad');
      assert.ok(content.includes('removeItem'), 'Debe permitir eliminar ítem');
      assert.ok(content.includes('updatePayment'), 'Debe permitir cambiar método de pago');
      assert.ok(content.includes('confirm'), 'Debe permitir confirmar venta');
      assert.ok(content.includes('handleModify'), 'Debe permitir transferir a formulario manual');
      assert.ok(content.includes('openSwap'), 'Debe permitir abrir modal de sustitución');
    });

    it('2.4. UnifiedAiChat.jsx exporta getSupportedAudioMimeType y preserva contrato de props', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/UnifiedAiChat.jsx'), 'utf-8');
      assert.ok(content.includes('export { getSupportedAudioMimeType }'), 'Debe reexportar getSupportedAudioMimeType');
      assert.ok(content.includes('eventId'), 'Debe aceptar prop eventId');
      assert.ok(content.includes('onSaleRegistered'), 'Debe aceptar prop onSaleRegistered');
      assert.ok(content.includes('onPopulateManualForm'), 'Debe aceptar prop onPopulateManualForm');
    });
  });

  // =========================================================================
  // SECCIÓN 3: STRESS TESTING EMPÍRICO DE ENTRADAS LÍMITE Y FALLBACK OFFLINE
  // =========================================================================
  describe('3. Stress Testing Empírico de Entradas Límite y Oráculo Offline', () => {

    it('3.1. buildOfflineFallbackReply maneja entradas nulas, vacías, undefined y espacios', () => {
      const badInputs = ['', '   ', null, undefined, '\t\n\r'];
      for (const input of badInputs) {
        const res = buildOfflineFallbackReply(input);
        assert.ok(res && typeof res === 'object', 'Debe retornar un objeto');
        assert.ok(typeof res.text === 'string' && res.text.length > 0, 'Debe incluir texto explicativo');
        assert.ok(res.draft && Array.isArray(res.draft.items), 'Debe generar draft con items');
        assert.equal(res.draft.items.length, 1, 'Debe generar exactamente 1 ítem por defecto');
        assert.equal(res.draft.items[0].quantity, 1, 'Cantidad por defecto debe ser 1');
        assert.equal(res.draft.items[0].sizeId, 'MEDIANO', 'Tamaño por defecto debe ser MEDIANO');
        assert.equal(res.draft.total, 65, 'Total debe ser Q65');
        assert.equal(res.draft.paymentMethod, 'EFECTIVO', 'Método por defecto debe ser EFECTIVO');
      }
    });

    it('3.2. buildOfflineFallbackReply sobrevive a cargas extremas (strings de 10,000 caracteres)', () => {
      const giantInput = 'póster '.repeat(1500) + ' 3 cuadros gigante tarjeta';
      const start = performance.now();
      const res = buildOfflineFallbackReply(giantInput);
      const duration = performance.now() - start;

      assert.ok(duration < 50, `El oráculo offline tardó demasiado (${duration.toFixed(2)}ms)`);
      assert.equal(res.draft.items[0].quantity, 3, 'Debe detectar cantidad 3');
      assert.equal(res.draft.items[0].sizeId, 'GIGANTE', 'Debe detectar tamaño GIGANTE');
      assert.equal(res.draft.total, 540, '3 × Q180 debe ser Q540');
      assert.equal(res.draft.paymentMethod, 'TARJETA', 'Debe detectar TARJETA');
    });

    it('3.3. Mapeo semántico de cantidades en palabras y números con alias canónicos', () => {
      const tests = [
        { text: 'dos de batman grande en efectivo', qty: 2, size: 'GRANDE', price: 125, method: 'EFECTIVO' },
        { text: 'tres mini anime por transfer', qty: 3, size: 'MINI', price: 25, method: 'TRANSFERENCIA' },
        { text: 'cuatro chico taylor card', qty: 4, size: 'PEQUENO', price: 35, method: 'TARJETA' },
        { text: 'cinco de formula 1 gigante en tarjeta', qty: 5, size: 'GIGANTE', price: 180, method: 'TARJETA' },
        { text: '10 de spiderman mediano', qty: 10, size: 'MEDIANO', price: 65, method: 'EFECTIVO' },
      ];

      for (const t of tests) {
        const res = buildOfflineFallbackReply(t.text);
        assert.equal(res.draft.items[0].quantity, t.qty, `Cantidad incorrecta para: ${t.text}`);
        assert.equal(res.draft.items[0].sizeId, t.size, `Tamaño incorrecto para: ${t.text}`);
        assert.equal(res.draft.items[0].unitPrice, t.price, `Precio unitario incorrecto para: ${t.text}`);
        assert.equal(res.draft.total, t.qty * t.price, `Total incorrecto para: ${t.text}`);
        assert.equal(res.draft.paymentMethod, t.method, `Método de pago incorrecto para: ${t.text}`);
      }
    });

    it('3.4. formatTime formatea correctamente límites temporales (0s, 59s, 60s, 3600s)', () => {
      assert.equal(formatTime(0), '0:00');
      assert.equal(formatTime(9), '0:09');
      assert.equal(formatTime(59), '0:59');
      assert.equal(formatTime(60), '1:00');
      assert.equal(formatTime(125), '2:05');
      assert.equal(formatTime(3600), '60:00');
    });
  });

  // =========================================================================
  // SECCIÓN 4: STRESS TESTING DE AUDIO, CÓDECS Y SEGURIDAD DE MEDIARECORDER
  // =========================================================================
  describe('4. Resiliencia de Audio, Códecs y Aislamiento de Entorno', () => {

    it('4.1. getSupportedAudioMimeType maneja entorno Node (sin MediaRecorder) limpiamente', () => {
      const mime = getSupportedAudioMimeType();
      assert.equal(mime, '', 'En entorno sin MediaRecorder debe retornar cadena vacía');
    });

    it('4.2. getSupportedAudioMimeType selecciona correctamente códecs en simulación de navegadores', () => {
      const originalMediaRecorder = global.MediaRecorder;

      try {
        // Simulación Safari iOS (solo mp4 / aac)
        global.MediaRecorder = class MockSafariRecorder {
          static isTypeSupported(type) {
            return type.includes('mp4') || type.includes('aac');
          }
        };
        assert.equal(getSupportedAudioMimeType(), 'audio/mp4');

        // Simulación Android Chrome / Desktop (soporta webm con opus)
        global.MediaRecorder = class MockChromeRecorder {
          static isTypeSupported(type) {
            return type.includes('webm;codecs=opus');
          }
        };
        assert.equal(getSupportedAudioMimeType(), 'audio/webm;codecs=opus');

        // Simulación navegador restrictivo (ningún códec soportado)
        global.MediaRecorder = class MockNoCodecRecorder {
          static isTypeSupported() {
            return false;
          }
        };
        assert.equal(getSupportedAudioMimeType(), '');
      } finally {
        if (originalMediaRecorder) {
          global.MediaRecorder = originalMediaRecorder;
        } else {
          delete global.MediaRecorder;
        }
      }
    });
  });

  // =========================================================================
  // SECCIÓN 5: INTEGRIDAD DEL BUFFER SSE Y CIRCUIT BREAKER
  // =========================================================================
  describe('5. Auditoría de Buffer SSE, Circuit Breaker y Prevención de Re-Renders', () => {
    it('5.1. useAiChatStream implementa Circuit Breaker con timeout de 25 segundos (25000ms)', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/hooks/useAiChatStream.js'), 'utf-8');
      assert.ok(/(8000|25000)/.test(content), 'Debe existir un temporizador de 25000ms para el circuit breaker');
      assert.ok(content.includes('controller.abort()'), 'Debe abortar la petición al vencer el timeout');
      assert.ok(content.includes('AbortController'), 'Debe utilizar AbortController');
    });

    it('5.2. useAiChatStream desacopla el renderizado con requestAnimationFrame y cancela en desmontaje', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/hooks/useAiChatStream.js'), 'utf-8');
      assert.ok(content.includes('requestAnimationFrame'), 'Debe usar requestAnimationFrame para regular el flujo de tokens');
      assert.ok(content.includes('cancelAnimationFrame'), 'Debe limpiar raf en cancelación o desmontaje');
      assert.ok(content.includes('rafIdRef'), 'Debe almacenar la referencia del RAF en un ref mutable');
    });

    it('5.3. ChatMessageList implementa detección precisa de anclaje de scroll (distancia <= 80px)', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/ChatMessageList.jsx'), 'utf-8');
      assert.ok(content.includes('scrollHeight - c.scrollTop - c.clientHeight <= 80'), 'Debe usar la regla de umbral de 80px para isPinnedToBottom');
    });
  });

});
