/**
 * server/services/catalog/catalogSizeResolver.js
 * Resolución y normalización de tamaños estándar para pósters de eventos.
 */

export const STANDARD_EVENT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25, badge: 'Escritorio y coleccionable' },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35, badge: 'Espacios reducidos' },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125, badge: 'Salas y cabeceras' },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180, badge: 'Formato mural' },
];

export const ALBUM_COVER_SIZE = {
  sizeId: 'PORTADA_ALBUM',
  nombre: 'Portada de Álbum',
  dimensiones: '30 x 30 cm',
  precio: 55,
  badge: 'Formato vinilo cuadrado para música',
};

export const SIZE_CATALOG_MAP = {
  MINI: STANDARD_EVENT_SIZES[0],
  PEQUENO: STANDARD_EVENT_SIZES[1],
  PORTADA_ALBUM: ALBUM_COVER_SIZE,
  MEDIANO: STANDARD_EVENT_SIZES[2],
  GRANDE: STANDARD_EVENT_SIZES[3],
  GIGANTE: STANDARD_EVENT_SIZES[4],
};

export const STANDARD_SIZES_MAP = SIZE_CATALOG_MAP;
export const STANDARD_SIZES = SIZE_CATALOG_MAP;

/**
 * Normaliza cualquier denominación o medida ingresada al ID canónico de talla.
 */
export function normalizeCatalogSizeId(requestedSize) {
  if (!requestedSize) return 'MEDIANO';
  const raw = String(requestedSize).toLowerCase().trim();
  const compact = raw.replace(/\s+/g, '').replace(/pulgadas?|pulg?|inches?|in\b|"|cms?|cent[ií]metros?/gi, '').replace(/por|\*|x/gi, 'x');
  if (/30x30|12x12|vinilo|album|[aá]lbum|portada|cuadrad[oa]|disco/.test(compact) || /\b(portada|album|[aá]lbum|vinilo|cuadrad[oa]|disco)\b/i.test(raw)) return 'PORTADA_ALBUM';
  if (/18x24|24x18|45x60|60x45/.test(compact) || /\b(grande|large|l)\b/i.test(raw)) return 'GRANDE';
  if (/24x36|36x24|60x90|90x60/.test(compact) || /\b(gigante|extra\s*grande|xl)\b/i.test(raw)) return 'GIGANTE';
  if (/12x18|18x12|30x45|45x30/.test(compact) || /\b(mediano|medio|medium|m)\b/i.test(raw)) return 'MEDIANO';
  if (/8(\.5)?x1[01]|1[01]x8(\.5)?|21x27|27x21/.test(compact) || /\b(peque[ñn]o|chico|small|s)\b/i.test(raw)) return 'PEQUENO';
  if (/5x7|7x5|6x8|8x6|14x21|21x14/.test(compact) || /\b(mini|miniatura|xs)\b/i.test(raw)) return 'MINI';
  return raw.toUpperCase();
}

/**
 * Valida el unitPrice contra los precios oficiales del catálogo ferial (Hallazgo #38).
 */
export function validateOfficialItemPrice(item, productRecord = null) {
  if (!item) return;
  const unitPrice = Number(item.unitPrice);
  const desc = String(item.description || '').toLowerCase();
  const isCustom = Boolean(
    item.isCustom === true ||
    item.customDimensions ||
    item.customImageUrl ||
    desc.includes('[personalizado]') ||
    desc.includes('personalizado') ||
    desc.includes('medida especial') ||
    desc.includes('corte especial')
  );

  if (isCustom) {
    if (isNaN(unitPrice) || unitPrice <= 0) {
      const err = new Error(`El precio unitario de ítem personalizado debe ser mayor a 0.`);
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  // Detectar talla explícita o entre paréntesis en descripción
  let detectedSizeId = item.sizeId ? normalizeCatalogSizeId(item.sizeId) : null;
  if (!detectedSizeId) {
    const parenMatch = item.description?.match(/\((Mini|Pequeño|Peque\u00f1o|Pequeno|Portada de [A\u00c1]lbum|Portada [A\u00c1]lbum|Portada|Mediano|Grande|Gigante)\)/i);
    if (parenMatch) {
      detectedSizeId = normalizeCatalogSizeId(parenMatch[1]);
    }
  }

  if (productRecord && Array.isArray(productRecord.sizes) && productRecord.sizes.length > 0) {
    const rawSizes = productRecord.sizes;
    if (detectedSizeId) {
      const matchedSize = rawSizes.find(s => (s.sizeId || s.id) === detectedSizeId) || SIZE_CATALOG_MAP[detectedSizeId];
      if (matchedSize) {
        const officialPrice = Number(matchedSize.precio || matchedSize.price);
        if (Math.abs(unitPrice - officialPrice) > 0.01) {
          const err = new Error(`El precio unitario (Q${unitPrice.toFixed(2)}) no coincide con el precio oficial de la talla ${matchedSize.nombre || detectedSizeId} (Q${officialPrice.toFixed(2)}).`);
          err.statusCode = 400;
          throw err;
        }
        return;
      }
    }
  } else if (detectedSizeId && SIZE_CATALOG_MAP[detectedSizeId]) {
    // Si no hay productRecord con arreglo sizes, pero hay detectedSizeId canónico
    // Solo validamos si es un producto estándar con precio no coincidente y hay clara intención de talla estándar
    const officialSize = SIZE_CATALOG_MAP[detectedSizeId];
    const officialPrice = Number(officialSize.precio);
    if (Math.abs(unitPrice - officialPrice) > 0.01) {
      const err = new Error(`El precio unitario (Q${unitPrice.toFixed(2)}) no coincide con el precio oficial de la talla ${officialSize.nombre} (Q${officialPrice.toFixed(2)}).`);
      err.statusCode = 400;
      throw err;
    }
  }
}

/**
 * Construye y normaliza la lista de tamaños legítimos para un póster sin contaminación cruzada.
 * @param {object} poster - Objeto del póster crudo desde la API web o DB.
 * @returns {Array} - Tamaños normalizados.
 */
export function resolvePosterSizes(poster) {
  if (Array.isArray(poster?.sizes) && poster.sizes.length > 0) {
    const valid = poster.sizes.filter(s => s && s.isActive !== false).map(s => {
      const sId = s.id || s.sizeId;
      const ref = SIZE_CATALOG_MAP[sId];
      return {
        sizeId: sId,
        nombre: s.nombre || s.name || ref?.nombre || sId,
        dimensiones: s.dimensiones || s.dimensions || ref?.dimensiones || '',
        precio: Number(s.precio || s.price || ref?.precio || 25),
        badge: s.badge || ref?.badge || null,
      };
    });
    if (valid.length > 0) return valid;
  }

  if (Array.isArray(poster?.availableSizes) && poster.availableSizes.length > 0) {
    const resolved = poster.availableSizes
      .map(sId => SIZE_CATALOG_MAP[sId])
      .filter(Boolean);
    if (resolved.length > 0) return resolved;
  }

  return [...STANDARD_EVENT_SIZES];
}
