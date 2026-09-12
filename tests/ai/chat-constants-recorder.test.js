import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_EVENT_SIZES,
  SIZE_PRICE_MAP,
  SIZE_ALIASES,
  PAYMENT_ALIASES,
  formatTime,
  buildOfflineFallbackReply,
} from '../../src/components/ai-chat/chatConstants.js';
import { getSupportedAudioMimeType } from '../../src/components/ai-chat/hooks/useAiVoiceRecorder.js';

describe('chatConstants & useAiVoiceRecorder Suite', () => {
  test('DEFAULT_EVENT_SIZES contains 6 valid event sizes', () => {
    assert.strictEqual(DEFAULT_EVENT_SIZES.length, 6);
    const expectedIds = ['MINI', 'PEQUENO', 'PORTADA_ALBUM', 'MEDIANO', 'GRANDE', 'GIGANTE'];
    expectedIds.forEach((id) => {
      const found = DEFAULT_EVENT_SIZES.find((s) => s.sizeId === id);
      assert.ok(found, `Size ${id} must exist`);
      assert.ok(found.precio > 0, `Size ${id} must have positive price`);
    });
  });

  test('SIZE_PRICE_MAP matches size prices correctly', () => {
    assert.strictEqual(SIZE_PRICE_MAP.MINI, 25);
    assert.strictEqual(SIZE_PRICE_MAP.PEQUENO, 35);
    assert.strictEqual(SIZE_PRICE_MAP.PORTADA_ALBUM, 55);
    assert.strictEqual(SIZE_PRICE_MAP.MEDIANO, 65);
    assert.strictEqual(SIZE_PRICE_MAP.GRANDE, 125);
    assert.strictEqual(SIZE_PRICE_MAP.GIGANTE, 180);
  });

  test('formatTime formats seconds into m:ss format', () => {
    assert.strictEqual(formatTime(0), '0:00');
    assert.strictEqual(formatTime(9), '0:09');
    assert.strictEqual(formatTime(45), '0:45');
    assert.strictEqual(formatTime(60), '1:00');
    assert.strictEqual(formatTime(75), '1:15');
    assert.strictEqual(formatTime(605), '10:05');
  });

  test('buildOfflineFallbackReply extracts query details and generates draft', () => {
    const result = buildOfflineFallbackReply('2 spiderman gigante tarjeta');
    assert.ok(result.text.includes('spiderman'));
    assert.strictEqual(result.draft.total, 360); // 2 * 180
    assert.strictEqual(result.draft.paymentMethod, 'TARJETA');
    assert.strictEqual(result.draft.items[0].quantity, 2);
    assert.strictEqual(result.draft.items[0].sizeId, 'GIGANTE');
    assert.strictEqual(result.draftSale, result.draft);

    const result2 = buildOfflineFallbackReply('tres batman chico transfer');
    assert.strictEqual(result2.draft.items[0].quantity, 3);
    assert.strictEqual(result2.draft.items[0].sizeId, 'PEQUENO');
    assert.strictEqual(result2.draft.paymentMethod, 'TRANSFERENCIA');
    assert.strictEqual(result2.draft.total, 105); // 3 * 35
  });

  test('getSupportedAudioMimeType handles environments gracefully', () => {
    const mime = getSupportedAudioMimeType();
    assert.strictEqual(typeof mime, 'string');
  });

  test('Line counts strictly comply with constraints (<60 and <140)', () => {
    const constPath = path.resolve('src/components/ai-chat/chatConstants.js');
    const hookPath = path.resolve('src/components/ai-chat/hooks/useAiVoiceRecorder.js');

    const constLines = fs.readFileSync(constPath, 'utf8').split('\n').length;
    const hookLines = fs.readFileSync(hookPath, 'utf8').split('\n').length;

    assert.ok(constLines < 60, `chatConstants.js must be < 60 lines (currently ${constLines})`);
    assert.ok(hookLines < 140, `useAiVoiceRecorder.js must be < 140 lines (currently ${hookLines})`);
    assert.ok(constLines < 200, `chatConstants.js must be < 200 lines`);
    assert.ok(hookLines < 200, `useAiVoiceRecorder.js must be < 200 lines`);
  });
});
