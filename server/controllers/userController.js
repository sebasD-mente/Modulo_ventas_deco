import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

export async function getUsersList(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      include: {
        assignedEvent: {
          select: { id: true, name: true, location: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: users.map((u) => {
        const uRoles = Array.isArray(u.roles) && u.roles.length > 0
          ? u.roles
          : [u.role || 'VENDEDOR'];

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
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role, roles } = req.body;

    const validRoles = ['SUPER_ADMIN', 'VENDEDOR', 'OPERARIO_1', 'OPERARIO_2'];
    let targetRoles = [];

    if (Array.isArray(roles) && roles.length > 0) {
      targetRoles = roles.filter((r) => validRoles.includes(r));
    } else if (role && validRoles.includes(role)) {
      targetRoles = [role];
    }

    if (targetRoles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe especificar al menos un rol válido (SUPER_ADMIN, VENDEDOR, OPERARIO_1, OPERARIO_2).',
      });
    }

    const primaryRole = targetRoles[0];

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: primaryRole,
        roles: targetRoles,
      },
      include: { assignedEvent: true },
    });

    return res.status(200).json({
      success: true,
      message: `Roles de ${updated.fullName} actualizados a [${targetRoles.join(', ')}]`,
      data: {
        ...updated,
        roles: updated.roles || targetRoles,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function assignUserToEvent(req, res) {
  try {
    const { id } = req.params;
    const { eventId } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: { assignedEventId: eventId || null },
      include: { assignedEvent: true },
    });

    return res.status(200).json({
      success: true,
      message: `Vendedor asignado al evento ${updated.assignedEvent?.name || 'Ninguno'}`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Proteger que un Super Admin del entorno no pueda ser desactivado por error
    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase().trim());
    if (isSuperAdminEmail && user.status === 'ACTIVO') {
      return res.status(400).json({
        success: false,
        error: 'No se puede desactivar a un Super Administrador definido en las variables de entorno.',
      });
    }

    const newStatus = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const updated = await prisma.user.update({
      where: { id },
      data: { status: newStatus },
    });

    return res.status(200).json({
      success: true,
      message: `Usuario ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente.`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const { email, fullName, roles, role, assignedEventId } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un correo electrónico válido de Google.',
      });
    }

    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar el nombre completo del empleado.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const validRoles = ['SUPER_ADMIN', 'VENDEDOR', 'OPERARIO_1', 'OPERARIO_2'];
    let targetRoles = [];

    if (Array.isArray(roles) && roles.length > 0) {
      targetRoles = roles.filter((r) => validRoles.includes(r));
    } else if (role && validRoles.includes(role)) {
      targetRoles = [role];
    } else {
      targetRoles = ['VENDEDOR'];
    }

    if (targetRoles.length === 0) {
      targetRoles = ['VENDEDOR'];
    }

    const primaryRole = targetRoles[0];

    const existing = await prisma.user.findFirst({
      where: {
        tenantId: req.tenantId || 'tenant-deco-vintage',
        email: normalizedEmail,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Ya existe un usuario registrado con el correo ${normalizedEmail}.`,
      });
    }

    const newUser = await prisma.user.create({
      data: {
        tenantId: req.tenantId || 'tenant-deco-vintage',
        email: normalizedEmail,
        fullName: fullName.trim(),
        role: primaryRole,
        roles: targetRoles,
        assignedEventId: assignedEventId || null,
        status: 'ACTIVO',
      },
      include: {
        assignedEvent: {
          select: { id: true, name: true, location: true, status: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Usuario ${newUser.fullName} (${newUser.email}) registrado y autorizado correctamente.`,
      data: {
        ...newUser,
        roles: newUser.roles || targetRoles,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: 'No puedes eliminar tu propia cuenta de Super Administrador en sesión.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    const isSuperAdminEmail = ENV.SUPER_ADMIN_EMAILS.includes((targetUser.email || '').toLowerCase().trim());
    if (isSuperAdminEmail) {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar a un Super Administrador maestro configurado en las variables de entorno.',
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario eliminado del sistema correctamente.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
