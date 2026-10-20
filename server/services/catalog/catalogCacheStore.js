/**
 * server/services/catalog/catalogCacheStore.js
 * Almacén y gestión de caché en memoria con TTL particionada por tenant.
 */

import { prisma } from '../../config/prisma.js';
import { invalidateVectorCache } from '../embeddingService.js';
import { formatProductForPos } from './catalogStringNormalizer.js';

export const productCache = new Map();
export const CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_TENANT_KEY = '__GLOBAL__';
const refreshingTenants = new Set();

export function invalidateCatalogCache(tenantId = null, { preserveVectors = false } = {}) {
  if (tenantId) {
    productCache.delete(tenantId);
    productCache.delete(DEFAULT_TENANT_KEY);
    refreshingTenants.delete(tenantId);
  } else {
    productCache.clear();
    refreshingTenants.clear();
  }
  if (!preserveVectors) {
    try {
      invalidateVectorCache(tenantId);
    } catch {}
  }
}

async function fetchAndCacheProducts(tenantId, key) {
  const where = { isActive: true };
  if (tenantId) where.tenantId = tenantId;
  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  const formatted = products.map(formatProductForPos);
  productCache.set(key, { products: formatted, timestamp: Date.now() });
  return formatted;
}

export async function getCachedProducts(tenantId) {
  const key = tenantId || DEFAULT_TENANT_KEY;
  const now = Date.now();
  const cachedEntry = productCache.get(key);

  if (cachedEntry) {
    if (now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return cachedEntry.products;
    }
    if (Array.isArray(cachedEntry.products) && cachedEntry.products.length > 0) {
      if (!refreshingTenants.has(key)) {
        refreshingTenants.add(key);
        fetchAndCacheProducts(tenantId, key)
          .catch((err) => console.warn('[WebCatalog SWR] ⚠️ Refresco background falló:', err.message))
          .finally(() => refreshingTenants.delete(key));
      }
      return cachedEntry.products;
    }
  }

  try {
    return await fetchAndCacheProducts(tenantId, key);
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
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 210 },
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
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 210 },
        ],
      },
    ];
  }
}
