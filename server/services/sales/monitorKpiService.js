import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange } from './saleKpiService.js';
import { calculateEventFinancials } from '../eventFinanceService.js';

const SELLER_SELECT = {
  id: true, fullName: true, email: true, role: true, roles: true, avatarUrl: true,
};

export async function getMonitorDashboardMetrics({ tenantId, date = null, eventId = null }) {
  const eventWhere = { tenantId };
  if (eventId && eventId !== 'none') eventWhere.id = eventId;

  const events = await prisma.event.findMany({
    where: eventWhere,
    include: {
      assignedSellers: { select: SELLER_SELECT },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });

  const { targetDate, startOfDay, endOfDay } = getGuatemalaDayRange(date);
  const saleWhere = {
    tenantId,
    status: { not: 'ANULADA' },
    createdAt: { gte: startOfDay, lte: endOfDay },
  };
  if (eventId && eventId !== 'none') saleWhere.eventId = eventId;

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

  // Ventas acumuladas de todos los tiempos por evento para el Radar del 20%
  const cumulativeSalesByEvent = new Map();
  try {
    const cumulativeAgg = await prisma.sale.groupBy({
      by: ['eventId'],
      where: { tenantId, status: { not: 'ANULADA' }, createdAt: { lte: endOfDay } },
      _sum: { totalAmount: true },
    });
    cumulativeAgg.forEach((row) => {
      if (row.eventId) {
        cumulativeSalesByEvent.set(row.eventId, Number(row._sum?.totalAmount || 0));
      }
    });
  } catch (_aggErr) {
    // Fallback silencioso para entornos de prueba
  }

  // Gastos registrados por evento
  const expensesByEvent = new Map();
  try {
    if (prisma.eventExpense && typeof prisma.eventExpense.findMany === 'function') {
      const expenses = await prisma.eventExpense.findMany({
        where: { tenantId },
      });
      expenses.forEach((exp) => {
        if (!expensesByEvent.has(exp.eventId)) {
          expensesByEvent.set(exp.eventId, []);
        }
        expensesByEvent.get(exp.eventId).push(exp);
      });
    }
  } catch (_expErr) {
    // Fallback silencioso
  }

  const eventDetails = events.map((ev) => {
    const evSales = salesByEvent[ev.id] || [];
    let evTotal = 0;
    const payments = {
      TARJETA: { amount: 0, count: 0, percentage: 0 },
      TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
      EFECTIVO: { amount: 0, count: 0, percentage: 0 },
      OTRO: { amount: 0, count: 0, percentage: 0 },
    };

    evSales.forEach((s) => {
      evTotal += Number(s.totalAmount);
      s.payments.forEach((p) => {
        const m = payments[p.method] ? p.method : 'OTRO';
        payments[m].amount = Number((payments[m].amount + Number(p.amount)).toFixed(2));
        payments[m].count += 1;
      });
    });

    evTotal = Number(evTotal.toFixed(2));
    const evCollected = Number(
      (payments.TARJETA.amount + payments.TRANSFERENCIA.amount + payments.EFECTIVO.amount + payments.OTRO.amount).toFixed(2)
    );
    const evPendingBalance = Number(Math.max(0, Number((evTotal - evCollected).toFixed(2))).toFixed(2));

    if (evCollected > 0) {
      payments.TARJETA.percentage = Number(((payments.TARJETA.amount / evCollected) * 100).toFixed(1));
      payments.TRANSFERENCIA.percentage = Number(((payments.TRANSFERENCIA.amount / evCollected) * 100).toFixed(1));
      payments.EFECTIVO.percentage = Number(((payments.EFECTIVO.amount / evCollected) * 100).toFixed(1));
      payments.OTRO.percentage = Number(((payments.OTRO.amount / evCollected) * 100).toFixed(1));
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

    const evCumulativeSold = cumulativeSalesByEvent.has(ev.id)
      ? cumulativeSalesByEvent.get(ev.id)
      : evTotal;
    const evExpenses = expensesByEvent.get(ev.id) || [];
    const financials = calculateEventFinancials({
      event: ev,
      cumulativeSold: evCumulativeSold,
      dailySold: evTotal,
      expenses: evExpenses,
    });

    return {
      eventId: ev.id,
      name: ev.name,
      location: ev.location,
      status: ev.status,
      startDate: ev.startDate,
      endDate: ev.endDate,
      assignedSellerName: ev.assignedSellerName,
      assignedSellerEmail: ev.assignedSellerEmail,
      assignedSellers: ev.assignedSellers || [],
      transactions: evSales.length,
      totalSold: evTotal,
      totalCollected: evCollected,
      pendingBalanceTotal: evPendingBalance,
      cumulativeSold: Number(evCumulativeSold.toFixed(2)),
      financials,
      lastSale,
      payments,
    };
  });

  let grandTotal = 0;
  const globalPayments = {
    TARJETA: { amount: 0, count: 0, percentage: 0 },
    TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
    EFECTIVO: { amount: 0, count: 0, percentage: 0 },
    OTRO: { amount: 0, count: 0, percentage: 0 },
  };

  allSales.forEach((s) => {
    grandTotal += Number(s.totalAmount);
    s.payments.forEach((p) => {
      const m = globalPayments[p.method] ? p.method : 'OTRO';
      globalPayments[m].amount = Number((globalPayments[m].amount + Number(p.amount)).toFixed(2));
      globalPayments[m].count += 1;
    });
  });

  grandTotal = Number(grandTotal.toFixed(2));
  const grandCollected = Number(
    (globalPayments.TARJETA.amount + globalPayments.TRANSFERENCIA.amount + globalPayments.EFECTIVO.amount + globalPayments.OTRO.amount).toFixed(2)
  );
  const grandPendingBalance = Number(Math.max(0, Number((grandTotal - grandCollected).toFixed(2))).toFixed(2));

  if (grandCollected > 0) {
    globalPayments.TARJETA.percentage = Number(((globalPayments.TARJETA.amount / grandCollected) * 100).toFixed(1));
    globalPayments.TRANSFERENCIA.percentage = Number(((globalPayments.TRANSFERENCIA.amount / grandCollected) * 100).toFixed(1));
    globalPayments.EFECTIVO.percentage = Number(((globalPayments.EFECTIVO.amount / grandCollected) * 100).toFixed(1));
    globalPayments.OTRO.percentage = Number(((globalPayments.OTRO.amount / grandCollected) * 100).toFixed(1));
  }

  // Consolidado Financiero Global de Stands Activos
  const activePhysicalEvents = eventDetails.filter(
    (e) => e.status === 'ACTIVO' && e.eventId !== 'evt-ventas-redes-online'
  );
  const eventsForGlobal = activePhysicalEvents.length > 0
    ? activePhysicalEvents
    : eventDetails.filter((e) => e.status === 'ACTIVO' || (e.financials?.totalExpenses || 0) > 0);

  const globalFinancials = eventsForGlobal.reduce(
    (acc, ev) => {
      const f = ev.financials || {};
      acc.standRentCost = Number((acc.standRentCost + (f.standRentCost || 0)).toFixed(2));
      acc.otherOperationalCost = Number((acc.otherOperationalCost + (f.otherOperationalCost || 0)).toFixed(2));
      acc.totalExpenses = Number((acc.totalExpenses + (f.totalExpenses || 0)).toFixed(2));
      acc.cumulativeSold = Number((acc.cumulativeSold + (f.cumulativeSold || 0)).toFixed(2));
      acc.dailySold = Number((acc.dailySold + (f.dailySold || 0)).toFixed(2));
      acc.preProductionBalance = Number((acc.preProductionBalance + (f.preProductionBalance || 0)).toFixed(2));
      acc.healthySalesTarget20Pct = Number((acc.healthySalesTarget20Pct + (f.healthySalesTarget20Pct || 0)).toFixed(2));
      acc.totalEventDays = Math.max(acc.totalEventDays, Number(f.totalEventDays || 1));
      acc.requiredDailyRunRate = Number((acc.requiredDailyRunRate + (f.requiredDailyRunRate || 0)).toFixed(2));
      acc.requiredDailyMediumPosters += Number(f.requiredDailyMediumPosters || 0);
      return acc;
    },
    {
      standRentCost: 0,
      otherOperationalCost: 0,
      totalExpenses: 0,
      cumulativeSold: 0,
      dailySold: 0,
      preProductionBalance: 0,
      healthySalesTarget20Pct: 0,
      totalEventDays: 1,
      requiredDailyRunRate: 0,
      requiredDailyMediumPosters: 0,
    }
  );

  globalFinancials.standRentRatioPct = globalFinancials.standRentCost > 0
    ? (globalFinancials.cumulativeSold > 0
        ? Number(((globalFinancials.standRentCost / globalFinancials.cumulativeSold) * 100).toFixed(1))
        : 100)
    : 0;
  globalFinancials.expenseRecoveryProgress = globalFinancials.totalExpenses > 0
    ? Math.min(100, Math.round((globalFinancials.cumulativeSold / globalFinancials.totalExpenses) * 100))
    : 0;
  globalFinancials.healthyTargetProgress = globalFinancials.healthySalesTarget20Pct > 0
    ? Math.min(100, Math.round((globalFinancials.cumulativeSold / globalFinancials.healthySalesTarget20Pct) * 100))
    : 0;
  globalFinancials.remainingForExpenseRecovery = Number(
    Math.max(0, globalFinancials.totalExpenses - globalFinancials.cumulativeSold).toFixed(2)
  );
  globalFinancials.remainingForHealthyTarget = Number(
    Math.max(0, globalFinancials.healthySalesTarget20Pct - globalFinancials.cumulativeSold).toFixed(2)
  );

  let globalHealthPhase = 'SIN_GASTOS';
  if (globalFinancials.totalExpenses > 0) {
    if (globalFinancials.cumulativeSold < globalFinancials.totalExpenses) {
      globalHealthPhase = 'EN_RECUPERACION';
    } else if (globalFinancials.standRentCost > 0 && globalFinancials.cumulativeSold < globalFinancials.healthySalesTarget20Pct) {
      globalHealthPhase = 'GASTOS_CUBIERTOS_RUMBO_20';
    } else {
      globalHealthPhase = 'EVENTO_SALUDABLE_20PCT';
    }
  }
  globalFinancials.healthPhase = globalHealthPhase;

  return {
    date: targetDate,
    lastUpdated: new Date().toISOString(),
    eventDetails: eventDetails.filter(
      (e) => e.status === 'ACTIVO' || e.transactions > 0 || (e.financials?.totalExpenses || 0) > 0
    ),
    resumenGeneral: {
      totalTransactions: allSales.length,
      totalSold: grandTotal,
      totalCollected: grandCollected,
      pendingBalanceTotal: grandPendingBalance,
      payments: globalPayments,
      globalFinancials,
    },
  };
}
