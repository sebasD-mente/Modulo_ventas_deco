import { prisma } from '../../config/prisma.js';
import { generateSaleNumber } from './saleNumberGenerator.js';

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
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Calcular totales
    let itemsTotal = 0;
    const itemsData = items.map((item) => {
      const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
      itemsTotal += subtotal;
      return {
        productId: item.productId || null,
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
        items: true,
        payments: true,
        seller: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // 5. Registrar log de auditoría
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: sellerId,
        action: 'VENTA_REGISTRADA',
        entity: 'sale',
        entityId: sale.id,
        details: {
          saleNumber,
          totalAmount,
          itemCount: items.length,
          inputChannel,
        },
      },
    });

    return sale;
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

/**
 * Actualiza una venta existente con recálculo transaccional ACID
 */
export async function updateSaleTransaction({
  saleId,
  tenantId,
  userId,
  items,
  payments,
  discount,
  notes,
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verificar existencia de la venta
    const existing = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, payments: true },
    });

    if (!existing) {
      throw new Error('Venta no encontrada o no pertenece a esta organización.');
    }

    let totalAmount = Number(existing.totalAmount);
    let newDiscount = discount !== undefined ? Number(discount) : Number(existing.discount);

    // 2. Si se actualizaron ítems, reconciliar renglones sin borrar en cascada y recalcular total
    if (items && items.length > 0) {
      let itemsTotal = 0;
      const matchedExistingIds = new Set();

      for (const item of items) {
        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        itemsTotal += subtotal;
        const trimmedDesc = item.description.trim();

        // Buscar correspondencia en ítems existentes para preservar ID y trazabilidad
        const existingItem = existing.items.find((ex) => {
          if (matchedExistingIds.has(ex.id)) return false;
          if (item.id && ex.id === item.id) return true;
          if (!item.id && item.productId && ex.productId === item.productId) return true;
          if (!item.id && !item.productId && ex.description.trim().toLowerCase() === trimmedDesc.toLowerCase()) return true;
          return false;
        });

        if (existingItem) {
          matchedExistingIds.add(existingItem.id);
          await tx.saleItem.update({
            where: { id: existingItem.id },
            data: {
              productId: item.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              // Preserva productionStatus, productionNotes y logs históricos en production_logs
            },
          });
        } else {
          await tx.saleItem.create({
            data: {
              saleId,
              productId: item.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              productionStatus: 'PENDIENTE',
            },
          });
        }
      }

      // Eliminar únicamente los ítems descartados de la venta
      const discardedItemIds = existing.items
        .filter((ex) => !matchedExistingIds.has(ex.id))
        .map((ex) => ex.id);

      if (discardedItemIds.length > 0) {
        await tx.saleItem.deleteMany({
          where: { id: { in: discardedItemIds } },
        });
      }

      totalAmount = Number(Math.max(0, itemsTotal - newDiscount).toFixed(2));
    } else if (discount !== undefined) {
      const itemsTotal = existing.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
      totalAmount = Number(Math.max(0, itemsTotal - newDiscount).toFixed(2));
    }

    // 3. Si se actualizaron métodos de pago, reconstruir pagos
    if (payments && payments.length > 0) {
      await tx.salePayment.deleteMany({ where: { saleId } });
      await tx.salePayment.createMany({
        data: payments.map((p) => ({
          saleId,
          method: p.method,
          amount: p.amount !== undefined ? Number(p.amount) : totalAmount,
          reference: p.reference || null,
          receiptUrl: p.receiptUrl || null,
        })),
      });
    } else if (items || discount !== undefined) {
      // Ajustar monto del pago existente al nuevo total si no enviaron un desglose de pagos explícito
      if (existing.payments.length > 0) {
        await tx.salePayment.update({
          where: { id: existing.payments[0].id },
          data: { amount: totalAmount },
        });
      }
    }

    // 4. Actualizar registro maestro de la venta
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: {
        totalAmount,
        discount: newDiscount,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        items: true,
        payments: true,
        seller: { select: { fullName: true, email: true } },
      },
    });

    // 5. Registro de auditoría inmutable
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: userId || existing.sellerId,
        action: 'VENTA_MODIFICADA',
        entity: 'sale',
        entityId: saleId,
        details: {
          saleNumber: existing.saleNumber,
          previousTotal: Number(existing.totalAmount),
          newTotal: Number(totalAmount),
          previousNotes: existing.notes,
          newNotes: notes,
          paymentMethod: updated.payments?.[0]?.method,
        },
      },
    });

    return updated;
  });
}
