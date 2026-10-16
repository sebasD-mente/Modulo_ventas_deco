import { processVoiceSaleAudio, processPostersBatchPhoto, recognizePosterArtworkFromImage, recognizePostersFromVideo } from '../../services/aiMultimodalService.js';
import { verifyDepositReceipt } from '../../services/ai/aiReceiptOcrService.js';
import { uploadBufferToStorage } from '../../services/gcsStorageService.js';
import { recordLlmInteraction } from '../../services/llmObservabilityService.js';
import { getSessionState, saveSessionState } from '../../services/ai/aiSessionService.js';
import { ENV } from '../../config/env.js';

async function safePersistMedia(file, defaultName, defaultMime, folder) {
  let timerId;
  try {
    const uploadPromise = uploadBufferToStorage({ buffer: file.buffer, originalname: file.originalname || defaultName, mimetype: file.mimetype || defaultMime, folder });
    const uploadRes = await Promise.race([uploadPromise, new Promise((resolve) => { timerId = setTimeout(() => resolve(null), 2500); })]);
    return uploadRes?.url || null;
  } catch (gcsErr) {
    console.warn(`⚠️ [GCS Warning] No se pudo persistir en ${folder}:`, gcsErr.message);
    return null;
  } finally { if (timerId) clearTimeout(timerId); }
}

function parseDraftInput(rawDraft) {
  if (!rawDraft) return null;
  if (typeof rawDraft === 'object' && Array.isArray(rawDraft.items)) return rawDraft;
  if (typeof rawDraft === 'string' && rawDraft.trim().startsWith('{')) {
    try { const parsed = JSON.parse(rawDraft); return Array.isArray(parsed?.items) ? parsed : null; } catch { return null; }
  }
  return null;
}

export async function handleVoiceSale(req, res) {
  try {
    const { file, body, tenantId } = req;
    const { eventId, sessionId, pendingDraft: rawDraft } = body || {};
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo de audio.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    let activeDraft = parseDraftInput(rawDraft);
    if (!activeDraft && sessionId) {
      const stored = await getSessionState(sessionId, tenantId);
      if (stored?.pendingDraft?.items?.length) activeDraft = stored.pendingDraft;
    }

    const t0Voice = Date.now();
    const [audioUrl, draft] = await Promise.all([
      safePersistMedia(file, 'voice-sale.webm', 'audio/webm', 'audio_sales'),
      processVoiceSaleAudio({
        audioBuffer: file.buffer, mimeType: file.mimetype || 'audio/webm', tenantId, eventId, pendingDraft: activeDraft,
      }),
    ]);
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_VOICE_SALE',
      model: draft.usedModel || ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Voice, ipAddress: req.ip,
      details: { eventId, confidence: draft.confidence },
    });

    if (!draft.items || draft.items.length === 0) {
      const isGreeting = draft.intent === 'SALUDO' || (!draft.isSaleDetected && draft.greeting);
      const replyMsg = isGreeting ? (draft.greeting || '¡Hola! ¿Listo para vender? Dicta el póster y tamaño.') : (draft.message || 'No se identificaron pósters del catálogo en el dictado de voz. Verifica el diseño o selecciónalo en el buscador.');
      return res.json({
        success: true, draftSale: null, itemsDetected: false,
        transcription: draft.transcription || '', intent: draft.intent || (isGreeting ? 'SALUDO' : 'RUIDO_NO_VENTA'),
        isSaleDetected: Boolean(draft.isSaleDetected), reply: isGreeting ? replyMsg : null, message: replyMsg,
        unmatchedItems: draft.unmatchedItems || [], suggestedPosters: draft.suggestedPosters || [],
      });
    }

    const finalDraftSale = { ...draft, audioUrl, inputChannel: 'IA_VOZ' };
    if (sessionId) await saveSessionState(sessionId, { pendingDraft: finalDraftSale, eventId, tenantId });

    return res.json({
      success: true, draftSale: finalDraftSale, requiresConfirmation: true,
      unmatchedItems: draft.unmatchedItems || [], suggestedPosters: draft.suggestedPosters || [],
      message: draft.message || 'Audio analizado con éxito. Por favor verifica y confirma los datos de la venta.',
    });
  } catch (err) {
    console.error('❌ Error en handleVoiceSale:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error procesando el dictado de voz.' });
  }
}

