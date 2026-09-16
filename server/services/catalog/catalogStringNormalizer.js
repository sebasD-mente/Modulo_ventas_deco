/**
 * server/services/catalog/catalogStringNormalizer.js
 * Tratamiento léxico, formateo para POS, slugs y deduplicación bicapa.
 */

export function formatProductForPos(p) {
  let parsedSizes = [];
  if (Array.isArray(p.sizes) && p.sizes.length > 0) {
    parsedSizes = p.sizes.map((s) => ({
      sizeId: s.sizeId || s.id || 'MEDIANO',
      nombre: s.nombre || s.name || 'Mediano',
      dimensiones: s.dimensiones || s.dimensions || '30 x 45 cm',
      precio: Number(s.precio || s.price || p.basePrice || 25),
      badge: s.badge || null,
    }));
  } else {
    parsedSizes = [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
    ];
  }

  let titulo = p.name || '';
  let subtitulo = '';
  if (titulo.includes(' - ')) {
    const parts = titulo.split(' - ');
    titulo = parts[0].trim();
    subtitulo = parts.slice(1).join(' - ').trim();
  }

  const minPrice = parsedSizes.length > 0
    ? parsedSizes.reduce((min, s) => Math.min(min, s.precio), Number(p.basePrice || 25))
    : Number(p.basePrice || 25);

  return {
    id: p.id,
    sku: p.sku,
    titulo,
    subtitulo,
    nombreCompleto: p.name,
    descripcion: subtitulo,
    categoria: p.category,
    imageUrl: p.imageUrl,
    thumbUrl: p.imageUrl,
    precioMinimo: minPrice,
    precioDisplay: `Q${minPrice}`,
    tags: Array.isArray(p.tags) ? p.tags : [],
    sizes: parsedSizes,
  };
}

export function extractImageSlug(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  if (!clean) return null;
  try {
    const pathname = clean.split('?')[0].split('#')[0];
    let filename = pathname.split('/').filter(Boolean).pop();
    if (!filename) return null;
    try { filename = decodeURIComponent(filename); } catch {}
    const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
    let slug = nameWithoutExt.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    slug = slug.replace(/-\d+x\d+$/, '').replace(/-thumb$/, '').replace(/-preview$/, '');
    return slug || null;
  } catch {
    return null;
  }
}

export function extractPosterTitle(poster) {
  if (!poster || typeof poster !== 'object') return '';
  if (typeof poster.nombreCompleto === 'string') return poster.nombreCompleto;
  if (typeof poster.name === 'string') return poster.name;
  const title = poster.titulo || poster.title;
  const subtitle = poster.subtitulo || poster.subtitle;
  if (typeof title === 'string') {
    return (typeof subtitle === 'string' && subtitle) ? `${title} - ${subtitle}` : title;
  }
  return '';
}

export function normalizePosterTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  return rawTitle.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`´’‘«»]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deduplicatePosters(posters) {
  if (!Array.isArray(posters) || posters.length === 0) return [];
  const seenIds = new Set(), seenImageSlugs = new Set(), seenNormalizedTitles = new Set();
  const deduplicated = [];

  for (const poster of posters) {
    if (!poster || typeof poster !== 'object') continue;
    const id = poster.id ? String(poster.id).trim() : (poster.sku ? String(poster.sku).trim() : null);
    const imageSlug = poster.imageSlug || extractImageSlug(poster.imageUrl || poster.thumbUrl);
    const rawTitle = extractPosterTitle(poster);
    const normalizedTitle = normalizePosterTitle(rawTitle);

    if (!id && !imageSlug && !normalizedTitle) continue;
    if (id && seenIds.has(id)) continue;
    if (imageSlug && seenImageSlugs.has(imageSlug)) continue;
    if (normalizedTitle && seenNormalizedTitles.has(normalizedTitle)) continue;

    if (id) seenIds.add(id);
    if (imageSlug) seenImageSlugs.add(imageSlug);
    if (normalizedTitle) seenNormalizedTitles.add(normalizedTitle);
    deduplicated.push(poster);
  }
  return deduplicated;
}
