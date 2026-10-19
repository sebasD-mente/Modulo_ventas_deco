import { prisma } from '../config/prisma.js';

export const EXPENSE_CATEGORIES = {
  ARRENDAMIENTO_STAND: 'Arrendamiento de Stand / Mesa / Espacio',
  PAGO_VENDEDOR: 'Pago Diario de Vendedor / Turnos',
  ALIMENTACION: 'Alimentación / Viáticos',
  TRANSPORTE_LOGISTICA: 'Transporte / Combustible / Parqueo / Montaje',
  PUBLICIDAD_OTROS: 'Publicidad / Imprevistos / Otros',
};

export const VALID_EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORIES);

/**
 * Función pura que calcula los KPIs financieros y el Radar del 20% para un evento.
 */
export function calculateEventFinancials({ event, cumulativeSold = 0, dailySold = 0, expenses = [] }) {
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const standRentCost = Number(
    safeExpenses
      .filter((e) => e.category === 'ARRENDAMIENTO_STAND')
      .reduce((acc, e) => acc + Number(e.amount || 0), 0)
      .toFixed(2)
  );
  const otherOperationalCost = Number(
    safeExpenses
      .filter((e) => e.category !== 'ARRENDAMIENTO_STAND')
      .reduce((acc, e) => acc + Number(e.amount || 0), 0)
      .toFixed(2)
  );
  const totalExpenses = Number((standRentCost + otherOperationalCost).toFixed(2));
  const totalEventSold = Number(Number(cumulativeSold || 0).toFixed(2));
  const preProductionBalance = Number((totalEventSold - totalExpenses).toFixed(2));

  // Regla de Oro del 20%: El arriendo del stand no debe superar el 20% de la venta total (Meta = Arriendo * 5)
  const healthySalesTarget20Pct = standRentCost > 0
    ? Number((standRentCost / 0.20).toFixed(2))
    : totalExpenses > 0
      ? totalExpenses
      : 0;

  // Peso porcentual del arriendo sobre la venta acumulada
  const standRentRatioPct = standRentCost > 0
    ? (totalEventSold > 0 ? Number(((standRentCost / totalEventSold) * 100).toFixed(1)) : 100)
    : 0;

  // Progreso hacia recuperación de gastos operativos (Piso de Supervivencia)
  const expenseRecoveryProgress = totalExpenses > 0
    ? Math.min(100, Math.round((totalEventSold / totalExpenses) * 100))
    : 0;

  // Progreso hacia la Meta Saludable del 20% (5x Arriendo)
  const targetToUse = Math.max(healthySalesTarget20Pct, totalExpenses);
  const healthyTargetProgress = targetToUse > 0
    ? Math.min(100, Math.round((totalEventSold / targetToUse) * 100))
    : 0;

  // Cálculo de días del evento y Run-Rate diario necesario
  const startMs = event?.startDate ? new Date(event.startDate).getTime() : Date.now();
  const endMs = event?.endDate ? new Date(event.endDate).getTime() : startMs;
  const diffDays = Math.max(1, Math.round(Math.abs(endMs - startMs) / 86400000) + 1);
  const requiredDailyRunRate = targetToUse > 0 ? Number((targetToUse / diffDays).toFixed(2)) : 0;
  const requiredDailyMediumPosters = requiredDailyRunRate > 0 ? Math.ceil(requiredDailyRunRate / 65) : 0;

  // Semáforo de 3 Fases
  let healthPhase = 'SIN_GASTOS'; // SIN_GASTOS | EN_RECUPERACION | GASTOS_CUBIERTOS_RUMBO_20 | EVENTO_SALUDABLE_20PCT
  if (totalExpenses > 0) {
    if (totalEventSold < totalExpenses) {
      healthPhase = 'EN_RECUPERACION';
    } else if (standRentCost > 0 && totalEventSold < healthySalesTarget20Pct) {
      healthPhase = 'GASTOS_CUBIERTOS_RUMBO_20';
    } else {
      healthPhase = 'EVENTO_SALUDABLE_20PCT';
    }
  }

  return {
    standRentCost,
    otherOperationalCost,
    totalExpenses,
    cumulativeSold: totalEventSold,
    dailySold: Number(Number(dailySold || 0).toFixed(2)),
    preProductionBalance,
    healthySalesTarget20Pct: targetToUse,
    standRentRatioPct,
    expenseRecoveryProgress,
    healthyTargetProgress,
    totalEventDays: diffDays,
    requiredDailyRunRate,
    requiredDailyMediumPosters,
    remainingForExpenseRecovery: Number(Math.max(0, totalExpenses - totalEventSold).toFixed(2)),
    remainingForHealthyTarget: Number(Math.max(0, targetToUse - totalEventSold).toFixed(2)),
    healthPhase,
    expensesCount: safeExpenses.length,
    expenses: safeExpenses,
  };
}

