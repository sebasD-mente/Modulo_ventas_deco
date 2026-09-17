import { prisma } from '../config/prisma.js';
import { invalidateVectorCache, searchHybridPosters, searchPostersByEmbedding } from './embeddingService.js';
import { resolveEntityAlias, UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES } from './semantic/entityAliases.js';
import { productCache, invalidateCatalogCache as invalidateStoreCache, getCachedProducts } from './catalog/catalogCacheStore.js';
import { formatProductForPos, extractImageSlug, extractPosterTitle, normalizePosterTitle, deduplicatePosters } from './catalog/catalogStringNormalizer.js';

export function invalidateCatalogCache(tenantId = null) { invalidateStoreCache(tenantId); }

export async function searchWebPosters({ tenantId, query = '', category = null, limit = 24 }) {
  const cleanQuery = String(query ?? '').trim().toLowerCase();
  const rawProducts = await getCachedProducts(tenantId);
  let filtered = rawProducts.filter(p => p.imageUrl !== null && p.imageUrl !== '');
  if (category && String(category).trim()) {
    filtered = filtered.filter((p) => p.categoria === String(category).trim().toUpperCase());
  }

  if (cleanQuery) {
    const normalize = (str) =>
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[?!¿¡,.:;()]/g, ' ').replace(/[-_]/g, ' ').trim();
    const alphaOnly = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normQuery = normalize(cleanQuery);
    const alphaQuery = alphaOnly(cleanQuery);
    const rawTokens = normQuery.split(/\s+/).filter((t) => t.length > 0);
    const STOP_WORDS = UNIVERSAL_STOP_WORDS;
    const aliasRes = resolveEntityAlias(cleanQuery);
    const aliasTokens = (aliasRes.matched && aliasRes.searchQuery)
      ? normalize(aliasRes.searchQuery).split(/\s+/).filter((t) => !STOP_WORDS.has(t) && t.length > 1)
      : [];

    const expandedTokens = [];
    for (const t of rawTokens) {
      if (/^(besando|besa|besan)$/.test(t)) expandedTokens.push('beso');
      else if (/^(mordiendo|muerde)$/.test(t)) expandedTokens.push('mordida', 'uña');
      else if (/^(celebrando|festejando|festeja|celebra)$/.test(t)) expandedTokens.push('festejo', 'celebracion');
      else if (/^(levantando|alza|alzando)$/.test(t)) expandedTokens.push('copa', 'trofeo');
    }

    const allTokens = Array.from(new Set([...rawTokens, ...aliasTokens, ...expandedTokens]));
    const meaningfulTokens = allTokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
    const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : (allTokens.length > 0 ? allTokens : rawTokens);

    const getCondensed = (str) => normalize(str).split(/\s+/).filter((t) => !STOP_WORDS.has(t) && t.length > 0).join(' ');
    const queryCondensed = getCondensed(cleanQuery);
    const aliasCondensed = (aliasRes.matched && aliasRes.searchQuery) ? getCondensed(aliasRes.searchQuery) : '';

    const scoredAll = filtered.map((p) => {
      const titleText = [p.titulo, p.subtitulo, p.nombreCompleto].filter(Boolean).join(' ');
      const fullText = [titleText, p.sku, p.categoria, Array.isArray(p.tags) ? p.tags.join(' ') : ''].filter(Boolean).join(' ');
      const normTitleText = normalize(titleText), normFullText = normalize(fullText);
      const alphaFullText = alphaOnly(fullText);
      const titleTokensSet = new Set(normTitleText.split(/\s+/)), fullTokensSet = new Set(normFullText.split(/\s+/));
      const productTitleCondensed = getCondensed(titleText);

      let score = 0;
      if (normTitleText === normQuery) score += 350;
      if (normFullText.startsWith(normQuery)) score += 120;
      if (p.titulo?.toLowerCase().startsWith(cleanQuery)) score += 100;
      if (normFullText.includes(normQuery)) score += 80;
      if (alphaQuery.length >= 3 && alphaFullText.includes(alphaQuery)) score += 60;
      if (p.sku && p.sku.toLowerCase().includes(cleanQuery)) score += 80;

      if (queryCondensed.length >= 3) {
        const productFullCondensed = getCondensed(fullText);
        if (productTitleCondensed === queryCondensed) score += 300;
        else if (productTitleCondensed.startsWith(queryCondensed)) score += 250;
        else if (productTitleCondensed.includes(queryCondensed)) score += 200;
        else if (productFullCondensed.includes(queryCondensed)) score += 150;
      }

      if (aliasCondensed.length >= 3) {
        if (productTitleCondensed === aliasCondensed) score += 320;
        else if (productTitleCondensed.startsWith(aliasCondensed)) score += 260;
        else if (productTitleCondensed.includes(aliasCondensed)) score += 210;
      }

      const isTokenMatch = (t) => fullTokensSet.has(t) || normFullText.startsWith(t);
      if (tokens.length > 0 && tokens.every(isTokenMatch)) {
        if (tokens.length >= 2 || titleTokensSet.has(tokens[0]) || normTitleText.startsWith(tokens[0])) score += 150;
      }

      for (const token of tokens) {
        if (titleTokensSet.has(token)) score += 35;
        else if (isTokenMatch(token)) score += 15;
      }

      if (meaningfulTokens.length === 1) {
        const singleToken = meaningfulTokens[0];
        const matchesTitle = titleTokensSet.has(singleToken) || normTitleText.split(/\s+/).some((t) => t.startsWith(singleToken));
        const hasAliasMatch = Boolean(aliasCondensed.length >= 2 && (productTitleCondensed === aliasCondensed || productTitleCondensed.startsWith(aliasCondensed) || productTitleCondensed.includes(aliasCondensed)));
        const hasExactTitle = normTitleText === singleToken || normTitleText.startsWith(singleToken);
        if (!matchesTitle && !hasAliasMatch && !hasExactTitle) score = 0;
      } else if (meaningfulTokens.length >= 2) {
        const matchedMeaningful = meaningfulTokens.filter((t) => titleTokensSet.has(t) || isTokenMatch(t));
        const hasAliasMatch = Boolean(aliasCondensed.length >= 3 && (productTitleCondensed === aliasCondensed || productTitleCondensed.startsWith(aliasCondensed) || productTitleCondensed.includes(aliasCondensed)));
        const hasFullPhrase = normFullText.includes(normQuery) || (queryCondensed.length >= 3 && normFullText.includes(queryCondensed));
        const meetsRatio = matchedMeaningful.length >= 2 && (matchedMeaningful.length / meaningfulTokens.length) >= 0.6;
        if (!hasAliasMatch && !hasFullPhrase && !meetsRatio) score = 0;
      }

      return { p, score };
    });

    const maxScore = scoredAll.reduce((max, item) => (item.score > max ? item.score : max), 0);
    const minThreshold = maxScore >= 150 ? Math.max(50, maxScore * 0.25) : 50;
    const scored = scoredAll.filter((item) => item.score >= minThreshold && item.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const deduplicated = deduplicatePosters(scored.map((item) => item.p));

    const targetMeaningful = (aliasRes.matched && aliasTokens.length > 0) ? aliasTokens.slice(0, 2) : meaningfulTokens;
    const hasMissingTokens = targetMeaningful.length >= 2 && !deduplicated.some((p) => {
      const pNorm = normalize([p.titulo, p.subtitulo, p.nombreCompleto].filter(Boolean).join(' '));
      return targetMeaningful.every((tok) => pNorm.includes(tok));
    });

    if ((deduplicated.length === 0 || hasMissingTokens) && cleanQuery.length >= 3) {
      try {
        const { searchLiveWebParachute } = await import('./catalog/liveCatalogSyncService.js');
        const liveResults = await searchLiveWebParachute(cleanQuery, tenantId);
        if (Array.isArray(liveResults) && liveResults.length > 0) {
          return deduplicatePosters([...liveResults, ...deduplicated]).slice(0, limit);
        }
      } catch {}
    }

    return deduplicated.slice(0, limit);
  }

  return deduplicatePosters(filtered).slice(0, limit);
}

