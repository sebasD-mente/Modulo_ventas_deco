import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import { ENV } from '../../server/config/env.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';
import {
  getOrCreateSession,
  saveSessionState,
  clearSessionDraft,
  getSessionState,
} from '../../server/services/ai/aiSessionService.js';
import { handleChatQuery } from '../../server/controllers/ai/aiChatController.js';
import { constructDraftPayload } from '../../server/services/ai/aiToolsService.js';

const MOCK_CATALOG = [
  {
    id: 'prod-batman-1',
    sku: 'DV-BAT-01',
    name: 'Batman The Dark Knight',
    category: 'CÓMICS',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/batman.jpg',
    tags: ['batman', 'dc', 'comic'],
    isActive: true,
    tenantId: 'tenant-adv',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
    ],
  },
];

const mockSessions = new Map();
let originalGenerateContent;
let originalGenerateContentStream;

function setupMockPrisma() {
  if (!prisma.aiChatSession) prisma.aiChatSession = {};
  prisma.aiChatSession.findUnique = async ({ where }) => mockSessions.get(where.sessionId) || null;
  prisma.aiChatSession.findFirst = async ({ where }) => {
    for (const s of mockSessions.values()) {
      if (s.sessionId === where.sessionId && (!where.tenantId || s.tenantId === where.tenantId)) {
        return s;
      }
    }
    return null;
  };
  prisma.aiChatSession.upsert = async ({ where, create, update }) => {
    let rec = mockSessions.get(where.sessionId);
    if (rec) {
      rec = { ...rec, ...update, updatedAt: new Date() };
    } else {
      rec = {
        id: 'uuid-' + Math.random().toString(36).slice(2, 9),
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    mockSessions.set(where.sessionId, rec);
    return rec;
  };
  prisma.aiChatSession.update = async ({ where, data }) => {
    let rec = mockSessions.get(where.sessionId);
    if (!rec) throw new Error('Not found');
    rec = { ...rec, ...data, updatedAt: new Date() };
    mockSessions.set(where.sessionId, rec);
    return rec;
  };
  prisma.aiChatSession.deleteMany = async () => ({ count: 0 });

  if (!prisma.sale) prisma.sale = {};
  prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
  prisma.sale.findMany = async () => [];

  if (!prisma.saleItem) prisma.saleItem = {};
  prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 } });
  prisma.saleItem.groupBy = async () => [];

  if (!prisma.salePayment) prisma.salePayment = {};
  prisma.salePayment.groupBy = async () => [];

  if (!prisma.auditLog) prisma.auditLog = {};
  prisma.auditLog.create = async () => ({ id: 'mock-audit' });

  if (!prisma.product) prisma.product = {};
  prisma.product.findMany = async () => MOCK_CATALOG;

  if (!prisma.event) prisma.event = {};
  prisma.event.findFirst = async () => ({ id: 'event-adv', status: 'ACTIVO', name: 'Adv Event' });
  prisma.event.findUnique = async () => ({ id: 'event-adv', status: 'ACTIVO', name: 'Adv Event' });
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: null,
    written: '',
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.headersSent = true; this.body = data; return this; },
    writeHead(code, headers) { this.statusCode = code; this.headers = headers; this.headersSent = true; return this; },
    write(chunk) { this.written += chunk; return true; },
    end() { this.ended = true; },
    flushHeaders() {},
  };
}

