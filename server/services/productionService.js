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
  } else {
    if (status && status !== 'ALL' && ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'].includes(status)) {
      statusFilter = { productionStatus: status };
    }
  }

  const whereClause = {
    sale: {
      tenantId,
      ...(eventId ? { eventId } : {}),
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
          select: {
            id: true,
            name: true,
            sku: true,
            imageUrl: true,
            category: true,
          },
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
            createdAt: true,
            event: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
            seller: {
              select: {
                id: true,
                fullName: true,
              },
            },
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
