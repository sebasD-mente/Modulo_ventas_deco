import { prisma } from '../../config/prisma.js';

/**
 * Obtiene métricas y KPIs en tiempo real de un evento utilizando agregaciones nativas de PostgreSQL en O(1)
 */
export async function getEventKPIs(params, fallbackTenantId = null) {
  let tenantId = null;
  let eventId = null;
  let date = null;

  if (typeof params === 'string') {
    eventId = params;
    tenantId = fallbackTenantId;
  } else if (params && typeof params === 'object') {
    tenantId = params.tenantId || fallbackTenantId || null;
    eventId = params.eventId || null;
    date = params.date || null;
  }

  const saleWhere = {
    status: { not: 'ANULADA' },
  };

  if (eventId) {
    saleWhere.eventId = eventId;
  }
  if (tenantId) {
    saleWhere.tenantId = tenantId;
  }

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    saleWhere.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  // Agregaciones y agrupaciones nativas en PostgreSQL ejecutadas concurrentemente con Promise.all
  const [
    salesAggregate,
    unitsAggregate,
    paymentsGroup,
    topProductsGroup,
    recentSales,
    eventRecord,
  ] = await Promise.all([
    // 1. Total monetario y conteo de transacciones (SQL SUM(totalAmount), COUNT(id))
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    }),

    // 2. Sumatoria nativa de unidades vendidas (SQL SUM(quantity))
    prisma.saleItem.aggregate({
      where: { sale: saleWhere },
      _sum: { quantity: true },
    }),

    // 3. Agrupación nativa por método de pago (SQL GROUP BY method)
    prisma.salePayment.groupBy({
      by: ['method'],
      where: { sale: saleWhere },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // 4. Top productos más vendidos nativo (SQL GROUP BY description ORDER BY SUM DESC LIMIT 10)
    prisma.saleItem.groupBy({
      by: ['description'],
      where: { sale: saleWhere },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),

    // 5. Últimas 15 ventas del evento con sus relaciones
    prisma.sale.findMany({
      where: saleWhere,
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: true,
        payments: true,
        items: true,
      },
    }),

    // 6. Metadata del evento (si eventId fue proporcionado)
    eventId
      ? prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, name: true, location: true, status: true, startDate: true, endDate: true },
        })
      : Promise.resolve(null),
  ]);

  const totalTransactions = salesAggregate._count?.id || 0;
  const totalAmount = Number(Number(salesAggregate._sum?.totalAmount || 0).toFixed(2));
  const totalUnits = unitsAggregate._sum?.quantity || 0;
  const averageTicket = totalTransactions > 0
    ? Number((totalAmount / totalTransactions).toFixed(2))
    : 0;

  // Reconstrucción del desglose de pagos para frontend y cierres de caja
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

    if (paymentBreakdown[method]) {
      paymentBreakdown[method].count += count;
      paymentBreakdown[method].amount = Number((paymentBreakdown[method].amount + amount).toFixed(2));
    } else {
      paymentBreakdown.OTRO.count += count;
      paymentBreakdown.OTRO.amount = Number((paymentBreakdown.OTRO.amount + amount).toFixed(2));
    }
  });

  const topProducts = topProductsGroup.map((item) => ({
    name: item.description,
    productName: item.description,
    quantity: item._sum?.quantity || 0,
  }));

  return {
    eventId,
    event: eventRecord || (eventId ? { id: eventId } : null),
    date,
    totalTransactions,
    totalAmount,
    totalRevenue: totalAmount,
    totalUnits,
    totalItemsSold: totalUnits,
    averageTicket,
    paymentBreakdown,
    topProducts,
    recentSales,
  };
}

/**
 * Obtiene métricas consolidadas en tiempo real para el Monitor de Ventas de Gerencia
 */
