import { prisma } from '../../config/prisma.js';
import { getEventKPIs } from './saleKpiService.js';

/**
 * Genera un arqueo o cierre de caja diario
 */
export async function createCashClosingTransaction({
  tenantId,
  eventId,
  closedById,
  closingType = 'DIARIO',
  totalCashReported = 0,
  observations = null,
  date = null,
}) {
  const kpis = await getEventKPIs({ tenantId, eventId, date });

  const totalCashCalculated = kpis.paymentBreakdown.EFECTIVO.amount;
  const totalCard = kpis.paymentBreakdown.TARJETA.amount;
  const totalTransfer = kpis.paymentBreakdown.TRANSFERENCIA.amount;
  const cashDifference = Number((totalCashReported - totalCashCalculated).toFixed(2));

  const closing = await prisma.cashClosing.create({
    data: {
      tenantId,
      eventId,
      closedById,
      closingType,
      closingDate: date ? new Date(date) : new Date(),
      totalCashCalculated,
      totalCashReported,
      cashDifference,
      totalCard,
      totalTransfer,
      totalSalesCount: kpis.totalTransactions,
      grossTotal: kpis.totalAmount,
      observations,
      status: 'CONCILIADO',
    },
    include: {
      closedBy: { select: { fullName: true, email: true } },
      event: { select: { name: true } },
    },
  });

  return closing;
}
