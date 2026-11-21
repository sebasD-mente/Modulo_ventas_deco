export const EDITABLE_OFFICIAL_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 100 cm', precio: 210 },
];

export const EDITABLE_RECT_SIZES = EDITABLE_OFFICIAL_SIZES.filter((s) => s.sizeId !== 'PORTADA_ALBUM');

const SIZE_ORDER = ['MINI', 'PEQUENO', 'PORTADA_ALBUM', 'MEDIANO', 'GRANDE', 'GIGANTE'];

const TRAILING_SIZE_RE = /\s*\((?:mini|peque[ñn]o|portada(?:\s+de)?\s+[aá]lbum|portada_album|portada|mediano|grande|gigante)\)\s*$/i;

export function normalizeStandardSizeId(rawLabelOrId, fallbackUnitPrice = null) {
  if (rawLabelOrId) {
    const raw = String(rawLabelOrId).trim().toLowerCase();
    if (raw === 'mini') return 'MINI';
    if (raw === 'pequeno' || raw === 'pequeño') return 'PEQUENO';
    if (raw === 'portada_album' || raw.includes('portada') || raw.includes('álbum') || raw.includes('album')) return 'PORTADA_ALBUM';
    if (raw === 'mediano') return 'MEDIANO';
    if (raw === 'grande') return 'GRANDE';
    if (raw === 'gigante') return 'GIGANTE';
  }
  const numPrice = Number(fallbackUnitPrice);
  if (Number.isFinite(numPrice) && numPrice > 0) {
    const byPrice = EDITABLE_OFFICIAL_SIZES.find((s) => Math.abs(s.precio - numPrice) < 0.01);
    if (byPrice) return byPrice.sizeId;
  }
  return null;
}

export function extractTrailingSizeLabel(description = '') {
  const m = String(description || '').trim().match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

export function stripTrailingStandardSize(description = '') {
  return String(description || '').replace(TRAILING_SIZE_RE, '').trim();
}

export function normalizeSizeOption(rawSize = {}) {
  const sizeId = normalizeStandardSizeId(rawSize.sizeId || rawSize.id || rawSize.nombre || rawSize.name, rawSize.precio || rawSize.price)
    || String(rawSize.sizeId || rawSize.id || 'MEDIANO').toUpperCase();
  const canonical = EDITABLE_OFFICIAL_SIZES.find((s) => s.sizeId === sizeId);
  return {
    sizeId,
    nombre: rawSize.nombre || rawSize.name || canonical?.nombre || sizeId,
    precio: Number(rawSize.precio ?? rawSize.price ?? canonical?.precio ?? 65),
  };
}

export function resolveEditableItemSizes(item = {}) {
  const desc = String(item.description || '').toLowerCase();
  const isCustomItem = Boolean(
    item.isCustom === true ||
    item.customDimensions ||
    desc.includes('personalizado:') ||
    desc.includes('medida especial') ||
    desc.includes('corte taller')
  );
  if (isCustomItem) return [];

  const detectedId = item.selectedSizeId || normalizeStandardSizeId(extractTrailingSizeLabel(item.description), item.unitPrice);
  const sourceSizes = Array.isArray(item.availableSizes) && item.availableSizes.length > 0
    ? item.availableSizes
    : (Array.isArray(item.product?.sizes) && item.product.sizes.length > 0 ? item.product.sizes : null);

  let list = sourceSizes
    ? sourceSizes.map(normalizeSizeOption)
    : [...EDITABLE_RECT_SIZES];

  if (detectedId && !list.some((s) => s.sizeId === detectedId)) {
    const match = EDITABLE_OFFICIAL_SIZES.find((s) => s.sizeId === detectedId);
    if (match) list = [...list, match];
  }

  return list.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.sizeId);
    const ib = SIZE_ORDER.indexOf(b.sizeId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function hydrateEditableSaleItem(it = {}) {
  const unitPrice = Number(it.unitPrice) || 0;
  const quantity = Number(it.quantity) || 1;
  const selectedSizeId = it.selectedSizeId || normalizeStandardSizeId(extractTrailingSizeLabel(it.description), unitPrice);
  const availableSizes = resolveEditableItemSizes({ ...it, unitPrice, selectedSizeId });
  return {
    id: it.id,
    productId: it.productId || null,
    description: it.description || '',
    quantity,
    unitPrice,
    subtotal: Number(it.subtotal ?? (quantity * unitPrice).toFixed(2)) || Number((quantity * unitPrice).toFixed(2)),
    product: it.product || null,
    imageUrl: it.customImageUrl || it.imageUrl || it.product?.imageUrl || null,
    thumbUrl: it.thumbUrl || null,
    customImageUrl: it.customImageUrl || null,
    productionNotes: it.productionNotes || null,
    isCustom: Boolean(it.isCustom),
    material: it.material || null,
    customDimensions: it.customDimensions || null,
    selectedSizeId,
    availableSizes,
  };
}

export function buildSizeChangedFields(current, newSize) {
  const norm = normalizeSizeOption(newSize);
  const cleanBase = stripTrailingStandardSize(current.description) || current.description || 'Póster';
  const nextPrice = Number(norm.precio) || Number(current.unitPrice) || 65;
  return {
    description: `${cleanBase} (${norm.nombre})`,
    unitPrice: nextPrice,
    selectedSizeId: norm.sizeId,
    subtotal: Number((current.quantity * nextPrice).toFixed(2)),
  };
}

export function buildReplacedPosterFields(current, newPoster) {
  const currentSizeId = current.selectedSizeId || normalizeStandardSizeId(extractTrailingSizeLabel(current.description), current.unitPrice);
  const posterSizes = Array.isArray(newPoster.sizes) && newPoster.sizes.length > 0
    ? newPoster.sizes.map(normalizeSizeOption)
    : [...EDITABLE_RECT_SIZES];
  const matched = (currentSizeId && posterSizes.find((s) => s.sizeId === currentSizeId))
    || posterSizes.find((s) => Math.abs(s.precio - Number(current.unitPrice)) < 0.01)
    || posterSizes[0];
  const sizeLabel = matched?.nombre || extractTrailingSizeLabel(current.description);
  const nextUnitPrice = matched?.precio || Number(current.unitPrice) || 65;
  const baseTitle = newPoster.subtitulo ? `${newPoster.titulo} - ${newPoster.subtitulo}` : newPoster.titulo;
  return {
    baseTitle,
    nextDescription: sizeLabel ? `Póster ${baseTitle} (${sizeLabel})` : `Póster ${baseTitle}`,
    nextUnitPrice,
    selectedSizeId: matched?.sizeId || currentSizeId || null,
    availableSizes: posterSizes,
  };
}
