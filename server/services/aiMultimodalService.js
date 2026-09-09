import { getGeminiClient } from '../config/gemini.js';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { getEventKPIs } from './saleService.js';
import { searchWebPosters, getAllWebPostersCatalogSummary } from './webCatalogService.js';

/**
 * Busca coincidencia tanto en el catálogo local del stand como en los 233 pósters de la web
 */
export async function matchPosterEverywhere(tenantId, query, requestedSize = null) {
  if (!query) return null;
  const clean = String(query).trim();

  // 1. Buscar en los 233 pósters de la web
  const webMatches = await searchWebPosters({ query: clean, limit: 3 });
  if (webMatches.length > 0) {
    const matched = webMatches[0];
    
    // Normalizar tamaño si se especificó (mini, pequeño, mediano, grande)
    let selectedSize = matched.sizes.find(s => s.sizeId === 'MEDIANO') || matched.sizes[0];
    if (requestedSize) {
      const sizeClean = requestedSize.toUpperCase();
      const foundSize = matched.sizes.find(s => 
        s.sizeId === sizeClean || 
        s.nombre.toUpperCase().includes(sizeClean)
      );
      if (foundSize) selectedSize = foundSize;
    }

    return {
      type: 'WEB_POSTER',
      posterId: matched.id,
      description: `${matched.titulo} (${selectedSize.nombre})`,
      baseTitle: matched.titulo,
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

  return null;
}

/**
 * 1. PROCESADOR DE AUDIO: Dictado por voz de ventas con soporte para el catálogo web
 */
export async function processVoiceSaleAudio({ audioBuffer, mimeType = 'audio/webm', tenantId, eventId }) {
  const gemini = getGeminiClient();

  const systemInstruction = `Eres el Asistente de Ventas de Stand para Deco Vintage Guate.
Tu tarea es escuchar el dictado del vendedor en el stand y extraer con precisión los detalles de la venta realizada.

Pósters y obras populares de referencia en el catálogo:
- Five Nights at Freddy's, Chainsaw Man, La Mona Lisa, Spider-Man, Batman, Porsche 911, The Beatles, Dragon Ball Goku, Star Wars Darth Vader, etc.
- Tamaños habituales: Mini (Q25), Pequeño (Q35), Mediano (Q65), Grande (Q125), Gigante (Q180).

Instrucciones estrictas:
1. Extrae cada obra mencionada con su nombre, tamaño ("mini", "pequeño", "mediano", "grande"), cantidad entera y precio unitario en Quetzales. Si no especifica tamaño, asume "mediano".
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
      config: { responseMimeType: 'application/json' },
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
      config: { responseMimeType: 'application/json' },
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
      config: { responseMimeType: 'application/json' },
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
      config: { responseMimeType: 'application/json' },
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
 * 5. CHAT ANALÍTICO DE VENTAS: Consultas en lenguaje natural ("Jarvis de Stand")
 */
export async function chatWithSalesAssistant({ message, history = [], tenantId, eventId, date = null }) {
  const gemini = getGeminiClient();

  const kpis = await getEventKPIs({ tenantId, eventId, date });
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, location: true, salesTarget: true },
  });

  const contextData = {
    evento: event?.name,
    ubicacion: event?.location,
    metaVentas: event?.salesTarget ? `Q ${event.salesTarget}` : 'Sin meta definida',
    totalVendido: `Q ${kpis.totalAmount.toFixed(2)}`,
    transaccionesTotales: kpis.totalTransactions,
    unidadesVendidas: kpis.totalUnits,
    ticketPromedio: `Q ${kpis.averageTicket.toFixed(2)}`,
    desgloseMetodosPago: {
      efectivo: `Q ${kpis.paymentBreakdown.EFECTIVO.amount.toFixed(2)} (${kpis.paymentBreakdown.EFECTIVO.count} ventas)`,
      tarjeta: `Q ${kpis.paymentBreakdown.TARJETA.amount.toFixed(2)} (${kpis.paymentBreakdown.TARJETA.count} ventas)`,
      transferencia: `Q ${kpis.paymentBreakdown.TRANSFERENCIA.amount.toFixed(2)} (${kpis.paymentBreakdown.TRANSFERENCIA.count} ventas)`,
    },
    topProductos: kpis.topProducts,
    ultimasVentas: kpis.recentSales.map(s => ({
      numero: s.saleNumber,
      total: `Q ${s.totalAmount}`,
      vendedor: s.seller?.fullName,
      hora: s.createdAt,
      items: s.items.map(i => `${i.quantity}x ${i.description}`).join(', '),
      pagos: s.payments.map(p => `${p.method}: Q${p.amount}`).join(', ')
    })),
  };

  const systemPrompt = `Eres Jarvis, el Asistente Inteligente y Operador de Ventas de Stand para Deco Vintage Guate en "${event?.name || 'el evento'}".

Tu rol abarca dos funciones clave:
1. CONSULTOR DE STAND: Respondes preguntas sobre ventas, estadísticas, velocidad de venta, arqueo de caja y resúmenes de cierre diarios del evento. También buscas obras del catálogo web de 233 pósters y sus tamaños disponibles (Mini Q25, Pequeño Q35, Mediano Q65, Grande Q125, Gigante Q180).
2. REGISTRO RÁPIDO DE VENTAS DICTADAS POR TEXTO: Si el usuario te indica que vendió o cobró una obra (ejemplos: "vendí 2 pósters de Batman medianos en efectivo", "anota venta de 1 Chainsaw Man", "acabo de vender un Spiderman y un Porsche a Q65 con tarjeta"):
   - Identifica cada producto mencionado, tamaño solicitado (si no lo dice, asume "MEDIANO"), cantidad entera y precio unitario en Quetzales.
   - Identifica el método de pago ("EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"). Por defecto "EFECTIVO".
   - En tu respuesta, además del texto conversacional confirmando la venta, DEBES INCLUIR al final un bloque JSON delimitado exactamente con \`\`\`json_sale y cerrado con \`\`\`:
\`\`\`json_sale
{
  "isSale": true,
  "items": [
    { "title": "Nombre de la obra", "size": "MEDIANO", "quantity": 1, "unitPrice": 65.0 }
  ],
  "paymentMethod": "EFECTIVO",
  "notes": "Venta registrada por Jarvis Chat"
}
\`\`\`
Si NO es un reporte de venta (es una simple consulta, saludo o pregunta de métricas), responde normalmente y NO incluyas el bloque \`\`\`json_sale.

Datos en tiempo real de la base de datos PostgreSQL:
${JSON.stringify(contextData, null, 2)}

Instrucciones de formato:
1. Responde de forma clara, concisa, profesional y ejecutiva.
2. Usa siempre la moneda Quetzales (Q).`;

  if (!gemini) {
    const isSaleKeyword = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    if (isSaleKeyword) {
      return {
        reply: `[Modo Offline/Local] Detecté una intención de venta: "${message}". Puedes registrarla con el formulario manual ágil justo abajo para asignarle número de ticket correlativo.`,
        draftSale: null,
      };
    }
    return {
      reply: `[Modo Offline] Actualmente hay Q ${kpis.totalAmount.toFixed(2)} vendidos en ${kpis.totalTransactions} transacciones del evento "${event?.name || 'activo'}".`,
      draftSale: null,
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
    });

    const rawText = response.text?.trim() || '';
    let draftSale = null;
    let cleanReply = rawText;

    // Detectar bloque json_sale
    const saleMatch = rawText.match(/```(?:json_sale|json)?\s*([\s\S]*?)\s*```/);
    if (saleMatch) {
      try {
        const parsedJson = JSON.parse(saleMatch[1]);
        if (parsedJson.isSale || parsedJson.items) {
          cleanReply = rawText.replace(saleMatch[0], '').trim();

          const enrichedItems = [];
          let grandTotal = 0;

          if (Array.isArray(parsedJson.items)) {
            for (const it of parsedJson.items) {
              const matched = await matchPosterEverywhere(tenantId, it.title || it.description, it.size);
              const qty = Number(it.quantity) || 1;
              const unitPrice = matched?.unitPrice || Number(it.unitPrice) || 65.0;
              const subtotal = Number((qty * unitPrice).toFixed(2));
              grandTotal += subtotal;

              enrichedItems.push({
                productId: matched?.productId || null,
                webPosterId: matched?.posterId || null,
                description: matched?.description || it.title || 'Póster',
                thumbUrl: matched?.thumbUrl || null,
                imageUrl: matched?.imageUrl || null,
                quantity: qty,
                unitPrice,
                subtotal,
                availableSizes: matched?.availableSizes || [],
              });
            }
          }

          if (enrichedItems.length > 0) {
            draftSale = {
              items: enrichedItems,
              total: Number(grandTotal.toFixed(2)),
              paymentMethod: parsedJson.paymentMethod || 'EFECTIVO',
              inputChannel: 'IA_CHAT_TEXTO',
              notes: parsedJson.notes || 'Venta dictada por Jarvis Chat',
              transcription: message,
            };
          }
        }
      } catch (err) {
        console.warn('⚠️ Error parseando bloque json_sale en chatWithSalesAssistant:', err.message);
      }
    }

    return {
      reply: cleanReply || 'Venta detectada con éxito. Por favor confirma en la tarjeta de abajo para asentar en PostgreSQL.',
      draftSale,
    };
  } catch (err) {
    console.error('❌ Error en chatWithSalesAssistant:', err);
    return {
      reply: `Error consultando IA de ventas: ${err.message}`,
      draftSale: null,
    };
  }
}
