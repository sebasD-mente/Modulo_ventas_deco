import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { prisma } from '../../server/config/prisma.js';
import { createSaleTransaction } from '../../server/services/sales/saleTransactionService.js';
import { createSale } from '../../server/controllers/saleController.js';
import { invalidateSequenceCache } from '../../server/services/sales/saleNumberGenerator.js';
import { createSaleSchema } from '../../server/validators/saleValidators.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMPIRICAL CHALLENGE HARNESS: Milestone 3 (R3 - RFC 7231 Idempotency & Race Recovery)
 * ═══════════════════════════════════════════════════════════════════════════════
 * High-fidelity PostgreSQL & Prisma concurrency simulator for empirical stress testing:
 * 1. Fast-Path Replay Stress: 50 sequential calls with identical key, < 5ms latency, 0 new sales.
 * 2. Concurrent Race Condition Simulation: 20 parallel async calls with identical key;
 *    exactly 1 winner (HTTP 201) and 19 P2002 recoveries (HTTP 200 { idempotentReplay: true }).
 * 3. Null Key Compatibility: Multiple sales with null/omitted key create independent sales without collision.
 * 4. Adversarial Attack Vectors: Payload tampering, malformed keys, header precedence.
 */

// Helper to simulate asynchronous microtask / network jitter
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomJitter = (minMs = 1, maxMs = 6) =>
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

// Helper to construct mock Express req/res objects
function createMockHttpExchange({
  body = {},
  headers = {},
  user = { id: 'seller-empirical-001', fullName: 'Tester', email: 'tester@deko.gt' },
  tenantId = 'tenant-deko-2026',
} = {}) {
  const req = {
    body,
    headers: { ...headers },
    user,
    tenantId,
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
}

/**
 * High-Fidelity In-Memory Database Engine
 * Emulates PostgreSQL table "sales", "events", unique constraint "sales_idempotencyKey_key",
 * DDL sequences with nextval(), and Prisma P2002 error propagation.
 */
class HighFidelityDbEngine {
  constructor() {
    this.sales = new Map(); // id -> sale
    this.salesByIdempotencyKey = new Map(); // idempotencyKey -> sale
    this.auditLogs = [];
    this.sequences = new Map(); // seqName -> BigInt
    this.txCallCount = 0;
    this.fastPathHitCount = 0;
    this.inTxCheckHitCount = 0;
    this.p2002Count = 0;
    this.saleCounter = 0;
    this.events = new Map([
      ['11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', name: 'Comic Con 2026' }],
      ['event-beta-2026', { id: 'event-beta-2026', name: 'Anime Fest' }],
    ]);
  }

  // Pre-transaction lookup (Fast-Path)
  async findUniqueSale({ where }) {
    if (where.idempotencyKey) {
      const existing = this.salesByIdempotencyKey.get(where.idempotencyKey);
      if (existing) {
        this.fastPathHitCount++;
        return JSON.parse(JSON.stringify(existing));
      }
      return null;
    }
    if (where.id) {
      const existing = this.sales.get(where.id);
      return existing ? JSON.parse(JSON.stringify(existing)) : null;
    }
    return null;
  }

  // Transaction runner
  async runTransaction(callback, options = {}) {
    this.txCallCount++;

    const txMock = {
      sale: {
        findUnique: async ({ where }) => {
          if (where.idempotencyKey) {
            const existing = this.salesByIdempotencyKey.get(where.idempotencyKey);
            if (existing) {
              this.inTxCheckHitCount++;
              return JSON.parse(JSON.stringify(existing));
            }
            return null;
          }
          return null;
        },
        create: async ({ data }) => {
          // Unique constraint check: in PostgreSQL, multiple NULLs are permitted
          if (data.idempotencyKey !== null && data.idempotencyKey !== undefined) {
            if (this.salesByIdempotencyKey.has(data.idempotencyKey)) {
              this.p2002Count++;
              const p2002Err = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
              p2002Err.code = 'P2002';
              p2002Err.meta = { target: ['sales_idempotencyKey_key'] };
              throw p2002Err;
            }
          }

          this.saleCounter++;
          const saleId = `sale-gen-${this.saleCounter}-${Date.now()}`;
          const newSale = {
            id: saleId,
            tenantId: data.tenantId,
            eventId: data.eventId,
            sellerId: data.sellerId,
            saleNumber: data.saleNumber,
            totalAmount: data.totalAmount,
            discount: data.discount || 0,
            notes: data.notes || null,
            inputChannel: data.inputChannel || 'MANUAL_POS',
            idempotencyKey: data.idempotencyKey || null,
            createdAt: new Date().toISOString(),
            items: (data.items?.create || []).map((it, idx) => ({
              id: `item-${this.saleCounter}-${idx}`,
              ...it,
            })),
            payments: (data.payments?.create || []).map((p, idx) => ({
              id: `pay-${this.saleCounter}-${idx}`,
              ...p,
            })),
            seller: {
              id: data.sellerId,
              fullName: 'Vendedor Empírico',
              email: 'vendedor@deko.gt',
            },
          };

          this.sales.set(saleId, newSale);
          if (data.idempotencyKey) {
            this.salesByIdempotencyKey.set(data.idempotencyKey, newSale);
          }
          return JSON.parse(JSON.stringify(newSale));
        },
      },
      auditLog: {
        create: async ({ data }) => {
          this.auditLogs.push({ ...data, id: `audit-${this.auditLogs.length + 1}` });
        },
      },
      event: {
        findUnique: async ({ where }) => {
          return this.events.get(where.id) || { name: 'STAND' };
        },
      },
      $executeRawUnsafe: async () => {},
      $queryRawUnsafe: async (sql) => {
        const nextvalMatch = sql.match(/SELECT nextval\('([^']+)'\) AS nextval/);
        if (nextvalMatch) {
          const seqName = nextvalMatch[1];
          const curr = (this.sequences.get(seqName) || 0n) + 1n;
          this.sequences.set(seqName, curr);
          return [{ nextval: curr }];
        }
        return [];
      },
    };

    return await callback(txMock);
  }
}

