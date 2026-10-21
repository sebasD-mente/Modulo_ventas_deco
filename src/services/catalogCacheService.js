export const STANDARD_POSTER_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 100 cm', precio: 210 },
];
export const ALBUM_POSTER_SIZES = [
  { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: '🎵 Vinilo' },
];
export const CANONICAL_SIZES = [
  STANDARD_POSTER_SIZES[0],
  STANDARD_POSTER_SIZES[1],
  ALBUM_POSTER_SIZES[0],
  STANDARD_POSTER_SIZES[2],
  STANDARD_POSTER_SIZES[3],
  STANDARD_POSTER_SIZES[4],
];
export const CANONICAL_PRICE_MAP = { MINI: 25, PEQUENO: 35, PORTADA_ALBUM: 55, MEDIANO: 65, GRANDE: 125, GIGANTE: 210 };
const STORAGE_KEY = 'deko_local_catalog_snapshot_v1';
export const TIMEOUT_MS = 2500;
const MAX_LOCAL_CATALOG_ITEMS = 1000;

export const SEED_POSTERS = [
  { id: 'off-1', titulo: 'Chainsaw Man', subtitulo: 'Denji Pochita', categoria: 'ANIME', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
  { id: 'off-2', titulo: 'Spider-Man', subtitulo: 'Miles Morales', categoria: 'COMICS', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
  { id: 'off-3', titulo: 'Batman', subtitulo: 'The Dark Knight', categoria: 'COMICS', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
  { id: 'off-4', titulo: 'Van Gogh', subtitulo: 'Noche Estrellada', categoria: 'ARTE', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
  { id: 'off-5', titulo: 'Bad Bunny', subtitulo: 'Un Verano Sin Ti', categoria: 'MUSICA', precioMinimo: 55, imageUrl: '/brand/logo-origami.webp', sizes: ALBUM_POSTER_SIZES },
  { id: 'off-6', titulo: 'Taylor Swift', subtitulo: 'Midnights', categoria: 'MUSICA', precioMinimo: 55, imageUrl: '/brand/logo-origami.webp', sizes: ALBUM_POSTER_SIZES },
  { id: 'off-7', titulo: 'Star Wars', subtitulo: 'Darth Vader', categoria: 'CINE', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
  { id: 'off-8', titulo: 'Dragon Ball Z', subtitulo: 'Goku Super Saiyan', categoria: 'ANIME', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: STANDARD_POSTER_SIZES },
];

export function getLocalCatalog() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; }
  } catch (_) {}
  return SEED_POSTERS;
}

export function saveCatalogSnapshot(posters, options = {}) {
  if (!Array.isArray(posters) || !posters.length || typeof localStorage === 'undefined') return;

  const persist = () => {
    try {
      const existingMap = new Map();
      const isFullBatch = Boolean(options?.replace === true || posters.length >= 50);
      if (!isFullBatch) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) parsed.forEach((it) => it?.id && existingMap.set(it.id, it));
          } catch (_) {}
        }
      }

      for (const p of posters) {
        if (!p?.id) continue;
        const isTop = Boolean(p.destacado || p.isTopSeller || p.topVentas);
        const salesCount = Number(p.totalVentas || p.ventas || p.salesCount || 0);
        const cat = (p.categoria || p.category || 'ARTE').toUpperCase();
        const fallbackSizes = cat === 'MUSICA' ? ALBUM_POSTER_SIZES : STANDARD_POSTER_SIZES;
        const sanitized = {
          id: p.id,
          titulo: p.titulo || p.name || 'Póster',
          subtitulo: p.subtitulo || '',
          categoria: cat,
          imageUrl: p.imageUrl || p.thumbUrl || '/brand/logo-origami.webp',
          thumbUrl: p.thumbUrl || p.imageUrl || '/brand/logo-origami.webp',
          precioMinimo: Number(p.precioMinimo) || (cat === 'MUSICA' ? 55 : 25),
          sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : fallbackSizes,
          destacado: isTop,
          totalVentas: salesCount,
          tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
        };
        existingMap.set(sanitized.id, sanitized);
      }

      const merged = Array.from(existingMap.values());
      let finalItems = merged;
      if (merged.length > MAX_LOCAL_CATALOG_ITEMS) {
        const topPosters = [];
        const standardPosters = [];
        for (const item of merged) {
          if (item.destacado || (item.totalVentas && item.totalVentas > 0)) {
            topPosters.push(item);
          } else {
            standardPosters.push(item);
          }
        }
        if (topPosters.length === 0) {
          finalItems = merged.slice(-MAX_LOCAL_CATALOG_ITEMS);
        } else {
          topPosters.sort((a, b) => (b.totalVentas || 0) - (a.totalVentas || 0));
          if (topPosters.length >= MAX_LOCAL_CATALOG_ITEMS) {
            finalItems = topPosters.slice(0, MAX_LOCAL_CATALOG_ITEMS);
          } else {
            const remainingSlots = MAX_LOCAL_CATALOG_ITEMS - topPosters.length;
            const retainedStandard = standardPosters.slice(-remainingSlots);
            finalItems = [...topPosters, ...retainedStandard];
          }
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalItems));
    } catch (_) {}
  };

  const isSync = Boolean(
    options?.sync ||
    typeof window === 'undefined' ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
  );

  if (isSync) {
    persist();
  } else {
    setTimeout(persist, 0);
  }
}

