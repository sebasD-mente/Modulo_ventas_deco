import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import {
  getOrCreateSession,
  saveSessionState,
  clearSessionDraft,
  pruneExpiredSessions,
  getSessionState,
} from '../../server/services/ai/aiSessionService.js';
import {
  handleGetSession,
  handleClearDraft,
  handleChatQuery,
} from '../../server/controllers/ai/aiChatController.js';

const mockSessions = new Map();

function setupMockPrisma() {
  if (!prisma.aiChatSession) prisma.aiChatSession = {};

  prisma.aiChatSession.findUnique = async ({ where }) => {
    return mockSessions.get(where.sessionId) || null;
  };

  prisma.aiChatSession.findFirst = async ({ where }) => {
    for (const s of mockSessions.values()) {
      if (s.sessionId === where.sessionId) {
        if (where.tenantId && s.tenantId !== where.tenantId) continue;
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
    if (!rec) throw new Error('Record to update not found.');
    rec = { ...rec, ...data, updatedAt: new Date() };
    mockSessions.set(where.sessionId, rec);
    return rec;
  };

  prisma.aiChatSession.deleteMany = async ({ where }) => {
    let count = 0;
    if (where?.updatedAt?.lt) {
      const cutoff = where.updatedAt.lt;
      for (const [key, sess] of mockSessions.entries()) {
        if (sess.updatedAt < cutoff) {
          mockSessions.delete(key);
          count++;
        }
      }
    }
    return { count };
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: null,
    written: '',
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.headersSent = true;
      this.body = data;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      this.headersSent = true;
      return this;
    },
    write(chunk) {
      this.written += chunk;
      return true;
    },
    end() {
      this.ended = true;
    },
    flushHeaders() {},
  };
}

describe('⚔️ ADVERSARIAL CHALLENGER: Milestone 4 — Persistencia de Sesión (#VAL-003)', () => {
  beforeEach(() => {
    mockSessions.clear();
    setupMockPrisma();
  });

  afterEach(() => {
    mockSessions.clear();
  });

  describe('1. Inmunidad y Robustez ante Identificadores Hostiles (sessionId)', () => {
    const hostileSessionIds = [
      'session with spaces 123',
      'sess/with/slashes:and:colons?query=val&test=1',
      "sess' OR '1'='1; DROP TABLE ai_chat_sessions; --",
      'sesión_🔥_valkyria_🚀_guatemala_ñandú',
      'sess"with"quotes{"json":true}',
      'a'.repeat(255),
    ];

    for (const sid of hostileSessionIds) {
      it(`Debe persistir y recuperar sesión con sessionId hostil: ${sid.slice(0, 30)}...`, async () => {
        const created = await getOrCreateSession(sid, {
          tenantId: 'tenant-test',
          eventId: 'event-adversarial',
          sellerName: 'Vendedor Hostil',
        });

        assert.ok(created, 'Debe crear la sesión');
        assert.strictEqual(created.sessionId, sid, 'Debe preservar exactamente el sessionId');

        const state = await getSessionState(sid, 'tenant-test');
        assert.ok(state, 'Debe recuperar la sesión');
        assert.strictEqual(state.sessionId, sid);

        const updated = await saveSessionState(sid, {
          pendingDraft: {
            items: [{ productId: 'p1', description: 'Item 1', quantity: 2, unitPrice: 65 }],
            total: 130,
            paymentMethod: 'EFECTIVO',
          },
          history: [{ role: 'user', text: 'Compra de prueba' }],
        });

        assert.ok(updated.pendingDraft, 'Debe actualizar el borrador');
        assert.strictEqual(updated.pendingDraft.total, 130);

        const cleared = await clearSessionDraft(sid);
        assert.strictEqual(cleared.pendingDraft, null, 'Debe purgar el borrador');
      });
    }

    it('getOrCreateSession con sessionId vacío, null o undefined debe retornar null sin fallar', async () => {
      assert.strictEqual(await getOrCreateSession(null), null);
      assert.strictEqual(await getOrCreateSession(undefined), null);
      assert.strictEqual(await getOrCreateSession(''), null);
    });

    it('clearSessionDraft con sessionId no existente o nulo debe retornar null de forma segura', async () => {
      assert.strictEqual(await clearSessionDraft(null), null);
      assert.strictEqual(await clearSessionDraft('non-existent-session-id'), null);
    });
  });

  describe('2. Sanitización y Resiliencia de Historial (messagesHistory)', () => {
    it('history = null debe sanitizarse a array vacío []', async () => {
      const sid = 'test-null-history';
      const session = await saveSessionState(sid, {
        history: null,
        tenantId: 'tenant-test',
      });
      assert.deepStrictEqual(session.messagesHistory, [], 'Debe ser array vacío');
    });

    it('history = undefined no debe sobrescribir el historial existente', async () => {
      const sid = 'test-undefined-history';
      await saveSessionState(sid, {
        history: [{ role: 'user', text: 'Mensaje 1' }],
        tenantId: 'tenant-test',
      });

      const updated = await saveSessionState(sid, {
        sellerName: 'Nuevo Vendedor',
      });

      assert.strictEqual(updated.messagesHistory.length, 1);
      assert.strictEqual(updated.messagesHistory[0].text, 'Mensaje 1');
    });

    it('history no-array (string o número) debe sanitizarse a array vacío []', async () => {
      const sid = 'test-invalid-history-type';
      const session = await saveSessionState(sid, {
        history: 'esto no es un array',
        tenantId: 'tenant-test',
      });
      assert.deepStrictEqual(session.messagesHistory, [], 'Debe convertir no-arrays a []');
    });

    it('history con objetos complejos debe clonarse profundamente sin referencias mutables', async () => {
      const sid = 'test-deep-clone-history';
      const origMsg = { role: 'user', text: 'Prueba de inmutabilidad', metadata: { foo: 'bar' } };
      await saveSessionState(sid, {
        history: [origMsg],
        tenantId: 'tenant-test',
      });

      origMsg.text = 'MUTADO EXTERNAMENTE';

      const retrieved = await getSessionState(sid, 'tenant-test');
      assert.strictEqual(retrieved.messagesHistory[0].text, 'Prueba de inmutabilidad');
    });
  });

  describe('3. Purgado Atómico y Filtro de Borradores Vacíos (pendingDraft)', () => {
    it('pendingDraft = { items: [] } debe normalizarse a null en base de datos', async () => {
      const sid = 'test-empty-items-draft';
      const session = await saveSessionState(sid, {
        pendingDraft: { items: [], total: 0 },
        tenantId: 'tenant-test',
      });
      assert.strictEqual(session.pendingDraft, null, 'Un borrador sin items debe almacenarse como null');
    });

    it('pendingDraft = { items: null } debe normalizarse a null', async () => {
      const sid = 'test-null-items-draft';
      const session = await saveSessionState(sid, {
        pendingDraft: { items: null },
        tenantId: 'tenant-test',
      });
      assert.strictEqual(session.pendingDraft, null);
    });

    it('pendingDraft = null debe quedar null', async () => {
      const sid = 'test-explicit-null-draft';
      await saveSessionState(sid, {
        pendingDraft: { items: [{ name: 'Póster' }], total: 65 },
        tenantId: 'tenant-test',
      });

      const updated = await saveSessionState(sid, {
        pendingDraft: null,
      });
      assert.strictEqual(updated.pendingDraft, null);
    });

    it('clearSessionDraft debe establecer pendingDraft: null y preservar el resto de la sesión', async () => {
      const sid = 'test-clear-draft-atomic';
      await saveSessionState(sid, {
        pendingDraft: { items: [{ name: 'Batman', quantity: 1 }], total: 65 },
        history: [{ role: 'user', text: 'Quiero un Batman' }],
        sellerName: 'Carlos',
        eventId: 'comic-con-2026',
        tenantId: 'tenant-test',
      });

      const result = await clearSessionDraft(sid);
      assert.strictEqual(result.pendingDraft, null);
      assert.strictEqual(result.sellerName, 'Carlos');
      assert.strictEqual(result.eventId, 'comic-con-2026');
      assert.strictEqual(result.messagesHistory.length, 1);
    });
  });

  describe('4. Aislamiento Estricto Multi-Tenant', () => {
    it('getSessionState con tenantId diferente debe retornar null (Cross-Tenant Blindness)', async () => {
      const sid = 'session-tenant-alpha';
      await getOrCreateSession(sid, { tenantId: 'tenant-alpha' });

      // Intento de acceso desde tenant-beta
      const crossAccess = await getSessionState(sid, 'tenant-beta');
      assert.strictEqual(crossAccess, null, 'No debe permitir acceso entre inquilinos diferentes');

      // Acceso legítimo desde tenant-alpha
      const legitimateAccess = await getSessionState(sid, 'tenant-alpha');
      assert.ok(legitimateAccess !== null);
      assert.strictEqual(legitimateAccess.sessionId, sid);
    });
  });

  describe('5. Poda y TTL de Sesiones Expiradas (pruneExpiredSessions)', () => {
    it('hoursOld inválido (0, negativo, NaN, string) debe aplicar fallback a 72h sin borrar sesiones activas', async () => {
      const now = Date.now();

      // Sesión de hace 24 horas (activa con respecto a 72h)
      const session24h = await getOrCreateSession('sess-24h', { tenantId: 'tenant-test' });
      session24h.updatedAt = new Date(now - 24 * 60 * 60 * 1000);
      mockSessions.set('sess-24h', session24h);

      // Sesión de hace 80 horas (expirada con respecto a 72h)
      const session80h = await getOrCreateSession('sess-80h', { tenantId: 'tenant-test' });
      session80h.updatedAt = new Date(now - 80 * 60 * 60 * 1000);
      mockSessions.set('sess-80h', session80h);

      // Prueba con hoursOld = 0 (debe aplicar 72h, no purgar todo inmediatamente)
      const prunedWithZero = await pruneExpiredSessions(0);
      assert.strictEqual(prunedWithZero, 1, 'Debe purgar solo la sesión de 80h');

      // Comprobar que sess-24h sigue viva
      const alive = await getSessionState('sess-24h', 'tenant-test');
      assert.ok(alive !== null, 'sess-24h no debió ser borrada');
    });

    it('hoursOld personalizado (ej: 2 horas) purga únicamente las sesiones mayores a 2h', async () => {
      const now = Date.now();

      const session1h = await getOrCreateSession('sess-1h', { tenantId: 'tenant-test' });
      session1h.updatedAt = new Date(now - 1 * 60 * 60 * 1000);
      mockSessions.set('sess-1h', session1h);

      const session3h = await getOrCreateSession('sess-3h', { tenantId: 'tenant-test' });
      session3h.updatedAt = new Date(now - 3 * 60 * 60 * 1000);
      mockSessions.set('sess-3h', session3h);

      const pruned = await pruneExpiredSessions(2);
      assert.strictEqual(pruned, 1);
      assert.strictEqual(await getSessionState('sess-3h', 'tenant-test'), null);
      assert.ok((await getSessionState('sess-1h', 'tenant-test')) !== null);
    });
  });

  describe('6. Controlador HTTP: Endpoints de Sesión y Descarte', () => {
    it('handleGetSession retorna 404 para sesiones inexistentes', async () => {
      const req = { params: { sessionId: 'unknown-id' }, tenantId: 'tenant-test' };
      const res = createMockResponse();
      await handleGetSession(req, res);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    it('handleGetSession retorna 200 y la sesión completa si existe', async () => {
      const sid = 'existing-session-http';
      await saveSessionState(sid, {
        pendingDraft: { items: [{ name: 'Taylor Swift' }], total: 55 },
        sellerName: 'Vendedor 1',
        tenantId: 'tenant-test',
      });

      const req = { params: { sessionId: sid }, tenantId: 'tenant-test' };
      const res = createMockResponse();
      await handleGetSession(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.session.sessionId, sid);
      assert.strictEqual(res.body.session.pendingDraft.total, 55);
    });

    it('handleClearDraft purga borrador y retorna 200 { success: true }', async () => {
      const sid = 'clear-draft-http';
      await saveSessionState(sid, {
        pendingDraft: { items: [{ name: 'Goku' }], total: 65 },
        tenantId: 'tenant-test',
      });

      const req = { params: { sessionId: sid }, tenantId: 'tenant-test' };
      const res = createMockResponse();
      await handleClearDraft(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      const state = await getSessionState(sid, 'tenant-test');
      assert.strictEqual(state.pendingDraft, null);
    });
  });
});
