import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculateDecibelsAndLevel } from '../../src/components/ai-chat/hooks/useAiChatAudio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('⚔️ CHALLENGER 2: Empirical Audio Calibration, Cancellation Mechanics & Monolith Audit Suite', () => {

  // =========================================================================
  // SECCIÓN 1: CALIBRACIÓN ACÚSTICA Y NIVELES VIVOS (40-75% PARA RMS CONVERSACIONAL)
  // =========================================================================
  describe('1. Verificación Empírica de Calibración Acústica (RMS 0.015 - 0.035)', () => {

    function createMockAnalyserWithRms(targetRms, fftSize = 512) {
      const buffer = new Float32Array(fftSize).fill(targetRms);
      return {
        buffer,
        analyser: {
          fftSize,
          getFloatTimeDomainData: (dest) => {
            dest.set(buffer);
          },
        },
      };
    }

    it('1.1. Maneja entradas nulas o indefinidas de forma segura sin lanzar excepciones', () => {
      assert.deepStrictEqual(calculateDecibelsAndLevel(null, null), { rms: 0, level: 0 });
      assert.deepStrictEqual(calculateDecibelsAndLevel(undefined, new Float32Array(512)), { rms: 0, level: 0 });
      assert.deepStrictEqual(calculateDecibelsAndLevel({}, null), { rms: 0, level: 0 });
    });

    it('1.2. Silencio absoluto (RMS = 0) produce nivel 0%', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.strictEqual(res.rms, 0);
      assert.strictEqual(res.level, 0);
    });

    it('1.3. RMS conversacional bajo (0.015) produce nivel vivo en el rango 40-45% (~43%) con techo calibrado 0.035', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.015);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.ok(Math.abs(res.rms - 0.015) < 1e-6);
      assert.strictEqual(res.level, 43, `Se esperaba level 43%, se obtuvo ${res.level}%`);
      assert.ok(res.level >= 40 && res.level <= 75, `Nivel ${res.level}% fuera de rango vivo 40-75%`);
    });

    it('1.4. RMS conversacional medio (0.020) produce nivel vivo en el rango 55-60% (~57%) con techo calibrado 0.035', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.020);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.strictEqual(res.level, 57, `Se esperaba level 57%, se obtuvo ${res.level}%`);
      assert.ok(res.level >= 40 && res.level <= 75, `Nivel ${res.level}% fuera de rango vivo 40-75%`);
    });

    it('1.5. RMS conversacional medio-alto (0.025) produce nivel vivo en el rango 70-75% (~71%) con techo calibrado 0.035', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.025);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.strictEqual(res.level, 71, `Se esperaba level 71%, se obtuvo ${res.level}%`);
      assert.ok(res.level >= 40 && res.level <= 75, `Nivel ${res.level}% fuera de rango vivo 40-75%`);
    });

    it('1.6. RMS conversacional límite superior (0.035) satura en 100% con techo calibrado 0.035', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.035);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.strictEqual(res.level, 100, `Se esperaba level 100%, se obtuvo ${res.level}%`);
    });

    it('1.7. Sonidos muy fuertes (RMS > 0.035) se saturan limpiamente en 100 sin desbordar', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.5);
      const res = calculateDecibelsAndLevel(analyser, buffer, 0.035);
      assert.strictEqual(res.level, 100);
    });

    it('1.8. Retrocompatibilidad: con ceiling por defecto (0.12), RMS 0.05 produce level 42', () => {
      const { analyser, buffer } = createMockAnalyserWithRms(0.05);
      const res = calculateDecibelsAndLevel(analyser, buffer); // omite ceilingRms -> usa default 0.12
      assert.strictEqual(res.level, 42);
    });

    it('1.9. Verificación de fórmulas de animación en ChatInputBar para niveles conversacionales', () => {
      const scales = [0.4, 0.85, 1.0, 0.6];
      const calculateBarHeights = (level) =>
        scales.map((scale) => Math.max(3, Math.min(14, Math.round((level * scale * 0.14) + 2))));

      // Nivel para habla típica (RMS 0.020 -> level 57)
      const heights57 = calculateBarHeights(57);
      assert.deepStrictEqual(heights57, [5, 9, 10, 7]);
      assert.ok(Math.max(...heights57) >= 10, 'La barra central debe alzarse a al menos 10px en habla normal');

      // Nivel en silencio (level 0)
      const heights0 = calculateBarHeights(0);
      assert.deepStrictEqual(heights0, [3, 3, 3, 3], 'En silencio todas las barras se contraen a 3px');

      // Nivel máximo (level 100)
      const heights100 = calculateBarHeights(100);
      assert.deepStrictEqual(heights100, [8, 14, 14, 10], 'A volumen pleno satura en 14px');
    });
  });

  // =========================================================================
  // SECCIÓN 2: MECÁNICA DE CANCELACIÓN Y PREVENCIÓN DE LLAMADAS HTTP
  // =========================================================================
  describe('2. Verificación de Mecánica de Cancelación en Grabación de Voz', () => {

    it('2.1. useAiVoiceRecorder define cancelRecording con isCancelledRef.current = true y descarte de chunks', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src/components/ai-chat/hooks/useAiVoiceRecorder.js'),
        'utf-8'
      );

      assert.ok(/isCancelledRef\s*=\s*useRef\(false\)/.test(content), 'Debe declarar isCancelledRef');
      assert.ok(content.includes('isCancelledRef.current = true;'), 'cancelRecording debe marcar isCancelledRef.current = true');
      assert.ok(content.includes('audioChunksRef.current = [];'), 'cancelRecording debe vaciar audioChunksRef');
      assert.ok(content.includes('stopRecording();'), 'cancelRecording debe invocar stopRecording');
    });

    it('2.2. onstop descarta chunks y aborta inmediatamente si isCancelledRef.current es true', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src/components/ai-chat/hooks/useAiVoiceRecorder.js'),
        'utf-8'
      );

      const guardPattern = /if\s*\(\s*isCancelledRef\.current\s*\)\s*\{\s*isCancelledRef\.current\s*=\s*false;\s*audioChunksRef\.current\s*=\s*\[\];\s*return;\s*\}/;
      assert.ok(
        guardPattern.test(content),
        'mediaRecorder.onstop DEBE contener guardia if (isCancelledRef.current) que resetea y retorna sin emitir onRecordingComplete'
      );
    });

    it('2.3. Simulación completa de ciclo de grabación vs ciclo de cancelación', async () => {
      function createRecorderSimulation(onRecordingCompleteMock) {
        const audioChunksRef = { current: [] };
        const isCancelledRef = { current: false };
        let isRecording = false;

        const fakeMediaRecorder = {
          state: 'inactive',
          mimeType: 'audio/webm',
          ondataavailable: null,
          onstop: null,
          start() { this.state = 'recording'; },
          stop() {
            this.state = 'inactive';
            if (this.onstop) this.onstop();
          },
        };

        fakeMediaRecorder.ondataavailable = (e) => {
          if (e.data?.size > 0) audioChunksRef.current.push(e.data);
        };

        fakeMediaRecorder.onstop = async () => {
          if (isCancelledRef.current) {
            isCancelledRef.current = false;
            audioChunksRef.current = [];
            return;
          }
          const audioBlob = { size: audioChunksRef.current.length * 100, type: fakeMediaRecorder.mimeType };
          if (onRecordingCompleteMock) {
            await onRecordingCompleteMock(audioBlob, { empty: audioBlob.size === 0 });
          }
        };

        const startRecording = () => {
          isRecording = true;
          isCancelledRef.current = false;
          audioChunksRef.current = [];
          fakeMediaRecorder.start();
        };

        const stopRecording = () => {
          isRecording = false;
          if (fakeMediaRecorder.state !== 'inactive') fakeMediaRecorder.stop();
        };

        const cancelRecording = () => {
          isCancelledRef.current = true;
          audioChunksRef.current = [];
          stopRecording();
        };

        const pushData = (bytes) => {
          if (fakeMediaRecorder.ondataavailable) {
            fakeMediaRecorder.ondataavailable({ data: { size: bytes } });
          }
        };

        return {
          audioChunksRef,
          isCancelledRef,
          startRecording,
          stopRecording,
          cancelRecording,
          pushData,
        };
      }

      // Caso A: Grabación normal completada
      let normalCompletedBlob = null;
      const recNormal = createRecorderSimulation((blob) => {
        normalCompletedBlob = blob;
      });

      recNormal.startRecording();
      recNormal.pushData(200);
      recNormal.pushData(300);
      recNormal.stopRecording();

      assert.ok(normalCompletedBlob !== null, 'Grabación normal debe llamar onRecordingComplete');
      assert.strictEqual(normalCompletedBlob.size, 200, 'Debe procesar los chunks recolectados');

      // Caso B: Grabación cancelada
      let cancelledCompletedCalls = 0;
      const recCancelled = createRecorderSimulation(() => {
        cancelledCompletedCalls++;
      });

      recCancelled.startRecording();
      recCancelled.pushData(400);
      recCancelled.pushData(500);
      assert.strictEqual(recCancelled.audioChunksRef.current.length, 2);

      recCancelled.cancelRecording();

      assert.strictEqual(cancelledCompletedCalls, 0, 'cancelRecording NUNCA debe invocar onRecordingComplete');
      assert.strictEqual(recCancelled.audioChunksRef.current.length, 0, 'Chunks deben haber sido purgados a 0');
      assert.strictEqual(recCancelled.isCancelledRef.current, false, 'isCancelledRef debe haber sido reseteado');
    });

    it('2.4. ChatInputBar.jsx renderiza botón Cancelar con onCancelRecording y X icon', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src/components/ai-chat/ChatInputBar.jsx'),
        'utf-8'
      );
      assert.ok(content.includes('onCancelRecording'), 'ChatInputBar debe aceptar prop onCancelRecording');
      assert.ok(content.includes('onClick={onCancelRecording}'), 'Botón cancelar debe ejecutar onCancelRecording');
      assert.ok(content.includes('title="Cancelar y descartar audio"'), 'Botón cancelar debe tener title descriptivo');
      assert.ok(content.includes('<X className='), 'Botón cancelar debe incluir icono X de Lucide');
    });

    it('2.5. UnifiedAiChat.jsx conecta voiceRecorder.cancelRecording hacia ChatInputBar', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src/components/UnifiedAiChat.jsx'),
        'utf-8'
      );
      assert.ok(
        content.includes('onCancelRecording={voiceRecorder.cancelRecording}'),
        'UnifiedAiChat debe enlazar onCancelRecording={voiceRecorder.cancelRecording}'
      );
    });
  });

  // =========================================================================
  // SECCIÓN 3: VERIFICACIÓN FORENSE DE TECHOS DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('3. Verificación Estricta de Techos de Líneas en Archivos del Alcance', () => {
    const targetFiles = [
      { path: 'server/services/ai/aiMediaService.js', max: 200, op: '<=' },
      { path: 'server/services/ai/aiPromptService.js', max: 180, op: '<' },
      { path: 'server/services/webCatalogService.js', max: 200, op: '<' },
      { path: 'server/controllers/ai/aiMediaController.js', max: 180, op: '<=' },
      { path: 'src/components/ai-chat/ChatInputBar.jsx', max: 80, op: '<' },
      { path: 'src/components/ai-chat/hooks/useAiVoiceRecorder.js', max: 140, op: '<' },
      { path: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 160, op: '<=' },
      { path: 'src/components/ai-chat/hooks/useAiChatAudio.js', max: 140, op: '<' },
      { path: 'src/components/UnifiedAiChat.jsx', max: 80, op: '<' },
    ];

    for (const { path: relPath, max, op } of targetFiles) {
      it(`3.x. ${relPath} tiene ${op} ${max} líneas`, () => {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `El archivo ${relPath} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;

        if (op === '<') {
          assert.ok(
            lines < max,
            `VIOLACIÓN DE TECHO: ${relPath} tiene ${lines} líneas (límite estricto < ${max})`
          );
        } else {
          assert.ok(
            lines <= max,
            `VIOLACIÓN DE TECHO: ${relPath} tiene ${lines} líneas (límite estricto <= ${max})`
          );
        }
      });
    }
  });

  // =========================================================================
  // SECCIÓN 4: AUDITORÍA DE MONOLITOS EN EL REPOSITORIO COMPLETO
  // =========================================================================
  describe('4. Auditoría de Cero Deuda Monolítica Real en Todo el Repositorio', () => {
    it('4.1. Cero archivos en src/ o server/ exceden sus límites arquitectónicos', () => {
      const DOMAIN_CEILINGS = {
        'server/services/semantic/entityAliases.js': 600,
        'server/index.js': 300,
        'server/routes/apiRoutes.js': 300,
        'server/controllers/authController.js': 300,
        'server/services/geminiPoolService.js': 350,
        'server/services/ai/aiToolsService.js': 250,
        'server/services/embeddingService.js': 250,
        'server/services/semantic/paymentExtractor.js': 280,
        'src/App.jsx': 250,
      };
      const DEFAULT_CEILING = 200;

      function scanDir(dir) {
        const fullDir = path.join(rootDir, dir);
        if (!fs.existsSync(fullDir)) return [];
        const files = [];
        function walk(curr) {
          for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
            const p = path.join(curr, entry.name);
            if (entry.isDirectory()) {
              if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) walk(p);
            } else if (/\.(js|jsx)$/i.test(entry.name)) {
              files.push(p);
            }
          }
        }
        walk(fullDir);
        return files;
      }

      const allFiles = [...scanDir('src'), ...scanDir('server')];
      const oversized = [];

      for (const f of allFiles) {
        const rel = path.relative(rootDir, f).replace(/\\/g, '/');
        const lines = fs.readFileSync(f, 'utf-8').split('\n').length;
        const max = DOMAIN_CEILINGS[rel] || DEFAULT_CEILING;
        if (lines > max) {
          oversized.push({ file: rel, lines, max, excess: lines - max });
        }
      }

      assert.strictEqual(
        oversized.length,
        0,
        `Se encontraron ${oversized.length} archivos que exceden sus límites: ${JSON.stringify(oversized, null, 2)}`
      );
    });
  });

});
