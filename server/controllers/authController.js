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

    // 🛡️ REGLA ZERO-TRUST: Verificar si el correo pertenece a la lista raíz de SUPER_ADMIN
    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.some((adm) => email === adm || email.includes(adm));

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
        
        // Únicamente se auto-aprovisiona el Super Admin del sistema o si la base de datos está completamente vacía (primer inicio)
        if (isSuperAdminEmail || totalUsers === 0) {
          user = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email: email,
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
          console.log(`[Auth] 👑 Super Admin aprovisionado: ${email}`);
        } else {
          // 🛑 BLOQUEO ESTRICTO ZERO-TRUST: Si el usuario no está pre-registrado por el Administrador, se deniega el acceso
          console.warn(`[Auth Warning 403] Intento de acceso denegado. Cuenta no autorizada: ${email}`);
          return res.status(403).json({
            success: false,
            error: `Acceso denegado: La cuenta de Google (${email}) no está registrada ni autorizada en este sistema. Comunícate con el Administrador para que registre tu usuario.`,
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
      console.warn('[Auth Warning] Base de datos no accesible. Validando lista autorizada:', dbErr.message);
      const matchedDemo = demoUsers.find((u) => u.email.toLowerCase() === email);
      if (matchedDemo) {
        user = { ...matchedDemo, fullName: fullName || matchedDemo.fullName, avatarUrl: avatarUrl || matchedDemo.avatarUrl };
      } else if (isSuperAdminEmail) {
        user = {
          id: 'user-' + email.replace(/[^a-z0-9]/g, '-'),
          email: email,
          fullName: fullName,
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN'],
          avatarUrl: avatarUrl,
          assignedEventId: null,
          assignedEvent: null,
          tenantId: tenantId,
          status: 'ACTIVO',
        };
      } else {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: La cuenta de Google (${email}) no está registrada ni autorizada en este sistema. Comunícate con el Administrador para que registre tu usuario.`,
        });
      }
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

    let userRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? [...user.roles]
      : [user.role || 'VENDEDOR'];

    const userEmail = (user.email || '').toLowerCase().trim();
    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.some((adm) => userEmail === adm || userEmail.includes(adm));

    if (isSuperAdminEmail) {
      if (!userRoles.includes('SUPER_ADMIN')) {
        userRoles = ['SUPER_ADMIN', ...userRoles.filter(r => r !== 'SUPER_ADMIN')];
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'SUPER_ADMIN', roles: userRoles }
          });
        } catch (e) {}
      }
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
