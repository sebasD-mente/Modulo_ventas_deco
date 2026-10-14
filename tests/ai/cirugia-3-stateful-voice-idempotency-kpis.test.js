import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../server/config/prisma.js';
import { getEventKPIs } from '../../server/services/sales/saleKpiService.js';
import { processVoiceSaleAudio } from '../../server/services/ai/aiMediaService.js';
import { handleVoiceSale } from '../../server/controllers/ai/aiMediaController.js';
import { getClientForKey } from '../../server/services/ai/aiKeyPoolService.js';
import { productCache, invalidateCatalogCache } from '../../server/services/catalog/catalogCacheStore.js';
import { ENV } from '../../server/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('⚡ CIRUGÍA 3: VOZ STATEFUL, SELECCIÓN INLINE 1-TAP, IDEMPOTENCIA Y KPIS', () => {
  const TEST_TENANT = 'tenant-cirugia-3';

  describe('1. Voz Stateful Aditiva y Cambio de Método de Pago por Voz', () => {
    it('1.1. Dictado aditivo ("agrega otro") fusiona pendingDraft y propaga alternatives', async () => {
      const testKey = 'AQ.cirugia3_aditiva';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      invalidateCatalogCache(TEST_TENANT);
      productCache.set(TEST_TENANT, {
        timestamp: Date.now(),
        products: [
          {
            id: '8f7a92b1-4c3e-4b2a-8d1e-9f0a1b2c3d4e',
            titulo: 'Gokú Ultra Instinto',
            subtitulo: 'Dragon Ball Super',
            categoria: 'ANIME',
            imageUrl: 'https://example.com/goku.webp',
            thumbUrl: 'https://example.com/goku.webp',
            tags: ['goku', 'dragon ball'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
          {
            id: '5e6d7c8b-9a0f-1e2d-3c4b-5a6b7c8d9e0f',
            titulo: 'One Piece Luffy',
            subtitulo: 'Gear 5',
            categoria: 'ANIME',
            imageUrl: 'https://example.com/luffy.webp',
            thumbUrl: 'https://example.com/luffy.webp',
            tags: ['luffy', 'one piece'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
          {
            id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
            titulo: 'Luffy Wano',
            subtitulo: 'Arco Wano',
            categoria: 'ANIME',
            imageUrl: 'https://example.com/luffy-wano.webp',
            thumbUrl: 'https://example.com/luffy-wano.webp',
            tags: ['luffy', 'wano'],
            sizes: [{ sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 }],
          },
        ],
      });

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          transcription: 'agrega también uno de Luffy mediano',
          isSaleDetected: true,
          intent: 'DICTADO_VENTA',
          items: [{ title: 'One Piece Luffy', size: 'MEDIANO', quantity: 1 }],
          confidence: 0.98,
        }),
      });

      const pendingDraft = {
        items: [{
          productId: '8f7a92b1-4c3e-4b2a-8d1e-9f0a1b2c3d4e',
          webPosterId: '8f7a92b1-4c3e-4b2a-8d1e-9f0a1b2c3d4e',
          baseTitle: 'Gokú Ultra Instinto',
          description: 'Gokú Ultra Instinto (Mediano)',
          category: 'ANIME',
          quantity: 1,
          unitPrice: 65,
          subtotal: 65,
          sizeId: 'MEDIANO',
          alternatives: [{ id: 'alt-goku', titulo: 'Gokú SSJ', precioMinimo: 65 }],
        }],
        total: 65,
        paymentMethod: 'EFECTIVO',
      };

      const res = await processVoiceSaleAudio({
        audioBuffer: Buffer.from('fake-audio-bytes'),
        mimeType: 'audio/webm',
        tenantId: TEST_TENANT,
        pendingDraft,
      });

      assert.strictEqual(res.isSaleDetected, true);
      assert.strictEqual(res.items.length, 2, 'Debe contener los 2 productos fusionados');
      assert.strictEqual(res.total, 130, 'Total debe ser 130 (65 + 65)');
      assert.ok(res.items[0].alternatives?.length > 0, 'Primer ítem debe tener alternatives');
      assert.ok(Array.isArray(res.items[1].alternatives), 'Segundo ítem debe tener arreglo de alternatives');
      assert.ok(res.usedModel?.includes('gemini'), 'usedModel debe ser reportado');
    });

    it('1.2. Dictado de cambio de método de pago ("cámbialo a tarjeta") preserva ítems y actualiza paymentMethod', async () => {
      const testKey = 'AQ.cirugia3_pago';
      ENV.GEMINI_API_KEYS = testKey;
      const client = getClientForKey(testKey);

      client.models.generateContent = async () => ({
        text: JSON.stringify({
          transcription: 'cámbialo a tarjeta porfa',
          isSaleDetected: false,
          intent: 'DICTADO_VENTA',
          items: [],
          confidence: 0.95,
        }),
      });

      const pendingDraft = {
        items: [{
          productId: '8f7a92b1-4c3e-4b2a-8d1e-9f0a1b2c3d4e',
          baseTitle: 'Batman Caballero de la Noche',
          description: 'Batman Caballero de la Noche (Mediano)',
          quantity: 1,
          unitPrice: 65,
          subtotal: 65,
          sizeId: 'MEDIANO',
        }],
        total: 65,
        paymentMethod: 'EFECTIVO',
      };

      const res = await processVoiceSaleAudio({
        audioBuffer: Buffer.from('fake-audio-bytes'),
        mimeType: 'audio/webm',
        tenantId: TEST_TENANT,
        pendingDraft,
      });

      assert.strictEqual(res.isSaleDetected, true);
      assert.strictEqual(res.paymentMethod, 'TARJETA', 'Debe haber cambiado a TARJETA');
      assert.strictEqual(res.items.length, 1, 'Debe mantener los ítems del borrador previo');
      assert.strictEqual(res.total, 65);
    });

    it('1.3. handleVoiceSale rehidrata sesión y persiste estado con saveSessionState', async () => {
      const origFindFirst = prisma.aiChatSession.findFirst;
      const origUpsert = prisma.aiChatSession.upsert;
      let persistedData = null;

      try {
        prisma.aiChatSession.findFirst = async ({ where }) => ({
          sessionId: where.sessionId,
          pendingDraft: {
            items: [{ productId: null, description: 'Poster Previo', quantity: 1, unitPrice: 65, subtotal: 65, sizeId: 'MEDIANO' }],
            total: 65,
            paymentMethod: 'EFECTIVO',
          },
        });

        prisma.aiChatSession.upsert = async ({ where, update, create }) => {
          persistedData = { where, update, create };
          return { sessionId: where.sessionId, ...update };
        };

        const testKey = 'AQ.cirugia3_controller';
        ENV.GEMINI_API_KEYS = testKey;
        const client = getClientForKey(testKey);

        client.models.generateContent = async () => ({
          text: JSON.stringify({
            transcription: 'pago con tarjeta',
            isSaleDetected: false,
            items: [],
          }),
        });

        const req = {
          file: { buffer: Buffer.from('audio'), originalname: 'audio.webm', mimetype: 'audio/webm' },
          body: { eventId: 'evt-1', sessionId: 'sess-xyz' },
          tenantId: TEST_TENANT,
          ip: '127.0.0.1',
        };
        let responseJson = null;
        const res = {
          json: (d) => { responseJson = d; return d; },
          status: () => res,
        };

        await handleVoiceSale(req, res);

        assert.ok(responseJson?.success, 'Respuesta debe ser exitosa');
        assert.strictEqual(responseJson.draftSale?.paymentMethod, 'TARJETA');
        assert.ok(persistedData !== null, 'prisma.aiChatSession.upsert debió ser invocado para persistir la sesión');
        assert.strictEqual(persistedData.where.sessionId, 'sess-xyz');
        assert.strictEqual(persistedData.update.pendingDraft.paymentMethod, 'TARJETA');
      } finally {
        prisma.aiChatSession.findFirst = origFindFirst;
        prisma.aiChatSession.upsert = origUpsert;
      }
    });
  });

  describe('2. Idempotencia Determinista y Conexión Inline de Variantes en Frontend', () => {
    it('2.1. useAiChatStream.js incluye Idempotency-Key en confirmPendingSale y FormData en handleVoiceUpload', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src/components/ai-chat/hooks/useAiChatStream.js'), 'utf-8');

      assert.ok(code.includes('idempotencyKey = draft.idempotencyKey || (draft.idempotencyKey = genId())'), 'Debe generar o reutilizar idempotencyKey');
      assert.ok(code.includes("'Idempotency-Key': idempotencyKey"), 'Debe enviar cabecera Idempotency-Key en authFetch /api/sales');
      assert.ok(code.includes('idempotencyKey,'), 'Debe incluir idempotencyKey en el body salePayload');
      assert.ok(code.includes("form.append('sessionId', sessionIdRef.current)"), 'handleVoiceUpload debe adjuntar sessionId al form');
      assert.ok(code.includes("form.append('pendingDraft', JSON.stringify(pendingDraftRef.current))"), 'handleVoiceUpload debe adjuntar pendingDraft');
      assert.ok(code.includes('selectVariantInline,'), 'useAiChatStream debe retornar selectVariantInline');
    });

    it('2.2. UnifiedAiChat.jsx conecta onSelectVariant={chatStream.selectVariantInline} a ChatDraftCard', () => {
      const code = fs.readFileSync(path.join(rootDir, 'src/components/UnifiedAiChat.jsx'), 'utf-8');

      assert.ok(
        code.includes('onSelectVariant={chatStream.selectVariantInline}'),
        'ChatDraftCard debe recibir onSelectVariant={chatStream.selectVariantInline}'
      );
    });
  });

  describe('3. Resolución de Evento Activo por Defecto y Validación de Fechas en getEventKPIs', () => {
    it('3.1. getEventKPIs resuelve automáticamente el evento ACTIVO cuando eventId es nulo o "activo"', async () => {
      const origFindFirst = prisma.event.findFirst;
      const origAggregate = prisma.sale.aggregate;
      const origItemAggregate = prisma.saleItem.aggregate;
      const origPaymentGroupBy = prisma.salePayment.groupBy;
      const origItemGroupBy = prisma.saleItem.groupBy;
      const origFindMany = prisma.sale.findMany;
      const origFindUnique = prisma.event.findUnique;

      let resolvedEventId = null;

      try {
        prisma.event.findFirst = async ({ where }) => {
          assert.strictEqual(where.status, 'ACTIVO');
          return { id: 'evt-activo-auto-resolved' };
        };

        prisma.sale.aggregate = async ({ where }) => {
          resolvedEventId = where.eventId;
          return { _sum: { totalAmount: 500 }, _count: { id: 5 } };
        };
        prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 8 } });
        prisma.salePayment.groupBy = async () => [];
        prisma.saleItem.groupBy = async () => [];
        prisma.sale.findMany = async () => [];
        prisma.event.findUnique = async () => ({ id: 'evt-activo-auto-resolved', name: 'Evento Activo Mock' });

        const kpis = await getEventKPIs({ tenantId: 'tenant-kpi' });

        assert.strictEqual(resolvedEventId, 'evt-activo-auto-resolved', 'saleWhere.eventId debe tener el ID del evento activo resuelto');
        assert.strictEqual(kpis.eventId, 'evt-activo-auto-resolved');
        assert.strictEqual(kpis.totalTransactions, 5);
        assert.strictEqual(kpis.totalAmount, 500);
      } finally {
        prisma.event.findFirst = origFindFirst;
        prisma.sale.aggregate = origAggregate;
        prisma.saleItem.aggregate = origItemAggregate;
        prisma.salePayment.groupBy = origPaymentGroupBy;
        prisma.saleItem.groupBy = origItemGroupBy;
        prisma.sale.findMany = origFindMany;
        prisma.event.findUnique = origFindUnique;
      }
    });

    it('3.2. getEventKPIs no añade filtro createdAt corrupto si la fecha es inválida', async () => {
      const origFindFirst = prisma.event.findFirst;
      const origAggregate = prisma.sale.aggregate;
      const origItemAggregate = prisma.saleItem.aggregate;
      const origPaymentGroupBy = prisma.salePayment.groupBy;
      const origItemGroupBy = prisma.saleItem.groupBy;
      const origFindMany = prisma.sale.findMany;
      const origFindUnique = prisma.event.findUnique;

      let capturedWhere = null;

      try {
        prisma.event.findFirst = async () => ({ id: 'evt-1' });
        prisma.sale.aggregate = async ({ where }) => {
          capturedWhere = where;
          return { _sum: { totalAmount: 100 }, _count: { id: 1 } };
        };
        prisma.saleItem.aggregate = async () => ({ _sum: { quantity: 1 } });
        prisma.salePayment.groupBy = async () => [];
        prisma.saleItem.groupBy = async () => [];
        prisma.sale.findMany = async () => [];
        prisma.event.findUnique = async () => ({ id: 'evt-1', name: 'Evento' });

        await getEventKPIs({ tenantId: 't1', eventId: 'evt-1', date: 'fecha-totalmente-invalida' });

        assert.strictEqual(capturedWhere.createdAt, undefined, 'createdAt no debe ser asignado si la fecha es NaN');
      } finally {
        prisma.event.findFirst = origFindFirst;
        prisma.sale.aggregate = origAggregate;
        prisma.saleItem.aggregate = origItemAggregate;
        prisma.salePayment.groupBy = origPaymentGroupBy;
        prisma.saleItem.groupBy = origItemGroupBy;
        prisma.sale.findMany = origFindMany;
        prisma.event.findUnique = origFindUnique;
      }
    });
  });

  describe('4. Techos Arquitectónicos de Líneas (Line Ceilings Compliance)', () => {
    const ceilings = [
      { file: 'server/services/ai/aiMediaService.js', max: 200, op: '<=' },
      { file: 'server/controllers/ai/aiMediaController.js', max: 180, op: '<=' },
      { file: 'server/services/sales/saleKpiService.js', max: 190, op: '<=' },
      { file: 'src/components/UnifiedAiChat.jsx', max: 80, op: '<' },
      { file: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 200, op: '<=' },
    ];

    for (const { file, max, op } of ceilings) {
      it(`4.x. ${file} cumple techo de ${op} ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').length;
        if (op === '<') {
          assert.ok(lines < max, `${file} tiene ${lines} líneas, excede límite estricto < ${max}`);
        } else {
          assert.ok(lines <= max, `${file} tiene ${lines} líneas, excede límite estricto <= ${max}`);
        }
      });
    }
  });

});
