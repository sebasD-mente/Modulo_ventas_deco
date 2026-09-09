import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos maestros para Deko EventSales...');

  // 1. Tenant: Deco Vintage Guate
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'deco-vintage' },
    update: {},
    create: {
      id: '9e2f9c77-8eec-47fe-b8bb-6f1d1e5e1e51',
      name: 'Deco Vintage Guate',
      slug: 'deco-vintage',
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

  // 2. Usuarios del sistema
  const passwordHash = await bcrypt.hash('Deco2026!Eventos', 10);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@dekolabs.com',
      },
    },
    update: {},
    create: {
      id: '976521eb-89a1-4173-89fb-6b313130f69c',
      tenantId: tenant.id,
      email: 'admin@dekolabs.com',
      fullName: 'Administrador E2E',
      passwordHash,
      role: 'ADMIN_EMPRESA',
      phone: '+502 3837-5078',
    },
  });

  const standSeller = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'vendedor@dekolabs.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'vendedor@dekolabs.com',
      fullName: 'Vendedor Stand E2E',
      passwordHash,
      role: 'ENCARGADO_STAND',
      phone: '+502 5555-1234',
    },
  });

  console.log(`✅ Usuarios sembrados: ${adminUser.fullName}, ${standSeller.fullName}`);

  // 3. Evento Activo: Comic Con Guatemala 2026
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
        assignedSellerEmail: 'vendedor@dekolabs.com',
        assignedSellerName: 'Vendedor Stand E2E',
      },
    });
  }

  console.log(`✅ Evento activo verificado: ${activeEvent.name} (${activeEvent.id})`);

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
