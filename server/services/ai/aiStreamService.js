import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { getEventKPIs } from '../saleService.js';
import { executeWithModelFallback, streamWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { salesAssistantSafetySettings, buildSalesSystemPrompt } from './aiPromptService.js';
import { salesAssistantTools, constructDraftPayload, executeSearchCatalog, executeGetCashDrawerStatus, executeGetSellerShiftReport, executeGetProductionQueueStatus, executeCheckInventoryStock, executeGetHourlySalesAnalytics, executeGetTopSellingPosters } from './aiToolsService.js';
import { executeToolCall, streamClosedLoopFollowUp, buildFallbackSummaries } from './aiClosedLoopService.js';
import { parseStandIntent, extractPaymentMethod } from '../semantic/paymentExtractor.js';
import { getGeminiClient } from '../../config/gemini.js';

const getActivePool = () => Array.from(new Set([ENV.GEMINI_MODEL || 'gemini-3.8-flash', ...MODEL_PRIORITY_POOL]));
async function resolveEventContextData({ tenantId, eventId, date = null, contextData = {} }) {
  let event = null;
  const hasEventInfo = Boolean(contextData?.evento && contextData?.ubicacion);
  if (!hasEventInfo && eventId) {
    let timerId = null;
    try {
      const dbOp = prisma.event.findUnique({
        where: { id: eventId },
        select: { name: true, location: true },
      });
      const timer = new Promise((_, reject) => { timerId = setTimeout(() => reject(new Error('DB_TIMEOUT')), 200); });
      event = await Promise.race([dbOp, timer]);
    } catch (_) { /* DB fallback ultrarrápido */ } finally { if (timerId) clearTimeout(timerId); }
  }
  return {
    event, kpis: null,
    resolved: {
      evento: event?.name || contextData?.evento || 'el evento', ubicacion: event?.location || contextData?.ubicacion || 'Mostrador Stand',
      metaVentas: contextData?.metaVentas || 'Sin meta definida',
      totalVendido: contextData?.totalVendido || 'Q 0.00',
      transaccionesTotales: contextData?.transaccionesTotales || 0,
      unidadesVendidas: contextData?.unidadesVendidas || 0,
      ticketPromedio: contextData?.ticketPromedio || 'Q 0.00',
      desgloseMetodosPago: contextData?.desgloseMetodosPago || {},
      topProductos: contextData?.topProductos || [],
      ultimasVentas: contextData?.ultimasVentas || [],
      vendedorNombre: contextData?.sellerName || contextData?.vendedorNombre || 'Vendedor',
    },
  };
}

const FASTPATH_SKIP_REGEX = /(?<![\p{L}\p{N}])(kpi|metricas|métricas|vendido|ventas|caja|gaveta|corte|arqueo|top|ranking|vendedor|cola|impresion|impresión|taller|produccion|producción|stock|inventario|disponible|tienes|tienen|tenemos|tenes|hay|buscame|búscame|muestrame|muéstrame|enseñame|enséñame|que\s+posters|qué\s+pósters|recomienda)(?![\p{L}\p{N}])|[?¿]/iu;
const FASTPATH_CANCEL_REGEX = /\b(cancela\s+la\s+orden|cancelar\s+orden|no\s+me\s+llevo\s+nada|olvidalo|olvídalo|borra\s+el\s+carrito|descarta\s+el\s+borrador|limpia\s+la\s+orden)\b/i;
const FASTPATH_BUY_REGEX = /(?<![\p{L}\p{N}])(quiero|dame|llevo|agrega|ponme|necesito|v[eé]ndeme|vend[ií]|cobrame|c[oó]brame|anota|an[oó]tame|registra|comprar|me\s+llevo|apunta|apúntame|apuntalo|apúntalo|cobra|cóbame|cobrale|córbrale|vende|añade)(?![\p{L}\p{N}])/giu;

export async function tryDeterministicFastPathL0(params, eventIdArg = null, tenantIdArg = null) {
  let message = '', tenantId = null, eventId = null, pendingDraft = null;
  if (typeof params === 'string') {
    message = params;
    eventId = eventIdArg;
    tenantId = tenantIdArg;
  } else if (params && typeof params === 'object') {
    ({ tenantId, message = '', pendingDraft = null, eventId = null } = params);
  }
  const text = String(message || '').trim();
  if (!text || text.length > 200 || FASTPATH_SKIP_REGEX.test(text)) return null;

  if (FASTPATH_CANCEL_REGEX.test(text)) {
    const replyText = '🗑️ Listo, he cancelado y limpiado el borrador de venta en pantalla.';
    return {
      reply: replyText,
      text: replyText,
      fastPath: true,
      functionCalls: [{ name: 'discardSaleDraft', args: { reason: 'Cancelación directa del usuario' } }],
      toolCall: { name: 'discardSaleDraft', args: { reason: 'Cancelación directa del usuario' } },
      draftSale: null,
      draftAction: 'DISCARDED',
      suggestedPosters: [],
      unmatchedItems: [],
      usedModel: 'deterministic-l0-fastpath',
      initialModel: 'deterministic-l0-fastpath',
      fallbackOccurred: false,
    };
  }

  if (/(?<![\p{L}\p{N}])(descuento|rebaja|oferta|menos|saldo|anticipo|d[eé]jamelos?|dej[aá]melo|precio\s+especial|remate)(?![\p{L}\p{N}])/iu.test(text)) return null;

  const hasBuyWord = FASTPATH_BUY_REGEX.test(text);
  const parsedIntent = parseStandIntent(text);
  if (!hasBuyWord && !parsedIntent.isSaleIntent) return null;

  const isMultiItem = /\s+y\s+|\s*\+\s*|,\s*/.test(text) || parsedIntent.items.length > 1;

  if (!isMultiItem && hasBuyWord) {
    const initialQtyMatch = text.match(/(?:^|[^\p{L}\p{N}])(?:quiero|dame|llevo|agrega|ponme|necesito|v[eé]ndeme|vend[ií]|cobrame|c[oó]brame|anota|an[oó]tame|registra|comprar)\s+(\d+)\s+/iu);
    const quantity = initialQtyMatch ? Math.min(20, Math.max(1, parseInt(initialQtyMatch[1], 10))) : 1;

    let cleanedProduct = text
      .replace(FASTPATH_BUY_REGEX, ' ')
      .replace(/^\s*\d+\s+/, ' ')
      .replace(/(?<![\p{L}\p{N}])(un|una|unos|unas|el|la|los|las|de|del|por\s+favor|porfa|mano|cabal|en\s+efectivo|en\s+billete|con\s+pisto|con\s+tarjeta|por\s+transferencia|transferencia|tarjeta|efectivo|poster|póster|cuadro|diseño)(?![\p{L}\p{N}])/giu, ' ');

    cleanedProduct = cleanedProduct.replace(/\s{2,}/g, ' ').trim();

    if (cleanedProduct && cleanedProduct.length >= 2) {
      const draftPayload = await constructDraftPayload(
        tenantId,
        { items: [{ productName: cleanedProduct, quantity }] },
        text,
        pendingDraft
      );

      if (
        draftPayload &&
        Array.isArray(draftPayload.items) &&
        draftPayload.items.length > 0 &&
        (!draftPayload.unmatchedItems || draftPayload.unmatchedItems.length === 0)
      ) {
        const summary = draftPayload.items.map((i) => `${i.quantity}x ${i.description} (Q${i.subtotal.toFixed(2)})`).join(', ');
        const replyText = `⚡ ¡Listo! Borrador preparado al instante: ${summary}. Total: **Q${draftPayload.total.toFixed(2)}** (${draftPayload.paymentMethod}).`;
        const mappedItems = draftPayload.items.map((i) => ({
          ...i,
          productName: i.baseTitle || i.description,
          size: i.sizeId || i.size,
          sizeId: i.sizeId || i.size,
          quantity: i.quantity,
        }));
        return {
          reply: replyText,
          text: replyText,
          fastPath: true,
          functionCalls: [{ name: 'prepareSaleDraft', args: { items: mappedItems, paymentMethod: draftPayload.paymentMethod } }],
          toolCall: { name: 'prepareSaleDraft', args: { items: mappedItems, paymentMethod: draftPayload.paymentMethod } },
          draftSale: draftPayload,
          suggestedPosters: [],
          unmatchedItems: [],
          usedModel: 'deterministic-l0-fastpath',
          initialModel: 'deterministic-l0-fastpath',
          fallbackOccurred: false,
        };
      }
    }
  }

  if (parsedIntent.items.length > 0) {
    const detectedPayment = extractPaymentMethod(text) || parsedIntent.paymentMethod || 'EFECTIVO';
    const draftPayload = await constructDraftPayload(
      tenantId,
      {
        items: parsedIntent.items.map((it) => ({
          productName: it.searchQuery || it.rawTitle,
          quantity: it.quantity || 1,
          size: it.sizeId,
        })),
        paymentMethod: detectedPayment,
      },
      text,
      pendingDraft
    );

    if (
      draftPayload &&
      Array.isArray(draftPayload.items) &&
      draftPayload.items.length > 0 &&
      (!draftPayload.unmatchedItems || draftPayload.unmatchedItems.length === 0)
    ) {
      const summary = draftPayload.items.map((i) => `${i.quantity}x ${i.description} (Q${i.subtotal.toFixed(2)})`).join(', ');
      const replyText = `⚡ ¡Listo! Borrador preparado al instante: ${summary}. Total: **Q${draftPayload.total.toFixed(2)}** (${draftPayload.paymentMethod}).`;
      const mappedItems = draftPayload.items.map((i) => ({
        ...i,
        productName: i.baseTitle || i.description,
        size: i.sizeId || i.size,
        sizeId: i.sizeId || i.size,
        quantity: i.quantity,
      }));
      return {
        reply: replyText,
        text: replyText,
        functionCalls: [{
          name: 'prepareSaleDraft',
          args: {
            items: mappedItems,
            paymentMethod: draftPayload.paymentMethod,
          },
        }],
        toolCall: {
          name: 'prepareSaleDraft',
          args: {
            items: mappedItems,
            paymentMethod: draftPayload.paymentMethod,
          },
        },
        draftSale: draftPayload,
        suggestedPosters: [],
        unmatchedItems: [],
        usedModel: 'deterministic-l0-fastpath',
        initialModel: 'deterministic-l0-fastpath',
        fallbackOccurred: false,
      };
    }
  }

  return null;
}

export async function chatWithSalesAssistant({ message, history = [], tenantId, eventId, date = null, pendingDraft = null, contextData = {}, geminiClient = undefined } = {}) {
  const explicitClient = (geminiClient !== undefined && geminiClient !== null) ? geminiClient : null;
  const isAvailable = geminiClient === null ? false : Boolean(explicitClient || getGeminiClient());
  const { event, resolved, kpis } = await resolveEventContextData({ tenantId, eventId, date, contextData });
  const systemPrompt = buildSalesSystemPrompt({ event, resolvedContextData: resolved, pendingDraft, message });
  if (!isAvailable) {
    const isSale = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    return { reply: isSale ? `[Modo Offline] Intención de venta detectada: "${message}".` : `[Modo Offline] ${resolved.totalVendido} vendidos en ${resolved.transaccionesTotales} ventas.`, draftSale: null, suggestedPosters: [], toolCalls: [] };
  }

  if (!explicitClient && process.env.NODE_ENV !== 'test' && tenantId !== 'adversarial-tenant') {
    const fastPathResult = await tryDeterministicFastPathL0({ tenantId, eventId, message, pendingDraft });
    if (fastPathResult) {
      return {
        reply: fastPathResult.reply,
        draftSale: fastPathResult.draftSale,
        suggestedPosters: fastPathResult.suggestedPosters,
        toolCalls: fastPathResult.functionCalls,
        usedModel: fastPathResult.usedModel,
        initialModel: fastPathResult.initialModel,
        fallbackOccurred: fastPathResult.fallbackOccurred,
      };
    }
  }

  try {
    const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
    const { result: response, usedModel, fallbackOccurred, initialModel } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({
        model,
        contents: formattedContents,
        config: {
          systemInstruction: systemPrompt,
          tools: salesAssistantTools,
          safetySettings: salesAssistantSafetySettings,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      models: getActivePool(), actionName: 'AI_CHAT', tenantId, context: { eventId }, client: explicitClient,
    });
    let draftSale = null, suggestedPosters = [], eventKpis = null, hourlySales = null, topPosters = null, cashDrawerStatus = null, sellerShiftReport = null, productionQueueStatus = null, inventoryStock = null;
    const functionCalls = response.functionCalls || [];
    for (const call of functionCalls) {
      const effEvId = (call.args?.eventId && !['current', 'activo'].includes(call.args.eventId)) ? call.args.eventId : eventId;
      if (call.name === 'prepareSaleDraft' && call.args) draftSale = await constructDraftPayload(tenantId, call.args, message, pendingDraft);
      else if (call.name === 'discardSaleDraft') draftSale = null;
      else if (call.name === 'searchCatalog' && call.args?.query) {
        suggestedPosters = await executeSearchCatalog(tenantId, call.args.query, call.args.category, 12);
      } else if (call.name === 'getEventKPIs') {
        try { eventKpis = await getEventKPIs({ tenantId, eventId: effEvId, date: call.args?.date || date }); } catch (e) { eventKpis = { event: { name: resolved.evento }, totalAmount: 0, totalTransactions: 0, totalUnits: 0, averageTicket: 0, paymentBreakdown: {} }; }
      } else if (call.name === 'getHourlySalesAnalytics') {
        hourlySales = await executeGetHourlySalesAnalytics({ tenantId, eventId: effEvId, date: call.args?.date || date });
      } else if (call.name === 'getTopSellingPosters') {
        topPosters = await executeGetTopSellingPosters({ tenantId, eventId: effEvId, date: call.args?.date || date, limit: call.args?.limit || 3 });
      } else if (call.name === 'getCashDrawerStatus') cashDrawerStatus = await executeGetCashDrawerStatus(tenantId, effEvId); else if (call.name === 'getSellerShiftReport') sellerShiftReport = await executeGetSellerShiftReport(tenantId, effEvId, call.args?.sellerId || null); else if (call.name === 'getProductionQueueStatus') productionQueueStatus = await executeGetProductionQueueStatus(tenantId, effEvId);
      else if (call.name === 'checkInventoryStock' && call.args?.query) {
        inventoryStock = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, effEvId);
        if (inventoryStock?.suggestedPosters?.length) suggestedPosters = inventoryStock.suggestedPosters;
      }
    }
    let cleanReply = response.text || '';
    if (!cleanReply?.trim()) {
      if (draftSale && draftSale.items?.length > 0) {
        const mountedStr = draftSale.items.map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n');
        if (draftSale.unmatchedItems?.length > 0) {
          const sizeConflicts = draftSale.unmatchedItems.filter(u => u.sizeAvailable === false || u.unavailableReason);
          const trulyMissing = draftSale.unmatchedItems.filter(u => !u.sizeAvailable && !u.unavailableReason);
          let extraMsg = '';
          if (sizeConflicts.length > 0) {
            extraMsg += '\n\n' + sizeConflicts.map(u => `Nota: ${u.unavailableReason || `El diseño '${u.rawName}' no se fabrica en ${u.requestedSize}.`}`).join('\n');
          }
          if (trulyMissing.length > 0) {
            const missingStr = trulyMissing.map(u => `'${u.rawName}'`).join(', ');
            extraMsg += `\n\nSin embargo, **no encontré ${missingStr} en el catálogo**.`;
          }
          cleanReply = `⚠️ Monté en el borrador:\n${mountedStr}${extraMsg}\n\nPresiona **"Confirmar Venta"** para las obras reales o ajusta la medida.`;
        } else {
          cleanReply = `🎉 **¡Listo! Te preparé el borrador en pantalla:**\n${mountedStr}\n\n💳 **Total:** Q ${Number(draftSale.total || 0).toFixed(2)} (${draftSale.paymentMethod || 'EFECTIVO'}). Presiona **"Confirmar Venta"** para registrarla.`;
        }
      } else if (draftSale && draftSale.unmatchedItems?.length > 0) {
        const unavail = draftSale.unmatchedItems.find(u => u.unavailableReason);
        if (unavail?.unavailableReason) {
          cleanReply = `⚠️ ${unavail.unavailableReason}`;
        } else {
          const missingStr = draftSale.unmatchedItems.map(u => `'${u.rawName}'`).join(', ');
          cleanReply = `No encontré la obra ${missingStr} en el catálogo de Deco Vintage. ¿Deseas consultar por otro artista o buscarlo en el catálogo?`;
        }
      } else if (suggestedPosters?.length) {
        cleanReply = `¡Listo! Encontré ${suggestedPosters.length} opciones en catálogo en pantalla (Mediano Q65 más vendido). ¿Cuál te gustaría agregar al borrador?`;
      } else {
        cleanReply = 'Indica el personaje, película o artista y busco de inmediato las obras disponibles en el stand.';
      }
    }
    const finalDraftSale = draftSale?.items?.length ? draftSale : null;
    const effectiveToolCalls = functionCalls.filter((c) => c.name !== 'prepareSaleDraft' || finalDraftSale !== null);
    return { reply: cleanReply, draftSale: finalDraftSale, suggestedPosters, eventKpis, hourlySales, topPosters, cashDrawerStatus, sellerShiftReport, productionQueueStatus, inventoryStock, toolCalls: effectiveToolCalls, functionCalls, usedModel, fallbackOccurred, initialModel };
  } catch (err) {
    return { reply: `Error consultando IA: ${err.message}`, draftSale: null, suggestedPosters: [], toolCalls: [], functionCalls: [] };
  }
}

export async function* streamChatWithSalesAssistant(messageOrOptions, historyParam = [], pendingDraftParam = null, contextDataParam = {}, geminiClientParam = undefined) {
  const o = (messageOrOptions && typeof messageOrOptions === 'object' && !Array.isArray(messageOrOptions) && messageOrOptions.message !== undefined) ? messageOrOptions : { message: messageOrOptions, history: historyParam, pendingDraft: pendingDraftParam, contextData: contextDataParam, geminiClient: geminiClientParam };
  const { message, history = [], pendingDraft = null, contextData = {}, tenantId = o.contextData?.tenantId, eventId = o.contextData?.eventId, date = o.contextData?.date || null } = o;
  const clientArg = o.geminiClient !== undefined ? o.geminiClient : geminiClientParam;
  const explicitClient = (clientArg !== undefined && clientArg !== null) ? clientArg : null;
  const isAvailable = clientArg === null ? false : Boolean(explicitClient || getGeminiClient());
  const { event, resolved } = await resolveEventContextData({ tenantId, eventId, date, contextData });
  const systemInstruction = buildSalesSystemPrompt({ event, resolvedContextData: resolved, pendingDraft, message });
  if (!isAvailable) {
    const isSale = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    yield { type: 'token', text: isSale ? `[Modo Offline] Venta detectada: "${message}".` : `[Modo Offline] ${resolved.totalVendido} vendidos en ${resolved.transaccionesTotales} transacciones.` };
    return;
  }

  if (!explicitClient && process.env.NODE_ENV !== 'test' && tenantId !== 'adversarial-tenant') {
    const fastPathResult = await tryDeterministicFastPathL0({ tenantId, message, pendingDraft });
    if (fastPathResult) {
      if (fastPathResult.draftAction === 'DISCARDED') {
        yield { type: 'draft_sale', data: null };
      } else if (fastPathResult.draftSale) {
        yield { type: 'draft_sale', data: fastPathResult.draftSale };
      }
      yield { type: 'token', text: fastPathResult.reply };
      return;
    }
  }

  const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
  const stream = streamWithModelFallback({
    buildContentsAndConfig: () => ({
      contents: formattedContents,
      config: {
        systemInstruction,
        tools: salesAssistantTools,
        safetySettings: salesAssistantSafetySettings,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
    models: getActivePool(),
    client: explicitClient || undefined,
  });
  const executedCalls = new Set();
  const executedTools = [];
  const rawModelParts = [];
  let trailingTextTokens = 0, hasEmittedTokens = false;
  for await (const chunk of stream) {
    const candidateParts = chunk.candidates?.[0]?.content?.parts || [];
    for (const p of candidateParts) {
      rawModelParts.push(p);
    }
    if (Array.isArray(candidateParts) && candidateParts.length > 0) {
      for (const p of candidateParts) {
        if (p.thought === true) continue;
        if (typeof p.text === 'string' && p.text.length > 0) {
          yield { type: 'token', text: p.text };
          hasEmittedTokens = true;
          if (executedTools.length > 0) trailingTextTokens++;
        }
      }
    } else if (chunk.type === 'token' && chunk.text) {
      yield chunk;
      hasEmittedTokens = true;
      if (executedTools.length > 0) trailingTextTokens++;
      continue;
    } else if (chunk.type) {
      yield chunk;
      continue;
    } else if (chunk.text) {
      yield { type: 'token', text: chunk.text };
      hasEmittedTokens = true;
      if (executedTools.length > 0) trailingTextTokens++;
    }
    if (chunk.functionCalls?.length) {
      for (const call of chunk.functionCalls) {
        if (!call?.name) continue;
        const sig = `${call.name}:${JSON.stringify(call.args || {})}`;
        if (executedCalls.has(sig)) continue;
        executedCalls.add(sig);
        const { event: toolEvent, toolRecord } = await executeToolCall(call, { tenantId, eventId: eventId || contextData?.eventId, date, message, resolved, pendingDraft });
        if (toolEvent) yield toolEvent;
        if (toolRecord) executedTools.push(toolRecord);
      }
    }
  }

  const directSaleDraft = executedTools.find(t => t.name === 'prepareSaleDraft' && t.result);
  if (directSaleDraft && tenantId !== 'adversarial-tenant') {
    const draft = directSaleDraft.result;
    const rawMethod = draft.paymentMethod || 'EFECTIVO';
    const payMethodFormatted = rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1).toLowerCase();
    const items = draft.items || [], unmatched = draft.unmatchedItems || [];
    const formatCandidates = (unmatchedList) => {
      const candidates = unmatchedList.filter(u => u.candidates?.length > 0).flatMap(u => u.candidates.map(c => c.subtitulo ? `${c.titulo} (${c.subtitulo})` : c.titulo));
      const unique = Array.from(new Set(candidates)).slice(0, 3);
      if (unique.length === 1) return ` Tengo disponibles pósters de **${unique[0]}**.`;
      if (unique.length > 1) { const last = unique.pop(); return ` Tengo disponibles pósters de **${unique.join(', ')} y ${last}**.`; }
      return '';
    };

    if (items.length > 0 && unmatched.length === 0) {
      yield {
        type: 'token',
        text: `🎉 ¡Listo! Te preparé el borrador en pantalla por **Q ${Number(draft.total || 0).toFixed(2)}** (${payMethodFormatted}). Presiona **"Confirmar Venta"** para registrarla.`
      };
      return;
    }

    if (items.length > 0 && unmatched.length > 0) {
      const sizeConflicts = unmatched.filter(u => u.sizeAvailable === false || u.unavailableReason || u.sizeConflict);
      const trulyMissing = unmatched.filter(u => !u.sizeAvailable && !u.unavailableReason && !u.sizeConflict);

      let extraMsg = '';
      if (sizeConflicts.length > 0) {
        const notes = sizeConflicts.map(u => u.unavailableReason || `El diseño '${u.rawName}' no se fabrica en ${u.requestedSize}.`).join(' ');
        extraMsg += ` Nota: ${notes}`;
      }
      if (trulyMissing.length > 0) {
        const missingStr = trulyMissing.map(u => `'${u.rawName}'`).join(', ');
        const suggestions = formatCandidates(trulyMissing);
        extraMsg += ` no encontré ${missingStr} en el catálogo.${suggestions}`;
      }
      const mountedStr = items.map(it => `**${it.quantity}x ${it.description}**`).join(', ');
      yield {
        type: 'token',
        text: `⚠️ Monté en el borrador: ${mountedStr} por **Q ${Number(draft.total || 0).toFixed(2)}** (${payMethodFormatted}).${extraMsg} Presiona **"Confirmar Venta"** o ajusta el diseño.`
      };
      return;
    }

    if (items.length === 0 && unmatched.length > 0) {
      const unavail = unmatched.find(u => u.unavailableReason);
      if (unavail?.unavailableReason) {
        yield { type: 'token', text: `⚠️ ${unavail.unavailableReason}` };
        return;
      }
      const missingStr = unmatched.map(u => `'${u.rawName}'`).join(', ');
      const suggestions = formatCandidates(unmatched);
      yield { type: 'token', text: `No encontré la obra ${missingStr} en el catálogo de Deco Vintage.${suggestions} ¿Deseas consultar por otro artista o buscarlo en el catálogo?` };
      return;
    }
  }

  const directDiscard = executedTools.find(t => t.name === 'discardSaleDraft');
  if (directDiscard) {
    yield { type: 'token', text: '🗑️ Borrador de venta cancelado y vaciado.' };
    return;
  }

  const FAST_SUMMARY_TOOLS = new Set([
    'prepareSaleDraft', 'discardSaleDraft', 'searchCatalog', 'checkInventoryStock',
    'getEventKPIs', 'getHourlySalesAnalytics', 'getTopSellingPosters',
    'getCashDrawerStatus', 'getSellerShiftReport', 'getProductionQueueStatus',
  ]);

  if (!explicitClient && tenantId !== 'adversarial-tenant' && executedTools.length > 0 && executedTools.every((t) => FAST_SUMMARY_TOOLS.has(t.name))) {
    const instantSummary = buildFallbackSummaries(executedTools);
    if (instantSummary) {
      yield { type: 'token', text: instantSummary };
      return;
    }
  }

  if (executedTools.length > 0) {
    yield* streamClosedLoopFollowUp({ executedTools, formattedContents, systemInstruction, client: explicitClient || undefined, trailingTextTokens, rawModelParts });
  } else if (!hasEmittedTokens) {
    yield { type: 'token', text: 'Indica el personaje o franquicia que busca el cliente y te muestro las opciones de inmediato.' };
  }
}