export async function getAllWebPostersCatalogSummary(tenantId = null) {
  const products = await getCachedProducts(tenantId);
  return deduplicatePosters(products).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    categoria: p.categoria,
    tags: p.tags,
    precioMinimo: p.precioMinimo,
  }));
}

export async function getWebPosterById(posterId, tenantId = null) {
  if (!posterId) return null;
  const matcher = (p) => p.id === posterId || p.sku === posterId || p.sku === `WEB-${posterId}`;

  if (tenantId) {
    if (productCache.has(tenantId)) {
      const cached = productCache.get(tenantId)?.products?.find(matcher);
      if (cached) return cached;
    }
  } else {
    for (const entry of productCache.values()) {
      const cached = entry?.products?.find(matcher);
      if (cached) return cached;
    }
  }

  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: posterId }, { sku: posterId }, { sku: `WEB-${posterId}` }], isActive: true, ...(tenantId ? { tenantId } : {}) },
    });
    return product ? formatProductForPos(product) : null;
  } catch (err) {
    console.warn('[WebCatalog Warning] ⚠️ No se pudo consultar prisma.product en getWebPosterById:', err.message);
    return null;
  }
}

export const searchPosters = searchWebPosters, getCatalogPosters = searchWebPosters;
export {
  getCachedProducts, formatProductForPos, extractImageSlug, extractPosterTitle,
  normalizePosterTitle, deduplicatePosters, searchHybridPosters, searchPostersByEmbedding,
  UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES,
};
