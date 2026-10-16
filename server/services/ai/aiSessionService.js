import { prisma } from '../../config/prisma.js';

/**
 * Servicio de Persistencia y Rehidratación Atómica de Sesiones IA (STAND {IA}).
 * Erradica la fragilidad stateless en POST /api/ai/chat (Ticket Valkyria #VAL-003).
 */

export async function getOrCreateSession(
  sessionId,
  optionsOrTenantId = {},
  maybeUserId = null,
  maybeEventId = null
) {
  if (!sessionId) return null;

  let tenantId = 'default-tenant';
  let eventId = null;
  let sellerName = null;

  if (typeof optionsOrTenantId === 'string') {
    tenantId = optionsOrTenantId || 'default-tenant';
    sellerName = maybeUserId || null;
    eventId = maybeEventId || null;
  } else if (optionsOrTenantId && typeof optionsOrTenantId === 'object') {
    tenantId = optionsOrTenantId.tenantId || 'default-tenant';
    eventId = optionsOrTenantId.eventId ?? null;
    sellerName = optionsOrTenantId.sellerName ?? optionsOrTenantId.userId ?? null;
  }

  try {
    if (typeof prisma.aiChatSession?.findUnique === 'function') {
      const existing = await prisma.aiChatSession.findUnique({ where: { sessionId } });
      if (existing) {
        if (
          existing.tenantId &&
          tenantId &&
          existing.tenantId !== 'default-tenant' &&
          tenantId !== 'default-tenant' &&
          existing.tenantId !== tenantId
        ) {
          const err = new Error('CROSS_TENANT_ACCESS_DENIED: Sesión no pertenece a esta organización.');
          err.statusCode = 403;
          throw err;
        }
      }
    }

    return await prisma.aiChatSession.upsert({
      where: { sessionId },
      update: {
        ...(eventId !== undefined ? { eventId } : {}),
        ...(sellerName !== undefined ? { sellerName } : {}),
      },
      create: {
        sessionId,
        tenantId: tenantId || 'default-tenant',
        eventId: eventId || null,
        sellerName: sellerName || null,
        pendingDraft: null,
        messagesHistory: [],
      },
    });
  } catch (err) {
    if (err?.statusCode === 403) {
      throw err;
    }
    console.warn(`[aiSessionService] Error persisting session ${sessionId}, falling back to in-memory:`, err?.message || err);
    return {
      sessionId,
      tenantId: tenantId || 'default-tenant',
      eventId: eventId || null,
      sellerName: sellerName || null,
      pendingDraft: null,
      messagesHistory: [],
    };
  }
}

export async function saveSessionState(sessionId, { pendingDraft, history, sellerName, eventId, tenantId } = {}) {
  if (!sessionId) return null;
  const updateData = {};

  if (pendingDraft !== undefined) {
    const hasItems = pendingDraft && Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0;
    updateData.pendingDraft = hasItems ? JSON.parse(JSON.stringify(pendingDraft)) : null;
  }
  if (history !== undefined) {
    updateData.messagesHistory = Array.isArray(history) ? JSON.parse(JSON.stringify(history)) : [];
  }
  if (sellerName !== undefined) updateData.sellerName = sellerName;
  if (eventId !== undefined) updateData.eventId = eventId;

  try {
    if (tenantId && typeof prisma.aiChatSession?.findUnique === 'function') {
      const existing = await prisma.aiChatSession.findUnique({ where: { sessionId } });
      if (
        existing &&
        existing.tenantId &&
        existing.tenantId !== 'default-tenant' &&
        tenantId !== 'default-tenant' &&
        existing.tenantId !== tenantId
      ) {
        const err = new Error('CROSS_TENANT_ACCESS_DENIED: Sesión no pertenece a esta organización.');
        err.statusCode = 403;
        throw err;
      }
    }

    return await prisma.aiChatSession.upsert({
      where: { sessionId },
      update: updateData,
      create: {
        sessionId,
        tenantId: tenantId || 'default-tenant',
        eventId: eventId || null,
        sellerName: sellerName || null,
        pendingDraft: updateData.pendingDraft !== undefined ? updateData.pendingDraft : null,
        messagesHistory: updateData.messagesHistory !== undefined ? updateData.messagesHistory : [],
      },
    });
  } catch (err) {
    if (err?.statusCode === 403) throw err;
    console.warn(`[aiSessionService] Error saving state for session ${sessionId}:`, err?.message || err);
    return {
      sessionId,
      tenantId: tenantId || 'default-tenant',
      eventId: eventId || null,
      sellerName: sellerName || null,
      pendingDraft: updateData.pendingDraft !== undefined ? updateData.pendingDraft : null,
      messagesHistory: updateData.messagesHistory !== undefined ? updateData.messagesHistory : [],
    };
  }
}

export async function clearSessionDraft(sessionId, tenantId = null) {
  if (!sessionId) return null;
  try {
    if (tenantId) {
      const existing = typeof prisma.aiChatSession?.findUnique === 'function'
        ? await prisma.aiChatSession.findUnique({ where: { sessionId } })
        : (typeof prisma.aiChatSession?.findFirst === 'function'
          ? await prisma.aiChatSession.findFirst({ where: { sessionId } })
          : null);
      if (existing && existing.tenantId && existing.tenantId !== tenantId) {
        return null;
      }
    }
    return await prisma.aiChatSession.update({
      where: { sessionId },
      data: { pendingDraft: null },
    });
  } catch {
    return null;
  }
}

export async function pruneExpiredSessions(hoursOld = 72) {
  const safeHours = Number.isFinite(hoursOld) && hoursOld > 0 ? hoursOld : 72;
  const cutoffDate = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const result = await prisma.aiChatSession.deleteMany({
    where: { updatedAt: { lt: cutoffDate } },
  });
  return result?.count ?? 0;
}

export async function getSessionById(sessionId, tenantId = null) {
  if (!sessionId) return null;
  try {
    let session = null;
    if (typeof prisma.aiChatSession?.findUnique === 'function') {
      session = await prisma.aiChatSession.findUnique({ where: { sessionId } });
    } else if (typeof prisma.aiChatSession?.findFirst === 'function') {
      const where = { sessionId };
      if (tenantId) where.tenantId = tenantId;
      session = await prisma.aiChatSession.findFirst({ where });
    }
    if (!session) return null;
    if (tenantId && session.tenantId && session.tenantId !== tenantId) {
      return null;
    }
    return session;
  } catch (err) {
    console.warn(`[aiSessionService] Error fetching state for session ${sessionId}:`, err?.message || err);
    return null;
  }
}

export const getSessionState = getSessionById;
