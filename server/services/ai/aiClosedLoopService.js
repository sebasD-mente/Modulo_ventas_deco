import { ENV } from '../../config/env.js';
import { getEventKPIs } from '../saleService.js';
import { streamWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { salesAssistantSafetySettings } from './aiPromptService.js';
import { salesAssistantTools, constructDraftPayload, executeSearchCatalog, executeGetCashDrawerStatus, executeGetSellerShiftReport, executeGetProductionQueueStatus, executeCheckInventoryStock } from './aiToolsService.js';

const getActivePool = () => Array.from(new Set([ENV.GEMINI_MODEL || 'gemini-3.8-flash', ...MODEL_PRIORITY_POOL]));

export function buildFallbackSummaries(executedTools) {
  const summaries = [];
  for (const t of executedTools) {
    if (t.name === 'prepareSaleDraft' && t.result) {
      const d = t.result, items = (d.items || []).map(it => `• **${it.quantity}x ${it.description}** (${it.sizeId || 'MEDIANO'}) — Q${Number(it.unitPrice).toFixed(2)} c/u`).join('\n');
      summaries.push(`🎉 **¡Listo! Te preparé el borrador en pantalla:**\n${items}\n\n💳 **Total:** Q ${Number(d.total || 0).toFixed(2)} (${d.paymentMethod || 'EFECTIVO'}). Presiona **"Confirmar Venta"** para registrarla.`);
    } else if (t.name === 'searchCatalog') {
      const count = t.result?.matchesCount || (Array.isArray(t.result) ? t.result.length : 0);
      summaries.push(count > 0 ? `¡Listo! Mostrando ${count} opciones en pantalla (Mediano Q65 más vendido). ¿Cuál anotamos al borrador?` : 'No encontré obras con ese criterio en el catálogo activo.');
    } else if (t.name === 'checkInventoryStock' && t.result?.summary) {
      summaries.push(t.result.summary);
    } else if (t.name === 'getCashDrawerStatus' && t.result?.summaryText) {
      summaries.push(t.result.summaryText);
    } else if (t.name === 'getSellerShiftReport' && t.result?.summaryText) {
      summaries.push(t.result.summaryText);
    } else if (t.name === 'getProductionQueueStatus' && t.result?.summary) {
      summaries.push(t.result.summary);
    } else if (t.name === 'getEventKPIs' && t.result) {
      summaries.push(`📊 **Ventas en tiempo real:** Q ${t.result.totalAmount?.toFixed(2) || '0.00'} (${t.result.totalTransactions || 0} ventas).`);
    }
  }
  return summaries.length > 0 ? summaries : ['Listo para registrar ventas o consultar catálogo en el stand.'];
}

export async function executeToolCall(call, { tenantId, eventId, date, message, resolved }) {
  const effEvId = (call.args?.eventId && !['current', 'activo'].includes(call.args.eventId)) ? call.args.eventId : eventId;
  const id = call.id || null;
  try {
    if (call.name === 'prepareSaleDraft' && call.args) {
      const draft = await constructDraftPayload(tenantId, call.args, message);
      return { event: { type: 'draft_sale', data: draft }, toolRecord: { name: call.name, args: call.args, result: draft, id } };
    }
    if (call.name === 'searchCatalog' && call.args?.query) {
      const matches = await executeSearchCatalog(tenantId, call.args.query, call.args.category, 12);
      return { event: { type: 'suggested_posters', data: matches || [] }, toolRecord: { name: call.name, args: call.args, result: { matchesCount: matches?.length || 0, posters: (matches || []).slice(0, 6) }, id } };
    }
    if (call.name === 'getEventKPIs') {
      let k = null;
      try { k = await getEventKPIs({ tenantId, eventId: effEvId, date: call.args?.date || date }); } catch { k = { event: { name: resolved?.evento || 'Evento' }, totalAmount: 0, totalTransactions: 0, totalUnits: 0, averageTicket: 0, paymentBreakdown: {} }; }
      return { event: k ? { type: 'event_kpis', data: k } : null, toolRecord: { name: call.name, args: call.args, result: k, id } };
    }
    if (call.name === 'getCashDrawerStatus') {
      const s = await executeGetCashDrawerStatus(tenantId, effEvId);
      return { event: { type: 'cash_drawer_status', data: s }, toolRecord: { name: call.name, args: call.args, result: s, id } };
    }
    if (call.name === 'getSellerShiftReport') {
      const r = await executeGetSellerShiftReport(tenantId, effEvId, call.args?.sellerId || null);
      return { event: { type: 'seller_shift_report', data: r }, toolRecord: { name: call.name, args: call.args, result: r, id } };
    }
    if (call.name === 'getProductionQueueStatus') {
      const q = await executeGetProductionQueueStatus(tenantId, effEvId);
      return { event: { type: 'production_queue_status', data: q }, toolRecord: { name: call.name, args: call.args, result: q, id } };
    }
    if (call.name === 'checkInventoryStock' && call.args?.query) {
      const st = await executeCheckInventoryStock(tenantId, call.args.query, call.args.sizeId, effEvId);
      return { event: { type: 'inventory_stock', data: st }, toolRecord: { name: call.name, args: call.args, result: st, id } };
    }
  } catch (err) {
    console.warn(`[aiClosedLoopService] Error ejecutando ${call.name}:`, err.message);
  }
  return { event: null, toolRecord: null };
}

export async function* streamClosedLoopFollowUp({ executedTools, formattedContents, systemInstruction, client, trailingTextTokens = 0, rawModelParts = [] }) {
  if (executedTools.length === 0 || trailingTextTokens > 0) return;

  const modelParts = (rawModelParts && rawModelParts.length > 0) ? [...rawModelParts] : [];
  for (const t of executedTools) {
    const exists = modelParts.some(p => p.functionCall && (p.functionCall.name === t.name || (t.id && p.functionCall.id === t.id)));
    if (!exists) modelParts.push({ functionCall: { name: t.name, args: t.args || {}, ...(t.id ? { id: t.id } : {}) } });
  }

  const toolParts = executedTools.map(t => {
    const matching = modelParts.find(p => p.functionCall && (p.functionCall.name === t.name || (t.id && p.functionCall.id === t.id)))?.functionCall;
    const callId = t.id || matching?.id || null;
    const isPlainObj = typeof t.result === 'object' && t.result !== null && !Array.isArray(t.result);
    return {
      functionResponse: {
        name: t.name,
        response: isPlainObj ? t.result : { result: t.result },
        ...(callId ? { id: callId } : {})
      }
    };
  });
  const closedLoopContents = [...formattedContents, { role: 'model', parts: modelParts }, { role: 'user', parts: toolParts }];

  let followUpTokensCount = 0;
  let hadPoolError = false;
  try {
    const followUpStream = streamWithModelFallback({
      buildContentsAndConfig: () => ({ contents: closedLoopContents, config: { systemInstruction, tools: salesAssistantTools, safetySettings: salesAssistantSafetySettings } }),
      models: getActivePool(),
      client: (client !== null && client !== undefined) ? client : undefined,
    });
    for await (const chunk of followUpStream) {
      const text = chunk.text || '';
      const isBreak = text.includes('Respuesta finalizada');
      const isPoolCrash = text.includes('Conexión con IA intermitente') || text.includes('volumen alto');
      if (isPoolCrash) hadPoolError = true;
      if (chunk.type === 'token' && text) { yield chunk; if (!isBreak && !isPoolCrash) followUpTokensCount++; }
      else if (text) { yield { type: 'token', text }; if (!isBreak && !isPoolCrash) followUpTokensCount++; }
    }
  } catch (err) {
    console.warn('[aiClosedLoopService] ⚠️ Error en closed-loop follow-up:', err.message);
  }

  if (followUpTokensCount === 0 && !hadPoolError) {
    for (const text of buildFallbackSummaries(executedTools)) yield { type: 'token', text };
  }
}
