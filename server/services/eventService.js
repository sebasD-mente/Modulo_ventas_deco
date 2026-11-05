import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import {
  calculateEventFinancials,
  computeEventFinancialSummary,
  loadTenantEventsFinancialMaps,
  listEventExpenses,
  addEventExpense,
  deleteEventExpense,
} from './eventFinanceService.js';

export {
  calculateEventFinancials,
  listEventExpenses,
  addEventExpense,
  deleteEventExpense,
};

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

export async function findActiveEventWithFinancials({
  tenantId, mode, assignedEventId, requestedEventId, ferialWhere,
}) {
  let event = null;
  const include = {
    tenant: { select: { name: true, currencySymbol: true, currency: true } },
    assignedSellers: { select: SELLER_SELECT },
  };

  try {
    if (mode === 'REDES') {
      event = await prisma.event.findFirst({
        where: { id: 'evt-ventas-redes-online', tenantId },
        include,
      });
      if (!event) {
        event = await prisma.event.findFirst({
          where: { tenantId, status: 'ACTIVO' },
          include,
        });
      }
    } else if (mode === 'VENDEDOR') {
      event = await prisma.event.findFirst({
        where: { id: assignedEventId, tenantId },
        include,
      });
    } else {
      if (requestedEventId && requestedEventId !== 'evt-ventas-redes-online') {
        event = await prisma.event.findFirst({
          where: { id: requestedEventId, tenantId, status: 'ACTIVO' },
          include,
        });
      }
      if (!event) {
        event = await prisma.event.findFirst({
          where: ferialWhere,
          include,
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

  if (!event) return null;
  const financials = await computeEventFinancialSummary({ tenantId, event });
  return { ...event, financials };
}

export async function listTenantEventsRaw({ tenantId, whereClause }) {
  const events = await prisma.event.findMany({
    where: whereClause,
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    include: { assignedSellers: { select: SELLER_SELECT } },
  });
  const { salesByEvent, expensesByEvent } = await loadTenantEventsFinancialMaps({ tenantId });
  return { events, salesByEvent, expensesByEvent };
}

export async function activateStandEvent({ id, tenantId, assignedSellerEmail, assignedSellerName }) {
  const existingEvent = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { assignedSellers: true },
  });
  if (!existingEvent) return null;

  const updateData = { status: 'ACTIVO' };
  if (assignedSellerEmail && assignedSellerEmail.trim()) {
    updateData.assignedSellerEmail = assignedSellerEmail.trim();
    updateData.assignedSellerName = (assignedSellerName || assignedSellerEmail.split('@')[0]).trim();
  }

  return prisma.event.update({
    where: { id },
    data: updateData,
    include: { assignedSellers: { select: SELLER_SELECT } },
  });
}

export async function createStandEvent({
  tenantId, name, location, startDate, endDate, salesTarget,
  assignedSellerEmail, assignedSellerName, assignedUserIds,
}) {
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

  return typeof prisma.$transaction === 'function'
    ? prisma.$transaction(runCreate)
    : runCreate(prisma);
}

export async function updateStandEvent({
  id, tenantId, name, location, startDate, endDate, salesTarget, assignedUserIds,
}) {
  const event = await prisma.event.findFirst({ where: { id, tenantId } });
  if (!event) return null;

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

    return tx.event.findUnique({
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

  return {
    ...updated,
    totalSold: updated.sales ? updated.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0) : 0,
    salesCount: updated._count ? updated._count.sales : 0,
  };
}

export async function changeStandEventStatus({ id, tenantId, targetStatus }) {
  const event = await prisma.event.findFirst({ where: { id, tenantId } });
  if (!event) return null;
  return prisma.event.update({
    where: { id },
    data: { status: targetStatus },
    include: { assignedSellers: { select: SELLER_SELECT } },
  });
}

export async function removeStandEvent({ id, tenantId, force, isSuperAdmin }) {
  const event = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { sales: true, cashClosings: true } } },
  });
  if (!event) return { notFound: true };

  if (force === 'true' && isSuperAdmin) {
    await prisma.user.updateMany({ where: { assignedEventId: id }, data: { assignedEventId: null } });
    if (prisma.eventExpense && typeof prisma.eventExpense.deleteMany === 'function') {
      await prisma.eventExpense.deleteMany({ where: { eventId: id } });
    }
    await prisma.cashClosing.deleteMany({ where: { eventId: id } });
    await prisma.sale.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id } });
    return { purged: true, eventName: event.name };
  }

  const expensesCount = (prisma.eventExpense && typeof prisma.eventExpense.count === 'function')
    ? await prisma.eventExpense.count({ where: { eventId: id } }) : 0;

  if (event._count.sales > 0 || event._count.cashClosings > 0 || expensesCount > 0) {
    const accountingErr = new Error(
      `No se puede eliminar "${event.name}" porque tiene registros contables (${event._count.sales} ventas, ${event._count.cashClosings} arqueos y ${expensesCount} gastos).`
    );
    accountingErr.statusCode = 400;
    throw accountingErr;
  }

  await prisma.user.updateMany({ where: { assignedEventId: id }, data: { assignedEventId: null } });
  await prisma.event.delete({ where: { id } });
  return { purged: false, eventName: event.name };
}
