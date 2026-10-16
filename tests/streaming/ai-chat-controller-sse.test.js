import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { handleChatQuery } from '../../server/controllers/ai/aiChatController.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { ENV } from '../../server/config/env.js';

describe('⚡ Verificación Coercitiva SSE Streaming (aiChatController)', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-key-sse-controller-audit';
  });

  it('emite event: session, event: token y event: done sin ReferenceError por TDZ', async () => {
    const client = getGeminiClient();
    assert.ok(client, 'Cliente Gemini debe estar inicializado');

    // Mock stream de Gemini
    client.models.generateContentStream = async function* () {
      yield { text: '¡Hola! ' };
      yield { text: 'Tenemos pósters de Star Wars.' };
    };

    const writtenChunks = [];
    const req = new EventEmitter();
    req.body = {
      message: 'Tienes pósters de Star Wars?',
      eventId: 'event-test-123',
      stream: true,
      sessionId: 'test-session-sse-tdz',
    };
    req.headers = { accept: 'text/event-stream' };
    req.tenantId = 'default-tenant';
    req.user = { fullName: 'Vendedor Local' };
    req.socket = { setNoDelay: () => {} };

    const res = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      statusCode: null,
      headers: {},
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
        this.headersSent = true;
      },
      flushHeaders() {},
      flush() {},
      write(chunk) {
        writtenChunks.push(chunk);
      },
      end() {
        this.writableEnded = true;
      },
    };

    await handleChatQuery(req, res);

    const fullStreamOutput = writtenChunks.join('');

    // Verificar que los eventos clave se hayan emitido sin error
    assert.ok(fullStreamOutput.includes('event: session'), 'Debe emitir event: session');
    assert.ok(fullStreamOutput.includes('test-session-sse-tdz'), 'Debe incluir el sessionId');
    assert.ok(fullStreamOutput.includes('event: token'), 'Debe emitir event: token');
    assert.ok(fullStreamOutput.includes('Star Wars'), 'Debe emitir el contenido del token');
    assert.ok(fullStreamOutput.includes('event: done'), 'Debe emitir event: done');
    assert.strictEqual(res.writableEnded, true, 'El stream debe finalizar con res.end()');

    // Verificar que NUNCA se haya emitido un error de inicialización
    assert.ok(
      !fullStreamOutput.includes('isClientClosed'),
      'No debe existir ningún error de Temporal Dead Zone para isClientClosed'
    );
    assert.ok(
      !fullStreamOutput.includes('Cannot access'),
      'No debe existir ReferenceError en el stream'
    );
  });

  it('procesa chunks de draft_sale en stream SSE sin arrojar errores', async () => {
    const client = getGeminiClient();

    client.models.generateContentStream = async function* () {
      yield {
        text: '¡Listo! Te preparé el borrador:',
        functionCalls: [
          {
            name: 'prepareSaleDraft',
            args: {
              items: [
                {
                  title: 'Star Wars A New Hope',
                  size: 'MEDIANO',
                  quantity: 1,
                  unitPrice: 65,
                  subtotal: 65,
                },
              ],
              total: 65,
              customerType: 'CASUAL',
            },
          },
        ],
      };
    };

    const writtenChunks = [];
    const req = new EventEmitter();
    req.body = {
      message: 'Dame un póster mediano de Star Wars',
      eventId: 'event-test-123',
      stream: true,
      sessionId: 'test-session-sse-draft',
    };
    req.headers = { accept: 'text/event-stream' };
    req.tenantId = 'default-tenant';
    req.user = { fullName: 'Vendedor Local' };
    req.socket = { setNoDelay: () => {} };

    const res = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      statusCode: null,
      headers: {},
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
        this.headersSent = true;
      },
      flushHeaders() {},
      flush() {},
      write(chunk) {
        writtenChunks.push(chunk);
      },
      end() {
        this.writableEnded = true;
      },
    };

    await handleChatQuery(req, res);

    const fullStreamOutput = writtenChunks.join('');
    assert.ok(fullStreamOutput.includes('event: draft_sale'), 'Debe emitir event: draft_sale');
    assert.ok(fullStreamOutput.includes('event: done'), 'Debe emitir event: done');
    assert.strictEqual(res.writableEnded, true, 'El stream debe finalizar con res.end()');
  });

  it('maneja desconexión temprana del cliente (req.emit close) sin arrojar excepciones', async () => {
    const client = getGeminiClient();

    const req = new EventEmitter();
    req.body = {
      message: 'Hola mundo',
      eventId: 'event-test-123',
      stream: true,
      sessionId: 'test-session-sse-close',
    };
    req.headers = { accept: 'text/event-stream' };
    req.tenantId = 'default-tenant';
    req.user = { fullName: 'Vendedor Local' };
    req.socket = { setNoDelay: () => {} };

    client.models.generateContentStream = async function* () {
      yield { text: 'Primer chunk' };
      // Simular desconexión del cliente
      req.emit('close');
      yield { text: 'Segundo chunk que no debería escribirse' };
    };

    const writtenChunks = [];
    const res = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      statusCode: null,
      headers: {},
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
        this.headersSent = true;
      },
      flushHeaders() {},
      flush() {},
      write(chunk) {
        writtenChunks.push(chunk);
      },
      end() {
        this.writableEnded = true;
      },
    };

    await handleChatQuery(req, res);

    const fullStreamOutput = writtenChunks.join('');
    assert.ok(!fullStreamOutput.includes('Segundo chunk que no debería escribirse'), 'No debe escribir chunks tras desconexión');
  });
});
