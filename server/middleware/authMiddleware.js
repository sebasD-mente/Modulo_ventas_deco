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
        // En entorno de desarrollo o prueba si la DB no está accesible
      }

      if (!user) {
        if (ENV.NODE_ENV !== 'production') {
          user = {
            id: decoded.id,
            email: decoded.email,
            fullName: decoded.fullName,
            role: decoded.role || (decoded.roles && decoded.roles[0]) || 'VENDEDOR',
            roles: decoded.roles || (decoded.role ? [decoded.role] : ['VENDEDOR']),
            tenantId: decoded.tenantId || 'tenant-deco-vintage',
            assignedEventId: decoded.assignedEventId,
            avatarUrl: decoded.avatarUrl,
            status: 'ACTIVO',
          };
        } else {
          return res.status(401).json({
            success: false,
            error: 'Usuario inactivo o no encontrado en el sistema.',
          });
        }
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

  // Fallback de desarrollo para pruebas locales si no hay token explícito
  if (ENV.NODE_ENV !== 'production') {
    const devRole = req.headers['x-dev-role'] || 'SUPER_ADMIN';
    const devUser = {
      id: 'dev-user-id',
      email: 'ia@dekolabs.org',
      fullName: 'Dev Admin (Deko Labs)',
      role: devRole,
      roles: devRole === 'SUPER_ADMIN' ? ['SUPER_ADMIN'] : [devRole],
      tenantId: 'tenant-deco-vintage',
      assignedEventId: null,
      avatarUrl: null,
      status: 'ACTIVO',
    };
    req.user = devUser;
    req.tenantId = 'tenant-deco-vintage';
    return next();
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
