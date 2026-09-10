import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export async function handleGoogleLogin(req, res) {
  try {
    const { credential, devRole } = req.body;

    let email;
    let fullName;
    let avatarUrl;
    let googleId;

    if (credential) {
      if (!ENV.GOOGLE_CLIENT_ID) {
        const decoded = jwt.decode(credential);
        if (!decoded || !decoded.email) {
          return res.status(400).json({ success: false, error: 'Token de Google inválido' });
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
          return res.status(400).json({ success: false, error: 'Credenciales de Google no válidas' });
        }
        email = payload.email.toLowerCase();
        fullName = payload.name || email.split('@')[0];
        avatarUrl = payload.picture;
        googleId = payload.sub;
      }
    } else if (ENV.NODE_ENV !== 'production' && req.body.email) {
      email = req.body.email.toLowerCase();
      fullName = req.body.fullName || (email.startsWith('ia@') ? 'Admin Deko Labs' : 'Usuario Stand');
      avatarUrl = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
      googleId = 'google-dev-' + email;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el token de credencial de Google para iniciar sesión.',
      });
    }

    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes(email);
    let targetRole = isSuperAdminEmail ? 'SUPER_ADMIN' : 'VENDEDOR';
    if (devRole && ENV.NODE_ENV !== 'production') {
      targetRole = devRole;
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

        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: email,
            fullName: fullName,
            role: targetRole,
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

        console.log(`[Auth] ✨ Nuevo usuario registrado: ${email} con rol: ${user.role}`);
      } else {
        const updateData = {
          fullName: fullName,
          avatarUrl: avatarUrl || user.avatarUrl,
          googleId: googleId || user.googleId,
        };

        if (isSuperAdminEmail && user.role !== 'SUPER_ADMIN') {
          updateData.role = 'SUPER_ADMIN';
        } else if (devRole && ENV.NODE_ENV !== 'production') {
          updateData.role = devRole;
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
      console.warn('[Auth Warning] Base de datos no accesible en desarrollo. Usando sesión en memoria:', dbErr.message);
      user = {
        id: 'user-' + email.replace(/[^a-z0-9]/g, '-'),
        email: email,
        fullName: fullName,
        role: targetRole,
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

    if (user.status !== 'ACTIVO') {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta ha sido desactivada. Consulta con el Administrador.',
      });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
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
        role: user.role,
        avatarUrl: user.avatarUrl,
        assignedEventId: user.assignedEventId,
        assignedEvent: user.assignedEvent,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error('[Auth Error] Fallo al procesar autenticación de Google:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno en el servidor de autenticación.',
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
      // Fallback a req.user si DB está en desarrollo
    }

    if (!user) {
      user = req.user;
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
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
