import { prisma } from '../../config/prisma.js';
import { getSequenceName, invalidateSequenceCache } from './saleNumberGenerator.js';

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

    // 4.1 Limpiar pliegos de taller sin ítems (huérfanos tras borrar ventas)
    if (typeof tx.printSheet?.deleteMany === 'function') {
      await tx.printSheet.deleteMany({
        where: {
          tenantId,
          items: { none: {} },
        },
      });
    }

    // 4.2 Limpiar liquidaciones huérfanas sin ventas asociadas
    if (typeof tx.commissionSettlement?.deleteMany === 'function') {
      await tx.commissionSettlement.deleteMany({
        where: {
          tenantId,
          sales: { none: {} },
        },
      });
    }

    // 5. Resetear la secuencia de ventas del evento a 0 para que arranque desde FERI-0001
    await tx.event.update({
      where: { id: eventId },
      data: { currentSaleSequence: 0 },
    });

    // 6. Resetear secuencia nativa de PostgreSQL si existe y limpiar cache
    if (typeof tx.$executeRawUnsafe === 'function') {
      const seqName = getSequenceName(eventId);
      await tx.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${seqName};`);
      invalidateSequenceCache(eventId);
    } else if (typeof tx.$queryRawUnsafe === 'function') {
      const seqName = getSequenceName(eventId);
      await tx.$queryRawUnsafe(`DROP SEQUENCE IF EXISTS ${seqName};`);
      invalidateSequenceCache(eventId);
    } else {
      invalidateSequenceCache(eventId);
    }

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
