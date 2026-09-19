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
  pruneExpiredSessions,
  getSessionState,
} from '../../server/services/ai/aiSessionService.js';
import {
  handleChatQuery,
  handleGetSession,
  handleClearDraft,
} from '../../server/controllers/ai/aiChatController.js';
import { constructDraftPayload } from '../../server/services/ai/aiToolsService.js';

const MOCK_CATALOG = [
  {
    id: 'prod-spiderman-1',
    sku: 'DV-SPID-01',
    name: 'Spider-Man Vintage Comic',
    category: 'CÓMICS',
    basePrice: 65,
    imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/spidey.jpg',
    tags: ['spiderman', 'marvel', 'comic'],
    isActive: true,
    tenantId: 'tenant-m4',
    sizes: [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
    ],
  },
];

const mockSessions = new Map();
let originalGenerateContent;

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
    if (!rec) throw new Error('Registro no encontrado');
    rec = { ...rec, ...data, updatedAt: new Date() };
    mockSessions.set(where.sessionId, rec);
    return rec;
  };
  prisma.aiChatSession.deleteMany = async ({ where }) => {
    let count = 0;
    if (where?.updatedAt?.lt) {
      const threshold = where.updatedAt.lt;
      for (const [key, sess] of mockSessions.entries()) {
        if (sess.updatedAt < threshold) {
          mockSessions.delete(key);
          count++;
        }
      }
    }
    return { count };
  };

  // Mock de modelos Prisma auxiliares para Aislamiento Sagrado (evitar fugas a host-db-dokploy:5432)
  if (!prisma.sale) prisma.sale = {};
  prisma.sale.aggregate = async () => ({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
  prisma.sale.findMany = async () => [];

  if (!prisma.saleItem) prisma.saleItem = {};
  prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 0 } });
  prisma.saleItem.groupBy = async () => [];

  if (!prisma.salePayment) prisma.salePayment = {};
  prisma.salePayment.groupBy = async () => [];

  if (!prisma.auditLog) prisma.auditLog = {};
  prisma.auditLog.create = async () => ({ id: 'mock-audit-id' });

  if (!prisma.product) prisma.product = {};
  prisma.product.findMany = async () => MOCK_CATALOG;

  if (!prisma.event) prisma.event = {};
  prisma.event.findFirst = async () => ({ id: 'event-m4', status: 'ACTIVO', name: 'Comic Con Stand' });
  prisma.event.findUnique = async () => ({ id: 'event-m4', status: 'ACTIVO', name: 'Comic Con Stand' });
}

