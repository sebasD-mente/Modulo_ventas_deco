import { prisma } from '../../config/prisma.js';

export { getMonitorDashboardMetrics } from './monitorKpiService.js';

/**
 * Retorna el rango civil exacto de inicio y fin de un día en la zona horaria oficial America/Guatemala (UTC-6).
 */
export function getGuatemalaDayRange(dateStr = null) {
  let targetDate;
  if (!dateStr) {
    targetDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  } else if (dateStr instanceof Date) {
    targetDate = !Number.isNaN(dateStr.getTime())
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(dateStr)
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  } else {
    const raw = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      targetDate = raw.slice(0, 10);
    } else {
      const parsed = new Date(raw);
      targetDate = !Number.isNaN(parsed.getTime())
        ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(parsed)
        : raw.split('T')[0];
    }
  }

  const startOfDay = new Date(`${targetDate}T00:00:00.000-06:00`);
  const endOfDay = new Date(`${targetDate}T23:59:59.999-06:00`);
  return { targetDate, startOfDay, endOfDay };
}

/**
 * Obtiene métricas y KPIs en tiempo real de un evento utilizando agregaciones nativas de PostgreSQL en O(1)
 */
export async function getEventKPIs(params, fallbackTenantId = null) {
  let tenantId = null, eventId = null, date = null;

  if (typeof params === 'string') {
    eventId = params;
    tenantId = fallbackTenantId;
  } else if (params && typeof params === 'object') {
    tenantId = params.tenantId || fallbackTenantId || null;
    eventId = params.eventId || null;
    date = params.date || null;
  }

  const isAlias = !eventId || ['current', 'activo', 'active', 'hoy'].includes(String(eventId).trim().toLowerCase());
  if (isAlias && prisma.event?.findFirst) {
    try {
      const activeEvt = await prisma.event.findFirst({
        where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      });
      eventId = activeEvt?.id || null;
    } catch (_) {
      eventId = null;
    }
  }

  const saleWhere = { status: { not: 'ANULADA' } };
  if (eventId) saleWhere.eventId = eventId;
  if (tenantId) saleWhere.tenantId = tenantId;

  const paymentWhere = {
    sale: {
      status: { not: 'ANULADA' },
      ...(tenantId ? { tenantId } : {}),
      ...(eventId
        ? {
            OR: [
              { eventId },
              { pickupEventId: eventId },
            ],
          }
        : {}),
    },
  };

  if (date) {
    const { startOfDay, endOfDay } = getGuatemalaDayRange(date);
    if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
      saleWhere.createdAt = { gte: startOfDay, lte: endOfDay };
      paymentWhere.createdAt = { gte: startOfDay, lte: endOfDay };
    }
  }

  const [salesAggregate, unitsAggregate, paymentsGroup, topProductsGroup, recentSales, eventRecord] = await Promise.all([
    prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.saleItem.aggregate({ where: { sale: saleWhere }, _sum: { quantity: true } }),
    prisma.salePayment.groupBy({ by: ['method'], where: paymentWhere, _count: { id: true }, _sum: { amount: true } }),
    prisma.saleItem.groupBy({ by: ['description'], where: { sale: saleWhere }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    prisma.sale.findMany({ where: saleWhere, take: 15, orderBy: { createdAt: 'desc' }, include: { seller: true, payments: true, items: true } }),
    eventId
      ? prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, location: true, status: true, startDate: true, endDate: true } })
      : Promise.resolve(null),
  ]);

  const totalTransactions = salesAggregate._count?.id || 0;
  const totalAmount = Number(Number(salesAggregate._sum?.totalAmount || 0).toFixed(2));
  const totalUnits = unitsAggregate._sum?.quantity || 0;
  const averageTicket = totalTransactions > 0 ? Number((totalAmount / totalTransactions).toFixed(2)) : 0;

  const paymentBreakdown = {
    EFECTIVO: { count: 0, amount: 0 },
    TARJETA: { count: 0, amount: 0 },
    TRANSFERENCIA: { count: 0, amount: 0 },
    OTRO: { count: 0, amount: 0 },
  };

  paymentsGroup.forEach((group) => {
    const method = group.method;
    const count = group._count?.id || 0;
    const amount = Number(Number(group._sum?.amount || 0).toFixed(2));
    const bucket = paymentBreakdown[method] || paymentBreakdown.OTRO;
    bucket.count += count;
    bucket.amount = Number((bucket.amount + amount).toFixed(2));
  });

  const topProducts = topProductsGroup.map((item) => ({
    name: item.description,
    productName: item.description,
    quantity: item._sum?.quantity || 0,
  }));

  const totalCollected = Number(Object.values(paymentBreakdown).reduce((acc, b) => acc + (b.amount || 0), 0).toFixed(2));
  const pendingBalanceTotal = Number(Math.max(0, totalAmount - totalCollected).toFixed(2));

  return {
    eventId,
    event: eventRecord || (eventId ? { id: eventId } : null),
    date,
    totalTransactions,
    totalAmount,
    totalRevenue: totalAmount,
    totalCollected,
    pendingBalanceTotal,
    totalUnits,
    totalItemsSold: totalUnits,
    averageTicket,
    paymentBreakdown,
    topProducts,
    recentSales,
  };
}

/**
 * Lista las ventas de un evento con paginación y filtros nativos
 */
export async function getEventSalesList({ tenantId, eventId, date = null, page = 1, limit = 50 }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const where = { eventId };
  if (tenantId) where.tenantId = tenantId;

  if (date) {
    const { startOfDay, endOfDay } = getGuatemalaDayRange(date);
    if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }
  }

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true, category: true } } } },
        payments: true,
        seller: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
  ]);

  return {
    sales,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
    hasNext: parsedPage * parsedLimit < total,
    hasPrev: parsedPage > 1,
  };
}
