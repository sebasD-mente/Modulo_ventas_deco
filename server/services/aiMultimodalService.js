import { Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { getGeminiClient } from '../config/gemini.js';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { getEventKPIs } from './saleService.js';
import { searchWebPosters, getAllWebPostersCatalogSummary } from './webCatalogService.js';

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
  if (/30x30|12x12|vinilo|album|álbum/.test(compact)) return 'PORTADA_ALBUM';

  // 2. Mapeo por términos textuales
  if (/gigante|extra\s*grande|xl\b/i.test(raw)) return 'GIGANTE';
  if (/grande|large|l\b/i.test(raw)) return 'GRANDE';
  if (/mediano|medio|medium|m\b/i.test(raw)) return 'MEDIANO';
  if (/peque[ñn]o|chico|small|s\b/i.test(raw)) return 'PEQUENO';
  if (/mini|miniatura|xs\b/i.test(raw)) return 'MINI';

  return raw.toUpperCase();
}

/**
 * Busca coincidencia tanto en el catálogo local del stand como en los 233 pósters de la web
 */
export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  if (!query) return null;
  const clean = String(query).trim();

  // 1. Buscar en los 233 pósters con motor de scoring multi-token
  const webMatches = await searchWebPosters({ tenantId, query: clean, limit: 3 });
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
        description: 'Identificador único del evento activo.',
      },
    },
    required: ['eventId'],
  },
};

export const salesAssistantTools = [
  {
    functionDeclarations: [
      prepareSaleDraftDeclaration,
      searchCatalogDeclaration,
      getEventKPIsDeclaration,
    ],
  },
];

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

  for (const it of rawItems) {
    const queryName = it.productName || it.title || it.description || 'Póster';
    const requestedSize = it.size || 'MEDIANO';
    const matched = await matchPosterEverywhere(tenantId, queryName, requestedSize);
    const quantity = Math.max(1, Math.round(Number(it.quantity) || 1));
    const qty = quantity;

    if (matched) {
      const unitPrice = matched.unitPrice || Number(it.unitPrice) || 65.0;
      const subtotal = Number((qty * unitPrice).toFixed(2));
      grandTotal += subtotal;

      enrichedItems.push({
        productId: matched.productId || null,
        webPosterId: matched.posterId || null,
        description: matched.description,
        baseTitle: matched.baseTitle || queryName,
        category: matched.category || 'ARTE',
        thumbUrl: matched.thumbUrl || null,
        imageUrl: matched.imageUrl || null,
        quantity: qty,
        unitPrice,
        subtotal,
        sizeId: matched.sizeId || 'MEDIANO',
        availableSizes: matched.availableSizes || [],
      });
    } else {
      const normSize = normalizeCatalogSizeId(requestedSize);
      let fallbackPrice = 65.0;
      if (normSize === 'MINI') fallbackPrice = 25.0;
      else if (normSize === 'PEQUENO') fallbackPrice = 35.0;
      else if (normSize === 'MEDIANO') fallbackPrice = 65.0;
      else if (normSize === 'GRANDE') fallbackPrice = 125.0;
      else if (normSize === 'GIGANTE') fallbackPrice = 180.0;
      else if (normSize === 'PORTADA_ALBUM') fallbackPrice = 55.0;

      const unitPrice = Number(it.unitPrice) || fallbackPrice;
      const subtotal = Number((qty * unitPrice).toFixed(2));
      grandTotal += subtotal;

      enrichedItems.push({
        description: `${queryName} (${normSize})`,
        baseTitle: queryName,
        quantity: qty,
        unitPrice,
        subtotal,
        sizeId: normSize,
      });
    }
  }

  const total = args?.total != null && Number(args.total) > 0
    ? Number(Number(args.total).toFixed(2))
    : Number(grandTotal.toFixed(2));

  return {
    items: enrichedItems,
    total,
    paymentMethod: args?.paymentMethod || 'EFECTIVO',
    inputChannel: 'IA_CHAT_TEXTO',
    notes: args?.notes || 'Venta dictada por Jarvis Chat',
    customerName: args?.customerName || null,
    transcription: userMessage,
  };
}

