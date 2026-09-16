import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSaleNumber,
  getSequenceName,
  invalidateSequenceCache,
} from '../../server/services/sales/saleNumberGenerator.js';
import { purgeEventSalesTransaction } from '../../server/services/sales/salePurgeService.js';
import { prisma } from '../../server/config/prisma.js';

// Helper for simulating variable network jitter
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomJitter = (minMs = 1, maxMs = 20) =>
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

describe('🛡️ EMPIRICAL CHALLENGE: Milestone 1 (R1 - PostgreSQL Concurrency & Native Sequences)', () => {

  beforeEach(() => {
    invalidateSequenceCache();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. STRESS TEST: 100 Concurrent Async Calls with Realistic Network Jitter
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Concurrency Stress Test: 100 Concurrent Calls with Network Jitter (1ms - 20ms)', () => {

    it('1.1: 100 concurrent asynchronous calls under cold start generate 100 unique tickets with 0 collisions and exactly 1 DDL execution', async () => {
      let ddlExecutionCount = 0;
      let internalSequence = 0n;

      // Mock client with variable network jitter
      const mockClient = {
        $executeRawUnsafe: async (sql) => {
          await sleep(randomJitter(2, 15));
          ddlExecutionCount++;
        },
        $queryRawUnsafe: async (sql) => {
          // Simulate PostgreSQL sequence engine: atomic nextval with network round-trip jitter
          await sleep(randomJitter(1, 20));
          if (sql.includes('nextval')) {
            internalSequence += 1n;
            return [{ nextval: internalSequence }];
          }
          return [];
        },
        event: {
          findUnique: async ({ where }) => {
            await sleep(randomJitter(1, 10));
            return { name: 'Comic Con 2026' };
          },
        },
      };

      const CONCURRENCY = 100;
      const tasks = Array.from({ length: CONCURRENCY }, () =>
        generateSaleNumber('event-stress-cold', mockClient)
      );

      const results = await Promise.all(tasks);

      // Oracle 1: Exactly 100 tickets generated
      assert.strictEqual(results.length, CONCURRENCY, 'Must generate exactly 100 tickets');

      // Oracle 2: Zero collisions (Set size must be exactly 100)
      const uniqueTickets = new Set(results);
      assert.strictEqual(uniqueTickets.size, CONCURRENCY, 'Zero ticket collisions allowed');

      // Oracle 3: Lock Elision / Stampede Prevention — DDL DO block executed exactly ONCE
      assert.strictEqual(ddlExecutionCount, 1, 'DO block DDL must execute exactly once even with 100 concurrent cold requests');

      // Oracle 4: Sequential range coverage (COMI-0001 through COMI-0100)
      for (let i = 1; i <= CONCURRENCY; i++) {
        const expectedTicket = `COMI-${String(i).padStart(4, '0')}`;
        assert.ok(uniqueTickets.has(expectedTicket), `Ticket sequence must contain ${expectedTicket}`);
      }
    });

    it('1.2: 100 concurrent asynchronous calls on warm cache execute 0 additional DDL statements and continue sequential numbering', async () => {
      let ddlExecutionCount = 0;
      let internalSequence = 100n;

      const mockClient = {
        $executeRawUnsafe: async () => {
          ddlExecutionCount++;
        },
        $queryRawUnsafe: async (sql) => {
          await sleep(randomJitter(1, 20));
          if (sql.includes('nextval')) {
            internalSequence += 1n;
            return [{ nextval: internalSequence }];
          }
          return [];
        },
        event: {
          findUnique: async () => {
            await sleep(randomJitter(1, 5));
            return { name: 'Comic Con 2026' };
          },
        },
      };

      // Warm up cache first
      await generateSaleNumber('event-stress-warm', mockClient);
      assert.strictEqual(ddlExecutionCount, 1, 'Warmup should execute DDL once');

      // Now fire 100 concurrent calls on warm cache
      const CONCURRENCY = 100;
      const tasks = Array.from({ length: CONCURRENCY }, () =>
        generateSaleNumber('event-stress-warm', mockClient)
      );

      const results = await Promise.all(tasks);

      // Oracle 1: DDL count did not increase (0 additional DDL executions)
      assert.strictEqual(ddlExecutionCount, 1, 'Warm cache must execute 0 additional DDL calls');

      // Oracle 2: Exactly 100 unique tickets
      const uniqueTickets = new Set(results);
      assert.strictEqual(uniqueTickets.size, CONCURRENCY, 'All 100 warm tickets must be unique');

      // Oracle 3: Sequence range continued from 102 through 201
      for (let i = 102; i <= 201; i++) {
        const expectedTicket = `COMI-${String(i).padStart(4, '0')}`;
        assert.ok(uniqueTickets.has(expectedTicket), `Ticket sequence must contain ${expectedTicket}`);
      }
    });

    it('1.3: Interleaved multi-event concurrency (50 for Event A + 50 for Event B) maintains complete sequence isolation', async () => {
      const sequences = {
        'sale_seq_event_alpha': 0n,
        'sale_seq_event_beta': 0n,
      };

      const mockClient = {
        $executeRawUnsafe: async () => {
          await sleep(randomJitter(1, 10));
        },
        $queryRawUnsafe: async (sql) => {
          await sleep(randomJitter(1, 20));
          for (const [seqName, count] of Object.entries(sequences)) {
            if (sql.includes(seqName)) {
              sequences[seqName] += 1n;
              return [{ nextval: sequences[seqName] }];
            }
          }
          return [];
        },
        event: {
          findUnique: async ({ where }) => {
            await sleep(randomJitter(1, 5));
            return { name: where.id === 'event-alpha' ? 'Alpha Expo' : 'Beta Fest' };
          },
        },
      };

      const alphaTasks = Array.from({ length: 50 }, () =>
        generateSaleNumber('event-alpha', mockClient)
      );
      const betaTasks = Array.from({ length: 50 }, () =>
        generateSaleNumber('event-beta', mockClient)
      );

      // Run both sets of 50 concurrently and interleaved
      const [alphaResults, betaResults] = await Promise.all([
        Promise.all(alphaTasks),
        Promise.all(betaTasks),
      ]);

      assert.strictEqual(new Set(alphaResults).size, 50, 'Event Alpha has 50 unique tickets');
      assert.strictEqual(new Set(betaResults).size, 50, 'Event Beta has 50 unique tickets');

      // Verify prefix and boundaries for Alpha
      assert.ok(alphaResults.every((t) => t.startsWith('ALPH-')));
      assert.strictEqual(sequences['sale_seq_event_alpha'], 50n);

      // Verify prefix and boundaries for Beta
      assert.ok(betaResults.every((t) => t.startsWith('BETA-')));
      assert.strictEqual(sequences['sale_seq_event_beta'], 50n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ADVERSARIAL INPUTS: SQL Injection, Types, Whitespace, Unicode & Length
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Adversarial Input Testing for eventId', () => {

    const standardMockClient = {
      $executeRawUnsafe: async () => {},
      $queryRawUnsafe: async () => [{ nextval: 1n }],
      event: { findUnique: async () => ({ name: 'Test' }) },
    };

    it('2.1: Rejects SQL Injection payloads strictly without executing any queries', async () => {
      const sqlInjections = [
        "event; DROP TABLE events; --",
        "event' OR 1=1; --",
        "sale_seq_test; SELECT pg_sleep(5); --",
        'admin" --',
        "' OR ''='",
        "ev union select * from users",
        "\x00event_nullbyte",
        "event'/*comment*/",
        "'; EXEC xp_cmdshell('dir');--",
        "event` OR `1`=`1",
      ];

      let queryExecuted = false;
      const trackingClient = {
        $executeRawUnsafe: async () => { queryExecuted = true; },
        $queryRawUnsafe: async () => { queryExecuted = true; return [{ nextval: 1n }]; },
        event: { findUnique: async () => { queryExecuted = true; return { name: 'Trap' }; } },
      };

      for (const injection of sqlInjections) {
        // Must reject in getSequenceName
        assert.throws(
          () => getSequenceName(injection),
          /ID de evento inválido para secuencia/,
          `getSequenceName must reject injection: ${injection}`
        );

        // Must reject in generateSaleNumber before any DB interaction
        await assert.rejects(
          () => generateSaleNumber(injection, trackingClient),
          /ID de evento inválido para secuencia/,
          `generateSaleNumber must reject injection: ${injection}`
        );

        assert.strictEqual(queryExecuted, false, 'No DB queries should be executed on rejected inputs');
      }
    });

    it('2.2: Rejects non-string types and falsy inputs strictly', async () => {
      const nonStringInputs = [
        null,
        undefined,
        12345,
        0,
        -1,
        3.14159,
        NaN,
        Infinity,
        true,
        false,
        {},
        { id: 'event-1' },
        [],
        ['event-1'],
        Symbol('event-1'),
        () => 'event-1',
        BigInt(42),
      ];

      for (const input of nonStringInputs) {
        assert.throws(
          () => getSequenceName(input),
          /(ID de evento inválido para secuencia|Cannot convert a Symbol)/,
          `getSequenceName must reject non-string: ${String(input)}`
        );

        await assert.rejects(
          () => generateSaleNumber(input, standardMockClient),
          /(ID de evento inválido para secuencia|Cannot convert a Symbol)/,
          `generateSaleNumber must reject non-string: ${String(input)}`
        );
      }
    });

    it('2.3: Rejects whitespace, control characters and empty strings', async () => {
      const whitespaceInputs = [
        '',
        ' ',
        '   ',
        ' leading_space',
        'trailing_space ',
        'middle space',
        '\tevent_tab',
        'event_tab\t',
        '\nevent_newline',
        'event_newline\n',
        '\r\nevent_crlf',
        'event\r\nwith\r\nnewlines',
      ];

      for (const input of whitespaceInputs) {
        assert.throws(
          () => getSequenceName(input),
          /ID de evento inválido para secuencia/,
          `Must reject whitespace input: ${JSON.stringify(input)}`
        );

        await assert.rejects(
          () => generateSaleNumber(input, standardMockClient),
          /ID de evento inválido para secuencia/,
          `Must reject whitespace input in generateSaleNumber: ${JSON.stringify(input)}`
        );
      }
    });

    it('2.4: Rejects Unicode, accented characters, emojis and non-alphanumeric punctuation', async () => {
      const unicodeAndPunctuation = [
        'evento_españa',
        'evento_año',
        'event_🔥',
        'event_🚀_pos',
        'event_ñandú',
        'event@domain',
        'event#123',
        'event$dollar',
        'event%percent',
        'event^caret',
        'event&amp',
        'event*star',
        'event(paren)',
        'event+plus',
        'event=equal',
        'event/slash',
        'event\\backslash',
        'event.dot',
        'event,comma',
        'event:colon',
        'event;semicolon',
      ];

      for (const input of unicodeAndPunctuation) {
        assert.throws(
          () => getSequenceName(input),
          /ID de evento inválido para secuencia/,
          `Must reject unicode/punctuation: ${input}`
        );

        await assert.rejects(
          () => generateSaleNumber(input, standardMockClient),
          /ID de evento inválido para secuencia/,
          `Must reject unicode/punctuation in generateSaleNumber: ${input}`
        );
      }
    });

    it('2.5: Verifies string length boundary: 50 chars accepted, 51+ chars strictly rejected (preventing Postgres 63-byte identifier truncation)', async () => {
      // 50 chars: exactly at boundary
      const exact50 = 'a'.repeat(50);
      const seqName50 = getSequenceName(exact50);
      assert.strictEqual(seqName50, `sale_seq_${exact50}`);
      // Postgres max identifier is 63 bytes. sale_seq_ is 9 bytes. 9 + 50 = 59 <= 63!
      assert.ok(seqName50.length <= 63, `Identifier length (${seqName50.length}) must be <= 63 bytes`);

      // 51 chars: over boundary
      const over51 = 'a'.repeat(51);
      assert.throws(
        () => getSequenceName(over51),
        /ID de evento inválido para secuencia/
      );

      // 100 chars: extreme length
      const extreme100 = 'a'.repeat(100);
      assert.throws(
        () => getSequenceName(extreme100),
        /ID de evento inválido para secuencia/
      );

      // 1000 chars: buffer flood attempt
      const extreme1000 = 'a'.repeat(1000);
      assert.throws(
        () => getSequenceName(extreme1000),
        /ID de evento inválido para secuencia/
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. BIGINT LEAKAGE & JSON SERIALIZATION SAFETY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. BigInt Casting & JSON Serialization Integrity', () => {

    it('3.1: BigInt is never leaked in the returned value; JSON serialization passes 100% cleanly', async () => {
      const bigIntOutputs = [
        1n,
        42n,
        999n,
        10000n,
        999999n,
        9007199254740991n, // Number.MAX_SAFE_INTEGER
      ];

      for (const rawBigInt of bigIntOutputs) {
        invalidateSequenceCache();
        const mockClient = {
          $executeRawUnsafe: async () => {},
          $queryRawUnsafe: async () => [{ nextval: rawBigInt }],
          event: { findUnique: async () => ({ name: 'BigInt Test' }) },
        };

        const ticket = await generateSaleNumber('event-bigint', mockClient);

        // Oracle 1: Return type is strictly primitive string
        assert.strictEqual(typeof ticket, 'string', 'Ticket must be a primitive string');

        // Oracle 2: JSON serialization MUST NOT throw TypeError ("Do not know how to serialize a BigInt")
        let serializedJson = null;
        assert.doesNotThrow(() => {
          serializedJson = JSON.stringify({
            status: 'success',
            data: {
              ticket,
              meta: { eventId: 'event-bigint' },
            },
          });
        }, 'JSON.stringify must not throw BigInt serialization error');

        // Oracle 3: JSON parse round-trip matches exactly
        const parsed = JSON.parse(serializedJson);
        assert.strictEqual(parsed.data.ticket, ticket);
        assert.ok(typeof parsed.data.ticket === 'string');
      }
    });

    it('3.2: Null, undefined, empty array or missing nextval throw descriptive error', async () => {
      const missingOutputs = [
        null, // query returns null
        [], // query returns empty array
        [{}], // query returns row without nextval key
        [{ nextval: null }],
        [{ nextval: undefined }],
      ];

      for (const badResult of missingOutputs) {
        invalidateSequenceCache();
        const mockClient = {
          $executeRawUnsafe: async () => {},
          $queryRawUnsafe: async () => badResult,
          event: { findUnique: async () => ({ name: 'Test' }) },
        };

        await assert.rejects(
          () => generateSaleNumber('event-missing', mockClient),
          /Error obteniendo consecutivo de la secuencia/
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FAULT TOLERANCE: Connection Drop & Promise Recovery
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Fault Tolerance and Recovery', () => {

    it('4.1: When DDL DO block fails with database error, error is propagated and initPromises map is cleanly reset', async () => {
      let callCount = 0;
      const mockClient = {
        $executeRawUnsafe: async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('P1001: Can\'t reach database server at postgres:5432');
          }
          // Succeed on subsequent call
        },
        $queryRawUnsafe: async () => [{ nextval: 1n }],
        event: { findUnique: async () => ({ name: 'Recovery Expo' }) },
      };

      // Call 1 fails
      await assert.rejects(
        () => generateSaleNumber('event-fault-retry', mockClient),
        /Can't reach database server/
      );

      // Call 2 must NOT be hung on a stale promise in initPromises; it must retry and succeed
      const ticket = await generateSaleNumber('event-fault-retry', mockClient);
      assert.strictEqual(ticket, 'RECO-0001');
      assert.strictEqual(callCount, 2, 'Must have attempted DDL twice');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PURGE INTEGRATION: Drop Sequence & Cache Invalidation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Purge Service Integration', () => {

    it('5.1: purgeEventSalesTransaction issues DROP SEQUENCE IF EXISTS and invalidates sequence cache', async () => {
      let dropSql = null;
      const mockTx = {
        event: {
          findFirst: async () => ({ id: 'event-purge-test', name: 'Purge Expo' }),
          update: async () => {},
        },
        sale: {
          count: async () => 20,
          deleteMany: async () => ({ count: 20 }),
        },
        cashClosing: {
          deleteMany: async () => ({ count: 0 }),
        },
        auditLog: {
          create: async () => {},
        },
        $executeRawUnsafe: async (sql) => {
          dropSql = sql;
        },
      };

      // Populate cache first
      const warmClient = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [{ nextval: 5n }],
        event: { findUnique: async () => ({ name: 'Purge Expo' }) },
      };
      await generateSaleNumber('event-purge-test', warmClient);

      // Run purge with mock $transaction
      const originalTx = prisma.$transaction;
      prisma.$transaction = async (cb) => await cb(mockTx);

      try {
        const result = await purgeEventSalesTransaction({
          tenantId: 'tenant-deko',
          eventId: 'event-purge-test',
          userId: 'admin-user',
        });

        assert.strictEqual(result.purgedSalesCount, 20);
        assert.strictEqual(result.currentSaleSequence, 0);
        assert.ok(dropSql.includes('DROP SEQUENCE IF EXISTS sale_seq_event_purge_test'));
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
