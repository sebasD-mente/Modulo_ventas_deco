import { randomUUID } from 'node:crypto';
import { chatWithSalesAssistant, streamChatWithSalesAssistant, constructDraftPayload } from '../../services/aiMultimodalService.js';
import { getOrCreateSession, saveSessionState, clearSessionDraft, getSessionState } from '../../services/ai/aiSessionService.js';
import { searchWebPosters } from '../../services/webCatalogService.js';
import { recordLlmInteraction } from '../../services/llmObservabilityService.js';
import { normalizeArtworkQuery } from '../../services/semanticParserService.js';
import { ENV } from '../../config/env.js';

export async function handleChatQuery(req, res) {
  try {
    const { message, history, eventId, date, pendingDraft } = req.body || {};
    const tenantId = req.tenantId;

    if (!message || !message.trim()) return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const sessionId = req.body?.sessionId?.trim() || req.headers?.['x-session-id']?.trim() || randomUUID();
    const sellerName = req.body?.sellerName || req.user?.fullName || 'Vendedor';
    let effectivePendingDraft = pendingDraft || null, effectiveHistory = Array.isArray(history) ? history : [];

    try {
      const activeSession = await getOrCreateSession(sessionId, { tenantId, eventId, sellerName });
      if (activeSession) {
        const isIncomingDraftEmpty = !effectivePendingDraft || (!Array.isArray(effectivePendingDraft.items) || effectivePendingDraft.items.length === 0);
        if (isIncomingDraftEmpty && activeSession.pendingDraft?.items?.length) effectivePendingDraft = activeSession.pendingDraft;
        if (effectiveHistory.length === 0 && activeSession.messagesHistory) {
          const stored = Array.isArray(activeSession.messagesHistory) ? activeSession.messagesHistory : JSON.parse(activeSession.messagesHistory || '[]');
          if (stored.length > 0) effectiveHistory = stored;
        }
      }
    } catch (sessErr) {
      console.warn(`[aiChatController] Sesión ${sessionId}:`, sessErr.message);
    }

    const isStream = req.body?.stream === true || req.headers?.accept?.includes('text/event-stream');

    if (!isStream) {
      const t0Chat = Date.now();
      const result = await chatWithSalesAssistant({
        message: message.trim(), history: effectiveHistory, tenantId, eventId, date: date || null,
        pendingDraft: effectivePendingDraft, contextData: { sellerName, sessionId },
      });
      recordLlmInteraction({
        tenantId, userId: req.userId || null, action: 'AI_CHAT', model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
        tokensIn: null, tokensOut: result.reply ? Math.ceil(result.reply.length / 4) : null, latencyMs: Date.now() - t0Chat,
        ipAddress: req.ip, details: { eventId, toolCalls: (result.toolCalls || []).map((t) => t.name) },
      });

      let draft = result.draftSale || null, suggestedPosters = result.suggestedPosters || [];
      const toolCalls = result.toolCalls || result.functionCalls || [];
      for (const toolCall of toolCalls) {
        const { name, args } = toolCall;
        if (name === 'prepareSaleDraft' && args) draft = await constructDraftPayload(tenantId, args, message.trim());
        else if (name === 'discardSaleDraft') draft = null;
        else if (name === 'searchCatalog' && args?.query) {
          const matches = await searchWebPosters({ tenantId, query: normalizeArtworkQuery(args.query), category: args.category, limit: 12 });
          if (matches?.length > 0) suggestedPosters = matches;
        }
      }

      const effectiveDraft = (draft && draft.items?.length > 0) ? draft : null;
      if (!effectiveDraft) await clearSessionDraft(sessionId);

      const updatedHistory = [...effectiveHistory, { role: 'user', text: message.trim() }, { role: 'model', text: result.reply || '' }].slice(-20);
      await saveSessionState(sessionId, { pendingDraft: effectiveDraft, history: updatedHistory, sellerName, eventId, tenantId });

      const effectiveToolCalls = (toolCalls || []).filter((t) => t.name !== 'prepareSaleDraft' || effectiveDraft !== null);
      return res.json({ success: true, sessionId, reply: result.reply, draft: effectiveDraft, draftSale: effectiveDraft, suggestedPosters, toolCalls: effectiveToolCalls });
    }

    // Modo Streaming con Server-Sent Events (SSE) y Gemini 3.8 Flash
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    let fullText = '', isClientClosed = false, currentDraft = effectivePendingDraft;
    req.on('close', () => { isClientClosed = true; });
    const t0Stream = Date.now();

    try {
      const streamGenerator = streamChatWithSalesAssistant({
        message: message.trim(), history: effectiveHistory, tenantId, eventId, date: date || null,
        pendingDraft: effectivePendingDraft, contextData: { sellerName, sessionId },
      });

      for await (const chunk of streamGenerator) {
        if (isClientClosed || res.writableEnded || res.destroyed) break;
        if (chunk.type === 'token') {
          fullText += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`);
        } else if (chunk.type && chunk.data !== undefined) {
          if (chunk.type === 'draft_sale') {
            currentDraft = chunk.data || null;
            if (!currentDraft?.items?.length) {
              await clearSessionDraft(sessionId);
              currentDraft = null;
            } else {
              await saveSessionState(sessionId, { pendingDraft: currentDraft, sellerName, eventId, tenantId });
            }
          }
          res.write(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        }
      }

      const finalHistory = [...effectiveHistory, { role: 'user', text: message.trim() }, { role: 'model', text: fullText || '¡Con gusto te asesoro!' }].slice(-20);
      await saveSessionState(sessionId, { pendingDraft: currentDraft, history: finalHistory, sellerName, eventId, tenantId });

      recordLlmInteraction({
        tenantId, userId: req.userId || null, action: 'AI_CHAT_STREAM', model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
        tokensIn: null, tokensOut: fullText ? Math.ceil(fullText.length / 4) : null, latencyMs: Date.now() - t0Stream,
        ipAddress: req.ip, details: { eventId },
      });

      if (!isClientClosed && !res.writableEnded && !res.destroyed) {
        res.write(`event: done\ndata: ${JSON.stringify({ fullText: fullText || '¡Con gusto te asesoro con cualquier duda o venta en el stand!', sessionId, draftSale: currentDraft })}\n\n`);
        res.end();
      }
    } catch (streamErr) {
      console.error('❌ Error durante el streaming SSE:', streamErr);
      if (!isClientClosed && !res.writableEnded && !res.destroyed) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: streamErr.message })}\n\n`);
        res.end();
      }
    }
  } catch (err) {
    console.error('❌ Error en handleChatQuery:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: err.message || 'Error comunicándose con el asistente de IA.' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

export async function handleGetSession(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await getSessionState(sessionId, req.tenantId);
    if (!session) return res.status(404).json({ success: false, error: 'Sesión no encontrada o expirada.' });
    return res.json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleClearDraft(req, res) {
  try {
    const { sessionId } = req.params;
    await clearSessionDraft(sessionId);
    return res.json({ success: true, message: 'Borrador de sesión descartado exitosamente.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
