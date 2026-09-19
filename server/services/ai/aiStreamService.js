import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { getEventKPIs } from '../saleService.js';
import { executeWithModelFallback, streamWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { salesAssistantSafetySettings, buildSalesSystemPrompt } from './aiPromptService.js';
import { salesAssistantTools, constructDraftPayload, executeSearchCatalog, executeGetCashDrawerStatus, executeGetSellerShiftReport, executeGetProductionQueueStatus, executeCheckInventoryStock, executeGetHourlySalesAnalytics, executeGetTopSellingPosters } from './aiToolsService.js';
import { executeToolCall, streamClosedLoopFollowUp } from './aiClosedLoopService.js';
import { getGeminiClient } from '../../config/gemini.js';

const getActivePool = () => Array.from(new Set([ENV.GEMINI_MODEL || 'gemini-3.8-flash', ...MODEL_PRIORITY_POOL]));
async function resolveEventContextData({ tenantId, eventId, date = null, contextData = {} }) {
  let event = null, kpis = null, timerId = null;
  if (eventId) {
    try {
      const dbOp = Promise.all([
        prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, location: true, salesTarget: true } }),
        getEventKPIs({ tenantId, eventId, date }),
      ]);
      const timer = new Promise((_, reject) => { timerId = setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500); });
      [event, kpis] = await Promise.race([dbOp, timer]);
    } catch (e) { /* DB fallback */ } finally { if (timerId) clearTimeout(timerId); }
  }
  return {
    event, kpis,
    resolved: {
      evento: event?.name || contextData?.evento || 'el evento', ubicacion: event?.location || contextData?.ubicacion || 'Mostrador Stand',
      metaVentas: event?.salesTarget ? `Q ${event.salesTarget}` : (contextData?.metaVentas || 'Sin meta definida'),
      totalVendido: kpis ? `Q ${kpis.totalAmount.toFixed(2)}` : (contextData?.totalVendido || 'Q 0.00'),
      transaccionesTotales: kpis ? kpis.totalTransactions : (contextData?.transaccionesTotales || 0),
      unidadesVendidas: kpis ? kpis.totalUnits : (contextData?.unidadesVendidas || 0),
      ticketPromedio: kpis ? `Q ${kpis.averageTicket.toFixed(2)}` : (contextData?.ticketPromedio || 'Q 0.00'),
      desgloseMetodosPago: kpis ? { efectivo: `Q ${kpis.paymentBreakdown.EFECTIVO.amount.toFixed(2)}`, tarjeta: `Q ${kpis.paymentBreakdown.TARJETA.amount.toFixed(2)}`, transferencia: `Q ${kpis.paymentBreakdown.TRANSFERENCIA.amount.toFixed(2)}` } : (contextData?.desgloseMetodosPago || {}),
      topProductos: kpis ? kpis.topProducts : (contextData?.topProductos || []),
      ultimasVentas: kpis ? kpis.recentSales?.map(s => ({ numero: s.saleNumber, total: `Q ${s.totalAmount}`, vendedor: s.seller?.fullName, hora: s.createdAt, items: s.items?.map(i => `${i.quantity}x ${i.description}`).join(', '), pagos: s.payments?.map(p => `${p.method}: Q${p.amount}`).join(', ') })) || [] : (contextData?.ultimasVentas || []),
      vendedorNombre: contextData?.sellerName || contextData?.vendedorNombre || 'Vendedor',
    },
  };
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
  try {
    const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
    const { result: response, usedModel, fallbackOccurred, initialModel } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({ model, contents: formattedContents, config: { systemInstruction: systemPrompt, tools: salesAssistantTools, safetySettings: salesAssistantSafetySettings } }),
      models: getActivePool(), actionName: 'AI_CHAT', tenantId, context: { eventId }, client: explicitClient,
    });
    let draftSale = null, suggestedPosters = [], eventKpis = null, hourlySales = null, topPosters = null, cashDrawerStatus = null, sellerShiftReport = null, productionQueueStatus = null, inventoryStock = null;
    const functionCalls = response.functionCalls || [];
    for (const call of functionCalls) {
      const effEvId = (call.args?.eventId && !['current', 'activo'].includes(call.args.eventId)) ? call.args.eventId : eventId;
      if (call.name === 'prepareSaleDraft' && call.args) draftSale = await constructDraftPayload(tenantId, call.args, message);
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
        if (draftSale.unmatchedItems?.length > 0) {
          const mountedStr = draftSale.items.map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n');
          const missingStr = draftSale.unmatchedItems.map(u => `'${u.rawName}'`).join(', ');
          cleanReply = `⚠️ Monté en el borrador:\n${mountedStr}\n\nSin embargo, **no encontré ${missingStr} en el catálogo**. Presiona **"Confirmar Venta"** para las obras reales o busca el diseño en el catálogo.`;
        } else {
          cleanReply = `🎉 **¡Listo! Te preparé el borrador en pantalla:**\n${(draftSale.items || []).map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n')}\n\n💳 **Total:** Q ${Number(draftSale.total || 0).toFixed(2)} (${draftSale.paymentMethod || 'EFECTIVO'}). Presiona **"Confirmar Venta"** para registrarla.`;
        }
      } else if (draftSale && draftSale.unmatchedItems?.length > 0) {
        const missingStr = draftSale.unmatchedItems.map(u => `'${u.rawName}'`).join(', ');
        cleanReply = `No encontré la obra ${missingStr} en el catálogo de Deco Vintage. ¿Deseas consultar por otro artista o buscarlo en el catálogo?`;
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
  const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
  const stream = streamWithModelFallback({ buildContentsAndConfig: () => ({ contents: formattedContents, config: { systemInstruction, tools: salesAssistantTools, safetySettings: salesAssistantSafetySettings } }), models: getActivePool(), client: explicitClient || undefined });
  const executedCalls = new Set();
  const executedTools = [];
  const rawModelParts = [];
  let trailingTextTokens = 0, hasEmittedTokens = false;
  for await (const chunk of stream) {
    const candidateParts = chunk.candidates?.[0]?.content?.parts || [];
    for (const p of candidateParts) {
      rawModelParts.push(p);
    }
    if (chunk.type === 'token' && chunk.text) {
      yield chunk;
      hasEmittedTokens = true;
      if (executedTools.length > 0) trailingTextTokens++;
      continue;
    }
    if (chunk.type) { yield chunk; continue; }
    if (chunk.text) {
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
        const { event: toolEvent, toolRecord } = await executeToolCall(call, { tenantId, eventId: eventId || contextData?.eventId, date, message, resolved });
        if (toolEvent) yield toolEvent;
        if (toolRecord) executedTools.push(toolRecord);
      }
    }
  }

  const directSaleDraft = executedTools.find(t => t.name === 'prepareSaleDraft' && t.result);
  if (directSaleDraft) {
    const draft = directSaleDraft.result, sellerName = (contextData?.sellerName || 'vendedor').trim().split(' ')[0];
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

    if (items.length > 0 && unmatched.length > 0) {
      const mountedStr = items.map(it => `**${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'} - Q${Number(it.unitPrice).toFixed(2)} en ${payMethodFormatted})`).join(', ');
      const missingStr = unmatched.map(u => `'${u.rawName}'`).join(', ');
      const suggestions = formatCandidates(unmatched);
      yield { type: 'token', text: `⚠️ Monté en el borrador: ${mountedStr}. Sin embargo, **no encontré ${missingStr} en el catálogo**.${suggestions} ¿Deseas que agregue alguno de esos o buscas otro diseño?` };
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

  if (executedTools.length > 0) {
    yield* streamClosedLoopFollowUp({ executedTools, formattedContents, systemInstruction, client: explicitClient || undefined, trailingTextTokens, rawModelParts });
  } else if (!hasEmittedTokens) {
    yield { type: 'token', text: 'Indica el personaje o franquicia que busca el cliente y te muestro las opciones de inmediato.' };
  }
}
