/**
 * server/services/catalog/liveCatalogSyncService.js
 * Satélite Modular: Sincronización Reactiva en Tiempo Real del Catálogo Web
 * Garantiza cero latencia e invisibilidad total para el vendedor:
 * 1. Delta-Sync periódico rápido (cada 60-90s sobre los pósters más recientes).
 * 2. Ingesta atómica de pósters individuales (Webhook / Live).
 * 3. Paracaídas de búsqueda en vivo si una consulta no encuentra coincidencias locales.
 */

import { prisma } from '../../config/prisma.js';
import { ENV } from '../../config/env.js';
import { resolvePosterSizes } from '../catalogSyncService.js';
import { invalidateCatalogCache, formatProductForPos } from '../webCatalogService.js';
import { invalidateVectorCache } from '../embeddingService.js';

const recentQueryThrottle = new Map();
const THROTTLE_MS = 10000; // 10 segundos de protección contra ráfagas

export async function resolveDefaultTenantId(tenantId) {
  if (tenantId) return tenantId;
  const def = await prisma.tenant.findFirst({
    where: { slug: { in: ['deco-vintage-guate', 'deco-vintage'] } },
    select: { id: true },
  });
  return def?.id || (await prisma.tenant.findFirst({ select: { id: true } }))?.id || null;
}

export function getCatalogCandidateUrls() {
  const configuredUrl = ENV.WEB_CATALOG_URL || process.env.WEB_CATALOG_URL;
  return [configuredUrl, 'https://decovintage.online'].filter((url, index, self) => 
    url && typeof url === 'string' && !url.includes('decovintageguate.com') && self.indexOf(url) === index
  );
}

export async function normalizeAndUpsertPoster(poster, tenantId) {
  const posterId = poster.id || poster._id || poster.legacyId;
  if (!posterId) return null;

  const targetTenantId = await resolveDefaultTenantId(tenantId);
  if (!targetTenantId) return null;

  const sku = `WEB-${posterId}`;
  const rawTitle = (poster.titulo || poster.title || 'Póster').trim();
  const rawSubtitle = (poster.subtitulo || poster.subtitle || '').trim();
  const name = rawSubtitle ? `${rawTitle} - ${rawSubtitle}` : rawTitle;
  const category = (poster.categoria || poster.category || 'GENERAL').toUpperCase();
  const rawImg = poster.imageUrl || poster.image || poster.thumbUrl || null;
  const imageUrl = typeof rawImg === 'string' && rawImg.trim().length > 5 ? rawImg.trim() : null;
  const isActiveProduct = Boolean(imageUrl);
  const sizes = resolvePosterSizes(poster);
  const minPrice = sizes.reduce((min, s) => Math.min(min, s.precio), Number(poster.precioMinimo || 25));

  const extraTags = Array.isArray(poster.tags) ? poster.tags : [];
  const combinedTags = Array.from(
    new Set([
      rawTitle.toLowerCase(),
      ...(rawSubtitle ? [rawSubtitle.toLowerCase()] : []),
      category.toLowerCase(),
      ...rawTitle.toLowerCase().split(/\s+/),
      ...(rawSubtitle ? rawSubtitle.toLowerCase().split(/\s+/) : []),
      ...extraTags.map((t) => String(t).replace(/^#/, '').toLowerCase().trim()),
    ])
  ).filter((t) => t.length > 1);

  const product = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: targetTenantId, sku } },
    create: {
      tenantId: targetTenantId,
      sku,
      name,
      category,
      basePrice: minPrice,
      imageUrl,
      sizes,
      tags: combinedTags,
      isActive: isActiveProduct,
    },
    update: {
      name,
      category,
      basePrice: minPrice,
      imageUrl,
      sizes,
      tags: combinedTags,
      isActive: isActiveProduct,
    },
  });

  return product;
}

