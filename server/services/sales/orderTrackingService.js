import { prisma } from '../../config/prisma.js';

export async function isTargetEventArchived({ tenantId, eventId }) {
  if (!prisma.event || typeof prisma.event.findFirst !== 'function') {
    return false;
  }
  try {
    const targetEvent = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      select: { id: true, status: true },
    });
    return Boolean(targetEvent && targetEvent.status === 'ARCHIVADO');
  } catch (_) {
    return false;
  }
}

export async function queryOrderTrackingList({ tenantId, paymentStatus, search, page, limit }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const whereClause = {
    tenantId,
    orderType: 'REDES_PERSONALIZADO',
    status: { not: 'ANULADA' },
  };

  if (paymentStatus === 'CON_SALDO') {
    whereClause.balanceDue = { gt: 0 };
  } else if (paymentStatus === 'PAGADO_TOTAL') {
    whereClause.balanceDue = { lte: 0 };
  }

  if (search && search.trim()) {
    const term = search.trim();
    whereClause.OR = [
      { saleNumber: { contains: term, mode: 'insensitive' } },
      { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      { customer: { phone: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.sale.count({ where: whereClause }),
    prisma.sale.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true, fullName: true, phone: true, email: true,
            deliveryAddress: true, department: true, municipality: true,
          },
        },
        items: {
          select: {
            id: true, description: true, quantity: true, unitPrice: true, subtotal: true,
            material: true, customDimensions: true, customImageUrl: true, productionStatus: true,
          },
        },
        payments: {
          select: {
            id: true, amount: true, method: true, reference: true, receiptUrl: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        seller: { select: { id: true, fullName: true, email: true } },
        pickupEvent: { select: { id: true, name: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
  ]);

  const metricsBase = {
    tenantId,
    orderType: 'REDES_PERSONALIZADO',
    status: { not: 'ANULADA' },
  };

  const [totalCount, pendingBalanceAgg, deliveredCount, inWorkshopCount] = await Promise.all([
    prisma.sale.count({ where: metricsBase }),
    prisma.sale.aggregate({
      where: { ...metricsBase, balanceDue: { gt: 0 } },
      _sum: { balanceDue: true },
      _count: { id: true },
    }),
    prisma.sale.count({ where: { ...metricsBase, status: 'ENTREGADO' } }),
    prisma.sale.count({
      where: {
        ...metricsBase,
        status: { not: 'ENTREGADO' },
        items: { some: { productionStatus: { in: ['PENDIENTE', 'A_PRODUCCION'] } } },
      },
    }),
  ]);

  return {
    orders,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    },
    metrics: {
      totalOrders: totalCount,
      withBalanceCount: pendingBalanceAgg._count.id || 0,
      totalBalancePending: Number(pendingBalanceAgg._sum.balanceDue || 0),
      deliveredCount,
      inWorkshopCount,
    },
  };
}

export async function updateOrderDeliveryRecord({
  id, tenantId, shippingCourier, shippingTrackingNumber,
  isDelivered, deliveryReceiptUrl, deliveryNotes, user, auditAction,
}) {
  const sale = await prisma.sale.findFirst({
    where: { id, tenantId, orderType: 'REDES_PERSONALIZADO' },
  });

  if (!sale) {
    const notFoundErr = new Error('Pedido de redes no encontrado.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (isDelivered === true && Number(sale.balanceDue || 0) > 0) {
    const balanceErr = new Error(
      `No se puede marcar como ENTREGADO el pedido #${sale.saleNumber} porque aún tiene un saldo pendiente de Q ${Number(sale.balanceDue).toFixed(2)}. Registra primero el cobro del saldo.`
    );
    balanceErr.statusCode = 400;
    throw balanceErr;
  }

  const updateData = {};
  if (shippingCourier !== undefined) updateData.shippingCourier = shippingCourier ? shippingCourier.trim() : null;
  if (shippingTrackingNumber !== undefined) updateData.shippingTrackingNumber = shippingTrackingNumber ? shippingTrackingNumber.trim() : null;
  if (isDelivered === true) {
    updateData.status = 'ENTREGADO';
  } else if (isDelivered === false && sale.status === 'ENTREGADO') {
    updateData.status = Number(sale.balanceDue) > 0 ? 'PENDIENTE' : 'COMPLETADA';
  }

  const actorName = user?.fullName || user?.email || 'Usuario';
  const userRoles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [user?.role || 'STAFF'];
  const actorRole = userRoles[0];
  const logDetails = [
    `Logística/Entrega registrada por: ${actorName} (${actorRole})`,
    isDelivered ? 'ESTADO: ENTREGADO' : null,
    deliveryReceiptUrl ? `Recibo: ${deliveryReceiptUrl}` : null,
    deliveryNotes ? `Nota: ${deliveryNotes}` : null,
  ].filter(Boolean).join(' • ');

  const newStamp = `[${logDetails}]`;
  updateData.notes = sale.notes ? `${sale.notes}\n${newStamp}` : newStamp;

  const updated = await prisma.sale.update({
    where: { id },
    data: updateData,
    include: { customer: true, items: true, payments: true },
  });

  try {
    if (prisma.auditLog?.create) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user?.id,
          action: auditAction || (isDelivered ? 'PEDIDO_ENTREGADO' : 'LOGISTICA_ACTUALIZADA'),
          entity: 'sale',
          entityId: sale.id,
          details: {
            saleId: sale.id, saleNumber: sale.saleNumber, isDelivered,
            shippingCourier, shippingTrackingNumber, deliveryReceiptUrl, deliveryNotes,
            actorName, actorRole,
          },
        },
      });
    }
  } catch (auditErr) {
    console.warn('[updateOrderDelivery] Error auditLog:', auditErr.message);
  }

  return updated;
}
