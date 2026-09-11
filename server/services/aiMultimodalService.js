import { Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { getGeminiClient } from '../config/gemini.js';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { getEventKPIs } from './saleService.js';
import { searchWebPosters, getAllWebPostersCatalogSummary } from './webCatalogService.js';
import {
  extractPaymentMethod,
  resolveEntityAlias,
  normalizeArtworkQuery,
} from './semanticParserService.js';
import {
  executeWithModelFallback,
  streamWithModelFallback,
} from './geminiPoolService.js';

/**
 * Normaliza cualquier denominación de tamaño o medidas en pulgadas / centímetros
 * a los identificadores canónicos del catálogo de Deco Vintage.
 * Previene la sub-tarifación donde obras Grande ("18x24" / Q125) caen a Mediano (Q65).
 */
export function normalizeCatalogSizeId(requestedSize) {
  if (!requestedSize) return 'MEDIANO';
  const raw = String(requestedSize).toLowerCase().trim();

  // Eliminar unidades y compactar separadores: "18 x 24 pulgadas" -> "18x24"
  const compact = raw
    .replace(/\s+/g, '')
    .replace(/pulgadas?|pulg?|inches?|in\b|"|cms?|cent[ií]metros?/gi, '')
    .replace(/por|\*|x/gi, 'x');

  // 1. Mapeo de pulgadas y centímetros a tamaños oficiales
  // Grande (45 x 60 cm / 18 x 24 pulgadas) -> Q125.00
  if (/18x24|24x18|45x60|60x45/.test(compact)) return 'GRANDE';

  // Gigante (60 x 90 cm / 24 x 36 pulgadas) -> Q180.00
  if (/24x36|36x24|60x90|90x60/.test(compact)) return 'GIGANTE';

  // Mediano (30 x 45 cm / 12 x 18 pulgadas) -> Q65.00
  if (/12x18|18x12|30x45|45x30/.test(compact)) return 'MEDIANO';

  // Pequeño (21 x 27 cm / ~8x10 u 8.5x11 pulgadas) -> Q35.00
  if (/8(\.5)?x1[01]|1[01]x8(\.5)?|21x27|27x21/.test(compact)) return 'PEQUENO';

  // Mini (14 x 21 cm / ~5x7 o 6x8 pulgadas) -> Q25.00
  if (/5x7|7x5|6x8|8x6|14x21|21x14/.test(compact)) return 'MINI';

  // Portada de Álbum / Vinilo (30 x 30 cm / 12 x 12 pulgadas) -> Q55.00
  if (/30x30|12x12|vinilo|album|[aá]lbum|portada|cuadrad[oa]|disco/.test(compact)) return 'PORTADA_ALBUM';

  // 2. Mapeo por términos textuales
  if (/gigante|extra\s*grande|xl\b/i.test(raw)) return 'GIGANTE';
  if (/grande|large|l\b/i.test(raw)) return 'GRANDE';
  if (/mediano|medio|medium|m\b/i.test(raw)) return 'MEDIANO';
  if (/peque[ñn]o|chico|small|s\b/i.test(raw)) return 'PEQUENO';
  if (/mini|miniatura|xs\b/i.test(raw)) return 'MINI';
  if (/portada|album|[aá]lbum|vinilo|cuadrad[oa]|disco/i.test(raw)) return 'PORTADA_ALBUM';

  return raw.toUpperCase();
}

/**
 * Busca coincidencia tanto en el catálogo local del stand como en los 233 pósters de la web
 */
export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  if (!query) return null;
  const clean = String(query).trim();

  // 1. Buscar en los 233 pósters con motor de scoring multi-token (expandido a 12)
  const webMatches = await searchWebPosters({ tenantId, query: clean, limit: 12 });
  if (webMatches.length > 0) {
    const matched = webMatches[0];
    
    // Normalizar tamaño considerando medidas en pulgadas ("18x24") o nombres
    let selectedSize = matched.sizes.find(s => s.sizeId === 'MEDIANO') || matched.sizes[0];
    if (requestedSize) {
      const normalizedSizeId = normalizeCatalogSizeId(requestedSize);
      const sizeClean = String(requestedSize).toUpperCase().trim();
      const foundSize = matched.sizes.find(s => 
        s.sizeId === normalizedSizeId || 
        s.sizeId === sizeClean || 
        s.nombre.toUpperCase() === sizeClean ||
        s.nombre.toUpperCase().includes(sizeClean) ||
        (s.dimensiones && s.dimensiones.toUpperCase().includes(sizeClean))
      );
      if (foundSize) {
        selectedSize = foundSize;
      } else if (normalizedSizeId === 'PORTADA_ALBUM') {
        selectedSize = {
          sizeId: 'PORTADA_ALBUM',
          nombre: 'Portada de Álbum',
          dimensiones: '30 x 30 cm',
          precio: 55,
          badge: 'Formato vinilo cuadrado para música',
        };
      } else {
        const fallbackBySizeId = matched.sizes.find(s => s.sizeId === normalizedSizeId);
        if (fallbackBySizeId) selectedSize = fallbackBySizeId;
      }
    }

    const displayTitle = matched.subtitulo ? `${matched.titulo} - ${matched.subtitulo}` : matched.titulo;

    return {
      type: 'WEB_POSTER',
      productId: matched.id,
      posterId: matched.id,
      description: `${displayTitle} (${selectedSize.nombre})`,
      baseTitle: displayTitle,
      category: matched.categoria,
      thumbUrl: matched.thumbUrl,
      imageUrl: matched.imageUrl,
      unitPrice: Number(selectedSize.precio),
      sizeId: selectedSize.sizeId,
      sizeName: selectedSize.nombre,
      availableSizes: matched.sizes
    };
  }

  // 2. Buscar en catálogo local del stand por SKU, QR, código de barras o nombre
  try {
    const localProducts = await prisma.product.findMany({
      where: { tenantId, isActive: true },
    });

    const localMatch = localProducts.find(p =>
      (p.qrCodeData && p.qrCodeData.toLowerCase() === clean.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === clean.toLowerCase()) ||
      (p.name && p.name.toLowerCase().includes(clean.toLowerCase()))
    );

    if (localMatch) {
      return {
        type: 'LOCAL_PRODUCT',
        productId: localMatch.id,
        description: localMatch.name,
        baseTitle: localMatch.name,
        category: localMatch.category,
        thumbUrl: localMatch.imageUrl || null,
        imageUrl: localMatch.imageUrl || null,
        unitPrice: Number(localMatch.basePrice),
        sizeId: 'ESTANDAR',
        sizeName: 'Estándar',
        availableSizes: [{ sizeId: 'ESTANDAR', nombre: 'Estándar', precio: Number(localMatch.basePrice) }]
      };
    }
  } catch (dbErr) {
    console.warn('[matchPosterEverywhere] ⚠️ No se pudo consultar catálogo local:', dbErr.message);
  }

  return null;
}

/**
 * Esquema estricto para extracción de ventas dictadas por voz (audio)
 */
export const voiceSaleResponseSchema = {
  type: Type.OBJECT,
  description: 'Extracción estricta de venta dictada por voz en stand.',
  properties: {
    transcription: {
      type: Type.STRING,
      description: 'Transcripción literal completa de lo dicho por el vendedor.',
    },
    items: {
      type: Type.ARRAY,
      description: 'Lista de pósters o artículos dictados.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Nombre de la obra o personaje.',
          },
          size: {
            type: Type.STRING,
            description: 'Tamaño del póster (ej. MEDIANO, GRANDE, 18x24, etc.).',
          },
          quantity: {
            type: Type.INTEGER,
            description: 'Cantidad de unidades (entero >= 1).',
          },
          unitPrice: {
            type: Type.NUMBER,
            description: 'Precio unitario en Quetzales si fue mencionado.',
          },
        },
        required: ['title', 'size', 'quantity'],
      },
    },
    paymentMethod: {
      type: Type.STRING,
      description: 'Método de pago identificado.',
      enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'],
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Nivel de confianza de la extracción entre 0.0 y 1.0.',
    },
  },
  required: ['transcription', 'items', 'paymentMethod'],
};

/**
 * Esquema estricto para reconocimiento visual de arte por fotografía
 */
export const artworkRecognitionResponseSchema = {
  type: Type.OBJECT,
  description: 'Reconocimiento visual estricto de arte en diseño de póster físico.',
  properties: {
    visualAnalysis: {
      type: Type.STRING,
      description: 'Descripción concisa de personajes, estilo y elementos de la obra.',
    },
    primaryTitle: {
      type: Type.STRING,
      description: 'Título oficial o nombre más probable de la obra para búsqueda en catálogo.',
    },
    franchiseOrCategory: {
      type: Type.STRING,
      description: 'Categoría o franquicia artística de la obra.',
    },
    suggestedSize: {
      type: Type.STRING,
      description: 'Tamaño sugerido (MINI, PEQUENO, MEDIANO, GRANDE, GIGANTE).',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confianza de la detección entre 0.0 y 1.0.',
    },
  },
  required: ['visualAnalysis', 'primaryTitle', 'confidence'],
};

/**
 * Esquema estricto para análisis de video corto de mostrador
 */
export const videoRecognitionResponseSchema = {
  type: Type.OBJECT,
  description: 'Análisis estructurado de clip de video del mostrador de ventas.',
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Resumen de las obras observadas en el paneo de cámara.',
    },
    postersDetected: {
      type: Type.ARRAY,
      description: 'Listado de pósters y cantidades identificadas.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Nombre del póster o personaje detectado.',
          },
          quantity: {
            type: Type.INTEGER,
            description: 'Cantidad de unidades detectadas en mostrador.',
          },
          suggestedSize: {
            type: Type.STRING,
            description: 'Tamaño sugerido.',
          },
        },
        required: ['title', 'quantity'],
      },
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Nivel de confianza general del video.',
    },
  },
  required: ['summary', 'postersDetected'],
};

/**
 * Esquema estricto para escaneo de lote de pósters con códigos QR o de barras
 */
export const batchPhotoResponseSchema = {
  type: Type.OBJECT,
  description: 'Extracción estricta de códigos QR y de barras en foto de lote de pósters.',
  properties: {
    detectedCodes: {
      type: Type.ARRAY,
      description: 'Lista de valores leídos de códigos QR o de barras.',
      items: { type: Type.STRING },
    },
    summary: {
      type: Type.STRING,
      description: 'Resumen descriptivo del lote escaneado.',
    },
    items: {
      type: Type.ARRAY,
      description: 'Ítems detectados con sus códigos.',
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          sku: { type: Type.STRING },
          matchedCode: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
          unitPrice: { type: Type.NUMBER },
          subtotal: { type: Type.NUMBER },
        },
        required: ['matchedCode', 'quantity'],
      },
    },
    totalCalculated: {
      type: Type.NUMBER,
      description: 'Total calculado de los ítems detectados.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confianza de la detección.',
    },
  },
  required: ['detectedCodes', 'items'],
};

/**
 * 1. PROCESADOR DE AUDIO: Dictado por voz de ventas con soporte para el catálogo web
 */
