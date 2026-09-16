/**
 * server/services/catalog/catalogCacheStore.js
 * Almacén y gestión de caché en memoria con TTL particionada por tenant.
 */

import { prisma } from '../../config/prisma.js';
import { invalidateVectorCache } from '../embeddingService.js';
import { formatProductForPos } from './catalogStringNormalizer.js';

export const productCache = new Map();
export const CACHE_TTL_MS = 30 * 1000;
export const DEFAULT_TENANT_KEY = '__GLOBAL__';

export function invalidateCatalogCache(tenantId = null) {
  if (tenantId) {
    productCache.delete(tenantId);
    productCache.delete(DEFAULT_TENANT_KEY);
  } else {
    productCache.clear();
  }
  try {
    invalidateVectorCache(tenantId);
  } catch {}
}

export async function getCachedProducts(tenantId) {
  const key = tenantId || DEFAULT_TENANT_KEY;
  const now = Date.now();
  const cachedEntry = productCache.get(key);

  if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
    return cachedEntry.products;
  }

  const where = { isActive: true };
  if (tenantId) where.tenantId = tenantId;

  try {
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const formatted = products.map(formatProductForPos);
    productCache.set(key, { products: formatted, timestamp: now });
    return formatted;
  } catch (err) {
    console.warn('[WebCatalog Warning] ⚠️ No se pudo consultar prisma.product:', err.message);
    if (cachedEntry && cachedEntry.products?.length > 0) return cachedEntry.products;
    return [
      {
        id: 'dev-pablo-1',
        titulo: 'Pablo Escobar (Sonrisa / Mugshot)',
        subtitulo: 'Diseño icónico vintage',
        categoria: 'HISTÓRICOS',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample.jpg',
        thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample.jpg',
        precioMinimo: 25,
        tags: ['pablo', 'escobar', 'mugshot', 'vintage'],
        sizes: [
          { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
          { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
          { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
        ],
      },
      {
        id: 'dev-spiderman-1',
        titulo: 'Spider-Man Vintage Comic',
        subtitulo: 'Portada clásica Marvel',
        categoria: 'CÓMICS',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
        thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
        precioMinimo: 25,
        tags: ['spiderman', 'spider-man', 'marvel'],
        sizes: [
          { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
          { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
          { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
        ],
      },
    ];
  }
}
