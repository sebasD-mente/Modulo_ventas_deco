import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function checkCatalog() {
  try {
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM public.posters;');
    const sample = await prisma.$queryRawUnsafe('SELECT id, titulo, categoria, "imageUrl", "precioMinimo" FROM public.posters LIMIT 3;');
    const categories = await prisma.$queryRawUnsafe('SELECT id, name FROM public.categories LIMIT 5;');
    console.log('✅ Conexión cruzada exitosa en PostgreSQL catalog_db!');
    console.log('Total pósters en web:', count[0].count.toString());
    console.log('Muestra de pósters web:', sample);
    console.log('Categorías web:', categories);

    console.log('\n--- AUDITORÍA DE REGISTROS EN event_sales ---');
    const eventSalesTables = ['tenants', 'users', 'events', 'products', 'sales', 'sale_items', 'sale_payments', 'cash_closings', 'audit_logs'];
    for (const tbl of eventSalesTables) {
      try {
        const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM event_sales.${tbl};`);
        console.log(`- ${tbl.padEnd(16)}: ${countRes[0].count} filas`);
      } catch (e) {
        console.log(`- ${tbl.padEnd(16)}: ERROR (${e.message})`);
      }
    }
  } catch (err) {
    console.error('❌ Error conectando con base de datos:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCatalog();
