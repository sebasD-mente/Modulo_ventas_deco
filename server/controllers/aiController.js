import {
  processVoiceSaleAudio,
  processPostersBatchPhoto,
  chatWithSalesAssistant,
  streamChatWithSalesAssistant,
  constructDraftPayload,
} from '../services/aiMultimodalService.js';
import { searchWebPosters } from '../services/webCatalogService.js';
import { uploadBufferToStorage } from '../services/gcsStorageService.js';
import { recordLlmInteraction } from '../services/llmObservabilityService.js';


export async function handleVoiceSale(req, res) {
  try {
    const file = req.file;
    const { eventId } = req.body;
    const tenantId = req.tenantId;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo de audio.' });
    }

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    // 1. Guardar archivo en GCS / storage si está configurado
    let audioUrl = null;
    try {
      const uploadRes = await uploadBufferToStorage({
        buffer: file.buffer,
        originalname: file.originalname || 'voice-sale.webm',
        mimetype: file.mimetype || 'audio/webm',
        folder: 'audio_sales',
      });
      audioUrl = uploadRes?.url || null;
    } catch (gcsErr) {
      console.warn('⚠️ [GCS Warning] No se pudo persistir audio en GCS:', gcsErr.message);
    }

    // 2. Extraer venta con Gemini 2.5 Flash + telemetría LLM
    const t0Voice = Date.now();
    const draft = await processVoiceSaleAudio({
      audioBuffer: file.buffer,
      mimeType: file.mimetype || 'audio/webm',
      tenantId,
      eventId,
    });
    recordLlmInteraction({
      tenantId,
      userId: req.userId || null,
      action: 'AI_VOICE_SALE',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      tokensIn: null,
      tokensOut: null,
      latencyMs: Date.now() - t0Voice,
      ipAddress: req.ip,
      details: { eventId, confidence: draft.confidence },
    });


    return res.json({
      success: true,
      draftSale: {
        ...draft,
        audioUrl,
        inputChannel: 'IA_VOZ',
      },
      requiresConfirmation: true, // Human-in-the-loop obligatorio
      message: 'Audio analizado con éxito. Por favor verifica y confirma los datos de la venta.',
    });
  } catch (err) {
    console.error('❌ Error en handleVoiceSale:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error procesando el dictado de voz.',
    });
  }
}

