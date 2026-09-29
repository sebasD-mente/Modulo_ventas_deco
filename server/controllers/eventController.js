import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

const SELLER_SELECT = {
  id: true, fullName: true, email: true, role: true, roles: true, avatarUrl: true,
};

function getDevFallbackEvent(tenantId) {
  return {
    id: 'event-stand-active-2026',
    name: 'Stand Principal Expo 2026',
    location: 'Deco Vintage Guate',
    status: 'ACTIVO',
    tenantId: tenantId || 'tenant-deco-vintage',
    tenant: { name: 'Deco Vintage Guate', currencySymbol: 'Q', currency: 'GTQ' },
    assignedSellers: [],
  };
}

export async function getActiveEvent(req, res) {
  try {
    const tenantId = req.tenantId;
    let event;
    const selectTenant = { select: { name: true, currencySymbol: true, currency: true } };
    try {
      event = (await prisma.event.findFirst({
        where: { tenantId, status: 'ACTIVO' },
        include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
        orderBy: { startDate: 'desc' },
      })) || (await prisma.event.findFirst({
        where: { tenantId },
        include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }));
    } catch (dbErr) {
      if (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') {
        event = getDevFallbackEvent(tenantId);
      } else {
        throw dbErr;
      }
    }
    if (!event && (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test')) {
      event = getDevFallbackEvent(tenantId);
    }
    if (!event) {
      return res.status(404).json({ success: false, error: 'No hay eventos configurados para este negocio.' });
    }
    return res.json({ success: true, data: event });
  } catch (err) {
    console.error('❌ Error obteniendo evento activo:', err);
    return res.status(500).json({ success: false, error: 'Error del servidor al obtener evento.' });
  }
}

export async function getEventsList(req, res) {
  try {
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');

    const whereClause = { tenantId: req.tenantId };
    if (isVendedorRedes && !isSuperAdmin) {
      whereClause.id = 'evt-ventas-redes-online';
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        _count: { select: { sales: true } },
        sales: { select: { totalAmount: true } },
        assignedSellers: { select: SELLER_SELECT },
      },
    });
    const formatted = events.map(({ sales, _count, ...rest }) => ({
      ...rest,
      totalSold: sales.reduce((acc, s) => acc + Number(s.totalAmount), 0),
      salesCount: _count.sales,
    }));
    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('❌ Error obteniendo lista de eventos:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener eventos.' });
  }
}

export async function activateEvent(req, res) {
  try {
    const { id } = req.params;
    const { assignedSellerEmail, assignedSellerName } = req.body;
    const tenantId = req.tenantId;
    if (!assignedSellerEmail?.trim()) {
      return res.status(400).json({ success: false, error: 'El correo de Google del vendedor es obligatorio.' });
    }
    await prisma.event.updateMany({
      where: { tenantId, status: 'ACTIVO', id: { not: id } },
      data: { status: 'CONFIRMADO' },
    });
    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: 'ACTIVO',
        assignedSellerEmail: assignedSellerEmail.trim(),
        assignedSellerName: (assignedSellerName || assignedSellerEmail.split('@')[0]).trim(),
      },
      include: { assignedSellers: { select: SELLER_SELECT } },
    });
    return res.json({
      success: true,
      data: updated,
      message: `El evento "${updated.name}" está ahora EN CURSO con vendedor ${updated.assignedSellerEmail}.`,
    });
  } catch (err) {
    console.error('❌ Error activando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al activar el evento.' });
  }
}

export async function createEvent(req, res) {
  try {
    const tenantId = req.tenantId;
    const {
      name, location, startDate, endDate, salesTarget,
      assignedSellerEmail, assignedSellerName, assignedUserIds,
    } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'Nombre y ubicación son obligatorios.' });
    }

    let finalSellerEmail = assignedSellerEmail?.trim() || null;
    let finalSellerName = assignedSellerName?.trim() || null;

    if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: assignedUserIds }, tenantId },
        select: { id: true, fullName: true, email: true },
      });
      if (!finalSellerEmail && users.length > 0) {
        finalSellerEmail = users.map((u) => u.email).join(', ');
        finalSellerName = users.map((u) => u.fullName).join(', ');
      }
    }

    const newEvent = await prisma.event.create({
      data: {
        tenantId,
        name: name.trim(),
        location: location.trim(),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 3 * 86400000),
        status: 'CONFIRMADO',
        salesTarget: salesTarget ? Number(salesTarget) : 15000,
        assignedSellerEmail: finalSellerEmail,
        assignedSellerName: finalSellerName,
      },
    });

    if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: assignedUserIds }, tenantId },
        data: { assignedEventId: newEvent.id },
      });
    }

    const eventWithSellers = await prisma.event.findUnique({
      where: { id: newEvent.id },
      include: { assignedSellers: { select: SELLER_SELECT } },
    });

    return res.status(201).json({
      success: true,
      data: eventWithSellers || newEvent,
      message: 'Evento confirmado registrado exitosamente.',
    });
  } catch (err) {
    console.error('❌ Error creando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al crear nuevo evento.' });
  }
}

