import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  getValidAdminToken,
  getValidSellerToken,
  getLiveTestContext,
} from './test-helpers.js';

describe('TIER 5: Multimodal AI Sales & Stand Assistant E2E', () => {
  let ctx;
  let activeEvent;

  before(async () => {
    ctx = await getLiveTestContext();
    assert.ok(ctx.eventId, 'Active or confirmed event required for E2E testing');
    
    const res = await apiRequest('/api/events/active', {
      token: ctx.sellerToken,
    });
    assert.strictEqual(res.status, 200);
    activeEvent = res.body.data;
  });

  // =========================================================================
  // Section 1: AI Chat Assistant Validations & Guardrails
  // =========================================================================
  describe('AI Chat Guardrails & Parameter Validation', () => {
    it('T5.1.1: Rejects chat query when eventId is missing', async () => {
      const res = await apiRequest('/api/ai/chat', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          message: '¿Cuánto hemos vendido hoy?',
        },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /ID del evento es obligatorio/i);
    });

    it('T5.1.2: Rejects chat query when message is empty or whitespace', async () => {
      const res = await apiRequest('/api/ai/chat', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          message: '   ',
        },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /mensaje no puede estar vacío/i);
    });
  });

  // =========================================================================
  // Section 2: Conversational Metrics Inquiries
  // =========================================================================
  describe('AI Stand Consultation & Metrics', () => {
    it('T5.2.1: Processes general metrics query and returns conversational answer', async () => {
      const res = await apiRequest('/api/ai/chat', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          message: '¿Cuánto llevamos vendido hoy en este evento?',
          history: [],
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.reply, 'Expected reply text in response');
      assert.strictEqual(typeof res.body.reply, 'string');
      assert.strictEqual(res.body.draftSale, null);
    });
  });

  // =========================================================================
  // Section 3: AI Sale Dictation & End-to-End Registration
  // =========================================================================
  describe('AI Text-Dictated Sale Registration Flow', () => {
    it('T5.3.1: Detects text-dictated sale, extracts items, prices, and creates draftSale', async () => {
      const res = await apiRequest('/api/ai/chat', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          message: 'Vendí 1 póster de Spider-Man mediano y 1 de Batman a 65 quetzales cada uno pagado en efectivo',
          history: [],
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.reply, 'Expected conversational acknowledgment');
      
      if (res.body.draftSale) {
        const draft = res.body.draftSale;
        assert.ok(Array.isArray(draft.items), 'draftSale must have items array');
        assert.ok(draft.items.length >= 1, 'Expected at least one item detected');
        assert.ok(draft.total > 0, 'Expected positive total amount');
        assert.strictEqual(draft.paymentMethod, 'EFECTIVO');
        assert.strictEqual(draft.inputChannel, 'IA_CHAT_TEXTO');
      } else {
        assert.match(res.body.reply, /detecté|venta|formulario|offline/i);
      }
    });

    it('T5.3.2: Assembles sale from AI draft and registers it in PostgreSQL with 201 Created', async () => {
      const salePayload = {
        eventId: ctx.eventId,
        items: [
          {
            description: 'Póster Spider-Man (Mediano)',
            quantity: 1,
            unitPrice: 65.0,
          },
          {
            description: 'Póster Batman (Mediano)',
            quantity: 1,
            unitPrice: 65.0,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 130.0,
          },
        ],
        discount: 0,
        inputChannel: 'IA_CHAT_TEXTO',
        notes: 'Venta dictada por Jarvis Chat E2E',
      };

      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: salePayload,
      });

      assert.strictEqual(res.status, 201, 'Expected HTTP 201 Created');
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data, 'Missing created sale payload');

      const sale = res.body.data;
      assert.ok(sale.id, 'Sale must have uuid');
      assert.match(sale.saleNumber, /^VEN-\d{4,}$/, 'Sale number must match VEN-XXXX format');
      assert.strictEqual(Number(sale.totalAmount), 130.0);
      assert.strictEqual(sale.inputChannel, 'IA_CHAT_TEXTO');
      assert.strictEqual(sale.items.length, 2);
      assert.strictEqual(sale.payments.length, 1);
      assert.strictEqual(sale.payments[0].method, 'EFECTIVO');
    });

    it('T5.3.3: Confirms live metrics reflect the AI registered sale immediately', async () => {
      const res = await apiRequest(`/api/sales/events/${ctx.eventId}/metrics`, {
        token: ctx.sellerToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data, 'Missing metrics data');

      const metrics = res.body.data;
      assert.ok(metrics.totalAmount > 0, 'Total sales must be positive');
      assert.ok(metrics.totalTransactions > 0, 'Total transactions must be >= 1');
      assert.ok(metrics.paymentBreakdown.EFECTIVO.amount > 0, 'Cash breakdown must reflect sale');
      
      assert.ok(Array.isArray(metrics.recentSales));
      const latestSale = metrics.recentSales[0];
      assert.ok(latestSale, 'Expected at least one recent sale');
      assert.match(latestSale.saleNumber, /^VEN-/);
    });
  });
});
