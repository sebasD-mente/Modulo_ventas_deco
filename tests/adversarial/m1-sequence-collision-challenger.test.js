import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSaleNumber,
  getSequenceName,
  invalidateSequenceCache,
} from '../../server/services/sales/saleNumberGenerator.js';
import { purgeEventSalesTransaction } from '../../server/services/sales/salePurgeService.js';
import { prisma } from '../../server/config/prisma.js';

/**
 * Simulador de motor PostgreSQL para pruebas adversariales de secuencias nativas.
 * Emula fielmente:
 * - Catálogo pg_sequences
 * - Tabla "events" con columna "current_sale_sequence"
 * - Bloques PL/pgSQL DO $$ con SELECT ... INTO y EXECUTE CREATE SEQUENCE
 * - nextval() atómico no transaccional
 * - DROP SEQUENCE IF EXISTS
 */
class MockPostgreSQLEngine {
  constructor() {
    this.sequences = new Map(); // name -> { current: number, startWith: number }
    this.events = new Map();    // id -> { id, name, current_sale_sequence }
    this.executedDdl = [];
    this.executedQueries = [];
    this.droppedSequences = [];
  }

  addEvent(event) {
    this.events.set(event.id, {
      id: event.id,
      name: event.name || 'STAND',
      current_sale_sequence: event.current_sale_sequence ?? event.currentSaleSequence ?? 0,
    });
  }

  async executeDdl(sql) {
    this.executedDdl.push(sql);

    // Emular ejecución del DO block PL/pgSQL
    if (sql.includes('DO $$') && sql.includes('pg_sequences')) {
      const seqMatch = sql.match(/sequencename = '([^']+)'/);
      const eventMatch = sql.match(/FROM "events" WHERE id = '([^']+)'/);

      assert.ok(seqMatch, 'El bloque DO debe consultar pg_sequences por sequencename');
      assert.ok(eventMatch, 'El bloque DO debe consultar la tabla "events" filtrando por id');

      const seqName = seqMatch[1];
      const eventId = eventMatch[1];

      // IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = '${seqName}')
      if (!this.sequences.has(seqName)) {
        const eventRow = this.events.get(eventId);
        // SELECT COALESCE("current_sale_sequence", 0) + 1 INTO current_seq FROM "events" WHERE id = '${eventId}';
        let current_seq = null;
        if (eventRow) {
          const val = eventRow.current_sale_sequence;
          current_seq = (val !== null && val !== undefined ? Number(val) : 0) + 1;
        }

        // EXECUTE 'CREATE SEQUENCE IF NOT EXISTS ${seqName} START WITH ' || COALESCE(current_seq, 1);
        const startWith = current_seq !== null ? current_seq : 1;

        this.sequences.set(seqName, {
          startWith,
          current: startWith - 1, // El primer nextval() devolverá startWith
          totalCalls: 0,
        });
      }
      return;
    }

    // DROP SEQUENCE IF EXISTS
    const dropMatch = sql.match(/DROP SEQUENCE IF EXISTS ([a-zA-Z0-9_]+);?/);
    if (dropMatch) {
      const seqName = dropMatch[1];
      this.droppedSequences.push(seqName);
      this.sequences.delete(seqName);
      return;
    }

    throw new Error(`DDL no reconocido en MockPostgreSQLEngine: ${sql}`);
  }

  async executeQuery(sql) {
    this.executedQueries.push(sql);

    // SELECT nextval('seq_name') AS nextval;
    const nextvalMatch = sql.match(/SELECT nextval\('([^']+)'\) AS nextval/);
    if (nextvalMatch) {
      const seqName = nextvalMatch[1];
      const seq = this.sequences.get(seqName);
      if (!seq) {
        throw new Error(`relation "${seqName}" does not exist in PostgreSQL`);
      }
      seq.current += 1;
      seq.totalCalls += 1;
      return [{ nextval: BigInt(seq.current) }];
    }

    throw new Error(`Consulta no reconocida en MockPostgreSQLEngine: ${sql}`);
  }

  getClient() {
    return {
      $executeRawUnsafe: async (sql) => this.executeDdl(sql),
      $queryRawUnsafe: async (sql) => this.executeQuery(sql),
      event: {
        findUnique: async ({ where }) => {
          const ev = this.events.get(where.id);
          return ev ? { name: ev.name } : null;
        },
        findFirst: async ({ where }) => {
          const ev = this.events.get(where.id);
          return ev ? { id: ev.id, name: ev.name } : null;
        },
        update: async ({ where, data }) => {
          const ev = this.events.get(where.id);
          if (ev && data.currentSaleSequence !== undefined) {
            ev.current_sale_sequence = data.currentSaleSequence;
          }
          return ev;
        },
      },
    };
  }
}

