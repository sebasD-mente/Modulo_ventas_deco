import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { searchWebPosters, searchHybridPosters, matchPosterEverywhere } from '../webCatalogService.js';
import { executeWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { voiceSaleResponseSchema, buildVoiceSalePrompt, buildArtworkRecognitionPrompt, artworkRecognitionResponseSchema, videoRecognitionResponseSchema, batchPhotoResponseSchema } from './aiPromptService.js';
import { resolveEntityAlias, normalizeArtworkQuery, UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES } from '../semantic/entityAliases.js';

export { matchPosterEverywhere };

const getActivePool = () => [ENV.GEMINI_MODEL && !ENV.GEMINI_MODEL.includes('2.5') ? ENV.GEMINI_MODEL : 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', ...MODEL_PRIORITY_POOL].filter((v, i, a) => a.indexOf(v) === i);
const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
const throwMediaError = (fn, err, msg) => { console.error(`[${fn}] ❌`, err?.message); const error = new Error(`AI_MEDIA_SERVICE_FAILED: ${err?.message || msg}`); error.code = 'AI_MEDIA_SERVICE_FAILED'; throw error; };

const ARTWORK_SHORT_ENTITIES = new Set([...(KNOWN_SHORT_ENTITIES || []), 'it', 'up', '300', 'el']);
const NEGATIVE_DOMAIN_REGEX = /\b(ramen|fideos?|noodles?|tacos?|hamburguesas?|burgers?|pizzas?|sushi|comida|platillos?|platos?|gastronom[ií]a|alimentos?|sopas?|caldos?|chashu|tonkotsu|postres?|pasteles?|bebidas?|refrescos?|ensaladas?|mariscos|calzado|zapatos?|zapatillas?|tenis|sneakers?|calcetines?|botas?|sandalias?|ropa|camisas?|camisetas?|pantalones?|vestidos?|animal(es)? vivos?|perros? vivos?|gatos? vivos?|mascotas? vivas?|utensilios? de cocina|cubiertos?|tenedores?|cucharas?|cuchillos?|vajilla|sart[eé]n(es)?|ollas?|mantel(es)?|muebles?|sof[aá]s?|camas?)\b/i;
const GRAPHIC_ART_SAFEGUARD = /\b(poster|posters|cuadro|cuadros|lamina|laminas|diseno grafico|diseño grafico|ilustracion|impresion artistica|print|wall art)\b/i;

function isNegativeDomainArtwork(visualAnalysis, primaryTitle) {
  const combined = `${visualAnalysis || ''} ${primaryTitle || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return !GRAPHIC_ART_SAFEGUARD.test(combined) && NEGATIVE_DOMAIN_REGEX.test(combined);
}

function hasLexicalArtworkRelevance({ primaryTitle, searchQuery, franchiseOrCategory, candidates, matchedTitle, matchedDescription }) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
  const getTokens = (str) => norm(str).split(' ').filter((t) => (t.length > 2 || ARTWORK_SHORT_ENTITIES.has(t)) && !UNIVERSAL_STOP_WORDS.has(t));
  const candidatePool = Array.isArray(candidates) ? candidates.join(' ') : '';
  const idToks = getTokens([primaryTitle, searchQuery, franchiseOrCategory, candidatePool].filter(Boolean).join(' '));
  const aliasRes = resolveEntityAlias(primaryTitle || searchQuery);
  if (aliasRes.matched && (aliasRes.canonicalTitle || aliasRes.searchQuery)) idToks.push(...getTokens([aliasRes.canonicalTitle, aliasRes.searchQuery].join(' ')));
  const catToks = getTokens([matchedTitle, matchedDescription].filter(Boolean).join(' '));
  if (idToks.length === 0 || catToks.length === 0) return false;
  const idStemmed = new Set(idToks.map(stem)), catStemmed = new Set(catToks.map(stem));
  for (const t of idStemmed) {
    if (catStemmed.has(t)) return true;
    for (const c of catStemmed) { if (t.length >= 4 && c.length >= 4 && (t.startsWith(c) || c.startsWith(t))) return true; }
  }
  return false;
}

export function normalizeCatalogSizeId(requestedSize) {
  if (!requestedSize) return 'MEDIANO';
  const raw = String(requestedSize).toLowerCase().trim(), compact = raw.replace(/\s+/g, '').replace(/pulgadas?|pulg?|inches?|in\b|"|cms?|cent[ií]metros?/gi, '').replace(/por|\*|x/gi, 'x');
  if (/30x30|12x12|vinilo|album|[aá]lbum|portada|cuadrad[oa]|disco/.test(compact) || /\b(portada|album|[aá]lbum|vinilo|cuadrad[oa]|disco)\b/i.test(raw)) return 'PORTADA_ALBUM';
  if (/18x24|24x18|45x60|60x45/.test(compact) || /\b(grande|large|l)\b/i.test(raw)) return 'GRANDE';
  if (/24x36|36x24|60x90|90x60/.test(compact) || /\b(gigante|extra\s*grande|xl)\b/i.test(raw)) return 'GIGANTE';
  if (/12x18|18x12|30x45|45x30/.test(compact) || /\b(mediano|medio|medium|m)\b/i.test(raw)) return 'MEDIANO';
  if (/8(\.5)?x1[01]|1[01]x8(\.5)?|21x27|27x21/.test(compact) || /\b(peque[ñn]o|chico|small|s)\b/i.test(raw)) return 'PEQUENO';
  if (/5x7|7x5|6x8|8x6|14x21|21x14/.test(compact) || /\b(mini|miniatura|xs)\b/i.test(raw)) return 'MINI';
  return raw.toUpperCase();
}

export async function processVoiceSaleAudio({ audioBuffer, mimeType = 'audio/webm', tenantId }) {
  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'DIRECT_VOICE_SALE_INFERENCE', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [{ text: buildVoiceSalePrompt() }, { inlineData: { data: audioBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: voiceSaleResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const cleanTranscription = (parsed.transcription || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    const isSale = Boolean(parsed.isSaleDetected && Array.isArray(parsed.items) && parsed.items.length > 0);
    const intent = parsed.intent || (isSale ? 'DICTADO_VENTA' : (cleanTranscription.length < 2 ? 'RUIDO_NO_VENTA' : 'SALUDO'));
    if (!isSale) return { transcription: cleanTranscription, isSaleDetected: false, intent, greeting: parsed.greeting || null, items: [], total: 0, unmatchedItems: [], suggestedPosters: [], paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ', message: 'No se identificaron pósters del catálogo en el dictado de voz. Verifica el diseño o selecciónalo en el buscador.' };
    const enrichedItems = [], unmatchedItems = [], suggestedPosters = [];
    let grandTotal = 0;
    for (const item of parsed.items) {
      const rawTitle = (item.title || item.rawName || item.name || item.productName || item.description || '').trim(), requestedSize = normalizeCatalogSizeId(item.size || 'MEDIANO');
      let matched = await matchPosterEverywhere(tenantId, rawTitle, requestedSize);
      if (!matched) {
        const aliasRes = resolveEntityAlias(rawTitle);
        if (aliasRes.matched && aliasRes.searchQuery) {
          matched = await matchPosterEverywhere(tenantId, aliasRes.searchQuery, requestedSize || aliasRes.defaultSizeId);
        }
      }
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1)), normSize = normalizeCatalogSizeId(requestedSize || matched?.sizeId || 'MEDIANO');
      if (matched && (matched.productId || matched.posterId)) {
        const unitPrice = normSize === 'PORTADA_ALBUM' ? 55.0 : Number(matched.unitPrice || 65.0), subtotal = Number((qty * unitPrice).toFixed(2));
        grandTotal += subtotal;
        enrichedItems.push({
          productId: isUuid(matched.productId) ? matched.productId : null, webPosterId: matched.posterId || null,
          description: matched.description || `${matched.baseTitle || rawTitle} (${normSize})`, baseTitle: matched.baseTitle || rawTitle,
          category: matched.category || 'ARTE', thumbUrl: matched.thumbUrl || null, imageUrl: matched.imageUrl || null,
          quantity: qty, unitPrice, subtotal, sizeId: matched.sizeId || normSize, availableSizes: matched.availableSizes || [],
        });
      } else {
        unmatchedItems.push({ rawName: rawTitle, requestedTitle: rawTitle, quantity: qty, size: normSize });
        try {
          const queryTerm = rawTitle.split(/\s+/)[0] || rawTitle, candidates = await searchWebPosters({ tenantId, query: queryTerm, limit: 3 });
          for (const c of candidates || []) {
            if (!suggestedPosters.some((p) => p.id === c.id) && suggestedPosters.length < 3) {
              suggestedPosters.push({ id: c.id, titulo: c.titulo, subtitulo: c.subtitulo, categoria: c.categoria, thumbUrl: c.thumbUrl || c.imageUrl, imageUrl: c.imageUrl, sizes: c.sizes || [], precioMinimo: c.precioMinimo || 65 });
            }
          }
        } catch (_) {}
      }
    }
    if (enrichedItems.length === 0) {
      const zeroMatchMsg = 'No se identificaron pósters del catálogo oficial en el dictado de voz. Verifica el diseño o selecciónalo en el buscador.';
      return { transcription: cleanTranscription, isSaleDetected: false, intent: cleanTranscription.length < 2 ? 'RUIDO_NO_VENTA' : 'CONSULTA_CATALOGO', greeting: parsed.greeting || null, draftSale: null, items: [], total: 0, unmatchedItems, suggestedPosters: suggestedPosters.slice(0, 3), paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ', message: zeroMatchMsg, reply: zeroMatchMsg };
    }
    const matchedList = enrichedItems.map((i) => i.baseTitle).filter(Boolean).join(', '), unmatchedList = unmatchedItems.map((i) => i.rawName || i.requestedTitle).join(', ');
    const sellerMsg = unmatchedItems.length > 0
      ? `⚠️ Se preparó la venta con ${enrichedItems.length} ítem(s) disponible(s) (${matchedList}). Atención: los siguientes productos no están en el catálogo: ${unmatchedList}.`
      : 'Audio analizado con éxito. Por favor verifica y confirma los datos de la venta.';
    return { transcription: cleanTranscription, isSaleDetected: true, intent: 'DICTADO_VENTA', greeting: parsed.greeting || null, items: enrichedItems, total: Number(grandTotal.toFixed(2)), unmatchedItems, suggestedPosters: [], paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ', message: sellerMsg, reply: sellerMsg };
  } catch (err) { throwMediaError('processVoiceSaleAudio', err, 'Error al procesar dictado de voz'); }
}

export async function recognizePosterArtworkFromImage({ imageBuffer, mimeType = 'image/jpeg', tenantId }) {
  const cleanMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const REJECTION_MESSAGE = 'La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo.';
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'RECOGNIZE_ARTWORK_IMAGE', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [
          { text: buildArtworkRecognitionPrompt() },
          { inlineData: { data: imageBuffer.toString('base64'), mimeType: cleanMime } }
        ] }],
        config: { responseMimeType: 'application/json', responseSchema: artworkRecognitionResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}'), confidence = Number(parsed.confidence || 0);
    const reject = () => ({ isArtworkDetected: false, matchedPoster: null, primaryTitle: parsed.primaryTitle || null, visualAnalysis: parsed.visualAnalysis || null, candidates: parsed.candidates || [], items: [], total: 0, draftSale: null, message: REJECTION_MESSAGE });
    if (confidence < 0.60 || (!parsed.primaryTitle && !parsed.franchiseOrCategory)) return reject();
    if (isNegativeDomainArtwork(parsed.visualAnalysis, parsed.primaryTitle)) return reject();
    const searchQuery = parsed.primaryTitle || parsed.franchiseOrCategory || null;
    const matched = searchQuery ? await matchPosterEverywhere(tenantId, searchQuery, parsed.suggestedSize || 'MEDIANO') : null;
    if (!matched) return reject();
    if (!hasLexicalArtworkRelevance({ primaryTitle: parsed.primaryTitle, searchQuery, franchiseOrCategory: parsed.franchiseOrCategory, candidates: parsed.candidates, matchedTitle: matched.baseTitle, matchedDescription: matched.description })) return reject();
    const total = matched.unitPrice || 65.0;
    const item = {
      productId: isUuid(matched.productId) ? matched.productId : null, webPosterId: matched.posterId || null,
      description: matched.description || parsed.primaryTitle || 'Póster Decorativo Reconocido', baseTitle: matched.baseTitle || parsed.primaryTitle || 'Póster',
      sizeId: matched.sizeId || 'MEDIANO', thumbUrl: matched.thumbUrl, imageUrl: matched.imageUrl, quantity: 1, unitPrice: total, subtotal: total, availableSizes: matched.availableSizes,
    };
    const draftSale = { items: [item], total, paymentMethod: 'EFECTIVO', inputChannel: 'IA_FOTO_ARTE', notes: `Reconocimiento visual: ${matched.baseTitle || parsed.primaryTitle || 'Detectado'}` };
    return {
      isArtworkDetected: true, matchedPoster: { id: matched.posterId || matched.productId, title: matched.baseTitle, category: matched.category, thumbUrl: matched.thumbUrl, imageUrl: matched.imageUrl, unitPrice: total, sizeId: matched.sizeId },
      visualAnalysis: parsed.visualAnalysis, primaryTitle: parsed.primaryTitle, confidence: parsed.confidence, candidates: parsed.candidates || [],
      items: [item], total, draftSale, paymentMethod: 'EFECTIVO', inputChannel: 'IA_FOTO_ARTE', message: 'Obra analizada y encontrada en el catálogo web. Por favor verifica y confirma.',
    };
  } catch (err) { throwMediaError('recognizePosterArtworkFromImage', err, 'Error al reconocer arte del póster'); }
}

export async function recognizePostersFromVideo({ videoBuffer, mimeType = 'video/mp4', tenantId }) {
  const cleanMime = (mimeType || 'video/mp4').split(';')[0].trim().toLowerCase();
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'RECOGNIZE_POSTERS_VIDEO', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [{ text: 'Analiza el video del mostrador de ventas: identifica cada póster visible y cuenta unidades.' }, { inlineData: { data: videoBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: videoRecognitionResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}'), enrichedItems = [];
    let grandTotal = 0;
    for (const item of parsed.postersDetected || []) {
      const matched = await matchPosterEverywhere(tenantId, item.title, item.suggestedSize || 'MEDIANO');
      const qty = item.quantity || 1, uPrice = matched?.unitPrice || 65.0, subtotal = Number((qty * uPrice).toFixed(2));
      grandTotal += subtotal;
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || item.title || 'Póster de Video', baseTitle: matched?.baseTitle || parsed.primaryTitle || item.title || 'Póster de Video', sizeId: matched?.sizeId || 'MEDIANO', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: qty, unitPrice: uPrice, subtotal, availableSizes: matched?.availableSizes });
    }
    return { summary: parsed.summary, items: enrichedItems, total: Number(grandTotal.toFixed(2)), paymentMethod: 'EFECTIVO', confidence: parsed.confidence || 0.90, inputChannel: 'IA_VIDEO_MOSTRADOR' };
  } catch (err) { throwMediaError('recognizePostersFromVideo', err, 'Error al procesar video de mostrador'); }
}

export async function processPostersBatchPhoto({ imageBuffer, mimeType = 'image/jpeg', tenantId }) {
  let catalogMap = '';
  try {
    const products = await prisma.product.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, basePrice: true, sku: true, qrCodeData: true, barcode: true } });
    catalogMap = products.map((p) => `- "${p.name}", Q${p.basePrice}, SKU: "${p.sku}", QR: "${p.qrCodeData}", Barcode: "${p.barcode}"`).join('\n');
  } catch (_) {}
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'PROCESS_BATCH_PHOTO', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [{ text: `Identifica códigos QR o de barras en la foto del lote de pósters.\nCatálogo:\n${catalogMap}` }, { inlineData: { data: imageBuffer.toString('base64'), mimeType } }] }],
        config: { responseMimeType: 'application/json', responseSchema: batchPhotoResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    let grandTotal = 0;
    for (const item of parsed.items || []) {
      const matched = await matchPosterEverywhere(tenantId, item.matchedCode || item.sku || item.description);
      if (matched) {
        item.description = matched.description; item.unitPrice = matched.unitPrice; item.thumbUrl = matched.thumbUrl; item.imageUrl = matched.imageUrl;
        item.subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
      }
      grandTotal += item.subtotal || 0;
    }
    parsed.totalCalculated = Number(grandTotal.toFixed(2));
    return parsed;
  } catch (err) { throwMediaError('processPostersBatchPhoto', err, 'Error al procesar lote de fotos'); }
}
