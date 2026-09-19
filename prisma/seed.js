import { PrismaClient } from '@prisma/client';
import { syncCatalogFromWeb } from '../server/services/catalogSyncService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [Seed Zero-Trust] Verificando datos maestros oficiales...');

  // 1. Tenant Oficial: Deco Vintage Guate
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'deco-vintage-guate' },
    update: {},
    create: {
      name: 'Deco Vintage Guate',
      slug: 'deco-vintage-guate',
      currency: 'GTQ',
      currencySymbol: 'Q',
      settings: {
        theme: 'dark-amber',
        primaryColor: '#F59E0B',
        enableMultiQR: true,
        enableVoiceAssistant: true,
      },
    },
  });

  console.log(`✅ Tenant oficial verificado: ${tenant.name} (${tenant.id})`);

  // 2. Evento Virtual Permanente: Ventas en Línea y Redes Sociales
  const virtualEvent = await prisma.event.upsert({
    where: { id: 'evt-ventas-redes-online' },
    update: {},
    create: {
      id: 'evt-ventas-redes-online',
      tenantId: tenant.id,
      name: 'Ventas en Línea y Redes Sociales',
      location: 'Canal Digital (WhatsApp / IG / FB)',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2030-12-31'),
      status: 'ACTIVO',
    },
  });

  console.log(`✅ Evento virtual permanente verificado: ${virtualEvent.name} (${virtualEvent.id})`);

  // 3. Erradicación definitiva de eventos mock (ej. Comic Con Guatemala 2026)
  try {
    const deletedMocks = await prisma.event.deleteMany({
      where: {
        tenantId: tenant.id,
        name: { in: ['Comic Con Guatemala 2026', 'Comic Con 2026'] },
        sales: { none: {} },
        cashClosings: { none: {} },
      },
    });
    if (deletedMocks.count > 0) {
      console.log(`🧹 [Seed Zero-Trust] Purgados ${deletedMocks.count} eventos mock residuales.`);
    }
  } catch (err) {
    console.warn('⚠️ [Seed] Verificación de eventos mock:', err.message);
  }

  // 4. Catálogo real
  if (process.env.SKIP_WEB_SYNC === 'true') {
    console.log('⚡ [Seed] SKIP_WEB_SYNC activo: Verificación ligera completada. El catálogo se sincroniza reactivamente en background.');
  } else {
    console.log('🔄 Sincronizando catálogo oficial desde tienda web...');
    try {
      const syncRes = await syncCatalogFromWeb(tenant.id);
      console.log(`✅ Sincronización web finalizada: ${syncRes.count} pósters verificados.`);
    } catch (syncErr) {
      console.warn('⚠️ Sincronización web en seed arrojó advertencia:', syncErr.message);
    }
  }

  console.log('🎉 Inicialización de base de datos completada sin datos ficticios.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
