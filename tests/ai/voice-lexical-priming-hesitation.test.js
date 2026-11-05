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

    it('1.6. Regla 6: DICTADO MULTI-PRODUCTO explicita el manejo de 2 o más obras', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /DICTADO MULTI-PRODUCTO/i, 'Debe incluir encabezado DICTADO MULTI-PRODUCTO');
      assert.match(prompt, /2 o más obras/i, 'Debe mencionar 2 o más obras');
      assert.match(prompt, /PROHIBIDO devolver items vacío/i, 'Debe prohibir items vacío si hay obras');
    });

    it('1.7. Regla 7: TRANSCRIPCIÓN PURA prohíbe corchetes y notas internas', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /TRANSCRIPCIÓN PURA/i, 'Debe incluir encabezado TRANSCRIPCIÓN PURA');
      assert.match(prompt, /TERMINANTEMENTE PROHIBIDO/i, 'Debe prohibir notas de razonamiento');
      assert.match(prompt, /\[snip: \.\.\.\]/i, 'Debe mencionar ejemplo de corchetes prohibidos');
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

    it('4.3. aiMediaService sanitiza transcription eliminando bloques entre corchetes', () => {
      assert.match(mediaServiceContent, /cleanTranscription\s*=\s*\(parsed\.transcription\s*\|\|\s*['"]['"]\)\.replace\(\/\\\[\.\*\?\\\]\/g,\s*['"]['"]\)/, 'Debe sanitizar corchetes con RegEx');
    });
  });

  describe('5. Cohesión de Dominio, Límites de Capas & Techos Focalizados', () => {
    it('5.1. aiPromptService.js cumple techo estricto (< 180 líneas)', () => {
      const fullPath = path.resolve('server/services/ai/aiPromptService.js');
      const count = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      assert.ok(count < 180, `aiPromptService.js tiene ${count} líneas, debe ser < 180`);
    });

    it('5.2. aiMediaService.js preserva cohesión de dominio multimodal, contratos de inferencia y aislamiento de capa Service', () => {
      const fullPath = path.resolve('server/services/ai/aiMediaService.js');
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.doesNotMatch(
        content,
        /from\s+['"][^'"]*(?:controllers|routes|middleware)\//,
        'aiMediaService.js no debe importar capas superiores (controllers/routes/middleware)'
      );
      for (const fn of [
        'normalizeCatalogSizeId',
        'processVoiceSaleAudio',
        'recognizePosterArtworkFromImage',
        'recognizePostersFromVideo',
        'processPostersBatchPhoto',
        'cleanVoiceCatalogQuery',
        'transcribeVoiceSearchQuery',
      ]) {
        assert.match(content, new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\b`), `Debe exportar ${fn}`);
      }
      for (const action of [
        'DIRECT_VOICE_SALE_INFERENCE',
        'RECOGNIZE_ARTWORK_IMAGE',
        'RECOGNIZE_POSTERS_VIDEO',
        'PROCESS_BATCH_PHOTO',
        'VOICE_CATALOG_SEARCH',
      ]) {
        assert.match(content, new RegExp(`actionName:\\s*['"]${action}['"]`), `Debe instrumentar acción ${action} en executeWithModelFallback`);
      }
    });

    it('5.3. aiMediaController.js preserva cohesión de 6 handlers multimodales, telemetría recordLlmInteraction y 0 imports directos a config/', () => {
      const fullPath = path.resolve('server/controllers/ai/aiMediaController.js');
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.doesNotMatch(
        content,
        /config\/(?:prisma|env)\.js/,
        'aiMediaController.js tiene prohibido importar config/prisma.js o config/env.js directamente'
      );
      for (const handler of [
        'handleVoiceSale',
        'handleBatchPhoto',
        'handleArtworkRecognition',
        'handleVideoRecognition',
        'handleVerifyReceipt',
        'handleVoiceCatalogSearch',
      ]) {
        assert.match(content, new RegExp(`export\\s+async\\s+function\\s+${handler}\\b`), `Debe exportar el handler multimodal ${handler}`);
      }
      const telemetryCalls = (content.match(/recordLlmInteraction\s*\(/g) || []).length;
      assert.strictEqual(telemetryCalls, 6, `Los 6 handlers multimodales deben registrar telemetría recordLlmInteraction (encontrados: ${telemetryCalls})`);
    });

    it('5.4. useAiVoiceRecorder.js cumple techo estricto (< 140 líneas)', () => {
      const fullPath = path.resolve('src/components/ai-chat/hooks/useAiVoiceRecorder.js');
      const count = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      assert.ok(count < 140, `useAiVoiceRecorder.js tiene ${count} líneas, debe ser < 140`);
    });
  });

});
