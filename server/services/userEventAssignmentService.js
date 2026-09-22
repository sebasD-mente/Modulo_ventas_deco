import { prisma } from '../config/prisma.js';

export const VALID_ROLES = ['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES', 'OPERARIO_1', 'OPERARIO_2'];

export function resolveTargetRoles(roles, role, fallback = null) {
  let targetRoles = [];
  if (Array.isArray(roles) && roles.length > 0) {
    targetRoles = roles.filter((r) => VALID_ROLES.includes(r));
  } else if (role && VALID_ROLES.includes(role)) {
    targetRoles = [role];
  } else if (fallback) {
    targetRoles = Array.isArray(fallback) ? fallback : [fallback];
  }
  if (targetRoles.length === 0 && fallback) {
    targetRoles = Array.isArray(fallback) ? fallback : [fallback];
  }
  return targetRoles;
}

export async function assignUserToEventService({ userId, eventId, tenantId }) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });
  if (!existing) {
    const err = new Error('Usuario no encontrado en esta organización.');
    err.statusCode = 404;
    throw err;
  }

  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      const err = new Error('Evento no encontrado en esta organización.');
      err.statusCode = 404;
      throw err;
    }
  }

  return await prisma.user.update({
    where: { id: userId },
    data: { assignedEventId: eventId || null },
    include: { assignedEvent: true },
  });
}