export async function handleBatchPhoto(req, res) {
  try {
    const { file, body, tenantId } = req;
    const eventId = body?.eventId;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const t0Batch = Date.now();
    const [imageUrl, analysis] = await Promise.all([
      safePersistMedia(file, 'posters-bundle.jpg', 'image/jpeg', 'posters_scans'),
      processPostersBatchPhoto({ imageBuffer: file.buffer, mimeType: file.mimetype || 'image/jpeg', tenantId, eventId }),
    ]);
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_BATCH_QR_SCAN',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Batch, ipAddress: req.ip,
      details: { eventId, codesDetected: analysis.detectedCodes?.length || 0 },
    });

    const validItems = analysis.items || [];
    const hasValid = validItems.length > 0;
    const draftSale = hasValid ? {
      items: validItems, total: analysis.totalCalculated, paymentMethod: 'EFECTIVO', imageUrl, inputChannel: 'IA_IMAGEN_QR',
      notes: `Escaneo de foto (${analysis.detectedCodes?.length || 0} códigos detectados)`,
    } : null;

    return res.json({
      success: true, draftSale, itemsDetected: hasValid, summary: analysis.summary,
      detectedCodes: analysis.detectedCodes, unmatchedItems: analysis.unmatchedItems || [],
      requiresConfirmation: hasValid,
      message: hasValid ? 'Foto de pósters analizada con éxito. Verifica los ítems y confirma.' : 'No se identificaron pósters válidos en la foto.',
    });
  } catch (err) {
    console.error('❌ Error en handleBatchPhoto:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error analizando la fotografía de pósters.' });
  }
}

export async function handleArtworkRecognition(req, res) {
  try {
    const { file, body, tenantId } = req;
    const eventId = body?.eventId;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen de la obra.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const t0Art = Date.now();
    const [imageUrl, analysis] = await Promise.all([
      safePersistMedia(file, 'artwork.jpg', 'image/jpeg', 'artwork_scans'),
      recognizePosterArtworkFromImage({ imageBuffer: file.buffer, mimeType: file.mimetype || 'image/jpeg', tenantId, eventId }),
    ]);
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_ARTWORK_RECOGNITION',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Art, ipAddress: req.ip,
      details: { eventId, detected: analysis.isArtworkDetected, title: analysis.primaryTitle },
    });

    if (analysis.isArtworkDetected === false || !analysis.items?.length) {
      return res.json({
        success: true, imageUrl, draftSale: null, isArtworkDetected: false,
        primaryTitle: analysis.primaryTitle, visualAnalysis: analysis.visualAnalysis, candidates: analysis.candidates || [],
        message: analysis.message || 'La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo.',
      });
    }

    const draftSale = analysis.draftSale || {
      items: analysis.items, total: analysis.total, paymentMethod: 'EFECTIVO',
      imageUrl, inputChannel: 'IA_FOTO_ARTE', notes: `Reconocimiento de obra visual: ${analysis.primaryTitle || 'Detectado'}`,
    };
    if (imageUrl && !draftSale.imageUrl) draftSale.imageUrl = imageUrl;

    return res.json({
      success: true, imageUrl, isArtworkDetected: true, primaryTitle: analysis.primaryTitle, visualAnalysis: analysis.visualAnalysis,
      candidates: analysis.candidates || [], draftSale, requiresConfirmation: true,
      message: analysis.message || 'Obra analizada y encontrada en el catálogo web. Por favor verifica y confirma.',
    });
  } catch (err) {
    console.error('❌ Error en handleArtworkRecognition:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error reconociendo la obra del póster.' });
  }
}

export async function handleVideoRecognition(req, res) {
  try {
    const { file, body, tenantId } = req;
    const eventId = body?.eventId;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ningún clip de video.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const t0Vid = Date.now();
    const [videoUrl, analysis] = await Promise.all([
      safePersistMedia(file, 'counter-video.mp4', 'video/mp4', 'counter_videos'),
      recognizePostersFromVideo({ videoBuffer: file.buffer, mimeType: file.mimetype || 'video/mp4', tenantId, eventId }),
    ]);
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_VIDEO_RECOGNITION',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Vid, ipAddress: req.ip,
      details: { eventId, count: analysis.items?.length || 0 },
    });

    const validItems = analysis.items || [];
    const hasValid = validItems.length > 0;
    const draftSale = hasValid ? {
      items: validItems, total: analysis.total, paymentMethod: 'EFECTIVO', videoUrl, inputChannel: 'IA_VIDEO_MOSTRADOR',
      notes: `Video del mostrador: ${validItems.length} obras detectadas`,
    } : null;

    return res.json({
      success: true, draftSale, itemsDetected: hasValid, summary: analysis.summary,
      unmatchedItems: analysis.unmatchedItems || [], requiresConfirmation: hasValid,
      message: hasValid ? 'Video analizado con éxito. Se detectaron las obras mostradas en el mostrador.' : 'No se detectaron obras del catálogo en el video.',
    });
  } catch (err) {
    console.error('❌ Error en handleVideoRecognition:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error analizando video de pósters.' });
  }
}

export async function handleVerifyReceipt(req, res) {
  try {
    const { receiptUrl, expectedAmount } = req.body || {};
    const tenantId = req.tenantId;
    if (!receiptUrl) return res.status(400).json({ success: false, error: 'receiptUrl es obligatorio para verificar el comprobante.' });
    const t0Ocr = Date.now();
    const result = await verifyDepositReceipt({ imageUrl: receiptUrl, expectedAmount: Number(expectedAmount) || 0, tenantId });
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_RECEIPT_OCR',
      model: result.usedModel || ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Ocr, ipAddress: req.ip,
      details: { isMatch: result.isMatch, bank: result.bank, referenceNumber: result.referenceNumber },
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ Error en handleVerifyReceipt:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error verificando comprobante bancario.' });
  }
}
