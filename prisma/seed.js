import { PrismaClient } from '@prisma/client';
import { syncCatalogFromWeb } from '../server/services/catalogSyncService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos maestros para Deko EventSales...');

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

  console.log(`✅ Tenant verificado: ${tenant.name} (${tenant.id})`);

  // 2. Evento Inicial: Comic Con Guatemala 2026
  let activeEvent = await prisma.event.findFirst({
    where: { tenantId: tenant.id, name: 'Comic Con Guatemala 2026' },
  });

  if (!activeEvent) {
    activeEvent = await prisma.event.create({
      data: {
        tenantId: tenant.id,
        name: 'Comic Con Guatemala 2026',
        location: 'Fórum Majadas, Zona 11',
        startDate: new Date('2026-09-08T08:00:00Z'),
        endDate: new Date('2026-09-12T20:00:00Z'),
        status: 'ACTIVO',
        salesTarget: 15000.0,
        assignedSellerEmail: null,
        assignedSellerName: null,
      },
    });
  }

  console.log(`✅ Evento verificado: ${activeEvent.name} (${activeEvent.id})`);

  // 4. Catálogo de productos con QR codes y códigos de barra
  const sampleProducts = [
    {
      sku: 'POST-MED-01',
      name: 'Póster Mediano (30x45 cm)',
      category: 'GENERAL',
      basePrice: 45.0,
      qrCodeData: 'POSTER_MED_45',
      barcode: '740100100001',
    },
    {
      sku: 'POST-GRA-02',
      name: 'Póster Grande (45x60 cm)',
      category: 'GENERAL',
      basePrice: 70.0,
      qrCodeData: 'POSTER_GRA_70',
      barcode: '740100100002',
    },
    {
      sku: 'POST-GIG-03',
      name: 'Póster Gigante (60x90 cm)',
      category: 'GENERAL',
      basePrice: 120.0,
      qrCodeData: 'POSTER_GIG_120',
      barcode: '740100100003',
    },
    {
      sku: 'POST-MIN-04',
      name: 'Póster Mini (20x30 cm)',
      category: 'GENERAL',
      basePrice: 25.0,
      qrCodeData: 'POSTER_MIN_25',
      barcode: '740100100004',
    },
    {
      sku: 'PACK-3X2-MED',
      name: 'Combo Promo 3x2 Pósters Medianos',
      category: 'PROMOCIONES',
      basePrice: 90.0,
      qrCodeData: 'POSTER_PACK_90',
      barcode: '740100100005',
    },
    {
      sku: 'MARV-SPIDER-MED',
      name: 'Póster Spider-Man Retro 30x45',
      category: 'SUPERHEROES',
      basePrice: 45.0,
      qrCodeData: 'POSTER_SPIDER_45',
      barcode: '740100100006',
    },
    {
      sku: 'SW-VADER-GRA',
      name: 'Póster Darth Vader 45x60',
      category: 'SERIESYPELICULAS',
      basePrice: 70.0,
      qrCodeData: 'POSTER_VADER_70',
      barcode: '740100100007',
    },
    {
      sku: 'AUTO-PORSCHE-GRA',
      name: 'Póster Porsche 911 Clásico 45x60',
      category: 'AUTOS',
      basePrice: 70.0,
      qrCodeData: 'POSTER_PORSCHE_70',
      barcode: '740100100008',
    },
    {
      sku: 'ANIME-GOKU-MED',
      name: 'Póster Goku Ultra Instinct 30x45',
      category: 'ANIME',
      basePrice: 45.0,
      qrCodeData: 'POSTER_GOKU_45',
      barcode: '740100100009',
    },
  ];

  for (const prod of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: prod.sku },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          basePrice: prod.basePrice,
          qrCodeData: prod.qrCodeData,
          barcode: prod.barcode,
        },
      });
    }
  }

  console.log(`✅ Catálogo de productos sembrado exitosamente (${sampleProducts.length} productos base)`);

  if (process.env.SKIP_WEB_SYNC === 'true') {
    console.log('⚡ [Seed] SKIP_WEB_SYNC activo: Verificación ligera de tenant/evento completada. Catálogo completo se sincroniza en background tras el arranque del servidor.');
  } else {
    console.log('🔄 Sincronizando catálogo completo oficial (233 pósters con imágenes WebP)...');
    try {
      const syncRes = await syncCatalogFromWeb(tenant.id);
      console.log(`✅ Sincronización web finalizada: ${syncRes.count} pósters guardados.`);
    } catch (syncErr) {
      console.warn('⚠️ Sincronización web en seed arrojó advertencia:', syncErr.message);
    }
  }

  console.log('🎉 Siembra completada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