/**
 * 5. CHAT ANALÍTICO DE VENTAS: Consultas en lenguaje natural ("Jarvis de Stand")
 */
export async function chatWithSalesAssistant({ message, history = [], tenantId, eventId, date = null, pendingDraft = null }) {
  const gemini = getGeminiClient();

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

  const draftContext = (pendingDraft && Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0)
    ? `
BORRADOR DE VENTA ACTUAL EN PANTALLA (EDICIÓN CONVERSACIONAL ACTIVA):
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

INSTRUCCIONES PARA MODIFICACIÓN DEL BORRADOR:
- Si el usuario solicita modificar o ajustar la venta actual (ejemplos: "cámbialo a tamaño grande", "ponle 2 unidades", "cambia a tarjeta", "agrega uno de Batman", "elimina el primero"):
  * Preserva las obras existentes del borrador a menos que el usuario indique removerlas.
  * Aplica los cambios solicitados (tamaño, cantidad, método de pago o adición de obras).
  * Invoca la herramienta formal prepareSaleDraft con la totalidad de los ítems actualizados y el total recalculado.
` : '';

  const systemPrompt = `Eres Jarvis, el Asistente Inteligente de Ventas y Consultor de Stand para Deco Vintage Guate en "${event?.name || 'el evento'}".

REGLAS ESTRICTAS DE HERRAMIENTAS Y FUNCTION CALLING:

1. MODO CONSULTA Y ATENCIÓN AL CLIENTE:
   - Si el usuario pregunta por disponibilidad de obras, recomendaciones o artistas, invoca la herramienta "searchCatalog".
   - Si el usuario pregunta por métricas, ventas totales, tickets o dinero en caja, invoca la herramienta "getEventKPIs".
   - Responde de forma concisa, profesional y cordial.
   - NUNCA invoques "prepareSaleDraft" para preguntas informativas o saludos.

2. MODO REGISTRO DE VENTA (SÓLO ANTE ÓRDENES EXPLÍCITAS DE VENTA O COBRO):
   - ÚNICAMENTE cuando el usuario confirme o indique que vendió o cobró una obra (ejemplos claros: "vendí 1 póster de Batman", "anota venta de...", "acabo de cobrar...", "cliente paga 1 de Spiderman en efectivo", "1 póster de Pablo sonrisa y 1 de Olivia en tarjeta"), o solicite modificar el borrador activo en pantalla:
   - Invoca ÚNICAMENTE la herramienta formal "prepareSaleDraft" especificando cada ítem con productName, quantity, unitPrice, size ("MINI", "PEQUENO", "MEDIANO", "GRANDE", "GIGANTE", "PORTADA_ALBUM"), total y paymentMethod ("EFECTIVO", "TARJETA", "TRANSFERENCIA").
   - Queda TERMINANTEMENTE PROHIBIDO generar bloques de texto markdown (como json_sale o json) en el cuerpo de tu respuesta. La venta se debe estructurar exclusivamente llamando a la herramienta formal "prepareSaleDraft".
   - Devuelve un mensaje cordial aclarando que preparaste el borrador de la venta para su revisión y confirmación en el mostrador.

Catálogo oficial de Deco Vintage y equivalencias de medidas:
- Precios estándar:
  * Mini (Q25): 14x21 cm (~5x7 o 6x8 pulgadas)
  * Pequeño (Q35): 21x27 cm (~8x10 u 8.5x11 pulgadas)
  * Mediano (Q65): 30x45 cm (~12x18 pulgadas)
  * Grande (Q125): 45x60 cm (~18x24 pulgadas) -> Si piden "18x24", asignar SIEMPRE tamaño "GRANDE" (Q125).
  * Gigante (Q180): 60x90 cm (~24x36 pulgadas) -> Si piden "24x36", asignar SIEMPRE tamaño "GIGANTE" (Q180).
  * Portada de Álbum de música: Formato vinilo 30x30 cm (~12x12 pulgadas) (Q55).

${draftContext}

Métricas en vivo de PostgreSQL:
${JSON.stringify(contextData, null, 2)}`;

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
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text || h.content || '' }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await gemini.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: formattedContents,
      config: {
        tools: salesAssistantTools,
      },
    });

    const rawText = response.text?.trim() || '';
    let draftSale = null;
    let suggestedPosters = [];
    const functionCalls = response.functionCalls || [];

    // Procesar llamadas a herramientas nativas de Gemini 2.5 Flash
    for (const call of functionCalls) {
      if (call.name === 'prepareSaleDraft' && call.args) {
        draftSale = await constructDraftPayload(tenantId, call.args, message);
      } else if (call.name === 'searchCatalog' && call.args?.query) {
        const matches = await searchWebPosters({
          tenantId,
          query: call.args.query,
          category: call.args.category,
          limit: 4,
        });
        if (matches?.length > 0) {
          suggestedPosters = matches;
        }
      } else if (call.name === 'getEventKPIs') {
        // Métricas ya se encuentran integradas en el contexto activo
      }
    }

    let cleanReply = rawText;
    if (!cleanReply && draftSale) {
      cleanReply = 'He preparado el borrador de la venta para su revisión y confirmación en el mostrador.';
    } else if (!cleanReply && suggestedPosters.length > 0) {
      cleanReply = 'Aquí tienes los pósters encontrados en el catálogo para tu consulta:';
    } else if (!cleanReply) {
      cleanReply = 'Entendido.';
    }

    return {
      reply: cleanReply,
      draftSale,
      suggestedPosters,
      toolCalls: functionCalls,
      functionCalls,
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
  contextDataParam = {}
) {
  let message, history, pendingDraft, contextData, tenantId, eventId, date;
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
  } else {
    message = messageOrOptions;
    history = historyParam || [];
    pendingDraft = pendingDraftParam || null;
    contextData = contextDataParam || {};
    tenantId = contextData.tenantId;
    eventId = contextData.eventId;
    date = contextData.date || null;
  }

  const gemini = getGeminiClient();

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

  const draftContext = (pendingDraft && Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0)
    ? `
BORRADOR DE VENTA ACTUAL EN PANTALLA (EDICIÓN CONVERSACIONAL ACTIVA):
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

INSTRUCCIONES PARA MODIFICACIÓN DEL BORRADOR:
- Si el usuario solicita modificar o ajustar la venta actual (ejemplos: "cámbialo a tamaño grande", "ponle 2 unidades", "cambia a tarjeta", "agrega uno de Batman", "elimina el primero"):
  * Preserva las obras existentes del borrador a menos que el usuario indique removerlas.
  * Aplica los cambios solicitados (tamaño, cantidad, método de pago o adición de obras).
  * Invoca la herramienta formal prepareSaleDraft con la totalidad de los ítems actualizados y el total recalculado.
` : '';

  const systemInstruction = `Eres Jarvis, el Asistente Inteligente de Ventas y Consultor de Stand para Deco Vintage Guate en "${event?.name || resolvedContextData.evento || 'el evento'}".

REGLAS ESTRICTAS DE HERRAMIENTAS Y FUNCTION CALLING:

1. MODO CONSULTA Y ATENCIÓN AL CLIENTE:
   - Si el usuario pregunta por disponibilidad de obras, recomendaciones o artistas, invoca la herramienta "searchCatalog".
   - Si el usuario pregunta por métricas, ventas totales, tickets o dinero en caja, invoca la herramienta "getEventKPIs".
   - Responde de forma concisa, profesional y cordial.
   - NUNCA invoques "prepareSaleDraft" para preguntas informativas o saludos.

2. MODO REGISTRO DE VENTA (SÓLO ANTE ÓRDENES EXPLÍCITAS DE VENTA O COBRO):
   - ÚNICAMENTE cuando el usuario confirme o indique que vendió o cobró una obra (ejemplos claros: "vendí 1 póster de Batman", "anota venta de...", "acabo de cobrar...", "cliente paga 1 de Spiderman en efectivo", "1 póster de Pablo sonrisa y 1 de Olivia en tarjeta"), o solicite modificar el borrador activo en pantalla:
   - Invoca ÚNICAMENTE la herramienta formal "prepareSaleDraft" especificando cada ítem con productName, quantity, unitPrice, size ("MINI", "PEQUENO", "MEDIANO", "GRANDE", "GIGANTE", "PORTADA_ALBUM"), total y paymentMethod ("EFECTIVO", "TARJETA", "TRANSFERENCIA").
   - Queda TERMINANTEMENTE PROHIBIDO generar bloques de texto markdown (como json_sale o json) en el cuerpo de tu respuesta. La venta se debe estructurar exclusivamente llamando a la herramienta formal "prepareSaleDraft".
   - Devuelve un mensaje cordial aclarando que preparaste el borrador de la venta para su revisión y confirmación en el mostrador.

Catálogo oficial de Deco Vintage y equivalencias de medidas:
- Precios estándar:
  * Mini (Q25): 14x21 cm (~5x7 o 6x8 pulgadas)
  * Pequeño (Q35): 21x27 cm (~8x10 u 8.5x11 pulgadas)
  * Mediano (Q65): 30x45 cm (~12x18 pulgadas)
  * Grande (Q125): 45x60 cm (~18x24 pulgadas) -> Si piden "18x24", asignar SIEMPRE tamaño "GRANDE" (Q125).
  * Gigante (Q180): 60x90 cm (~24x36 pulgadas) -> Si piden "24x36", asignar SIEMPRE tamaño "GIGANTE" (Q180).
  * Portada de Álbum de música: Formato vinilo 30x30 cm (~12x12 pulgadas) (Q55).

${draftContext}

Métricas en vivo de PostgreSQL:
${JSON.stringify(resolvedContextData, null, 2)}`;

  if (!gemini) {
    const isSaleKeyword = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    const offlineText = isSaleKeyword
      ? `[Modo Offline/Local] Detecté una intención de venta: "${message}". Puedes registrarla con el formulario manual ágil justo abajo para asignarle número de ticket correlativo.`
      : `[Modo Offline] Actualmente hay ${resolvedContextData.totalVendido} vendidos en ${resolvedContextData.transaccionesTotales} transacciones del evento "${resolvedContextData.evento}".`;
    yield { type: 'token', text: offlineText };
    return;
  }

  const formattedContents = [
    { role: 'user', parts: [{ text: systemInstruction }] },
    ...history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text || h.content || '' }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const stream = await gemini.models.generateContentStream({
    model: ENV.GEMINI_MODEL,
    contents: formattedContents,
    config: {
      systemInstruction,
      tools: salesAssistantTools,
      safetySettings: salesAssistantSafetySettings,
    },
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield { type: 'token', text: chunk.text };
    }

    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      for (const call of chunk.functionCalls) {
        if (call.name === 'prepareSaleDraft' && call.args) {
          const draft = await constructDraftPayload(tenantId, call.args, message);
          yield { type: 'draft_sale', data: draft };
        } else if (call.name === 'searchCatalog' && call.args?.query) {
          const posters = await searchWebPosters({
            tenantId,
            query: call.args.query,
            category: call.args.category,
            limit: 4,
          });
          yield { type: 'suggested_posters', data: posters || [] };
        } else if (call.name === 'getEventKPIs') {
          // KPIs ya integrados en el contexto activo
        }
      }
    }
  }
}
