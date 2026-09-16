import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSaleNumber,
  getSequenceName,
  invalidateSequenceCache,
} from '../../server/services/sales/saleNumberGenerator.js';
import { purgeEventSalesTransaction } from '../../server/services/sales/salePurgeService.js';

describe('⚡ POSTGRESQL NATIVE SEQUENCES & CONCURRENCY (saleNumberGenerator & salePurgeService)', () => {

  beforeEach(() => {
    invalidateSequenceCache();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Validación y Sanitización de Nombre de Secuencia (getSequenceName)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Validación y Sanitización de Nombres de Secuencia', () => {

    it('1.1: Genera nombres de secuencia válidos reemplazando guiones por guiones bajos', () => {
      const cases = [
        { id: 'event-uuid-123', expected: 'sale_seq_event_uuid_123' },
        { id: 'c2a86847-5c20-424a-9b13-8a3ecbf2c64b', expected: 'sale_seq_c2a86847_5c20_424a_9b13_8a3ecbf2c64b' },
        { id: 'CC26_EVENT', expected: 'sale_seq_CC26_EVENT' },
        { id: 'ev1', expected: 'sale_seq_ev1' },
      ];

      for (const { id, expected } of cases) {
        const name = getSequenceName(id);
        assert.strictEqual(name, expected);
        assert.ok(/^sale_seq_[a-zA-Z0-9_]+$/.test(name));
      }
    });

    it('1.2: Rechaza entradas inválidas, vacías, nulas o con inyección SQL', () => {
      const invalidInputs = [
        null,
        undefined,
        '',
        12345,
        {},
        [],
        'event; DROP TABLE events; --',
        'event with spaces',
        'event$name',
        'event#1',
        'ev/123',
        'a'.repeat(51), // Excede longitud máxima de 50
      ];

      for (const input of invalidInputs) {
        assert.throws(
          () => getSequenceName(input),
          /ID de evento inválido para secuencia/,
          `Debe fallar para input: ${input}`
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Generación con Secuencias Nativas PostgreSQL y Casting de BigInt
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Generación con Secuencias Nativas PostgreSQL y Casting de BigInt', () => {

    it('2.1: Procesa correctamente BigInt retornado por nextval() y formatea ticket', async () => {
      let rawQueryExecuted = null;
      let executedDdl = null;

      const mockClient = {
        $executeRawUnsafe: async (sql) => {
          executedDdl = sql;
        },
        $queryRawUnsafe: async (sql) => {
          rawQueryExecuted = sql;
          return [{ nextval: 1n }]; // Retorno típico de PostgreSQL BigInt
        },
        event: {
          findUnique: async () => ({ name: 'Comic Con 2026' }),
        },
      };

      const ticket = await generateSaleNumber('event-uuid-1', mockClient);

      assert.strictEqual(ticket, 'COMI-0001');
      assert.ok(rawQueryExecuted.includes("SELECT nextval('sale_seq_event_uuid_1')"));
      assert.ok(executedDdl.includes('CREATE SEQUENCE IF NOT EXISTS sale_seq_event_uuid_1'));
      assert.ok(executedDdl.includes('COALESCE("current_sale_sequence", 0) + 1'));
      assert.ok(executedDdl.includes('"events"'));
    });

    it('2.2: Soporta valores nextval como Number o String', async () => {
      const mockClientNumber = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [{ nextval: 42 }],
        event: { findUnique: async () => ({ name: 'Feria de Diseño' }) },
      };
      const ticketNum = await generateSaleNumber('event-uuid-2', mockClientNumber);
      assert.strictEqual(ticketNum, 'FERI-0042');

      invalidateSequenceCache('event-uuid-3');
      const mockClientString = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [{ nextval: '100' }],
        event: { findUnique: async () => ({ name: 'Feria de Diseño' }) },
      };
      const ticketStr = await generateSaleNumber('event-uuid-3', mockClientString);
      assert.strictEqual(ticketStr, 'FERI-0100');
    });

    it('2.3: Lanza error descriptivo si el resultado de nextval es nulo o indefinido', async () => {
      const mockClientEmpty = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [],
        event: { findUnique: async () => ({ name: 'Feria' }) },
      };

      await assert.rejects(
        () => generateSaleNumber('event-uuid-err', mockClientEmpty),
        /Error obteniendo consecutivo de la secuencia/
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Formateo de Tickets para Números Superiores a 9999
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Formateo de Tickets para Números Superiores a 9999', () => {

    it('3.1: Formatea sin truncar cuando la secuencia supera 9999', async () => {
      const testCases = [
        { seq: 10000n, expected: 'STAN-10000' },
        { seq: 12500n, expected: 'STAN-12500' },
        { seq: 999999n, expected: 'STAN-999999' },
      ];

      for (const { seq, expected } of testCases) {
        invalidateSequenceCache('event-large');
        const mockClient = {
          $executeRawUnsafe: async () => {},
          $queryRawUnsafe: async () => [{ nextval: seq }],
          event: { findUnique: async () => ({ name: 'STAND' }) },
        };

        const ticket = await generateSaleNumber('event-large', mockClient);
        assert.strictEqual(ticket, expected);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Concurrencia, Idempotencia de Inicialización y Caché en Memoria
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Concurrencia, Idempotencia y Caché en Memoria', () => {

    it('4.1: 50 llamadas paralelas ejecutan el DO block de creación solo una vez', async () => {
      let ddlExecutionCount = 0;
      let counter = 0n;

      const mockClient = {
        $executeRawUnsafe: async () => {
          ddlExecutionCount++;
        },
        $queryRawUnsafe: async () => {
          counter += 1n;
          return [{ nextval: counter }];
        },
        event: {
          findUnique: async () => ({ name: 'Comic Con 2026' }),
        },
      };

      const tasks = Array.from({ length: 50 }, () =>
        generateSaleNumber('event-parallel-1', mockClient)
      );

      const results = await Promise.all(tasks);

      // Verificación 1: DDL DO block solo se ejecutó UNA vez gracias a la caché e initPromises
      assert.strictEqual(ddlExecutionCount, 1, 'El bloque DO de creación de secuencia debe ejecutarse solo una vez');

      // Verificación 2: 50 resultados únicos
      const uniqueResults = new Set(results);
      assert.strictEqual(uniqueResults.size, 50, 'Todos los 50 tickets deben ser únicos');

      // Verificación 3: Límites de secuencia
      assert.strictEqual(results[0], 'COMI-0001');
      assert.strictEqual(results[49], 'COMI-0050');
    });

    it('4.2: invalidateSequenceCache elimina la secuencia de la caché reactivando verificación', async () => {
      let ddlExecutionCount = 0;
      const mockClient = {
        $executeRawUnsafe: async () => {
          ddlExecutionCount++;
        },
        $queryRawUnsafe: async () => [{ nextval: 1n }],
        event: { findUnique: async () => ({ name: 'Comic Con' }) },
      };

      // Primera llamada: ejecuta DDL
      await generateSaleNumber('event-cache-test', mockClient);
      assert.strictEqual(ddlExecutionCount, 1);

      // Segunda llamada: usa caché en memoria, no repite DDL
      await generateSaleNumber('event-cache-test', mockClient);
      assert.strictEqual(ddlExecutionCount, 1);

      // Invalidar caché para este evento
      invalidateSequenceCache('event-cache-test');

      // Tercera llamada: vuelve a ejecutar DDL
      await generateSaleNumber('event-cache-test', mockClient);
      assert.strictEqual(ddlExecutionCount, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Adaptador de Compatibilidad para Mocks Unitarios Legacy
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Adaptador de Compatibilidad para Mocks Legacy', () => {

    it('5.1: Cuando client.$queryRawUnsafe no existe pero client.event.update sí, usa el fallback', async () => {
      let updateCalled = false;
      const mockLegacyClient = {
        event: {
          update: async ({ where, data }) => {
            updateCalled = true;
            return {
              name: 'Legacy Event',
              currentSaleSequence: 7,
            };
          },
        },
      };

      const ticket = await generateSaleNumber('event-legacy', mockLegacyClient);

      assert.strictEqual(updateCalled, true);
      assert.strictEqual(ticket, 'LEGA-0007');
    });

    it('5.2: Lanza error cuando el cliente no soporta ni $queryRawUnsafe ni event.update', async () => {
      const mockBrokenClient = {};

      await assert.rejects(
        () => generateSaleNumber('event-broken', mockBrokenClient),
        /El cliente provisto no soporta operaciones de base de datos/
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Reseteo de Secuencia en Purga de Ventas (salePurgeService)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Reseteo de Secuencia en Purga de Ventas', () => {

    it('6.1: purgeEventSalesTransaction ejecuta DROP SEQUENCE IF EXISTS e invalida caché', async () => {
      let droppedSql = null;
      let eventUpdated = false;

      const mockTx = {
        event: {
          findFirst: async () => ({ id: 'event-purge-1', name: 'Evento Purga' }),
          update: async () => {
            eventUpdated = true;
          },
        },
        sale: {
          count: async () => 15,
          deleteMany: async () => ({ count: 15 }),
        },
        cashClosing: {
          deleteMany: async () => ({ count: 0 }),
        },
        auditLog: {
          create: async () => {},
        },
        $executeRawUnsafe: async (sql) => {
          droppedSql = sql;
        },
      };

      // Simular prisma.$transaction ejecutando el callback con mockTx
      const originalTransaction = purgeEventSalesTransaction;
      // Primero calentamos la caché de la secuencia
      const warmClient = {
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [{ nextval: 10n }],
        event: { findUnique: async () => ({ name: 'Evento Purga' }) },
      };
      await generateSaleNumber('event-purge-1', warmClient);

      // Ejecutar la purga pasando mockTx
      // Nota: purgeEventSalesTransaction usa prisma.$transaction internamente
      // Usamos el import de prisma para mockear $transaction temporalmente
      const { prisma } = await import('../../server/config/prisma.js');
      const originalPrismaTx = prisma.$transaction;
      prisma.$transaction = async (cb) => await cb(mockTx);

      try {
        const result = await purgeEventSalesTransaction({
          tenantId: 'tenant-test',
          eventId: 'event-purge-1',
          userId: 'user-admin',
        });

        assert.strictEqual(result.purgedSalesCount, 15);
        assert.strictEqual(result.currentSaleSequence, 0);
        assert.strictEqual(eventUpdated, true);
        assert.ok(droppedSql.includes('DROP SEQUENCE IF EXISTS sale_seq_event_purge_1'));
      } finally {
        prisma.$transaction = originalPrismaTx;
      }
    });
  });

});
