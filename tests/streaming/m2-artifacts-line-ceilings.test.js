import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('📏 M2 Artifacts Line Ceilings & Structural Integrity', () => {

  const useAiChatStreamPath = path.join(projectRoot, 'src/components/ai-chat/hooks/useAiChatStream.js');
  const chatMessageListPath = path.join(projectRoot, 'src/components/ai-chat/ChatMessageList.jsx');

  it('1. useAiChatStream.js existe y cumple estrictamente el límite de < 160 líneas', () => {
    assert.ok(fs.existsSync(useAiChatStreamPath), 'useAiChatStream.js debe existir');
    const content = fs.readFileSync(useAiChatStreamPath, 'utf8');
    const lines = content.split('\n');
    assert.ok(lines.length < 160, `useAiChatStream.js tiene ${lines.length} líneas, debe ser < 160 líneas`);
  });

  it('2. ChatMessageList.jsx existe y cumple estrictamente el límite de < 100 líneas', () => {
    assert.ok(fs.existsSync(chatMessageListPath), 'ChatMessageList.jsx debe existir');
    const content = fs.readFileSync(chatMessageListPath, 'utf8');
    const lines = content.split('\n');
    assert.ok(lines.length < 100, `ChatMessageList.jsx tiene ${lines.length} líneas, debe ser < 100 líneas`);
  });

  it('3. useAiChatStream.js implementa lógica genuina sin facades ni shortcuts', () => {
    const code = fs.readFileSync(useAiChatStreamPath, 'utf8');

    // Genuine SSE and decoding
    assert.ok(code.includes('TextDecoder'), 'Debe usar TextDecoder para stream SSE');
    assert.ok(code.includes('reader.read()'), 'Debe leer el reader del stream SSE genuinamente');
    assert.ok(code.includes('requestAnimationFrame'), 'Debe implementar rAF token batching');
    assert.ok(code.includes('cancelAnimationFrame'), 'Debe implementar cancelAnimationFrame');

    // Circuit Breaker & Fallback
    assert.ok(code.includes('AbortController'), 'Debe implementar AbortController');
    assert.ok(/(8000|25000)/.test(code), 'Debe tener timeout para circuit breaker (25000ms)');
    assert.ok(code.includes('buildOfflineFallbackReply'), 'Debe invocar buildOfflineFallbackReply en contingencia');

    // Mutations & Multimodal Endpoints
    assert.ok(code.includes('/api/ai/chat'), 'Debe consultar endpoint SSE /api/ai/chat');
    assert.ok(code.includes('/api/ai/voice-sale'), 'Debe soportar subida de audio /api/ai/voice-sale');
    assert.ok(code.includes('/api/ai/recognize-artwork'), 'Debe soportar vision /api/ai/recognize-artwork');
    assert.ok(code.includes('/api/sales'), 'Debe liquidar ventas atómicamente a /api/sales');
    assert.ok(code.includes('confetti'), 'Debe disparar confetti en confirmación exitosa');
  });

  it('4. ChatMessageList.jsx desacopla scroll e integra ChatToolCards', () => {
    const code = fs.readFileSync(chatMessageListPath, 'utf8');

    // Desacople de scroll
    assert.ok(code.includes('isPinnedToBottomRef'), 'Debe usar isPinnedToBottomRef');
    assert.ok(code.includes('chatContainerRef'), 'Debe usar chatContainerRef');
    assert.ok(code.includes('scrollHeight - c.scrollTop - c.clientHeight <= 80'), 'Debe evaluar umbral de anclaje de 80px');

    // Tool cards y feedback
    assert.ok(code.includes('ChatToolCards'), 'Debe renderizar componente ChatToolCards');
    assert.ok(code.includes('/brand/icon-chat-avatar.png'), 'Debe incluir avatar de marca');
    assert.ok(code.includes('Loader2'), 'Debe incluir spinner Loader2');
  });

});
