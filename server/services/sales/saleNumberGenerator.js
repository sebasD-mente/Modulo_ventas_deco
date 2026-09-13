import { prisma } from '../../config/prisma.js';

/**
 * Genera un número de venta secuencial legible y atómico por evento (ej: CC26-0001).
 * Ejecuta el incremento atómico en PostgreSQL de forma independiente o en el contexto
 * transaccional provisto, sin retener candados interactivos de fila FOR UPDATE prolongados.
 * 
 * @param {string} eventId
 * @param {object} [tx] - Cliente o transacción de Prisma opcional
 * @returns {Promise<string>}
 */
export async function generateSaleNumber(eventId, tx = prisma) {
  const client = tx || prisma;
  const updatedEvent = await client.event.update({
    where: { id: eventId },
    data: { currentSaleSequence: { increment: 1 } },
    select: { name: true, currentSaleSequence: true },
  });
  const prefix = updatedEvent?.name
    ? updatedEvent.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
    : 'VENTA';
  const sequential = String(updatedEvent.currentSaleSequence).padStart(4, '0');
  return `${prefix}-${sequential}`;
}
