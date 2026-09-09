import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      req.user = decoded;
      req.tenantId = decoded.tenantId;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Token de autenticación expirado o inválido.' });
    }
  }

  // Fallback para terminal de stand si no hay token Bearer explícito
  try {
    const defaultUser = await prisma.user.findFirst({
      where: { role: 'ENCARGADO_STAND' },
      include: { tenant: true },
    });

    if (defaultUser) {
      req.user = {
        id: defaultUser.id,
        email: defaultUser.email,
        fullName: defaultUser.fullName,
        role: defaultUser.role,
        tenantId: defaultUser.tenantId,
      };
      req.tenantId = defaultUser.tenantId;
      return next();
    }
  } catch (err) {
    console.warn('[AuthMiddleware Warning] ⚠️ Error obteniendo usuario de stand por defecto:', err.message);
  }

  return res.status(401).json({ success: false, error: 'No autorizado. Se requiere inicio de sesión.' });
}