export async function getMonitorDashboardMetrics({ tenantId, date = null }) {
  // 1. Obtener todos los eventos del negocio (priorizando activos)
  const events = await prisma.event.findMany({
    where: { tenantId },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });

  // 2. Filtro de fecha para las ventas
  const salesWhere = {
    tenantId,
    status: 'COMPLETADA',
  };

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    salesWhere.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  const allSales = await prisma.sale.findMany({
    where: salesWhere,
    include: {
      payments: true,
      items: true,
      event: { select: { id: true, name: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Agrupar ventas por ID de evento
  const salesByEvent = {};
  allSales.forEach((sale) => {
    if (!salesByEvent[sale.eventId]) {
      salesByEvent[sale.eventId] = [];
    }
    salesByEvent[sale.eventId].push(sale);
  });

  // 3. Procesar detalle por evento
  const eventDetails = events.map((ev) => {
    const evSales = salesByEvent[ev.id] || [];
    let evTotal = 0;
    const payments = {
      TARJETA: { amount: 0, count: 0, percentage: 0 },
      TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
      EFECTIVO: { amount: 0, count: 0, percentage: 0 },
    };

    evSales.forEach((s) => {
      evTotal += Number(s.totalAmount);
      s.payments.forEach((p) => {
        const m = p.method === 'TARJETA' ? 'TARJETA' : p.method === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO';
        payments[m].amount += Number(p.amount);
        payments[m].count += 1;
      });
    });

    if (evTotal > 0) {
      payments.TARJETA.percentage = Number(((payments.TARJETA.amount / evTotal) * 100).toFixed(1));
      payments.TRANSFERENCIA.percentage = Number(((payments.TRANSFERENCIA.amount / evTotal) * 100).toFixed(1));
      payments.EFECTIVO.percentage = Number(((payments.EFECTIVO.amount / evTotal) * 100).toFixed(1));
    }

    const lastSale = evSales[0]
      ? {
          amount: Number(evSales[0].totalAmount),
          time: new Date(evSales[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      : null;

    return {
      eventId: ev.id,
      name: ev.name,
      location: ev.location,
      status: ev.status,
      assignedSellerName: ev.assignedSellerName,
      assignedSellerEmail: ev.assignedSellerEmail,
      transactions: evSales.length,
      totalSold: Number(evTotal.toFixed(2)),
      lastSale,
      payments,
    };
  });

  // 4. Procesar Resumen General de la Jornada
  let grandTotal = 0;
  const globalPayments = {
    TARJETA: { amount: 0, count: 0, percentage: 0 },
    TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
    EFECTIVO: { amount: 0, count: 0, percentage: 0 },
  };

  allSales.forEach((s) => {
    grandTotal += Number(s.totalAmount);
    s.payments.forEach((p) => {
      const m = p.method === 'TARJETA' ? 'TARJETA' : p.method === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO';
      globalPayments[m].amount += Number(p.amount);
      globalPayments[m].count += 1;
    });
  });

  if (grandTotal > 0) {
    globalPayments.TARJETA.percentage = Number(((globalPayments.TARJETA.amount / grandTotal) * 100).toFixed(1));
    globalPayments.TRANSFERENCIA.percentage = Number(((globalPayments.TRANSFERENCIA.amount / grandTotal) * 100).toFixed(1));
    globalPayments.EFECTIVO.percentage = Number(((globalPayments.EFECTIVO.amount / grandTotal) * 100).toFixed(1));
  }

  return {
    date: date || new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    eventDetails: eventDetails.filter((e) => e.status === 'ACTIVO' || e.transactions > 0),
    resumenGeneral: {
      totalTransactions: allSales.length,
      totalSold: Number(grandTotal.toFixed(2)),
      payments: globalPayments,
    },
  };
}

/**
 * Lista las ventas de un evento con paginación y filtros nativos
 */
export async function getEventSalesList({
  tenantId,
  eventId,
  date = null,
  page = 1,
  limit = 50,
}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    eventId,
  };
  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    where.createdAt = { gte: startOfDay, lte: endOfDay };
  }

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        items: true,
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
