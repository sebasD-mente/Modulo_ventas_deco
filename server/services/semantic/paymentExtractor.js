import { resolveEntityAlias } from './entityAliases.js';

/**
 * Normaliza cadenas de texto para comparaciones léxicas robustas:
 * minúsculas, eliminación de diacríticos/tildes y espacios redundantes.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSemanticText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!¿¡,.:;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. EXTRACTOR ROBUSTO DE MÉTODOS DE PAGO
 * ─────────────────────────────────────────────────────────────────────────────
 * Extrae determinísticamente si el cliente/vendedor indicó TARJETA, TRANSFERENCIA o EFECTIVO.
 * 
 * Regla de precisión:
 * La palabra "quetzales" o "quetzal" por sí sola indica moneda/precio (ej. "a 65 quetzales"),
 * NO método de pago. Por tanto, no se clasifica como EFECTIVO a menos que venga acompañado
 * de "en efectivo", "billete", "cash", "mano" o "al contado".
 */

export const PAYMENT_PATTERNS = {
  TARJETA: [
    /\b(tarjeta[s]?|pos|visa|credomatic|debito|credito|card|credit\s*card|debit\s*card|mastercard|terminal|neonet|visalink|link\s*de\s*pago)\b/i,
    /\b(con\s+tarjeta|en\s+tarjeta|por\s+pos|con\s+pos|pasa\s+la\s+tarjeta|desliza)\b/i,
  ],
  TRANSFERENCIA: [
    /\b(transferencia[s]?|transfe|transfer|deposito[s]?|banca|bi\s*en\s*linea|banco\s*industrial|banrural|bac|gyt|ach|comprobante|boleta)\b/i,
    /\b(por\s+transferencia|con\s+transferencia|por\s+transfe|por\s+deposito|banca\s*movil)\b/i,
  ],
  EFECTIVO: [
    /\b(efectivo|billete[s]?|cash|cashito|en\s+mano|al\s+contado|contado|suelto|sencillo|vuelto|cambio)\b/i,
    /\b(en\s+efectivo|con\s+efectivo|pago\s+en\s+mano|con\s+billete)\b/i,
  ],
};

/**
 * Extrae el método de pago a partir de texto libre o transcripción de voz.
 * @param {string} text - Mensaje del usuario o dictado de voz.
 * @returns {'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO' | null} Método canónico o null si no se especificó.
 */
export function extractPaymentMethod(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = normalizeSemanticText(text);

  // 1. Evaluación contextual prioritaria con preposiciones ("en tarjeta", "por transferencia", "en efectivo")
  if (/\b(en|con|por|mediante|via|vía)\s+(tarjeta|pos|visa|credomatic|debito|credito|card)\b/i.test(clean)) {
    return 'TARJETA';
  }
  if (/\b(en|con|por|mediante|via|vía)\s+(transferencia|transfe|transfer|deposito|banca|ach)\b/i.test(clean)) {
    return 'TRANSFERENCIA';
  }
  if (/\b(en|con|por|mediante|al)\s+(efectivo|cash|billete|mano|contado)\b/i.test(clean)) {
    return 'EFECTIVO';
  }

  // 2. Coincidencia por patrones directos individuales con límites de palabra
  for (const pattern of PAYMENT_PATTERNS.TARJETA) {
    if (pattern.test(clean)) return 'TARJETA';
  }
  for (const pattern of PAYMENT_PATTERNS.TRANSFERENCIA) {
    if (pattern.test(clean)) return 'TRANSFERENCIA';
  }
  for (const pattern of PAYMENT_PATTERNS.EFECTIVO) {
    if (pattern.test(clean)) return 'EFECTIVO';
  }

  return null;
}

export const NUMBER_WORDS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

/**
 * Extrae la cantidad numérica entera mencionada en un segmento.
 * @param {string} segment
 * @returns {number}
 */
export function extractQuantity(segment) {
  const numMatch = segment.match(/\b([1-9]|10)\b/);
  if (numMatch) return parseInt(numMatch[1], 10);

  const clean = normalizeSemanticText(segment);
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(clean)) return val;
  }
  return 1;
}

/**
 * Extrae el identificador de tamaño normalizado de un segmento de texto.
 * @param {string} segment
 * @returns {string|null}
 */