export async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, location, startDate, endDate, salesTarget, assignedUserIds } = req.body;

    const event = await prisma.event.findFirst({ where: { id, tenantId } });
    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (salesTarget !== undefined) updateData.salesTarget = Number(salesTarget);

    if (Array.isArray(assignedUserIds)) {
      // 1. Desasignar usuarios previos que ya no están en la lista
      await prisma.user.updateMany({
        where: { assignedEventId: id, id: { notIn: assignedUserIds }, tenantId },
        data: { assignedEventId: null },
      });

      // 2. Asignar los nuevos usuarios seleccionados
      if (assignedUserIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: assignedUserIds }, tenantId },
          data: { assignedEventId: id },
        });
        const users = await prisma.user.findMany({
          where: { id: { in: assignedUserIds }, tenantId },
          select: { fullName: true, email: true },
        });
        updateData.assignedSellerEmail = users.map((u) => u.email).join(', ');
        updateData.assignedSellerName = users.map((u) => u.fullName).join(', ');
      } else {
        updateData.assignedSellerEmail = null;
        updateData.assignedSellerName = null;
      }
    }

    await prisma.event.update({
      where: { id },
      data: updateData,
    });

    const updated = await prisma.event.findUnique({
      where: { id },
      include: {
        assignedSellers: { select: SELLER_SELECT },
        _count: { select: { sales: true } },
        sales: { select: { totalAmount: true } },
      },
    });

    const formatted = {
      ...updated,
      totalSold: updated.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0),
      salesCount: updated._count.sales,
    };

    return res.json({
      success: true,
      data: formatted,
      message: `El evento "${formatted.name}" fue actualizado exitosamente.`,
    });
  } catch (err) {
    console.error('❌ Error actualizando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al actualizar el evento.' });
  }
}

async function changeEventStatus(req, res, targetStatus, successMsg, errorMsg, logAction) {
  try {
    const { id } = req.params;
    const event = await prisma.event.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });
    const updated = await prisma.event.update({
      where: { id },
      data: { status: targetStatus },
      include: { assignedSellers: { select: SELLER_SELECT } },
    });
    return res.json({ success: true, data: updated, message: `El evento "${updated.name}" ${successMsg}.` });
  } catch (err) {
    console.error(`❌ Error ${logAction} evento:`, err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
}

export const archiveEvent = (req, res) =>
  changeEventStatus(req, res, 'ARCHIVADO', 'ha sido archivado exitosamente', 'Error al archivar el evento.', 'archivando');

export const unarchiveEvent = (req, res) =>
  changeEventStatus(req, res, 'CONFIRMADO', 'ha sido restaurado a la lista de confirmados', 'Error al restaurar el evento.', 'desarchivando');

export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const tenantId = req.tenantId;
    const event = await prisma.event.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { sales: true, cashClosings: true } } },
    });
    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });

    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || req.user?.role === 'SUPER_ADMIN';
    if (force === 'true' && isSuperAdmin) {
      await prisma.user.updateMany({ where: { assignedEventId: id }, data: { assignedEventId: null } });
      await prisma.cashClosing.deleteMany({ where: { eventId: id } });
      await prisma.sale.deleteMany({ where: { eventId: id } });
      await prisma.event.delete({ where: { id } });
      return res.json({ success: true, message: `El evento "${event.name}" y sus registros de prueba fueron purgados con éxito.` });
    }

    if (event._count.sales > 0 || event._count.cashClosings > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar "${event.name}" porque tiene registros contables (${event._count.sales} ventas y ${event._count.cashClosings} arqueos). Puedes archivarlo para preservar el historial o purgarlo si eres administrador.`,
      });
    }
    await prisma.user.updateMany({ where: { assignedEventId: id }, data: { assignedEventId: null } });
    await prisma.event.delete({ where: { id } });
    return res.json({ success: true, message: `El evento "${event.name}" fue eliminado correctamente.` });
  } catch (err) {
    console.error('❌ Error eliminando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al eliminar el evento.' });
  }
}
