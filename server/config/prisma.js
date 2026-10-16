import { PrismaClient } from '@prisma/client';
import { ENV } from './env.js';

let prismaInstance = null;
let isDisconnecting = false;

export function buildDatabaseUrlWithPool(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('postgresql://') && !trimmed.startsWith('postgres://')) {
    return trimmed;
  }
  if (trimmed.includes('connection_limit=')) {
    return trimmed;
  }
  const separator = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${separator}connection_limit=20&pool_timeout=15`;
}

export function getPrisma() {
  if (!prismaInstance) {
    const dbUrl = buildDatabaseUrlWithPool(ENV.DATABASE_URL || process.env.DATABASE_URL);
    const options = {
      log: ENV.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    };
    if (dbUrl) {
      options.datasources = { db: { url: dbUrl } };
    }
    prismaInstance = new PrismaClient(options);

    const safeDisconnect = async () => {
      if (prismaInstance && !isDisconnecting) {
        isDisconnecting = true;
        try {
          await prismaInstance.$disconnect();
        } catch {}
      }
    };

    process.on('beforeExit', safeDisconnect);
    process.on('SIGTERM', safeDisconnect);
    process.on('SIGINT', safeDisconnect);
  }
  return prismaInstance;
}

export const prisma = getPrisma();
