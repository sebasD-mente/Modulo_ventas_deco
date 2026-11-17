import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange, getEventKPIs, shiftGuatemalaDateStr } from './saleKpiService.js';
import { createCashClosingTransaction } from './cashClosingService.js';

/**
 * Extrae fecha civil (YYYY-MM-DD), hora y minuto actuales en America/Guatemala (UTC-6).
 */
export function getGuatemalaClockParts(now = new Date()) {
  const dt = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = Number(map.hour === '24' ? 0 : map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  return { dateStr, hour, minute, second };
}

/**
 * Satélite de Auditoría y Cierre Automático de Jornada (11:59 PM CST y recuperación post-medianoche)
 *
 * - A las 23:59 CST (America/Guatemala), cierra automáticamente las jornadas del día actual que
 *   tengan ventas abiertas y ningún CashClosing registrado aún.
 * - En cualquier otro horario, concilia días anteriores (<= ayer) que hayan quedado sin cierre,
 *   incluyendo ventas rezagadas heredadas del post-cierre de D-1.
 */
export async function runMidnightClosingAudit(options = {}) {
  try {
    const now = options?.now ? new Date(options.now) : new Date();
    const { dateStr: todayStr, hour, minute } = getGuatemalaClockParts(now);
    const todayRange = getGuatemalaDayRange(todayStr);
    const isCutoff2359 = hour === 23 && minute === 59;
    const cutoffShiftDate = isCutoff2359 ? todayStr : shiftGuatemalaDateStr(todayStr, -1);

    const activeEvents = await prisma.event.findMany({
      where: { status: 'ACTIVO' },
      select: { id: true, name: true, tenantId: true },
    });

    const standEvents = (activeEvents || []).filter((e) => e.id !== 'evt-ventas-redes-online');
    if (standEvents.length === 0) {
      return { auditedEvents: 0, closingsCreated: 0 };
    }

    let closingsCreated = 0;

    for (const event of standEvents) {
      const candidateSales = await prisma.sale.findMany({
        where: {
          tenantId: event.tenantId,
          eventId: event.id,
          status: { not: 'ANULADA' },
          createdAt: isCutoff2359
            ? { lte: todayRange.endOfDay }
            : { lt: todayRange.startOfDay },
        },
        select: {
          id: true,
          createdAt: true,
          sellerId: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!candidateSales || candidateSales.length === 0) continue;

      const rawDates = new Set();
      for (const sale of candidateSales) {
        rawDates.add(getGuatemalaDayRange(sale.createdAt).targetDate);
      }

      const closingByDay = new Map();
      for (const rawDay of Array.from(rawDates).sort()) {
        const dayRange = getGuatemalaDayRange(rawDay);
        const closing = await prisma.cashClosing.findFirst({
          where: {
            tenantId: event.tenantId,
            eventId: event.id,
            closingDate: {
              gte: dayRange.startOfDay,
              lte: dayRange.endOfDay,
            },
          },
          orderBy: { closingDate: 'desc' },
        });
        closingByDay.set(rawDay, closing || null);
      }

      const candidateShiftDates = new Set();
      const firstSellerByShift = new Map();

      for (const sale of candidateSales) {
        const rawDay = getGuatemalaDayRange(sale.createdAt).targetDate;
        const rawClosing = closingByDay.get(rawDay);
        const rolledOver = Boolean(
          rawClosing?.closingDate &&
          new Date(sale.createdAt).getTime() > new Date(rawClosing.closingDate).getTime()
        );
        const effectiveShiftStr = rolledOver ? shiftGuatemalaDateStr(rawDay, 1) : rawDay;

        if (effectiveShiftStr <= cutoffShiftDate) {
          candidateShiftDates.add(effectiveShiftStr);
          if (!firstSellerByShift.has(effectiveShiftStr)) {
            firstSellerByShift.set(effectiveShiftStr, sale.sellerId);
          }
        }
      }

      for (const shiftDayStr of Array.from(candidateShiftDates).sort()) {
        const shiftRange = getGuatemalaDayRange(shiftDayStr);
        const existingClosing = closingByDay.has(shiftDayStr)
          ? closingByDay.get(shiftDayStr)
          : await prisma.cashClosing.findFirst({
              where: {
                tenantId: event.tenantId,
                eventId: event.id,
                closingDate: {
                  gte: shiftRange.startOfDay,
                  lte: shiftRange.endOfDay,
                },
              },
              orderBy: { closingDate: 'desc' },
            });

        if (!existingClosing) {
          let closedById = firstSellerByShift.get(shiftDayStr);
          if (!closedById) {
            const adminUser = await prisma.user.findFirst({
              where: {
                tenantId: event.tenantId,
                role: 'SUPER_ADMIN',
                status: 'ACTIVO',
              },
              select: { id: true },
            });
            closedById = adminUser?.id;
          }

          if (!closedById) {
            console.warn(`[MidnightClosing] No se encontró usuario para cerrar evento ${event.name} en ${shiftDayStr}`);
            continue;
          }

          const kpis = await getEventKPIs({
            tenantId: event.tenantId,
            eventId: event.id,
            date: shiftDayStr,
            forClosing: true,
            now,
          });

          if (kpis.totalTransactions > 0 || Number(kpis.totalCollected || 0) > 0) {
            const closingDateArg = isCutoff2359 && shiftDayStr === todayStr ? now : shiftDayStr;
            const createdClosing = await createCashClosingTransaction({
              tenantId: event.tenantId,
              eventId: event.id,
              closedById,
              closingType: 'AUTOMATICO_MEDIANOCHE',
              totalCashReported: 0,
              status: 'PENDIENTE_CONTEO_FISICO',
              observations: isCutoff2359 && shiftDayStr === todayStr
                ? '⚠️ Cierre automático de jornada a las 11:59 PM. Pendiente de arqueo físico por administración.'
                : '⚠️ Día sin cierre oficial. Pendiente de arqueo físico por administración.',
              date: closingDateArg,
            });
            closingByDay.set(shiftDayStr, createdClosing);

            console.log(
              `🔒 [MidnightClosing] Cierre automático generado para evento "${event.name}" (${shiftDayStr}) - Q ${kpis.totalAmount} (${kpis.totalTransactions} ventas)`
            );
            closingsCreated++;
          }
        }
      }
    }

    return { auditedEvents: standEvents.length, closingsCreated };
  } catch (err) {
    console.error('❌ [MidnightClosing] Error durante la auditoría de cierre de medianoche:', err);
    return { error: err.message };
  }
}
