export const STANDARD_POSTER_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
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
export const CANONICAL_PRICE_MAP = { MINI: 25, PEQUENO: 35, PORTADA_ALBUM: 55, MEDIANO: 65, GRANDE: 125, GIGANTE: 180 };
const STORAGE_KEY = 'deko_local_catalog_snapshot_v1';
const TIMEOUT_MS = 5000;
const MAX_LOCAL_CATALOG_ITEMS = 300;

export const SEED_POSTERS = [
  { id: 'off-1', titulo: 'Chainsaw Man', subtitulo: 'Denji Pochita', categoria: 'ANIME', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-2', titulo: 'Spider-Man', subtitulo: 'Miles Morales', categoria: 'COMICS', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-3', titulo: 'Batman', subtitulo: 'The Dark Knight', categoria: 'COMICS', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-4', titulo: 'Van Gogh', subtitulo: 'Noche Estrellada', categoria: 'ARTE', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-5', titulo: 'Bad Bunny', subtitulo: 'Un Verano Sin Ti', categoria: 'MUSICA', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-6', titulo: 'Taylor Swift', subtitulo: 'Midnights', categoria: 'MUSICA', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-7', titulo: 'Star Wars', subtitulo: 'Darth Vader', categoria: 'CINE', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
  { id: 'off-8', titulo: 'Dragon Ball Z', subtitulo: 'Goku Super Saiyan', categoria: 'ANIME', precioMinimo: 25, imageUrl: '/brand/logo-origami.webp', sizes: CANONICAL_SIZES },
];

export function getLocalCatalog() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; }
  } catch (_) {}
  return SEED_POSTERS;
}

export function saveCatalogSnapshot(posters) {
  if (!Array.isArray(posters) || !posters.length || typeof localStorage === 'undefined') return;
  try {
    const existingMap = new Map();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach((it) => it?.id && existingMap.set(it.id, it));
      } catch (_) {}
    }

    for (const p of posters) {
      if (!p?.id) continue;
      const sanitized = {
        id: p.id,
        titulo: p.titulo || p.name || 'Póster',
        subtitulo: p.subtitulo || '',
        categoria: p.categoria || p.category || 'ARTE',
        imageUrl: p.imageUrl || p.thumbUrl || '/brand/logo-origami.webp',
        thumbUrl: p.thumbUrl || p.imageUrl || '/brand/logo-origami.webp',
        precioMinimo: Number(p.precioMinimo) || 25,
        sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : CANONICAL_SIZES,
      };
      existingMap.set(sanitized.id, sanitized);
    }

    const merged = Array.from(existingMap.values());
    const finalItems = merged.length > MAX_LOCAL_CATALOG_ITEMS ? merged.slice(-MAX_LOCAL_CATALOG_ITEMS) : merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalItems));
  } catch (_) {}
}

export function searchLocalCatalog(query = '', limit = 8) {
  const q = query.trim().toLowerCase(), catalog = getLocalCatalog();
  if (!q) return catalog.slice(0, limit);
  const words = q.split(/\s+/).filter(Boolean);
  return catalog.filter((p) => words.every((w) => `${p.titulo} ${p.subtitulo || ''} ${p.categoria || ''}`.toLowerCase().includes(w))).slice(0, limit);
}

export async function searchPostersWithFallback(fetchFn, query = '', limit = 8, timeoutMs = TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const result = await fetchFn(controller?.signal);
    if (timeoutId) clearTimeout(timeoutId);
    if (Array.isArray(result) && result.length > 0) { saveCatalogSnapshot(result); return result; }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('[catalogCacheService] Fallback a snapshot local:', err?.message || 'timeout 2s');
  }
  return searchLocalCatalog(query, limit);
}