/**
 * Lista los gastos de un evento con su resumen financiero.
 */
export async function listEventExpenses({ tenantId, eventId }) {
  if (!tenantId || !eventId) {
    throw new Error('tenantId y eventId son obligatorios.');
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!event) {
    throw new Error('El evento no existe o no pertenece al tenant.');
  }

  const expenses = (prisma.eventExpense && typeof prisma.eventExpense.findMany === 'function')
    ? await prisma.eventExpense.findMany({
        where: { tenantId, eventId },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      })
    : [];

  const salesAgg = await prisma.sale.aggregate({
    where: { tenantId, eventId, status: { not: 'ANULADA' } },
    _sum: { totalAmount: true },
  });

  const cumulativeSold = Number(salesAgg._sum?.totalAmount || 0);
  const financials = calculateEventFinancials({ event, cumulativeSold, expenses });

  return {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
    },
    expenses,
    financials,
  };
}

/**
 * Agrega un nuevo gasto a un evento.
 */
export async function addEventExpense({
  tenantId,
  eventId,
  category = 'PUBLICIDAD_OTROS',
  description,
  amount,
  expenseDate,
  createdById,
}) {
  if (!tenantId || !eventId) {
    throw new Error('tenantId y eventId son requeridos.');
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('El monto del gasto debe ser un número mayor a 0.');
  }

  if (!description || !description.trim()) {
    throw new Error('La descripción del gasto es obligatoria.');
  }

  const normalizedCategory = VALID_EXPENSE_CATEGORIES.includes(category)
    ? category
    : 'PUBLICIDAD_OTROS';

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
  });

  if (!event) {
    throw new Error('El evento no existe o no pertenece al tenant.');
  }

  if (!prisma.eventExpense || typeof prisma.eventExpense.create !== 'function') {
    throw new Error('El modelo EventExpense no está disponible en este entorno.');
  }

  const newExpense = await prisma.eventExpense.create({
    data: {
      tenantId,
      eventId,
      category: normalizedCategory,
      description: description.trim(),
      amount: numericAmount,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdById: createdById || null,
    },
  });

  const updatedFinancials = await listEventExpenses({ tenantId, eventId });

  return {
    expense: newExpense,
    financials: updatedFinancials.financials,
  };
}

/**
 * Elimina un gasto de un evento verificando pertenencia.
 */
export async function deleteEventExpense({ tenantId, eventId, expenseId }) {
  if (!tenantId || !eventId || !expenseId) {
    throw new Error('tenantId, eventId y expenseId son obligatorios.');
  }

  if (!prisma.eventExpense || typeof prisma.eventExpense.findFirst !== 'function') {
    throw new Error('El modelo EventExpense no está disponible en este entorno.');
  }

  const existing = await prisma.eventExpense.findFirst({
    where: { id: expenseId, eventId, tenantId },
  });

  if (!existing) {
    throw new Error('El gasto no fue encontrado o no pertenece a este evento.');
  }

  await prisma.eventExpense.delete({
    where: { id: expenseId },
  });

  const updated = await listEventExpenses({ tenantId, eventId });

  return {
    deletedId: expenseId,
    financials: updated.financials,
  };
}
