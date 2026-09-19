import { prisma } from '../../config/prisma.js';
import { searchHybridPosters } from '../embeddingService.js';
import { searchWebPosters } from '../webCatalogService.js';
import { resolveEntityAlias, UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES } from '../semantic/entityAliases.js';
import { getCachedProducts } from './catalogCacheStore.js';

export const STANDARD_SIZES = {
  MINI: { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 }, PEQUENO: { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  PORTADA_ALBUM: { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 }, MEDIANO: { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  GRANDE: { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 }, GIGANTE: { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
};

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export function normalizeMatcherString(str) {
  if (!str || typeof str !== 'string') return '';
  const withPlaceholder = str.replace(/ñ/gi, '___enie___');
  const noAccents = withPlaceholder.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/___enie___/g, 'ñ');
  return noAccents.replace(/[?!¿¡,.:;()_—\-\/\\"'`~*#]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stemMatcherToken(tok) {
  if (!tok || tok.length <= 3 || KNOWN_SHORT_ENTITIES.has(tok)) return tok;
  if (tok.endsWith('es') && tok.length > 4 && !/[aeiou]es$/.test(tok)) return tok.slice(0, -2);
  if (tok.endsWith('s') && !tok.endsWith('ss') && tok.length > 3) return tok.slice(0, -1);
  return tok;
}

export const EXTENDED_STOP_WORDS = new Set([
  ...UNIVERSAL_STOP_WORDS, 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'con', 'por', 'para', 'del', 'al', 'y', 'o', 'que', 'sobre', 'sin', 'como', 'su', 'sus', 'poster', 'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseno', 'disenos', 'diseño', 'diseños', 'tamano', 'tamanos', 'tamaño', 'tamaños', 'medida', 'medidas',
]);

function normSize(requestedSize) {
  if (!requestedSize) return 'MEDIANO';
  const raw = String(requestedSize).toLowerCase().trim(), compact = raw.replace(/\s+/g, '').replace(/pulgadas?|pulg?|inches?|in\b|"|cms?|cent[ií]metros?/gi, '').replace(/por|\*|x/gi, 'x');
  if (/30x30|12x12|vinilo|album|[aá]lbum|portada|cuadrad[oa]|disco/.test(compact) || /\b(portada|album|[aá]lbum|vinilo|cuadrad[oa]|disco)\b/i.test(raw)) return 'PORTADA_ALBUM';
  if (/18x24|24x18|45x60|60x45/.test(compact) || /\b(grande|large|l)\b/i.test(raw)) return 'GRANDE';
  if (/24x36|36x24|60x90|90x60/.test(compact) || /\b(gigante|extra\s*grande|xl)\b/i.test(raw)) return 'GIGANTE';
  if (/12x18|18x12|30x45|45x30/.test(compact) || /\b(mediano|medio|medium|m)\b/i.test(raw)) return 'MEDIANO';
  if (/8(\.5)?x1[01]|1[01]x8(\.5)?|21x27|27x21/.test(compact) || /\b(peque[ñn]o|chico|small|s)\b/i.test(raw)) return 'PEQUENO';
  if (/5x7|7x5|6x8|8x6|14x21|21x14/.test(compact) || /\b(mini|miniatura|xs)\b/i.test(raw)) return 'MINI';
  return raw.toUpperCase();
}

function resolvePosterSize(item, requestedSize) {
  const hasOfficialSizes = Array.isArray(item.sizes) && item.sizes.length > 0;
  const sizes = hasOfficialSizes ? item.sizes : Object.values(STANDARD_SIZES);
  const legitPrimary = (typeof item.primarySize === 'object' && item.primarySize) || sizes.find((s) => s.sizeId === item.primarySize) || sizes.find((s) => s.sizeId === 'PORTADA_ALBUM') || sizes[0] || STANDARD_SIZES.MEDIANO;

  let selectedSize = legitPrimary, sizeAvailable = true, unavailableReason = null;
  if (requestedSize) {
    const norm = normSize(requestedSize), cleanSize = String(requestedSize).toUpperCase().trim();
    const found = sizes.find((s) => s.sizeId === norm || s.sizeId === cleanSize || s.nombre?.toUpperCase() === cleanSize || s.nombre?.toUpperCase().includes(cleanSize) || (s.dimensiones && s.dimensiones.toUpperCase().includes(cleanSize)));
    if (found) {
      selectedSize = found;
    } else {
      sizeAvailable = false;
      const title = item.titulo || item.name || 'Póster';
      const availStr = sizes.map((s) => `${s.nombre} (${s.dimensiones || s.sizeId})`).join(', ');
      unavailableReason = hasOfficialSizes ? `El diseño "${title}" es exclusivo en: ${availStr}. No se fabrica en ${requestedSize}.` : `El diseño "${title}" no se fabrica en ${requestedSize}. Tamaños disponibles: ${availStr}.`;
      selectedSize = legitPrimary;
    }
  }
  return { selectedSize, sizes, sizeAvailable, unavailableReason };
}

function buildPosterResult(matched, requestedSize) {
  const { selectedSize, sizeAvailable, unavailableReason } = resolvePosterSize(matched, requestedSize);
  const displayTitle = matched.subtitulo ? `${matched.titulo} - ${matched.subtitulo}` : (matched.titulo || matched.name || 'Póster');
  return {
    type: 'WEB_POSTER', productId: isUuid(matched.id) ? matched.id : null, posterId: matched.id, description: `${displayTitle} (${selectedSize.nombre})`,
    baseTitle: displayTitle, category: matched.categoria || matched.category || 'ARTE', thumbUrl: matched.thumbUrl || matched.imageUrl, imageUrl: matched.imageUrl,
    unitPrice: Number(selectedSize.precio), sizeId: selectedSize.sizeId, sizeName: selectedSize.nombre, availableSizes: matched.sizes || Object.values(STANDARD_SIZES),
    sizeAvailable, unavailableReason,
  };
}

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchesCatalogWordBoundary(haystack, needle) {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  return new RegExp(`\\b${escapeRegex(needle)}\\b`, 'i').test(haystack);
}

export async function findLocalMatch(tenantIdOrQuery, cleanOrCatalog, requestedSize = null) {
  try {
    let local = [], clean = '';
    if (Array.isArray(cleanOrCatalog)) {
      clean = String(tenantIdOrQuery || '').trim();
      local = cleanOrCatalog;
    } else {
      clean = String(cleanOrCatalog || '').trim();
      const tenantId = tenantIdOrQuery;
      try { local = await getCachedProducts(tenantId); } catch (_) {}
      if (!local || local.length === 0) {
        try { local = await prisma.product.findMany({ where: { tenantId, isActive: true } }); } catch (_) {}
      }
    }
    const cleanNorm = normalizeMatcherString(clean);
    if (!cleanNorm) return null;

    const match = (local || []).find((p) => {
      if ([p.qrCodeData, p.barcode, p.sku, p.id].some((c) => c && c.toLowerCase() === clean.toLowerCase())) return true;
      const pNorm = normalizeMatcherString(p.name || p.titulo || '');
      if (!pNorm) return false;
      if (pNorm === cleanNorm) return true;
      if (EXTENDED_STOP_WORDS.has(pNorm) || EXTENDED_STOP_WORDS.has(cleanNorm)) return false;
      if (pNorm.length < 4) return matchesCatalogWordBoundary(cleanNorm, pNorm);
      if (cleanNorm.length >= 4) return matchesCatalogWordBoundary(cleanNorm, pNorm) || matchesCatalogWordBoundary(pNorm, cleanNorm);
      return matchesCatalogWordBoundary(pNorm, cleanNorm);
    });
    if (match) {
      const { selectedSize, sizes, sizeAvailable, unavailableReason } = resolvePosterSize(match, requestedSize);
      const title = match.name || match.titulo || 'Póster';
      return {
        type: match.type || 'LOCAL_PRODUCT', productId: isUuid(match.id) ? match.id : null, posterId: match.id, description: `${title} (${selectedSize.nombre || 'Mediano'})`, baseTitle: title,
        category: match.category || match.categoria || 'ARTE', thumbUrl: match.thumbUrl || match.imageUrl || null, imageUrl: match.imageUrl || null, unitPrice: Number(selectedSize.precio || match.basePrice || match.precioMinimo || 65),
        sizeId: selectedSize.sizeId || 'MEDIANO', sizeName: selectedSize.nombre || 'Mediano', availableSizes: sizes,
        sizeAvailable, unavailableReason,
      };
    }
  } catch (err) { console.warn('[findLocalMatch] ⚠️ Error local:', err.message); }
  return null;
}

export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  const clean = String(query || '').trim();
  if (!clean) return null;

  try {
    const local = await getCachedProducts(tenantId);
    const exactCode = (local || []).find((p) => [p.qrCodeData, p.barcode, p.sku, p.id].some((c) => c && c.toLowerCase() === clean.toLowerCase()));
    if (exactCode) return findLocalMatch(tenantId, clean, requestedSize);
  } catch (_) {}

  const aliasRes = resolveEntityAlias(clean);
  if (aliasRes.matched && aliasRes.exactMatch && (aliasRes.canonicalTitle || aliasRes.searchQuery)) {
    let webMatches = [];
    const preferredQuery = aliasRes.canonicalTitle || aliasRes.searchQuery;
    try { webMatches = await searchHybridPosters({ tenantId, query: preferredQuery, limit: 12 }); } catch { webMatches = await searchWebPosters({ tenantId, query: preferredQuery, limit: 12 }); }

    if ((!webMatches || webMatches.length === 0) && aliasRes.searchQuery && aliasRes.searchQuery !== preferredQuery) {
      try { webMatches = await searchHybridPosters({ tenantId, query: aliasRes.searchQuery, limit: 12 }); } catch { webMatches = await searchWebPosters({ tenantId, query: aliasRes.searchQuery, limit: 12 }); }
    }

    if (webMatches && webMatches.length > 0) {
      const canonicalTerms = normalizeMatcherString(aliasRes.canonicalTitle || aliasRes.searchQuery).split(/\s+/).filter((t) => (t.length > 2 || KNOWN_SHORT_ENTITIES.has(t)) && !EXTENDED_STOP_WORDS.has(t));
      const candidate = webMatches.find((p) => {
        const full = normalizeMatcherString(`${p.titulo || ''} ${p.subtitulo || ''} ${(p.tags || []).join(' ')}`);
        return canonicalTerms.length === 0 || canonicalTerms.some((ct) => new RegExp(`\\b${ct}\\b`, 'i').test(full));
      });
      if (candidate) return buildPosterResult(candidate, requestedSize || aliasRes.defaultSizeId);
    }
    return findLocalMatch(tenantId, clean, requestedSize);
  }

  const normQuery = normalizeMatcherString(clean);
  const rawTokens = normQuery.split(/\s+/).filter(Boolean);
  const significantTokens = rawTokens.filter((t) => !EXTENDED_STOP_WORDS.has(t) && (t.length > 1 || KNOWN_SHORT_ENTITIES.has(t)));
  if (significantTokens.length === 0) return null;

  let candidates = [];
  try { candidates = await searchHybridPosters({ tenantId, query: clean, limit: 12 }); }
  catch { candidates = await searchWebPosters({ tenantId, query: clean, limit: 12 }); }
  if (!candidates || candidates.length === 0) return findLocalMatch(tenantId, clean, requestedSize);

  if (significantTokens.length === 1) {
    const singleToken = significantTokens[0], stemmedToken = stemMatcherToken(singleToken);
    for (const candidate of candidates) {
      const primaryTitleNorm = normalizeMatcherString(`${candidate.titulo || ''} ${candidate.subtitulo || ''}`);
      const titleTokens = primaryTitleNorm.split(/\s+/).filter(Boolean), titleStemmed = titleTokens.map(stemMatcherToken);
      const matchesTitle = titleTokens.includes(singleToken) || titleStemmed.includes(stemmedToken) || titleTokens.some((w) => w.startsWith(singleToken)) || new RegExp(`\\b${singleToken}\\b|\\b${stemmedToken}\\b`, 'i').test(primaryTitleNorm) || (stemmedToken.length >= 4 && primaryTitleNorm.replace(/\s+/g, '').includes(stemmedToken));
      if (matchesTitle) return buildPosterResult(candidate, requestedSize);
    }
    return findLocalMatch(tenantId, clean, requestedSize);
  }

  for (const candidate of candidates) {
    const primaryTitleNorm = normalizeMatcherString(`${candidate.titulo || ''} ${candidate.subtitulo || ''}`);
    const primaryWords = primaryTitleNorm.split(/\s+/).filter(Boolean), stemmedWords = primaryWords.map(stemMatcherToken);
    const matchedTokens = significantTokens.filter((t) => {
      const st = stemMatcherToken(t);
      return primaryWords.includes(t) || stemmedWords.includes(st) || new RegExp(`\\b${t}\\b|\\b${st}\\b`, 'i').test(primaryTitleNorm) || (st.length >= 4 && primaryTitleNorm.replace(/\s+/g, '').includes(st));
    });
    const coverage = matchedTokens.length / significantTokens.length;
    let franchiseCheckPassed = true;
    for (const t of significantTokens) {
      const tokenAlias = resolveEntityAlias(t);
      if (tokenAlias.matched) {
        const canonicalKey = normalizeMatcherString(tokenAlias.canonicalTitle || tokenAlias.searchQuery);
        if (!new RegExp(`\\b${t}\\b|\\b${canonicalKey}\\b`, 'i').test(primaryTitleNorm) && !(t.length >= 4 && primaryTitleNorm.replace(/\s+/g, '').includes(t))) { franchiseCheckPassed = false; break; }
      }
    }
    if (coverage >= 0.70 && franchiseCheckPassed) return buildPosterResult(candidate, requestedSize);
  }

  return findLocalMatch(tenantId, clean, requestedSize);
}
