import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { demoUsers } from './userController.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export function getAuthConfig(req, res) {
  const clientId = ENV.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  return res.status(200).json({
    success: true,
    googleClientId: clientId,
  });
}

export async function handleGoogleLogin(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere autenticación obligatoria con Google. No se proporcionó un token de identidad válido.',
      });
    }

    let email;
    let fullName;
    let avatarUrl;
    let googleId;

    if (!ENV.GOOGLE_CLIENT_ID) {
      // Si aún no se ha configurado el Client ID en el servidor, decodificar el token pero rechazar si no es válido
      const decoded = jwt.decode(credential);
      if (!decoded || !decoded.email) {
        return res.status(401).json({ success: false, error: 'Token de Google inválido o malformado.' });
      }
      email = decoded.email.toLowerCase();
      fullName = decoded.name || email.split('@')[0];
      avatarUrl = decoded.picture;
      googleId = decoded.sub;
    } else {
      // Verificación criptográfica estricta con los certificados públicos de Google
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: ENV.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(401).json({ success: false, error: 'La verificación criptográfica con Google ha fallado.' });
      }
      email = payload.email.toLowerCase();
      fullName = payload.name || email.split('@')[0];
      avatarUrl = payload.picture;
      googleId = payload.sub;
    }

    // Determinar rol inicial para nuevos usuarios
    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.some((adm) => email === adm || email.includes(adm));
    let targetRole = isSuperAdminEmail ? 'SUPER_ADMIN' : 'VENDEDOR';

    if (email.includes('operario1') || email.includes('stock')) {
      targetRole = 'OPERARIO_1';
    } else if (email.includes('operario2') || email.includes('taller') || email.includes('impresion')) {
      targetRole = 'OPERARIO_2';
    } else if (email.includes('admin') || isSuperAdminEmail) {
      targetRole = 'SUPER_ADMIN';
    }

    let user;
    let tenantId = 'tenant-deco-vintage';

    try {
      let tenant = await prisma.tenant.findFirst({
        where: { slug: 'deco-vintage-guate' },
      });

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
      tenantId = tenant.id;

      user = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: email,
        },
        include: {
          assignedEvent: {
            select: { id: true, name: true, location: true, status: true },
          },
        },
      });

      if (!user) {
        const totalUsers = await prisma.user.count({ where: { tenantId: tenant.id } });
        if (totalUsers === 0) {
          targetRole = 'SUPER_ADMIN';
        }

        const initialRoles = targetRole === 'SUPER_ADMIN' ? ['SUPER_ADMIN'] : [targetRole];

        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: email,
            fullName: fullName,
            role: targetRole,
            roles: initialRoles,
            googleId: googleId,
            avatarUrl: avatarUrl,
            status: 'ACTIVO',
          },
          include: {
            assignedEvent: {
              select: { id: true, name: true, location: true, status: true },
            },
          },
        });

        console.log(`[Auth] ✨ Nuevo usuario registrado: ${email} con roles: [${user.roles.join(', ')}]`);
      } else {
        const currentRoles = Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : [user.role || 'VENDEDOR'];

        const updateData = {
          fullName: fullName,
          avatarUrl: avatarUrl || user.avatarUrl,
          googleId: googleId || user.googleId,
        };

        if (isSuperAdminEmail && !currentRoles.includes('SUPER_ADMIN')) {
          updateData.roles = ['SUPER_ADMIN', ...currentRoles.filter(r => r !== 'SUPER_ADMIN')];
          updateData.role = 'SUPER_ADMIN';
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: {
            assignedEvent: {
              select: { id: true, name: true, location: true, status: true },
            },
          },
        });
      }
    } catch (dbErr) {
      console.warn('[Auth Warning] Base de datos no accesible. Usando sesión segura en memoria:', dbErr.message);
      const matchedDemo = demoUsers.find((u) => u.email === email);
      if (matchedDemo) {
        user = { ...matchedDemo };
      } else {
        const fallbackRoles = targetRole === 'SUPER_ADMIN' ? ['SUPER_ADMIN'] : [targetRole];
        user = {
          id: 'user-' + email.replace(/[^a-z0-9]/g, '-'),
          email: email,
          fullName: fullName,
          role: targetRole,
          roles: fallbackRoles,
          avatarUrl: avatarUrl,
          assignedEventId: 'event-demo-1',
          assignedEvent: {
            id: 'event-demo-1',
            name: 'Feria Vintage Plaza Fontabella 2026',
            location: 'Plaza Fontabella, Zona 10',
            status: 'ACTIVO',
          },
          tenantId: tenantId,
          status: 'ACTIVO',
        };
      }
    }

    if (user.status !== 'ACTIVO') {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta ha sido desactivada. Consulta con el Administrador.',
      });
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

    return res.status(200).json({
      success: true,
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
    });
  } catch (error) {
    console.error('[Auth Error] Fallo al procesar autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al autenticar usuario.',
      details: error.message,
    });
  }
}

export async function getMe(req, res) {
  try {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          assignedEvent: {
            select: { id: true, name: true, location: true, status: true },
          },
        },
      });
    } catch (e) {
      // Fallback
    }

    if (!user) {
      user = req.user;
    }

    const userRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : [user.role || 'VENDEDOR'];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role || userRoles[0],
        roles: userRoles,
        avatarUrl: user.avatarUrl,
        assignedEventId: user.assignedEventId,
        assignedEvent: user.assignedEvent || {
          id: 'event-demo-1',
          name: 'Feria Vintage Plaza Fontabella 2026',
          location: 'Plaza Fontabella, Zona 10',
          status: 'ACTIVO',
        },
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
