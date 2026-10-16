import { prisma } from '../config/prisma.js';

/**
 * Servicio para consultar obras de producción con paginación y filtros nativos
 */
export async function getProductionItems({
  tenantId,
  eventId,
  status,
  search,
  page = 1,
  limit = 50,
  userRoles = [],
  userId,
  source = 'ALL',
}) {
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isOperario1 = userRoles.includes('OPERARIO_1') || isSuperAdmin;
  const isOperario2 = userRoles.includes('OPERARIO_2') || isSuperAdmin;
  const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  let statusFilter = {};
  if (isOperario2 && !isOperario1 && !isSuperAdmin) {
    // Operario 2 solo ve en su cola lo que requiere impresión
    statusFilter = { productionStatus: 'A_PRODUCCION' };
  } else if (status && status !== 'ALL' && ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'].includes(status)) {
    statusFilter = { productionStatus: status };
  }

  let sourceCondition = {};
  if (isVendedorRedesOnly || source === 'PEDIDOS') {
    sourceCondition = {
      orderType: 'REDES_PERSONALIZADO',
      NOT: { paymentStatus: 'PENDIENTE_PAGO' },
    };
  } else if (source === 'REPOSICIONES') {
    sourceCondition = {
      NOT: { orderType: 'REDES_PERSONALIZADO' },
    };
  } else {
    sourceCondition = {
      NOT: {
        orderType: 'REDES_PERSONALIZADO',
        paymentStatus: 'PENDIENTE_PAGO',
      },
    };
  }

  const whereClause = {
    sale: {
      tenantId,
      ...(eventId ? { eventId } : {}),
      ...(isVendedorRedesOnly && userId ? { sellerId: userId } : {}),
      ...sourceCondition,
    },
    ...statusFilter,
  };

  if (search) {
    whereClause.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.saleItem.count({ where: whereClause }),
    prisma.saleItem.findMany({
      where: whereClause,
      include: {
        product: {
          select: { id: true, name: true, sku: true, imageUrl: true, category: true },
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            depositAmount: true,
            balanceDue: true,
            totalAmount: true,
            orderType: true,
            deliveryMethod: true,
            customer: { select: { id: true, fullName: true, phone: true } },
            event: { select: { id: true, name: true, location: true } },
            seller: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
  ]);

  return {
    items,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
    hasNext: parsedPage * parsedLimit < total,
    hasPrev: parsedPage > 1,
  };
}

/**
 * Actualiza el estado de producción de un ítem con validaciones de rol y log de auditoría
 */
export async function updateItemProductionStatus({
  id,
  itemId,
  tenantId = null,
  status,
  notes,
  userId,
  userRoles = [],
}) {
  const targetId = id || itemId;
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isOperario1 = userRoles.includes('OPERARIO_1') || isSuperAdmin;
  const isOperario2 = userRoles.includes('OPERARIO_2') || isSuperAdmin;

  const validStatuses = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Estado de producción no válido.');
    error.statusCode = 400;
    throw error;
  }

  const executeUpdate = async (tx) => {
    const client = tx || prisma;
    const findFn = typeof client.saleItem?.findUnique === 'function'
      ? client.saleItem.findUnique.bind(client.saleItem)
      : prisma.saleItem.findUnique.bind(prisma.saleItem);

    const item = await findFn({
      where: { id: targetId },
      include: { sale: true },
    });

    if (!item) {
      const error = new Error('Obra/Item no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    if (tenantId && item.sale?.tenantId && item.sale.tenantId !== tenantId) {
      const error = new Error('No tienes permiso para modificar obras de otra organización.');
      error.statusCode = 403;
      throw error;
    }

    if (status === 'IMPRESO') {
      if (!isOperario2) {
        const error = new Error('No tienes permiso de taller para marcar obras como IMPRESO.');
        error.statusCode = 403;
        throw error;
      }
      if (item.productionStatus !== 'A_PRODUCCION' && !isSuperAdmin) {
        const error = new Error('Solo se pueden marcar como IMPRESO las obras que están A PRODUCCION.');
        error.statusCode = 403;
        throw error;
      }
    } else if (status === 'A_PRODUCCION') {
      if (!isOperario1) {
        const error = new Error('No tienes permiso de Operario 1 para mover obras a A PRODUCCION.');
        error.statusCode = 403;
        throw error;
      }
    } else if (['SEPARADO', 'PENDIENTE'].includes(status) && !isOperario1) {
      const error = new Error('No tienes permiso de Operario 1 para cambiar el estado a SEPARADO o PENDIENTE.');
      error.statusCode = 403;
      throw error;
    }

    const updateData = {
      productionStatus: status,
      productionNotes: notes !== undefined ? notes : item.productionNotes,
      statusChangedAt: new Date(),
      statusChangedById: userId,
    };

    if (status === 'IMPRESO') {
      updateData.impresoAt = new Date();
      updateData.impresoById = userId;
    }

    const updated = await client.saleItem.update({
      where: { id: targetId },
      data: updateData,
      include: {
        product: true,
        sale: { include: { event: true } },
      },
    });

    if (typeof client.productionLog?.create === 'function') {
      await client.productionLog.create({
        data: {
          saleItemId: targetId,
          previousStatus: item.productionStatus,
          newStatus: status,
          userId,
          notes: notes || null,
        },
      });
    }

    if (tenantId && typeof client.auditLog?.create === 'function') {
      await client.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action: 'PRODUCTION_STATUS_UPDATED',
          entity: 'sale_item',
          entityId: targetId,
          details: { previousStatus: item.productionStatus, newStatus: status, notes: notes || null },
        },
      }).catch(() => {});
    }

    return updated;
  };

  if (typeof prisma.$transaction === 'function') {
    try {
      return await prisma.$transaction(executeUpdate);
    } catch (txErr) {
      if (txErr.message?.includes('Error validating datasource') || txErr.message?.includes('prisma://')) {
        return await executeUpdate(prisma);
      }
      throw txErr;
    }
  }
  return await executeUpdate(prisma);
}

/**
 * Obtiene métricas en tiempo real de la cola de producción
 */
export async function getProductionMetrics({ tenantId, eventId, userRoles = [], userId, source = 'ALL' }) {
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isOperario1 = userRoles.includes('OPERARIO_1') || isSuperAdmin;
  const isOperario2 = userRoles.includes('OPERARIO_2') || isSuperAdmin;
  const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);

  let sourceCondition = {};
  if (isVendedorRedesOnly || source === 'PEDIDOS') {
    sourceCondition = {
      orderType: 'REDES_PERSONALIZADO',
      NOT: { paymentStatus: 'PENDIENTE_PAGO' },
    };
  } else if (source === 'REPOSICIONES') {
    sourceCondition = {
      NOT: { orderType: 'REDES_PERSONALIZADO' },
    };
  } else {
    sourceCondition = {
      NOT: {
        orderType: 'REDES_PERSONALIZADO',
        paymentStatus: 'PENDIENTE_PAGO',
      },
    };
  }

  const whereBase = {
    sale: {
      tenantId,
      ...(eventId ? { eventId } : {}),
      ...(isVendedorRedesOnly && userId ? { sellerId: userId } : {}),
      ...sourceCondition,
    },
  };

  const [pending, separated, inProduction, printed, total] = await Promise.all([
    prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'PENDIENTE' } }),
    prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'SEPARADO' } }),
    prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'A_PRODUCCION' } }),
    prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'IMPRESO' } }),
    prisma.saleItem.count({ where: whereBase }),
  ]);

  return { pending, separated, inProduction, printed, total };
}
