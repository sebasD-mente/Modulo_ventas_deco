import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  getValidSellerToken,
  getLiveTestContext,
} from './test-helpers.js';

describe('TIER 3: Cross-Feature Combinations (Integration Pipelines)', () => {
  let ctx;

  before(async () => {
    ctx = await getLiveTestContext();
    assert.ok(ctx.eventId, 'Active or confirmed event required for E2E testing');
  });

  // =========================================================================
  // Pipeline 1: Auth + Active Event + Sales Creation + Sales History
  // =========================================================================
  describe('3.1 Auth + Active Event + Sales Creation + History Pipeline', () => {
    it('T3.1.1: Authenticates seller -> fetches active event -> posts sale -> verifies in event sales history', async () => {
      // 1. Seller queries active event
      const activeEventRes = await apiRequest('/api/events/active', {
        token: ctx.sellerToken,
      });
      assert.strictEqual(activeEventRes.status, 200);
      assert.strictEqual(activeEventRes.body.success, true);
      const event = activeEventRes.body.data;
      assert.ok(event.id);

      // 2. Seller creates sale on that active event
      const saleAmount = 45.0;
      const saleRes = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: event.id,
          items: [{ description: 'Póster Integración Pipeline 1', quantity: 1, unitPrice: saleAmount }],
          payments: [{ method: 'EFECTIVO', amount: saleAmount }],
          notes: 'Pipeline 1: Auth + Event + Sale',
          inputChannel: 'MANUAL_POS',
        },
      });

      assert.strictEqual(saleRes.status, 201);
      assert.strictEqual(saleRes.body.success, true);
      const createdSale = saleRes.body.data;
      assert.ok(createdSale.id);
      assert.strictEqual(createdSale.eventId, event.id);
      assert.strictEqual(createdSale.tenantId, ctx.tenantId);

      // 3. Verify newly created sale appears in event sales list
      const listRes = await apiRequest(`/api/sales/events/${event.id}`, {
        token: ctx.sellerToken,
      });

      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.success, true);
      assert.ok(Array.isArray(listRes.body.data));

      const found = listRes.body.data.find((s) => s.id === createdSale.id);
      assert.ok(found, `Expected created sale ${createdSale.id} in event sales list`);
      assert.strictEqual(Number(found.totalAmount), saleAmount);
    });
  });

  // =========================================================================
  // Pipeline 2: Catalog Sync & Web Poster Search -> POS Item Selection
  // =========================================================================
  describe('3.2 Web Catalog Search -> POS Sale Item Pipeline', () => {
    it('T3.2.1: Searches web posters -> selects product size variant -> creates POS sale with catalog metadata', async () => {
      // 1. Search web posters
      const searchRes = await apiRequest('/api/catalog/web-posters?limit=5', {
        token: ctx.sellerToken,
      });
      assert.strictEqual(searchRes.status, 200);
      assert.strictEqual(searchRes.body.success, true);

      let poster = null;
      let selectedSize = null;
      if (searchRes.body.data.length > 0) {
        poster = searchRes.body.data[0];
        selectedSize = poster.sizes?.[0] || { nombre: 'Estándar', precio: poster.precioMinimo || 25 };
      } else {
        // Fallback item definition if web catalog table is empty
        poster = { titulo: 'Póster Clásico Retro' };
        selectedSize = { nombre: 'Mediano', precio: 50 };
      }

      const itemDescription = `${poster.titulo} (${selectedSize.nombre || 'Standard'})`;
      const itemPrice = Number(selectedSize.precio || 25);

      // 2. Create POS sale using selected poster variant
      const saleRes = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [
            {
              description: itemDescription,
              quantity: 1,
              unitPrice: itemPrice,
            },
          ],
          payments: [
            {
              method: 'EFECTIVO',
              amount: itemPrice,
            },
          ],
          notes: 'Pipeline 2: Venta originada desde catálogo web',
        },
      });

      assert.strictEqual(saleRes.status, 201);
      assert.strictEqual(saleRes.body.success, true);
      assert.strictEqual(Number(saleRes.body.data.totalAmount), itemPrice);
      assert.strictEqual(saleRes.body.data.items[0].description, itemDescription);
    });
  });

  // =========================================================================
  // Pipeline 3: Storage Upload + Sale Receipt Attachment
  // =========================================================================
  describe('3.3 Storage Upload -> Sale Receipt Attachment Pipeline', () => {
    it('T3.3.1: Uploads transfer voucher buffer -> captures media URL -> links receiptUrl in sale payment', async () => {
      // 1. Upload mock payment receipt voucher
      const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
      const fakeVoucherPng = Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRTEST_VOUCHER_IMAGE_BYTES');

      const uploadResult = await uploadBufferToStorage({
        buffer: fakeVoucherPng,
        originalname: 'comprobante_banco_gt.png',
        mimetype: 'image/png',
        folder: 'receipts',
      });

      assert.strictEqual(uploadResult.success, true);
      assert.ok(uploadResult.url, 'Upload must yield a media URL');

      // 2. Create sale with TRANSFERENCIA payment referencing the receipt URL
      const transferAmount = 85.0;
      const saleRes = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Póster Enmarcado Premium', quantity: 1, unitPrice: transferAmount }],
          payments: [
            {
              method: 'TRANSFERENCIA',
              amount: transferAmount,
              reference: 'BI-ENLACE-12345678',
              receiptUrl: uploadResult.url,
            },
          ],
          notes: 'Pipeline 3: Pago vía transferencia verificado con comprobante GCS',
        },
      });

      assert.strictEqual(saleRes.status, 201);
      assert.strictEqual(saleRes.body.success, true);

      const createdPayment = saleRes.body.data.payments.find((p) => p.method === 'TRANSFERENCIA');
      assert.ok(createdPayment, 'Expected payment with TRANSFERENCIA method');
      assert.strictEqual(createdPayment.reference, 'BI-ENLACE-12345678');
      assert.strictEqual(createdPayment.receiptUrl, uploadResult.url);
    });
  });

  // =========================================================================
  // Pipeline 4: Sale Transaction -> Live KPI Metric Aggregation
  // =========================================================================
  describe('3.4 Sale Transaction -> Live KPI Aggregation Pipeline', () => {
    it('T3.4.1: Reads baseline KPIs -> records sale -> verifies exact transaction count and total increment', async () => {
      // 1. Fetch initial KPIs for event
      const initialKpiRes = await apiRequest(`/api/sales/events/${ctx.eventId}/metrics`, {
        token: ctx.sellerToken,
      });
      assert.strictEqual(initialKpiRes.status, 200);
      assert.strictEqual(initialKpiRes.body.success, true);

      const baselineKpi = initialKpiRes.body.data;
      const initialCount = Number(baselineKpi.totalTransactions || 0);
      const initialTotal = Number(baselineKpi.totalAmount || 0);
      const initialCashAmount = Number(baselineKpi.paymentBreakdown?.EFECTIVO?.amount || 0);

      // 2. Execute new cash sale
      const deltaAmount = 75.0;
      const saleRes = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Póster para Test de KPIs', quantity: 1, unitPrice: deltaAmount }],
          payments: [{ method: 'EFECTIVO', amount: deltaAmount }],
          notes: 'Pipeline 4: Medición de impacto en KPIs',
        },
      });
      assert.strictEqual(saleRes.status, 201);

      // 3. Re-fetch KPIs and verify mathematical increment
      const updatedKpiRes = await apiRequest(`/api/sales/events/${ctx.eventId}/metrics`, {
        token: ctx.sellerToken,
      });
      assert.strictEqual(updatedKpiRes.status, 200);
      const updatedKpi = updatedKpiRes.body.data;

      assert.strictEqual(
        Number(updatedKpi.totalTransactions),
        initialCount + 1,
        'totalTransactions must increment by exactly 1'
      );
      assert.strictEqual(
        Number(updatedKpi.totalAmount),
        Number((initialTotal + deltaAmount).toFixed(2)),
        `totalAmount must increment by exactly ${deltaAmount}`
      );
      assert.strictEqual(
        Number(updatedKpi.paymentBreakdown?.EFECTIVO?.amount),
        Number((initialCashAmount + deltaAmount).toFixed(2)),
        `Cash breakdown must increment by exactly ${deltaAmount}`
      );
    });
  });

  // =========================================================================
  // Pipeline 5: Multi-Tender Split Payment Validation & Reconciliation
  // =========================================================================
  describe('3.5 Split Payment (Multi-Tender) Pipeline', () => {
    it('T3.5.1: Records sale with multi-tender payment (Cash + Card) and verifies payment breakdown integrity', async () => {
      const cashPart = 40.0;
      const cardPart = 60.0;
      const grandTotal = cashPart + cardPart; // 100.0

      const saleRes = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [
            { description: 'Póster Colección A', quantity: 1, unitPrice: 60.0 },
            { description: 'Póster Colección B', quantity: 1, unitPrice: 40.0 },
          ],
          payments: [
            { method: 'EFECTIVO', amount: cashPart },
            { method: 'TARJETA', amount: cardPart, reference: 'BAC-SPLIT-9922' },
          ],
          notes: 'Pipeline 5: Pago mixto dividido en caja',
        },
      });

      assert.strictEqual(saleRes.status, 201);
      assert.strictEqual(saleRes.body.success, true);
      const sale = saleRes.body.data;

      assert.strictEqual(Number(sale.totalAmount), grandTotal);
      assert.strictEqual(sale.payments.length, 2, 'Expected 2 payment records');

      const cashPayment = sale.payments.find((p) => p.method === 'EFECTIVO');
      const cardPayment = sale.payments.find((p) => p.method === 'TARJETA');

      assert.ok(cashPayment, 'Missing cash payment tender');
      assert.ok(cardPayment, 'Missing card payment tender');
      assert.strictEqual(Number(cashPayment.amount), cashPart);
      assert.strictEqual(Number(cardPayment.amount), cardPart);
      assert.strictEqual(cardPayment.reference, 'BAC-SPLIT-9922');

      const calculatedSum = Number(cashPayment.amount) + Number(cardPayment.amount);
      assert.strictEqual(calculatedSum, grandTotal, 'Sum of payments must equal sale total');
    });
  });
});
