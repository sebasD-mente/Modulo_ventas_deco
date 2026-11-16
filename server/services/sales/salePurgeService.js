import { prisma } from '../../config/prisma.js';
import { getSequenceName, invalidateSequenceCache } from './saleNumberGenerator.js';

async function cleanupOrphanPrintSheetsAndSettlements(tx, tenantId) {
  if (typeof tx.printSheet?.deleteMany === 'function') {
    await tx.printSheet.deleteMany({ where: { tenantId, items: { none: {} } } });
  }
  if (typeof tx.commissionSettlement?.deleteMany === 'function') {
    await tx.commissionSettlement.deleteMany({ where: { tenantId, sales: { none: {} } } });
  }
}

async function resetEventSequence(tx, eventId) {
  await tx.event.update({ where: { id: eventId }, data: { currentSaleSequence: 0 } });
  const seqName = getSequenceName(eventId);
  if (typeof tx.$executeRawUnsafe === 'function') {
    await tx.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${seqName};`);
  } else if (typeof tx.$queryRawUnsafe === 'function') {
    await tx.$queryRawUnsafe(`DROP SEQUENCE IF EXISTS ${seqName};`);
  }
  invalidateSequenceCache(eventId);
}

/**
 * Satélite para purga controlada de ventas de prueba y reseteo de secuencia.
 * Exclusivo para Super Admins cuando se inicia la operación real de un evento.
 */
export async function purgeEventSalesTransaction({ tenantId, eventId, userId }) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verificar existencia del evento
    const event = await tx.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      throw new Error('Evento no encontrado o no pertenece a esta organización.');
    }

    if (eventId === 'evt-ventas-redes-online') {
      const err = new Error('No está permitido purgar el canal permanente de Ventas en Línea / Redes.');
      err.statusCode = 403;
      throw err;
    }

    if (typeof tx.sale?.findFirst === 'function') {
      const settledSale = await tx.sale.findFirst({
        where: {
          tenantId,
          eventId,
          OR: [{ commissionPaid: true }, { commissionSettlementId: { not: null } }],
        },
        select: { id: true },
      });
      if (settledSale) {
        const err = new Error('No se pueden purgar las ventas de un evento que posee comisiones liquidadas.');
        err.statusCode = 409;
        throw err;
      }
    }

    // 2. Contar ventas existentes
    const salesCount = await tx.sale.count({
      where: { tenantId, eventId },
    });

    // 3. Eliminar ventas (Prisma aplica Cascade onDelete a SaleItem, SalePayment, SaleAttachment y ProductionLog)
    await tx.sale.deleteMany({
      where: { tenantId, eventId },
    });

    // 4. Eliminar cierres de caja de prueba si existían
    await tx.cashClosing.deleteMany({
      where: { tenantId, eventId },
    });

    // 4.1 Limpiar pliegos de taller y liquidaciones huérfanas
    await cleanupOrphanPrintSheetsAndSettlements(tx, tenantId);

    // 5 y 6. Resetear secuencia de ventas a 0 y limpiar caché
    await resetEventSequence(tx, eventId);

    // 7. Registro de auditoría inmutable
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'VENTAS_PRUEBA_PURGADAS',
        entity: 'event',
        entityId: eventId,
        details: {
          eventName: event.name,
          purgedSalesCount: salesCount,
          sequenceResetTo: 0,
        },
      },
    });

    return {
      eventName: event.name,
      purgedSalesCount: salesCount,
      currentSaleSequence: 0,
    };
  });
}

/**
 * Purga controlada de datos de prueba del Punto de Venta Digital (Ventas en Línea / Redes).
 * Deja en 0 ventas de redes, clientes huérfanos, liquidaciones de comisión huérfanas,
 * cierres de caja digitales, pliegos huérfanos y secuencia del canal digital.
 */
export async function purgeOnlinePosTestDataTransaction({ tenantId, userId = null }) {
  const digitalEventId = 'evt-ventas-redes-online';
  return await prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: digitalEventId, tenantId } });
    if (!event) throw new Error('Punto de Venta Digital no encontrado para esta organización.');

    const onlineWhere = {
      tenantId,
      OR: [{ eventId: digitalEventId }, { orderType: 'REDES_PERSONALIZADO' }],
    };

    const purgedSalesCount = await tx.sale.count({ where: onlineWhere });
    await tx.sale.deleteMany({ where: onlineWhere });

    const closingsResult = await tx.cashClosing.deleteMany({
      where: { tenantId, eventId: digitalEventId },
    });

    await cleanupOrphanPrintSheetsAndSettlements(tx, tenantId);

    let purgedCustomersCount = 0;
    if (typeof tx.customer?.deleteMany === 'function') {
      const custRes = await tx.customer.deleteMany({
        where: { tenantId, sales: { none: {} } },
      });
      purgedCustomersCount = Number(custRes?.count || 0);
    }

    await resetEventSequence(tx, digitalEventId);

    if (typeof tx.auditLog?.create === 'function') {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'VENTAS_REDES_PRUEBA_PURGADAS',
          entity: 'event',
          entityId: digitalEventId,
          details: {
            eventName: event.name,
            purgedSalesCount,
            purgedCustomersCount,
            purgedClosingsCount: Number(closingsResult?.count || 0),
            sequenceResetTo: 0,
          },
        },
      });
    }

    return {
      eventName: event.name,
      purgedSalesCount,
      purgedCustomersCount,
      purgedClosingsCount: Number(closingsResult?.count || 0),
      currentSaleSequence: 0,
    };
  });
}
