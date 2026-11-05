import { invalidateUserAuthCache } from '../middleware/authMiddleware.js';
import {
  calculateEventFinancials, findActiveEventWithFinancials, listTenantEventsRaw,
  activateStandEvent, createStandEvent, updateStandEvent, changeStandEventStatus,
  removeStandEvent, listEventExpenses, addEventExpense, deleteEventExpense,
} from '../services/eventService.js';

export async function getActiveEvent(req, res) {
  try {
    const tenantId = req.tenantId;
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0 ? req.user.roles : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
    const isVendedor = userRoles.includes('VENDEDOR');
    const assignedEventId = req.user?.assignedEventId;

    let eventWithFinancials = null;
    if (isVendedorRedes && !isSuperAdmin && !isVendedor) {
      eventWithFinancials = await findActiveEventWithFinancials({ tenantId, mode: 'REDES' });
    } else if (isVendedor && !isSuperAdmin) {
      if (!assignedEventId) {
        return res.json({ success: true, data: null, unassignedSeller: true, message: 'No tienes un stand asignado actualmente. Contacta al administrador.' });
      }
      eventWithFinancials = await findActiveEventWithFinancials({ tenantId, mode: 'VENDEDOR', assignedEventId });
    } else {
      const ferialWhere = {
        tenantId, status: 'ACTIVO', id: { not: 'evt-ventas-redes-online' },
        NOT: [
          { name: { contains: 'redes', mode: 'insensitive' } },
          { name: { contains: 'ventas en línea', mode: 'insensitive' } },
          { location: { contains: 'redes', mode: 'insensitive' } },
          { location: { contains: 'en línea', mode: 'insensitive' } },
        ],
      };
      eventWithFinancials = await findActiveEventWithFinancials({ tenantId, mode: 'FERIAL', requestedEventId: req.query?.eventId, ferialWhere });
    }

    if (!eventWithFinancials) {
      return res.json({ success: true, data: null, message: 'No hay stands feriales activos configurados.' });
    }
    return res.json({ success: true, data: eventWithFinancials });
  } catch (err) {
    console.error('❌ Error obteniendo evento activo:', err);
    return res.status(500).json({ success: false, error: 'Error del servidor al obtener evento.' });
  }
}

export async function getEventsList(req, res) {
  try {
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0 ? req.user.roles : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
    const whereClause = { tenantId: req.tenantId };
    if (req.query.forPickup === 'true') {
      whereClause.id = { not: 'evt-ventas-redes-online' };
      whereClause.status = { not: 'ARCHIVADO' };
    } else if (isVendedorRedes && !isSuperAdmin) {
      whereClause.id = 'evt-ventas-redes-online';
    } else if (!isSuperAdmin) {
      whereClause.id = { not: 'evt-ventas-redes-online' };
    }

    const { events, salesByEvent, expensesByEvent } = await listTenantEventsRaw({ tenantId: req.tenantId, whereClause });
    const formatted = events.map((ev) => {
      const salesInfo = salesByEvent.get(ev.id) || { totalSold: 0, salesCount: 0 };
      const financials = calculateEventFinancials({ event: ev, cumulativeSold: salesInfo.totalSold, expenses: expensesByEvent.get(ev.id) || [] });
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
    const updated = await activateStandEvent({
      id: req.params.id, tenantId: req.tenantId,
      assignedSellerEmail: req.body.assignedSellerEmail, assignedSellerName: req.body.assignedSellerName,
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });
    invalidateUserAuthCache();
    return res.json({ success: true, data: updated, message: `El evento "${updated.name}" está ahora EN CURSO (concurrente).` });
  } catch (err) {
    console.error('❌ Error activando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al activar el evento.' });
  }
}

export async function createEvent(req, res) {
  try {
    const { name, location, startDate, endDate, salesTarget, assignedSellerEmail, assignedSellerName, assignedUserIds } = req.body || {};
    if (!name || !location) return res.status(400).json({ success: false, error: 'Nombre y ubicación son obligatorios.' });
    const resultEvent = await createStandEvent({ tenantId: req.tenantId, name, location, startDate, endDate, salesTarget, assignedSellerEmail, assignedSellerName, assignedUserIds });
    invalidateUserAuthCache();
    return res.status(201).json({ success: true, data: resultEvent, message: 'Evento confirmado registrado exitosamente.' });
  } catch (err) {
    console.error('❌ Error creando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al crear nuevo evento.' });
  }
}

