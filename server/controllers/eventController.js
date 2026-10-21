import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { invalidateUserAuthCache } from '../middleware/authMiddleware.js';
import {
  calculateEventFinancials,
  listEventExpenses,
  addEventExpense,
  deleteEventExpense,
} from '../services/eventFinanceService.js';

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
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
    const isVendedor = userRoles.includes('VENDEDOR');
    const assignedEventId = req.user?.assignedEventId;

    let event = null;
    const selectTenant = { select: { name: true, currencySymbol: true, currency: true } };

    try {
      if (isVendedorRedes && !isSuperAdmin && !isVendedor) {
        event = await prisma.event.findFirst({
          where: { id: 'evt-ventas-redes-online', tenantId },
          include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
        });
        if (!event) {
          event = await prisma.event.findFirst({
            where: { tenantId, status: 'ACTIVO' },
            include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
          });
        }
      } else if (isVendedor && !isSuperAdmin) {
        if (assignedEventId) {
          event = await prisma.event.findFirst({
            where: { id: assignedEventId, tenantId },
            include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
          });
        } else {
          return res.json({
            success: true,
            data: null,
            unassignedSeller: true,
            message: 'No tienes un stand asignado actualmente. Contacta al administrador.',
          });
        }
      } else {
        const requestedEventId = req.query?.eventId;
        if (requestedEventId && requestedEventId !== 'evt-ventas-redes-online') {
          event = await prisma.event.findFirst({
            where: { id: requestedEventId, tenantId, status: 'ACTIVO' },
            include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
          });
        }
        if (!event) {
          event = await prisma.event.findFirst({
            where: {
              tenantId,
              status: 'ACTIVO',
              id: { not: 'evt-ventas-redes-online' },
              NOT: [
                { name: { contains: 'redes', mode: 'insensitive' } },
                { name: { contains: 'ventas en línea', mode: 'insensitive' } },
                { location: { contains: 'redes', mode: 'insensitive' } },
                { location: { contains: 'en línea', mode: 'insensitive' } },
              ],
            },
            include: { tenant: selectTenant, assignedSellers: { select: SELLER_SELECT } },
            orderBy: { startDate: 'desc' },
          });
        }
      }
    } catch (dbErr) {
      if (ENV.NODE_ENV === 'development') {
        event = getDevFallbackEvent(tenantId);
      } else {
        throw dbErr;
      }
    }

    if (!event) {
      return res.json({ success: true, data: null, message: 'No hay stands feriales activos configurados.' });
    }

    let financials = null;
    try {
      const salesAgg = await prisma.sale.aggregate({
        where: { tenantId, eventId: event.id, status: { not: 'ANULADA' } },
        _sum: { totalAmount: true },
      });
      const expenses = (prisma.eventExpense && typeof prisma.eventExpense.findMany === 'function')
        ? await prisma.eventExpense.findMany({ where: { tenantId, eventId: event.id } })
        : [];
      financials = calculateEventFinancials({
        event,
        cumulativeSold: Number(salesAgg._sum?.totalAmount || 0),
        expenses,
      });
    } catch (_fErr) {
      financials = calculateEventFinancials({ event, cumulativeSold: 0, expenses: [] });
    }

    return res.json({ success: true, data: { ...event, financials } });
  } catch (err) {
    console.error('❌ Error obteniendo evento activo:', err);
    return res.status(500).json({ success: false, error: 'Error del servidor al obtener evento.' });
  }
}

