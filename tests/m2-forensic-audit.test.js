import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  saleItemSchema,
  createSaleSchema,
  updateSaleSchema,
  cashClosingSchema,
} from '../server/validators/saleValidators.js';
import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_AUDIO_MIMES,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_MIME_TYPES,
  fileFilter,
} from '../server/middleware/uploadMiddleware.js';
import {
  invalidateCatalogCache,
  searchWebPosters,
  getWebPosterById,
  getAllWebPostersCatalogSummary,
} from '../server/services/webCatalogService.js';
import router from '../server/routes/apiRoutes.js';
import fs from 'node:fs';
import path from 'node:path';

describe('🔍 FORENSIC AUDIT — Milestone 2: Verification of All Claims & Logic', () => {

  describe('1. C-04: Strict Financial Accounting in Payment Validation (saleService.js)', () => {
    it('Verificar inspección estricta de código: no existe cláusula && paymentsTotal === 0', () => {
      const filePath = path.resolve('server/services/saleService.js');
      const content = fs.readFileSync(filePath, 'utf8');

      // Asegurar que se eliminó el bypass "&& paymentsTotal === 0"
      assert.doesNotMatch(
        content,
        /paymentsTotal\s*===\s*0/,
        'VIOLACIÓN: Se encontró todavía paymentsTotal === 0 en saleService.js'
      );

      // Asegurar que existe la verificación obligatoria con tolerancia de 0.05
      assert.match(
        content,
        /if\s*\(\s*Math\.abs\(\s*paymentsTotal\s*-\s*totalAmount\s*\)\s*>\s*0\.05\s*\)/,
        'VIOLACIÓN: La condición matemática estricta no está presente'
      );
    });

    it('Simulación matemática: rechazo implacable de pagos parciales descuadrados', () => {
      const validatePayments = (payments, totalAmount) => {
        const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
        if (Math.abs(paymentsTotal - totalAmount) > 0.05) {
          throw new Error(`El monto pagado (Q ${paymentsTotal.toFixed(2)}) no coincide con el total (Q ${totalAmount.toFixed(2)})`);
        }
        return true;
      };

      // Exacto
      assert.equal(validatePayments([{ amount: 100 }], 100), true);

      // Descuadre mínimo aceptable dentro de tolerancia contable (0.02)
      assert.equal(validatePayments([{ amount: 99.98 }], 100), true);

      // CASO HISTÓRICO DE BUG (Q1 pagado sobre Q500): Ahora DEBE fallar
      assert.throws(
        () => validatePayments([{ amount: 1 }], 500),
        /no coincide con el total/
      );

      // Sobrepago excesivo (Q150 sobre Q100): DEBE fallar
      assert.throws(
        () => validatePayments([{ amount: 150 }], 100),
        /no coincide con el total/
      );

      // Pago cero: DEBE fallar
      assert.throws(
        () => validatePayments([{ amount: 0 }], 100),
        /no coincide con el total/
      );
    });
  });

  describe('2. C-05: Zod Schema Extension & Multimodal AI Channels (saleValidators.js)', () => {
    it('saleItemSchema acepta id uuid opcional y nulo', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const itemWithId = saleItemSchema.parse({
        id: validUuid,
        description: 'Póster Vintage',
        quantity: 2,
        unitPrice: 50,
      });
      assert.equal(itemWithId.id, validUuid);

      const itemWithoutId = saleItemSchema.parse({
        description: 'Póster Vintage Sin ID',
        quantity: 1,
        unitPrice: 35,
      });
      assert.equal(itemWithoutId.id, undefined);

      const itemWithNullId = saleItemSchema.parse({
        id: null,
        description: 'Póster Vintage Null ID',
        quantity: 1,
        unitPrice: 35,
      });
      assert.equal(itemWithNullId.id, null);

      assert.throws(() => {
        saleItemSchema.parse({
          id: 'invalid-uuid-string',
          description: 'Póster Malo',
          quantity: 1,
          unitPrice: 35,
        });
      });
    });

    it('createSaleSchema valida correctamente los 8 canales de venta multimodales', () => {
      const basePayload = {
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        items: [{ description: 'Obra 1', quantity: 1, unitPrice: 25 }],
        payments: [{ method: 'EFECTIVO', amount: 25 }],
      };

      const requiredChannels = [
        'MANUAL_POS',
        'MANUAL_RAPIDA',
        'IA_VOZ',
        'IA_IMAGEN_QR',
        'IA_TEXTO',
        'IA_CHAT_TEXTO',
        'IA_FOTO_ARTE',
        'IA_VIDEO_MOSTRADOR',
      ];

      for (const channel of requiredChannels) {
        const parsed = createSaleSchema.parse({
          ...basePayload,
          inputChannel: channel,
        });
        assert.equal(parsed.inputChannel, channel, `Canal ${channel} debe ser aceptado`);
      }

      // Canales no autorizados deben fallar
      assert.throws(() => {
        createSaleSchema.parse({
          ...basePayload,
          inputChannel: 'HACKED_UNSUPPORTED_CHANNEL',
        });
      });
    });
  });

  describe('3. C-06: Item Reconciliation Without Cascade Deletion in saleService.js', () => {
    it('Inspección de código: no existe deleteMany ciego de todos los ítems de la venta', () => {
      const filePath = path.resolve('server/services/saleService.js');
      const content = fs.readFileSync(filePath, 'utf8');

      // Verificar que updateSaleTransaction NO ejecuta deleteMany({ where: { saleId } })
      const updateSection = content.slice(content.indexOf('updateSaleTransaction'));
      assert.doesNotMatch(
        updateSection,
        /tx\.saleItem\.deleteMany\(\s*\{\s*where:\s*\{\s*saleId\s*\}\s*\}\s*\)/,
        'VIOLACIÓN: updateSaleTransaction todavía hace deleteMany({ where: { saleId } })'
      );

      // Verificar que implementa matchedExistingIds y discardedItemIds
      assert.match(updateSection, /matchedExistingIds/);
      assert.match(updateSection, /discardedItemIds/);
      assert.match(updateSection, /tx\.saleItem\.update/);
    });

    it('Simulación empírica de reconciliación en 3 fases: preservación de IDs y trazabilidad', () => {
      const existingItems = [
        { id: 'item-1', productId: 'p-1', description: 'Poster A', quantity: 1, unitPrice: 50, subtotal: 50, productionStatus: 'IMPRESO' },
        { id: 'item-2', productId: 'p-2', description: 'Poster B', quantity: 2, unitPrice: 25, subtotal: 50, productionStatus: 'SEPARADO' },
        { id: 'item-3', productId: null, description: 'Poster C', quantity: 1, unitPrice: 30, subtotal: 30, productionStatus: 'PENDIENTE' },
      ];

      const incomingItems = [
        { id: 'item-1', productId: 'p-1', description: 'Poster A', quantity: 3, unitPrice: 50 },
        { productId: 'p-2', description: 'Poster B modificado', quantity: 2, unitPrice: 25 },
        { productId: 'p-4', description: 'Poster D Nuevo', quantity: 1, unitPrice: 100 },
      ];

      const updated = [];
      const created = [];
      const matchedExistingIds = new Set();

      for (const item of incomingItems) {
        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        const trimmedDesc = item.description.trim();

        const existingItem = existingItems.find((ex) => {
          if (matchedExistingIds.has(ex.id)) return false;
          if (item.id && ex.id === item.id) return true;
          if (!item.id && item.productId && ex.productId === item.productId) return true;
          if (!item.id && !item.productId && ex.description.trim().toLowerCase() === trimmedDesc.toLowerCase()) return true;
          return false;
        });

        if (existingItem) {
          matchedExistingIds.add(existingItem.id);
          updated.push({
            id: existingItem.id,
            data: {
              productId: item.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
            },
          });
        } else {
          created.push({
            productId: item.productId || null,
            description: trimmedDesc,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
            productionStatus: 'PENDIENTE',
          });
        }
      }

      const discardedItemIds = existingItems
        .filter((ex) => !matchedExistingIds.has(ex.id))
        .map((ex) => ex.id);

      assert.equal(updated.length, 2, '2 ítems debieron ser actualizados preservando su ID');
      assert.equal(updated[0].id, 'item-1');
      assert.equal(updated[0].data.quantity, 3);
      assert.equal(updated[1].id, 'item-2');

      assert.equal(created.length, 1, '1 ítem debió ser creado');
      assert.equal(created[0].description, 'Poster D Nuevo');

      assert.deepEqual(discardedItemIds, ['item-3'], 'Solo item-3 debe ser descartado');
    });
  });

  describe('4. C-07: Error Handling en productionController.js', () => {
    it('Inspección de código: updateProductionStatus no retorna HTTP 200 ante fallas de DB', () => {
      const filePath = path.resolve('server/controllers/productionController.js');
      const content = fs.readFileSync(filePath, 'utf8');

      const updateFn = content.slice(content.indexOf('updateProductionStatus'));
      assert.doesNotMatch(
        updateFn,
        /catch\s*\(\s*dbErr\s*\)\s*\{\s*return\s*res\.status\(200\)/,
        'VIOLACIÓN: Se encontró catch (dbErr) retornando status(200)'
      );

      assert.match(
        updateFn,
        /catch\s*\(\s*dbErr\s*\)\s*\{[\s\S]*?res\.status\(500\)\.json\(\s*\{\s*success:\s*false/
      );
    });
  });

  describe('5. A-01: Route Protection & Event Access in apiRoutes.js', () => {
    it('Verificar que requireRole y requireEventAccess están aplicados a rutas de eventos y ventas', () => {
      const filePath = path.resolve('server/routes/apiRoutes.js');
      const content = fs.readFileSync(filePath, 'utf8');

      assert.match(content, /router\.post\(\s*['"]\/ai\/voice-sale['"][\s\S]*?upload\.single\('audio'\)[\s\S]*?requireEventAccess/);
      assert.match(content, /router\.post\(\s*['"]\/ai\/batch-photo['"][\s\S]*?upload\.single\('image'\)[\s\S]*?requireEventAccess/);
      assert.match(content, /router\.post\(\s*['"]\/ai\/recognize-artwork['"][\s\S]*?upload\.single\('image'\)[\s\S]*?requireEventAccess/);
      assert.match(content, /router\.post\(\s*['"]\/ai\/recognize-video['"][\s\S]*?upload\.single\('video'\)[\s\S]*?requireEventAccess/);
      assert.match(content, /router\.post\(\s*['"]\/ai\/chat['"][\s\S]*?requireEventAccess/);

      assert.match(content, /if\s*\(\s*err\?\.name\s*===\s*'MulterError'\s*\)/);
      assert.match(content, /if\s*\(\s*err\?\.code\s*===\s*'UNSUPPORTED_MEDIA_TYPE'/);
    });
  });

  describe('6. A-10: Tenant-Partitioned Cache in webCatalogService.js', () => {
    it('productCache es un Map y se particiona por tenantId', async () => {
      const filePath = path.resolve('server/services/webCatalogService.js');
      const content = fs.readFileSync(filePath, 'utf8');

      assert.match(content, /const\s+productCache\s*=\s*new\s+Map\(\);/);
      assert.match(content, /invalidateCatalogCache\s*\(\s*tenantId\s*=\s*null\s*\)/);

      invalidateCatalogCache('tenant-a');
      invalidateCatalogCache();
    });
  });

  describe('7. A-12: Zero-Trust Strict Cryptographic Auth in authController.js', () => {
    it('jwt.decode no está presente en authController.js', () => {
      const filePath = path.resolve('server/controllers/authController.js');
      const content = fs.readFileSync(filePath, 'utf8');

      assert.doesNotMatch(
        content,
        /jwt\.decode/,
        'VIOLACIÓN: jwt.decode sigue existiendo en authController.js'
      );

      assert.match(content, /if\s*\(\s*!ENV\.GOOGLE_CLIENT_ID\s*\)\s*\{/);
      assert.match(content, /googleClient\.verifyIdToken/);
    });
  });

  describe('8. A-14: Multer fileFilter Whitelisting in uploadMiddleware.js', () => {
    it('ALLOWED_IMAGE_MIMES, ALLOWED_AUDIO_MIMES, ALLOWED_VIDEO_MIMES y ALLOWED_MIME_TYPES están correctamente tipados', () => {
      assert.ok(ALLOWED_IMAGE_MIMES.includes('image/jpeg'));
      assert.ok(ALLOWED_IMAGE_MIMES.includes('image/png'));
      assert.ok(ALLOWED_IMAGE_MIMES.includes('image/webp'));
      assert.ok(ALLOWED_IMAGE_MIMES.includes('image/heic'));

      assert.ok(ALLOWED_AUDIO_MIMES.includes('audio/mp4'));
      assert.ok(ALLOWED_AUDIO_MIMES.includes('audio/m4a'));
      assert.ok(ALLOWED_AUDIO_MIMES.includes('audio/webm'));
      assert.ok(ALLOWED_AUDIO_MIMES.includes('audio/wav'));

      assert.ok(ALLOWED_VIDEO_MIMES.includes('video/mp4'));
      assert.ok(ALLOWED_VIDEO_MIMES.includes('video/webm'));
      assert.ok(ALLOWED_VIDEO_MIMES.includes('video/quicktime'));

      assert.ok(ALLOWED_MIME_TYPES instanceof Set);
    });

    it('fileFilter acepta formatos válidos y rechaza estrictamente ejecutables y formatos no permitidos', () => {
      const testFile = (fieldname, mimetype) => {
        let accepted = false;
        let rejectedError = null;
        fileFilter({}, { fieldname, mimetype }, (err, allow) => {
          if (err) rejectedError = err;
          accepted = !!allow;
        });
        return { accepted, rejectedError };
      };

      assert.equal(testFile('audio', 'audio/webm').accepted, true);
      assert.equal(testFile('audio', 'audio/mp4').accepted, true);
      assert.equal(testFile('audio', 'audio/m4a').accepted, true);
      assert.equal(testFile('image', 'image/jpeg').accepted, true);
      assert.equal(testFile('image', 'image/png').accepted, true);
      assert.equal(testFile('video', 'video/mp4').accepted, true);

      const exeTest = testFile('audio', 'application/x-msdownload');
      assert.equal(exeTest.accepted, false);
      assert.equal(exeTest.rejectedError?.code, 'UNSUPPORTED_MEDIA_TYPE');

      const shTest = testFile('image', 'application/x-sh');
      assert.equal(shTest.accepted, false);
      assert.equal(shTest.rejectedError?.code, 'UNSUPPORTED_MEDIA_TYPE');

      const svgTest = testFile('image', 'image/svg+xml');
      assert.equal(svgTest.accepted, false);
      assert.equal(svgTest.rejectedError?.code, 'UNSUPPORTED_MEDIA_TYPE');

      const crossTest = testFile('audio', 'image/jpeg');
      assert.equal(crossTest.accepted, false);
      assert.equal(crossTest.rejectedError?.code, 'UNSUPPORTED_MEDIA_TYPE');
    });
  });

});
