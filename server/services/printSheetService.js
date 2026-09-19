import { prisma } from '../config/prisma.js';

function createHttpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Genera el consecutivo diario del pliego en formato PLI-YYYYMMDD-01, PLI-YYYYMMDD-02, etc.
 */
export async function generateSheetCode(tenantId, tx = prisma) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `PLI-${yyyy}${mm}${dd}-`;

  const lastSheet = await tx.printSheet.findFirst({
    where: { tenantId, sheetCode: { startsWith: datePrefix } },
    orderBy: { sheetCode: 'desc' },
    select: { sheetCode: true },
  });

  let nextSeq = 1;
  if (lastSheet?.sheetCode) {
    const parts = lastSheet.sheetCode.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${datePrefix}${String(nextSeq).padStart(2, '0')}`;
}

/**
 * Crea un nuevo pliego de impresión en estado inicial ABIERTO.
 */
export async function createPrintSheet({ tenantId, userId, material, notes }) {
  return prisma.$transaction(async (tx) => {
    const sheetCode = await generateSheetCode(tenantId, tx);
    return tx.printSheet.create({
      data: {
        tenantId,
        sheetCode,
        material,
        status: 'ABIERTO',
        notes: notes || null,
        createdById: userId || null,
      },
    });
  });
}

/**
 * Asigna ítems de órdenes de venta al pliego con Freno Inquebrantable de Taller (Workshop Brake).
 */
export async function assignItemsToSheet({ tenantId, sheetId, saleItemIds, userId }) {
  return prisma.$transaction(async (tx) => {
    const sheet = await tx.printSheet.findFirst({ where: { id: sheetId, tenantId } });
    if (!sheet) throw createHttpError('Pliego de impresión no encontrado.', 404);

    if (!['ABIERTO', 'EN_PRODUCCION'].includes(sheet.status)) {
      throw createHttpError(`No se pueden asignar ítems a un pliego con estado '${sheet.status}'.`, 400);
    }

    const items = await tx.saleItem.findMany({
      where: { id: { in: saleItemIds }, sale: { tenantId } },
      include: { sale: true },
    });

    if (items.length !== saleItemIds.length) {
      throw createHttpError('Uno o más ítems no fueron encontrados o pertenecen a otro tenant.', 404);
    }

    // 🛡️ Freno Inquebrantable de Taller (Workshop Brake)
    for (const item of items) {
      if (item.sale.status === 'ANULADA') {
        throw createHttpError(`El ítem '${item.description}' pertenece a una orden anulada (#${item.sale.saleNumber}).`, 422);
      }
      if (item.sale.paymentStatus === 'PENDIENTE_ANTICIPO') {
        throw createHttpError(`El ítem '${item.description}' está bloqueado: Orden #${item.sale.saleNumber} no cuenta con anticipo registrado`, 422);
      }
      if (!['ANTICIPO_PAGADO', 'PAGADO_TOTAL'].includes(item.sale.paymentStatus)) {
        throw createHttpError(`El ítem '${item.description}' no cuenta con anticipo válido.`, 422);
      }
    }

    const now = new Date();
    for (const item of items) {
      await tx.saleItem.update({
        where: { id: item.id },
        data: {
          printSheetId: sheetId,
          productionStatus: 'A_PRODUCCION',
          statusChangedAt: now,
          statusChangedById: userId || null,
        },
      });

      await tx.productionLog.create({
        data: {
          saleItemId: item.id,
          previousStatus: item.productionStatus,
          newStatus: 'A_PRODUCCION',
          userId: userId || null,
          notes: `Asignado a pliego ${sheet.sheetCode}`,
        },
      });
    }

    return tx.printSheet.findUnique({
      where: { id: sheetId },
      include: {
        items: {
          include: {
            sale: {
              select: { id: true, saleNumber: true, status: true, paymentStatus: true, customer: true },
            },
          },
        },
      },
    });
  });
}

/**
 * Actualiza el estado del pliego y propaga cascada a los sale_items al pasar a IMPRESO.
 */
export async function updateSheetStatus({ tenantId, sheetId, status, userId, notes }) {
  return prisma.$transaction(async (tx) => {
    const sheet = await tx.printSheet.findFirst({ where: { id: sheetId, tenantId } });
    if (!sheet) throw createHttpError('Pliego de impresión no encontrado.', 404);

    const validTransitions = {
      ABIERTO: ['EN_PRODUCCION', 'IMPRESO', 'TERMINADO'],
      EN_PRODUCCION: ['IMPRESO', 'TERMINADO'],
      IMPRESO: ['TERMINADO'],
      TERMINADO: [],
    };

    if (sheet.status !== status && !validTransitions[sheet.status]?.includes(status)) {
      throw createHttpError(`Transición de estado no válida de ${sheet.status} a ${status}.`, 400);
    }

    const now = new Date();
    const updateData = {
      status,
      notes: notes !== undefined ? notes : sheet.notes,
    };

    if (status === 'IMPRESO' && sheet.status !== 'IMPRESO') {
      updateData.printedAt = now;
      updateData.printedById = userId || null;

      const sheetItems = await tx.saleItem.findMany({ where: { printSheetId: sheetId } });

      await tx.saleItem.updateMany({
        where: { printSheetId: sheetId },
        data: {
          productionStatus: 'IMPRESO',
          impresoAt: now,
          impresoById: userId || null,
          statusChangedAt: now,
          statusChangedById: userId || null,
        },
      });

      for (const item of sheetItems) {
        await tx.productionLog.create({
          data: {
            saleItemId: item.id,
            previousStatus: item.productionStatus,
            newStatus: 'IMPRESO',
            userId: userId || null,
            notes: `Pliego ${sheet.sheetCode} marcado como IMPRESO`,
          },
        });
      }
    }

    return tx.printSheet.update({
      where: { id: sheetId },
      data: updateData,
      include: {
        items: {
          include: {
            sale: {
              select: { id: true, saleNumber: true, status: true, paymentStatus: true, customer: true },
            },
          },
        },
      },
    });
  });
}

/**
 * Consulta paginada y filtrado de pliegos de taller.
 */
export async function getPrintSheets({ tenantId, status, material, search, page = 1, limit = 50 }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const whereClause = { tenantId };
  if (status && status !== 'ALL') whereClause.status = status;
  if (material && material !== 'ALL') whereClause.material = material;
  if (search && search.trim() !== '') {
    whereClause.OR = [
      { sheetCode: { contains: search.trim(), mode: 'insensitive' } },
      { notes: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [total, sheets] = await Promise.all([
    prisma.printSheet.count({ where: whereClause }),
    prisma.printSheet.findMany({
      where: whereClause,
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
  ]);

  return {
    sheets,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
    hasNext: parsedPage * parsedLimit < total,
    hasPrev: parsedPage > 1,
  };
}

/**
 * Obtiene el detalle íntegro de un pliego de taller con sus obras y datos de venta.
 */
export async function getPrintSheetById({ tenantId, sheetId }) {
  const sheet = await prisma.printSheet.findFirst({
    where: { id: sheetId, tenantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          sale: {
            select: {
              id: true,
              saleNumber: true,
              status: true,
              paymentStatus: true,
              orderType: true,
              deliveryMethod: true,
              customer: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!sheet) throw createHttpError('Pliego de impresión no encontrado.', 404);
  return sheet;
}
