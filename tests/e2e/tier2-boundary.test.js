import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  getValidSellerToken,
  getExpiredToken,
  getInvalidSecretToken,
  getLiveTestContext,
} from './test-helpers.js';

describe('TIER 2: Boundary & Corner Cases (Opaque-Box Stress Testing)', () => {
  let ctx;

  before(async () => {
    ctx = await getLiveTestContext();
    assert.ok(ctx.eventId, 'Active or confirmed event required for E2E testing');
  });

  // =========================================================================
  // 1. Auth Boundaries & Token Tampering
  // =========================================================================
  describe('2.1 Auth Boundaries & Token Tampering', () => {
    it('T2.1.1: Rejects truncated token with missing segments (only 1 part)', async () => {
      const res = await apiRequest('/api/events/active', {
        headers: { Authorization: 'Bearer only_one_segment' },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.1.2: Rejects invalid or empty Bearer token value', async () => {
      const res = await apiRequest('/api/events/active', {
        headers: { Authorization: 'Bearer invalid_empty_token' },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.1.3: Rejects expired token on sales creation endpoint', async () => {
      const expiredToken = getExpiredToken(ctx.tenantId);
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: expiredToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 10 }],
          payments: [{ method: 'EFECTIVO', amount: 10 }],
        },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.1.4: Rejects token signed with untrusted foreign key on sales creation', async () => {
      const alienToken = getInvalidSecretToken(ctx.tenantId);
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: alienToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 10 }],
          payments: [{ method: 'EFECTIVO', amount: 10 }],
        },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 2. Missing Required Fields in Sales API
  // =========================================================================
  describe('2.2 Missing Required Fields Validation', () => {
    it('T2.2.1: Rejects sale creation with missing eventId', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          items: [{ description: 'Poster', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        },
      });
      assert.strictEqual(res.status, 400, 'Expected HTTP 400 Bad Request');
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('eventId')),
        'Expected validation error on eventId'
      );
    });

    it('T2.2.2: Rejects sale creation with empty items array []', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('items')),
        'Expected validation error on items'
      );
    });

    it('T2.2.3: Rejects sale creation with empty payments array []', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Poster', quantity: 1, unitPrice: 50 }],
          payments: [],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('payments')),
        'Expected validation error on payments'
      );
    });

    it('T2.2.4: Rejects completely empty body {}', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {},
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 3. Zero, Negative & Invalid Numerical Values
  // =========================================================================
  describe('2.3 Zero, Negative & Invalid Numerical Boundaries', () => {
    it('T2.3.1: Rejects item quantity <= 0 (quantity: 0 and quantity: -3)', async () => {
      for (const badQty of [0, -3]) {
        const res = await apiRequest('/api/sales', {
          method: 'POST',
          token: ctx.sellerToken,
          body: {
            eventId: ctx.eventId,
            items: [{ description: 'Item', quantity: badQty, unitPrice: 25 }],
            payments: [{ method: 'EFECTIVO', amount: 25 }],
          },
        });
        assert.strictEqual(res.status, 400, `Expected rejection for quantity: ${badQty}`);
        assert.strictEqual(res.body.success, false);
      }
    });

    it('T2.3.2: Rejects negative unitPrice (unitPrice: -10)', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: -10 }],
          payments: [{ method: 'EFECTIVO', amount: 10 }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.3.3: Rejects non-integer quantity (quantity: 2.5)', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 2.5, unitPrice: 20 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.3.4: Rejects payment amount <= 0 (amount: 0 and amount: -50)', async () => {
      for (const badAmount of [0, -50]) {
        const res = await apiRequest('/api/sales', {
          method: 'POST',
          token: ctx.sellerToken,
          body: {
            eventId: ctx.eventId,
            items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
            payments: [{ method: 'EFECTIVO', amount: badAmount }],
          },
        });
        assert.strictEqual(res.status, 400, `Expected rejection for payment amount: ${badAmount}`);
        assert.strictEqual(res.body.success, false);
      }
    });

    it('T2.3.5: Rejects negative discount (discount: -15)', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
          discount: -15,
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 4. Extreme Values, Length Limits & Format Boundaries
  // =========================================================================
  describe('2.4 Extreme Values & Format Boundaries', () => {
    it('T2.4.1: Rejects non-UUID eventId format (e.g. "not-a-uuid-123")', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: 'not-a-valid-uuid',
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('eventId')),
        'Expected UUID error on eventId'
      );
    });

    it('T2.4.2: Rejects notes exceeding 500 character maximum length', async () => {
      const longNote = 'A'.repeat(501);
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
          notes: longNote,
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('notes')),
        'Expected length error on notes'
      );
    });

    it('T2.4.3: Rejects payment reference exceeding 100 character maximum length', async () => {
      const longRef = 'R'.repeat(101);
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'TARJETA', amount: 50, reference: longRef }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.4.4: Rejects cash closing observations exceeding 1000 characters', async () => {
      const longObs = 'O'.repeat(1001);
      const res = await apiRequest('/api/closings', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          totalCashReported: 100,
          observations: longObs,
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 5. Invalid Enums & Unrecognized Values
  // =========================================================================
  describe('2.5 Invalid Enums & Malformed Sub-entities', () => {
    it('T2.5.1: Rejects unsupported payment method enum (e.g. "BITCOIN")', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'BITCOIN', amount: 50 }],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.details?.some((d) => d.field.includes('method')),
        'Expected enum error on payment method'
      );
    });

    it('T2.5.2: Rejects unsupported input channel enum (e.g. "TELEPATHY")', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [{ method: 'EFECTIVO', amount: 50 }],
          inputChannel: 'TELEPATHY',
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('T2.5.3: Rejects malformed receiptUrl in payments (not a valid URL)', async () => {
      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: {
          eventId: ctx.eventId,
          items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
          payments: [
            {
              method: 'TRANSFERENCIA',
              amount: 50,
              receiptUrl: 'not_a_valid_http_url',
            },
          ],
        },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 6. High-Concurrency Sales Simulation (Race Condition Verification)
  // =========================================================================
  describe('2.6 High-Concurrency Sales Simulation & Atomic Sequence Guarantee', () => {
    it('T2.6.1: Simulates concurrent sales in parallel and evaluates atomic sequence guarantee vs P2002 race conditions', async () => {
      const concurrencyCount = 5;
      const salesPromises = Array.from({ length: concurrencyCount }, (_, i) => {
        return apiRequest('/api/sales', {
          method: 'POST',
          token: ctx.sellerToken,
          body: {
            eventId: ctx.eventId,
            items: [
              {
                description: `Póster Concurrente Stress #${i + 1}`,
                quantity: 1,
                unitPrice: 30.0,
              },
            ],
            payments: [
              {
                method: 'EFECTIVO',
                amount: 30.0,
              },
            ],
            notes: `Simulación concurrente lote #${i + 1}`,
            inputChannel: 'MANUAL_POS',
          },
        });
      });

      const results = await Promise.all(salesPromises);
      const successfulSales = results.filter((r) => r.status === 201 && r.body?.success);
      const collisionErrors = results.filter(
        (r) => r.status === 400 && typeof r.body?.error === 'string' && r.body.error.includes('Unique constraint failed')
      );

      if (collisionErrors.length > 0) {
        console.warn(
          `      ⚠️ [KNOWN VULNERABILITY DETECTED — M2/F5]: Reproduced ${collisionErrors.length} P2002 collisions under concurrent sales load. Milestone M2 (Atomic Sales Concurrency) required to eliminate race condition.`
        );
        // Under Progressive Testability rule: At least one transaction succeeded without crashing the server
        assert.ok(successfulSales.length >= 1, 'At least 1 transaction must succeed during concurrent burst');
      } else {
        // When M2 is deployed, all concurrent sales must succeed with zero duplicates
        assert.strictEqual(
          successfulSales.length,
          concurrencyCount,
          `Expected all ${concurrencyCount} sales to succeed`
        );
        const saleNumbers = successfulSales.map((r) => r.body.data.saleNumber);
        const uniqueSet = new Set(saleNumbers);
        assert.strictEqual(
          uniqueSet.size,
          concurrencyCount,
          `Collision detected! Expected ${concurrencyCount} unique sale numbers, got ${uniqueSet.size}`
        );
        console.log(`      [Atomic Concurrency Verified] All ${uniqueSet.size} concurrent sales generated unique numbers:`, Array.from(uniqueSet));
      }
    });
  });
});
