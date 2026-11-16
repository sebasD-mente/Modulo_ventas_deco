#!/usr/bin/env node
/**
 * scripts/reset-online-pos-test-data.js
 * Reinicia en 0 el Punto de Venta Digital (evt-ventas-redes-online) y clientes de prueba,
 * sin afectar las ferias físicas (POS_FERIA).
 *
 * Uso: node scripts/reset-online-pos-test-data.js --confirm
 */
import 'dotenv/config';
import { prisma } from '../server/config/prisma.js';
import { getSequenceName, invalidateSequenceCache } from '../server/services/sales/saleNumberGenerator.js';

const DIGITAL_EVENT_ID = 'evt-ventas-redes-online';

async function resetOnlinePosOnly(tenantId) {
  return await prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: DIGITAL_EVENT_ID, tenantId } });
    if (!event) throw new Error('Punto de Venta Digital no encontrado para esta organización.');

    // ESTRICTO: únicamente ventas del canal digital evt-ventas-redes-online (jamás POS_FERIA)
    const onlineWhere = {
      tenantId,
      eventId: DIGITAL_EVENT_ID,
    };

    const purgedSalesCount = await tx.sale.count({ where: onlineWhere });
    await tx.sale.deleteMany({ where: onlineWhere });

    const closingsResult = await tx.cashClosing.deleteMany({
      where: { tenantId, eventId: DIGITAL_EVENT_ID },
    });

    await tx.printSheet.deleteMany({ where: { tenantId, items: { none: {} } } });
    await tx.commissionSettlement.deleteMany({ where: { tenantId, sales: { none: {} } } });

    const custRes = await tx.customer.deleteMany({
      where: { tenantId, sales: { none: {} } },
    });
    const purgedCustomersCount = Number(custRes?.count || 0);

    await tx.event.update({ where: { id: DIGITAL_EVENT_ID }, data: { currentSaleSequence: 0 } });
    const seqName = getSequenceName(DIGITAL_EVENT_ID);
    await tx.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${seqName};`);
    invalidateSequenceCache(DIGITAL_EVENT_ID);

    await tx.auditLog.create({
      data: {
        tenantId,
        userId: null,
        action: 'VENTAS_REDES_PRUEBA_PURGADAS',
        entity: 'event',
        entityId: DIGITAL_EVENT_ID,
        details: {
          eventName: event.name,
          purgedSalesCount,
          purgedCustomersCount,
          purgedClosingsCount: Number(closingsResult?.count || 0),
          sequenceResetTo: 0,
        },
      },
    });

    return {
      eventName: event.name,
      purgedSalesCount,
      purgedCustomersCount,
      purgedClosingsCount: Number(closingsResult?.count || 0),
      currentSaleSequence: 0,
    };
  });
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('❌ Abortado: debes pasar --confirm para ejecutar la limpieza del Punto de Venta Digital.');
    process.exit(1);
  }

  const digitalEvents = await prisma.event.findMany({
    where: { id: DIGITAL_EVENT_ID },
    select: { id: true, tenantId: true, name: true },
  });

  if (digitalEvents.length === 0) {
    console.log('ℹ️ No se encontró ningún evento evt-ventas-redes-online.');
    return;
  }

  for (const ev of digitalEvents) {
    const result = await resetOnlinePosOnly(ev.tenantId);
    console.log(
      `✅ [${ev.tenantId}] "${result.eventName}" reiniciado en 0: ` +
      `${result.purgedSalesCount} ventas, ${result.purgedCustomersCount} clientes, ` +
      `${result.purgedClosingsCount} cierres eliminados; secuencia = ${result.currentSaleSequence}.`
    );
  }
}

main()
  .catch((err) => {
    console.error('❌ Error limpiando datos de Ventas en Línea:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
