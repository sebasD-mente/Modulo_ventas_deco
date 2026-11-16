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
import { purgeOnlinePosTestDataTransaction } from '../server/services/sales/salePurgeService.js';

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('❌ Abortado: debes pasar --confirm para ejecutar la limpieza del Punto de Venta Digital.');
    process.exit(1);
  }

  const digitalEvents = await prisma.event.findMany({
    where: { id: 'evt-ventas-redes-online' },
    select: { id: true, tenantId: true, name: true },
  });

  if (digitalEvents.length === 0) {
    console.log('ℹ️ No se encontró ningún evento evt-ventas-redes-online.');
    return;
  }

  for (const ev of digitalEvents) {
    const result = await purgeOnlinePosTestDataTransaction({ tenantId: ev.tenantId, userId: null });
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
