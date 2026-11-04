import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);
export const authEnv = Object.freeze({ get GOOGLE_CLIENT_ID() { return ENV.GOOGLE_CLIENT_ID; } });
const ASSIGNED_EVENT_SELECT = { id: true, name: true, location: true, status: true };

function createAuthError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function getPublicGoogleClientId() {
  return ENV.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
}

export async function authenticateGooglePayload(payload) {
  const email = payload.email.toLowerCase();
  const fullName = payload.name || email.split('@')[0];
  const avatarUrl = payload.picture;
  const googleId = payload.sub;
  const cleanEmail = email.toLowerCase().trim();
  const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes(cleanEmail);

  let tenant = await prisma.tenant.findFirst({ where: { slug: 'deco-vintage-guate' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: ENV.DEFAULT_TENANT_NAME,
        slug: 'deco-vintage-guate',
        currency: ENV.DEFAULT_CURRENCY,
        currencySymbol: ENV.DEFAULT_CURRENCY_SYMBOL,
      },
    });
  }

  let user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: cleanEmail },
    include: { assignedEvent: { select: ASSIGNED_EVENT_SELECT } },
  });

  if (!user) {
    if (!isSuperAdminEmail) {
      console.warn(`[Auth Warning 403] Intento de acceso bloqueado. Cuenta no autorizada: ${cleanEmail}`);
      throw createAuthError(
        `Acceso denegado: La cuenta de Google (${cleanEmail}) no está registrada ni autorizada en este sistema. Comunícate con el Administrador para que registre tu usuario.`,
        403
      );
    }

    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: cleanEmail,
        fullName,
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        googleId,
        avatarUrl,
        status: 'ACTIVO',
      },
      include: {
        assignedEvent: { select: ASSIGNED_EVENT_SELECT },
      },
    });
    console.log(`[Auth] 👑 Super Admin autorizado aprovisionado: ${cleanEmail}`);
  } else {
    const currentRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : [user.role || 'VENDEDOR'];

    const updateData = {
      fullName: fullName || user.fullName,
      avatarUrl: avatarUrl || user.avatarUrl,
      googleId: googleId || user.googleId,
    };

    if (isSuperAdminEmail && !currentRoles.includes('SUPER_ADMIN')) {
      updateData.roles = ['SUPER_ADMIN', ...currentRoles.filter((r) => r !== 'SUPER_ADMIN')];
      updateData.role = 'SUPER_ADMIN';
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: {
        assignedEvent: { select: ASSIGNED_EVENT_SELECT },
      },
    });
  }

  if (user.status !== 'ACTIVO') {
    throw createAuthError('Acceso denegado: Tu cuenta ha sido desactivada por el Administrador.', 403);
  }

  const userRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : [user.role || 'VENDEDOR'];

  const tokenPayload = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role || userRoles[0],
    roles: userRoles,
    tenantId: user.tenantId,
    assignedEventId: user.assignedEventId,
    avatarUrl: user.avatarUrl,
  };

  const sessionToken = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });

  return {
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role || userRoles[0],
      roles: userRoles,
      avatarUrl: user.avatarUrl,
      assignedEventId: user.assignedEventId,
      assignedEvent: user.assignedEvent,
      tenantId: user.tenantId,
    },
  };
}

export async function resolveAuthenticatedUser(sessionUser) {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        assignedEvent: { select: ASSIGNED_EVENT_SELECT },
      },
    });
  } catch {
    if (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') {
      user = sessionUser;
    }
  }

  if (!user && (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') && sessionUser) {
    user = sessionUser;
  }
  if (!user) return null;

  let userRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? [...user.roles]
    : [user.role || 'VENDEDOR'];

  const userEmail = (user.email || '').toLowerCase().trim();
  const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes(userEmail);

  if (isSuperAdminEmail && !userRoles.includes('SUPER_ADMIN')) {
    userRoles = ['SUPER_ADMIN', ...userRoles.filter((r) => r !== 'SUPER_ADMIN')];
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN', roles: userRoles },
      });
    } catch {}
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: isSuperAdminEmail ? 'SUPER_ADMIN' : (user.role || userRoles[0]),
    roles: userRoles,
    avatarUrl: user.avatarUrl,
    assignedEventId: user.assignedEventId,
    assignedEvent: user.assignedEvent || null,
    tenantId: user.tenantId,
  };
}
