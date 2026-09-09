import { PrismaClient } from '@prisma/client';
import { ENV } from './env.js';

let prismaInstance = null;

export function getPrisma() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ENV.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    // Manejo de desconexión elegante
    process.on('beforeExit', async () => {
      if (prismaInstance) {
        await prismaInstance.$disconnect();
      }
    });
  }
  return prismaInstance;
}

export const prisma = getPrisma();