export async function processVoiceSaleAudio({ audioBuffer, mimeType = 'audio/webm', tenantId, eventId }) {
  const gemini = getGeminiClient();

  const systemInstruction = `Eres el Asistente de Ventas de Stand para Deco Vintage Guate.
Tu tarea es escuchar el dictado del vendedor en el stand y extraer con precisión los detalles de la venta realizada.

Pósters y obras populares de referencia en el catálogo:
- Five Nights at Freddy's, Chainsaw Man, La Mona Lisa, Spider-Man, Batman, Porsche 911, The Beatles, Dragon Ball Goku, Star Wars Darth Vader, etc.
- Catálogo oficial de Deco Vintage y equivalencias de medidas:
  * Mini (Q25): 14x21 cm (~5x7 o 6x8 pulgadas)
  * Pequeño (Q35): 21x27 cm (~8x10 u 8.5x11 pulgadas)
  * Mediano (Q65): 30x45 cm (~12x18 pulgadas)
  * Grande (Q125): 45x60 cm (~18x24 pulgadas) -> Si piden "18x24", asignar SIEMPRE tamaño "GRANDE" (Q125).
  * Gigante (Q180): 60x90 cm (~24x36 pulgadas) -> Si piden "24x36", asignar SIEMPRE tamaño "GIGANTE" (Q180).
  * Portada de Álbum / Vinilo (Q55): Formato vinilo 30x30 cm (~12x12 pulgadas).

Instrucciones estrictas:
1. Extrae cada obra mencionada con su nombre, tamaño ("mini", "pequeño", "mediano", "grande", "gigante", o medidas como "18x24", "12x18", "24x36"), cantidad entera y precio unitario en Quetzales. Si no especifica tamaño, asume "mediano".
2. Si menciona método de pago ("en efectivo", "con tarjeta", "por transferencia"), identifícalo (valores válidos: EFECTIVO, TARJETA, TRANSFERENCIA, OTRO). Si no lo menciona, pon "EFECTIVO".
3. Devuelve ÚNICAMENTE un objeto JSON válido:
{
  "transcription": "Texto exacto de lo que dijo el vendedor",
  "items": [
    { 
      "title": "Nombre del póster", 
      "size": "MEDIANO", 
      "quantity": 1, 
      "unitPrice": 65.0 
    }
  ],
  "paymentMethod": "EFECTIVO",
  "confidence": 0.98
}`;

  if (!gemini) {
    return {
      transcription: "Modo offline: Grabación recibida.",
      items: [{ description: "Chainsaw Man (Mediano)", quantity: 1, unitPrice: 65.0, subtotal: 65.0 }],
      total: 65.0,
      paymentMethod: "EFECTIVO",
      confidence: 0.8,
    };
  }

  try {
    const audioBase64 = audioBuffer.toString('base64');
    const response = await gemini.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { inlineData: { data: audioBase64, mimeType: mimeType || 'audio/webm' } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: voiceSaleResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const enrichedItems = [];
    let grandTotal = 0;

    if (Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const queryName = item.title || item.description;
        const matched = await matchPosterEverywhere(tenantId, queryName, item.size);

        if (matched) {
          const qty = item.quantity || 1;
          const uPrice = matched.unitPrice || Number(item.unitPrice) || 65.0;
          const subtotal = Number((qty * uPrice).toFixed(2));
          grandTotal += subtotal;

          enrichedItems.push({
            productId: matched.productId || null,
            webPosterId: matched.posterId || null,
            description: matched.description,
            thumbUrl: matched.thumbUrl,
            imageUrl: matched.imageUrl,
            quantity: qty,
            unitPrice: uPrice,
            subtotal,
            availableSizes: matched.availableSizes,
          });
        } else {
          const qty = item.quantity || 1;
          const uPrice = Number(item.unitPrice) || 45.0;
          const subtotal = Number((qty * uPrice).toFixed(2));
          grandTotal += subtotal;

          enrichedItems.push({
            description: item.title || item.description || 'Póster',
            quantity: qty,
            unitPrice: uPrice,
            subtotal,
          });
        }
      }
    }

    return {
      transcription: parsed.transcription,
      items: enrichedItems,
      total: Number(grandTotal.toFixed(2)),
      paymentMethod: parsed.paymentMethod || 'EFECTIVO',
      confidence: parsed.confidence || 0.95,
      inputChannel: 'IA_VOZ',
    };
  } catch (err) {
    console.error('❌ Error en processVoiceSaleAudio con Gemini:', err);
    throw new Error(`Error procesando audio con IA: ${err.message}`);
  }
}

/**
 * 2. RECONOCIMIENTO VISUAL DE ARTE (Por foto del diseño del póster, sin QR)
 */
export async function recognizePosterArtworkFromImage({ imageBuffer, mimeType = 'image/jpeg', tenantId, eventId }) {
  const gemini = getGeminiClient();

  const systemInstruction = `Eres el Experto Reconocedor Visual de Cuadros y Pósters de Deco Vintage Guate.
El vendedor ha fotografiado directamente el arte o diseño de un póster decorativo físico que un cliente va a comprar.

Tu misión:
1. Analiza minuciosamente los elementos visuales de la obra: personajes retratados, franquicia o temática (Anime, Superhéroes, Autos, Obras de Arte famosas, Series/Películas, Música), estilo artístico y título reconocible.
2. Determina el título más probable del cuadro para buscarlo en el catálogo oficial de 233 pósters de Deco Vintage (ej. "Five Nights at Freddy's", "Chainsaw Man", "La Mona Lisa", "Porsche 911", "Spider-Man", "Goku", "Darth Vader", "The Beatles", "Pulp Fiction", etc.).
3. Devuelve ÚNICAMENTE un objeto JSON:
{
  "visualAnalysis": "Descripción concisa de lo observado en el arte del póster",
  "primaryTitle": "Título oficial o nombre más probable del póster",
  "franchiseOrCategory": "Categoría o franquicia (ej. ANIME, AUTOS, SUPERHEROES, OBRASDEARTE)",
  "suggestedSize": "MEDIANO",
  "confidence": 0.95
}`;

  if (!gemini) {
    return {
      visualAnalysis: "Modo local: Imagen recibida",
      matchedPoster: null,
      items: [{ description: "Póster Mediano", quantity: 1, unitPrice: 65.0, subtotal: 65.0 }],
      total: 65.0,
      confidence: 0.7,
    };
  }

  try {
    const imageBase64 = imageBuffer.toString('base64');
    const response = await gemini.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: artworkRecognitionResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const searchTarget = parsed.primaryTitle || parsed.visualAnalysis;

    // Buscar en los 233 pósters web
    const matched = await matchPosterEverywhere(tenantId, searchTarget, parsed.suggestedSize || 'MEDIANO');

    let items = [];
    let total = 65.0;

    if (matched) {
      items = [
        {
          productId: matched.productId || null,
          webPosterId: matched.posterId || null,
          description: matched.description,
          thumbUrl: matched.thumbUrl,
          imageUrl: matched.imageUrl,
          quantity: 1,
          unitPrice: matched.unitPrice,
          subtotal: matched.unitPrice,
          availableSizes: matched.availableSizes,
        },
      ];
      total = matched.unitPrice;
    } else {
      items = [
        {
          description: parsed.primaryTitle || 'Póster Decorativo Reconocido',
          quantity: 1,
          unitPrice: 65.0,
          subtotal: 65.0,
        },
      ];
    }

    return {
      visualAnalysis: parsed.visualAnalysis,
      primaryTitle: parsed.primaryTitle,
      confidence: parsed.confidence,
      items,
      total,
      paymentMethod: 'EFECTIVO',
      inputChannel: 'IA_FOTO_ARTE',
    };
  } catch (err) {
    console.error('❌ Error en recognizePosterArtworkFromImage:', err);
    throw new Error(`Error reconociendo arte del póster: ${err.message}`);
  }
}

/**
 * 3. RECONOCIMIENTO POR VIDEO CORTO (Clip del mostrador con varios pósters)
 */
export async function recognizePostersFromVideo({ videoBuffer, mimeType = 'video/mp4', tenantId, eventId }) {
  const gemini = getGeminiClient();

  const systemInstruction = `Eres el Analizador de Video de Stand para Deco Vintage Guate.
El vendedor ha grabado un paneo rápido en video (clip de 2 a 4 segundos) pasando la cámara sobre varios pósters decorativos colocados en el mostrador para un cliente.

Tu misión:
1. Examina la secuencia de cuadros del video.
2. Identifica CADA UNO de los pósters u obras visibles mostrados en la toma.
3. Si un mismo cuadro aparece de forma continua en el paneo, cuéntalo como 1 unidad. Si hay 2 copias distintas del mismo diseño en el mostrador, suma la cantidad.
4. Devuelve ÚNICAMENTE un objeto JSON:
{
  "summary": "Resumen de lo observado en el video",
  "postersDetected": [
    { "title": "Nombre del póster o personaje", "quantity": 1, "suggestedSize": "MEDIANO" }
  ],
  "confidence": 0.92
}`;

  if (!gemini) {
    return {
      summary: "Modo local: Video recibido",
      items: [{ description: "Póster Mediano", quantity: 1, unitPrice: 65.0, subtotal: 65.0 }],
      total: 65.0,
      confidence: 0.7,
    };
  }

  try {
    const videoBase64 = videoBuffer.toString('base64');
    const response = await gemini.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { inlineData: { data: videoBase64, mimeType: mimeType || 'video/mp4' } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: videoRecognitionResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const detectedList = parsed.postersDetected || [];

    const enrichedItems = [];
    let grandTotal = 0;

    for (const item of detectedList) {
      const matched = await matchPosterEverywhere(tenantId, item.title, item.suggestedSize || 'MEDIANO');
      const qty = item.quantity || 1;

      if (matched) {
        const uPrice = matched.unitPrice;
        const subtotal = Number((qty * uPrice).toFixed(2));
        grandTotal += subtotal;

        enrichedItems.push({
          productId: matched.productId || null,
          webPosterId: matched.posterId || null,
          description: matched.description,
          thumbUrl: matched.thumbUrl,
          imageUrl: matched.imageUrl,
          quantity: qty,
          unitPrice: uPrice,
          subtotal,
          availableSizes: matched.availableSizes,
        });
      } else {
        const uPrice = 65.0;
        const subtotal = Number((qty * uPrice).toFixed(2));
        grandTotal += subtotal;

        enrichedItems.push({
          description: item.title || 'Póster de Video',
          quantity: qty,
          unitPrice: uPrice,
          subtotal,
        });
      }
    }

    return {
      summary: parsed.summary,
      items: enrichedItems,
      total: Number(grandTotal.toFixed(2)),
      paymentMethod: 'EFECTIVO',
      confidence: parsed.confidence || 0.90,
      inputChannel: 'IA_VIDEO_MOSTRADOR',
    };
  } catch (err) {
    console.error('❌ Error en recognizePostersFromVideo:', err);
    throw new Error(`Error analizando video de pósters: ${err.message}`);
  }
}

/**
 * 4. PROCESADOR DE IMAGEN: Escaneo de Lote de Pósters con QR / Códigos de Barra
 */
export async function processPostersBatchPhoto({ imageBuffer, mimeType = 'image/jpeg', tenantId, eventId }) {
  const gemini = getGeminiClient();

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, basePrice: true, sku: true, qrCodeData: true, barcode: true },
  });

  const catalogMap = products.map(p => 
    `- Producto: "${p.name}", Precio: Q${p.basePrice}, SKU: "${p.sku}", Código QR: "${p.qrCodeData}", Código de Barras: "${p.barcode}"`
  ).join('\n');

  const systemInstruction = `Eres el Escáner Inteligente Multimodal de Pósters para Deco Vintage Guate.
El vendedor en el stand ha tomado una fotografía de un grupo o abanico de pósters con etiquetas de códigos QR o barras visibles.

Catálogo de referencia:
${catalogMap}

Tu misión:
1. Identifica y decodifica cada QR o código de barra visible en la imagen.
2. Agrupa y cuenta cantidades si hay repetidos.
3. Devuelve ÚNICAMENTE un objeto JSON:
{
  "detectedCodes": ["POSTER_MED_45", "POSTER_GRA_70"],
  "summary": "Resumen visual de los códigos detectados",
  "items": [
    { "description": "Nombre oficial", "sku": "SKU", "matchedCode": "Código detectado", "quantity": 1, "unitPrice": 45.0, "subtotal": 45.0 }
  ],
  "totalCalculated": 90.0,
  "confidence": 0.95
}`;

  if (!gemini) {
    return {
      detectedCodes: ['POSTER_MED_45'],
      summary: 'Modo local',
      items: [{ description: 'Póster Mediano (30x45 cm)', quantity: 1, unitPrice: 45.0, subtotal: 45.0 }],
      totalCalculated: 45.0,
      confidence: 0.7,
    };
  }

  try {
    const imageBase64 = imageBuffer.toString('base64');
    const response = await gemini.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: batchPhotoResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    let grandTotal = 0;

    if (Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const query = item.matchedCode || item.sku || item.description;
        const matched = await matchPosterEverywhere(tenantId, query);
        if (matched) {
          item.description = matched.description;
          item.unitPrice = matched.unitPrice;
          item.thumbUrl = matched.thumbUrl;
          item.imageUrl = matched.imageUrl;
          item.subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        }
        grandTotal += item.subtotal || 0;
      }
    }
    parsed.totalCalculated = Number(grandTotal.toFixed(2));

    return parsed;
  } catch (err) {
    console.error('❌ Error en processPostersBatchPhoto con Gemini:', err);
    throw new Error(`Error analizando foto de pósters: ${err.message}`);
  }
}

