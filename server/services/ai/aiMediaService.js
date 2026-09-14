import { getGeminiClient } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { searchWebPosters } from '../webCatalogService.js';
import { executeWithModelFallback } from '../geminiPoolService.js';
import {
  voiceSaleResponseSchema,
  artworkRecognitionResponseSchema,
  videoRecognitionResponseSchema,
  batchPhotoResponseSchema,
} from './aiPromptService.js';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export function normalizeCatalogSizeId(requestedSize) {
  if (!requestedSize) return 'MEDIANO';
  const raw = String(requestedSize).toLowerCase().trim();
  const compact = raw.replace(/\s+/g, '').replace(/pulgadas?|pulg?|inches?|in\b|"|cms?|cent[ií]metros?/gi, '').replace(/por|\*|x/gi, 'x');
  if (/18x24|24x18|45x60|60x45/.test(compact)) return 'GRANDE';
  if (/24x36|36x24|60x90|90x60/.test(compact)) return 'GIGANTE';
  if (/12x18|18x12|30x45|45x30/.test(compact)) return 'MEDIANO';
  if (/8(\.5)?x1[01]|1[01]x8(\.5)?|21x27|27x21/.test(compact)) return 'PEQUENO';
  if (/5x7|7x5|6x8|8x6|14x21|21x14/.test(compact)) return 'MINI';
  if (/30x30|12x12|vinilo|album|[aá]lbum|portada|cuadrad[oa]|disco/.test(compact)) return 'PORTADA_ALBUM';
  if (/gigante|extra\s*grande|xl\b/i.test(raw)) return 'GIGANTE';
  if (/grande|large|l\b/i.test(raw)) return 'GRANDE';
  if (/mediano|medio|medium|m\b/i.test(raw)) return 'MEDIANO';
  if (/peque[ñn]o|chico|small|s\b/i.test(raw)) return 'PEQUENO';
  if (/mini|miniatura|xs\b/i.test(raw)) return 'MINI';
  if (/portada|album|[aá]lbum|vinilo|cuadrad[oa]|disco/i.test(raw)) return 'PORTADA_ALBUM';
  return raw.toUpperCase();
}

export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  if (!query) return null;
  const clean = String(query).trim();
  const webMatches = await searchWebPosters({ tenantId, query: clean, limit: 12 });
  if (webMatches.length > 0) {
    const matched = webMatches[0];
    let selectedSize = matched.sizes[0];
    let sizeAvailable = true;
    let unavailableReason = null;

    if (requestedSize) {
      const norm = normalizeCatalogSizeId(requestedSize);
      const cleanSize = String(requestedSize).toUpperCase().trim();
      const found = matched.sizes.find(s => 
        s.sizeId === norm || 
        s.sizeId === cleanSize || 
        s.nombre.toUpperCase() === cleanSize || 
        s.nombre.toUpperCase().includes(cleanSize) || 
        (s.dimensiones && s.dimensiones.toUpperCase().includes(cleanSize))
      );
      if (found) {
        selectedSize = found;
      } else {
        const standardSizeMap = {
          MINI: { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
          PEQUENO: { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
          PORTADA_ALBUM: { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55 },
          MEDIANO: { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
          GRANDE: { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
          GIGANTE: { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
        };
        const standardMatch = standardSizeMap[norm];
        if (standardMatch) {
          selectedSize = standardMatch;
          sizeAvailable = true;
          unavailableReason = null;
          if (!matched.sizes.some(s => s.sizeId === norm)) {
            matched.sizes.push(standardMatch);
          }
        } else {
          sizeAvailable = false;
          unavailableReason = `El diseño "${matched.titulo}" no se fabrica en ${requestedSize}. Tamaños disponibles: ${matched.sizes.map(s => `${s.nombre} (${s.dimensiones})`).join(', ')}.`;
        }
      }
    }

    const displayTitle = matched.subtitulo ? `${matched.titulo} - ${matched.subtitulo}` : matched.titulo;
    return {
      type: 'WEB_POSTER',
      productId: isUuid(matched.id) ? matched.id : null,
      posterId: matched.id,
      description: `${displayTitle} (${selectedSize.nombre})`,
      baseTitle: displayTitle,
      category: matched.categoria,
      thumbUrl: matched.thumbUrl,
      imageUrl: matched.imageUrl,
      unitPrice: Number(selectedSize.precio),
      sizeId: selectedSize.sizeId,
      sizeName: selectedSize.nombre,
      availableSizes: matched.sizes,
      sizeAvailable,
      unavailableReason,
    };
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
  const prompt = 'Extrae la venta dictada por voz en stand: obras, tamaños (MINI, PEQUENO, MEDIANO, GRANDE, GIGANTE, PORTADA_ALBUM), cantidades y método de pago (EFECTIVO, TARJETA, TRANSFERENCIA).';
  try {
    const { result: response } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: audioBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: voiceSaleResponseSchema },
      }),
      actionName: 'PROCESS_VOICE_AUDIO',
      tenantId,
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const enrichedItems = [];
    let grandTotal = 0;
    for (const item of parsed.items || []) {
      const matched = await matchPosterEverywhere(tenantId, item.title || item.description, item.size);
      const qty = item.quantity || 1;
      const uPrice = matched?.unitPrice || Number(item.unitPrice) || 65.0;
      const subtotal = Number((qty * uPrice).toFixed(2));
      grandTotal += subtotal;
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || item.title || 'Póster', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: qty, unitPrice: uPrice, subtotal, availableSizes: matched?.availableSizes });
    }
    return { transcription: parsed.transcription, items: enrichedItems, total: Number(grandTotal.toFixed(2)), paymentMethod: parsed.paymentMethod || 'EFECTIVO', confidence: parsed.confidence || 0.95, inputChannel: 'IA_VOZ' };
  } catch (err) {
    console.warn('[processVoiceSaleAudio] ⚠️ Fallback offline:', err?.message);
    return { transcription: 'Modo offline: Grabación recibida.', items: [{ description: 'Chainsaw Man (Mediano)', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }], total: 65.0, paymentMethod: 'EFECTIVO', confidence: 0.8, inputChannel: 'IA_VOZ' };
  }
}

export async function recognizePosterArtworkFromImage({ imageBuffer, mimeType = 'image/jpeg', tenantId }) {
  const cleanMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const prompt = 'Reconoce el arte del póster fotografiado: personajes, título oficial más probable, franquicia y tamaño sugerido.';
  try {
    const { result: response } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: imageBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: artworkRecognitionResponseSchema },
      }),
      actionName: 'RECOGNIZE_ARTWORK_IMAGE',
      tenantId,
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const matched = await matchPosterEverywhere(tenantId, parsed.primaryTitle || parsed.visualAnalysis, parsed.suggestedSize || 'MEDIANO');
    const total = matched?.unitPrice || 65.0;
    return {
      visualAnalysis: parsed.visualAnalysis, primaryTitle: parsed.primaryTitle, confidence: parsed.confidence,
      items: [{ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || parsed.primaryTitle || 'Póster Decorativo Reconocido', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: 1, unitPrice: total, subtotal: total, availableSizes: matched?.availableSizes }],
      total, paymentMethod: 'EFECTIVO', inputChannel: 'IA_FOTO_ARTE',
    };
  } catch (err) {
    console.warn('[recognizePosterArtworkFromImage] ⚠️ Fallback local:', err?.message);
    return { visualAnalysis: 'Modo local', matchedPoster: null, items: [{ description: 'Póster Mediano', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }], total: 65.0, confidence: 0.7, inputChannel: 'IA_FOTO_ARTE' };
  }
}

