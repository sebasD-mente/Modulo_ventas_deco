import {
  processVoiceSaleAudio,
  processPostersBatchPhoto,
  chatWithSalesAssistant,
} from '../services/aiMultimodalService.js';
import { uploadBufferToStorage } from '../services/gcsStorageService.js';

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

    // 1. Guardar archivo en GCS / storage
    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer,
      originalname: file.originalname || 'voice-sale.webm',
      mimetype: file.mimetype || 'audio/webm',
      folder: 'audio_sales',
    });

    // 2. Extraer venta con Gemini 3.8 Flash
    const draft = await processVoiceSaleAudio({
      audioBuffer: file.buffer,
      mimeType: file.mimetype || 'audio/webm',
      tenantId,
      eventId,
    });

    return res.json({
      success: true,
      draftSale: {
        ...draft,
        audioUrl: uploadRes.url,
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

    // 1. Guardar foto en almacenamiento GCS
    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer,
      originalname: file.originalname || 'posters-bundle.jpg',
      mimetype: file.mimetype || 'image/jpeg',
      folder: 'posters_scans',
    });

    // 2. Analizar códigos QR / barras con Gemini 3.8 Flash Vision
    const analysis = await processPostersBatchPhoto({
      imageBuffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      tenantId,
      eventId,
    });

    return res.json({
      success: true,
      draftSale: {
        items: analysis.items,
        total: analysis.totalCalculated,
        paymentMethod: 'EFECTIVO', // Valor por defecto para selección rápida
        imageUrl: uploadRes.url,
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
    const { message, history, eventId, date } = req.body;
    const tenantId = req.tenantId;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
    }

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'El ID del evento es obligatorio.' });
    }

    const reply = await chatWithSalesAssistant({
      message: message.trim(),
      history: history || [],
      tenantId,
      eventId,
      date: date || null,
    });

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    console.error('❌ Error en handleChatQuery:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error comunicándose con el asistente de IA.',
    });
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

    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer,
      originalname: file.originalname || 'artwork.jpg',
      mimetype: file.mimetype || 'image/jpeg',
      folder: 'artwork_scans',
    });

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
        imageUrl: uploadRes.url,
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

    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer,
      originalname: file.originalname || 'counter-video.mp4',
      mimetype: file.mimetype || 'video/mp4',
      folder: 'counter_videos',
    });

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
        videoUrl: uploadRes.url,
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
