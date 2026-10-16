import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange } from './saleKpiService.js';
import { validateOfficialItemPrice } from '../catalog/catalogSizeResolver.js';

/**
 * Actualiza una venta existente con recálculo transaccional ACID
 */
export async function updateSaleTransaction({
  saleId, tenantId, userId, userRole = null, userRoles = null, assignedEventId = null, items, payments, discount, notes, status,
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

    const roles = Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : (userRole ? [userRole] : []);
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    if (roles.length > 0 && !isSuperAdmin) {
      const isWrongSeller = userId && existing.sellerId && existing.sellerId !== userId;
      const isWrongEvent = assignedEventId && existing.orderType !== 'REDES_PERSONALIZADO' && existing.eventId && existing.eventId !== assignedEventId;
      if (isWrongSeller || isWrongEvent) {
        const error = new Error('No tienes permiso para modificar ventas registradas por otro vendedor o fuera de tu evento.');
        error.statusCode = 403;
        throw error;
      }
    }

    if (existing.commissionPaid || existing.commissionSettlementId) {
      const error = new Error('No se puede modificar ni anular una venta cuya comisión ya fue liquidada.');
      error.statusCode = 403;
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

    const shippingCost = Number(existing.shippingCost || 0);
    let totalAmount = Number(existing.totalAmount);
    let newDiscount = discount !== undefined ? Number(discount) : Number(existing.discount);

    // 2. Si se actualizaron ítems, reconciliar renglones sin borrar en cascada y recalcular total
    if (items && items.length > 0) {
      let itemsTotal = 0;
      const matchedExistingIds = new Set();

      for (const item of items) {
        validateOfficialItemPrice(item);
        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        itemsTotal += subtotal;
        const trimmedDesc = item.description.trim();

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
              productId: item.productId || existingItem.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              customImageUrl: item.customImageUrl !== undefined ? item.customImageUrl : (existingItem.customImageUrl || null),
              productionStatus: existingItem.productionStatus || 'PENDIENTE',
              printSheetId: existingItem.printSheetId || null,
              productionNotes: item.productionNotes !== undefined ? item.productionNotes : (existingItem.productionNotes || null),
              isCustom: item.isCustom !== undefined ? Boolean(item.isCustom) : Boolean(existingItem.isCustom),
              material: item.material !== undefined ? item.material : (existingItem.material || null),
              customDimensions: item.customDimensions !== undefined ? item.customDimensions : (existingItem.customDimensions || null),
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
              customImageUrl: item.customImageUrl || null,
              productionStatus: item.productionStatus || 'PENDIENTE',
              printSheetId: item.printSheetId || null,
              productionNotes: item.productionNotes || null,
              isCustom: Boolean(item.isCustom),
              material: item.material || null,
              customDimensions: item.customDimensions || null,
            },
          });
        }
      }

      const discardedItemIds = existing.items
        .filter((ex) => !matchedExistingIds.has(ex.id))
        .map((ex) => ex.id);

      if (discardedItemIds.length > 0) {
        await tx.saleItem.deleteMany({
          where: { id: { in: discardedItemIds } },
        });
      }

      totalAmount = Number((Math.max(0, itemsTotal - newDiscount) + shippingCost).toFixed(2));
    } else if (discount !== undefined) {
      const itemsTotal = existing.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
      totalAmount = Number((Math.max(0, itemsTotal - newDiscount) + shippingCost).toFixed(2));
    }

    // 3. Si se actualizaron métodos de pago, validar cuadre y reconstruir pagos
    if (payments && payments.length > 0) {
      const paymentsSum = Number(
        payments.reduce((acc, p) => acc + (p.amount !== undefined ? Number(p.amount) : totalAmount), 0).toFixed(2)
      );
      const hasExplicitBalance = Number(existing.balanceDue || 0) > 0 && existing.orderType === 'REDES_PERSONALIZADO';
      if (!hasExplicitBalance && status !== 'ANULADA' && Math.abs(paymentsSum - totalAmount) > 0.01) {
        const error = new Error(
          `La suma de pagos (Q ${paymentsSum.toFixed(2)}) no coincide con el total recalculado de la venta (Q ${totalAmount.toFixed(2)}).`
        );
        error.statusCode = 400;
        throw error;
      }

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
      if (existing.payments.length > 1) {
        const error = new Error('Esta venta tiene pagos divididos; debes enviar el desglose actualizado de pagos.');
        error.statusCode = 400;
        throw error;
      }
      if (existing.payments.length === 1) {
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
        ...(status ? { status, ...(status === 'ANULADA' ? { balanceDue: 0 } : {}) } : {}),
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
        tenantId,
        userId: userId || existing.sellerId,
        action: status === 'ANULADA' ? 'VENTA_ANULADA' : 'VENTA_MODIFICADA',
        entity: 'sale',
        entityId: saleId,
        details: {
          saleNumber: existing.saleNumber,
          previousTotal: Number(existing.totalAmount),
          newTotal: Number(totalAmount),
          previousStatus: existing.status,
          newStatus: status || existing.status,
          previousNotes: existing.notes,
          newNotes: notes,
          paymentMethod: updated.payments?.[0]?.method,
        },
      },
    });

    return updated;
  });
}
