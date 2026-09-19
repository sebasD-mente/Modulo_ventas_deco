import {
  chatWithSalesAssistant,
  streamChatWithSalesAssistant,
  constructDraftPayload,
} from '../../services/aiMultimodalService.js';
import { searchWebPosters } from '../../services/webCatalogService.js';
import { recordLlmInteraction } from '../../services/llmObservabilityService.js';
import { normalizeArtworkQuery } from '../../services/semanticParserService.js';
import { ENV } from '../../config/env.js';

export async function handleChatQuery(req, res) {
  try {
    const { message, history, eventId, date, pendingDraft } = req.body;
    const tenantId = req.tenantId;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
    }
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    const isStream = req.body.stream === true || req.headers.accept?.includes('text/event-stream');

    if (!isStream) {
      // Consultar motor IA con Gemini 3.8 Flash y Function Calling nativo (modo tradicional JSON)
      const t0Chat = Date.now();
      const sellerName = req.body.sellerName || req.user?.fullName || 'Vendedor';
      const result = await chatWithSalesAssistant({
        message: message.trim(),
        history: history || [],
        tenantId,
        eventId,
        date: date || null,
        pendingDraft: pendingDraft || null,
        contextData: { sellerName },
      });
      recordLlmInteraction({
        tenantId,
        userId: req.userId || null,
        action: 'AI_CHAT',
        model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
        tokensIn: null,
        tokensOut: result.reply ? Math.ceil(result.reply.length / 4) : null,
        latencyMs: Date.now() - t0Chat,
        ipAddress: req.ip,
        details: { eventId, toolCalls: (result.toolCalls || []).map((t) => t.name) },
      });

      let draft = result.draftSale || null;
      let suggestedPosters = result.suggestedPosters || [];

      // Manejar llamadas a herramientas retornadas por el motor de IA Gemini 3.8 Flash
      const toolCalls = result.toolCalls || result.functionCalls || [];
      for (const toolCall of toolCalls) {
        const { name, args } = toolCall;
        if (name === 'prepareSaleDraft' && args) {
          draft = await constructDraftPayload(tenantId, args, message.trim());
        } else if (name === 'discardSaleDraft') {
          draft = null;
        } else if (name === 'searchCatalog' && args?.query) {
          const resolvedQuery = normalizeArtworkQuery(args.query);
          const matches = await searchWebPosters({
            tenantId,
            query: resolvedQuery,
            category: args.category,
            limit: 12,
          });
          if (matches?.length > 0) {
            suggestedPosters = matches;
          }
        }
      }

      const effectiveDraft = (draft && draft.items?.length > 0) ? draft : null;
      const effectiveToolCalls = (toolCalls || []).filter((t) => t.name !== 'prepareSaleDraft' || effectiveDraft !== null);

      return res.json({
        success: true,
        reply: result.reply,
        draft: effectiveDraft,
        draftSale: effectiveDraft,
        suggestedPosters,
        toolCalls: effectiveToolCalls,
      });
    }

    // Modo Streaming con Server-Sent Events (SSE) y Gemini 3.8 Flash
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    let fullText = '', isClientClosed = false;
    req.on('close', () => { isClientClosed = true; });
    const t0Stream = Date.now();

    try {
      const sellerName = req.body.sellerName || req.user?.fullName || 'Vendedor';
      const streamGenerator = streamChatWithSalesAssistant({
        message: message.trim(),
        history: history || [],
        tenantId,
        eventId,
        date: date || null,
        pendingDraft: pendingDraft || null,
        contextData: { sellerName },
      });

      for await (const chunk of streamGenerator) {
        if (isClientClosed || res.writableEnded || res.destroyed) break;
        if (chunk.type === 'token') {
          fullText += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`);
        } else if (chunk.type && chunk.data !== undefined) {
          res.write(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        }
      }

      recordLlmInteraction({
        tenantId,
        userId: req.userId || null,
        action: 'AI_CHAT_STREAM',
        model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
        tokensIn: null,
        tokensOut: fullText ? Math.ceil(fullText.length / 4) : null,
        latencyMs: Date.now() - t0Stream,
        ipAddress: req.ip,
        details: { eventId },
      });

      if (!isClientClosed && !res.writableEnded && !res.destroyed) {
        res.write(`event: done\ndata: ${JSON.stringify({ fullText: fullText || '¡Con gusto te asesoro con cualquier duda o venta en el stand!' })}\n\n`);
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
      return res.status(500).json({
        success: false,
        error: err.message || 'Error comunicándose con el asistente de IA.',
      });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}