/**
 * Declaración de herramientas formales para el Asistente de Ventas (Gemini 2.5 Flash Function Calling)
 */
export const prepareSaleDraftDeclaration = {
  name: 'prepareSaleDraft',
  description: 'Prepara o actualiza un borrador formal de venta en el mostrador para confirmación del vendedor. Llamar a esta función ÚNICAMENTE cuando el usuario confirme o indique una venta ("vendí...", "anota venta de...", "cliente paga...") o solicite modificar el borrador activo ("cámbialo a grande", "ponle 2", "cambia a tarjeta", etc.). NUNCA llamar en consultas informativas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Lista de productos o pósters incluidos en la venta.',
        items: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: 'Nombre de la obra, personaje o producto (ej. "Spider-Man", "Batman").',
            },
            quantity: {
              type: Type.INTEGER,
              description: 'Cantidad de unidades vendidas (entero >= 1).',
            },
            unitPrice: {
              type: Type.NUMBER,
              description: 'Precio unitario en Quetzales (Q).',
            },
            size: {
              type: Type.STRING,
              description: 'Tamaño del póster: MINI, PEQUENO, MEDIANO, GRANDE, GIGANTE, PORTADA_ALBUM, o medidas como "18x24", "12x18".',
            },
          },
          required: ['productName', 'quantity'],
        },
      },
      total: {
        type: Type.NUMBER,
        description: 'Monto total calculado de la venta.',
      },
      paymentMethod: {
        type: Type.STRING,
        description: 'Método de pago identificado.',
        enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'],
      },
      notes: {
        type: Type.STRING,
        description: 'Notas o referencias opcionales de la venta.',
      },
      customerName: {
        type: Type.STRING,
        description: 'Nombre opcional del cliente.',
      },
    },
    required: ['items'],
  },
};

export const searchCatalogDeclaration = {
  name: 'searchCatalog',
  description: 'Busca obras y pósters en el catálogo oficial de Deco Vintage por palabras clave, personaje, franquicia, artista o categoría cuando el usuario pregunte por disponibilidad o recomendaciones.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Término de búsqueda (ej. "Spider-Man", "Goku", "Taylor Swift", "Porsche").',
      },
      category: {
        type: Type.STRING,
        description: 'Categoría opcional para filtrar: ANIME, PELICULAS, MUSICA, AUTOS, SUPERHEROES, ARTE, RETRO, etc.',
      },
    },
    required: ['query'],
  },
};

export const getEventKPIsDeclaration = {
  name: 'getEventKPIs',
  description: 'Obtiene las métricas y KPIs en tiempo real del evento activo en PostgreSQL: total vendido, número de transacciones, desglose por método de pago y productos más vendidos.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: 'Identificador único opcional del evento activo (si se omite, se usa el evento del contexto).',
      },
      date: {
        type: Type.STRING,
        description: 'Fecha opcional en formato YYYY-MM-DD para consultar métricas históricas o de un día específico.',
      },
    },
  },
};

export const getCashDrawerStatusDeclaration = {
  name: 'getCashDrawerStatus',
  description: 'Consulta el estado del efectivo en gaveta del stand, total en tarjetas, transferencias y último arqueo de caja registrado.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: 'Identificador único opcional del evento activo.',
      },
    },
  },
};

export const getSellerShiftReportDeclaration = {
  name: 'getSellerShiftReport',
  description: 'Consulta el ranking y métricas de ventas por vendedor en el evento activo (ventas totales, monto total, ticket promedio).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: 'Identificador único opcional del evento activo.',
      },
      sellerId: {
        type: Type.STRING,
        description: 'Identificador único opcional del vendedor para ver su reporte individual.',
      },
    },
  },
};

export const getProductionQueueStatusDeclaration = {
  name: 'getProductionQueueStatus',
  description: 'Consulta el estado de la cola de impresión y producción de obras en taller (PENDIENTE, SEPARADO, A_PRODUCCION, IMPRESO) y demoras.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: 'Identificador único opcional del evento activo.',
      },
    },
  },
};

export const checkInventoryStockDeclaration = {
  name: 'checkInventoryStock',
  description: 'Verifica las existencias y disponibilidad física de una obra en el stand o catálogo.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Nombre o alias de la obra, personaje o póster a consultar.',
      },
      sizeId: {
        type: Type.STRING,
        description: 'Tamaño opcional consultado: MINI, PEQUENO, MEDIANO, GRANDE, GIGANTE, PORTADA_ALBUM, o medidas como 18x24, etc.',
      },
    },
    required: ['query'],
  },
};

export const salesAssistantTools = [
  {
    functionDeclarations: [
      prepareSaleDraftDeclaration,
      searchCatalogDeclaration,
      getEventKPIsDeclaration,
      getCashDrawerStatusDeclaration,
      getSellerShiftReportDeclaration,
      getProductionQueueStatusDeclaration,
      checkInventoryStockDeclaration,
    ],
  },
];

/**
 * Consulta en tiempo real el estado del efectivo en gaveta y conciliación contra el último arqueo
 */