export async function recognizePostersFromVideo({ videoBuffer, mimeType = 'video/mp4', tenantId }) {
  const cleanMime = (mimeType || 'video/mp4').split(';')[0].trim().toLowerCase();
  const prompt = 'Analiza el video del mostrador de ventas: identifica cada póster visible y cuenta unidades.';
  try {
    const { result: response } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: videoBuffer.toString('base64'), mimeType: cleanMime } }] }],
        config: { responseMimeType: 'application/json', responseSchema: videoRecognitionResponseSchema },
      }),
      actionName: 'RECOGNIZE_POSTERS_VIDEO',
      tenantId,
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const enrichedItems = [];
    let grandTotal = 0;
    for (const item of parsed.postersDetected || []) {
      const matched = await matchPosterEverywhere(tenantId, item.title, item.suggestedSize || 'MEDIANO');
      const qty = item.quantity || 1;
      const uPrice = matched?.unitPrice || 65.0;
      const subtotal = Number((qty * uPrice).toFixed(2));
      grandTotal += subtotal;
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched?.posterId || null, description: matched?.description || item.title || 'Póster de Video', thumbUrl: matched?.thumbUrl, imageUrl: matched?.imageUrl, quantity: qty, unitPrice: uPrice, subtotal, availableSizes: matched?.availableSizes });
    }
    return { summary: parsed.summary, items: enrichedItems, total: Number(grandTotal.toFixed(2)), paymentMethod: 'EFECTIVO', confidence: parsed.confidence || 0.90, inputChannel: 'IA_VIDEO_MOSTRADOR' };
  } catch (err) {
    console.warn('[recognizePostersFromVideo] ⚠️ Fallback local:', err?.message);
    return { summary: 'Modo local: Video recibido', items: [{ description: 'Póster Mediano', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }], total: 65.0, confidence: 0.7, inputChannel: 'IA_VIDEO_MOSTRADOR' };
  }
}

export async function processPostersBatchPhoto({ imageBuffer, mimeType = 'image/jpeg', tenantId }) {
  let catalogMap = '';
  try {
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, basePrice: true, sku: true, qrCodeData: true, barcode: true },
    });
    catalogMap = products.map((p) => `- "${p.name}", Q${p.basePrice}, SKU: "${p.sku}", QR: "${p.qrCodeData}", Barcode: "${p.barcode}"`).join('\n');
  } catch (_) {}
  const prompt = `Identifica códigos QR o de barras en la foto del lote de pósters.\nCatálogo:\n${catalogMap}`;
  try {
    const { result: response } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: imageBuffer.toString('base64'), mimeType } }] }],
        config: { responseMimeType: 'application/json', responseSchema: batchPhotoResponseSchema },
      }),
      actionName: 'PROCESS_BATCH_PHOTO',
      tenantId,
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    let grandTotal = 0;
    for (const item of parsed.items || []) {
      const matched = await matchPosterEverywhere(tenantId, item.matchedCode || item.sku || item.description);
      if (matched) {
        item.description = matched.description; item.unitPrice = matched.unitPrice;
        item.thumbUrl = matched.thumbUrl; item.imageUrl = matched.imageUrl;
        item.subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
      }
      grandTotal += item.subtotal || 0;
    }
    parsed.totalCalculated = Number(grandTotal.toFixed(2));
    return parsed;
  } catch (err) {
    console.warn('[processPostersBatchPhoto] ⚠️ Fallback local:', err?.message);
    return { detectedCodes: ['POSTER_MED_45'], summary: 'Modo local', items: [{ description: 'Póster Mediano (30x45 cm)', quantity: 1, unitPrice: 45.0, subtotal: 45.0 }], totalCalculated: 45.0, confidence: 0.7 };
  }
}
