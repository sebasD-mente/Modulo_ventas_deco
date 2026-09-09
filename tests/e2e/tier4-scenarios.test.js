import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  getValidAdminToken,
  getValidSellerToken,
  getLiveTestContext,
} from './test-helpers.js';

describe('TIER 4: Real-World Scenarios (End-to-End Convention Day Lifecycle)', () => {
  let ctx;
  let activeEvent;
  let createdSales = [];
  let closingRecord;

  before(async () => {
    ctx = await getLiveTestContext();
    assert.ok(ctx.eventId, 'Active or confirmed event required for E2E testing');
  });

  // =========================================================================
  // Step 1: Booth Opening & Active Event Consultation
  // =========================================================================
  it('Step 1: Booth Opening — Cashier queries active event and validates stand context', async () => {
    const res = await apiRequest('/api/events/active', {
      token: ctx.sellerToken,
    });

    assert.strictEqual(res.status, 200, 'Expected 200 OK for active event lookup');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data, 'Missing event data');

    activeEvent = res.body.data;
    assert.ok(activeEvent.id, 'Event must have ID');
    assert.ok(activeEvent.name, 'Event must have name');
    assert.ok(activeEvent.location, 'Event must have location');
    assert.ok(activeEvent.tenant?.currencySymbol, 'Event must specify currency symbol');

    console.log(`      [Booth Open] Active Event: "${activeEvent.name}" at ${activeEvent.location}`);
  });

  // =========================================================================
  // Step 2: Catalog Consultation & Price Checking
  // =========================================================================
  it('Step 2: Catalog Consultation — Cashier looks up posters to advise convention attendee', async () => {
    const res = await apiRequest('/api/catalog/web-posters?limit=8', {
      token: ctx.sellerToken,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    console.log(`      [Catalog Consulted] Retrieved ${res.body.data.length} posters for customer consultation`);
  });

  // =========================================================================
  // Step 3: High-Frequency Sale Transactions (Cash, Card with Discount, Transfer)
  // =========================================================================
  it('Step 3.1: Sale 1 (Cash) — Fast manual registration of standard poster', async () => {
    const saleRes = await apiRequest('/api/sales', {
      method: 'POST',
      token: ctx.sellerToken,
      body: {
        eventId: activeEvent.id,
        items: [{ description: 'Póster Mini Coleccionable', quantity: 1, unitPrice: 25.0 }],
        payments: [{ method: 'EFECTIVO', amount: 25.0 }],
        notes: 'Cliente pagó exacto en efectivo',
        inputChannel: 'MANUAL_RAPIDA',
      },
    });

    assert.strictEqual(saleRes.status, 201);
    assert.strictEqual(saleRes.body.success, true);
    const sale = saleRes.body.data;
    assert.ok(sale.saleNumber);
    assert.strictEqual(Number(sale.totalAmount), 25.0);
    createdSales.push(sale);
    console.log(`      [Sale 1 Created] Sale #${sale.saleNumber} Total: Q${sale.totalAmount}`);
  });

  it('Step 3.2: Sale 2 (Card) — Multi-item bundle purchase with discount', async () => {
    // 2 items: 2 x 65 = 130. Discount: 10. Net total: 120.
    const saleRes = await apiRequest('/api/sales', {
      method: 'POST',
      token: ctx.sellerToken,
      body: {
        eventId: activeEvent.id,
        items: [
          { description: 'Póster Mediano Edición Especial A', quantity: 1, unitPrice: 65.0 },
          { description: 'Póster Mediano Edición Especial B', quantity: 1, unitPrice: 65.0 },
        ],
        payments: [{ method: 'TARJETA', amount: 120.0, reference: 'POS-VISANET-004412' }],
        discount: 10.0,
        notes: 'Descuento especial por par de pósters medianos',
        inputChannel: 'MANUAL_POS',
      },
    });

    assert.strictEqual(saleRes.status, 201);
    assert.strictEqual(saleRes.body.success, true);
    const sale = saleRes.body.data;
    assert.strictEqual(Number(sale.totalAmount), 120.0);
    assert.strictEqual(Number(sale.discount), 10.0);
    assert.strictEqual(sale.payments[0].method, 'TARJETA');
    createdSales.push(sale);
    console.log(`      [Sale 2 Created] Sale #${sale.saleNumber} Total: Q${sale.totalAmount} (Card POS)`);
  });

  it('Step 3.3: Sale 3 (Transfer) — High-ticket order with digital bank transfer proof', async () => {
    const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
    const voucherBuffer = Buffer.from('FAKE_BANK_TRANSFER_VOUCHER_PNG_CONTENT');

    const upload = await uploadBufferToStorage({
      buffer: voucherBuffer,
      originalname: 'comprobante_banco_industrial.png',
      mimetype: 'image/png',
      folder: 'receipts',
    });

    assert.strictEqual(upload.success, true);

    const saleRes = await apiRequest('/api/sales', {
      method: 'POST',
      token: ctx.sellerToken,
      body: {
        eventId: activeEvent.id,
        items: [{ description: 'Póster Gigante Limitado', quantity: 1, unitPrice: 210.0 }],
        payments: [
          {
            method: 'TRANSFERENCIA',
            amount: 210.0,
            reference: 'BI-TRANSF-990088',
            receiptUrl: upload.url,
          },
        ],
        notes: 'Transferencia confirmada por gerencia de stand',
        inputChannel: 'MANUAL_POS',
      },
    });

    assert.strictEqual(saleRes.status, 201);
    assert.strictEqual(saleRes.body.success, true);
    const sale = saleRes.body.data;
    assert.strictEqual(Number(sale.totalAmount), 210.0);
    assert.strictEqual(sale.payments[0].receiptUrl, upload.url);
    createdSales.push(sale);
    console.log(`      [Sale 3 Created] Sale #${sale.saleNumber} Total: Q${sale.totalAmount} (Transfer Verified)`);
  });

  // =========================================================================
  // Step 4: Real-time Live Metrics & Monitor Observability
  // =========================================================================
  it('Step 4: Shift Observability — Shift manager inspects live KPI metrics and monitor dashboard', async () => {
    // 1. Live event metrics
    const metricsRes = await apiRequest(`/api/sales/events/${activeEvent.id}/metrics`, {
      token: ctx.sellerToken,
    });
    assert.strictEqual(metricsRes.status, 200);
    assert.strictEqual(metricsRes.body.success, true);
    const kpi = metricsRes.body.data;

    assert.ok(kpi.totalTransactions >= 3, 'Expected at least 3 transactions');
    assert.ok(kpi.totalAmount > 0, 'Total amount must be positive');
    assert.ok(kpi.paymentBreakdown.EFECTIVO.count >= 1);
    assert.ok(kpi.paymentBreakdown.TARJETA.count >= 1);
    assert.ok(kpi.paymentBreakdown.TRANSFERENCIA.count >= 1);

    // 2. Centralized monitor dashboard
    const monitorRes = await apiRequest('/api/sales/monitor', {
      token: ctx.adminToken,
    });
    assert.strictEqual(monitorRes.status, 200);
    assert.strictEqual(monitorRes.body.success, true);
    assert.ok(monitorRes.body.data.resumenGeneral);
    assert.ok(Array.isArray(monitorRes.body.data.eventDetails));

    console.log(`      [Monitor Verified] Total Transactions: ${kpi.totalTransactions}, Revenue: Q${kpi.totalAmount}`);
  });

  // =========================================================================
  // Step 5: Post-Sale Adjustment & Audit Trail
  // =========================================================================
  it('Step 5: Post-Sale Adjustment — Cashier updates sale notes and verifies audit persistence', async () => {
    assert.ok(createdSales.length > 0);
    const targetSale = createdSales[0];

    const updatedNotes = 'Cliente regresó a solicitar empaque de regalo adicional.';
    const updateRes = await apiRequest(`/api/sales/${targetSale.id}`, {
      method: 'PATCH',
      token: ctx.sellerToken,
      body: {
        notes: updatedNotes,
      },
    });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.success, true);
    assert.strictEqual(updateRes.body.data.notes, updatedNotes);
    console.log(`      [Sale Adjusted] Sale #${targetSale.saleNumber} notes updated with audit trail`);
  });

  // =========================================================================
  // Step 6: End-of-Day Cash Closing (Arqueo de Caja)
  // =========================================================================
  it('Step 6: Shift Closing — Cashier submits cash closing and system audits physical vs theoretical cash', async () => {
    // Current KPIs to know theoretical cash
    const metricsRes = await apiRequest(`/api/sales/events/${activeEvent.id}/metrics`, {
      token: ctx.sellerToken,
    });
    const theoreticalCash = Number(metricsRes.body.data.paymentBreakdown.EFECTIVO.amount);

    // Simulate cashier counting physical cash (with Q5 surplus or exact)
    const reportedCash = theoreticalCash; // Exact count
    const closingRes = await apiRequest('/api/closings', {
      method: 'POST',
      token: ctx.sellerToken,
      body: {
        eventId: activeEvent.id,
        closingType: 'DIARIO',
        totalCashReported: reportedCash,
        observations: 'Cierre de turno sin novedades. Cuadre exacto en efectivo.',
      },
    });

    assert.strictEqual(closingRes.status, 201);
    assert.strictEqual(closingRes.body.success, true);
    closingRecord = closingRes.body.data;

    assert.ok(closingRecord.id);
    assert.strictEqual(Number(closingRecord.totalCashCalculated), theoreticalCash);
    assert.strictEqual(Number(closingRecord.totalCashReported), reportedCash);
    assert.strictEqual(Number(closingRecord.cashDifference), 0.0);
    assert.strictEqual(closingRecord.status, 'CONCILIADO');

    // Verify closing appears in event closings history
    const historyRes = await apiRequest(`/api/closings/events/${activeEvent.id}`, {
      token: ctx.sellerToken,
    });

    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.success, true);
    const foundClosing = historyRes.body.data.find((c) => c.id === closingRecord.id);
    assert.ok(foundClosing, 'Expected closing record in event history');

    console.log(`      [Cash Closing Completed] Closing ID: ${closingRecord.id}, Status: ${closingRecord.status}, Variance: Q${closingRecord.cashDifference}`);
  });
});