describe('⚔️ ADVERSARIAL CHALLENGER: Milestone 3 (R3: RFC 7231 Idempotency Stress & Race Recovery)', () => {
  let db;
  let originalFindUnique;
  let originalTransaction;

  beforeEach(() => {
    invalidateSequenceCache();
    db = new HighFidelityDbEngine();

    originalFindUnique = prisma.sale.findUnique;
    originalTransaction = prisma.$transaction;

    prisma.sale.findUnique = (args) => db.findUniqueSale(args);
    prisma.$transaction = (callback, opts) => db.runTransaction(callback, opts);
  });

  afterEach(() => {
    prisma.sale.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
    invalidateSequenceCache();
  });

  const baseSalePayload = {
    eventId: '11111111-1111-4111-8111-111111111111',
    items: [
      { description: 'Póster Spider-Man 2099', quantity: 1, unitPrice: 65.0 },
      { description: 'Póster Batman Dark Knight', quantity: 1, unitPrice: 65.0 },
    ],
    payments: [{ method: 'EFECTIVO', amount: 130.0 }],
    discount: 0,
    notes: 'Venta presencial mostrador Comic Con',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Fast-Path Replay Stress (50 Sequential Calls with Identical Key)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Fast-Path Replay Stress (50 Sequential Calls)', () => {
    it('1.1: 50 sequential replays return 100% HTTP 200 with { idempotentReplay: true }, 0 new sales, 0 sequence increments, and latency < 5ms', async () => {
      const targetIdempotencyKey = 'client-uuid-stress-replay-001';

      // 1. Initial creation via HTTP Controller
      const initialExchange = createMockHttpExchange({
        body: { ...baseSalePayload, idempotencyKey: targetIdempotencyKey },
        headers: { 'idempotency-key': targetIdempotencyKey },
      });

      const initialStart = performance.now();
      await createSale(initialExchange.req, initialExchange.res);
      const initialDuration = performance.now() - initialStart;

      assert.strictEqual(initialExchange.getStatusCode(), 201, 'Initial request must return HTTP 201 Created');
      const initialSale = initialExchange.getData().data;
      assert.ok(initialSale.id, 'Must return generated sale ID');
      assert.strictEqual(initialSale.saleNumber, 'COMI-0001', 'Initial sale must be COMI-0001');
      assert.strictEqual(initialExchange.getData().idempotentReplay, undefined, 'Initial request is not a replay');

      // Baseline assertions
      assert.strictEqual(db.sales.size, 1, 'Exactly 1 sale in DB before replay stress');
      assert.strictEqual(db.txCallCount, 1, 'Exactly 1 transaction executed for initial sale');
      assert.strictEqual(db.sequences.get('sale_seq_11111111_1111_4111_8111_111111111111'), 1n, 'Sequence count is 1');

      // 2. Execute 50 sequential replays
      const REPLAY_COUNT = 50;
      const latencies = [];

      for (let i = 1; i <= REPLAY_COUNT; i++) {
        const exchange = createMockHttpExchange({
          body: { ...baseSalePayload, idempotencyKey: targetIdempotencyKey },
          headers: { 'idempotency-key': targetIdempotencyKey },
        });

        const start = performance.now();
        await createSale(exchange.req, exchange.res);
        const elapsed = performance.now() - start;
        latencies.push(elapsed);

        // Verification 1: HTTP Status 200
        assert.strictEqual(exchange.getStatusCode(), 200, `Call #${i} must return HTTP 200 OK`);

        // Verification 2: idempotentReplay flag
        const body = exchange.getData();
        assert.strictEqual(body.success, true, `Call #${i} must return success: true`);
        assert.strictEqual(body.idempotentReplay, true, `Call #${i} must return idempotentReplay: true`);
        assert.strictEqual(body.message, 'Venta previamente registrada (Idempotent Replay).');

        // Verification 3: Data identity matches initial sale
        assert.strictEqual(body.data.id, initialSale.id, `Call #${i} ID must strictly match original`);
        assert.strictEqual(body.data.saleNumber, 'COMI-0001', `Call #${i} saleNumber must match COMI-0001`);
        assert.strictEqual(body.data.totalAmount, 130.0, `Call #${i} total amount must be intact`);
      }

      // 3. Performance Oracles
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      // Average latency must be < 5ms (typically < 0.5ms in fast-path)
      assert.ok(
        avgLatency < 5.0,
        `Average latency (${avgLatency.toFixed(3)}ms) must be strictly < 5ms for O(1) fast-path`
      );
      assert.ok(
        maxLatency < 25.0,
        `Max latency (${maxLatency.toFixed(3)}ms) must remain bounded without GC spikes`
      );

      // 4. Invariant Oracles: 0 new sales, 0 new transactions, 0 sequence increments
      assert.strictEqual(db.sales.size, 1, 'Sale count in DB must remain exactly 1');
      assert.strictEqual(db.txCallCount, 1, 'Transaction count must NOT increase (must stay at 1)');
      assert.strictEqual(db.fastPathHitCount, REPLAY_COUNT, 'All 50 calls must hit pre-transaction fast path');
      assert.strictEqual(
        db.sequences.get('sale_seq_11111111_1111_4111_8111_111111111111'),
        1n,
        'Sequence counter must NOT increment during replays'
      );
      assert.strictEqual(db.auditLogs.length, 1, 'Audit log must contain exactly 1 entry');
    });

    it('1.2: Fast-Path Replay in direct service call (createSaleTransaction) returns without transaction invocation', async () => {
      const key = 'service-direct-fast-path-key';

      // Seed initial sale
      const first = await createSaleTransaction({
        tenantId: 'tenant-deko-2026',
        sellerId: 'seller-empirical-001',
        ...baseSalePayload,
        idempotencyKey: key,
      });

      assert.strictEqual(first.idempotentReplay, undefined);
      assert.strictEqual(db.txCallCount, 1);

      // Call service directly 10 times
      for (let i = 0; i < 10; i++) {
        const replay = await createSaleTransaction({
          tenantId: 'tenant-deko-2026',
          sellerId: 'seller-empirical-001',
          ...baseSalePayload,
          idempotencyKey: key,
        });

        assert.strictEqual(replay.id, first.id);
        assert.strictEqual(replay.saleNumber, first.saleNumber);
        assert.strictEqual(replay.idempotentReplay, true);
      }

      // txCallCount must remain strictly 1
      assert.strictEqual(db.txCallCount, 1, 'Service layer fast path must not open transactions');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Concurrent Race Condition Simulation (20 Parallel Calls)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Concurrent Race Condition Simulation (20 Parallel Calls)', () => {
    it('2.1: 20 simultaneous parallel calls with the exact same idempotencyKey: exactly 1 wins (HTTP 201) and 19 gracefully recover via P2002 (HTTP 200)', async () => {
      const raceKey = 'uuid-race-condition-concurrency-20';
      const CONCURRENCY = 20;

      // Custom concurrency coordinator to simulate simultaneous arrival before commit
      let preCheckPassedCount = 0;
      let winnerDetermined = false;

      // Override runTransaction for this test to orchestrate the race collision
      prisma.$transaction = async (callback) => {
        db.txCallCount++;

        // Micro-delay simulating lock acquisition contention
        await sleep(randomJitter(1, 4));

        let isWinner = false;
        if (!winnerDetermined) {
          winnerDetermined = true;
          isWinner = true;
        }

        const txMock = {
          sale: {
            findUnique: async () => null, // Both missed in-tx check in pure simultaneous collision
            create: async ({ data }) => {
              if (isWinner) {
                // Winning transaction registers the record
                db.saleCounter++;
                const sale = {
                  id: `sale-winner-${db.saleCounter}`,
                  tenantId: data.tenantId,
                  eventId: data.eventId,
                  sellerId: data.sellerId,
                  saleNumber: 'COMI-0001',
                  totalAmount: data.totalAmount,
                  discount: data.discount,
                  idempotencyKey: data.idempotencyKey,
                  items: [{ description: 'Póster Spider-Man 2099', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }],
                  payments: [{ method: 'EFECTIVO', amount: 130.0 }],
                  seller: { id: data.sellerId, fullName: 'Winner', email: 'win@deko.gt' },
                };
                db.sales.set(sale.id, sale);
                db.salesByIdempotencyKey.set(data.idempotencyKey, sale);
                return sale;
              } else {
                // The 19 losing transactions hit PostgreSQL unique index violation
                db.p2002Count++;
                const p2002Err = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
                p2002Err.code = 'P2002';
                p2002Err.meta = { target: ['sales_idempotencyKey_key'] };
                throw p2002Err;
              }
            },
          },
          auditLog: { create: async () => {} },
          event: { findUnique: async () => ({ name: 'Comic Con 2026' }) },
          $executeRawUnsafe: async () => {},
          $queryRawUnsafe: async (sql) => {
            if (sql.includes('nextval')) return [{ nextval: 1n }];
            return [];
          },
        };

        return await callback(txMock);
      };

      // Ensure pre-transaction findUnique returns null for all 20 arrivals during race window
      prisma.sale.findUnique = async ({ where }) => {
        preCheckPassedCount++;
        // If winner has registered it, subsequent findUnique (e.g. inside P2002 catch) finds it!
        if (db.salesByIdempotencyKey.has(where.idempotencyKey)) {
          return db.salesByIdempotencyKey.get(where.idempotencyKey);
        }
        return null;
      };

      // Fire 20 parallel HTTP exchanges
      const exchanges = Array.from({ length: CONCURRENCY }, () =>
        createMockHttpExchange({
          body: { ...baseSalePayload, idempotencyKey: raceKey },
          headers: { 'idempotency-key': raceKey },
        })
      );

      // Execute all 20 calls concurrently with Promise.all
      const results = await Promise.all(
        exchanges.map((ex) => createSale(ex.req, ex.res))
      );

      // Oracle 1: 0 unhandled rejections and 0 crashes
      assert.strictEqual(results.length, CONCURRENCY, 'All 20 promises must resolve cleanly');

      // Oracle 2: Status code distribution
      const statusCodes = exchanges.map((ex) => ex.getStatusCode());
      const createdCount = statusCodes.filter((c) => c === 201).length;
      const replayCount = statusCodes.filter((c) => c === 200).length;

      assert.strictEqual(createdCount, 1, 'Exactly 1 request must receive HTTP 201 Created');
      assert.strictEqual(replayCount, 19, 'Exactly 19 requests must receive HTTP 200 OK (Replay)');
      assert.strictEqual(statusCodes.some((c) => c >= 400), false, 'Zero requests may fail with 4xx or 5xx');

      // Oracle 3: P2002 recovery count
      assert.strictEqual(db.p2002Count, 19, 'All 19 losing transactions must trigger P2002 unique constraint catch');

      // Oracle 4: Data identity across all 20 responses
      const allBodies = exchanges.map((ex) => ex.getData());
      const winnerBody = allBodies.find((b) => b.idempotentReplay === undefined);
      const replayBodies = allBodies.filter((b) => b.idempotentReplay === true);

      assert.ok(winnerBody, 'Winner body must be present');
      assert.strictEqual(replayBodies.length, 19, 'Must have exactly 19 replay bodies');

      const canonicalSaleId = winnerBody.data.id;
      const canonicalSaleNumber = winnerBody.data.saleNumber;

      for (const rep of replayBodies) {
        assert.strictEqual(rep.success, true);
        assert.strictEqual(rep.idempotentReplay, true);
        assert.strictEqual(rep.data.id, canonicalSaleId, 'Replay ID must match the winning sale ID');
        assert.strictEqual(rep.data.saleNumber, canonicalSaleNumber, 'Replay ticket must match winning ticket');
      }

      // Oracle 5: Exactly 1 record persisted in database
      assert.strictEqual(db.sales.size, 1, 'Database must contain exactly 1 sale row');
      assert.strictEqual(db.salesByIdempotencyKey.size, 1, 'Idempotency index must contain exactly 1 entry');
    });

    it('2.2: Mixed concurrency with variable jitter (in-transaction check + P2002 recovery) resolves with 100% safety', async () => {
      const mixedRaceKey = 'uuid-mixed-race-jitter-2026';
      const CONCURRENCY = 20;

      // Realistic interleaved engine where some requests catch P2002 while others observe committed record in tx
      let committedWinner = null;

      prisma.$transaction = async (callback) => {
        db.txCallCount++;
        await sleep(randomJitter(1, 5));

        const txMock = {
          sale: {
            findUnique: async ({ where }) => {
              if (where.idempotencyKey && committedWinner) {
                db.inTxCheckHitCount++;
                return committedWinner;
              }
              return null;
            },
            create: async ({ data }) => {
              if (!committedWinner) {
                db.saleCounter++;
                const sale = {
                  id: `sale-mixed-win-${db.saleCounter}`,
                  tenantId: data.tenantId,
                  eventId: data.eventId,
                  sellerId: data.sellerId,
                  saleNumber: 'COMI-0001',
                  totalAmount: data.totalAmount,
                  discount: data.discount,
                  idempotencyKey: data.idempotencyKey,
                  items: [{ description: 'Póster', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }],
                  payments: [{ method: 'EFECTIVO', amount: 130.0 }],
                  seller: { id: data.sellerId, fullName: 'Winner', email: 'win@deko.gt' },
                };
                committedWinner = sale;
                db.sales.set(sale.id, sale);
                db.salesByIdempotencyKey.set(data.idempotencyKey, sale);
                return sale;
              } else {
                db.p2002Count++;
                const p2002Err = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
                p2002Err.code = 'P2002';
                p2002Err.meta = { target: ['sales_idempotencyKey_key'] };
                throw p2002Err;
              }
            },
          },
          auditLog: { create: async () => {} },
          event: { findUnique: async () => ({ name: 'Comic Con 2026' }) },
          $executeRawUnsafe: async () => {},
          $queryRawUnsafe: async () => [{ nextval: 1n }],
        };

        return await callback(txMock);
      };

      prisma.sale.findUnique = async ({ where }) => {
        if (committedWinner && where.idempotencyKey === mixedRaceKey) {
          return committedWinner;
        }
        return null;
      };

      const exchanges = Array.from({ length: CONCURRENCY }, () =>
        createMockHttpExchange({
          body: { ...baseSalePayload, idempotencyKey: mixedRaceKey },
          headers: { 'idempotency-key': mixedRaceKey },
        })
      );

      await Promise.all(exchanges.map((ex) => createSale(ex.req, ex.res)));

      const createdCount = exchanges.filter((e) => e.getStatusCode() === 201).length;
      const replayCount = exchanges.filter((e) => e.getStatusCode() === 200).length;

      assert.strictEqual(createdCount, 1, 'Exactly 1 sale must be created');
      assert.strictEqual(replayCount, 19, 'All 19 concurrent followers must be replayed');
      assert.ok(db.p2002Count + db.inTxCheckHitCount >= 19, 'All 19 followers resolved via P2002 or in-tx check');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Null & Omitted Key Compatibility
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Null & Omitted Key Compatibility', () => {
    it('3.1: Multiple sequential sales with idempotencyKey = null create separate sales without unique constraint collisions', async () => {
      const NULL_SALES_COUNT = 5;
      const exchanges = [];

      for (let i = 0; i < NULL_SALES_COUNT; i++) {
        const ex = createMockHttpExchange({
          body: { ...baseSalePayload, idempotencyKey: null },
        });
        await createSale(ex.req, ex.res);
        exchanges.push(ex);
      }

      // Oracle 1: All 5 return HTTP 201 Created
      for (const ex of exchanges) {
        assert.strictEqual(ex.getStatusCode(), 201, 'Null-key sale must return HTTP 201 Created');
        assert.strictEqual(ex.getData().idempotentReplay, undefined, 'Null-key sale is never a replay');
      }

      // Oracle 2: All 5 receive unique IDs and monotonic sequence numbers
      const ids = exchanges.map((e) => e.getData().data.id);
      const saleNumbers = exchanges.map((e) => e.getData().data.saleNumber);

      assert.strictEqual(new Set(ids).size, NULL_SALES_COUNT, 'All sale IDs must be unique');
      assert.strictEqual(new Set(saleNumbers).size, NULL_SALES_COUNT, 'All sale numbers must be unique');

      for (let i = 0; i < NULL_SALES_COUNT; i++) {
        const expectedSeq = `COMI-${String(i + 1).padStart(4, '0')}`;
        assert.strictEqual(saleNumbers[i], expectedSeq, `Sale #${i + 1} must have sequence ${expectedSeq}`);
      }

      // Oracle 3: 0 P2002 errors were thrown
      assert.strictEqual(db.p2002Count, 0, 'Zero P2002 collisions for null idempotency keys');
      assert.strictEqual(db.sales.size, NULL_SALES_COUNT, 'DB must contain all 5 distinct sales');
    });

    it('3.2: Sales with omitted or undefined idempotencyKey create distinct sales without unique index collisions', async () => {
      // Sale 1: Completely omitted
      const ex1 = createMockHttpExchange({ body: { ...baseSalePayload } });
      // Sale 2: undefined key
      const ex2 = createMockHttpExchange({ body: { ...baseSalePayload, idempotencyKey: undefined } });
      // Sale 3: Empty string key
      const ex3 = createMockHttpExchange({ body: { ...baseSalePayload, idempotencyKey: '' } });
      // Sale 4: Whitespace-only header
      const ex4 = createMockHttpExchange({
        body: { ...baseSalePayload },
        headers: { 'idempotency-key': '   ' },
      });

      await createSale(ex1.req, ex1.res);
      await createSale(ex2.req, ex2.res);
      await createSale(ex3.req, ex3.res);
      await createSale(ex4.req, ex4.res);

      assert.strictEqual(ex1.getStatusCode(), 201);
      assert.strictEqual(ex2.getStatusCode(), 201);
      assert.strictEqual(ex3.getStatusCode(), 201);
      assert.strictEqual(ex4.getStatusCode(), 201);

      assert.strictEqual(db.sales.size, 4, 'All 4 sales must be distinct records');
      assert.strictEqual(db.p2002Count, 0, 'No collisions when keys are omitted or blank');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Adversarial Attack Vectors & Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Adversarial Attack Vectors & Edge Cases', () => {
    it('4.1: Adversarial Payload Tampering on Replay returns the original recorded sale and rejects price spoofing', async () => {
      const spoofKey = 'client-key-tamper-test';

      // 1. Legitimate sale of Q130.00
      const legitExchange = createMockHttpExchange({
        body: { ...baseSalePayload, idempotencyKey: spoofKey },
        headers: { 'idempotency-key': spoofKey },
      });
      await createSale(legitExchange.req, legitExchange.res);
      assert.strictEqual(legitExchange.getStatusCode(), 201);
      const originalSale = legitExchange.getData().data;
      assert.strictEqual(originalSale.totalAmount, 130.0);

      // 2. Attacker attempts to replay same idempotencyKey with modified items (Q500.00 value)
      const tamperedExchange = createMockHttpExchange({
        body: {
          ...baseSalePayload,
          items: [{ description: 'Póster Gigante Dorado', quantity: 5, unitPrice: 100.0 }],
          payments: [{ method: 'EFECTIVO', amount: 500.0 }],
          idempotencyKey: spoofKey,
        },
        headers: { 'idempotency-key': spoofKey },
      });
      await createSale(tamperedExchange.req, tamperedExchange.res);

      assert.strictEqual(tamperedExchange.getStatusCode(), 200, 'Must return HTTP 200 OK Replay');
      const replayedSale = tamperedExchange.getData().data;

      // Oracle: Replayed sale retains original total and items, ignoring tampered payload
      assert.strictEqual(replayedSale.totalAmount, 130.0, 'Total must remain Q130.00 from original sale');
      assert.strictEqual(replayedSale.items.length, 2, 'Must retain original 2 items');
      assert.strictEqual(replayedSale.id, originalSale.id, 'Sale ID must remain identical');
      assert.strictEqual(db.sales.size, 1, 'Database must retain exactly 1 record');
    });

    it('4.2: Header vs Body Precedence — Header Idempotency-Key strictly overrides body idempotencyKey', async () => {
      const headerKey = 'header-priority-key-aaa';
      const bodyKey = 'body-inferior-key-bbb';

      const exchange = createMockHttpExchange({
        body: { ...baseSalePayload, idempotencyKey: bodyKey },
        headers: { 'idempotency-key': headerKey },
      });
      await createSale(exchange.req, exchange.res);

      assert.strictEqual(exchange.getStatusCode(), 201);
      const created = exchange.getData().data;
      assert.strictEqual(created.idempotencyKey, headerKey, 'Header key must be persisted');
      assert.ok(db.salesByIdempotencyKey.has(headerKey), 'Header key must index the sale');
      assert.strictEqual(db.salesByIdempotencyKey.has(bodyKey), false, 'Body key must be ignored when header is set');
    });

    it('4.3: Zod validation rejects malformed non-string and oversized idempotency keys', () => {
      const oversizedKey = 'x'.repeat(256);
      assert.throws(() => {
        createSaleSchema.parse({ ...baseSalePayload, idempotencyKey: oversizedKey });
      }, /String must contain at most 255 character/);

      assert.throws(() => {
        createSaleSchema.parse({ ...baseSalePayload, idempotencyKey: 99999 });
      }, /Expected string, received number/);

      assert.throws(() => {
        createSaleSchema.parse({ ...baseSalePayload, idempotencyKey: ['array-key'] });
      }, /Expected string, received array/);
    });

    it('4.4: Context validation — Missing sellerId or tenantId returns HTTP 400 before touching database', async () => {
      const exchangeNoSeller = createMockHttpExchange({
        body: { ...baseSalePayload, idempotencyKey: 'context-test-key' },
        user: null, // No authenticated seller
      });
      await createSale(exchangeNoSeller.req, exchangeNoSeller.res);

      assert.strictEqual(exchangeNoSeller.getStatusCode(), 400);
      assert.strictEqual(exchangeNoSeller.getData().success, false);
      assert.strictEqual(db.txCallCount, 0, 'Must not open transaction when seller is missing');
    });
  });
});
