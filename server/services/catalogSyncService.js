// Fachada de catálogo (deco-vintage-guate, descTokens vía liveCatalogSyncService).
import { prisma } from '../config/prisma.js';
export * from './catalog/catalogSizeResolver.js';
export * from './catalog/liveCatalogSyncService.js';

export async function queryCatalogProducts({ tenantId, page, limit, search, category }) {
  const where = { tenantId, isActive: true };
  if (category) where.category = String(category).trim().toUpperCase();
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }];
  }
  const findOptions = { where, orderBy: [{ category: 'asc' }, { basePrice: 'asc' }] };
  if (limit) {
    const parsedLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    findOptions.take = parsedLimit;
    findOptions.skip = (parsedPage - 1) * parsedLimit;
  }
  return prisma.product.findMany(findOptions);
}
