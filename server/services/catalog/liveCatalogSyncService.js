/**
 * server/services/catalog/liveCatalogSyncService.js
 * Sincronización en tiempo real, delta-sync, paracaídas web y sync completa.
 */
import { prisma } from '../../config/prisma.js';
import { ENV } from '../../config/env.js';
import { resolvePosterSizes } from './catalogSizeResolver.js';
import { formatProductForPos } from './catalogStringNormalizer.js';
import { invalidateCatalogCache } from './catalogCacheStore.js';
import { invalidateVectorCache } from '../embeddingService.js';

const recentQueryThrottle = new Map(), THROTTLE_MS = 10000;

export async function resolveDefaultTenantId(tenantId) {
  if (tenantId) return tenantId;
  const def = await prisma.tenant.findFirst({ where: { slug: { in: ['deco-vintage-guate', 'deco-vintage'] } }, select: { id: true } });
  return def?.id || (await prisma.tenant.findFirst({ select: { id: true } }))?.id || null;
}

export function getCatalogCandidateUrls() {
  const configuredUrl = ENV.WEB_CATALOG_URL || process.env.WEB_CATALOG_URL;
  return [configuredUrl, 'https://decovintage.online'].filter((url, idx, arr) => 
    url && typeof url === 'string' && !url.includes('decovintageguate.com') && arr.indexOf(url) === idx
  );
}

