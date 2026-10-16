import { prisma } from '../../config/prisma.js';

// In-memory cache of sequences already confirmed/created in PostgreSQL
const initializedSequences = new Set();
const initPromises = new Map();

/**
 * Sanitiza el eventId para construir un nombre de secuencia PostgreSQL válido y seguro.
 * Valida contra regex alfanumérico y reemplaza guiones por guiones bajos.
 *
 * @param {string} eventId
 * @returns {string} Nombre seguro de secuencia (ej: sale_seq_c2a86847_5c20_...)
 */
export function getSequenceName(eventId) {
  if (!eventId || typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(eventId) || eventId.length > 50) {
    throw new Error(`ID de evento inválido para secuencia: ${eventId}`);
  }
  const sanitized = eventId.replace(/-/g, '_');
  return `sale_seq_${sanitized}`;
}

/**
 * Invalida la caché en memoria de secuencias inicializadas (útil tras purgas o en tests).
 * @param {string} [eventId]
 */
export function invalidateSequenceCache(eventId) {
  if (eventId) {
    const seqName = getSequenceName(eventId);
    initializedSequences.delete(seqName);
  } else {
    initializedSequences.clear();
  }
}

/**
 * Asegura la creación atómica de la secuencia nativa en PostgreSQL.
 * Arranca en COALESCE(current_sale_sequence, 0) + 1 para prevenir colisiones con ventas previas.
 *
 * @param {object} client - Cliente Prisma o transacción activa
 * @param {string} eventId
 * @param {string} seqName
 */
async function ensureSequenceExists(client, eventId, seqName) {
  if (!eventId || typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(eventId) || eventId.length > 50) {
    throw new Error(`ID de evento inválido para secuencia: ${eventId}`);
  }
  const resolvedSeqName = seqName || getSequenceName(eventId);
  if (initializedSequences.has(resolvedSeqName)) {
    return;
  }
  if (initPromises.has(resolvedSeqName)) {
    return await initPromises.get(resolvedSeqName);
  }

  const promise = (async () => {
    const sql = `
      DO $$
      DECLARE
        start_val int;
        seq_last int;
      BEGIN
        SELECT GREATEST(
          COALESCE((SELECT COALESCE("current_sale_sequence", 0) + 1 FROM "events" WHERE "id" = '${eventId}'), 1),
          COALESCE((
            SELECT MAX(CAST(SUBSTRING("saleNumber" FROM '([0-9]+)$') AS INTEGER)) + 1
            FROM "sales"
            WHERE "eventId" = '${eventId}' AND "saleNumber" ~ '[0-9]+$'
          ), 1)
        ) INTO start_val;

        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = '${resolvedSeqName}') THEN
          EXECUTE 'CREATE SEQUENCE IF NOT EXISTS ${resolvedSeqName} START WITH ' || COALESCE(start_val, 1);
        ELSE
          SELECT COALESCE(last_value, 0) INTO seq_last FROM pg_sequences WHERE sequencename = '${resolvedSeqName}';
          IF seq_last < (COALESCE(start_val, 1) - 1) THEN
            PERFORM setval('${resolvedSeqName}', GREATEST(COALESCE(start_val, 1) - 1, 1), true);
          END IF;
        END IF;
      END $$;
    `;

    if (typeof client.$executeRawUnsafe === 'function') {
      await client.$executeRawUnsafe(sql);
    } else if (typeof client.$queryRawUnsafe === 'function') {
      await client.$queryRawUnsafe(sql);
    }
    initializedSequences.add(resolvedSeqName);
  })();

  initPromises.set(resolvedSeqName, promise);
  try {
    await promise;
  } finally {
    initPromises.delete(resolvedSeqName);
  }
}

/**
 * Genera un número de venta secuencial legible y atómico por evento (ej: CC26-0001).
 * Utiliza secuencias nativas de PostgreSQL (nextval) sin retener candados de fila (RowExclusiveLock).
 *
 * @param {string} eventId
 * @param {object} [tx] - Cliente o transacción de Prisma opcional
 * @returns {Promise<string>}
 */
export async function generateSaleNumber(eventIdOrTx, txOrEventId = prisma) {
  let eventId = eventIdOrTx;
  let client = txOrEventId || prisma;
  if (eventIdOrTx && typeof eventIdOrTx === 'object' && typeof txOrEventId === 'string') {
    client = eventIdOrTx;
    eventId = txOrEventId;
  }

  // Fallback para entornos de pruebas unitarias con mocks de event.update
  if (typeof client.$queryRawUnsafe !== 'function') {
    if (typeof client?.event?.update === 'function') {
      const updatedEvent = await client.event.update({
        where: { id: eventId },
        data: { currentSaleSequence: { increment: 1 } },
        select: { name: true, currentSaleSequence: true },
      });
      const prefix = (updatedEvent?.name
        ? updatedEvent.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
        : '') || 'VENTA';
      const sequential = String(updatedEvent.currentSaleSequence).padStart(4, '0');
      return `${prefix}-${sequential}`;
    }
    throw new Error('El cliente provisto no soporta operaciones de base de datos.');
  }

  const seqName = getSequenceName(eventId);
  await ensureSequenceExists(client, eventId, seqName);

  // Consulta atómica no transaccional a la secuencia nativa con recuperación ante 42P01
  let nextValResult;
  try {
    nextValResult = await client.$queryRawUnsafe(
      `SELECT nextval('${seqName}') AS nextval;`
    );
  } catch (err) {
    if (err?.code === '42P01' || err?.message?.includes('42P01') || err?.message?.includes('does not exist')) {
      initializedSequences.delete(seqName);
      await ensureSequenceExists(client, eventId, seqName);
      nextValResult = await client.$queryRawUnsafe(
        `SELECT nextval('${seqName}') AS nextval;`
      );
    } else {
      throw err;
    }
  }

  const rawSeq = nextValResult?.[0]?.nextval;
  if (rawSeq === undefined || rawSeq === null) {
    throw new Error(`Error obteniendo consecutivo de la secuencia ${seqName}`);
  }
  const seqNumber = Number(rawSeq);

  if (typeof client?.event?.updateMany === 'function') {
    await client.event.updateMany({
      where: { id: eventId, currentSaleSequence: { lt: seqNumber } },
      data: { currentSaleSequence: seqNumber },
    });
  }

  // Obtener nombre del evento mediante SELECT simple (AccessShareLock, 0 bloqueos de tupla)
  let event = null;
  if (typeof client?.event?.findUnique === 'function') {
    event = await client.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });
  }

  const prefix = (event?.name
    ? event.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
    : '') || 'VENTA';

  const sequential = String(seqNumber).padStart(4, '0');
  return `${prefix}-${sequential}`;
}
