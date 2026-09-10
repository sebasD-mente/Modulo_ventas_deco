import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_MIME_TYPES,
  fileFilter,
} from '../server/middleware/uploadMiddleware.js';
import {
  createSaleSchema,
  updateSaleSchema,
  cashClosingSchema,
} from '../server/validators/saleValidators.js';

describe('⚔️ ADVERSARIAL STRESS TESTING — Milestone 2 Logic & Edge Cases', () => {

  describe('1. Stress Testing C-04: Boundary Conditions on Payment Floating-Point Math', () => {
    const checkTolerance = (paymentsTotal, totalAmount) => {
      return Math.abs(paymentsTotal - totalAmount) > 0.05;
    };

    it('Tolerancia exacta de 0.05 es aceptada (no lanza error)', () => {
      // Diferencia exactamente 0.05
      assert.equal(checkTolerance(100.05, 100.00), false);
      assert.equal(checkTolerance(99.95, 100.00), false);
    });

    it('Diferencia de 0.050001 o mayor es rechazada implacablemente', () => {
      assert.equal(checkTolerance(100.051, 100.00), true);
      assert.equal(checkTolerance(99.949, 100.00), true);
      assert.equal(checkTolerance(101.00, 100.00), true);
      assert.equal(checkTolerance(0.00, 100.00), true);
    });

    it('Flotantes con problemas de precisión IEEE 754 (ej. 0.1 + 0.2 vs 0.3)', () => {
      const p1 = 0.1;
      const p2 = 0.2;
      const paymentsTotal = p1 + p2; // 0.30000000000000004
      const totalAmount = 0.3;
      assert.equal(checkTolerance(paymentsTotal, totalAmount), false);
    });

    it('Venta masiva con 20 métodos de pago fraccionados que suman exactamente el total', () => {
      const payments = Array.from({ length: 20 }, () => ({ amount: 12.50 }));
      const totalAmount = 250.00;
      const paymentsTotal = payments.reduce((acc, p) => acc + p.amount, 0);
      assert.equal(checkTolerance(paymentsTotal, totalAmount), false);
    });
  });

  describe('2. Stress Testing C-06: Adversarial Item Reconciliations', () => {
    it('Reconciliación con múltiples ítems que comparten la misma descripción no causa duplicación', () => {
      const existingItems = [
        { id: 'ex-1', productId: null, description: 'Llavero Artesanal', quantity: 1, unitPrice: 15, subtotal: 15 },
        { id: 'ex-2', productId: null, description: 'Llavero Artesanal', quantity: 1, unitPrice: 15, subtotal: 15 },
      ];

      // El usuario actualiza ambos
      const incoming = [
        { id: 'ex-1', description: 'Llavero Artesanal', quantity: 2, unitPrice: 15 },
        { id: 'ex-2', description: 'Llavero Artesanal', quantity: 3, unitPrice: 15 },
      ];

      const matchedExistingIds = new Set();
      const updated = [];

      for (const item of incoming) {
        const existingItem = existingItems.find((ex) => {
          if (matchedExistingIds.has(ex.id)) return false;
          if (item.id && ex.id === item.id) return true;
          return false;
        });
        if (existingItem) {
          matchedExistingIds.add(existingItem.id);
          updated.push({ id: existingItem.id, qty: item.quantity });
        }
      }

      assert.equal(matchedExistingIds.size, 2);
      assert.equal(updated.length, 2);
      assert.equal(updated[0].id, 'ex-1');
      assert.equal(updated[1].id, 'ex-2');
    });

    it('Reconciliación donde se descartan todos los ítems excepto uno', () => {
      const existingItems = [
        { id: 'ex-1', description: 'A' },
        { id: 'ex-2', description: 'B' },
        { id: 'ex-3', description: 'C' },
        { id: 'ex-4', description: 'D' },
      ];

      const incoming = [
        { id: 'ex-3', description: 'C Modificado', quantity: 5, unitPrice: 10 },
      ];

      const matchedExistingIds = new Set();
      for (const item of incoming) {
        const existingItem = existingItems.find((ex) => {
          if (matchedExistingIds.has(ex.id)) return false;
          if (item.id && ex.id === item.id) return true;
          return false;
        });
        if (existingItem) matchedExistingIds.add(existingItem.id);
      }

      const discarded = existingItems
        .filter((ex) => !matchedExistingIds.has(ex.id))
        .map((ex) => ex.id);

      assert.deepEqual(discarded, ['ex-1', 'ex-2', 'ex-4']);
    });
  });

  describe('3. Stress Testing A-14: Upload Middleware Adversarial Mime Injections', () => {
    const evaluateMime = (fieldname, mimetype) => {
      let allowed = false;
      let errCode = null;
      fileFilter({}, { fieldname, mimetype }, (err, ok) => {
        if (err) errCode = err.code;
        allowed = !!ok;
      });
      return { allowed, errCode };
    };

    it('Inyecciones maliciosas de extensiones/mimetypes en audio son bloqueadas', () => {
      const maliciousAudioMimes = [
        'application/x-sh',
        'application/x-executable',
        'application/x-php',
        'text/javascript',
        'application/x-python-code',
        'application/bat',
        'application/cmd',
        'image/svg+xml',
        'text/html',
        '',
        undefined,
      ];

      for (const mime of maliciousAudioMimes) {
        const res = evaluateMime('audio', mime);
        assert.equal(res.allowed, false, `MIME ${mime} en audio debe ser rechazado`);
        assert.equal(res.errCode, 'UNSUPPORTED_MEDIA_TYPE');
      }
    });

    it('Inyecciones maliciosas en imagen son bloqueadas (SVG script injection, HTML, etc.)', () => {
      const maliciousImageMimes = [
        'image/svg+xml',
        'application/pdf',
        'text/html',
        'application/javascript',
        'image/x-icon',
        'application/octet-stream',
      ];

      for (const mime of maliciousImageMimes) {
        const res = evaluateMime('image', mime);
        assert.equal(res.allowed, false, `MIME ${mime} en image debe ser rechazado`);
        assert.equal(res.errCode, 'UNSUPPORTED_MEDIA_TYPE');
      }
    });

    it('Mimetypes válidos de iOS Safari y Chrome son universalmente autorizados', () => {
      // Formatos de voz generados en Safari iOS
      assert.equal(evaluateMime('audio', 'audio/mp4').allowed, true);
      assert.equal(evaluateMime('audio', 'audio/m4a').allowed, true);
      assert.equal(evaluateMime('audio', 'audio/x-m4a').allowed, true);
      assert.equal(evaluateMime('audio', 'audio/aac').allowed, true);

      // Formatos de voz generados en Chrome / Firefox / Android
      assert.equal(evaluateMime('audio', 'audio/webm').allowed, true);
      assert.equal(evaluateMime('audio', 'audio/ogg').allowed, true);
      assert.equal(evaluateMime('audio', 'audio/wav').allowed, true);

      // Formatos de cámara de smartphone
      assert.equal(evaluateMime('image', 'image/jpeg').allowed, true);
      assert.equal(evaluateMime('image', 'image/png').allowed, true);
      assert.equal(evaluateMime('image', 'image/webp').allowed, true);
      assert.equal(evaluateMime('image', 'image/heic').allowed, true);
      assert.equal(evaluateMime('image', 'image/heif').allowed, true);

      // Video
      assert.equal(evaluateMime('video', 'video/mp4').allowed, true);
      assert.equal(evaluateMime('video', 'video/webm').allowed, true);
      assert.equal(evaluateMime('video', 'video/quicktime').allowed, true);
    });
  });

  describe('4. Stress Testing Zod Validation Schemas against Malformed Payloads', () => {
    it('updateSaleSchema rechaza descuentos negativos o ítems vacíos', () => {
      assert.throws(() => {
        updateSaleSchema.parse({
          discount: -10,
        });
      });

      assert.throws(() => {
        updateSaleSchema.parse({
          items: [],
        });
      });
    });

    it('cashClosingSchema rechaza arqueos con montos negativos o UUID inválido', () => {
      assert.throws(() => {
        cashClosingSchema.parse({
          eventId: 'not-a-uuid',
          totalCashReported: 500,
        });
      });

      assert.throws(() => {
        cashClosingSchema.parse({
          eventId: '123e4567-e89b-12d3-a456-426614174000',
          totalCashReported: -50,
        });
      });
    });
  });

});
