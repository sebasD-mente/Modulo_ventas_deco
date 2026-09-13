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
}) {
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isOperario1 = userRoles.includes('OPERARIO_1') || isSuperAdmin;
  const isOperario2 = userRoles.includes('OPERARIO_2') || isSuperAdmin;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  let statusFilter = {};
  if (isOperario2 && !isOperario1 && !isSuperAdmin) {
    statusFilter = { productionStatus: 'A_PRODUCCION' };
  } else if (status && status !== 'ALL' && ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'].includes(status)) {
    statusFilter = { productionStatus: status };
  }

  const whereClause = {
    sale: { tenantId, ...(eventId ? { eventId } : {}) },
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
  status,
  notes,
  userId,
  userRoles = [],
}) {
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isOperario1 = userRoles.includes('OPERARIO_1') || isSuperAdmin;
  const isOperario2 = userRoles.includes('OPERARIO_2') || isSuperAdmin;

  const validStatuses = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Estado de producción no válido.');
    error.statusCode = 400;
    throw error;
  }

  const item = await prisma.saleItem.findUnique({
    where: { id },
    include: { sale: true },
  });

  if (!item) {
    const error = new Error('Obra/Item no encontrado.');
    error.statusCode = 404;
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
  } else if (['SEPARADO', 'A_PRODUCCION', 'PENDIENTE'].includes(status) && !isOperario1) {
    const error = new Error('No tienes permiso de Operario 1 para cambiar el estado a SEPARADO, A PRODUCCION o PENDIENTE.');
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

  const updatedItem = await prisma.$transaction(async (tx) => {
    const updated = await tx.saleItem.update({
      where: { id },
      data: updateData,
      include: {
        product: true,
        sale: { include: { event: true } },
      },
    });

    await tx.productionLog.create({
      data: {
        saleItemId: id,
        previousStatus: item.productionStatus,
        newStatus: status,
        userId,
        notes: notes || null,
      },
    });

    return updated;
  });

  return updatedItem;
}

/**
 * Obtiene métricas en tiempo real de la cola de producción
 */
export async function getProductionMetrics({ tenantId, eventId }) {
  const whereBase = {
    sale: { tenantId, ...(eventId ? { eventId } : {}) },
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
