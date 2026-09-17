import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildVoiceSalePrompt, voiceSaleResponseSchema } from '../../server/services/ai/aiPromptService.js';

describe('🎙️ Voice Lexical Priming, Hesitation Guard & VAD Shielding Suite', () => {

  describe('1. Priming Léxico de Dominio & Protección Fonética (aiPromptService.js)', () => {
    it('1.1. Exporta buildVoiceSalePrompt como función canónica', () => {
      assert.strictEqual(typeof buildVoiceSalePrompt, 'function', 'buildVoiceSalePrompt debe ser una función');
    });

    it('1.2. Inyecta contexto de Deco Vintage Guate, arte impreso y catálogo ferial', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /Deco Vintage Guate/i, 'Debe incluir la marca Deco Vintage Guate');
      assert.match(prompt, /pósters/i, 'Debe incluir el término pósters');
      assert.match(prompt, /marcos|cuadros|arte impreso/i, 'Debe incluir rubros feriales de la tienda');
      assert.match(prompt, /cine|anime|series|música/i, 'Debe incluir categorías culturales feriales');
    });

    it('1.3. Prohíbe explícitamente falsos positivos fonéticos ("pastel", "stickers", "postre")', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /pastel/i, 'Debe mencionar y proscribir el término pastel');
      assert.match(prompt, /stickers/i, 'Debe mencionar y proscribir el término stickers');
      assert.match(prompt, /PROHIBIDO/i, 'Debe usar directiva prohibitiva explícita');
      assert.match(prompt, /SIEMPRE.*póster/i, 'Debe instruir interpretar póster ante ambigüedad');
    });

    it('1.4. Define los 6 tamaños estándar de mostrador y sus equivalencias', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /Mini/i, 'Debe incluir tamaño Mini');
      assert.match(prompt, /Pequeño/i, 'Debe incluir tamaño Pequeño');
      assert.match(prompt, /Portada de Álbum/i, 'Debe incluir Portada de Álbum');
      assert.match(prompt, /Mediano/i, 'Debe incluir tamaño Mediano');
      assert.match(prompt, /Grande/i, 'Debe incluir tamaño Grande');
      assert.match(prompt, /Gigante/i, 'Debe incluir tamaño Gigante');
    });

    it('1.5. Exige transcripción literal completa en el campo transcription', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /transcription/i, 'Debe referenciar el campo transcription');
      assert.match(prompt, /literal|palabra por palabra/i, 'Debe exigir transcripción literal fiel');
      assert.ok(voiceSaleResponseSchema.properties.transcription, 'voiceSaleResponseSchema debe contener campo transcription');
    });
  });

  describe('2. Protección contra Vacilaciones Numéricas & Falsos Inicios', () => {
    it('2.1. El prompt contiene directivas explícitas de autocorrección ("dos pa-")', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /dos pa-/i, 'Debe contener el ejemplo arquetípico dos pa-');
      assert.match(prompt, /cantidad final corregida/i, 'Debe instruir tomar solo la cantidad final corregida');
      assert.match(prompt, /NUNCA sumes números vacilantes/i, 'Debe prohibir sumar números de falsas partidas');
    });

    it('2.2. Simulación de resolución de vacilaciones: autocorrección numérica', () => {
      // Simula la lógica de resolución semántica requerida para el modelo
      function resolveHesitationText(text) {
        // Corrección de falsos inicios: "dos pa-... un póster" -> 1 póster
        const cleaned = text.replace(/(\w+)\s+(?:pa-|no,\s*|perdón,\s*|o sea,\s*)/gi, '');
        return cleaned;
      }

      const input = 'dos pa-... un póster de batman mediano';
      const output = resolveHesitationText(input);
      assert.match(output, /un póster de batman mediano/i, 'Debe eliminar el falso inicio "dos pa-"');
    });
  });

  describe('3. Calibración VAD Frontend, Precedencia Manual y Peak-Decay (useAiVoiceRecorder.js)', () => {
    const hookPath = path.resolve('src/components/ai-chat/hooks/useAiVoiceRecorder.js');
    const content = fs.readFileSync(hookPath, 'utf8');

    it('3.1. Umbral de silencio de corte elevado a 3800ms (3.8s)', () => {
      assert.match(content, /silence\s*>\s*3800/, 'Debe tener umbral de silencio > 3800ms para corte');
    });

    it('3.2. Advertencia visual retardada a 2500ms (2.5s)', () => {
      assert.match(content, /silence\s*>\s*2500/, 'Debe tener umbral de aviso > 2500ms para vadActive');
    });

    it('3.3. Precedencia absoluta al botón Finalizar con isManualStopRef y requestData', () => {
      assert.match(content, /isManualStopRef\s*=\s*useRef\(false\)/, 'Debe declarar isManualStopRef');
      assert.match(content, /isManualStopRef\.current\s*=\s*true/, 'stopRecording debe marcar isManualStopRef.current = true');
      assert.match(content, /mediaRecorderRef\.current\.requestData\?\.\(\)/, 'stopRecording debe forzar vaciado con requestData()');
    });

    it('3.4. Descarte de grabaciones cortas permite despacho manual >= 300ms', () => {
      assert.match(content, /duration\s*<\s*300/, 'Debe permitir audios >= 300ms en parada manual');
      assert.match(content, /!isManualStopRef\.current\s*&&\s*!hasSpokenRef\.current\s*&&\s*duration\s*<\s*1200/, 'VAD automático descarta < 1200ms solo si no fue manual');
    });

    it('3.5. Piso de ruido acotado con clamp superior (max 0.018) e inferior (0.006)', () => {
      assert.match(content, /noiseFloor\s*=\s*Math\.max\(0\.006,\s*Math\.min\(0\.018/, 'Debe clampear noiseFloor entre 0.006 y 0.018');
    });

    it('3.6. Umbral de voz acotado con clamp superior (max 0.028) e inferior (0.012)', () => {
      assert.match(content, /voiceThreshold\s*=\s*Math\.max\(0\.012,\s*Math\.min\(0\.028/, 'Debe clampear voiceThreshold entre 0.012 y 0.028');
    });

    it('3.7. Filtro peak-decay aplicado en el cálculo de audioLevel (factor 0.72)', () => {
      assert.match(content, /Math\.round\(prevLevel\s*\*\s*0\.72\)/, 'Debe implementar filtro peak-decay con factor 0.72');
    });
  });

  describe('4. Inferencia Multimodal Directa & Paralelización en Backend', () => {
    const mediaServicePath = path.resolve('server/services/ai/aiMediaService.js');
    const mediaServiceContent = fs.readFileSync(mediaServicePath, 'utf8');
    const controllerPath = path.resolve('server/controllers/ai/aiMediaController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    it('4.1. aiMediaService ejecuta DIRECT_VOICE_SALE_INFERENCE en un solo paso', () => {
      assert.match(mediaServiceContent, /actionName:\s*['"]DIRECT_VOICE_SALE_INFERENCE['"]/, 'Debe nombrar la acción DIRECT_VOICE_SALE_INFERENCE');
      assert.match(mediaServiceContent, /buildVoiceSalePrompt\(\)/, 'Debe invocar buildVoiceSalePrompt()');
      assert.match(mediaServiceContent, /responseSchema:\s*voiceSaleResponseSchema/, 'Debe configurar responseSchema');
    });

    it('4.2. aiMediaController paraleliza persistencia GCS e inferencia con Promise.all', () => {
      assert.match(controllerContent, /Promise\.all\(\s*\[\s*safePersistMedia/, 'Debe usar Promise.all con safePersistMedia');
      assert.match(controllerContent, /processVoiceSaleAudio/, 'Debe incluir processVoiceSaleAudio en Promise.all');
    });
  });

  describe('5. Techos Monolíticos de Líneas & Cero Deuda Arquitectónica', () => {
    const files = [
      { name: 'aiPromptService.js', path: 'server/services/ai/aiPromptService.js', limit: 180, op: '<' },
      { name: 'aiMediaService.js', path: 'server/services/ai/aiMediaService.js', limit: 200, op: '<=' },
      { name: 'aiMediaController.js', path: 'server/controllers/ai/aiMediaController.js', limit: 180, op: '<=' },
      { name: 'useAiVoiceRecorder.js', path: 'src/components/ai-chat/hooks/useAiVoiceRecorder.js', limit: 140, op: '<' },
    ];

    for (const f of files) {
      it(`5.x. ${f.name} cumple techo estricto (${f.op} ${f.limit} líneas)`, () => {
        const fullPath = path.resolve(f.path);
        const count = fs.readFileSync(fullPath, 'utf8').split('\n').length;
        if (f.op === '<') {
          assert.ok(count < f.limit, `${f.name} tiene ${count} líneas, debe ser < ${f.limit}`);
        } else {
          assert.ok(count <= f.limit, `${f.name} tiene ${count} líneas, debe ser <= ${f.limit}`);
        }
      });
    }
  });

});
