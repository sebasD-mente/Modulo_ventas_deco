import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange } from './saleKpiService.js';

export async function getMonitorDashboardMetrics({ tenantId, date = null, eventId = null }) {
  const eventWhere = { tenantId };
  if (eventId) eventWhere.id = eventId;
  const events = await prisma.event.findMany({
    where: eventWhere,
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });

  const { targetDate, startOfDay, endOfDay } = getGuatemalaDayRange(date);
  const saleWhere = {
    tenantId,
    status: 'COMPLETADA',
    createdAt: { gte: startOfDay, lte: endOfDay },
  };
  if (eventId) saleWhere.eventId = eventId;
  const allSales = await prisma.sale.findMany({
    where: saleWhere,
    include: {
      payments: true,
      items: true,
      event: { select: { id: true, name: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const salesByEvent = {};
  allSales.forEach((sale) => {
    if (!salesByEvent[sale.eventId]) salesByEvent[sale.eventId] = [];
    salesByEvent[sale.eventId].push(sale);
  });

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
          time: new Date(evSales[0].createdAt).toLocaleTimeString('es-GT', {
            timeZone: 'America/Guatemala',
            hour: '2-digit',
            minute: '2-digit',
          }),
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
    date: targetDate,
    lastUpdated: new Date().toISOString(),
    eventDetails: eventDetails.filter((e) => e.status === 'ACTIVO' || e.transactions > 0),
    resumenGeneral: {
      totalTransactions: allSales.length,
      totalSold: Number(grandTotal.toFixed(2)),
      payments: globalPayments,
    },
  };
}
