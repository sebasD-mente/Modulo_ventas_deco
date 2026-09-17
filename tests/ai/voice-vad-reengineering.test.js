import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { Type } from '@google/genai';
import { voiceSaleResponseSchema } from '../../server/services/ai/aiPromptService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { searchWebPosters } from '../../server/services/webCatalogService.js';
import { calculateDecibelsAndLevel } from '../../src/components/ai-chat/hooks/useAiChatAudio.js';

describe('🎤 Voice & VAD Reengineering Validation Suite', () => {
  test('Archivo A: useAiVoiceRecorder.js strictly satisfies all architectural contracts and line limits (< 140)', () => {
    const filePath = path.resolve('src/components/ai-chat/hooks/useAiVoiceRecorder.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 140, `useAiVoiceRecorder.js must be < 140 lines, got ${lines}`);
    assert.match(content, /hasSpokenRef\s*=\s*useRef\(false\)/, 'Must initialize hasSpokenRef');
    assert.match(content, /voiceThreshold\s*=\s*Math\.max\(0\.012,\s*noiseFloor\s*\*\s*1\.6\)/, 'Must calculate dynamic voice threshold');
    assert.match(content, /setTimeout\(\(\)\s*=>\s*stopRecording\(\),\s*15000\)/, 'Must set hard timeout to 15000ms');
    assert.match(content, /silence\s*>\s*2500/, 'Must have 2500ms silence threshold for stop');
    assert.match(content, /silence\s*>\s*1500/, 'Must have 1500ms silence threshold for vadActive');
    assert.match(content, /empty:\s*isEmpty/, 'Must filter empty recordings onstop');
    assert.match(content, /isCancelledRef\s*=\s*useRef\(false\)/, 'Must initialize isCancelledRef');
    assert.match(content, /cancelRecording\s*=\s*useCallback/, 'Must define cancelRecording');
    assert.match(content, /0\.035/, 'Must use 0.035 ceiling RMS for voice speech calibration');
  });

  test('Archivo B: ChatInputBar.jsx strictly satisfies UI feedback contracts, cancel action, and line limits (< 80)', () => {
    const filePath = path.resolve('src/components/ai-chat/ChatInputBar.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 80, `ChatInputBar.jsx must be < 80 lines, got ${lines}`);
    assert.ok(lines < 100, `ChatInputBar.jsx must be < 100 lines`);
    assert.match(content, /Pausa detectada\.\.\. finalizando/, 'Must show Pause text when vadActive');
    assert.match(content, /Grabando:.*• Pulsa Finalizar al terminar/, 'Must show recording duration and Finalizar hint');
    assert.match(content, /onCancelRecording/, 'Must receive onCancelRecording prop');
    assert.match(content, /<X\s/, 'Must render Cancel button with X icon');
    assert.match(content, /audioLevel\s*\*\s*scale\s*\*\s*0\.14\)\s*\+\s*2/, 'Must calibrate visualizer dynamic height');
  });

  test('Archivo C: useAiChatStream.js strictly satisfies empty audio, greeting handling and line limits (<= 160)', () => {
    const filePath = path.resolve('src/components/ai-chat/hooks/useAiChatStream.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines <= 160, `useAiChatStream.js must be <= 160 lines, got ${lines}`);
    assert.match(content, /meta\?\.empty/, 'Must check meta.empty in handleVoiceUpload');
    assert.match(content, /No alcancé a escucharte\. Pulsa el micrófono/, 'Must notify user when audio is empty');
    assert.match(content, /!data\.draftSale\?\.items\s*\|\|\s*data\.draftSale\.items\.length\s*===\s*0/, 'Must validate real items in draftSale');
    assert.match(content, /no identifiqué obras del catálogo/, 'Must warn user when no catalog items were recognized');
    assert.match(content, /data\.intent\s*===\s*'SALUDO'/, 'Must handle SALUDO intent without blank draft');
  });

  test('Archivo D: aiMediaController.js strictly satisfies line limits (<= 180), greeting response, and empty items contract', () => {
    const filePath = path.resolve('server/controllers/ai/aiMediaController.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines <= 180, `aiMediaController.js must be <= 180 lines, got ${lines}`);
    assert.ok(lines <= 200, `aiMediaController.js must be <= 200 lines`);
    assert.match(content, /!draft\.items\s*\|\|\s*draft\.items\.length\s*===\s*0/, 'Must check empty draft items');
    assert.match(content, /itemsDetected:\s*false/, 'Must return itemsDetected: false');
    assert.match(content, /draftSale:\s*null/, 'Must return draftSale: null');
    assert.match(content, /draft\.intent\s*===\s*'SALUDO'/, 'Must check SALUDO intent in handleVoiceSale');
  });

  test('Archivo E: aiPromptService.js schema validation and line limits (< 180)', () => {
    const filePath = path.resolve('server/services/ai/aiPromptService.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 180, `aiPromptService.js must be < 180 lines, got ${lines}`);
    assert.ok(voiceSaleResponseSchema, 'voiceSaleResponseSchema must exist');
    assert.strictEqual(voiceSaleResponseSchema.properties.isSaleDetected.type, Type.BOOLEAN);
    assert.strictEqual(voiceSaleResponseSchema.properties.intent.type, Type.STRING);
    assert.deepStrictEqual(voiceSaleResponseSchema.properties.intent.enum, ['SALUDO', 'CONSULTA_CATALOGO', 'DICTADO_VENTA', 'RUIDO_NO_VENTA']);
    assert.ok(voiceSaleResponseSchema.required.includes('isSaleDetected'), 'isSaleDetected must be required');
    assert.ok(voiceSaleResponseSchema.required.includes('intent'), 'intent must be required');
    assert.ok(!voiceSaleResponseSchema.required.includes('items'), 'items must NOT be required');
    assert.ok(!voiceSaleResponseSchema.required.includes('paymentMethod'), 'paymentMethod must NOT be required');
  });

  test('Archivo F: aiMediaService.js decoupled STT/NLU and line limits (<= 200)', () => {
    const filePath = path.resolve('server/services/ai/aiMediaService.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines <= 200, `aiMediaService.js must be <= 200 lines, got ${lines}`);
    assert.match(content, /STT_LITERAL_TRANSCRIPTION/, 'Must have literal STT phase');
    assert.match(content, /NLU_INTENT_EXTRACTION/, 'Must have NLU intent extraction phase');
    assert.match(content, /resolveEntityAlias/, 'Must connect to resolveEntityAlias');
    assert.match(content, /searchHybridPosters/, 'Must connect to searchHybridPosters');
  });

  test('Archivo G: webCatalogService.js single-token protection ("mundo" != Bad Bunny) and line limits (< 200)', async () => {
    const filePath = path.resolve('server/services/webCatalogService.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 200, `webCatalogService.js must be < 200 lines, got ${lines}`);
    assert.ok(lines < 180, `webCatalogService.js target is < 180 lines, got ${lines}`);

    // Test single-token protection with cached products
    const tenantId = 'test-vad-single-token';
    invalidateCatalogCache(tenantId);
    productCache.set(tenantId, {
      timestamp: Date.now(),
      products: [
        {
          id: 'poster-bad-bunny',
          titulo: 'Bad Bunny Un Verano Sin Ti',
          subtitulo: 'Musica urbana album cover',
          categoria: 'MUSICA',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.jpg',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/bb.jpg',
          tags: ['bad', 'bunny', 'musica', 'urbano', 'mundo', 'verano'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
        {
          id: 'poster-mapa-mundo',
          titulo: 'Mapa del Mundo Vintage',
          subtitulo: 'Cartografia clasica',
          categoria: 'VINTAGE',
          imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/mundo.jpg',
          thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/mundo.jpg',
          tags: ['mapa', 'mundo', 'vintage', 'tierra'],
          sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
        },
      ],
    });

    const results = await searchWebPosters({ tenantId, query: 'mundo' });
    assert.ok(Array.isArray(results), 'Results must be an array');
    const titles = results.map((r) => r.titulo);
    assert.ok(titles.includes('Mapa del Mundo Vintage'), 'Must match poster with "Mundo" in title');
    assert.ok(!titles.includes('Bad Bunny Un Verano Sin Ti'), 'Must NOT match Bad Bunny when querying "mundo"');
    invalidateCatalogCache(tenantId);
  });

  test('Archivo H: useAiChatAudio.js sensitivity calibration and retrocompatibility', () => {
    const filePath = path.resolve('src/components/ai-chat/hooks/useAiChatAudio.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 140, `useAiChatAudio.js must be < 140 lines, got ${lines}`);
    assert.match(content, /smoothingTimeConstant\s*=\s*0\.4/, 'Must use 0.4 for lively reactivity');

    // Retrocompatibility test with default 0.12 ceiling
    const mockBuffer = new Float32Array(512).fill(0.05);
    const resDefault = calculateDecibelsAndLevel({ getFloatTimeDomainData: (b) => b.set(mockBuffer) }, mockBuffer);
    assert.equal(resDefault.level, 42, 'Default ceiling must calculate level 42 for RMS 0.05');

    // Calibrated test with custom 0.035 ceiling for normal speech (RMS 0.02)
    const speechBuffer = new Float32Array(512).fill(0.02);
    const resSpeech = calculateDecibelsAndLevel({ getFloatTimeDomainData: (b) => b.set(speechBuffer) }, speechBuffer, 0.035);
    assert.ok(resSpeech.level >= 55 && resSpeech.level <= 60, `Speech level should be ~57%, got ${resSpeech.level}`);
  });
});
