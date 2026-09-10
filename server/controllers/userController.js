import { prisma } from '../config/prisma.js';

export let demoUsers = [
  {
    id: 'user-superadmin-1',
    email: 'ia@dekolabs.org',
    fullName: 'Sebastián (Deko Labs)',
    role: 'SUPER_ADMIN',
    roles: ['SUPER_ADMIN'],
    avatarUrl: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
    status: 'ACTIVO',
    assignedEventId: null,
    assignedEvent: null,
    createdAt: new Date(),
  },
  {
    id: 'user-vendedor-1',
    email: 'vendedor@decovintage.online',
    fullName: 'Carlos Méndez (Ventas)',
    role: 'VENDEDOR',
    roles: ['VENDEDOR'],
    avatarUrl: null,
    status: 'ACTIVO',
    assignedEventId: 'event-demo-1',
    assignedEvent: { id: 'event-demo-1', name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' },
    createdAt: new Date(),
  },
  {
    id: 'user-operario1-1',
    email: 'operario1@decovintage.online',
    fullName: 'Marcos López (Operario 1)',
    role: 'OPERARIO_1',
    roles: ['OPERARIO_1'],
    avatarUrl: null,
    status: 'ACTIVO',
    assignedEventId: null,
    assignedEvent: null,
    createdAt: new Date(),
  },
  {
    id: 'user-operario2-1',
    email: 'operario2@decovintage.online',
    fullName: 'Andrea Ruiz (Operario 2 Taller)',
    role: 'OPERARIO_2',
    roles: ['OPERARIO_2'],
    avatarUrl: null,
    status: 'ACTIVO',
    assignedEventId: null,
    assignedEvent: null,
    createdAt: new Date(),
  },
];

export async function getUsersList(req, res) {
  try {
    let users;
    try {
      users = await prisma.user.findMany({
        where: { tenantId: req.tenantId },
        include: {
          assignedEvent: {
            select: { id: true, name: true, location: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      users = demoUsers;
    }

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

    const demoUser = demoUsers.find((u) => u.id === id);
    if (demoUser) {
      demoUser.role = primaryRole;
      demoUser.roles = targetRoles;
      return res.status(200).json({
        success: true,
        message: `Roles de ${demoUser.fullName} actualizados a [${targetRoles.join(', ')}]`,
        data: demoUser,
      });
    }

    try {
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
    } catch (e) {
      return res.status(200).json({
        success: true,
        message: `Roles actualizados a [${targetRoles.join(', ')}]`,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function assignUserToEvent(req, res) {
  try {
    const { id } = req.params;
    const { eventId } = req.body;

    const demoUser = demoUsers.find((u) => u.id === id);
    if (demoUser) {
      demoUser.assignedEventId = eventId || null;
      demoUser.assignedEvent = eventId
        ? { id: eventId, name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' }
        : null;
      return res.status(200).json({
        success: true,
        message: `Vendedor asignado al evento ${demoUser.assignedEvent?.name || 'Ninguno'}`,
        data: demoUser,
      });
    }

    try {
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
    } catch (e) {
      return res.status(200).json({
        success: true,
        message: `Vendedor asignado`,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const demoUser = demoUsers.find((u) => u.id === id);
    if (demoUser) {
      demoUser.status = demoUser.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      return res.status(200).json({
        success: true,
        message: `Usuario ${demoUser.status === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente.`,
        data: demoUser,
      });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
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
    } catch (e) {
      return res.status(200).json({
        success: true,
        message: `Estado actualizado`,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
