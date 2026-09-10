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
            role: decoded.role,
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

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`,
      userRole: req.user.role,
    });
  };
}

export function requireEventAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const requestedEventId = req.params.eventId || req.body.eventId || req.query.eventId;

  if (req.user.role === 'VENDEDOR') {
    if (req.user.assignedEventId && requestedEventId && req.user.assignedEventId !== requestedEventId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder o registrar ventas en este evento.',
      });
    }
  }

  next();
}
