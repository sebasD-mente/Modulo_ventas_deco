import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

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
  });

  test('Archivo B: ChatInputBar.jsx strictly satisfies UI feedback contracts and line limits (< 80)', () => {
    const filePath = path.resolve('src/components/ai-chat/ChatInputBar.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines < 80, `ChatInputBar.jsx must be < 80 lines, got ${lines}`);
    assert.ok(lines < 100, `ChatInputBar.jsx must be < 100 lines`);
    assert.match(content, /Pausa detectada\.\.\. finalizando/, 'Must show Pause text when vadActive');
    assert.match(content, /Grabando:.*• Pulsa Finalizar al terminar/, 'Must show recording duration and Finalizar hint');
  });

  test('Archivo C: useAiChatStream.js strictly satisfies empty audio and real items validation (<= 160)', () => {
    const filePath = path.resolve('src/components/ai-chat/hooks/useAiChatStream.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines <= 160, `useAiChatStream.js must be <= 160 lines, got ${lines}`);
    assert.match(content, /meta\?\.empty/, 'Must check meta.empty in handleVoiceUpload');
    assert.match(content, /No alcancé a escucharte\. Pulsa el micrófono/, 'Must notify user when audio is empty');
    assert.match(content, /!data\.draftSale\?\.items\s*\|\|\s*data\.draftSale\.items\.length\s*===\s*0/, 'Must validate real items in draftSale');
    assert.match(content, /no identifiqué obras del catálogo/, 'Must warn user when no catalog items were recognized');
  });

  test('Archivo D: aiMediaController.js strictly satisfies line limits (<= 180) and empty items HTTP 200 contract', async () => {
    const filePath = path.resolve('server/controllers/ai/aiMediaController.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    assert.ok(lines <= 180, `aiMediaController.js must be <= 180 lines, got ${lines}`);
    assert.ok(lines <= 200, `aiMediaController.js must be <= 200 lines`);
    assert.match(content, /!draft\.items\s*\|\|\s*draft\.items\.length\s*===\s*0/, 'Must check empty draft items');
    assert.match(content, /itemsDetected:\s*false/, 'Must return itemsDetected: false');
    assert.match(content, /draftSale:\s*null/, 'Must return draftSale: null');
  });
});
