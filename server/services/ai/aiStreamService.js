import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { getEventKPIs } from '../saleService.js';
import { searchWebPosters } from '../webCatalogService.js';
import { normalizeArtworkQuery, resolveEntityAlias } from '../semanticParserService.js';
import { executeWithModelFallback, streamWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { salesAssistantSafetySettings, buildSalesSystemPrompt } from './aiPromptService.js';
import { salesAssistantTools, constructDraftPayload, executeGetCashDrawerStatus, executeGetSellerShiftReport, executeGetProductionQueueStatus, executeCheckInventoryStock } from './aiToolsService.js';
import { getGeminiClient } from '../../config/gemini.js';

const getActivePool = () => Array.from(new Set([ENV.GEMINI_MODEL || 'gemini-2.5-flash', ...MODEL_PRIORITY_POOL]));

async function resolveEventContextData({ tenantId, eventId, date = null, contextData = {} }) {
  let event = null, kpis = null;
  if (eventId) {
    try { [event, kpis] = await Promise.all([prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, location: true, salesTarget: true } }), getEventKPIs({ tenantId, eventId, date })]); } catch (e) { /* DB fallback */ }
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
    },
  };
}

export async function chatWithSalesAssistant({ message, history = [], tenantId, eventId, date = null, pendingDraft = null, geminiClient = null }) {
  const gemini = geminiClient || getGeminiClient();
  const { event, resolved, kpis } = await resolveEventContextData({ tenantId, eventId, date });
  const systemPrompt = buildSalesSystemPrompt({ event, resolvedContextData: resolved, pendingDraft });
  if (!gemini) {
    const isSale = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    return { reply: isSale ? `[Modo Offline] Intención de venta detectada: "${message}".` : `[Modo Offline] ${resolved.totalVendido} vendidos en ${resolved.transaccionesTotales} ventas.`, draftSale: null, suggestedPosters: [], toolCalls: [] };
  }
  try {
    const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
    const { result: response, usedModel, fallbackOccurred, initialModel } = await executeWithModelFallback({
      taskFn: async ({ model, client }) => client.models.generateContent({ model, contents: formattedContents, config: { systemInstruction: systemPrompt, tools: salesAssistantTools, safetySettings: salesAssistantSafetySettings } }),
      models: getActivePool(), actionName: 'AI_CHAT', tenantId, context: { eventId }, client: gemini,
    });
    let draftSale = null, suggestedPosters = [], eventKpis = null, cashDrawerStatus = null, sellerShiftReport = null, productionQueueStatus = null, inventoryStock = null;
    const functionCalls = response.functionCalls || [];
    for (const call of functionCalls) {
      const effEvId = (call.args?.eventId && !['current', 'activo'].includes(call.args.eventId)) ? call.args.eventId : eventId;
      if (call.name === 'prepareSaleDraft' && call.args) draftSale = await constructDraftPayload(tenantId, call.args, message);
      else if (call.name === 'searchCatalog' && call.args?.query) {
        let matches = await searchWebPosters({ tenantId, query: normalizeArtworkQuery(call.args.query), category: call.args.category, limit: 12 });
        if (!matches?.length) {
          const alias = resolveEntityAlias(call.args.query);
          if (alias.matched) matches = [{ id: `alias-${alias.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, sku: `DV-${alias.canonicalTitle.substring(0, 4).toUpperCase()}`, titulo: alias.canonicalTitle, subtitulo: 'Catálogo Oficial Deco Vintage', categoria: alias.category || 'ARTE', imageUrl: null, thumbUrl: null, precioMinimo: alias.defaultSizeId === 'PORTADA_ALBUM' ? 55 : 65 }];
        }
        suggestedPosters = matches || [];
      } else if (call.name === 'getEventKPIs') {
        try { eventKpis = await getEventKPIs({ tenantId, eventId: effEvId, date: call.args?.date || date }); } catch (e) { eventKpis = { event: { name: resolved.evento }, totalAmount: 0, totalTransactions: 0, totalUnits: 0, averageTicket: 0, paymentBreakdown: {} }; }
      } else if (call.name === 'getCashDrawerStatus') cashDrawerStatus = await executeGetCashDrawerStatus(tenantId, effEvId); else if (call.name === 'getSellerShiftReport') sellerShiftReport = await executeGetSellerShiftReport(tenantId, effEvId, call.args?.sellerId || null); else if (call.name === 'getProductionQueueStatus') productionQueueStatus = await executeGetProductionQueueStatus(tenantId, effEvId);
      else if (call.name === 'checkInventoryStock' && call.args?.query) {
        inventoryStock = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, effEvId);
        if (inventoryStock?.suggestedPosters?.length) suggestedPosters = inventoryStock.suggestedPosters;
      }
    }
    let cleanReply = response.text || '';
    if (!cleanReply?.trim()) {
      if (draftSale) cleanReply = `🎉 **¡Listo! Te preparé el borrador en pantalla:**\n${(draftSale.items || []).map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n')}\n\n💳 **Total:** Q ${Number(draftSale.total || 0).toFixed(2)} (${draftSale.paymentMethod || 'EFECTIVO'}). Presiona **"Confirmar Venta"** para registrarla.`;
      else if (suggestedPosters?.length) cleanReply = `¡Buenísima elección! Aquí tienes las opciones encontradas en catálogo.\n\n🌟 **Recomendación:** Nuestro tamaño estrella y más vendido es el **Mediano (30x45 cm a Q65.00)** con tintas ecológicas HP Látex y montaje en 15s con cinta tesa® original. ¿Cuál te gusta más o te preparo el borrador de una vez?`;
      else cleanReply = '¡Con gusto te asesoro! Dime qué temática, franquicia o artista buscas y te muestro las mejores opciones de nuestro catálogo.';
    }
    return { reply: cleanReply, draftSale, suggestedPosters, eventKpis, cashDrawerStatus, sellerShiftReport, productionQueueStatus, inventoryStock, toolCalls: functionCalls, functionCalls, usedModel, fallbackOccurred, initialModel };
  } catch (err) {
    return { reply: `Error consultando IA: ${err.message}`, draftSale: null, suggestedPosters: [], toolCalls: [], functionCalls: [] };
  }
}

export async function* streamChatWithSalesAssistant(messageOrOptions, historyParam = [], pendingDraftParam = null, contextDataParam = {}, geminiClientParam = null) {
  const o = (messageOrOptions && typeof messageOrOptions === 'object' && !Array.isArray(messageOrOptions) && messageOrOptions.message !== undefined) ? messageOrOptions : { message: messageOrOptions, history: historyParam, pendingDraft: pendingDraftParam, contextData: contextDataParam, geminiClient: geminiClientParam };
  const { message, history = [], pendingDraft = null, contextData = {}, tenantId = o.contextData?.tenantId, eventId = o.contextData?.eventId, date = o.contextData?.date || null } = o;
  const gemini = o.geminiClient || geminiClientParam || getGeminiClient();

  const { event, resolved } = await resolveEventContextData({ tenantId, eventId, date, contextData });
  const systemInstruction = buildSalesSystemPrompt({ event, resolvedContextData: resolved, pendingDraft });
  if (!gemini) {
    const isSale = /vend[ií]|venta|cobro|compr[oó]|anota/i.test(message);
    yield { type: 'token', text: isSale ? `[Modo Offline] Venta detectada: "${message}".` : `[Modo Offline] ${resolved.totalVendido} vendidos en ${resolved.transaccionesTotales} transacciones.` };
    return;
  }
  const formattedContents = [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text || h.content || '' }] })), { role: 'user', parts: [{ text: message }] }];
  const stream = streamWithModelFallback({ buildContentsAndConfig: () => ({ contents: formattedContents, config: { systemInstruction, tools: salesAssistantTools, safetySettings: salesAssistantSafetySettings } }), models: getActivePool(), client: gemini });
  const executedCalls = new Set();
  let hasTextTokens = false;
  const toolSummaries = [];

  for await (const chunk of stream) {
    if (chunk.type) { yield chunk; if (chunk.type === 'token' && chunk.text) hasTextTokens = true; continue; }
    if (chunk.text) { hasTextTokens = true; yield { type: 'token', text: chunk.text }; }
    if (chunk.functionCalls?.length) {
      for (const call of chunk.functionCalls) {
        if (!call?.name) continue;
        const sig = `${call.name}:${JSON.stringify(call.args || {})}`;
        if (executedCalls.has(sig)) continue;
        executedCalls.add(sig);
        const effEvId = (call.args?.eventId && !['current', 'activo'].includes(call.args.eventId)) ? call.args.eventId : (eventId || contextData?.eventId);
        try {
          if (call.name === 'prepareSaleDraft' && call.args) {
            const draft = await constructDraftPayload(tenantId, call.args, message);
            yield { type: 'draft_sale', data: draft };
            const itemsList = (draft.items || []).map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n');
            toolSummaries.push(`🎉 **¡Listo! Te preparé el borrador en pantalla:**\n${itemsList}\n\n💳 **Total:** Q ${Number(draft.total || 0).toFixed(2)} (${draft.paymentMethod || 'EFECTIVO'}). Presiona **"Confirmar Venta"** para registrarla.`);
          } else if (call.name === 'searchCatalog' && call.args?.query) {
            let matches = await searchWebPosters({ tenantId, query: normalizeArtworkQuery(call.args.query), category: call.args.category, limit: 12 });
            if (!matches?.length) {
              const alias = resolveEntityAlias(call.args.query);
              if (alias.matched) matches = [{ id: `alias-${alias.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, sku: `DV-${alias.canonicalTitle.substring(0, 4).toUpperCase()}`, titulo: alias.canonicalTitle, subtitulo: 'Catálogo Oficial Deco Vintage', categoria: alias.category || 'ARTE', imageUrl: null, thumbUrl: null, precioMinimo: alias.defaultSizeId === 'PORTADA_ALBUM' ? 55 : 65 }];
            }
            yield { type: 'suggested_posters', data: matches || [] };
            toolSummaries.push(matches?.length > 0 ? `¡Buenísima elección! Aquí tienes las opciones de **${call.args.query}** en catálogo.\n\n🌟 **Recomendación:** Nuestro tamaño estrella es el **Mediano (30x45 cm a Q65.00)** con tintas HP Látex y cinta tesa®. ¿Cuál te gusta o te preparo el borrador de una vez?` : `No encontré esa obra exacta en mostrador, pero **¡podemos imprimir cualquier diseño bajo demanda en nuestro taller en ~12 minutos!** 🚀\n\n¿Te gustaría que te prepare un pedido personalizado en tamaño **Mediano (30x45 cm a Q65.00)**?`);
          } else if (call.name === 'getEventKPIs') {
            let k = null;
            try { k = await getEventKPIs({ tenantId, eventId: effEvId, date: call.args?.date || date }); } catch (e) { k = { event: { name: resolved.evento }, totalAmount: 0, totalTransactions: 0, totalUnits: 0, averageTicket: 0, paymentBreakdown: {} }; }
            if (k) { yield { type: 'event_kpis', data: k }; toolSummaries.push(`📊 **Ventas en tiempo real:** Q ${k.totalAmount?.toFixed(2) || '0.00'} (${k.totalTransactions || 0} ventas).`); }
          } else if (call.name === 'getCashDrawerStatus') { const s = await executeGetCashDrawerStatus(tenantId, effEvId); yield { type: 'cash_drawer_status', data: s }; if (s?.summaryText) toolSummaries.push(s.summaryText); }
          else if (call.name === 'getSellerShiftReport') { const r = await executeGetSellerShiftReport(tenantId, effEvId, call.args?.sellerId || null); yield { type: 'seller_shift_report', data: r }; if (r?.summaryText) toolSummaries.push(r.summaryText); }
          else if (call.name === 'getProductionQueueStatus') { const q = await executeGetProductionQueueStatus(tenantId, effEvId); yield { type: 'production_queue_status', data: q }; if (q?.summary) toolSummaries.push(q.summary); }
          else if (call.name === 'checkInventoryStock' && call.args?.query) {
            const st = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, effEvId); yield { type: 'inventory_stock', data: st };
            if (st?.suggestedPosters?.length) yield { type: 'suggested_posters', data: st.suggestedPosters };
            if (st?.summary) toolSummaries.push(st.summary);
          }
        } catch (toolErr) {
          console.warn(`[aiStreamService] ⚠️ Error ejecutando herramienta ${call.name}:`, toolErr.message);
          toolSummaries.push(`⚠️ No se pudo completar la acción "${call.name}".`);
        }
      }
    }
  }
  if (!hasTextTokens) {
    const defText = '¡Con gusto te asesoro! Dime qué póster, personaje o artista buscas y te muestro las mejores opciones de nuestro catálogo.';
    for (const sum of (toolSummaries.length ? toolSummaries : [defText])) yield { type: 'token', text: sum.trim() };
  }
}
