import { prisma } from '../../config/prisma.js';

export { getMonitorDashboardMetrics } from './monitorKpiService.js';

/**
 * Retorna el rango civil exacto de inicio y fin de un día en la zona horaria oficial America/Guatemala (UTC-6).
 */
export function getGuatemalaDayRange(dateInput = null) {
  let targetDate;
  if (!dateInput) {
    targetDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  } else if (dateInput instanceof Date) {
    targetDate = !Number.isNaN(dateInput.getTime())
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(dateInput)
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  } else {
    const raw = String(dateInput).trim();
    targetDate = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
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

  // Aislamiento contable estricto de caja (Pilar 5):
  // 1. Para ventas propias del stand (eventId), cuentan todos sus pagos de la fecha.
  // 2. Para pedidos asignados para retiro en stand (pickupEventId === eventId y eventId !== targetStandId),
  //    SOLO entran en la caja los pagos de saldo cobrados en el stand (con '[SALDO]' en reference).
  //    El anticipo inicial cobrado en redes jamás entra a la caja del stand ferial.
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
    ...(eventId
      ? {
          NOT: {
            AND: [
              { sale: { eventId: { not: eventId }, pickupEventId: eventId } },
              { NOT: { reference: { contains: '[SALDO]' } } },
            ],
          },
        }
      : {}),
  };

  if (date) {
    const { startOfDay, endOfDay } = getGuatemalaDayRange(date);
    if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
      saleWhere.createdAt = { gte: startOfDay, lte: endOfDay };
      paymentWhere.createdAt = { gte: startOfDay, lte: endOfDay };
    }
  }

  const [salesAggregate, unitsAggregate, paymentsGroup, topProductsGroup, daySales, eventRecord] = await Promise.all([
    prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.saleItem.aggregate({ where: { sale: saleWhere }, _sum: { quantity: true } }),
    prisma.salePayment.groupBy({ by: ['method'], where: paymentWhere, _count: { id: true }, _sum: { amount: true } }),
    prisma.saleItem.groupBy({ by: ['description'], where: { sale: saleWhere }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    prisma.sale.findMany({ where: saleWhere, take: 250, orderBy: { createdAt: 'desc' }, include: { seller: true, payments: true, items: true } }),
    eventId
      ? prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, location: true, status: true, startDate: true, endDate: true } })
      : Promise.resolve(null),
  ]);

  const recentSales = (daySales || []).slice(0, 15);
  const sellerMap = new Map();
  (daySales || []).forEach((s) => {
    const sId = s.sellerId || s.seller?.id || 'sin-asignar';
    if (!sellerMap.has(sId)) {
      sellerMap.set(sId, {
        sellerId: sId,
        sellerName: s.seller?.fullName || 'Vendedor Stand',
        sellerEmail: s.seller?.email || '',
        transactions: 0,
        totalSold: 0,
        cashCollected: 0,
        cardCollected: 0,
        transferCollected: 0,
      });
    }
    const entry = sellerMap.get(sId);
    entry.transactions += 1;
    entry.totalSold = Number((entry.totalSold + Number(s.totalAmount || 0)).toFixed(2));
    (s.payments || []).forEach((p) => {
      const amt = Number(p.amount || 0);
      if (p.method === 'EFECTIVO') entry.cashCollected = Number((entry.cashCollected + amt).toFixed(2));
      else if (p.method === 'TARJETA') entry.cardCollected = Number((entry.cardCollected + amt).toFixed(2));
      else if (p.method === 'TRANSFERENCIA') entry.transferCollected = Number((entry.transferCollected + amt).toFixed(2));
    });
  });
  const sellerBreakdown = Array.from(sellerMap.values()).sort((a, b) => b.totalSold - a.totalSold);

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
    sellerBreakdown,
  };
}

/**
 * Lista las ventas de un evento con paginación y filtros nativos
 */
export async function getEventSalesList({ tenantId, eventId, date = null, page = 1, limit = 50 }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const isStand = Boolean(eventId && eventId !== 'evt-ventas-redes-online');
  const where = {
    status: { not: 'ANULADA' },
    ...(tenantId ? { tenantId } : {}),
  };

  if (date) {
    const { startOfDay, endOfDay } = getGuatemalaDayRange(date);
    if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
      if (isStand) {
        where.OR = [
          // 1. Ventas propias del stand creadas en esa fecha
          { eventId, createdAt: { gte: startOfDay, lte: endOfDay } },
          // 2. Pedidos remotos asignados a este stand con saldo pendiente (sin importar fecha de creación)
          { pickupEventId: eventId, balanceDue: { gt: 0 } },
          // 3. Pedidos remotos liquidados en este stand con pagos registrados en esa fecha
          {
            pickupEventId: eventId,
            payments: {
              some: {
                reference: { contains: '[SALDO]' },
                createdAt: { gte: startOfDay, lte: endOfDay },
              },
            },
          },
        ];
      } else {
        where.eventId = eventId;
        where.createdAt = { gte: startOfDay, lte: endOfDay };
      }
    }
  } else {
    if (isStand) {
      where.OR = [
        { eventId },
        { pickupEventId: eventId },
      ];
    } else {
      where.eventId = eventId;
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
