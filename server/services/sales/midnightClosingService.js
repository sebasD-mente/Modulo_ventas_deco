import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange, getEventKPIs } from './saleKpiService.js';
import { createCashClosingTransaction } from './cashClosingService.js';

/**
 * Satélite de Auditoría y Cierre Automático de Medianoche
 *
 * Revisa eventos activos para detectar jornadas finalizadas sin arqueo oficial de caja.
 * Si un día anterior tuvo ventas y no se realizó el cierre manual antes de la medianoche CST,
 * el sistema genera automáticamente un cierre contable de emergencia con advertencia:
 * "⚠️ Día sin cierre oficial. Conciliación automática del sistema a medianoche."
 */
export async function runMidnightClosingAudit() {
  try {
    const todayRange = getGuatemalaDayRange();
    const todayStr = todayRange.targetDate;

    // 1. Obtener todos los eventos activos
    const activeEvents = await prisma.event.findMany({
      where: { status: 'ACTIVO' },
      select: { id: true, name: true, tenantId: true },
    });

    if (!activeEvents || activeEvents.length === 0) {
      return { auditedEvents: 0, closingsCreated: 0 };
    }

    let closingsCreated = 0;

    for (const event of activeEvents) {
      // 2. Buscar ventas válidas del evento creadas antes del inicio del día de hoy
      const pastSales = await prisma.sale.findMany({
        where: {
          tenantId: event.tenantId,
          eventId: event.id,
          status: { not: 'ANULADA' },
          createdAt: {
            lt: todayRange.startOfDay,
          },
        },
        select: {
          id: true,
          createdAt: true,
          sellerId: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (pastSales.length === 0) continue;

      // 3. Agrupar ventas pasadas por fecha civil de Guatemala (YYYY-MM-DD)
      const datesWithSales = new Set();
      const firstSellerByDate = new Map();

      for (const sale of pastSales) {
        const saleDayStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Guatemala',
        }).format(new Date(sale.createdAt));

        datesWithSales.add(saleDayStr);
        if (!firstSellerByDate.has(saleDayStr)) {
          firstSellerByDate.set(saleDayStr, sale.sellerId);
        }
      }

      // 4. Para cada fecha civil pasada, verificar si ya tiene arqueo
      for (const dayStr of datesWithSales) {
        const dayRange = getGuatemalaDayRange(dayStr);

        const existingClosing = await prisma.cashClosing.findFirst({
          where: {
            tenantId: event.tenantId,
            eventId: event.id,
            closingDate: {
              gte: dayRange.startOfDay,
              lte: dayRange.endOfDay,
            },
          },
        });

        if (!existingClosing) {
          // 5. Determinar usuario responsable del cierre
          let closedById = firstSellerByDate.get(dayStr);
          if (!closedById) {
            const adminUser = await prisma.user.findFirst({
              where: {
                tenantId: event.tenantId,
                role: 'SUPER_ADMIN',
                isActive: true,
              },
              select: { id: true },
            });
            closedById = adminUser?.id;
          }

          if (!closedById) {
            console.warn(`[MidnightClosing] No se encontró usuario para cerrar evento ${event.name} en ${dayStr}`);
            continue;
          }

          // 6. Obtener KPIs de esa fecha y generar cierre automático
          const kpis = await getEventKPIs({
            tenantId: event.tenantId,
            eventId: event.id,
            date: dayStr,
          });

          if (kpis.totalTransactions > 0) {
            const totalCash = kpis.paymentBreakdown.EFECTIVO.amount;

            await createCashClosingTransaction({
              tenantId: event.tenantId,
              eventId: event.id,
              closedById,
              closingType: 'AUTOMATICO_MEDIANOCHE',
              totalCashReported: totalCash,
              observations: '⚠️ Día sin cierre oficial. Conciliación automática del sistema a medianoche.',
              date: dayRange.endOfDay, // Registrar al final de la jornada
            });

            console.log(
              `🔒 [MidnightClosing] Cierre automático generado para evento "${event.name}" (${dayStr}) - Q ${kpis.totalAmount} (${kpis.totalTransactions} ventas)`
            );
            closingsCreated++;
          }
        }
      }
    }

    return { auditedEvents: activeEvents.length, closingsCreated };
  } catch (err) {
    console.error('❌ [MidnightClosing] Error durante la auditoría de cierre de medianoche:', err);
    return { error: err.message };
  }
}
