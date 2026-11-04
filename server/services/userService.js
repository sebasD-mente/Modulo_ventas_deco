import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import {
  resolveTargetRoles,
  syncEventAssignedSellersMetadata,
} from './userEventAssignmentService.js';

const ASSIGNED_EVENT_SELECT = {
  id: true,
  name: true,
  location: true,
  status: true,
};

function createUserError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isProtectedSuperAdminEmail(email) {
  return ENV.SUPER_ADMIN_EMAILS.includes((email || '').toLowerCase().trim());
}

export async function listTenantUsers(tenantId) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    include: { assignedEvent: { select: ASSIGNED_EVENT_SELECT } },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => {
    const uRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'VENDEDOR'];
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role || uRoles[0],
      roles: uRoles,
      avatarUrl: u.avatarUrl,
      status: u.status,
      assignedEventId: u.assignedEventId,
      assignedEvent: u.assignedEvent,
      createdAt: u.createdAt,
    };
  });
}

export async function updateTenantUserRoles({ where, roles, role }) {
  const existing = await prisma.user.findFirst({ where });
  if (!existing) {
    throw createUserError('Usuario no encontrado en esta organización.', 404);
  }

  const targetRoles = resolveTargetRoles(roles, role);
  if (targetRoles.length === 0) {
    throw createUserError(
      'Debe especificar al menos un rol válido (SUPER_ADMIN, VENDEDOR, VENDEDOR_REDES, OPERARIO_1, OPERARIO_2).',
      400
    );
  }

  const updated = await prisma.user.update({
    where: { id: where.id },
    data: { role: targetRoles[0], roles: targetRoles },
    include: { assignedEvent: true },
  });

  return { updated, targetRoles };
}

export async function toggleTenantUserStatus({ where }) {
  const user = await prisma.user.findFirst({ where });
  if (!user) {
    throw createUserError('Usuario no encontrado en esta organización.', 404);
  }

  if (isProtectedSuperAdminEmail(user.email) && user.status === 'ACTIVO') {
    throw createUserError(
      'No se puede desactivar a un Super Administrador definido en las variables de entorno.',
      400
    );
  }

  const newStatus = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  const updated = await prisma.user.update({
    where: { id: where.id },
    data: { status: newStatus },
  });

  if (user.assignedEventId) {
    await syncEventAssignedSellersMetadata(user.assignedEventId, where.tenantId);
  }

  return { updated, newStatus };
}

export async function createTenantUser({ tenantId, email, fullName, roles, role, assignedEventId }) {
  if (!email || !email.includes('@')) {
    throw createUserError('Debe proporcionar un correo electrónico válido de Google.', 400);
  }
  if (!fullName || fullName.trim().length === 0) {
    throw createUserError('Debe proporcionar el nombre completo del empleado.', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const targetRoles = resolveTargetRoles(roles, role, ['VENDEDOR']);
  const existing = await prisma.user.findFirst({
    where: { tenantId, email: normalizedEmail },
  });
  if (existing) {
    throw createUserError(`Ya existe un usuario registrado con el correo ${normalizedEmail}.`, 400);
  }

  const newUser = await prisma.user.create({
    data: {
      tenantId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: targetRoles[0],
      roles: targetRoles,
      assignedEventId: assignedEventId || null,
      status: 'ACTIVO',
    },
    include: { assignedEvent: { select: ASSIGNED_EVENT_SELECT } },
  });

  if (assignedEventId) {
    await syncEventAssignedSellersMetadata(assignedEventId, tenantId);
  }

  return { newUser, targetRoles };
}

export async function deleteTenantUser({ where, requestingUserId }) {
  if (requestingUserId && requestingUserId === where.id) {
    throw createUserError('No puedes eliminar tu propia cuenta de Super Administrador en sesión.', 400);
  }

  const targetUser = await prisma.user.findFirst({ where });
  if (!targetUser) {
    throw createUserError('Usuario no encontrado en esta organización.', 404);
  }

  if (isProtectedSuperAdminEmail(targetUser.email)) {
    throw createUserError(
      'No se puede eliminar a un Super Administrador maestro configurado en las variables de entorno.',
      400
    );
  }

  await prisma.user.delete({ where: { id: where.id } });
  if (targetUser.assignedEventId) {
    await syncEventAssignedSellersMetadata(targetUser.assignedEventId, where.tenantId);
  }
}
