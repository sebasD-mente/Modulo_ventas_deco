import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange } from './saleKpiService.js';

/**
 * Actualiza una venta existente con recálculo transaccional ACID
 */
export async function updateSaleTransaction({
  saleId, tenantId, userId, items, payments, discount, notes,
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Cargar venta para actualización transaccional
    const existing = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, payments: true },
    });

    if (!existing) {
      const error = new Error('Venta no encontrada o no pertenece a esta organización.');
      error.statusCode = 404;
      throw error;
    }

    // 1.1 Inmutabilidad Contable: Validar jornada cerrada o anterior
    const { targetDate: saleDateStr, startOfDay, endOfDay } = getGuatemalaDayRange(existing.createdAt);
    const isPastDay = saleDateStr < getGuatemalaDayRange().targetDate;
    const closingFinder = tx.cashClosing?.findFirst ? tx.cashClosing : null;
    const existingClosing = closingFinder
      ? await closingFinder.findFirst({
          where: { tenantId, eventId: existing.eventId, closingDate: { gte: startOfDay, lte: endOfDay } },
        })
      : null;

    if (isPastDay || existingClosing) {
      const error = new Error('No se puede modificar una venta de una jornada cerrada o anterior.');
      error.statusCode = 403;
      throw error;
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
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true, category: true } },
          },
        },
        payments: true,
        seller: { select: { fullName: true, email: true } },
      },
    });

    // 5. Registro de auditoría inmutable
    await tx.auditLog.create({
      data: {
        tenantId, userId: userId || existing.sellerId, action: 'VENTA_MODIFICADA',
        entity: 'sale', entityId: saleId,
        details: {
          saleNumber: existing.saleNumber, previousTotal: Number(existing.totalAmount),
          newTotal: Number(totalAmount), previousNotes: existing.notes, newNotes: notes,
          paymentMethod: updated.payments?.[0]?.method,
        },
      },
    });

    return updated;
  });
}
