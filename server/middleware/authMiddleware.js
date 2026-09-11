import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      
      let user;
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            roles: true,
            tenantId: true,
            assignedEventId: true,
            avatarUrl: true,
            status: true,
          },
        });
      } catch (dbErr) {
        if (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') {
          user = {
            id: decoded.id,
            email: decoded.email,
            fullName: decoded.fullName || 'Administrador Stand',
            role: decoded.role || 'SUPER_ADMIN',
            roles: decoded.roles || ['SUPER_ADMIN'],
            tenantId: decoded.tenantId || ENV.DEFAULT_TENANT_NAME,
            assignedEventId: decoded.assignedEventId || null,
            avatarUrl: decoded.avatarUrl || null,
            status: 'ACTIVO',
          };
        }
      }

      if (!user && (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') && decoded?.id) {
        user = {
          id: decoded.id,
          email: decoded.email,
          fullName: decoded.fullName || 'Administrador Stand',
          role: decoded.role || 'SUPER_ADMIN',
          roles: decoded.roles || ['SUPER_ADMIN'],
          tenantId: decoded.tenantId || ENV.DEFAULT_TENANT_NAME,
          assignedEventId: decoded.assignedEventId || null,
          avatarUrl: decoded.avatarUrl || null,
          status: 'ACTIVO',
        };
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario inactivo o no encontrado en el sistema.',
        });
      }

      // Normalizar roles
      if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
        user.roles = user.role ? [user.role] : ['VENDEDOR'];
      }

      const userEmail = (user.email || '').toLowerCase().trim();
      const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes(userEmail);
      if (isSuperAdminEmail && !user.roles.includes('SUPER_ADMIN')) {
        user.roles = ['SUPER_ADMIN', ...user.roles.filter(r => r !== 'SUPER_ADMIN')];
        user.role = 'SUPER_ADMIN';
      }

      if (user.status !== 'ACTIVO') {
        return res.status(401).json({
          success: false,
          error: 'Usuario desactivado por el administrador.',
        });
      }

      req.user = user;
      req.tenantId = user.tenantId;
      return next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Token de sesión expirado o inválido.',
      });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'No autorizado. Se requiere inicio de sesión con Google.',
  });
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role || 'VENDEDOR'];

    if (userRoles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasPermission = allowedRoles.some((r) => userRoles.includes(r));
    if (hasPermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`,
      userRoles: userRoles,
    });
  };
}

export function requireEventAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
    ? req.user.roles
    : [req.user.role || 'VENDEDOR'];

  if (userRoles.includes('SUPER_ADMIN')) {
    return next();
  }

  const requestedEventId = req.params.eventId || req.body.eventId || req.query.eventId;

  if (userRoles.includes('VENDEDOR')) {
    if (req.user.assignedEventId && requestedEventId && req.user.assignedEventId !== requestedEventId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder o registrar ventas en este evento.',
      });
    }
  }

  next();
}
