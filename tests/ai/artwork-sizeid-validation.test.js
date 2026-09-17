import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../server/config/env.js';
import { prisma } from '../../server/config/prisma.js';
import { getGeminiClient } from '../../server/config/gemini.js';
import { getGCSClient } from '../../server/config/gcs.js';
import { resetKeyPool } from '../../server/services/ai/aiKeyPoolService.js';
import { invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import {
  recognizePosterArtworkFromImage,
  processVoiceSaleAudio,
  recognizePostersFromVideo,
} from '../../server/services/ai/aiMediaService.js';
import { handleArtworkRecognition } from '../../server/controllers/ai/aiMediaController.js';

describe('🛡️ VALIDACIÓN DE BLINDAJE: CERO BORRADORES FANTASMA Y SIZEID EN ÍTEMS', () => {
  beforeEach(() => {
    ENV.GEMINI_API_KEY = 'test-validation-key';
    ENV.GCS_BUCKET_NAME = 'deko-eventsales-media';
    resetKeyPool();
    invalidateCatalogCache();

    const mockProduct = {
      id: 'mock-batman-uuid-1',
      name: 'Batman',
      sku: 'DV-BATM',
      category: 'ARTE',
      basePrice: 65,
      sizes: [
        { sizeId: 'MINI', precio: 25, nombre: 'Mini' },
        { sizeId: 'MEDIANO', precio: 65, nombre: 'Mediano' },
        { sizeId: 'GRANDE', precio: 125, nombre: 'Grande' },
      ],
      isActive: true,
      tenantId: 'tenant-val',
    };

    prisma.product = {
      findMany: async () => [mockProduct],
      findFirst: async () => mockProduct,
    };
    prisma.tenant = { findFirst: async () => ({ id: 'tenant-val' }) };
    prisma.event = { findUnique: async () => ({ id: 'event-val', name: 'Expo' }) };
  });

  it('1.1 Rechaza fotos sin póster en catálogo: isArtworkDetected false y draftSale null', async () => {
    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: JSON.stringify({
        primaryTitle: 'Tenedor metálico sobre servilleta',
        visualAnalysis: 'Un tenedor de acero inoxidable sobre una servilleta de papel',
        confidence: 0.90,
        suggestedSize: 'MEDIANO',
        candidates: [],
      }),
    });

    const res = await recognizePosterArtworkFromImage({
      imageBuffer: Buffer.from('mock-non-poster'),
      mimeType: 'image/jpeg',
      tenantId: 'tenant-val',
    });

    assert.strictEqual(res.isArtworkDetected, false, 'Debe marcar isArtworkDetected como false');
    assert.strictEqual(res.draftSale, null, 'draftSale debe ser null para obras no identificadas');
    assert.strictEqual(res.total, 0, 'total debe ser 0');
    assert.strictEqual(res.items.length, 0, 'items debe ser un array vacío');
  });

  it('1.2 Controller responde success true pero draftSale null con mensaje guiado', async () => {
    const gcs = getGCSClient();
    gcs.bucket = () => ({
      file: () => ({
        save: async () => {},
        publicUrl: () => 'https://storage.googleapis.com/deko-eventsales-media/artwork.jpg',
      }),
    });

    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: JSON.stringify({
        primaryTitle: 'Zapatos deportivos en asfalto',
        visualAnalysis: 'Un par de tenis deportivos en el suelo',
        confidence: 0.95,
        suggestedSize: 'MEDIANO',
      }),
    });

    const req = {
      file: { buffer: Buffer.from('mock-bytes'), originalname: 'shoes.jpg', mimetype: 'image/jpeg' },
      body: { eventId: 'event-val' },
      tenantId: 'tenant-val',
    };
    let responseData = null;
    let statusCode = 200;
    const res = {
      status(c) { statusCode = c; return this; },
      json(p) { responseData = p; return this; },
    };

    await handleArtworkRecognition(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.isArtworkDetected, false);
    assert.strictEqual(responseData.draftSale, null, 'Cero borradores fantasma');
    assert.match(responseData.message, /No se identificó ningún póster del catálogo/i);
  });

  it('2.1 recognizePosterArtworkFromImage enlaza sizeId y baseTitle cuando hay match', async () => {
    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: JSON.stringify({
        primaryTitle: 'Batman',
        visualAnalysis: 'Póster de Batman vintage',
        confidence: 0.99,
        suggestedSize: 'MEDIANO',
      }),
    });

    const res = await recognizePosterArtworkFromImage({
      imageBuffer: Buffer.from('mock-poster-batman'),
      mimeType: 'image/jpeg',
      tenantId: 'tenant-val',
    });

    assert.strictEqual(res.isArtworkDetected, true);
    assert.ok(res.items.length > 0);
    const item = res.items[0];
    assert.strictEqual(item.sizeId, 'MEDIANO', 'sizeId debe ser MEDIANO');
    assert.ok(item.baseTitle, 'baseTitle debe estar presente');
    assert.match(item.baseTitle, /Batman/i);
  });

  it('2.2 processVoiceSaleAudio enlaza sizeId y baseTitle en ítems enriquecidos', async () => {
    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: JSON.stringify({
        transcription: '1 batman mediano en efectivo',
        isSaleDetected: true,
        intent: 'DICTADO_VENTA',
        items: [{ title: 'Batman', quantity: 1, size: 'MEDIANO', unitPrice: 65 }],
        paymentMethod: 'EFECTIVO',
      }),
    });

    const res = await processVoiceSaleAudio({
      audioBuffer: Buffer.from('mock-audio'),
      mimeType: 'audio/webm',
      tenantId: 'tenant-val',
    });

    assert.strictEqual(res.isSaleDetected, true);
    assert.ok(res.items.length > 0);
    const item = res.items[0];
    assert.strictEqual(item.sizeId, 'MEDIANO', 'sizeId debe ser MEDIANO en venta por voz');
    assert.ok(item.baseTitle, 'baseTitle debe estar presente en venta por voz');
  });

  it('2.3 recognizePostersFromVideo enlaza sizeId y baseTitle en ítems detectados', async () => {
    const client = getGeminiClient();
    client.models.generateContent = async () => ({
      text: JSON.stringify({
        summary: '1 póster de Batman visible en mostrador',
        postersDetected: [{ title: 'Batman', quantity: 1, suggestedSize: 'MEDIANO' }],
        confidence: 0.92,
      }),
    });

    const res = await recognizePostersFromVideo({
      videoBuffer: Buffer.from('mock-video'),
      mimeType: 'video/mp4',
      tenantId: 'tenant-val',
    });

    assert.ok(res.items.length > 0);
    const item = res.items[0];
    assert.strictEqual(item.sizeId, 'MEDIANO', 'sizeId debe ser MEDIANO en reconocimiento de video');
    assert.ok(item.baseTitle, 'baseTitle debe estar presente en reconocimiento de video');
  });
});