describe('⚔️ ADVERSARIAL STRESS TEST: Sequence Collision Prevention & Purge Invalidation (M1)', () => {

  beforeEach(() => {
    invalidateSequenceCache();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Prevención Empírica de Colisiones con Ventas Preexistentes (currentSaleSequence = 45)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Prevención Empírica de Colisiones con Secuencia Preexistente', () => {

    it('1.1: Con currentSaleSequence = 45, la secuencia arranca en 46 y genera COMI-0046 (NO COMI-0001)', async () => {
      const engine = new MockPostgreSQLEngine();
      const eventId = 'event-preexisting-45';
      engine.addEvent({
        id: eventId,
        name: 'Comic Con 2026',
        current_sale_sequence: 45, // 45 ventas previas registradas
      });

      const client = engine.getClient();

      // Generar primera venta bajo el nuevo sistema
      const firstTicket = await generateSaleNumber(eventId, client);

      // Verificación 1: El primer ticket DEBE ser COMI-0046 (NUNCA COMI-0001)
      assert.strictEqual(
        firstTicket,
        'COMI-0046',
        'La primera venta tras migrar debe ser la #46 para prevenir colisión con las 45 anteriores'
      );

      // Verificación 2: La secuencia en el motor se inicializó con START WITH 46
      const seqName = getSequenceName(eventId);
      const seqState = engine.sequences.get(seqName);
      assert.ok(seqState, `La secuencia ${seqName} debe existir en el motor`);
      assert.strictEqual(seqState.startWith, 46, 'START WITH debe ser exactamente 45 + 1 = 46');
      assert.strictEqual(seqState.current, 46, 'El valor actual tras primer nextval() debe ser 46');

      // Verificación 3: El DDL ejecutado contiene la lógica requerida
      const ddl = engine.executedDdl[0];
      assert.ok(ddl.includes('COALESCE("current_sale_sequence", 0) + 1 INTO current_seq'));
      assert.ok(ddl.includes('FROM "events" WHERE id ='));
      assert.ok(ddl.includes(`sequencename = '${seqName}'`));

      // Verificación 4: Ventas subsecuentes continúan secuencialmente: 47, 48, 49
      const secondTicket = await generateSaleNumber(eventId, client);
      const thirdTicket = await generateSaleNumber(eventId, client);
      assert.strictEqual(secondTicket, 'COMI-0047');
      assert.strictEqual(thirdTicket, 'COMI-0048');

      // Verificación 5: Ningún ticket colisiona con el rango 1..45
      const generatedSeqs = [firstTicket, secondTicket, thirdTicket].map((t) =>
        parseInt(t.split('-')[1], 10)
      );
      for (const s of generatedSeqs) {
        assert.ok(s > 45, `Secuencia ${s} debe ser estrictamente mayor a 45`);
      }
    });

    it('1.2: 100 llamadas concurrentes sobre evento con seq=45 generan exactamente 46..145 sin colisiones', async () => {
      const engine = new MockPostgreSQLEngine();
      const eventId = 'event-stress-45';
      engine.addEvent({
        id: eventId,
        name: 'Anime Fest',
        current_sale_sequence: 45,
      });

      const client = engine.getClient();
      const count = 100;

      // 100 solicitudes simultáneas
      const tickets = await Promise.all(
        Array.from({ length: count }, () => generateSaleNumber(eventId, client))
      );

      // Verificación 1: Exactamente 100 tickets devueltos
      assert.strictEqual(tickets.length, count);

      // Verificación 2: 100 tickets ÚNICOS (cero duplicados)
      const uniqueTickets = new Set(tickets);
      assert.strictEqual(uniqueTickets.size, count, 'No debe existir ningún ticket duplicado');

      // Verificación 3: Rango exacto de 46 a 145
      for (let i = 46; i <= 145; i++) {
        const expected = `ANIM-${String(i).padStart(4, '0')}`;
        assert.ok(uniqueTickets.has(expected), `Debe contener el ticket ${expected}`);
      }

      // Verificación 4: CERO tickets entre 1 y 45
      for (let i = 1; i <= 45; i++) {
        const forbidden = `ANIM-${String(i).padStart(4, '0')}`;
        assert.ok(!uniqueTickets.has(forbidden), `JAMÁS debe generar ticket colisionante: ${forbidden}`);
      }

      // Verificación 5: El bloque DO de inicialización DDL se ejecutó exactamente UNA sola vez
      assert.strictEqual(
        engine.executedDdl.length,
        1,
        'El bloque DO DDL debe ejecutarse solo una vez gracias a initPromises y caché'
      );
    });

    it('1.3: Con currentSaleSequence = 0 o NULL (evento nuevo), arranca limpiamente en 1', async () => {
      const engine = new MockPostgreSQLEngine();
      const eventId = 'event-new-zero';
      engine.addEvent({
        id: eventId,
        name: 'Expo Bazar',
        current_sale_sequence: 0,
      });

      const client = engine.getClient();
      const ticket = await generateSaleNumber(eventId, client);
      assert.strictEqual(ticket, 'EXPO-0001');

      const seqState = engine.sequences.get(getSequenceName(eventId));
      assert.strictEqual(seqState.startWith, 1);
    });

    it('1.4: Con evento con secuencia alta (9999), arranca en 10000 sin truncar el formato', async () => {
      const engine = new MockPostgreSQLEngine();
      const eventId = 'event-high-9999';
      engine.addEvent({
        id: eventId,
        name: 'Mega Con',
        current_sale_sequence: 9999,
      });

      const client = engine.getClient();
      const ticket = await generateSaleNumber(eventId, client);
      assert.strictEqual(ticket, 'MEGA-10000');

      const seqState = engine.sequences.get(getSequenceName(eventId));
      assert.strictEqual(seqState.startWith, 10000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Verificación Empírica de Purga y Reseteo de Secuencia (salePurgeService)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Verificación de Purga y Reseteo de Secuencia', () => {

    it('2.1: Purga ejecuta DROP SEQUENCE IF EXISTS, invalida caché y la siguiente venta arranca en 1', async () => {
      const engine = new MockPostgreSQLEngine();
      const eventId = 'event-purge-test';
      const seqName = getSequenceName(eventId);

      engine.addEvent({
        id: eventId,
        name: 'Gaming Expo',
        current_sale_sequence: 80, // Ventas previas
      });

      const client = engine.getClient();

      // Paso 1: Generar una venta antes de purgar
      const preTicket = await generateSaleNumber(eventId, client);
      assert.strictEqual(preTicket, 'GAMI-0081');

      // Verificar que la secuencia existe en motor y en caché en memoria
      assert.ok(engine.sequences.has(seqName));

      // Paso 2: Ejecutar la purga simulada conectando tx a nuestro engine
      const mockTx = {
        event: {
          findFirst: async () => ({ id: eventId, name: 'Gaming Expo' }),
          update: async ({ data }) => {
            const ev = engine.events.get(eventId);
            if (ev) ev.current_sale_sequence = data.currentSaleSequence;
          },
        },
        sale: {
          count: async () => 81,
          deleteMany: async () => ({ count: 81 }),
        },
        cashClosing: {
          deleteMany: async () => ({ count: 1 }),
        },
        auditLog: {
          create: async () => {},
        },
        $executeRawUnsafe: async (sql) => engine.executeDdl(sql),
      };

      const originalTransaction = prisma.$transaction;
      prisma.$transaction = async (cb) => await cb(mockTx);

      try {
        const purgeResult = await purgeEventSalesTransaction({
          tenantId: 'tenant-gaming',
          eventId,
          userId: 'super-admin-id',
        });

        // Verificación de la purga
        assert.strictEqual(purgeResult.currentSaleSequence, 0);
        assert.strictEqual(purgeResult.purgedSalesCount, 81);

        // Verificación en el motor: DROP SEQUENCE IF EXISTS ejecutado
        assert.ok(
          engine.droppedSequences.includes(seqName),
          `El motor debió registrar DROP SEQUENCE IF EXISTS para ${seqName}`
        );
        assert.strictEqual(engine.sequences.has(seqName), false, 'La secuencia debe ser eliminada del motor');

        // Paso 3: Generar una nueva venta POST-PURGA
        // La caché fue invalidada por salePurgeService.js -> el DO block se vuelve a ejecutar
        // Ahora "events".current_sale_sequence = 0
        // La nueva secuencia DEBE arrancar en 1 (START WITH 1)
        const postPurgeTicket = await generateSaleNumber(eventId, client);

        assert.strictEqual(
          postPurgeTicket,
          'GAMI-0001',
          'La primera venta tras purga DEBE ser GAMI-0001 (reseteo total verificado)'
        );

        const newSeqState = engine.sequences.get(seqName);
        assert.strictEqual(newSeqState.startWith, 1, 'Nueva secuencia debe tener START WITH 1');
        assert.strictEqual(newSeqState.current, 1, 'Valor actual debe ser 1');
      } finally {
        prisma.$transaction = originalTransaction;
      }
    });

    it('2.2: invalidateSequenceCache elimina selectivamente solo la secuencia indicada', async () => {
      const engine = new MockPostgreSQLEngine();
      engine.addEvent({ id: 'ev-alpha', name: 'Alpha Fest', current_sale_sequence: 10 });
      engine.addEvent({ id: 'ev-beta', name: 'Beta Fest', current_sale_sequence: 20 });

      const client = engine.getClient();

      await generateSaleNumber('ev-alpha', client);
      await generateSaleNumber('ev-beta', client);

      assert.strictEqual(engine.executedDdl.length, 2); // 1 DO block por evento

      // Llamar de nuevo -> usan caché en memoria (0 nuevos DDLs)
      await generateSaleNumber('ev-alpha', client);
      await generateSaleNumber('ev-beta', client);
      assert.strictEqual(engine.executedDdl.length, 2);

      // Invalidar SOLO ev-alpha
      invalidateSequenceCache('ev-alpha');

      // ev-beta sigue en caché (no ejecuta DDL)
      await generateSaleNumber('ev-beta', client);
      assert.strictEqual(engine.executedDdl.length, 2);

      // ev-alpha fue invalidado (ejecuta DDL de nuevo)
      await generateSaleNumber('ev-alpha', client);
      assert.strictEqual(engine.executedDdl.length, 3);
    });
  });

});
