/**
 * Motor puro de cálculo para pósters y cuadros personalizados (Capa 1: utils).
 * Paridad matemática exacta al centavo con Web Deco Vintage:
 * - Tasa base de impresión por cm²: Q 0.048
 * - Medida Especial MDF 5.5mm: + Q 25.00 de corte especial en taller
 * - Material PVC 5mm: + Q 15.00 (estándar o especial)
 * - Vinilo Solo (lámina adhesiva): 50% de la base (sin recargo de corte)
 */

export const CUSTOM_MIN_CM = 5;
export const CUSTOM_MAX_CM = 300;
export const DEFAULT_CUSTOM_CM2_RATE = 0.048;
export const DEFAULT_WOOD_CUSTOM_CUT_SURCHARGE = 25.00;
export const DEFAULT_PVC_SURCHARGE = 15.00;
export const DEFAULT_VINYL_FACTOR = 0.50;

/**
 * Normaliza entradas decimales en centímetros aceptando punto o coma ('42.2' o '42,2' -> 42.2).
 */
export function parseDecimalCm(raw) {
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return 0;
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized) return 0;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Formatea una medida decimal limpia hasta 2 decimales sin ceros sobrantes ('42,20' -> '42.2', '30.00' -> '30').
 */
export function formatDecimalCm(raw) {
  const num = parseDecimalCm(raw);
  if (num <= 0) return '';
  return String(Number(num.toFixed(2)));
}

/**
 * Valida que el ancho y alto especiales sean numéricos (enteros o decimales) dentro del rango permitido [5, 300] cm.
 */
export function validateCustomDimensions(
  customWidth,
  customHeight,
  { minCm = CUSTOM_MIN_CM, maxCm = CUSTOM_MAX_CM } = {}
) {
  const widthCm = parseDecimalCm(customWidth);
  const heightCm = parseDecimalCm(customHeight);

  if (widthCm <= 0 || heightCm <= 0) {
    return {
      valid: false,
      widthCm: 0,
      heightCm: 0,
      error: 'Ingresa un ancho y alto válidos en centímetros.',
    };
  }

  if (widthCm < minCm || heightCm < minCm || widthCm > maxCm || heightCm > maxCm) {
    return {
      valid: false,
      widthCm: Number(widthCm.toFixed(2)),
      heightCm: Number(heightCm.toFixed(2)),
      error: `Las medidas especiales deben estar entre ${minCm} cm y ${maxCm} cm.`,
    };
  }

  return {
    valid: true,
    widthCm: Number(widthCm.toFixed(2)),
    heightCm: Number(heightCm.toFixed(2)),
    error: '',
  };
}

/**
 * Normaliza identificadores de material entre Módulo de Ventas y Web Deco Vintage.
 */
export function normalizePosterMaterial(material) {
  const raw = String(material || 'MDF_5_5MM').trim().toUpperCase();
  if (raw === 'PVC_5MM' || raw === 'PVC') return 'PVC_5MM';
  if (raw === 'VINILO_SOLO' || raw === 'VINYL_ONLY' || raw === 'VINILO') return 'VINILO_SOLO';
  return 'MDF_5_5MM';
}

/**
 * Calcula área, impresión base, precio unitario redondeado a 2 decimales y subtotal exacto.
 */
export function calculateCustomPosterPrice({
  mode = 'STANDARD',
  material = 'MDF_5_5MM',
  selectedSize = null,
  customWidth = '',
  customHeight = '',
  quantity = 1,
  cm2Rate = DEFAULT_CUSTOM_CM2_RATE,
  woodCutSurcharge = DEFAULT_WOOD_CUSTOM_CUT_SURCHARGE,
  pvcSurcharge = DEFAULT_PVC_SURCHARGE,
  vinylFactor = DEFAULT_VINYL_FACTOR,
} = {}) {
  const normalizedMode = String(mode || 'STANDARD').trim().toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'STANDARD';
  const normalizedMaterial = normalizePosterMaterial(material);
  const qty = Math.max(1, Math.min(500, Math.floor(Number(quantity) || 1)));
  const safeRate = Number(cm2Rate) > 0 ? Number(cm2Rate) : DEFAULT_CUSTOM_CM2_RATE;

  if (normalizedMode === 'CUSTOM') {
    const rawW = parseDecimalCm(customWidth);
    const rawH = parseDecimalCm(customHeight);
    if (rawW <= 0 || rawH <= 0) {
      return {
        mode: normalizedMode,
        material: normalizedMaterial,
        widthCm: 0,
        heightCm: 0,
        area: 0,
        basePrint: 0,
        unitPrice: 0,
        subtotal: 0,
        totalPrice: 0,
        quantity: qty,
      };
    }

    const widthCm = Number(rawW.toFixed(2));
    const heightCm = Number(rawH.toFixed(2));
    const area = Number((widthCm * heightCm).toFixed(2));
    const rawBasePrint = area * safeRate;

    let rawUnitPrice = 0;
    if (normalizedMaterial === 'PVC_5MM') {
      rawUnitPrice = rawBasePrint + Number(pvcSurcharge);
    } else if (normalizedMaterial === 'VINILO_SOLO') {
      rawUnitPrice = rawBasePrint * Number(vinylFactor);
    } else {
      rawUnitPrice = rawBasePrint + Number(woodCutSurcharge);
    }

    const unitPrice = Number(rawUnitPrice.toFixed(2));
    const subtotal = Number((unitPrice * qty).toFixed(2));

    return {
      mode: normalizedMode,
      material: normalizedMaterial,
      widthCm,
      heightCm,
      area,
      basePrint: Number(rawBasePrint.toFixed(2)),
      unitPrice,
      subtotal,
      totalPrice: subtotal,
      quantity: qty,
    };
  }

  const stdBase = Number(selectedSize?.precio ?? selectedSize?.price ?? 0) || 0;
  if (stdBase <= 0) {
    return {
      mode: normalizedMode,
      material: normalizedMaterial,
      widthCm: 0,
      heightCm: 0,
      area: 0,
      basePrint: 0,
      unitPrice: 0,
      subtotal: 0,
      totalPrice: 0,
      quantity: qty,
    };
  }

  let rawUnitPrice = stdBase;
  if (normalizedMaterial === 'PVC_5MM') {
    rawUnitPrice = stdBase + Number(pvcSurcharge);
  } else if (normalizedMaterial === 'VINILO_SOLO') {
    rawUnitPrice = stdBase * Number(vinylFactor);
  }

  const unitPrice = Number(rawUnitPrice.toFixed(2));
  const subtotal = Number((unitPrice * qty).toFixed(2));

  return {
    mode: normalizedMode,
    material: normalizedMaterial,
    widthCm: Number(selectedSize?.anchoCm) || 0,
    heightCm: Number(selectedSize?.altoCm) || 0,
    area: 0,
    basePrint: Number(stdBase.toFixed(2)),
    unitPrice,
    subtotal,
    totalPrice: subtotal,
    quantity: qty,
  };
}