export async function deltaSyncRecentPosters(tenantId = null) {
  const targetTenantId = await resolveDefaultTenantId(tenantId);
  if (!targetTenantId) return { success: false, updated: 0, newCount: 0 };

  const candidateUrls = getCatalogCandidateUrls();
  let batch = [];
  let successfulBase = null;

  for (const rawBase of candidateUrls) {
    const baseUrl = rawBase.replace(/\/+$/, '');
    const url = `${baseUrl}/api/catalog/posters?take=30`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const items = json.data || json.posters || [];
        if (Array.isArray(items) && items.length > 0) {
          batch = items;
          successfulBase = baseUrl;
          break;
        }
      }
    } catch (err) {
      console.warn(`[DeltaSync Warning] Fallo consultando ${baseUrl}:`, err.message);
    }
  }

  if (batch.length === 0) {
    return { success: true, updated: 0, newCount: 0 };
  }

  try {
    const skus = batch.map((p) => `WEB-${p.id || p._id || p.legacyId}`).filter((s) => s !== 'WEB-undefined');
    const existing = await prisma.product.findMany({
      where: { tenantId: targetTenantId, sku: { in: skus } },
      select: { sku: true, updatedAt: true },
    });
    const existingMap = new Map(existing.map((e) => [e.sku, e.updatedAt]));

    let newCount = 0;
    let updatedCount = 0;

    for (const p of batch) {
      const sku = `WEB-${p.id || p._id || p.legacyId}`;
      const isNew = !existingMap.has(sku);
      await normalizeAndUpsertPoster(p, targetTenantId);
      if (isNew) newCount++;
      else updatedCount++;
    }

    if (newCount > 0 || updatedCount > 0) {
      invalidateCatalogCache(targetTenantId);
      try { invalidateVectorCache(targetTenantId); } catch {}
    }

    return { success: true, updated: updatedCount, newCount };
  } catch (err) {
    console.error('[DeltaSync Error]:', err.message);
    return { success: false, updated: 0, newCount: 0, error: err.message };
  }
}

export async function searchLiveWebParachute(cleanQuery, tenantId = null) {
  if (!cleanQuery || cleanQuery.length < 3) return [];
  const cacheKey = `${cleanQuery.toLowerCase()}`;
  const lastRan = recentQueryThrottle.get(cacheKey) || 0;
  if (Date.now() - lastRan < THROTTLE_MS) return [];
  recentQueryThrottle.set(cacheKey, Date.now());

  const normalizeStr = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]/g, ' ')
      .trim();

  const normQuery = normalizeStr(cleanQuery);
  const queryTokens = normQuery.split(/\s+/).filter((t) => t.length > 1);

  const candidateUrls = getCatalogCandidateUrls();
  const allWebItems = new Map();

  for (const rawBase of candidateUrls) {
    const baseUrl = rawBase.replace(/\/+$/, '');
    
    // Consulta 1: Búsqueda activa por search param en la web
    // Consulta 2: Lote reciente take=30
    const urlsToTry = [
      `${baseUrl}/api/catalog/posters?search=${encodeURIComponent(cleanQuery)}&take=30`,
      `${baseUrl}/api/catalog/posters?search=${encodeURIComponent(normQuery)}&take=30`,
      `${baseUrl}/api/catalog/posters?take=30`,
    ];

    for (const targetUrl of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(targetUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const items = json.data || json.posters || [];
          if (Array.isArray(items)) {
            for (const item of items) {
              const itemId = item.id || item._id || item.legacyId;
              if (itemId && !allWebItems.has(itemId)) {
                allWebItems.set(itemId, item);
              }
            }
          }
        }
      } catch (err) {
        // Fallback silencioso por URL
      }
    }

    if (allWebItems.size > 0) break;
  }

  if (allWebItems.size === 0) return [];

  const targetTenantId = await resolveDefaultTenantId(tenantId);
  const importedProducts = [];

  for (const p of allWebItems.values()) {
    const title = normalizeStr(p.titulo || p.title || '');
    const sub = normalizeStr(p.subtitulo || p.subtitle || '');
    const full = `${title} ${sub}`;
    const tags = Array.isArray(p.tags) ? p.tags.map((t) => normalizeStr(String(t))) : [];

    const matchesQuery =
      full.includes(normQuery) ||
      (queryTokens.length > 0 && queryTokens.every((token) => full.includes(token) || tags.some((tag) => tag.includes(token))));

    if (matchesQuery) {
      const prod = await normalizeAndUpsertPoster(p, targetTenantId);
      if (prod) importedProducts.push(formatProductForPos(prod));
    }
  }

  if (importedProducts.length > 0) {
    invalidateCatalogCache(targetTenantId);
    try { invalidateVectorCache(targetTenantId); } catch {}
  }

  return importedProducts;
}
