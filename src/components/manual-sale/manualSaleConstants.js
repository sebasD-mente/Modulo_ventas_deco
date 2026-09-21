export const OFFICIAL_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', anchoCm: 14, altoCm: 21, precio: 25.00, badge: 'Escritorio y coleccionables' },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', anchoCm: 21, altoCm: 27, precio: 35.00, badge: 'Espacios reducidos y cabeceras' },
  { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', anchoCm: 30, altoCm: 30, precio: 55.00, badge: 'Formato vinilo cuadrado música' },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', anchoCm: 30, altoCm: 45, precio: 65.00, badge: '⭐ El más vendido para habitaciones' },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', anchoCm: 45, altoCm: 60, precio: 125.00, badge: 'Protagonista para salas y oficinas' },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 100 cm', anchoCm: 60, altoCm: 100, precio: 210.00, badge: 'Impacto visual monumental' },
];

export const DEFAULT_SIZES = OFFICIAL_SIZES;

// Constantes comerciales paramétricas para pedidos personalizados
export const CUSTOM_CM2_RATE = 0.048;
export const WOOD_CUSTOM_CUT_SURCHARGE = 25.00; // Recargo obligatorio de taller por corte especial de madera
export const PVC_SURCHARGE = 15.00; // Recargo por material PVC
export const VINYL_DISCOUNT_FACTOR = 0.50; // 50% de la base (lámina adhesiva sin cuadro)

export const SIZE_CLEANUP_REGEX =
  /\s*\((MINI|PEQUEÑO|PEQUENO|MEDIANO|GRANDE|GIGANTE|PORTADA_ALBUM|PORTADA|PORTADA ÁLBUM)\)/gi;

export const PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

export default {
  OFFICIAL_SIZES,
  DEFAULT_SIZES,
  CUSTOM_CM2_RATE,
  WOOD_CUSTOM_CUT_SURCHARGE,
  PVC_SURCHARGE,
  VINYL_DISCOUNT_FACTOR,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
};
