import {
  processVoiceSaleAudio, processPostersBatchPhoto,
  recognizePosterArtworkFromImage, recognizePostersFromVideo,
} from '../../services/aiMultimodalService.js';
import { uploadBufferToStorage } from '../../services/gcsStorageService.js';
import { recordLlmInteraction } from '../../services/llmObservabilityService.js';
import { ENV } from '../../config/env.js';

async function safePersistMedia(file, defaultName, defaultMime, folder) {
  try {
    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer, originalname: file.originalname || defaultName,
      mimetype: file.mimetype || defaultMime, folder,
    });
    return uploadRes?.url || null;
  } catch (gcsErr) {
    console.warn(`⚠️ [GCS Warning] No se pudo persistir en ${folder}:`, gcsErr.message);
    return null;
  }
}

export async function handleVoiceSale(req, res) {
  try {
    const { file, body: { eventId }, tenantId } = req;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo de audio.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const t0Voice = Date.now();
    const [audioUrl, draft] = await Promise.all([
      safePersistMedia(file, 'voice-sale.webm', 'audio/webm', 'audio_sales'),
      processVoiceSaleAudio({
        audioBuffer: file.buffer, mimeType: file.mimetype || 'audio/webm', tenantId, eventId,
      }),
    ]);
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_VOICE_SALE',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
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

    return res.json({
      success: true,
      draftSale: { ...draft, audioUrl, inputChannel: 'IA_VOZ' },
      requiresConfirmation: true,
      unmatchedItems: draft.unmatchedItems || [],
      suggestedPosters: draft.suggestedPosters || [],
      message: draft.message || 'Audio analizado con éxito. Por favor verifica y confirma los datos de la venta.',
    });
  } catch (err) {
    console.error('❌ Error en handleVoiceSale:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error procesando el dictado de voz.' });
  }
}

export async function handleBatchPhoto(req, res) {
  try {
    const { file, body: { eventId }, tenantId } = req;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const imageUrl = await safePersistMedia(file, 'posters-bundle.jpg', 'image/jpeg', 'posters_scans');
    const t0Batch = Date.now();
    const analysis = await processPostersBatchPhoto({
      imageBuffer: file.buffer, mimeType: file.mimetype || 'image/jpeg', tenantId, eventId,
    });
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_BATCH_QR_SCAN',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Batch, ipAddress: req.ip,
      details: { eventId, codesDetected: analysis.detectedCodes?.length || 0 },
    });

    return res.json({
      success: true,
      draftSale: {
        items: analysis.items, total: analysis.totalCalculated, paymentMethod: 'EFECTIVO', imageUrl, inputChannel: 'IA_IMAGEN_QR',
        notes: `Escaneo de foto (${analysis.detectedCodes?.length || 0} códigos detectados: ${analysis.detectedCodes?.join(', ') || 'N/A'})`,
      },
      summary: analysis.summary, detectedCodes: analysis.detectedCodes, requiresConfirmation: true,
      message: 'Foto de pósters analizada con éxito. Verifica los ítems y selecciona el método de pago.',
    });
  } catch (err) {
    console.error('❌ Error en handleBatchPhoto:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error analizando la fotografía de pósters.' });
  }
}

export async function handleArtworkRecognition(req, res) {
  try {
    const { file, body: { eventId }, tenantId } = req;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen de la obra.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const [imageUrl, analysis] = await Promise.all([
      safePersistMedia(file, 'artwork.jpg', 'image/jpeg', 'artwork_scans'),
      recognizePosterArtworkFromImage({
        imageBuffer: file.buffer, mimeType: file.mimetype || 'image/jpeg', tenantId, eventId,
      }),
    ]);
    if (analysis.isArtworkDetected === false || !analysis.items?.length) {
      return res.json({
        success: true, imageUrl, draftSale: null, isArtworkDetected: false,
        primaryTitle: analysis.primaryTitle, visualAnalysis: analysis.visualAnalysis,
        candidates: analysis.candidates || [],
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
    const { file, body: { eventId }, tenantId } = req;
    if (!file) return res.status(400).json({ success: false, error: 'No se recibió ningún clip de video.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });

    const videoUrl = await safePersistMedia(file, 'counter-video.mp4', 'video/mp4', 'counter_videos');
    const analysis = await recognizePostersFromVideo({
      videoBuffer: file.buffer, mimeType: file.mimetype || 'video/mp4', tenantId, eventId,
    });
    return res.json({
      success: true,
      draftSale: {
        items: analysis.items, total: analysis.total, paymentMethod: 'EFECTIVO', videoUrl, inputChannel: 'IA_VIDEO_MOSTRADOR',
        notes: `Video del mostrador: ${analysis.items.length} obras detectadas`,
      },
      summary: analysis.summary, requiresConfirmation: true,
      message: 'Video analizado con éxito. Se detectaron las obras mostradas en el mostrador.',
    });
  } catch (err) {
    console.error('❌ Error en handleVideoRecognition:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error analizando video de pósters.' });
  }
}