export async function updateEvent(req, res) {
  try {
    const { name, location, startDate, endDate, salesTarget, assignedUserIds } = req.body || {};
    const formatted = await updateStandEvent({ id: req.params.id, tenantId: req.tenantId, name, location, startDate, endDate, salesTarget, assignedUserIds });
    if (!formatted) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });
    invalidateUserAuthCache();
    return res.json({ success: true, data: formatted, message: `El evento "${formatted.name}" fue actualizado exitosamente.` });
  } catch (err) {
    console.error('❌ Error actualizando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al actualizar el evento.' });
  }
}

async function changeEventStatus(req, res, targetStatus, successMsg, errorMsg, logAction) {
  try {
    const updated = await changeStandEventStatus({ id: req.params.id, tenantId: req.tenantId, targetStatus });
    if (!updated) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });
    invalidateUserAuthCache();
    return res.json({ success: true, data: updated, message: `El evento "${updated.name}" ${successMsg}.` });
  } catch (err) {
    console.error(`❌ Error ${logAction} evento:`, err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
}

export const archiveEvent = (req, res) => (req.params.id === 'evt-ventas-redes-online'
  ? res.status(400).json({ success: false, error: 'El Punto de Venta Digital Permanente no puede ser archivado.' })
  : changeEventStatus(req, res, 'ARCHIVADO', 'ha sido archivado exitosamente', 'Error al archivar el evento.', 'archivando'));

export const unarchiveEvent = (req, res) =>
  changeEventStatus(req, res, 'CONFIRMADO', 'ha sido restaurado a la lista de confirmados', 'Error al restaurar el evento.', 'desarchivando');

export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    if (id === 'evt-ventas-redes-online') return res.status(400).json({ success: false, error: 'El Punto de Venta Digital Permanente no puede ser eliminado.' });
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || req.user?.role === 'SUPER_ADMIN';
    const result = await removeStandEvent({ id, tenantId: req.tenantId, force: req.query.force, isSuperAdmin });
    if (result.notFound) return res.status(404).json({ success: false, error: 'Evento no encontrado.' });
    invalidateUserAuthCache();
    const message = result.purged ? `El evento "${result.eventName}" y sus registros fueron purgados con éxito.` : `El evento "${result.eventName}" fue eliminado correctamente.`;
    return res.json({ success: true, message });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, error: err.message });
    console.error('❌ Error eliminando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al eliminar el evento.' });
  }
}

export async function getEventExpenses(req, res) {
  try {
    const result = await listEventExpenses({ tenantId: req.tenantId, eventId: req.params.id });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ Error obteniendo gastos del evento:', err);
    return res.status(err.message?.includes('no existe') ? 404 : 400).json({ success: false, error: err.message });
  }
}

export async function createEventExpense(req, res) {
  try {
    const { category, description, amount, expenseDate } = req.body;
    const result = await addEventExpense({ tenantId: req.tenantId, eventId: req.params.id, category, description, amount, expenseDate, createdById: req.user?.id });
    return res.status(201).json({ success: true, data: result.expense, financials: result.financials, message: 'Gasto registrado correctamente.' });
  } catch (err) {
    console.error('❌ Error registrando gasto:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}

export async function removeEventExpense(req, res) {
  try {
    const result = await deleteEventExpense({ tenantId: req.tenantId, eventId: req.params.id, expenseId: req.params.expenseId });
    return res.json({ success: true, data: result, message: 'Gasto eliminado exitosamente.' });
  } catch (err) {
    console.error('❌ Error eliminando gasto:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}