export async function handleBatchPhoto(req, res) {
  try {
    const file = req.file;
    const { eventId } = req.body;
    const tenantId = req.tenantId;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen.' });
    }

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    // 1. Guardar foto en almacenamiento GCS si está disponible
    let imageUrl = null;
    try {
      const uploadRes = await uploadBufferToStorage({
        buffer: file.buffer,
        originalname: file.originalname || 'posters-bundle.jpg',
        mimetype: file.mimetype || 'image/jpeg',
        folder: 'posters_scans',
      });
      imageUrl = uploadRes?.url || null;
    } catch (gcsErr) {
      console.warn('⚠️ [GCS Warning] No se pudo persistir foto en GCS:', gcsErr.message);
    }

    // 2. Analizar códigos QR / barras con Gemini 2.5 Flash Vision + telemetría LLM
    const t0Batch = Date.now();
    const analysis = await processPostersBatchPhoto({
      imageBuffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      tenantId,
      eventId,
    });
    recordLlmInteraction({
      tenantId,
      userId: req.userId || null,
      action: 'AI_BATCH_QR_SCAN',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      tokensIn: null,
      tokensOut: null,
      latencyMs: Date.now() - t0Batch,
      ipAddress: req.ip,
      details: { eventId, codesDetected: analysis.detectedCodes?.length || 0 },
    });


    return res.json({
      success: true,
      draftSale: {
        items: analysis.items,
        total: analysis.totalCalculated,
        paymentMethod: 'EFECTIVO', // Valor por defecto para selección rápida
        imageUrl,
        inputChannel: 'IA_IMAGEN_QR',
        notes: `Escaneo de foto (${analysis.detectedCodes?.length || 0} códigos detectados: ${analysis.detectedCodes?.join(', ') || 'N/A'})`,
      },
      summary: analysis.summary,
      detectedCodes: analysis.detectedCodes,
      requiresConfirmation: true, // Human-in-the-loop obligatorio
      message: 'Foto de pósters analizada con éxito. Verifica los ítems y selecciona el método de pago.',
    });
  } catch (err) {
    console.error('❌ Error en handleBatchPhoto:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error analizando la fotografía de pósters.',
    });
  }
}

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
      // Consultar motor IA con Gemini 2.5 Flash y Function Calling nativo (modo tradicional JSON)
      const t0Chat = Date.now();
      const result = await chatWithSalesAssistant({
        message: message.trim(),
        history: history || [],
        tenantId,
        eventId,
        date: date || null,
        pendingDraft: pendingDraft || null,
      });
      recordLlmInteraction({
        tenantId,
        userId: req.userId || null,
        action: 'AI_CHAT',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        tokensIn:  null,
        tokensOut: result.reply ? Math.ceil(result.reply.length / 4) : null, // ~4 chars/token
        latencyMs: Date.now() - t0Chat,
        ipAddress: req.ip,
        details: { eventId, toolCalls: (result.toolCalls || []).map((t) => t.name) },
      });

      let draft = result.draftSale || null;
      let suggestedPosters = result.suggestedPosters || [];

      // Manejar llamadas a herramientas (functionCalls) retornadas por el motor de IA Gemini 2.5 Flash
      const toolCalls = result.toolCalls || result.functionCalls || [];
      for (const toolCall of toolCalls) {
        const { name, args } = toolCall;
        if (name === 'prepareSaleDraft' && args) {
          draft = await constructDraftPayload(tenantId, args, message.trim());
        } else if (name === 'searchCatalog' && args?.query) {
          const matches = await searchWebPosters({
            tenantId,
            query: args.query,
            category: args.category,
            limit: 4,
          });
          if (matches?.length > 0) {
            suggestedPosters = matches;
          }
        }
      }

      return res.json({
        success: true,
        reply: result.reply,
        draft,
        draftSale: draft,
        suggestedPosters,
        toolCalls,
      });
    }

    // Modo Streaming con Server-Sent Events (SSE) y Gemini 2.5 Flash
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    let fullText = '';
    const t0Stream = Date.now();

    try {
      const streamGenerator = streamChatWithSalesAssistant({
        message: message.trim(),
        history: history || [],
        tenantId,
        eventId,
        date: date || null,
        pendingDraft: pendingDraft || null,
      });

      for await (const chunk of streamGenerator) {
        if (chunk.type === 'token') {
          fullText += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text, delta: chunk.text })}\n\n`);
        } else if (chunk.type === 'draft_sale') {
          res.write(`event: draft_sale\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        } else if (chunk.type === 'suggested_posters') {
          res.write(`event: suggested_posters\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        }
      }

      recordLlmInteraction({
        tenantId,
        userId: req.userId || null,
        action: 'AI_CHAT_STREAM',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        tokensIn:  null,
        tokensOut: fullText ? Math.ceil(fullText.length / 4) : null,
        latencyMs: Date.now() - t0Stream,
        ipAddress: req.ip,
        details: { eventId },
      });

      res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
      res.end();
    } catch (streamErr) {
      console.error('❌ Error durante el streaming SSE:', streamErr);
      res.write(`event: error\ndata: ${JSON.stringify({ error: streamErr.message })}\n\n`);
      res.end();
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

import {
  recognizePosterArtworkFromImage,
  recognizePostersFromVideo,
} from '../services/aiMultimodalService.js';

export async function handleArtworkRecognition(req, res) {
  try {
    const file = req.file;
    const { eventId } = req.body;
    const tenantId = req.tenantId;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen de la obra.' });
    }

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    let imageUrl = null;
    try {
      const uploadRes = await uploadBufferToStorage({
        buffer: file.buffer,
        originalname: file.originalname || 'artwork.jpg',
        mimetype: file.mimetype || 'image/jpeg',
        folder: 'artwork_scans',
      });
      imageUrl = uploadRes?.url || null;
    } catch (gcsErr) {
      console.warn('⚠️ [GCS Warning] No se pudo persistir foto de obra en GCS:', gcsErr.message);
    }

    const analysis = await recognizePosterArtworkFromImage({
      imageBuffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      tenantId,
      eventId,
    });

    return res.json({
      success: true,
      draftSale: {
        items: analysis.items,
        total: analysis.total,
        paymentMethod: 'EFECTIVO',
        imageUrl,
        inputChannel: 'IA_FOTO_ARTE',
        notes: `Reconocimiento de obra visual: ${analysis.primaryTitle || 'Detectado'}`,
      },
      visualAnalysis: analysis.visualAnalysis,
      primaryTitle: analysis.primaryTitle,
      requiresConfirmation: true,
      message: 'Obra analizada y encontrada en el catálogo web. Por favor verifica y confirma.',
    });
  } catch (err) {
    console.error('❌ Error en handleArtworkRecognition:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error reconociendo la obra del póster.',
    });
  }
}

export async function handleVideoRecognition(req, res) {
  try {
    const file = req.file;
    const { eventId } = req.body;
    const tenantId = req.tenantId;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún clip de video.' });
    }

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    let videoUrl = null;
    try {
      const uploadRes = await uploadBufferToStorage({
        buffer: file.buffer,
        originalname: file.originalname || 'counter-video.mp4',
        mimetype: file.mimetype || 'video/mp4',
        folder: 'counter_videos',
      });
      videoUrl = uploadRes?.url || null;
    } catch (gcsErr) {
      console.warn('⚠️ [GCS Warning] No se pudo persistir video en GCS:', gcsErr.message);
    }

    const analysis = await recognizePostersFromVideo({
      videoBuffer: file.buffer,
      mimeType: file.mimetype || 'video/mp4',
      tenantId,
      eventId,
    });

    return res.json({
      success: true,
      draftSale: {
        items: analysis.items,
        total: analysis.total,
        paymentMethod: 'EFECTIVO',
        videoUrl,
        inputChannel: 'IA_VIDEO_MOSTRADOR',
        notes: `Video del mostrador: ${analysis.items.length} obras detectadas`,
      },
      summary: analysis.summary,
      requiresConfirmation: true,
      message: 'Video analizado con éxito. Se detectaron las obras mostradas en el mostrador.',
    });
  } catch (err) {
    console.error('❌ Error en handleVideoRecognition:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error analizando video de pósters.',
    });
  }
}
