import { prisma } from '../../config/prisma.js';
import { generateSaleNumber } from './saleNumberGenerator.js';

export { updateSaleTransaction } from './saleUpdateService.js';

/**
 * Registra una venta completa con integridad transaccional ACID
 */
export async function createSaleTransaction({
  tenantId,
  sellerId,
  eventId,
  items,
  payments,
  discount = 0,
  notes = null,
  inputChannel = 'MANUAL_POS',
  attachments = [],
  idempotencyKey = null,
}) {
  // RFC 7231 Fast-Path idempotency check (pre-transaction)
  if (idempotencyKey) {
    const existingSale = await prisma.sale.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        payments: true,
        seller: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (existingSale) {
      return { ...existingSale, idempotentReplay: true };
    }
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = (val) => typeof val === 'string' && UUID_REGEX.test(val.trim());
  const candidateSkus = [...new Set((items || [])
    .filter((i) => !isUuid(i.productId) && (i.posterId || i.productId))
    .map((i) => String(i.posterId || i.productId).trim()))];
  const matched = candidateSkus.length > 0
    ? await prisma.product.findMany({ where: { tenantId, sku: { in: candidateSkus } }, select: { id: true, sku: true } })
    : [];
  const skuMap = new Map(matched.map((p) => [p.sku, p.id]));

  try {
    return await prisma.$transaction(async (tx) => {
      // In-transaction secondary check
      if (idempotencyKey) {
        const existing = await tx.sale.findUnique({
          where: { idempotencyKey },
          include: {
            items: true,
            payments: true,
            seller: { select: { id: true, fullName: true, email: true } },
          },
        });
        if (existing) return { ...existing, idempotentReplay: true };
      }

      // 1. Calcular totales
      let itemsTotal = 0;
      const itemsData = items.map((item) => {
        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        itemsTotal += subtotal;
        const pId = isUuid(item.productId) ? item.productId : (skuMap.get(String(item.posterId || item.productId || '').trim()) || null);
        return {
          productId: pId,
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        };
      });

      const totalAmount = Number(Math.max(0, itemsTotal - discount).toFixed(2));

      // 2. Validar que los métodos de pago cubran el monto
      const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      if (Math.abs(paymentsTotal - totalAmount) > 0.05) {
        throw new Error(`El monto pagado (Q ${paymentsTotal.toFixed(2)}) no coincide con el total de la venta (Q ${totalAmount.toFixed(2)})`);
      }

      // 3. Generar consecutivo atómico
      const saleNumber = await generateSaleNumber(eventId, tx);

      // 4. Crear registro maestro de venta
      const sale = await tx.sale.create({
        data: {
          tenantId,
          eventId,
          sellerId,
          saleNumber,
          totalAmount,
          discount,
          notes,
          inputChannel,
          idempotencyKey: idempotencyKey || null,
          items: {
            create: itemsData,
          },
          payments: {
            create: payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference || null,
              receiptUrl: p.receiptUrl || null,
            })),
          },
          attachments: attachments.length > 0 ? {
            create: attachments.map((a) => ({
              fileUrl: a.fileUrl,
              fileType: a.fileType,
              transcription: a.transcription || null,
              aiMetadata: a.aiMetadata || null,
            })),
          } : undefined,
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true, category: true } } } },
          payments: true,
          seller: { select: { id: true, fullName: true, email: true } },
        },
      });

      // 5. Registrar log de auditoría
      await tx.auditLog.create({
        data: {
          tenantId, userId: sellerId, action: 'VENTA_REGISTRADA',
          entity: 'sale', entityId: sale.id,
          details: { saleNumber, totalAmount, itemCount: items.length, inputChannel },
        },
      });

      return sale;
    }, {
      maxWait: 15000,
      timeout: 30000,
    });
  } catch (err) {
    // Intercept Prisma P2002 error on idempotencyKey (concurrent race recovery)
    if (
      idempotencyKey &&
      (err.code === 'P2002' ||
        err.message?.includes('idempotencyKey') ||
        err.message?.includes('sales_idempotencyKey_key'))
    ) {
      const existing = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: {
          items: true,
          payments: true,
          seller: { select: { id: true, fullName: true, email: true } },
        },
      });
      if (existing) return { ...existing, idempotentReplay: true };
    }
    throw err;
  }
}