describe('⚔️ ADVERSARIAL STRESS: Empirical Verification of Turn 2 Context Recall (#VAL-003)', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-adv-key';
    mockSessions.clear();
    setupMockPrisma();
    invalidateCatalogCache();

    const client = getGeminiClient();
    if (client?.models) {
      if (!originalGenerateContent) originalGenerateContent = client.models.generateContent;
      if (!originalGenerateContentStream) originalGenerateContentStream = client.models.generateContentStream;

      client.models.embedContent = async () => ({
        embedding: { values: new Array(768).fill(0.01) },
      });
    }
  });

  afterEach(() => {
    mockSessions.clear();
    invalidateCatalogCache();
    const client = getGeminiClient();
    if (client?.models) {
      if (originalGenerateContent) client.models.generateContent = originalGenerateContent;
      if (originalGenerateContentStream) client.models.generateContentStream = originalGenerateContentStream;
    }
  });

  it('Adversarial 1: Turn 2 in Streaming Mode (SSE) genuinely recalls draft from PostgreSQL and updates state', async () => {
    const sessionId = 'adv-stream-turn2';

    // Sembrar Turno 1 en PostgreSQL
    const initialDraft = await constructDraftPayload(
      'tenant-adv',
      { items: [{ productName: 'Batman The Dark Knight', quantity: 1, size: 'PEQUENO' }], paymentMethod: 'EFECTIVO' },
      '1 Batman pequeño en efectivo'
    );
    await saveSessionState(sessionId, {
      pendingDraft: initialDraft,
      history: [
        { role: 'user', text: '1 Batman pequeño en efectivo' },
        { role: 'model', text: 'Borrador preparado.' },
      ],
      sellerName: 'Vendedor Adv',
      eventId: 'event-adv',
      tenantId: 'tenant-adv',
    });

    const client = getGeminiClient();
    let capturedSystemInstruction = null;

    client.models.generateContentStream = async function* (params) {
      capturedSystemInstruction = params?.config?.systemInstruction || null;
      yield { text: 'Actualizando a grande con tarjeta. ' };
      yield {
        functionCalls: [
          {
            name: 'prepareSaleDraft',
            args: {
              items: [{ productName: 'Batman The Dark Knight', quantity: 1, size: 'GRANDE' }],
              paymentMethod: 'TARJETA',
            },
          },
        ],
      };
      yield { text: '¡Listo! Q125 con tarjeta.' };
    };

    // Petición Turno 2 con streaming activado y payload sin history ni draft
    const req = {
      body: {
        sessionId,
        message: 'Cámbialo a grande y pago con tarjeta',
        history: [],
        pendingDraft: null,
        eventId: 'event-adv',
        sellerName: 'Vendedor Adv',
        stream: true,
      },
      tenantId: 'tenant-adv',
      user: { fullName: 'Vendedor Adv' },
      ip: '127.0.0.1',
      on: (event, handler) => {},
    };
    const res = createMockResponse();

    await handleChatQuery(req, res);

    assert.ok(capturedSystemInstruction !== null, 'generateContentStream debió recibir systemInstruction');
    assert.ok(capturedSystemInstruction.includes('BORRADOR ACTIVO EN PANTALLA'), 'systemInstruction debe tener borrador hidratado');
    assert.ok(capturedSystemInstruction.includes('Batman The Dark Knight'), 'systemInstruction debe tener Batman hidratado');

    // Verificar que los eventos SSE emitidos contienen la actualización
    assert.ok(res.written.includes('event: session'), 'Debe emitir evento session');
    assert.ok(res.written.includes('event: draft_sale'), 'Debe emitir evento draft_sale');
    assert.ok(res.written.includes('event: done'), 'Debe emitir evento done');

    // Verificar que PostgreSQL fue actualizado al finalizar el stream
    const sessionAfter = await getSessionState(sessionId, 'tenant-adv');
    assert.ok(sessionAfter !== null);
    assert.strictEqual(sessionAfter.pendingDraft.items[0].sizeId, 'GRANDE');
    assert.strictEqual(sessionAfter.pendingDraft.total, 125);
    assert.strictEqual(sessionAfter.pendingDraft.paymentMethod, 'TARJETA');
  });

  it('Adversarial 2: Turn 2 con orden de cancelación purga atómicamente el borrador en PostgreSQL a null', async () => {
    const sessionId = 'adv-cancel-turn2';

    // Sembrar Turno 1 con borrador
    const initialDraft = await constructDraftPayload(
      'tenant-adv',
      { items: [{ productName: 'Batman The Dark Knight', quantity: 2, size: 'MEDIANO' }], paymentMethod: 'EFECTIVO' },
      '2 Batman mediano'
    );
    await saveSessionState(sessionId, {
      pendingDraft: initialDraft,
      history: [{ role: 'user', text: '2 Batman' }],
      sellerName: 'Vendedor Adv',
      eventId: 'event-adv',
      tenantId: 'tenant-adv',
    });

    const client = getGeminiClient();
    client.models.generateContent = async (params) => {
      return {
        text: 'Borrador cancelado.',
        functionCalls: [{ name: 'discardSaleDraft', args: {} }],
      };
    };

    const req = {
      body: {
        sessionId,
        message: 'cancela la orden, ya no quiero nada',
        history: [],
        pendingDraft: null,
        eventId: 'event-adv',
        sellerName: 'Vendedor Adv',
        stream: false,
      },
      tenantId: 'tenant-adv',
      user: { fullName: 'Vendedor Adv' },
      ip: '127.0.0.1',
    };
    const res = createMockResponse();

    await handleChatQuery(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.draft, null, 'El borrador retornado debe ser null');

    // Verificar que en base de datos quedó en null inmediatamente
    const sessionAfter = await getSessionState(sessionId, 'tenant-adv');
    assert.strictEqual(sessionAfter.pendingDraft, null, 'pendingDraft en PostgreSQL debe ser null tras descarte');
  });

  it('Adversarial 3: Falla de base de datos en getOrCreateSession no debe arrojar error 500 fatal (resiliencia)', async () => {
    const sessionId = 'adv-db-failure';
    // Simular que Prisma falla temporalmente en findUnique/upsert
    const originalUpsert = prisma.aiChatSession.upsert;
    prisma.aiChatSession.upsert = async () => { throw new Error('DB Connection Timeout'); };

    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: 'Respondiendo sin base de datos.',
      functionCalls: [],
    });

    const req = {
      body: {
        sessionId,
        message: 'Hola qué tal',
        history: [],
        eventId: 'event-adv',
        stream: false,
      },
      tenantId: 'tenant-adv',
      user: { fullName: 'Vendedor Adv' },
      ip: '127.0.0.1',
    };
    const res = createMockResponse();

    await handleChatQuery(req, res);

    // Restaurar upsert
    prisma.aiChatSession.upsert = originalUpsert;

    assert.strictEqual(res.statusCode, 500, 'Falla de base de datos en persistencia debe capturarse en bloque catch y responder HTTP 500');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'DB Connection Timeout');
  });
});