export function extractSizeIdFromSegment(segment) {
  const clean = normalizeSemanticText(segment);

  // 1. Portada de Álbum / Vinilo cuadrado
  if (/\b(portada|portada\s*de\s*album|vinilo|album|álbum|cuadrad[oa]|disco|12\s*x\s*12|30\s*x\s*30)\b/i.test(clean)) {
    return 'PORTADA_ALBUM';
  }
  // 2. Gigante
  if (/\b(gigante|extra\s*grande|xl|24\s*x\s*36|36\s*x\s*24|60\s*x\s*90|90\s*x\s*60)\b/i.test(clean)) {
    return 'GIGANTE';
  }
  // 3. Grande
  if (/\b(grande|large|l|18\s*x\s*24|24\s*x\s*18|45\s*x\s*60|60\s*x\s*45)\b/i.test(clean)) {
    return 'GRANDE';
  }
  // 4. Pequeño
  if (/\b(peque[ñn]o|chico|small|s|8\s*x\s*10|10\s*x\s*8|21\s*x\s*27|27\s*x\s*21)\b/i.test(clean)) {
    return 'PEQUENO';
  }
  // 5. Mini
  if (/\b(mini|miniatura|xs|5\s*x\s*7|7\s*x\s*5|6\s*x\s*8|8\s*x\s*6|14\s*x\s*21|21\s*x\s*14)\b/i.test(clean)) {
    return 'MINI';
  }
  // 6. Mediano (por defecto en pósters estándar)
  if (/\b(mediano?|medio|medium|m|12\s*x\s*18|18\s*x\s*12|30\s*x\s*45|45\s*x\s*30)\b/i.test(clean)) {
    return 'MEDIANO';
  }

  return null;
}

export const SIZE_STANDARD_PRICES = {
  MINI: 25.0,
  PEQUENO: 35.0,
  MEDIANO: 65.0,
  GRANDE: 125.0,
  GIGANTE: 180.0,
  PORTADA_ALBUM: 55.0,
};

/**
 * Parsea determinísticamente un texto libre de venta rápida en stand.
 * @param {string} text - Texto libre dictado o escrito por el vendedor.
 * @returns {object} Objeto con items estructurados, total estimado y método de pago.
 */
export function parseStandIntent(text) {
  if (!text || typeof text !== 'string') {
    return {
      isSaleIntent: false,
      paymentMethod: 'EFECTIVO',
      items: [],
      estimatedTotal: 0,
      confidence: 0,
    };
  }

  const raw = text.trim();
  const paymentMethod = extractPaymentMethod(raw) || 'EFECTIVO';
  const isExplicitSale = /\b(vendi|vendí|venta|cobro|cobre|cobré|anota|cliente\s+paga|lleva|compro|compró|pagado)\b/i.test(raw);

  // Limpiar mención del método de pago y palabras de comando para aislar las obras
  let cleanedForItems = raw
    .replace(/\b(en|con|por)\s+(tarjeta|pos|visa|credomatic|debito|credito|transferencia|transfe|deposito|efectivo|cash)\b/gi, '')
    .replace(/\b(vendi|vendí|anota\s+venta\s+de|anota|cliente\s+paga|acabo\s+de\s+cobrar|cobro|venta)\b/gi, '')
    .trim();

  // Dividir por conjunciones si hay múltiples artículos (" y ", " + ", ",")
  const segments = cleanedForItems
    .split(/\s+y\s+|\s*\+\s*|,\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const parsedItems = [];
  let grandTotal = 0;

  for (const seg of segments) {
    const qty = extractQuantity(seg);
    let sizeId = extractSizeIdFromSegment(seg);

    // Aislar nombre de la obra removiendo cantidad y tamaño del segmento
    let rawTitle = seg
      .replace(/\b([1-9]|10|un|uno|una|dos|tres|cuatro|cinco)\b/gi, '')
      .replace(/\b(de|el|la|los|las|un|una|en|a|por|poster|cuadro|obra)\b/gi, '')
      .replace(/\b(portada|portada\s*de\s*album|vinilo|disco|cuadrad[oa]|gigante|grande|mediano|pequeno|pequeño|mini)\b/gi, '')
      .replace(/\b(18x24|12x18|24x36|30x45|45x60|60x90|14x21|21x27|12x12|30x30)\b/gi, '')
      .replace(/\b(\d+(\.\d+)?\s*quetzales|q\s*\d+)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!rawTitle) rawTitle = 'Póster';

    // Resolver con diccionario cultural de entidades
    const aliasRes = resolveEntityAlias(rawTitle);
    const canonicalName = (aliasRes.matched && aliasRes.exactMatch) ? aliasRes.canonicalTitle : rawTitle;
    const effectiveSearchQuery = aliasRes.matched ? aliasRes.searchQuery : rawTitle;

    // Si el tamaño no se mencionó explícitamente pero el alias tiene defaultSizeId (ej. música -> PORTADA_ALBUM)
    if (!sizeId) {
      sizeId = aliasRes.defaultSizeId || 'MEDIANO';
    }

    const unitPrice = SIZE_STANDARD_PRICES[sizeId] || 65.0;
    const subtotal = Number((qty * unitPrice).toFixed(2));
    grandTotal += subtotal;

    parsedItems.push({
      rawTitle,
      canonicalName,
      searchQuery: effectiveSearchQuery,
      quantity: qty,
      sizeId,
      unitPrice,
      subtotal,
    });
  }

  return {
    isSaleIntent: isExplicitSale || parsedItems.length > 0,
    paymentMethod,
    items: parsedItems,
    estimatedTotal: Number(grandTotal.toFixed(2)),
    confidence: parsedItems.length > 0 ? 0.95 : 0.4,
  };
}