function createMockResponse() {
  const res = {
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
  return res;
}

describe('🏛️ MILESTONE 4 PERSISTENCE: Persistencia Atómica de Sesión y Erradicación de Amnesia (#VAL-003)', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-m4-session-key';
    mockSessions.clear();
    setupMockPrisma();
    invalidateCatalogCache();

    const client = getGeminiClient();
    if (client?.models) {
      if (!originalGenerateContent) {
        originalGenerateContent = client.models.generateContent;
      }
      client.models.embedContent = async () => ({
        embedding: { values: new Array(768).fill(0.01) },
      });
      client.models.generateContent = async ({ contents, config }) => {
        const lastPart = contents?.[contents.length - 1]?.parts?.[0]?.text || '';
        if (lastPart.includes('grande') || lastPart.includes('tarjeta')) {
          return {
            text: '¡Con gusto! Te actualizo el póster Spider-Man a tamaño Grande y cobro con tarjeta.',
            functionCalls: [
              {
                name: 'prepareSaleDraft',
                args: {
                  items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'GRANDE' }],
                  paymentMethod: 'TARJETA',
                },
              },
            ],
          };
        }
        return {
          text: '¡Hola! Te saluda el asistente de STAND {IA}. ¿En qué te puedo asesorar?',
          functionCalls: [],
        };
      };
    }
  });

  afterEach(() => {
    mockSessions.clear();
    invalidateCatalogCache();
    const client = getGeminiClient();
    if (client?.models && originalGenerateContent) {
      client.models.generateContent = originalGenerateContent;
    }
  });

  it('1. Turno 1: Creación y Persistencia Inicial de Sesión', async () => {
    const sessionId = 'val003-session-turn1';
    const draftPayload = await constructDraftPayload(
      'tenant-m4',
      { items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO' }], paymentMethod: 'EFECTIVO' },
      '1 Spider-Man Vintage Comic mediano en efectivo'
    );

    assert.ok(draftPayload.items.length > 0, 'El payload del borrador debe contener ítems');
    assert.strictEqual(draftPayload.total, 65, 'Total debe ser Q65.00');

    await saveSessionState(sessionId, {
      pendingDraft: draftPayload,
      history: [{ role: 'user', text: '1 Spider-Man Vintage Comic mediano en efectivo' }],
      sellerName: 'Vendedor Test',
      eventId: 'event-m4',
      tenantId: 'tenant-m4',
    });

    const session = await getSessionState(sessionId, 'tenant-m4');
    assert.ok(session !== null, 'La sesión debe existir en base de datos');
    assert.strictEqual(session.sessionId, sessionId);
    assert.strictEqual(session.pendingDraft.total, 65);
    assert.strictEqual(session.pendingDraft.items[0].sizeId, 'MEDIANO');
    assert.strictEqual(session.pendingDraft.paymentMethod, 'EFECTIVO');
    assert.strictEqual(session.messagesHistory.length, 1);
  });

  it('2. Turno 2: Erradicación de Amnesia (VAL-003) — Context Recall desde PostgreSQL', async () => {
    const sessionId = 'val003-session-recall';

    // Sembrar estado inicial en la base de datos (Turno 1)
    const initialDraft = await constructDraftPayload(
      'tenant-m4',
      { items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO' }], paymentMethod: 'EFECTIVO' },
      '1 Spider-Man Vintage Comic mediano en efectivo'
    );
    await saveSessionState(sessionId, {
      pendingDraft: initialDraft,
      history: [
        { role: 'user', text: '1 Spider-Man mediano en efectivo' },
        { role: 'model', text: '¡Listo! Te monté el borrador en pantalla.' },
      ],
      sellerName: 'Vendedor Stand',
      eventId: 'event-m4',
      tenantId: 'tenant-m4',
    });

    // Simular Turno 2 donde el cliente envía payload vacío (amnesia del frontend / nueva pestaña)
    const req = {
      body: {
        sessionId,
        message: 'Cámbialo a grande y en tarjeta',
        history: [], // Vacío: debe hidratarse desde PostgreSQL
        pendingDraft: null, // Nulo: debe hidratarse desde PostgreSQL
        eventId: 'event-m4',
        sellerName: 'Vendedor Stand',
        stream: false,
      },
      tenantId: 'tenant-m4',
      user: { fullName: 'Vendedor Stand' },
      ip: '127.0.0.1',
    };
    const res = createMockResponse();

    // Espía en client.models.generateContent para verificar que el prompt del sistema contiene el borrador hidratado
    let capturedSystemInstruction = null;
    const client = getGeminiClient();
    const currentMockGen = client.models.generateContent;
    client.models.generateContent = async (params) => {
      capturedSystemInstruction = params?.config?.systemInstruction || null;
      return currentMockGen(params);
    };

    // Invocar genuinamente handleChatQuery
    await handleChatQuery(req, res);

    // Restaurar el espía
    client.models.generateContent = currentMockGen;

    // Verificar que la llamada al LLM recibió la instrucción del sistema hidratada desde PostgreSQL
    assert.ok(capturedSystemInstruction !== null, 'client.models.generateContent debió haber sido invocado');
    assert.ok(
      capturedSystemInstruction.includes('BORRADOR ACTIVO EN PANTALLA'),
      'systemInstruction debe contener "BORRADOR ACTIVO EN PANTALLA" demostrando hidratación desde PostgreSQL'
    );
    assert.ok(
      capturedSystemInstruction.includes('Spider-Man Vintage Comic'),
      'systemInstruction debe contener el ítem "Spider-Man Vintage Comic" hidratado desde PostgreSQL'
    );

    assert.strictEqual(res.statusCode, 200, 'El controlador debe responder 200 OK');
    assert.strictEqual(res.body.success, true, 'La respuesta debe indicar éxito');
    assert.strictEqual(res.body.sessionId, sessionId, 'Debe preservar el sessionId');
    assert.ok(res.body.draft !== null, 'Debe retornar el borrador actualizado');
    assert.strictEqual(res.body.draft.items[0].sizeId, 'GRANDE', 'Debe haber recordado el ítem y cambiado a GRANDE');
    assert.strictEqual(res.body.draft.total, 125, 'Total debe actualizarse a Q125.00');
    assert.strictEqual(res.body.draft.paymentMethod, 'TARJETA', 'Método debe ser TARJETA');

    // Verificar que la base de datos fue actualizada atómicamente con el estado resultante
    const sessionAfter = await getSessionState(sessionId, 'tenant-m4');
    assert.ok(sessionAfter !== null, 'La sesión debe existir en DB');
    assert.strictEqual(sessionAfter.pendingDraft.items[0].sizeId, 'GRANDE');
    assert.strictEqual(sessionAfter.pendingDraft.total, 125);
    assert.strictEqual(sessionAfter.pendingDraft.paymentMethod, 'TARJETA');
    assert.ok(sessionAfter.messagesHistory.length >= 3, 'El historial debe contener los turnos acumulados');
  });

  it('3. Descarte Atómico y Limpieza de Borrador en Base de Datos', async () => {
    const sessionId = 'val003-session-discard';

    // Crear sesión con borrador activo
    const draft = await constructDraftPayload(
      'tenant-m4',
      { items: [{ productName: 'Spider-Man Vintage Comic', quantity: 1, size: 'MEDIANO' }], paymentMethod: 'EFECTIVO' },
      '1 spiderman mediano'
    );
    await saveSessionState(sessionId, {
      pendingDraft: draft,
      history: [{ role: 'user', text: '1 spiderman' }],
      tenantId: 'tenant-m4',
    });

    let state = await getSessionState(sessionId, 'tenant-m4');
    assert.ok(state.pendingDraft !== null, 'El borrador debe existir inicialmente');

    // Ejecutar descarte atómico
    await clearSessionDraft(sessionId);

    state = await getSessionState(sessionId, 'tenant-m4');
    assert.strictEqual(state.pendingDraft, null, 'pendingDraft debe quedar en null en base de datos');
    assert.strictEqual(state.messagesHistory.length, 1, 'El historial de mensajes debe preservarse');

    // Probar endpoint HTTP de descarte
    const req = { params: { sessionId }, tenantId: 'tenant-m4' };
    const res = createMockResponse();
    await handleClearDraft(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.message.includes('descartado'));
  });

  it('4. Resiliencia ante F5 / Hidratación (GET /api/ai/session/:sessionId)', async () => {
    const sessionId = 'val003-session-f5';

    const draft = await constructDraftPayload(
      'tenant-m4',
      { items: [{ productName: 'Spider-Man Vintage Comic', quantity: 2, size: 'MEDIANO' }], paymentMethod: 'TRANSFERENCIA' },
      '2 spiderman mediano transferencia'
    );
    await saveSessionState(sessionId, {
      pendingDraft: draft,
      history: [{ role: 'user', text: '2 spiderman mediano transfer' }],
      sellerName: 'Cajero Principal',
      eventId: 'event-m4',
      tenantId: 'tenant-m4',
    });

    // Petición al endpoint de rehidratación
    const req = { params: { sessionId }, tenantId: 'tenant-m4' };
    const res = createMockResponse();
    await handleGetSession(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.session.sessionId, sessionId);
    assert.strictEqual(res.body.session.pendingDraft.total, 130);
    assert.strictEqual(res.body.session.pendingDraft.items[0].quantity, 2);
    assert.strictEqual(res.body.session.pendingDraft.paymentMethod, 'TRANSFERENCIA');

    // Sesión no encontrada
    const notFoundReq = { params: { sessionId: 'non-existent-session' }, tenantId: 'tenant-m4' };
    const notFoundRes = createMockResponse();
    await handleGetSession(notFoundReq, notFoundRes);
    assert.strictEqual(notFoundRes.statusCode, 404);
    assert.strictEqual(notFoundRes.body.success, false);
  });

  it('5. Compatibilidad Retroactiva y Fallback sin sessionId', async () => {
    // Si la petición no incluye sessionId, el controlador opera con UUID efímero sin error 500
    const req = {
      body: {
        message: 'Hola qué tal',
        eventId: 'event-m4',
        stream: false,
      },
      tenantId: 'tenant-m4',
      user: { fullName: 'Vendedor' },
      ip: '127.0.0.1',
    };
    const res = createMockResponse();

    // Validar que handleChatQuery responde HTTP 200 y genera sessionId efímero
    await handleChatQuery(req, res);
    assert.strictEqual(res.statusCode, 200, 'Debe responder HTTP 200 OK');
    assert.strictEqual(res.body.success, true, 'Debe retornar success: true');
    assert.ok(res.body.sessionId, 'Debe generar un sessionId efímero');
    assert.strictEqual(typeof res.body.sessionId, 'string');
    assert.ok(res.body.sessionId.length > 10, 'sessionId debe ser un UUID válido');

    // Verificar explícitamente que getOrCreateSession con sessionId nulo devuelve null limpiamente
    const nullSession = await getOrCreateSession(null);
    assert.strictEqual(nullSession, null, 'getOrCreateSession(null) debe retornar null de forma segura');
  });

  it('6. Mantenimiento y Purga de Sesiones Expiradas (TTL pruneExpiredSessions)', async () => {
    // Crear sesión vieja (hace 100 horas)
    const oldDate = new Date(Date.now() - 100 * 60 * 60 * 1000);
    const oldSession = await getOrCreateSession('session-expired', { tenantId: 'tenant-m4' });
    oldSession.updatedAt = oldDate;
    mockSessions.set('session-expired', oldSession);

    // Crear sesión reciente (hace 1 hora)
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const recentSession = await getOrCreateSession('session-fresh', { tenantId: 'tenant-m4' });
    recentSession.updatedAt = recentDate;
    mockSessions.set('session-fresh', recentSession);

    assert.strictEqual(mockSessions.size, 2, 'Deben existir 2 sesiones antes de la poda');

    // Ejecutar poda con TTL de 72 horas
    const prunedCount = await pruneExpiredSessions(72);
    assert.strictEqual(prunedCount, 1, 'Debe haber purgado exactamente 1 sesión');

    // Comprobar que la sesión vieja fue eliminada y la reciente sigue existiendo
    const remainingOld = await getSessionState('session-expired', 'tenant-m4');
    const remainingFresh = await getSessionState('session-fresh', 'tenant-m4');

    assert.strictEqual(remainingOld, null, 'La sesión expirada debe haber sido eliminada');
    assert.ok(remainingFresh !== null, 'La sesión reciente debe permanecer intacta');
  });
});
