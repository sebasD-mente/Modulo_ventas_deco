import { prisma } from '../config/prisma.js';

const SINGLE_VALID_STATUSES = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];
const ARCHIVE_OP1_STATUSES = ['SEPARADO', 'A_PRODUCCION', 'IMPRESO'];
const ACTIVE_COMBINED_STATUSES = ['PENDIENTE', 'A_PRODUCCION'];

/**
 * Resuelve el filtro de estados de producción según el rol del usuario y la bandeja solicitada.
 */
function resolveProductionStatusFilter({ status, isSuperAdmin, hasOp1Role, hasOp2Role, isVendedorRedesOnly }) {
  const isOp1Only = Boolean(hasOp1Role && !hasOp2Role && !isSuperAdmin);
  const isOp2Only = Boolean(hasOp2Role && !hasOp1Role && !isSuperAdmin);

  if (isOp2Only) {
    if (status === 'IMPRESO' || status === 'ARCHIVO_OP2' || status === 'RESUELTOS') {
      return { productionStatus: 'IMPRESO' };
    }
    // Operario 2 solo ve por defecto en su cola activa lo que requiere impresión
    return { productionStatus: 'A_PRODUCCION' };
  }

  if (isOp1Only && !status) {
    // Operario 1 ve por defecto únicamente su cola activa pendiente
    return { productionStatus: 'PENDIENTE' };
  }

  if (status === 'ARCHIVO_OP1' || status === 'RESUELTOS') {
    return { productionStatus: { in: ARCHIVE_OP1_STATUSES } };
  }
  if (status === 'ARCHIVO_OP2') {
    return { productionStatus: 'IMPRESO' };
  }
  if (status === 'COLA_ACTIVA') {
    return { productionStatus: { in: ACTIVE_COMBINED_STATUSES } };
  }
  if (status && status !== 'ALL' && SINGLE_VALID_STATUSES.includes(status)) {
    return { productionStatus: status };
  }

  if (!status && !isVendedorRedesOnly && (isSuperAdmin || (hasOp1Role && hasOp2Role))) {
    return { productionStatus: { in: ACTIVE_COMBINED_STATUSES } };
  }

  return {};
}

/**
 * Servicio para consultar obras de producción con paginación escalable (>300+ diseños),
 * exclusión estricta de ventas anuladas y trazabilidad de auditoría (productionLogs).
 */
export async function getProductionItems({
  tenantId,
  eventId,
  status,
  search,
  page = 1,
  limit = 500,
  userRoles = [],
  userId,
  source = 'ALL',
}) {
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const hasOp1Role = userRoles.includes('OPERARIO_1');
  const hasOp2Role = userRoles.includes('OPERARIO_2');
  const isOperario1 = hasOp1Role || isSuperAdmin;
  const isOperario2 = hasOp2Role || isSuperAdmin;
  const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 500));
  const skip = (parsedPage - 1) * parsedLimit;

  const statusFilter = resolveProductionStatusFilter({
    status,
    isSuperAdmin,
    hasOp1Role,
    hasOp2Role,
    isVendedorRedesOnly,
  });

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
      status: { not: 'ANULADA' },
      ...(eventId ? { eventId } : {}),
      ...(isVendedorRedesOnly && userId ? { sellerId: userId } : {}),
      ...sourceCondition,
    },
    ...statusFilter,
  };

  if (search) {
    whereClause.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { customDimensions: { contains: search, mode: 'insensitive' } },
      { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const isArchiveQuery = ['SEPARADO', 'IMPRESO', 'ARCHIVO_OP1', 'ARCHIVO_OP2', 'RESUELTOS'].includes(status);
  const orderByClause = isArchiveQuery
    ? [{ statusChangedAt: 'desc' }, { createdAt: 'desc' }]
    : { createdAt: 'desc' };

  const [total, items] = await Promise.all([
    prisma.saleItem.count({ where: whereClause }),
    prisma.saleItem.findMany({
      where: whereClause,
      include: {
        product: {
          select: { id: true, name: true, sku: true, imageUrl: true, category: true },
        },
        productionLogs: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
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
      orderBy: orderByClause,
      skip,
      take: parsedLimit,
    }),
  ]);

  return {
    items,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    hasNext: parsedPage * parsedLimit < total,
    hasPrev: parsedPage > 1,
  };
}

/**
 * Actualiza el estado de producción de un ítem con candado de inmutabilidad por etapa y log de auditoría
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
  const hasOp1Role = userRoles.includes('OPERARIO_1');
  const hasOp2Role = userRoles.includes('OPERARIO_2');
  const isOperario1 = hasOp1Role || isSuperAdmin;
  const isOperario2 = hasOp2Role || isSuperAdmin;

  if (!SINGLE_VALID_STATUSES.includes(status)) {
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

    if (item.sale?.status === 'ANULADA') {
      const error = new Error('No se puede procesar producción de una venta anulada.');
      error.statusCode = 403;
      throw error;
    }

    if (status === 'IMPRESO') {
      if (!isOperario2) {
        const error = new Error('No tienes permiso de taller para marcar obras como IMPRESO.');
        error.statusCode = 403;
        throw error;
      }
      if (!isSuperAdmin && item.productionStatus === 'IMPRESO') {
        const error = new Error('Este diseño ya fue impreso y archivado de forma inmutable.');
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
      if (!isSuperAdmin && item.productionStatus !== 'PENDIENTE') {
        const error = new Error('Este diseño ya fue procesado y archivado de forma inmutable.');
        error.statusCode = 403;
        throw error;
      }
    } else if (status === 'SEPARADO') {
      if (!isOperario1) {
        const error = new Error('No tienes permiso de Operario 1 para cambiar el estado a SEPARADO.');
        error.statusCode = 403;
        throw error;
      }
      if (!isSuperAdmin && item.productionStatus !== 'PENDIENTE') {
        const error = new Error('Este diseño ya fue procesado y archivado de forma inmutable.');
        error.statusCode = 403;
        throw error;
      }
    } else if (status === 'PENDIENTE') {
      if (!isSuperAdmin) {
        const error = new Error('Este diseño ya fue procesado y archivado de forma inmutable.');
        error.statusCode = 403;
        throw error;
      }
    }

    const now = new Date();
    const updateData = {
      productionStatus: status,
      productionNotes: notes !== undefined ? notes : item.productionNotes,
      statusChangedAt: now,
      statusChangedById: userId,
    };

    if (status === 'IMPRESO') {
      updateData.impresoAt = now;
      updateData.impresoById = userId;
    }

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

    const updated = await client.saleItem.update({
      where: { id: targetId },
      data: updateData,
      include: {
        product: true,
        productionLogs: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        sale: { include: { event: true } },
      },
    });

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
 * Obtiene métricas en tiempo real de la cola de producción excluyendo ventas anuladas
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
      status: { not: 'ANULADA' },
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

  return {
    pending,
    separated,
    inProduction,
    printed,
    resolved: separated + inProduction + printed,
    total,
  };
}
