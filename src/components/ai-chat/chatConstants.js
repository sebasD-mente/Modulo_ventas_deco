export const DEFAULT_EVENT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
];
export const SIZE_PRICE_MAP = { MINI: 25, PEQUENO: 35, MEDIANO: 65, GRANDE: 125, GIGANTE: 180 };
export const SIZE_ALIASES = [
  { re: /\b(gigante|extra\s*grande|24[xX]36|60[xX]90)\b/i, id: 'GIGANTE' },
  { re: /\b(grande|18[xX]24|45[xX]60)\b/i, id: 'GRANDE' },
  { re: /\b(mediano?|medio|12[xX]18|30[xX]45)\b/i, id: 'MEDIANO' },
  { re: /\b(peque[ñn]o|chico|8[xX]10|21[xX]27)\b/i, id: 'PEQUENO' },
  { re: /\b(mini|5[xX]7|14[xX]21)\b/i, id: 'MINI' },
];
export const PAYMENT_ALIASES = [
  { re: /\b(tarjeta|card)\b/i, method: 'TARJETA' },
  { re: /\b(transfer|transf)\b/i, method: 'TRANSFERENCIA' },
];
export const formatTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

export function buildOfflineFallbackReply(query) {
  const q = (query || '').trim();
  const qtyWords = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  let quantity = 1;
  const qtyNum = q.match(/\b([2-9]|10)\b/);
  if (qtyNum) quantity = parseInt(qtyNum[1], 10);
  else {
    for (const [w, v] of Object.entries(qtyWords)) if (new RegExp(`\\b${w}\\b`, 'i').test(q)) { quantity = v; break; }
  }
  let sizeId = 'MEDIANO';
  for (const { re, id } of SIZE_ALIASES) if (re.test(q)) { sizeId = id; break; }
  const price = SIZE_PRICE_MAP[sizeId] || 65;
  const sizeObj = DEFAULT_EVENT_SIZES.find((s) => s.sizeId === sizeId) || DEFAULT_EVENT_SIZES[2];
  let paymentMethod = 'EFECTIVO';
  for (const { re, method } of PAYMENT_ALIASES) if (re.test(q)) { paymentMethod = method; break; }

  const posterName = q
    .replace(/\b(mini|pequeño|mediano|grande|gigante|extra\s*grande|18x24|12x18|24x36|tarjeta|transfer|efectivo|uno|dos|tres|cuatro|cinco|[0-9]+)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'Póster';
  const subtotal = quantity * price;
  const draft = {
    items: [{ description: `${posterName} (${sizeObj.nombre})`, quantity, unitPrice: price, subtotal, sizeId, availableSizes: DEFAULT_EVENT_SIZES }],
    total: subtotal,
    paymentMethod,
    inputChannel: 'IA_CHAT_TEXTO',
    notes: '[Modo offline — verificar obra antes de confirmar]',
  };
  return {
    text: `📡 **Sin conexión a Gemini.** Generé un borrador aproximado con motor local:\n"${posterName} × ${quantity} (${sizeObj.nombre}) = Q${subtotal}"\n⚠️ Por favor verifica el nombre y precio antes de confirmar.`,
    draft,
    draftSale: draft,
  };
}