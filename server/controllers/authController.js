import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

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
      const decoded = jwt.decode(credential);
      if (!decoded || !decoded.email) {
        return res.status(401).json({ success: false, error: 'Token de Google inválido o malformado.' });
      }
      email = decoded.email.toLowerCase();
      fullName = decoded.name || email.split('@')[0];
      avatarUrl = decoded.picture;
      googleId = decoded.sub;
    } else {
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

    // 🛡️ REGLA ZERO-TRUST: Verificar si el correo pertenece estrictamente a SUPER_ADMIN_EMAILS
    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes(cleanEmail);

    let user;
    let tenantId = 'tenant-deco-vintage';

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
        email: cleanEmail,
      },
      include: {
        assignedEvent: {
          select: { id: true, name: true, location: true, status: true },
        },
      },
    });

    if (!user) {
      // Únicamente se auto-aprovisiona el Super Admin configurado explícitamente en el entorno
      if (isSuperAdminEmail) {
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: cleanEmail,
            fullName: fullName,
            role: 'SUPER_ADMIN',
            roles: ['SUPER_ADMIN'],
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
        console.log(`[Auth] 👑 Super Admin autorizado aprovisionado: ${cleanEmail}`);
      } else {
        // 🛑 BLOQUEO ESTRICTO ZERO-TRUST: Si el usuario no fue registrado previamente por el Administrador, se rechaza
        console.warn(`[Auth Warning 403] Intento de acceso bloqueado. Cuenta no autorizada: ${cleanEmail}`);
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: La cuenta de Google (${cleanEmail}) no está registrada ni autorizada en este sistema. Comunícate con el Administrador para que registre tu usuario.`,
        });
      }
    } else {
      // El usuario sí existe en la BD
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
          assignedEvent: {
            select: { id: true, name: true, location: true, status: true },
          },
        },
      });
    }

    if (user.status !== 'ACTIVO') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: Tu cuenta ha sido desactivada por el Administrador.',
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        assignedEvent: {
          select: { id: true, name: true, location: true, status: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

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
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: isSuperAdminEmail ? 'SUPER_ADMIN' : (user.role || userRoles[0]),
        roles: userRoles,
        avatarUrl: user.avatarUrl,
        assignedEventId: user.assignedEventId,
        assignedEvent: user.assignedEvent || null,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
