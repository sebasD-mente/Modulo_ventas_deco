import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { searchWebPosters } from '../webCatalogService.js';
import { executeWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { voiceSaleResponseSchema, buildVoiceSalePrompt, artworkRecognitionResponseSchema, videoRecognitionResponseSchema, batchPhotoResponseSchema } from './aiPromptService.js';
import { resolveEntityAlias, normalizeArtworkQuery } from '../semantic/entityAliases.js';
import { searchHybridPosters } from '../embeddingService.js';

const getActivePool = () => [ENV.GEMINI_MODEL && !ENV.GEMINI_MODEL.includes('2.5') ? ENV.GEMINI_MODEL : 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', ...MODEL_PRIORITY_POOL].filter((v, i, a) => a.indexOf(v) === i);
const STANDARD_SIZES = {
  MINI: { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 }, PEQUENO: { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  PORTADA_ALBUM: { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 }, MEDIANO: { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  GRANDE: { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 }, GIGANTE: { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
};
const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
const throwMediaError = (fn, err, msg) => { console.error(`[${fn}] ❌`, err?.message); const error = new Error(`AI_MEDIA_SERVICE_FAILED: ${err?.message || msg}`); error.code = 'AI_MEDIA_SERVICE_FAILED'; throw error; };

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

export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  if (!query) return null;
  const clean = String(query).trim(), aliasRes = resolveEntityAlias(clean), normalizedQuery = normalizeArtworkQuery(clean);
  const effectiveQuery = (aliasRes.matched && aliasRes.searchQuery) ? aliasRes.searchQuery : (normalizedQuery || clean);
  let webMatches = [];
  try { webMatches = await searchHybridPosters({ tenantId, query: effectiveQuery, limit: 12 }); }
  catch { webMatches = await searchWebPosters({ tenantId, query: effectiveQuery, limit: 12 }); }

  if (webMatches.length > 0) {
    const matched = webMatches[0], matchText = `${matched.titulo || ''} ${matched.subtitulo || ''} ${(matched.tags || []).join(' ')}`.toLowerCase();
    const queryTokens = effectiveQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (aliasRes.matched || queryTokens.length === 0 || queryTokens.some((t) => matchText.includes(t))) {
      let selectedSize = matched.sizes[0], sizeAvailable = true, unavailableReason = null;
      if (requestedSize) {
        const norm = normalizeCatalogSizeId(requestedSize), cleanSize = String(requestedSize).toUpperCase().trim();
        const found = matched.sizes.find((s) => s.sizeId === norm || s.sizeId === cleanSize || s.nombre.toUpperCase() === cleanSize || s.nombre.toUpperCase().includes(cleanSize) || (s.dimensiones && s.dimensiones.toUpperCase().includes(cleanSize)));
        if (found) selectedSize = found;
        else if (STANDARD_SIZES[norm]) {
          selectedSize = STANDARD_SIZES[norm];
          if (!matched.sizes.some((s) => s.sizeId === norm)) matched.sizes.push(STANDARD_SIZES[norm]);
        } else {
          sizeAvailable = false;
          unavailableReason = `El diseño "${matched.titulo}" no se fabrica en ${requestedSize}. Tamaños disponibles: ${matched.sizes.map((s) => `${s.nombre} (${s.dimensiones})`).join(', ')}.`;
        }
      }
      const displayTitle = matched.subtitulo ? `${matched.titulo} - ${matched.subtitulo}` : matched.titulo;
      return {
        type: 'WEB_POSTER', productId: isUuid(matched.id) ? matched.id : null, posterId: matched.id,
        description: `${displayTitle} (${selectedSize.nombre})`, baseTitle: displayTitle, category: matched.categoria,
        thumbUrl: matched.thumbUrl, imageUrl: matched.imageUrl, unitPrice: Number(selectedSize.precio),
        sizeId: selectedSize.sizeId, sizeName: selectedSize.nombre, availableSizes: matched.sizes,
        sizeAvailable, unavailableReason,
      };
    }
  }
  try {
    const local = await prisma.product.findMany({ where: { tenantId, isActive: true } });
    const match = local.find((p) => [p.qrCodeData, p.barcode, p.sku].some((c) => c && c.toLowerCase() === clean.toLowerCase()) || (p.name && p.name.toLowerCase().includes(clean.toLowerCase())));
    if (match) {
      return {
        type: 'LOCAL_PRODUCT', productId: isUuid(match.id) ? match.id : null, description: match.name, baseTitle: match.name, category: match.category,
        thumbUrl: match.imageUrl || null, imageUrl: match.imageUrl || null, unitPrice: Number(match.basePrice),
        sizeId: 'ESTANDAR', sizeName: 'Estándar', availableSizes: [{ sizeId: 'ESTANDAR', nombre: 'Estándar', precio: Number(match.basePrice) }],
        sizeAvailable: true, unavailableReason: null,
      };
    }
  } catch (err) { console.warn('[matchPosterEverywhere] ⚠️ Error:', err.message); }
  return null;
}

export async function processVoiceSaleAudio({ audioBuffer, mimeType = 'audio/webm', tenantId }) {
  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'DIRECT_VOICE_SALE_INFERENCE', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [
          { text: buildVoiceSalePrompt() },
          { inlineData: { data: audioBuffer.toString('base64'), mimeType: cleanMime } }
        ] }],
        config: { responseMimeType: 'application/json', responseSchema: voiceSaleResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const cleanTranscription = (parsed.transcription || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    const isSale = Boolean(parsed.isSaleDetected && Array.isArray(parsed.items) && parsed.items.length > 0);
    const intent = parsed.intent || (isSale ? 'DICTADO_VENTA' : (cleanTranscription.length < 2 ? 'RUIDO_NO_VENTA' : 'SALUDO'));
    if (!isSale) {
      return {
        transcription: cleanTranscription, isSaleDetected: false, intent, greeting: parsed.greeting || null,
        items: [], total: 0, paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ',
      };
    }
    const enrichedItems = [];
    let grandTotal = 0;
    for (const item of parsed.items) {
      const matched = await matchPosterEverywhere(tenantId, item.title || item.description, item.size);
      const qty = item.quantity || 1, uPrice = matched?.unitPrice || Number(item.unitPrice) || 65.0, subtotal = Number((qty * uPrice).toFixed(2));
      grandTotal += subtotal;
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || item.title || 'Póster', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: qty, unitPrice: uPrice, subtotal, availableSizes: matched?.availableSizes });
    }
    return {
      transcription: cleanTranscription, isSaleDetected: true, intent: 'DICTADO_VENTA', greeting: parsed.greeting || null,
      items: enrichedItems, total: Number(grandTotal.toFixed(2)), paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ',
    };
  } catch (err) { throwMediaError('processVoiceSaleAudio', err, 'Error al procesar dictado de voz'); }
}

export async function recognizePosterArtworkFromImage({ imageBuffer, mimeType = 'image/jpeg', tenantId }) {
  const cleanMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  try {
    const { result: response } = await executeWithModelFallback({
      models: getActivePool(), actionName: 'RECOGNIZE_ARTWORK_IMAGE', tenantId,
      taskFn: async ({ model, client }) => client.models.generateContent({
        model, contents: [{ role: 'user', parts: [{ text: 'Reconoce el arte del póster fotografiado: personajes, título oficial más probable, franquicia y tamaño sugerido.' }, { inlineData: { data: imageBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: artworkRecognitionResponseSchema },
      }),
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const matched = await matchPosterEverywhere(tenantId, parsed.primaryTitle || parsed.visualAnalysis, parsed.suggestedSize || 'MEDIANO');
    const total = matched?.unitPrice || 65.0;
    return {
      visualAnalysis: parsed.visualAnalysis, primaryTitle: parsed.primaryTitle, confidence: parsed.confidence,
      items: [{ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || parsed.primaryTitle || 'Póster Decorativo Reconocido', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: 1, unitPrice: total, subtotal: total, availableSizes: matched?.availableSizes }],
      total, paymentMethod: 'EFECTIVO', inputChannel: 'IA_FOTO_ARTE',
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
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || item.title || 'Póster de Video', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: qty, unitPrice: uPrice, subtotal, availableSizes: matched?.availableSizes });
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