export function searchLocalCatalog(query = '', limit = 8) {
  const q = query.trim().toLowerCase(), catalog = getLocalCatalog();
  if (!q) return catalog.slice(0, limit);
  const words = q.split(/\s+/).filter(Boolean);
  return catalog.filter((p) => {
    const tagList = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [];
    const tagTokens = tagList.flatMap((t) => t.split(/\s+/)).filter(Boolean);
    const allTags = Array.from(new Set([...tagList, ...tagTokens]));
    const raw = `${p.titulo || ''} ${p.subtitulo || ''} ${p.categoria || ''} ${allTags.join(' ')}`.toLowerCase();
    const clean = raw.replace(/[-_]/g, ' ');
    const compact = raw.replace(/[^a-z0-9]/g, '');

    return words.every((w) => {
      if (raw.includes(w) || clean.includes(w) || compact.includes(w.replace(/[^a-z0-9]/g, ''))) return true;
      return allTags.some((t) => t.startsWith(w) || w.startsWith(t) || (w.length >= 4 && t.includes(w)) || (t.length >= 4 && w.includes(t)));
    });
  }).slice(0, limit);
}


export async function searchPostersWithFallback(fetchFn, query = '', limit = 8, options = TIMEOUT_MS) {
  const isSignal = (typeof AbortSignal !== 'undefined' && options instanceof AbortSignal) ||
    Boolean(options && typeof options.aborted === 'boolean' && typeof options.addEventListener === 'function');
  const isOptionsObj = typeof options === 'object' && options !== null && !isSignal;
  const timeoutMs = typeof options === 'number'
    ? options
    : (isOptionsObj && typeof options.timeoutMs === 'number' ? options.timeoutMs : TIMEOUT_MS);
  const externalSignal = isSignal ? options : (isOptionsObj ? options.signal : null);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => {
    try {
      controller.abort(new Error('TIMEOUT_EXCEEDED'));
    } catch (_) {
      controller.abort();
    }
  }, timeoutMs) : null;

  let removeAbortListener = null;
  if (externalSignal && controller) {
    if (externalSignal.aborted) {
      try {
        controller.abort(externalSignal.reason);
      } catch (_) {
        controller.abort();
      }
    } else {
      const onAbort = () => {
        try {
          controller.abort(externalSignal.reason);
        } catch (_) {
          controller.abort();
        }
      };
      externalSignal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => {
        try {
          externalSignal.removeEventListener('abort', onAbort);
        } catch (_) {}
      };
    }
  }

  try {
    const result = await fetchFn(controller?.signal || externalSignal);
    if (timeoutId) clearTimeout(timeoutId);
    if (removeAbortListener) removeAbortListener();
    if (Array.isArray(result) && result.length > 0) {
      saveCatalogSnapshot(result);
      return result;
    }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (removeAbortListener) removeAbortListener();
    if (externalSignal?.aborted || err?.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw err;
      }
    }
    console.warn('[catalogCacheService] Fallback a snapshot local:', err?.message || 'timeout 1.5s');
  }
  return searchLocalCatalog(query, limit);
}
