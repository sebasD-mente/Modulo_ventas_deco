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

    const audioUrl = await safePersistMedia(file, 'voice-sale.webm', 'audio/webm', 'audio_sales');
    const t0Voice = Date.now();
    const draft = await processVoiceSaleAudio({
      audioBuffer: file.buffer, mimeType: file.mimetype || 'audio/webm', tenantId, eventId,
    });
    recordLlmInteraction({
      tenantId, userId: req.userId || null, action: 'AI_VOICE_SALE',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash', tokensIn: null, tokensOut: null,
      latencyMs: Date.now() - t0Voice, ipAddress: req.ip,
      details: { eventId, confidence: draft.confidence },
    });

    if (!draft.items || draft.items.length === 0) {
      return res.json({
        success: true,
        draftSale: null,
        itemsDetected: false,
        transcription: draft.transcription || '',
        message: 'No se identificaron pósters ni obras en el dictado de voz.',
      });
    }

    return res.json({
      success: true,
      draftSale: { ...draft, audioUrl, inputChannel: 'IA_VOZ' },
      requiresConfirmation: true,
      message: 'Audio analizado con éxito. Por favor verifica y confirma los datos de la venta.',
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
      imageBuffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      tenantId,
      eventId,
    });
    recordLlmInteraction({
      tenantId,
      userId: req.userId || null,
      action: 'AI_BATCH_QR_SCAN',
      model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
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
        paymentMethod: 'EFECTIVO',
        imageUrl,
        inputChannel: 'IA_IMAGEN_QR',
        notes: `Escaneo de foto (${analysis.detectedCodes?.length || 0} códigos detectados: ${analysis.detectedCodes?.join(', ') || 'N/A'})`,
      },
      summary: analysis.summary,
      detectedCodes: analysis.detectedCodes,
      requiresConfirmation: true,
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

    const imageUrl = await safePersistMedia(file, 'artwork.jpg', 'image/jpeg', 'artwork_scans');
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
    return res.status(500).json({ success: false, error: err.message || 'Error analizando video de pósters.' });
  }
}