export async function executeGetCashDrawerStatus(tenantId, eventId) {
  try {
    let effectiveEventId = eventId;
    if (!effectiveEventId || effectiveEventId === 'current' || effectiveEventId === 'activo') {
      const activeEvent = await prisma.event.findFirst({
        where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
        select: { id: true, name: true, location: true },
      });
      if (activeEvent) {
        effectiveEventId = activeEvent.id;
      }
    }

    if (!effectiveEventId) {
      return {
        eventId: null,
        eventName: 'Sin evento activo',
        location: 'Stand',
        currency: 'GTQ',
        currencySymbol: 'Q',
        currentCashInDrawer: 0,
        cashSinceLastClosing: 0,
        salesCountSinceLastClosing: 0,
        totalSalesInCash: 0,
        cashTransactionsCount: 0,
        totalCardInSales: 0,
        cardTransactionsCount: 0,
        totalTransferInSales: 0,
        transferTransactionsCount: 0,
        grossSalesTotal: 0,
        lastClosing: null,
        summaryText: '💵 No hay un evento activo seleccionado para consultar el estado de la gaveta.',
      };
    }

    const event = await prisma.event.findUnique({
      where: { id: effectiveEventId },
      select: { id: true, name: true, location: true, status: true },
    });

    const saleWhere = {
      eventId: effectiveEventId,
      ...(tenantId ? { tenantId } : {}),
      status: { not: 'ANULADA' },
    };

    const [paymentsByMethod, lastClosing] = await Promise.all([
      prisma.salePayment.groupBy({
        by: ['method'],
        where: { sale: saleWhere },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.cashClosing.findFirst({
        where: {
          eventId: effectiveEventId,
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: { closingDate: 'desc' },
        include: {
          closedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    let totalCash = 0;
    let cashCount = 0;
    let totalCard = 0;
    let cardCount = 0;
    let totalTransfer = 0;
    let transferCount = 0;
    let totalOther = 0;
    let otherCount = 0;

    paymentsByMethod.forEach((group) => {
      const amount = Number(Number(group._sum?.amount || 0).toFixed(2));
      const count = group._count?.id || 0;
      if (group.method === 'EFECTIVO') {
        totalCash = amount;
        cashCount = count;
      } else if (group.method === 'TARJETA') {
        totalCard = amount;
        cardCount = count;
      } else if (group.method === 'TRANSFERENCIA') {
        totalTransfer = amount;
        transferCount = count;
      } else {
        totalOther += amount;
        otherCount += count;
      }
    });

    const grossSalesTotal = Number((totalCash + totalCard + totalTransfer + totalOther).toFixed(2));

    let cashSinceLastClosing = totalCash;
    let salesCountSinceLastClosing = cashCount;

    if (lastClosing) {
      const postClosingAgg = await prisma.salePayment.aggregate({
        where: {
          method: 'EFECTIVO',
          sale: {
            ...saleWhere,
            createdAt: { gt: lastClosing.createdAt },
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      cashSinceLastClosing = Number(Number(postClosingAgg._sum?.amount || 0).toFixed(2));
      salesCountSinceLastClosing = postClosingAgg._count?.id || 0;
    }

    let discrepancyStatus = 'SIN_ARQUEOS';
    let diffAmount = 0;
    let lastClosingInfo = null;

    if (lastClosing) {
      diffAmount = Number(lastClosing.cashDifference || 0);
      discrepancyStatus = diffAmount === 0 ? 'CUADRADO' : diffAmount > 0 ? 'SOBRANTE' : 'FALTANTE';
      lastClosingInfo = {
        id: lastClosing.id,
        closingDate: lastClosing.closingDate,
        closedBy: lastClosing.closedBy?.fullName || 'Vendedor',
        closingType: lastClosing.closingType,
        calculatedCash: Number(lastClosing.totalCashCalculated || 0),
        reportedCash: Number(lastClosing.totalCashReported || 0),
        difference: diffAmount,
        discrepancyStatus,
        observations: lastClosing.observations || null,
      };
    }

    const estimatedPhysicalCashInDrawer = lastClosing
      ? Number((Number(lastClosing.totalCashReported || 0) + cashSinceLastClosing).toFixed(2))
      : totalCash;

    const summaryText = lastClosingInfo
      ? `💵 **Estado de Gaveta — "${event?.name || 'Evento'}":** Hay aprox. **Q ${estimatedPhysicalCashInDrawer.toFixed(2)}** en efectivo. Último arqueo: ${new Date(lastClosingInfo.closingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} por ${lastClosingInfo.closedBy} (${discrepancyStatus}, dif: Q ${lastClosingInfo.difference.toFixed(2)}). Ingresos post-arqueo: Q ${cashSinceLastClosing.toFixed(2)} en ${salesCountSinceLastClosing} cobros. Tarjeta: Q ${totalCard.toFixed(2)} | Transferencias: Q ${totalTransfer.toFixed(2)}.`
      : `💵 **Estado de Gaveta — "${event?.name || 'Evento'}":** Hay **Q ${totalCash.toFixed(2)}** en efectivo físico acumulado (${cashCount} cobros). Sin arqueos registrados todavía. Cobros en tarjeta: Q ${totalCard.toFixed(2)} | Transferencias: Q ${totalTransfer.toFixed(2)} (Total general: Q ${grossSalesTotal.toFixed(2)}).`;

    return {
      eventId: effectiveEventId,
      eventName: event?.name || 'Evento Activo',
      location: event?.location || 'Stand',
      currency: 'GTQ',
      currencySymbol: 'Q',
      currentCashInDrawer: estimatedPhysicalCashInDrawer,
      cashSinceLastClosing,
      salesCountSinceLastClosing,
      totalSalesInCash: totalCash,
      cashTransactionsCount: cashCount,
      totalCardInSales: totalCard,
      cardTransactionsCount: cardCount,
      totalTransferInSales: totalTransfer,
      transferTransactionsCount: transferCount,
      grossSalesTotal,
      lastClosing: lastClosingInfo,
      summaryText,
    };
  } catch (dbErr) {
    console.warn('⚠️ [executeGetCashDrawerStatus] Error o base de datos no disponible:', dbErr.message);
    return {
      eventId: eventId || null,
      eventName: 'Stand (Modo Resiliente)',
      location: 'Stand',
      currency: 'GTQ',
      currencySymbol: 'Q',
      currentCashInDrawer: 0,
      cashSinceLastClosing: 0,
      salesCountSinceLastClosing: 0,
      totalSalesInCash: 0,
      cashTransactionsCount: 0,
      totalCardInSales: 0,
      cardTransactionsCount: 0,
      totalTransferInSales: 0,
      transferTransactionsCount: 0,
      grossSalesTotal: 0,
      lastClosing: null,
      summaryText: '💵 Estado de Gaveta: No se pudo consultar la base de datos de caja o no hay conexión activa.',
      error: dbErr.message,
    };
  }
}

/**
 * Consulta en tiempo real el desempeño y ranking de vendedores en PostgreSQL
 */
export async function executeGetSellerShiftReport(tenantId, eventId, sellerId = null) {
  try {
    let effectiveEventId = eventId;
    if (!effectiveEventId || effectiveEventId === 'current' || effectiveEventId === 'activo') {
      const activeEvent = await prisma.event.findFirst({
        where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
        select: { id: true, name: true },
      });
      if (activeEvent) {
        effectiveEventId = activeEvent.id;
      }
    }

    if (!effectiveEventId) {
      return {
        eventId: null,
        eventName: 'Sin evento activo',
        totalSellersActive: 0,
        eventTotalRevenue: 0,
        eventTotalTransactions: 0,
        topSeller: null,
        ranking: [],
        seller: null,
        summaryText: '🏆 No hay un evento activo seleccionado para consultar el reporte de vendedores.',
      };
    }

    const saleWhere = {
      eventId: effectiveEventId,
      status: { not: 'ANULADA' },
      ...(tenantId ? { tenantId } : {}),
    };

    const [event, salesBySeller] = await Promise.all([
      prisma.event.findUnique({
        where: { id: effectiveEventId },
        select: { id: true, name: true, location: true },
      }),
      prisma.sale.groupBy({
        by: ['sellerId'],
        where: saleWhere,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    salesBySeller.sort((a, b) => Number(b._sum?.totalAmount || 0) - Number(a._sum?.totalAmount || 0));

    const sellerIds = salesBySeller.map((s) => s.sellerId).filter(Boolean);
    if (sellerId && !sellerIds.includes(sellerId)) {
      sellerIds.push(sellerId);
    }

    let userMap = new Map();
    if (sellerIds.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: sellerIds },
          ...(tenantId ? { tenantId } : {}) ,
        },
        select: { id: true, fullName: true, email: true, role: true },
      });
      userMap = new Map(users.map((u) => [u.id, u]));
    }

    const eventTotalRevenue = Number(
      salesBySeller.reduce((acc, s) => acc + Number(s._sum?.totalAmount || 0), 0).toFixed(2)
    );
    const eventTotalTransactions = salesBySeller.reduce((acc, s) => acc + (s._count?.id || 0), 0);

    const ranking = await Promise.all(
      salesBySeller.map(async (group, index) => {
        const seller = userMap.get(group.sellerId);
        const totalAmount = Number(Number(group._sum?.totalAmount || 0).toFixed(2));
        const transactionCount = group._count?.id || 0;
        const averageTicket =
          transactionCount > 0 ? Number((totalAmount / transactionCount).toFixed(2)) : 0;
        const sharePercentage =
          eventTotalRevenue > 0
            ? Number(((totalAmount / eventTotalRevenue) * 100).toFixed(1))
            : 0;

        let unitsSold = 0;
        try {
          const unitsAgg = await prisma.saleItem.aggregate({
            where: {
              sale: {
                eventId: effectiveEventId,
                sellerId: group.sellerId,
                status: { not: 'ANULADA' },
                ...(tenantId ? { tenantId } : {}),
              },
            },
            _sum: { quantity: true },
          });
          unitsSold = unitsAgg._sum?.quantity || 0;
        } catch {
          // fallback
        }

        const paymentsBreakdown = {
          EFECTIVO: { amount: 0, count: 0 },
          TARJETA: { amount: 0, count: 0 },
          TRANSFERENCIA: { amount: 0, count: 0 },
        };

        try {
          const paymentsAgg = await prisma.salePayment.groupBy({
            by: ['method'],
            where: {
              sale: {
                eventId: effectiveEventId,
                sellerId: group.sellerId,
                status: { not: 'ANULADA' },
                ...(tenantId ? { tenantId } : {}),
              },
            },
            _sum: { amount: true },
            _count: { id: true },
          });

          paymentsAgg.forEach((p) => {
            if (paymentsBreakdown[p.method]) {
              paymentsBreakdown[p.method].amount = Number(Number(p._sum?.amount || 0).toFixed(2));
              paymentsBreakdown[p.method].count = p._count?.id || 0;
            }
          });
        } catch {
          // fallback
        }

        return {
          position: index + 1,
          sellerId: group.sellerId,
          sellerName: seller?.fullName || 'Vendedor',
          sellerEmail: seller?.email || '',
          role: seller?.role || 'VENDEDOR',
          totalAmount,
          transactionCount,
          averageTicket,
          unitsSold,
          sharePercentage,
          payments: paymentsBreakdown,
        };
      })
    );

    if (sellerId) {
      const specificSeller = ranking.find((r) => r.sellerId === sellerId);
      if (!specificSeller) {
        const u = userMap.get(sellerId);
        return {
          eventId: effectiveEventId,
          eventName: event?.name || 'Evento Activo',
          filterSellerId: sellerId,
          seller: {
            sellerId,
            sellerName: u?.fullName || 'Vendedor',
            totalAmount: 0,
            transactionCount: 0,
            averageTicket: 0,
            unitsSold: 0,
            position: null,
            sharePercentage: 0,
          },
          ranking,
          summaryText: `El vendedor ${u?.fullName || 'indicado'} aún no registra ventas completadas en "${event?.name || 'el evento'}".`,
        };
      }

      const medal = specificSeller.position === 1 ? '🥇' : specificSeller.position === 2 ? '🥈' : specificSeller.position === 3 ? '🥉' : '🎖️';
      const summaryText = `${medal} **Desempeño de ${specificSeller.sellerName} en "${event?.name || 'Evento'}":** Posición #${specificSeller.position} de ${ranking.length}. Total vendido: **Q ${specificSeller.totalAmount.toFixed(2)}** en ${specificSeller.transactionCount} ventas (${specificSeller.unitsSold} obras entregadas). Ticket promedio: Q ${specificSeller.averageTicket.toFixed(2)} (${specificSeller.sharePercentage}% del evento). Cobros: Q ${specificSeller.payments.EFECTIVO.amount.toFixed(2)} efectivo, Q ${specificSeller.payments.TARJETA.amount.toFixed(2)} tarjeta, Q ${specificSeller.payments.TRANSFERENCIA.amount.toFixed(2)} transferencias.`;

      return {
        eventId: effectiveEventId,
        eventName: event?.name || 'Evento Activo',
        filterSellerId: sellerId,
        seller: specificSeller,
        ranking,
        summaryText,
      };
    }

    const medalIcons = ['🥇', '🥈', '🥉'];
    const rankingSummaryLines = ranking
      .slice(0, 5)
      .map(
        (r, idx) =>
          `${medalIcons[idx] || '🎖️'} #${r.position} **${r.sellerName}**: Q ${r.totalAmount.toFixed(2)} (${r.transactionCount} ventas, ${r.unitsSold} obras — ${r.sharePercentage}%)`
      )
      .join('\n');

    const summaryText = ranking.length > 0
      ? `🏆 **Ranking de Vendedores en "${event?.name || 'Evento'}":**\n${rankingSummaryLines}\n\n• **Total recaudado:** Q ${eventTotalRevenue.toFixed(2)} (${eventTotalTransactions} transacciones globales).`
      : `Aún no se registran ventas de vendedores en "${event?.name || 'el evento'}".`;

    return {
      eventId: effectiveEventId,
      eventName: event?.name || 'Evento Activo',
      totalSellersActive: ranking.length,
      eventTotalRevenue,
      eventTotalTransactions,
      topSeller: ranking[0] || null,
      ranking,
      summaryText,
    };
  } catch (dbErr) {
    console.warn('⚠️ [executeGetSellerShiftReport] Error o base de datos no disponible:', dbErr.message);
    return {
      eventId: eventId || null,
      eventName: 'Evento (Modo Resiliente)',
      totalSellersActive: 0,
      eventTotalRevenue: 0,
      eventTotalTransactions: 0,
      topSeller: null,
      ranking: [],
      seller: null,
      summaryText: '🏆 Ranking de Vendedores: No se pudo conectar a la base de datos para consultar el desempeño.',
      error: dbErr.message,
    };
  }
}

/**
 * Consulta en tiempo real el estado de la cola de producción y taller
 */
export async function executeGetProductionQueueStatus(tenantId, eventId) {
  try {
    let effectiveEventId = eventId;
    if (!effectiveEventId || effectiveEventId === 'current' || effectiveEventId === 'activo') {
      const activeEvent = await prisma.event.findFirst({
        where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
        select: { id: true, name: true },
      });
      if (activeEvent) {
        effectiveEventId = activeEvent.id;
      }
    }

    if (!effectiveEventId) {
      return {
        eventId: null,
        eventName: 'Sin evento activo',
        health: 'OPTIMO',
        counts: { pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0, activeQueueCount: 0 },
        timing: { averageQueueWaitMinutes: 0, maxWaitMinutes: 0, averagePrintTurnaroundMinutes: null, stalledThresholdMinutes: 30 },
        stalledJobs: [],
        stalledCount: 0,
        summary: 'Cola de taller: No hay un evento activo seleccionado para consultar el estado del taller.',
      };
    }

    const now = new Date();
    const whereBase = {
      sale: {
        eventId: effectiveEventId,
        status: { not: 'ANULADA' },
        ...(tenantId ? { tenantId } : {}),
      },
    };

    const [statusGroups, activeItems, recentPrinted, eventInfo] = await Promise.all([
      prisma.saleItem.groupBy({
        by: ['productionStatus'],
        where: whereBase,
        _count: { id: true },
        _sum: { quantity: true },
      }),
      prisma.saleItem.findMany({
        where: {
          ...whereBase,
          productionStatus: { in: ['PENDIENTE', 'A_PRODUCCION'] },
        },
        include: {
          sale: {
            select: {
              saleNumber: true,
              createdAt: true,
              seller: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.saleItem.findMany({
        where: {
          ...whereBase,
          productionStatus: 'IMPRESO',
          impresoAt: { not: null },
        },
        select: {
          createdAt: true,
          impresoAt: true,
        },
        take: 20,
        orderBy: { impresoAt: 'desc' },
      }),
      prisma.event.findUnique({
        where: { id: effectiveEventId },
        select: { id: true, name: true, location: true },
      }),
    ]);

    const counts = {
      PENDIENTE: 0,
      SEPARADO: 0,
      A_PRODUCCION: 0,
      IMPRESO: 0,
      total: 0,
    };

    for (const g of statusGroups) {
      const st = g.productionStatus;
      const c = g._count?.id || 0;
      if (counts[st] !== undefined) {
        counts[st] = c;
      }
      counts.total += c;
    }

    let totalWaitMinutes = 0;
    let maxWaitMinutes = 0;
    const stalledThresholdMinutes = 30;
    const criticalThresholdMinutes = 45;
    const stalledJobs = [];

    for (const item of activeItems) {
      const itemDate = new Date(item.createdAt);
      const waitMinutes = Math.max(0, Math.round((now.getTime() - itemDate.getTime()) / 60000));
      totalWaitMinutes += waitMinutes;
      if (waitMinutes > maxWaitMinutes) {
        maxWaitMinutes = waitMinutes;
      }

      if (waitMinutes >= stalledThresholdMinutes) {
        stalledJobs.push({
          saleItemId: item.id,
          saleNumber: item.sale?.saleNumber || 'S/N',
          description: item.description,
          quantity: item.quantity,
          status: item.productionStatus,
          minutesInQueue: waitMinutes,
          urgency: waitMinutes >= criticalThresholdMinutes ? 'CRITICA' : 'ALTA',
          sellerName: item.sale?.seller?.fullName || 'Vendedor',
          createdAt: item.createdAt,
        });
      }
    }

    const activeQueueCount = counts.PENDIENTE + counts.A_PRODUCCION;
    const averageQueueWaitMinutes = activeQueueCount > 0
      ? Math.round(totalWaitMinutes / activeQueueCount)
      : 0;

    let averagePrintTurnaroundMinutes = null;
    if (recentPrinted.length > 0) {
      const sumPrint = recentPrinted.reduce((acc, it) => {
        const diff = Math.max(0, (new Date(it.impresoAt).getTime() - new Date(it.createdAt).getTime()) / 60000);
        return acc + diff;
      }, 0);
      averagePrintTurnaroundMinutes = Math.round(sumPrint / recentPrinted.length);
    }

    let health = 'OPTIMO';
    if (stalledJobs.some((j) => j.urgency === 'CRITICA') || activeQueueCount > 15) {
      health = 'CRITICO';
    } else if (stalledJobs.length > 0 || activeQueueCount > 8) {
      health = 'SATURADO';
    } else if (activeQueueCount > 3) {
      health = 'MODERADO';
    }

    const summary = `🖨️ **Estado del Taller y Producción — "${eventInfo?.name || 'Evento'}":**\n` +
      `• **Salud operativa:** ${health === 'OPTIMO' ? '🟢 ÓPTIMO' : health === 'MODERADO' ? '🟡 MODERADO' : '🔴 SATURADO'}\n` +
      `• **En impresión activa (A_PRODUCCION):** ${counts.A_PRODUCCION} obras\n` +
      `• **Pendientes de clasificar:** ${counts.PENDIENTE} obras\n` +
      `• **Despachadas de stock mostrador:** ${counts.SEPARADO} | **Finalizadas en taller:** ${counts.IMPRESO}\n` +
      `• **Tiempo promedio de espera:** ${averageQueueWaitMinutes} min (máx: ${maxWaitMinutes} min)\n` +
      (stalledJobs.length > 0
        ? `⚠️ **Atención:** Hay ${stalledJobs.length} órdenes rezagadas (> ${stalledThresholdMinutes} min).\n` +
          stalledJobs.slice(0, 3).map(j => `  - Ticket ${j.saleNumber}: ${j.description} (${j.minutesInQueue} min de espera)`).join('\n')
        : '• **Flujo de taller:** Operando al día sin cuellos de botella.');

    return {
      eventId: effectiveEventId,
      eventName: eventInfo?.name || 'Evento Activo',
      health,
      counts: {
        pending: counts.PENDIENTE,
        separated: counts.SEPARADO,
        inProduction: counts.A_PRODUCCION,
        printed: counts.IMPRESO,
        total: counts.total,
        activeQueueCount,
      },
      timing: {
        averageQueueWaitMinutes,
        maxWaitMinutes,
        averagePrintTurnaroundMinutes,
        stalledThresholdMinutes,
      },
      stalledJobs,
      stalledCount: stalledJobs.length,
      summary,
    };
  } catch (dbErr) {
    console.warn('⚠️ [executeGetProductionQueueStatus] Error o base de datos no disponible:', dbErr.message);
    return {
      eventId: eventId || null,
      eventName: 'Evento (Modo Resiliente)',
      health: 'OPTIMO',
      counts: {
        pending: 0,
        separated: 0,
        inProduction: 0,
        printed: 0,
        total: 0,
        activeQueueCount: 0,
      },
      timing: {
        averageQueueWaitMinutes: 0,
        maxWaitMinutes: 0,
        averagePrintTurnaroundMinutes: null,
        stalledThresholdMinutes: 30,
      },
      stalledJobs: [],
      stalledCount: 0,
      summary: '🖨️ Estado de Taller: No se pudo consultar la base de datos de producción en este momento.',
      error: dbErr.message,
    };
  }
}

/**
 * Verifica existencias, variantes y modalidad de entrega física para una obra
 */
export async function executeCheckInventoryStock(tenantId, query, sizeId = null, eventId = null) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      found: false,
      message: 'Debe especificar el nombre o alias de la obra a consultar.',
      suggestedPosters: [],
    };
  }

  try {
    const aliasRes = resolveEntityAlias(query.trim());
    const resolvedQuery = aliasRes.matched ? aliasRes.searchQuery : normalizeArtworkQuery(query.trim());
    const requestedSizeNorm = sizeId
      ? normalizeCatalogSizeId(sizeId)
      : (aliasRes.matched && aliasRes.defaultSizeId ? aliasRes.defaultSizeId : null);

    const matches = await searchWebPosters({
      tenantId,
      query: resolvedQuery,
      limit: 6,
    });

    const posterMatches = Array.isArray(matches) ? [...matches] : [];

    if (posterMatches.length === 0) {
      if (aliasRes.matched) {
        posterMatches.push({
          id: `alias-${aliasRes.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          sku: `DV-${aliasRes.canonicalTitle.substring(0, 4).toUpperCase()}`,
          titulo: aliasRes.canonicalTitle,
          subtitulo: 'Catálogo Oficial Deco Vintage',
          categoria: aliasRes.category || 'ARTE',
          imageUrl: null,
          thumbUrl: null,
          precioMinimo: aliasRes.defaultSizeId === 'PORTADA_ALBUM' ? 55 : 65,
          sizes: [
            { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
            { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
            { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
            { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
          ],
        });
      } else {
        return {
          found: false,
          query: query.trim(),
          resolvedQuery,
          message: `No se encontró la obra "${query}" en el catálogo oficial de Deco Vintage.`,
          availableInCatalog: false,
          suggestedPosters: [],
        };
      }
    }

    const primaryMatch = posterMatches[0];
    const allSizes = Array.isArray(primaryMatch.sizes) && primaryMatch.sizes.length > 0
      ? [...primaryMatch.sizes]
      : [
          { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
          { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
          { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
          { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
          { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
        ];

    const isMusic = (primaryMatch.categoria || '').toUpperCase() === 'MUSICA';
    if (isMusic && !allSizes.some((s) => s.sizeId === 'PORTADA_ALBUM')) {
      allSizes.unshift({
        sizeId: 'PORTADA_ALBUM',
        nombre: 'Portada de Álbum',
        dimensiones: '30 x 30 cm',
        precio: 55,
        badge: 'Formato vinilo cuadrado para música',
      });
    }

    let matchedSizeInfo = null;
    if (requestedSizeNorm) {
      matchedSizeInfo = allSizes.find((s) => s.sizeId === requestedSizeNorm);
      if (!matchedSizeInfo) {
        let fallbackPrice = 65;
        if (requestedSizeNorm === 'MINI') fallbackPrice = 25;
        else if (requestedSizeNorm === 'PEQUENO') fallbackPrice = 35;
        else if (requestedSizeNorm === 'MEDIANO') fallbackPrice = 65;
        else if (requestedSizeNorm === 'GRANDE') fallbackPrice = 125;
        else if (requestedSizeNorm === 'GIGANTE') fallbackPrice = 180;
        else if (requestedSizeNorm === 'PORTADA_ALBUM') fallbackPrice = 55;

        matchedSizeInfo = {
          sizeId: requestedSizeNorm,
          nombre: requestedSizeNorm,
          precio: fallbackPrice,
          dimensiones: requestedSizeNorm === 'PORTADA_ALBUM' ? '30 x 30 cm' : 'Estándar',
        };
      }
    }

    let eventStockHistory = null;
    if (eventId && primaryMatch.id) {
      try {
        const itemsHistory = await prisma.saleItem.groupBy({
          by: ['productionStatus'],
          where: {
            OR: [
              { productId: primaryMatch.id },
              { description: { contains: primaryMatch.titulo, mode: 'insensitive' } },
            ],
            sale: {
              eventId,
              status: { not: 'ANULADA' },
              ...(tenantId ? { tenantId } : {}),
            },
          },
          _count: { id: true },
        });
        const hist = { SEPARADO: 0, A_PRODUCCION: 0, IMPRESO: 0, PENDIENTE: 0 };
        itemsHistory.forEach((g) => {
          if (hist[g.productionStatus] !== undefined) {
            hist[g.productionStatus] = g._count.id || 0;
          }
        });
        eventStockHistory = hist;
      } catch (dbErr) {
        console.warn('⚠️ [executeCheckInventoryStock] Error consultando histórico en PostgreSQL:', dbErr.message);
      }
    }

    const targetSizeId = matchedSizeInfo?.sizeId || 'MEDIANO';
    const isDirectStockCandidate = ['MEDIANO', 'PORTADA_ALBUM', 'PEQUENO', 'MINI'].includes(targetSizeId);

    const stockAvailability = {
      availableInCatalog: true,
      standPhysicalStock: isDirectStockCandidate ? 'DISPONIBLE_MOSTRADOR' : 'PRODUCCION_TALLER',
      estimatedWaitMinutes: isDirectStockCandidate ? 0 : 12,
      tallerCapability: 'Impresión al instante con tintas HP Látex (>10 años de durabilidad garantizada)',
      deliveryMode: isDirectStockCandidate
        ? 'Entrega inmediata en mostrador o producción en taller si se agotan copias'
        : 'Producción personalizada en taller del stand (~10-15 minutos)',
    };

    const responseSummary = `🎨 **Disponibilidad de Obra — "${primaryMatch.titulo}":**\n` +
      `• **Catálogo:** Disponible en catálogo oficial de Deco Vintage (${primaryMatch.categoria}).\n` +
      (matchedSizeInfo
        ? `• **Tamaño consultado:** ${matchedSizeInfo.nombre} (${matchedSizeInfo.dimensiones || ''}) — **Q ${matchedSizeInfo.precio.toFixed(2)}**.\n`
        : `• **Tamaños disponibles:** ${allSizes.map((s) => `${s.nombre} (Q ${s.precio})`).join(', ')}.\n`) +
      `• **Modalidad de entrega:** ${stockAvailability.deliveryMode}.\n` +
      (stockAvailability.estimatedWaitMinutes === 0
        ? '⚡ Listo para entregar de inmediato al cliente.'
        : `⏱️ Tiempo estimado de impresión: ~${stockAvailability.estimatedWaitMinutes} minutos en plotter HP Látex.`);

    return {
      found: true,
      query: query.trim(),
      artwork: {
        id: primaryMatch.id,
        sku: primaryMatch.sku,
        title: primaryMatch.titulo,
        subtitle: primaryMatch.subtitulo || '',
        category: primaryMatch.categoria,
        imageUrl: primaryMatch.imageUrl,
        thumbUrl: primaryMatch.thumbUrl,
        basePrice: primaryMatch.precioMinimo,
      },
      requestedSize: matchedSizeInfo,
      allAvailableSizes: allSizes,
      stockAvailability,
      eventStockHistory,
      suggestedPosters: matches,
      summary: responseSummary,
    };
  } catch (err) {
    console.warn('⚠️ [executeCheckInventoryStock] Error consultando inventario:', err.message);
    return {
      found: false,
      query: query.trim(),
      message: `Error al consultar stock de "${query}": ${err.message}`,
      availableInCatalog: false,
      suggestedPosters: [],
    };
  }
}

export const salesAssistantSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Construye el payload canónico de borrador de venta a partir de los argumentos de la herramienta
 */
export async function constructDraftPayload(tenantId, args, userMessage = '') {
  const rawItems = Array.isArray(args?.items)
    ? args.items.filter((it) => it && typeof it === 'object')
    : [];
  const enrichedItems = [];
  let grandTotal = 0;

  // Extracción determinística de método de pago del mensaje del usuario o notas
  const textToScan = [userMessage, args?.notes].filter(Boolean).join(' ');
  const detectedPayment = extractPaymentMethod(textToScan);
  const finalPaymentMethod = detectedPayment || args?.paymentMethod || 'EFECTIVO';

  for (const it of rawItems) {
    const rawName = it.productName || it.title || it.description || 'Póster';
    const aliasRes = resolveEntityAlias(rawName);
    const queryName = aliasRes.matched ? aliasRes.searchQuery : rawName;
    const requestedSize = it.size || (aliasRes.matched && aliasRes.defaultSizeId) || 'MEDIANO';
    const matched = await matchPosterEverywhere(tenantId, queryName, requestedSize);
    const quantity = Math.max(1, Math.round(Number(it.quantity) || 1));
    const qty = quantity;
    const normSize = normalizeCatalogSizeId(requestedSize);

    if (matched) {
      let unitPrice = matched.unitPrice;
      if (matched.sizeId === 'PORTADA_ALBUM' || normSize === 'PORTADA_ALBUM') {
        unitPrice = 55.0;
      } else if (!unitPrice) {
        unitPrice = Number(it.unitPrice) || 65.0;
      }
      const subtotal = Number((qty * unitPrice).toFixed(2));
      grandTotal += subtotal;

      enrichedItems.push({
        productId: matched.productId || null,
        webPosterId: matched.posterId || null,
        description: matched.description,
        baseTitle: matched.baseTitle || rawName,
        category: matched.category || (aliasRes.matched ? aliasRes.category : 'ARTE'),
        thumbUrl: matched.thumbUrl || null,
        imageUrl: matched.imageUrl || null,
        quantity: qty,
        unitPrice,
        subtotal,
        sizeId: matched.sizeId || normSize,
        availableSizes: matched.availableSizes || [],
      });
    } else {
      let fallbackPrice = 65.0;
      if (normSize === 'MINI') fallbackPrice = 25.0;
      else if (normSize === 'PEQUENO') fallbackPrice = 35.0;
      else if (normSize === 'MEDIANO') fallbackPrice = 65.0;
      else if (normSize === 'GRANDE') fallbackPrice = 125.0;
      else if (normSize === 'GIGANTE') fallbackPrice = 180.0;
      else if (normSize === 'PORTADA_ALBUM') fallbackPrice = 55.0;

      let unitPrice = Number(it.unitPrice);
      if (!unitPrice || (normSize === 'PORTADA_ALBUM' && (unitPrice === 65.0 || unitPrice <= 0))) {
        unitPrice = fallbackPrice;
      }
      if (normSize === 'PORTADA_ALBUM') {
        unitPrice = 55.0;
      }
      const subtotal = Number((qty * unitPrice).toFixed(2));
      grandTotal += subtotal;

      enrichedItems.push({
        description: `${aliasRes.matched ? aliasRes.canonicalTitle : rawName} (${normSize})`,
        baseTitle: aliasRes.matched ? aliasRes.canonicalTitle : rawName,
        quantity: qty,
        unitPrice,
        subtotal,
        sizeId: normSize,
      });
    }
  }

  const total = Number(grandTotal.toFixed(2));

  return {
    items: enrichedItems,
    total,
    paymentMethod: finalPaymentMethod,
    inputChannel: 'IA_CHAT_TEXTO',
    notes: args?.notes || 'Venta dictada por STAND IA Chat',
    customerName: args?.customerName || null,
    transcription: userMessage,
  };
}

/**
 * Genera el System Prompt Maestro para STAND {IA} estilo J.A.R.V.I.S.
 * Centraliza personalidad, directivas de venta, upselling, resolución visual y tools de DB.
 *
 * @param {object} opts
 * @param {object} [opts.event]
 * @param {object} [opts.resolvedContextData={}]
 * @param {object} [opts.pendingDraft=null]
 * @returns {string}
 */
export function buildSalesSystemPrompt({ event, resolvedContextData = {}, pendingDraft = null }) {
  const eventName = event?.name || resolvedContextData?.evento || 'el evento';
  const eventLocation = event?.location || resolvedContextData?.ubicacion || 'el stand principal';

  const draftContext = (pendingDraft && Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0)
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BORRADOR ACTIVO EN PANTALLA (EDICIÓN CONVERSACIONAL EN CURSO):
${JSON.stringify({
  items: pendingDraft.items.map(it => ({
    title: it.baseTitle || it.description,
    size: it.sizeId || 'MEDIANO',
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    subtotal: it.subtotal
  })),
  total: pendingDraft.total,
  paymentMethod: pendingDraft.paymentMethod || 'EFECTIVO',
  notes: pendingDraft.notes || ''
}, null, 2)}

DIRECTIVAS PARA EDICIÓN DEL BORRADOR:
- Si el usuario o cliente pide ajustar la venta activa ("cámbialo a grande", "ponle 2", "paga con tarjeta", "agrega uno de Batman", "quita el primero"):
  * Preserva todos los ítems actuales a menos que pidan removerlos.
  * Modifica cantidades, tamaños o método de pago según lo pedido.
  * Invoca de inmediato "prepareSaleDraft" con la totalidad de los ítems actualizados y el nuevo total.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : '';

  return `Eres STAND {IA}, el Asistente Estrella de Ventas, Curador de Arte Pop y Consultor de Mostrador para Deco Vintage Guate y Deko Labs en "${eventName}" (${eventLocation}).

Tu personalidad y estilo de comunicación están inspirados en J.A.R.V.I.S.: extraordinariamente inteligente, impecablemente eficiente, empático, carismático, sofisticado y enérgico. Amas la cultura pop (anime, música, cine clásico y moderno, cómics, videojuegos y arte retro). Estás al servicio del vendedor del stand y de los clientes que se acercan al mostrador.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. REGLAS INQUEBRANTABLES DE TONO Y TRATO (ESTILO J.A.R.V.I.S.):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- TRATO EXCLUSIVO DE "TÚ": Habla siempre de "tú" con cercanía, calidez y camaradería respetuosa.
  * PROHIBIDO terminantemente usar "usted", "su persona", "le asisto", "su revisión" o fórmulas burocráticas frías.
  * Usa expresiones amigables y cómplices: "¡Claro que sí!", "¡Excelente elección!", "Te preparé el borrador en pantalla", "¿Qué te parece esta opción?".
- PASIÓN CULTURAL AUTÉNTICA: Si te hablan de anime (Goku, Chainsaw Man, Demon Slayer), música (Bad Bunny, Taylor Swift, The Beatles), superhéroes (Spider-Man, Batman), autos (Porsche, Checo Pérez) o cine, responde con genuino entusiasmo de conocedor.
- RITMO DE STAND DE EVENTO: En un evento masivo el ritmo es rápido y vibrante. Sé conciso, dinámico y resolutivo. Nada de párrafos eternos ni rodeos innecesarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. DIRECTIVAS DE VENTA, ASESORAMIENTO Y UPSELLING ACTIVO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando asesores a un cliente indeciso, recomiendes obras o hables de tamaños y calidad, promueve activamente estos 4 pilares comerciales:

1. TAMAÑO ESTRELLA — MEDIANO (30x45 cm / 12x18 pulg a Q65.00):
   - Es el tamaño más popular y vendido de Deco Vintage.
   - El punto de equilibrio perfecto: impacto visual impresionante para recámaras, salas, oficinas o setups de gaming, a un precio sumamente accesible (Q65.00). Si el cliente duda del tamaño, recomiéndale siempre el Mediano.

2. CALIDAD DE IMPRESIÓN INSUPERABLE — HP LÁTEX ECOLÓGICO:
   - Destaca que no son pósters de papel común: son impresiones de alta definición con tecnología y tintas ecológicas originales HP Látex base agua.
   - Durabilidad UV superior a 10 años sin decoloración ni pérdida de nitidez, resistentes a la luz ambiental y libres de olores tóxicos.

3. MONTAJE ULTRA RÁPIDO — CINTA tesa® ORIGINAL EN 15 SEGUNDOS:
   - Resalta que cada cuadro viene listo para colocar con cinta de montaje rápido de alta adherencia tesa®.
   - Se instala en la pared en sólo 15 segundos sin usar clavos, tornillos, martillos ni taladros. ¡Cero agujeros y cero daños a la pintura!

4. ESPECIAL MELÓMANOS — PORTADA DE ÁLBUM (30x30 cm a Q55.00):
   - Si el cliente pregunta por música, discos o portadas de vinilo (ej. Bad Bunny, Taylor Swift, Pink Floyd, The Beatles), recomienda el formato cuadrado Portada de Álbum (30x30 cm / 12x12 pulg) a Q55.00, ideal para crear galerías musicales en pared.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CATÁLOGO OFICIAL DE MEDIDAS Y EQUIVALENCIAS (GUATEMALA - QUETZALES):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Mini (Q25.00): 14x21 cm (~5x7 o 6x8 pulg) -> Colecciones de escritorio y espacios pequeños.
- Pequeño (Q35.00): 21x27 cm (~8x10 u 8.5x11 pulg) -> Repisas y rincones compactos.
- Portada de Álbum (Q55.00): 30x30 cm (~12x12 pulg) -> Formato cuadrado exclusivo música / vinilo.
- Mediano [OPCIÓN ESTRELLA] (Q65.00): 30x45 cm (~12x18 pulg) -> El más vendido y recomendado.
- Grande (Q125.00): 45x60 cm (~18x24 pulg) -> Pared principal, impacto visual alto.
- Gigante (Q180.00): 60x90 cm (~24x36 pulg) -> Formato galería imponente para salas principales.

REGLAS ESTRICTAS DE MAPEO DE MEDIDAS:
- Si piden "18x24" o "45x60", asignar SIEMPRE tamaño "GRANDE" (Q125.00).
- Si piden "24x36" o "60x90", asignar SIEMPRE tamaño "GIGANTE" (Q180.00).
- Si piden "12x18" o "30x45", asignar SIEMPRE tamaño "MEDIANO" (Q65.00).
- Si piden "portada", "disco", "vinilo", "álbum" o "30x30", asignar SIEMPRE tamaño "PORTADA_ALBUM" (Q55.00).
- Si no especifican tamaño al ordenar una venta general, asume por defecto "MEDIANO" (Q65.00).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. PROTOCOLO DE HERRAMIENTAS Y FUNCTION CALLING (@google/genai):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuentas con 7 herramientas oficiales conectadas a PostgreSQL y al motor de catálogo. Debes utilizarlas proactivamente según la necesidad:

1. "prepareSaleDraft" (GENERACIÓN Y EDICIÓN PROACTIVA DE VENTAS):
   - Invoca esta herramienta cuando:
     a) El vendedor registre una venta directa: "vendí 1 de Spiderman", "anota venta de...", "acabo de cobrar 2 de Goku en efectivo".
     b) El cliente muestre CLARA INTENCIÓN DE COMPRA: "me llevo el de Batman", "quiero el de Taylor Swift en mediano", "dame 2 portadas de Bad Bunny", "voy a pagar con tarjeta". ¡Sé proactivo y deja listo el borrador para que el vendedor solo lo confirme!
     c) Se solicite modificar el borrador activo en pantalla.
   - Parámetros requeridos: items (con productName, quantity, unitPrice, size), total, paymentMethod ("EFECTIVO", "TARJETA", "TRANSFERENCIA"), notes, customerName.
   - PROHIBIDO generar bloques de texto markdown falsos (\`\`\`json_sale o \`\`\`json) en tu respuesta. La venta se estructura exclusivamente con esta tool.

2. "searchCatalog":
   - Invoca para buscar en los 233 pósters de la web ante preguntas de disponibilidad, recomendaciones o estilos artísticos (ej. "¿tienen algo de anime?", "¿qué pósters de Star Wars hay?").

3. "checkInventoryStock":
   - Invoca cuando pregunten específicamente si una obra está físicamente en el stand, lista para entrega inmediata o en qué tamaños queda disponible.

4. "getEventKPIs":
   - Invoca cuando pregunten por el desempeño global del evento (ventas totales acumuladas, número de transacciones, ticket promedio, desglose de cobros).

5. "getCashDrawerStatus":
   - Invoca cuando pregunten por el dinero en gaveta física del stand, cobros en tarjeta, transferencias bancarias o el último arqueo de caja registrado.

6. "getSellerShiftReport":
   - Invoca cuando pregunten por el ranking de vendedores, quién lidera las ventas o el reporte individual de un vendedor.

7. "getProductionQueueStatus":
   - Invoca cuando pregunten por el estado del taller, obras pendientes de impresión o enmarcado, trabajos rezagados o tiempos estimados de entrega.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. RESOLUCIÓN DE REFERENCIAS ORDINALES A OBRAS EN PANTALLA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si el usuario dice "la segunda que me mostraste", "la primera", "la de en medio", "la última" o "las dos primeras":
  * Lee el bloque "[Contexto de obras mostradas en pantalla al cliente en este turno: ...]" del mensaje anterior en el historial.
  * Mapea con precisión: Opción #1 -> la primera; Opción #2 -> la segunda; etc.
  * Toma directamente el título y datos de esa obra para preparar el borrador con "prepareSaleDraft" o responder sin pedirle al usuario que repita el nombre.

${draftContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS OPERATIVOS DEL EVENTO EN VIVO (POSTGRESQL):
${JSON.stringify(resolvedContextData, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * 5. CHAT ANALÍTICO DE VENTAS: Consultas en lenguaje natural ("STAND IA de Stand")
 */

export async function chatWithSalesAssistant({ message, history = [], tenantId, eventId, date = null, pendingDraft = null, geminiClient = null }) {
  const gemini = geminiClient || getGeminiClient();

  let kpis = null;
  let event = null;
  try {
    kpis = await getEventKPIs({ tenantId, eventId, date });
    event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true, location: true, salesTarget: true },
    });
  } catch (dbErr) {
    console.warn('⚠️ [chatWithSalesAssistant] Error cargando contexto de evento:', dbErr.message);
  }

  const contextData = {
    evento: event?.name || 'el evento',
    ubicacion: event?.location || 'Mostrador Stand',
    metaVentas: event?.salesTarget ? `Q ${event.salesTarget}` : 'Sin meta definida',
    totalVendido: kpis ? `Q ${kpis.totalAmount.toFixed(2)}` : 'Q 0.00',
    transaccionesTotales: kpis ? kpis.totalTransactions : 0,
    unidadesVendidas: kpis ? kpis.totalUnits : 0,
    ticketPromedio: kpis ? `Q ${kpis.averageTicket.toFixed(2)}` : 'Q 0.00',
    desgloseMetodosPago: kpis ? {
      efectivo: `Q ${kpis.paymentBreakdown.EFECTIVO.amount.toFixed(2)} (${kpis.paymentBreakdown.EFECTIVO.count} ventas)`,
      tarjeta: `Q ${kpis.paymentBreakdown.TARJETA.amount.toFixed(2)} (${kpis.paymentBreakdown.TARJETA.count} ventas)`,
      transferencia: `Q ${kpis.paymentBreakdown.TRANSFERENCIA.amount.toFixed(2)} (${kpis.paymentBreakdown.TRANSFERENCIA.count} ventas)`,
    } : { efectivo: 'Q 0.00 (0 ventas)', tarjeta: 'Q 0.00 (0 ventas)', transferencia: 'Q 0.00 (0 ventas)' },
    topProductos: kpis ? kpis.topProducts : [],
    ultimasVentas: kpis ? kpis.recentSales.map(s => ({
      numero: s.saleNumber,
      total: `Q ${s.totalAmount}`,
      vendedor: s.seller?.fullName,
      hora: s.createdAt,
      items: s.items.map(i => `${i.quantity}x ${i.description}`).join(', '),
      pagos: s.payments.map(p => `${p.method}: Q${p.amount}`).join(', ')
    })) : [],
  };

  const systemPrompt = buildSalesSystemPrompt({
    event,
    resolvedContextData: contextData,
    pendingDraft,
  });

  if (!gemini) {
    const isSaleKeyword = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    if (isSaleKeyword) {
      return {
        reply: `[Modo Offline/Local] Detecté una intención de venta: "${message}". Puedes registrarla con el formulario manual ágil justo abajo para asignarle número de ticket correlativo.`,
        draftSale: null,
        suggestedPosters: [],
        toolCalls: [],
      };
    }
    return {
      reply: `[Modo Offline] Actualmente hay ${contextData.totalVendido} vendidos en ${contextData.transaccionesTotales} transacciones del evento "${contextData.evento}".`,
      draftSale: null,
      suggestedPosters: [],
      toolCalls: [],
    };
  }

  try {
    const formattedContents = [
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text || h.content || '' }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const { result: response, usedModel, fallbackOccurred, initialModel } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => {
        return await client.models.generateContent({
          model,
          contents: formattedContents,
          config: {
            systemInstruction: systemPrompt,
            tools: salesAssistantTools,
          },
        });
      },
      actionName: 'AI_CHAT',
      tenantId,
      context: { eventId },
      client: gemini,
    });

    const rawText = response.text?.trim() || '';
    let draftSale = null;
    let suggestedPosters = [];
    let eventKpis = null;
    let cashDrawerStatus = null;
    let sellerShiftReport = null;
    let productionQueueStatus = null;
    let inventoryStock = null;
    const functionCalls = response.functionCalls || [];

    // Procesar llamadas a herramientas nativas de Gemini 2.5 Flash
    for (const call of functionCalls) {
      if (call.name === 'prepareSaleDraft' && call.args) {
        draftSale = await constructDraftPayload(tenantId, call.args, message);
      } else if (call.name === 'searchCatalog' && call.args?.query) {
        const resolvedQuery = normalizeArtworkQuery(call.args.query);
        const matches = await searchWebPosters({
          tenantId,
          query: resolvedQuery,
          category: call.args.category,
          limit: 12,
        });
        if (matches?.length > 0) {
          suggestedPosters = matches;
        }
      } else if (call.name === 'getEventKPIs') {
        const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo') ? call.args.eventId : eventId;
        const targetDate = call.args?.date || date || null;
        try {
          eventKpis = await getEventKPIs({ tenantId, eventId: targetEventId, date: targetDate });
        } catch (kpiErr) {
          console.warn('⚠️ [chatWithSalesAssistant] Error consultando KPIs:', kpiErr.message);
        }
      } else if (call.name === 'getCashDrawerStatus') {
        const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo') ? call.args.eventId : eventId;
        cashDrawerStatus = await executeGetCashDrawerStatus(tenantId, targetEventId);
      } else if (call.name === 'getSellerShiftReport') {
        const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo') ? call.args.eventId : eventId;
        const targetSellerId = call.args?.sellerId || null;
        sellerShiftReport = await executeGetSellerShiftReport(tenantId, targetEventId, targetSellerId);
      } else if (call.name === 'getProductionQueueStatus') {
        const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo') ? call.args.eventId : eventId;
        productionQueueStatus = await executeGetProductionQueueStatus(tenantId, targetEventId);
      } else if (call.name === 'checkInventoryStock' && call.args?.query) {
        const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo') ? call.args.eventId : eventId;
        inventoryStock = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, targetEventId);
        if (inventoryStock?.suggestedPosters?.length > 0 && suggestedPosters.length === 0) {
          suggestedPosters = inventoryStock.suggestedPosters;
        }
      }
    }

    let cleanReply = rawText;
    if (!cleanReply && cashDrawerStatus) {
      cleanReply = cashDrawerStatus.summaryText;
    } else if (!cleanReply && sellerShiftReport) {
      cleanReply = sellerShiftReport.summaryText;
    } else if (!cleanReply && productionQueueStatus) {
      cleanReply = productionQueueStatus.summary;
    } else if (!cleanReply && inventoryStock) {
      cleanReply = inventoryStock.summary;
    } else if (!cleanReply && eventKpis) {
      cleanReply = `📊 Ventas en tiempo real: Q ${eventKpis.totalAmount?.toFixed(2) || '0.00'} en ${eventKpis.totalTransactions || 0} transacciones (${eventKpis.totalUnits || 0} obras vendidas).`;
    } else if (!cleanReply && draftSale) {
      cleanReply = '¡Listo! He preparado el borrador de la venta en tu pantalla con todos los detalles. Revísalo y confírmalo en el mostrador para emitir el ticket.';
    } else if (!cleanReply && suggestedPosters.length > 0) {
      cleanReply = '¡Por supuesto! Aquí tienes las opciones más destacadas de nuestro catálogo para ti:';
    } else if (!cleanReply) {
      cleanReply = '¡Entendido! Con gusto te apoyo con cualquier otra consulta o venta en el stand.';
    }

    return {
      reply: cleanReply,
      draftSale,
      suggestedPosters,
      eventKpis,
      cashDrawerStatus,
      sellerShiftReport,
      productionQueueStatus,
      inventoryStock,
      toolCalls: functionCalls,
      functionCalls,
      usedModel,
      fallbackOccurred,
      initialModel,
    };
  } catch (err) {
    console.error('❌ Error en chatWithSalesAssistant:', err);
    return {
      reply: `Error consultando IA de ventas: ${err.message}`,
      draftSale: null,
      suggestedPosters: [],
      toolCalls: [],
      functionCalls: [],
    };
  }
}

/**
 * 6. STREAMING DE CHAT EN TIEMPO REAL (SSE): Emite tokens progresivos y llamadas a herramientas (Gemini 2.5 Flash)
 */
export async function* streamChatWithSalesAssistant(
  messageOrOptions,
  historyParam = [],
  pendingDraftParam = null,
  contextDataParam = {},
  geminiClientParam = null
) {
  let message, history, pendingDraft, contextData, tenantId, eventId, date, geminiClient;
  if (
    messageOrOptions &&
    typeof messageOrOptions === 'object' &&
    !Array.isArray(messageOrOptions) &&
    messageOrOptions.message !== undefined
  ) {
    message = messageOrOptions.message;
    history = messageOrOptions.history || [];
    pendingDraft = messageOrOptions.pendingDraft || null;
    tenantId = messageOrOptions.tenantId;
    eventId = messageOrOptions.eventId;
    date = messageOrOptions.date || null;
    contextData = messageOrOptions.contextData || {};
    geminiClient = messageOrOptions.geminiClient || null;
  } else {
    message = messageOrOptions;
    history = historyParam || [];
    pendingDraft = pendingDraftParam || null;
    contextData = contextDataParam || {};
    tenantId = contextData.tenantId;
    eventId = contextData.eventId;
    date = contextData.date || null;
    geminiClient = geminiClientParam || null;
  }

  const gemini = geminiClient || getGeminiClient();

  let kpis = null;
  let event = null;
  if (eventId) {
    try {
      kpis = await getEventKPIs({ tenantId, eventId, date });
      event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { name: true, location: true, salesTarget: true },
      });
    } catch (dbErr) {
      console.warn('⚠️ [streamChatWithSalesAssistant] Error cargando contexto de evento:', dbErr.message);
    }
  }

  const resolvedContextData = {
    evento: event?.name || contextData?.evento || 'el evento',
    ubicacion: event?.location || contextData?.ubicacion || 'Mostrador Stand',
    metaVentas: event?.salesTarget ? `Q ${event.salesTarget}` : (contextData?.metaVentas || 'Sin meta definida'),
    totalVendido: kpis ? `Q ${kpis.totalAmount.toFixed(2)}` : (contextData?.totalVendido || 'Q 0.00'),
    transaccionesTotales: kpis ? kpis.totalTransactions : (contextData?.transaccionesTotales || 0),
    unidadesVendidas: kpis ? kpis.totalUnits : (contextData?.unidadesVendidas || 0),
    ticketPromedio: kpis ? `Q ${kpis.averageTicket.toFixed(2)}` : (contextData?.ticketPromedio || 'Q 0.00'),
    desgloseMetodosPago: kpis ? {
      efectivo: `Q ${kpis.paymentBreakdown.EFECTIVO.amount.toFixed(2)} (${kpis.paymentBreakdown.EFECTIVO.count} ventas)`,
      tarjeta: `Q ${kpis.paymentBreakdown.TARJETA.amount.toFixed(2)} (${kpis.paymentBreakdown.TARJETA.count} ventas)`,
      transferencia: `Q ${kpis.paymentBreakdown.TRANSFERENCIA.amount.toFixed(2)} (${kpis.paymentBreakdown.TRANSFERENCIA.count} ventas)`,
    } : (contextData?.desgloseMetodosPago || {}),
    topProductos: kpis ? kpis.topProducts : (contextData?.topProductos || []),
    ultimasVentas: kpis ? kpis.recentSales.map(s => ({
      numero: s.saleNumber,
      total: `Q ${s.totalAmount}`,
      vendedor: s.seller?.fullName,
      hora: s.createdAt,
      items: s.items.map(i => `${i.quantity}x ${i.description}`).join(', '),
      pagos: s.payments.map(p => `${p.method}: Q${p.amount}`).join(', ')
    })) : (contextData?.ultimasVentas || []),
  };

  const systemInstruction = buildSalesSystemPrompt({
    event,
    resolvedContextData,
    pendingDraft,
  });

  if (!gemini) {
    const isSaleKeyword = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    const offlineText = isSaleKeyword
      ? `[Modo Offline/Local] Detecté una intención de venta: "${message}". Puedes registrarla con el formulario manual ágil justo abajo para asignarle número de ticket correlativo.`
      : `[Modo Offline] Actualmente hay ${resolvedContextData.totalVendido} vendidos en ${resolvedContextData.transaccionesTotales} transacciones del evento "${resolvedContextData.evento}".`;
    yield { type: 'token', text: offlineText };
    return;
  }

  const formattedContents = [
    ...history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text || h.content || '' }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let effectiveModel = ENV.GEMINI_MODEL || 'gemini-2.5-flash';
  const stream = streamWithModelFallback({
    buildContentsAndConfig: ({ model }) => ({
      contents: formattedContents,
      config: {
        systemInstruction,
        tools: salesAssistantTools,
        safetySettings: salesAssistantSafetySettings,
      },
    }),
    onModelSelected: (selectedModel) => {
      effectiveModel = selectedModel;
    },
    client: gemini,
  });

  const executedCalls = new Set();
  let hasTextTokens = false;
  const toolSummaries = [];

  for await (const chunk of stream) {
    if (chunk.type) {
      yield chunk;
      if (chunk.type === 'token' && chunk.text) {
        hasTextTokens = true;
      }
      continue;
    }

    if (chunk.text) {
      hasTextTokens = true;
      yield { type: 'token', text: chunk.text };
    }

    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      for (const call of chunk.functionCalls) {
        if (!call || !call.name) continue;
        const callSignature = `${call.name}:${JSON.stringify(call.args || {})}`;
        if (executedCalls.has(callSignature)) {
          continue;
        }
        executedCalls.add(callSignature);

        if (call.name === 'prepareSaleDraft' && call.args) {
          const draft = await constructDraftPayload(tenantId, call.args, message);
          yield { type: 'draft_sale', data: draft };
        } else if (call.name === 'searchCatalog' && call.args?.query) {
          const resolvedQuery = normalizeArtworkQuery(call.args.query);
          const posters = await searchWebPosters({
            tenantId,
            query: resolvedQuery,
            category: call.args.category,
            limit: 12,
          });
          yield { type: 'suggested_posters', data: posters || [] };
        } else if (call.name === 'getEventKPIs') {
          let effectiveEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo')
            ? call.args.eventId
            : (eventId || contextData?.eventId);
          const effectiveTenantId = tenantId || contextData?.tenantId || null;
          const effectiveDate = call.args?.date || date || contextData?.date || null;

          if (!effectiveEventId) {
            try {
              const activeEvent = await prisma.event.findFirst({
                where: { status: 'ACTIVO', ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}) },
                select: { id: true },
              });
              effectiveEventId = activeEvent?.id || null;
            } catch (evErr) {
              console.warn('⚠️ [streamChatWithSalesAssistant] Error buscando evento activo:', evErr.message);
            }
          }

          let freshKpis = null;
          try {
            freshKpis = await getEventKPIs({
              tenantId: effectiveTenantId,
              eventId: effectiveEventId,
              date: effectiveDate,
            });
          } catch (kpiErr) {
            console.warn('⚠️ [streamChatWithSalesAssistant] Error consultando KPIs en PostgreSQL:', kpiErr.message);
            freshKpis = {
              eventId: effectiveEventId || 'offline',
              event: { id: effectiveEventId, name: resolvedContextData.evento || 'Evento Activo', location: resolvedContextData.ubicacion || 'Stand' },
              date: effectiveDate,
              totalTransactions: resolvedContextData.transaccionesTotales || 0,
              totalAmount: typeof resolvedContextData.totalVendido === 'string' ? Number(resolvedContextData.totalVendido.replace(/[^0-9.]/g, '')) || 0 : (resolvedContextData.totalVendido || 0),
              totalRevenue: typeof resolvedContextData.totalVendido === 'string' ? Number(resolvedContextData.totalVendido.replace(/[^0-9.]/g, '')) || 0 : (resolvedContextData.totalVendido || 0),
              totalUnits: resolvedContextData.unidadesVendidas || 0,
              totalItemsSold: resolvedContextData.unidadesVendidas || 0,
              averageTicket: typeof resolvedContextData.ticketPromedio === 'string' ? Number(resolvedContextData.ticketPromedio.replace(/[^0-9.]/g, '')) || 0 : (resolvedContextData.ticketPromedio || 0),
              paymentBreakdown: {
                EFECTIVO: { count: 0, amount: 0 },
                TARJETA: { count: 0, amount: 0 },
                TRANSFERENCIA: { count: 0, amount: 0 },
                OTRO: { count: 0, amount: 0 },
              },
              topProducts: resolvedContextData.topProductos || [],
              recentSales: resolvedContextData.ultimasVentas || [],
            };
          }

          if (freshKpis) {
            yield { type: 'event_kpis', data: freshKpis };

            const kpiSummary = `📊 **Estado de ventas en tiempo real — "${freshKpis.event?.name || 'Evento Activo'}":**\n\n` +
              `• **Total vendido:** Q ${freshKpis.totalAmount?.toFixed(2) || '0.00'}\n` +
              `• **Transacciones:** ${freshKpis.totalTransactions || 0} ventas (${freshKpis.totalUnits || 0} obras)\n` +
              `• **Ticket promedio:** Q ${freshKpis.averageTicket?.toFixed(2) || '0.00'}\n` +
              `• **Desglose de cobros:** Efectivo: Q ${freshKpis.paymentBreakdown?.EFECTIVO?.amount?.toFixed(2) || '0.00'} | Tarjeta: Q ${freshKpis.paymentBreakdown?.TARJETA?.amount?.toFixed(2) || '0.00'} | Transferencia: Q ${freshKpis.paymentBreakdown?.TRANSFERENCIA?.amount?.toFixed(2) || '0.00'}\n` +
              (freshKpis.topProducts?.length > 0 ? `• **Más vendidos:** ${freshKpis.topProducts.slice(0, 3).map(p => `${p.name} (${p.quantity})`).join(', ')}` : '');
            toolSummaries.push(kpiSummary);
          }
        } else if (call.name === 'getCashDrawerStatus') {
          const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo')
            ? call.args.eventId
            : (eventId || contextData?.eventId);
          const cashStatus = await executeGetCashDrawerStatus(tenantId, targetEventId);
          yield { type: 'cash_drawer_status', data: cashStatus };
          if (cashStatus?.summaryText) {
            toolSummaries.push(cashStatus.summaryText);
          }
        } else if (call.name === 'getSellerShiftReport') {
          const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo')
            ? call.args.eventId
            : (eventId || contextData?.eventId);
          const targetSellerId = call.args?.sellerId || null;
          const report = await executeGetSellerShiftReport(tenantId, targetEventId, targetSellerId);
          yield { type: 'seller_shift_report', data: report };
          if (report?.summaryText) {
            toolSummaries.push(report.summaryText);
          }
        } else if (call.name === 'getProductionQueueStatus') {
          const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo')
            ? call.args.eventId
            : (eventId || contextData?.eventId);
          const queue = await executeGetProductionQueueStatus(tenantId, targetEventId);
          yield { type: 'production_queue_status', data: queue };
          if (queue?.summary) {
            toolSummaries.push(queue.summary);
          }
        } else if (call.name === 'checkInventoryStock' && call.args?.query) {
          const targetEventId = (call.args?.eventId && call.args.eventId !== 'current' && call.args.eventId !== 'activo')
            ? call.args.eventId
            : (eventId || contextData?.eventId);
          const stock = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, targetEventId);
          yield { type: 'inventory_stock', data: stock };
          if (stock?.suggestedPosters?.length > 0) {
            yield { type: 'suggested_posters', data: stock.suggestedPosters };
          }
          if (stock?.summary) {
            toolSummaries.push(stock.summary);
          }
        }
      }
    }
  }

  // Si el modelo sólo emitió llamadas a herramientas y no generó tokens de texto,
  // proveer el resumen conversacional cálido de las herramientas ejecutadas.
  if (!hasTextTokens && toolSummaries.length > 0) {
    for (const summary of toolSummaries) {
      yield { type: 'token', text: summary.trim() };
    }
  }
}
