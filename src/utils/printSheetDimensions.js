/**
 * 📐 DIMENSIONES Y CÁLCULO GEOMÉTRICO DE PLIEGOS DE TALLER (STAND IA)
 * Superficie estándar de pliego: 70 x 100 cm = 7,000 cm².
 */

export const SIZE_AREAS_CM2 = {
  MINI: 14 * 21, // 294 cm²
  PEQUENO: 20 * 25, // 500 cm²
  PORTADA_ALBUM: 30 * 30, // 900 cm²
  MEDIANO: 30 * 40, // 1,200 cm²
  GRANDE: 40 * 50, // 2,000 cm²
  GIGANTE: 60 * 80, // 4,800 cm²
};

export const STANDARD_SHEET_AREA_CM2 = 70 * 100; // 7,000 cm²

export function getItemAreaCm2(item) {
  if (!item) return SIZE_AREAS_CM2.MEDIANO;
  const sizeKey = (item.size || item.sizeId || item.selectedSizeId || '').toUpperCase();
  if (SIZE_AREAS_CM2[sizeKey]) return SIZE_AREAS_CM2[sizeKey];

  const desc = (item.description || item.title || '').toUpperCase();
  if (desc.includes('GIGANTE')) return SIZE_AREAS_CM2.GIGANTE;
  if (desc.includes('GRANDE')) return SIZE_AREAS_CM2.GRANDE;
  if (desc.includes('PORTADA') || desc.includes('ALBUM') || desc.includes('ÁLBUM')) return SIZE_AREAS_CM2.PORTADA_ALBUM;
  if (desc.includes('PEQUEÑO') || desc.includes('PEQUENO')) return SIZE_AREAS_CM2.PEQUENO;
  if (desc.includes('MINI')) return SIZE_AREAS_CM2.MINI;

  return SIZE_AREAS_CM2.MEDIANO;
}
