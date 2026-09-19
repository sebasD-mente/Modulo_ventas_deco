import { prisma } from '../../config/prisma.js';

/**
 * Servicio de Persistencia y Rehidratación Atómica de Sesiones IA (STAND {IA}).
 * Erradica la fragilidad stateless en POST /api/ai/chat (Ticket Valkyria #VAL-003).
 */

export async function getOrCreateSession(sessionId, { tenantId = 'default-tenant', eventId = null, sellerName = null } = {}) {
  if (!sessionId) return null;
  try {
    return await prisma.aiChatSession.upsert({
      where: { sessionId },
      update: {
        ...(tenantId ? { tenantId } : {}),
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
  if (tenantId !== undefined) updateData.tenantId = tenantId;

  try {
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

export async function clearSessionDraft(sessionId) {
  if (!sessionId) return null;
  try {
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

export async function getSessionState(sessionId, tenantId = null) {
  if (!sessionId) return null;
  try {
    const where = { sessionId };
    if (tenantId) where.tenantId = tenantId;
    return await prisma.aiChatSession.findFirst({ where });
  } catch (err) {
    console.warn(`[aiSessionService] Error fetching state for session ${sessionId}:`, err?.message || err);
    return null;
  }
}
