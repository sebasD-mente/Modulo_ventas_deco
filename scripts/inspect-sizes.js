import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function inspectSizes() {
  try {
    const sizes = await prisma.$queryRawUnsafe(`
      SELECT "posterId", "sizeId", "nombre", "dimensiones", "precio" 
      FROM public.poster_sizes 
      LIMIT 4;
    `);
    console.log('Muestra de tamaños:', sizes);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspectSizes();
