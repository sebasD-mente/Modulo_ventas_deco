export const DEFAULT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 },
  { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
];

export const SIZE_CLEANUP_REGEX =
  /\s*\((MINI|PEQUEÑO|PEQUENO|MEDIANO|GRANDE|GIGANTE|PORTADA_ALBUM|PORTADA|PORTADA ÁLBUM)\)/gi;

export const PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

export default {
  DEFAULT_SIZES,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
};