export async function normalizeAndUpsertPoster(poster, tenantId) {
  const posterId = poster.id || poster._id || poster.legacyId;
  const targetTenantId = await resolveDefaultTenantId(tenantId);
  if (!posterId || !targetTenantId) return null;

  const sku = `WEB-${posterId}`, rawTitle = (poster.titulo || poster.title || 'Póster').trim();
  const rawSubtitle = (poster.subtitulo || poster.subtitle || '').trim();
  const name = rawSubtitle ? `${rawTitle} - ${rawSubtitle}` : rawTitle;
  const category = (poster.categoria || poster.category || 'GENERAL').toUpperCase();
  const rawImg = poster.imageUrl || poster.image || poster.thumbUrl || null;
  const imageUrl = typeof rawImg === 'string' && rawImg.trim().length > 5 ? rawImg.trim() : null;
  const sizes = resolvePosterSizes(poster), isActiveProduct = Boolean(imageUrl);
  const minPrice = sizes.reduce((min, s) => Math.min(min, s.precio), Number(poster.precioMinimo || 25));
  const rawDesc = (poster.descripcion || poster.description || '').toLowerCase();
  const descTokens = rawDesc.replace(/[^a-záéíóúüñ0-9\s]/gi, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !['para', 'este', 'esta', 'como', 'con', 'por', 'los', 'las', 'una'].includes(w));
  const combinedTags = Array.from(new Set([
    rawTitle.toLowerCase(), ...(rawSubtitle ? [rawSubtitle.toLowerCase()] : []), category.toLowerCase(),
    ...rawTitle.toLowerCase().split(/\s+/), ...(rawSubtitle ? rawSubtitle.toLowerCase().split(/\s+/) : []),
    ...(Array.isArray(poster.tags) ? poster.tags : []).map((t) => String(t).replace(/^#/, '').toLowerCase().trim()), ...descTokens,
  ])).filter((t) => t.length > 1);
  const data = { tenantId: targetTenantId, sku, name, category, basePrice: minPrice, imageUrl, sizes, tags: combinedTags, isActive: isActiveProduct };
  try {
    return await prisma.product.upsert({ where: { tenantId_sku: { tenantId: targetTenantId, sku } }, create: data, update: data });
  } catch {
    return { id: posterId, ...data };
  }
}

export async function deltaSyncRecentPosters(tenantId = null) {
  const targetTenantId = await resolveDefaultTenantId(tenantId);
  if (!targetTenantId) return { success: false, updated: 0, newCount: 0 };
  let batch = [];
  for (const rawBase of getCatalogCandidateUrls()) {
    const baseUrl = rawBase.replace(/\/+$/, '');
    try {
      const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${baseUrl}/api/catalog/posters?take=100`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json(), items = json.data || json.posters || [];
        if (Array.isArray(items) && items.length > 0) { batch = items; break; }
      }
    } catch {}
  }
  if (batch.length === 0) return { success: true, updated: 0, newCount: 0 };

  try {
    const skus = batch.map((p) => `WEB-${p.id || p._id || p.legacyId}`).filter((s) => s !== 'WEB-undefined');
    const existing = await prisma.product.findMany({ where: { tenantId: targetTenantId, sku: { in: skus } }, select: { sku: true } });
    const existingSet = new Set(existing.map((e) => e.sku));
    let newCount = 0, updatedCount = 0;
    for (const p of batch) {
      if (existingSet.has(`WEB-${p.id || p._id || p.legacyId}`)) updatedCount++; else newCount++;
      await normalizeAndUpsertPoster(p, targetTenantId);
    }
    if (newCount > 0 || updatedCount > 0) {
      invalidateCatalogCache(targetTenantId);
      try { invalidateVectorCache(targetTenantId); } catch {}
    }
    return { success: true, updated: updatedCount, newCount };
  } catch (err) {
    return { success: false, updated: 0, newCount: 0, error: err.message };
  }
}

export async function searchLiveWebParachute(cleanQuery, tenantId = null) {
  if (!cleanQuery || cleanQuery.length < 3) return [];
  const cacheKey = cleanQuery.toLowerCase();
  if (Date.now() - (recentQueryThrottle.get(cacheKey) || 0) < THROTTLE_MS) return [];
  recentQueryThrottle.set(cacheKey, Date.now());

  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ').trim();
  const normQuery = norm(cleanQuery), STOP = new Set(['de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'con', 'por', 'para', 'poster', 'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'dame', 'quiero']);
  const queryTokens = Array.from(new Set(normQuery.split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t))));
  const allWebItems = new Map();

  for (const rawBase of getCatalogCandidateUrls()) {
    const baseUrl = rawBase.replace(/\/+$/, '');
    const urlsToTry = [
      `${baseUrl}/api/catalog/posters?search=${encodeURIComponent(cleanQuery)}&take=50`,
      ...queryTokens.slice(0, 3).map((tok) => `${baseUrl}/api/catalog/posters?search=${encodeURIComponent(tok)}&take=50`),
      `${baseUrl}/api/catalog/posters?take=100`,
    ];
    for (const targetUrl of urlsToTry) {
      try {
        const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(targetUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          for (const item of (json.data || json.posters || [])) {
            const id = item?.id || item?._id || item?.legacyId;
            if (id && !allWebItems.has(id)) allWebItems.set(id, item);
          }
        }
      } catch {}
    }
    if (allWebItems.size > 0) break;
  }
  if (allWebItems.size === 0) return [];

  const targetTenantId = await resolveDefaultTenantId(tenantId), matchedCandidates = [];
  for (const p of allWebItems.values()) {
    const full = `${norm(p.titulo || p.title)} ${norm(p.subtitulo || p.subtitle)}`;
    const fullText = `${full} ${(Array.isArray(p.tags) ? p.tags : []).map(norm).join(' ')} ${norm(p.descripcion || p.description)}`;
    let score = (full.includes(normQuery) ? 200 : 0) + (fullText.includes(normQuery) ? 100 : 0), matchedTokens = 0;
    for (const tok of queryTokens) {
      if (full.includes(tok)) { score += 50; matchedTokens++; }
      else if (fullText.includes(tok)) { score += 25; matchedTokens++; }
    }
    if (score > 0 || (queryTokens.length > 0 && matchedTokens >= Math.min(queryTokens.length, 1))) matchedCandidates.push({ poster: p, score });
  }

  matchedCandidates.sort((a, b) => b.score - a.score);
  const importedProducts = [];
  for (const { poster } of matchedCandidates.slice(0, 25)) {
    const prod = await normalizeAndUpsertPoster(poster, targetTenantId);
    if (prod) importedProducts.push(formatProductForPos(prod));
  }
  if (importedProducts.length > 0) {
    invalidateCatalogCache(targetTenantId);
    try { invalidateVectorCache(targetTenantId); } catch {}
  }
  return importedProducts;
}

export async function syncCatalogFromWeb(tenantId) {
  const targetTenantId = await resolveDefaultTenantId(tenantId);
  if (!targetTenantId) return { success: false, count: 0, error: 'Tenant no configurado en la base de datos.' };
  let allPosters = [], successfulUrl = null;
  for (const baseUrl of getCatalogCandidateUrls()) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    let cursor = null, hasMore = true, collected = [];
    try {
      while (hasMore) {
        const pageUrl = `${cleanBase}/api/catalog/posters?take=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(pageUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) break;
        const json = await res.json(), batch = json.data || json.posters || [];
        if (!Array.isArray(batch) || batch.length === 0) break;
        collected.push(...batch);
        hasMore = Boolean(json.hasMore && json.nextCursor);
        cursor = json.nextCursor;
      }
      if (collected.length > 0) { allPosters = collected; successfulUrl = `${cleanBase}/api/catalog/posters`; break; }
    } catch {}
  }
  if (allPosters.length === 0) return { success: false, count: 0, warning: 'Catálogo web no disponible o sin conexión. Operando con caché local.' };

  const existing = await prisma.product.findMany({ where: { tenantId: targetTenantId, isActive: true }, select: { sku: true } });
  const existingSkus = new Set(existing.map((p) => p.sku)), syncedSkus = new Set();
  let upsertedCount = 0, newCount = 0;
  for (const poster of allPosters) {
    const prod = await normalizeAndUpsertPoster(poster, targetTenantId);
    if (prod?.sku) {
      if (!existingSkus.has(prod.sku)) newCount++;
      syncedSkus.add(prod.sku);
      upsertedCount++;
    }
  }
  const removedSkus = [...existingSkus].filter((s) => !syncedSkus.has(s));
  if (removedSkus.length > 0) await prisma.product.updateMany({ where: { tenantId: targetTenantId, sku: { in: removedSkus } }, data: { isActive: false } }).catch(() => {});
  await prisma.product.updateMany({ where: { tenantId: targetTenantId, OR: [{ imageUrl: null }, { imageUrl: '' }] }, data: { isActive: false } }).catch(() => {});
  invalidateCatalogCache(targetTenantId);
  return { success: true, count: upsertedCount, newCount, source: successfulUrl };
}
