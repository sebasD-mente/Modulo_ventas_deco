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
