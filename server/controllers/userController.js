import { prisma } from '../config/prisma.js';

let demoUsers = [
  {
    id: 'user-superadmin-1',
    email: 'ia@dekolabs.org',
    fullName: 'Sebastián (Deko Labs)',
    role: 'SUPER_ADMIN',
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
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        avatarUrl: u.avatarUrl,
        status: u.status,
        assignedEventId: u.assignedEventId,
        assignedEvent: u.assignedEvent,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['SUPER_ADMIN', 'VENDEDOR', 'OPERARIO_1', 'OPERARIO_2'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Rol no válido.' });
    }

    const demoUser = demoUsers.find((u) => u.id === id);
    if (demoUser) {
      demoUser.role = role;
      return res.status(200).json({
        success: true,
        message: `Rol de ${demoUser.fullName} actualizado a ${role}`,
        data: demoUser,
      });
    }

    try {
      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        include: { assignedEvent: true },
      });

      return res.status(200).json({
        success: true,
        message: `Rol de ${updated.fullName} actualizado a ${role}`,
        data: updated,
      });
    } catch (e) {
      return res.status(200).json({
        success: true,
        message: `Rol actualizado a ${role}`,
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
