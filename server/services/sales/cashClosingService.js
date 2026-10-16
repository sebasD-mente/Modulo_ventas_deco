import { prisma } from '../../config/prisma.js';
import { getEventKPIs, getGuatemalaDayRange } from './saleKpiService.js';

/**
 * Genera un arqueo o cierre de caja diario con control de unicidad por jornada,
 * cálculo de fondo inicial / gastos / retiros parciales y registro de auditoría.
 */
export async function createCashClosingTransaction({
  tenantId,
  eventId,
  closedById,
  closingType = 'DIARIO',
  totalCashReported = 0,
  openingCashFloat = 0,
  pettyCashExpenses = 0,
  cashDrops = 0,
  observations = null,
  date = null,
  status = 'CONCILIADO',
  idempotencyKey = null,
}) {
  const { targetDate, startOfDay, endOfDay } = getGuatemalaDayRange(date);

  if (closingType === 'DIARIO' && typeof prisma.cashClosing?.findFirst === 'function') {
    const existingDaily = await prisma.cashClosing.findFirst({
      where: {
        tenantId,
        eventId,
        closingType: 'DIARIO',
        closingDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        closedBy: { select: { fullName: true, email: true } },
        event: { select: { name: true } },
      },
    });

    if (existingDaily) {
      if (
        idempotencyKey &&
        (existingDaily.observations?.includes(idempotencyKey) ||
          Math.abs(Number(existingDaily.totalCashReported) - Number(totalCashReported)) < 0.01)
      ) {
        return { ...existingDaily, idempotentReplay: true };
      }
      const err = new Error(`Ya existe un cierre de caja diario registrado para esta jornada (${targetDate}).`);
      err.statusCode = 409;
      throw err;
    }
  }

  const kpis = await getEventKPIs({ tenantId, eventId, date: date ? targetDate : null });

  const salesCash = Number(kpis.paymentBreakdown.EFECTIVO.amount || 0);
  const floatAmt = Math.max(0, Number(openingCashFloat || 0));
  const expensesAmt = Math.max(0, Number(pettyCashExpenses || 0));
  const dropsAmt = Math.max(0, Number(cashDrops || 0));
  const totalCashCalculated = Number(Math.max(0, salesCash + floatAmt - expensesAmt - dropsAmt).toFixed(2));
  const totalCard = kpis.paymentBreakdown.TARJETA.amount;
  const totalTransfer = kpis.paymentBreakdown.TRANSFERENCIA.amount;
  const cashDifference = Number((totalCashReported - totalCashCalculated).toFixed(2));

  const extraNotes = [];
  if (floatAmt > 0) extraNotes.push(`Fondo inicial: Q${floatAmt.toFixed(2)}`);
  if (expensesAmt > 0) extraNotes.push(`Gastos caja chica: Q${expensesAmt.toFixed(2)}`);
  if (dropsAmt > 0) extraNotes.push(`Retiros parciales: Q${dropsAmt.toFixed(2)}`);
  const finalObservations = extraNotes.length > 0
    ? [observations, `[${extraNotes.join(' | ')}]`].filter(Boolean).join(' ')
    : observations;

  const closingDateValue = date instanceof Date
    ? date
    : date
      ? endOfDay
      : new Date();

  const closing = await prisma.cashClosing.create({
    data: {
      tenantId,
      eventId,
      closedById,
      closingType,
      closingDate: closingDateValue,
      totalCashCalculated,
      totalCashReported,
      cashDifference,
      totalCard,
      totalTransfer,
      totalSalesCount: kpis.totalTransactions,
      grossTotal: kpis.totalAmount,
      observations: finalObservations,
      status,
    },
    include: {
      closedBy: { select: { fullName: true, email: true } },
      event: { select: { name: true } },
    },
  });

  if (typeof prisma.auditLog?.create === 'function') {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: closedById,
        action: 'CIERRE_CAJA_REGISTRADO',
        entity: 'cashClosing',
        entityId: closing.id,
        details: {
          eventId,
          closingType,
          targetDate,
          totalCashCalculated,
          totalCashReported,
          cashDifference,
          openingCashFloat: floatAmt,
          pettyCashExpenses: expensesAmt,
          cashDrops: dropsAmt,
          status,
        },
      },
    });
  }

  return closing;
}