export async function getEventsList(req, res) {
  try {
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');

    const whereClause = { tenantId: req.tenantId };
    if (isVendedorRedes && !isSuperAdmin) {
      whereClause.id = 'evt-ventas-redes-online';
    } else if (!isSuperAdmin) {
      whereClause.id = { not: 'evt-ventas-redes-online' };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: { assignedSellers: { select: SELLER_SELECT } },
    });

    let salesByEvent = new Map();
    try {
      const salesAgg = await prisma.sale.groupBy({
        by: ['eventId'],
        where: { tenantId: req.tenantId, status: { not: 'ANULADA' } },
        _sum: { totalAmount: true },
        _count: { id: true },
      });
      salesAgg.forEach((r) => {
        if (r.eventId) {
          salesByEvent.set(r.eventId, {
            totalSold: Number(Number(r._sum?.totalAmount || 0).toFixed(2)),
            salesCount: r._count?.id || 0,
          });
        }
      });
    } catch (_) {}

    let expensesByEvent = new Map();
    try {
      if (prisma.eventExpense && typeof prisma.eventExpense.findMany === 'function') {
        const allExpenses = await prisma.eventExpense.findMany({ where: { tenantId: req.tenantId } });
        allExpenses.forEach((exp) => {
          if (!expensesByEvent.has(exp.eventId)) expensesByEvent.set(exp.eventId, []);
          expensesByEvent.get(exp.eventId).push(exp);
        });
      }
    } catch (_) {}

    const formatted = events.map((ev) => {
      const salesInfo = salesByEvent.get(ev.id) || { totalSold: 0, salesCount: 0 };
      const evExpenses = expensesByEvent.get(ev.id) || [];
      const financials = calculateEventFinancials({
        event: ev, cumulativeSold: salesInfo.totalSold, expenses: evExpenses,
      });
      const hasRel = Array.isArray(ev.assignedSellers);
      const assignedSellerName = hasRel ? (ev.assignedSellers.length > 0 ? ev.assignedSellers.map((u) => u.fullName).join(', ') : null) : ev.assignedSellerName;
      const assignedSellerEmail = hasRel ? (ev.assignedSellers.length > 0 ? ev.assignedSellers.map((u) => u.email).join(', ') : null) : ev.assignedSellerEmail;
      return { ...ev, assignedSellerName, assignedSellerEmail, totalSold: salesInfo.totalSold, salesCount: salesInfo.salesCount, financials };
    });

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

    const existingEvent = await prisma.event.findFirst({
      where: { id, tenantId },
      include: { assignedSellers: true },
    });
    if (!existingEvent) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });

    const updateData = { status: 'ACTIVO' };
    if (assignedSellerEmail && assignedSellerEmail.trim()) {
      updateData.assignedSellerEmail = assignedSellerEmail.trim();
      updateData.assignedSellerName = (assignedSellerName || assignedSellerEmail.split('@')[0]).trim();
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: { assignedSellers: { select: SELLER_SELECT } },
    });

    invalidateUserAuthCache();
    return res.json({
      success: true,
      data: updated,
      message: `El evento "${updated.name}" está ahora EN CURSO (concurrente).`,
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

    const runCreate = async (tx) => {
      let finalSellerEmail = assignedSellerEmail?.trim() || null;
      let finalSellerName = assignedSellerName?.trim() || null;

      if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
        const users = await tx.user.findMany({
          where: { id: { in: assignedUserIds }, tenantId },
          select: { id: true, fullName: true, email: true },
        });
        if (!finalSellerEmail && users.length > 0) {
          finalSellerEmail = users.map((u) => u.email).join(', ');
          finalSellerName = users.map((u) => u.fullName).join(', ');
        }
      }

      const newEvent = await tx.event.create({
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
        await tx.user.updateMany({
          where: { id: { in: assignedUserIds }, tenantId },
          data: { assignedEventId: newEvent.id },
        });
      }

      const eventWithSellers = await tx.event.findUnique({
        where: { id: newEvent.id },
        include: { assignedSellers: { select: SELLER_SELECT } },
      });

      return eventWithSellers || newEvent;
    };

    const resultEvent = typeof prisma.$transaction === 'function'
      ? await prisma.$transaction(runCreate)
      : await runCreate(prisma);

    invalidateUserAuthCache();
    return res.status(201).json({
      success: true,
      data: resultEvent,
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

    const runUpdate = async (tx) => {
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (location !== undefined) updateData.location = location.trim();
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (salesTarget !== undefined) updateData.salesTarget = Number(salesTarget);

      if (Array.isArray(assignedUserIds)) {
        await tx.user.updateMany({
          where: { assignedEventId: id, id: { notIn: assignedUserIds }, tenantId },
          data: { assignedEventId: null },
        });

        if (assignedUserIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: assignedUserIds }, tenantId },
            data: { assignedEventId: id },
          });
          const users = await tx.user.findMany({
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

      await tx.event.update({ where: { id }, data: updateData });

      return await tx.event.findUnique({
        where: { id },
        include: {
          assignedSellers: { select: SELLER_SELECT },
          _count: { select: { sales: true } },
          sales: { select: { totalAmount: true } },
        },
      });
    };

    const updated = typeof prisma.$transaction === 'function'
      ? await prisma.$transaction(runUpdate)
      : await runUpdate(prisma);

    invalidateUserAuthCache();

    const formatted = {
      ...updated,
      totalSold: updated.sales ? updated.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0) : 0,
      salesCount: updated._count ? updated._count.sales : 0,
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
    invalidateUserAuthCache();
    return res.json({ success: true, data: updated, message: `El evento "${updated.name}" ${successMsg}.` });
  } catch (err) {
    console.error(`❌ Error ${logAction} evento:`, err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
}

export const archiveEvent = (req, res) => {
  if (req.params.id === 'evt-ventas-redes-online') {
    return res.status(400).json({
      success: false,
      error: 'El Punto de Venta Digital Permanente no puede ser archivado.',
    });
  }
  return changeEventStatus(req, res, 'ARCHIVADO', 'ha sido archivado exitosamente', 'Error al archivar el evento.', 'archivando');
};

export const unarchiveEvent = (req, res) =>
  changeEventStatus(req, res, 'CONFIRMADO', 'ha sido restaurado a la lista de confirmados', 'Error al restaurar el evento.', 'desarchivando');

export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    if (id === 'evt-ventas-redes-online') {
      return res.status(400).json({
        success: false,
        error: 'El Punto de Venta Digital Permanente no puede ser eliminado.',
      });
    }
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
      if (prisma.eventExpense && typeof prisma.eventExpense.deleteMany === 'function') {
        await prisma.eventExpense.deleteMany({ where: { eventId: id } });
      }
      await prisma.cashClosing.deleteMany({ where: { eventId: id } });
      await prisma.sale.deleteMany({ where: { eventId: id } });
      await prisma.event.delete({ where: { id } });
      invalidateUserAuthCache();
      return res.json({ success: true, message: `El evento "${event.name}" y sus registros fueron purgados con éxito.` });
    }

    const expensesCount = (prisma.eventExpense && typeof prisma.eventExpense.count === 'function')
      ? await prisma.eventExpense.count({ where: { eventId: id } }) : 0;

    if (event._count.sales > 0 || event._count.cashClosings > 0 || expensesCount > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar "${event.name}" porque tiene registros contables (${event._count.sales} ventas, ${event._count.cashClosings} arqueos y ${expensesCount} gastos).`,
      });
    }

    await prisma.user.updateMany({ where: { assignedEventId: id }, data: { assignedEventId: null } });
    await prisma.event.delete({ where: { id } });
    invalidateUserAuthCache();
    return res.json({ success: true, message: `El evento "${event.name}" fue eliminado correctamente.` });
  } catch (err) {
    console.error('❌ Error eliminando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al eliminar el evento.' });
  }
}

export async function getEventExpenses(req, res) {
  try {
    const { id } = req.params;
    const result = await listEventExpenses({ tenantId: req.tenantId, eventId: id });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ Error obteniendo gastos del evento:', err);
    const status = err.message?.includes('no existe') ? 404 : 400;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function createEventExpense(req, res) {
  try {
    const { id } = req.params;
    const { category, description, amount, expenseDate } = req.body;
    const result = await addEventExpense({
      tenantId: req.tenantId,
      eventId: id,
      category,
      description,
      amount,
      expenseDate,
      createdById: req.user?.id,
    });
    return res.status(201).json({
      success: true,
      data: result.expense,
      financials: result.financials,
      message: 'Gasto registrado correctamente.',
    });
  } catch (err) {
    console.error('❌ Error registrando gasto:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

export async function removeEventExpense(req, res) {
  try {
    const { id, expenseId } = req.params;
    const result = await deleteEventExpense({ tenantId: req.tenantId, eventId: id, expenseId });
    return res.json({ success: true, data: result, message: 'Gasto eliminado exitosamente.' });
  } catch (err) {
    console.error('❌ Error eliminando gasto:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}
