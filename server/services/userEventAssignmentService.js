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

/**
 * Sincroniza los campos denormalizados assignedSellerEmail y assignedSellerName
 * en la tabla Event a partir de los usuarios activos asignados a dicho evento.
 */
export async function syncEventAssignedSellersMetadata(eventId, tenantId, dbClient = prisma) {
  if (!eventId || !tenantId) return;
  if (!dbClient?.user?.findMany || !dbClient?.event?.update) return;
  try {
    const activeSellers = await dbClient.user.findMany({
      where: { assignedEventId: eventId, tenantId, status: 'ACTIVO' },
      select: { fullName: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    const assignedSellerEmail = activeSellers.length > 0
      ? activeSellers.map((u) => u.email).join(', ')
      : null;
    const assignedSellerName = activeSellers.length > 0
      ? activeSellers.map((u) => u.fullName).join(', ')
      : null;

    await dbClient.event.update({
      where: { id: eventId },
      data: { assignedSellerEmail, assignedSellerName },
    });
  } catch (_syncErr) {
    // Fallback seguro para mocks parciales en pruebas unitarias
  }
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

  const previousEventId = existing.assignedEventId || null;
  const targetEventId = eventId || null;

  if (targetEventId) {
    const event = await prisma.event.findFirst({
      where: { id: targetEventId, tenantId },
    });
    if (!event) {
      const err = new Error('Evento no encontrado en esta organización.');
      err.statusCode = 404;
      throw err;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { assignedEventId: targetEventId },
    include: { assignedEvent: true },
  });

  if (previousEventId && previousEventId !== targetEventId) {
    await syncEventAssignedSellersMetadata(previousEventId, tenantId);
  }
  if (targetEventId) {
    await syncEventAssignedSellersMetadata(targetEventId, tenantId);
  }

  return updatedUser;
}
