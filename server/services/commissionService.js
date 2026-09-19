import { prisma } from '../config/prisma.js';

function createHttpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Calcula la base imponible neta de productos excluyendo estrictamente el 100% del flete.
 * Base = Math.max(0, itemsSubtotal - discount)
 */
export function calculateSaleProductBase(sale) {
  const itemsSub = sale.itemsSubtotal != null && !Number.isNaN(Number(sale.itemsSubtotal))
    ? Number(sale.itemsSubtotal)
    : (Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items.reduce((acc, it) => acc + Number(it.quantity || 1) * Number(it.unitPrice || 0), 0)
      : Math.max(0, Number(sale.totalAmount || 0) - Number(sale.shippingCost || 0) + Number(sale.discount || 0)));
  return Number(Math.max(0, itemsSub - Number(sale.discount || 0)).toFixed(2));
}

/**
 * Genera el consecutivo atómico mensual de liquidación en formato LIQ-YYYYMM-001
 */
export async function generateSettlementNumber(tenantId, tx = prisma) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `LIQ-${yyyy}${mm}-`;

  const lastSettlement = await tx.commissionSettlement.findFirst({
    where: { tenantId, settlementNumber: { startsWith: prefix } },
    orderBy: { settlementNumber: 'desc' },
    select: { settlementNumber: true },
  });

  let seq = 1;
  if (lastSettlement?.settlementNumber) {
    const parts = lastSettlement.settlementNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastNum)) seq = lastNum + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Consulta ventas pendientes de liquidar con Compuerta de Saldo Cero e Invariante del 20%
 */
export async function getPendingCommissions({ tenantId, sellerId, startDate, endDate }) {
  const where = {
    tenantId,
    status: 'COMPLETADA',
    commissionPaid: false,
    commissionSettlementId: null,
    balanceDue: 0,
  };
  if (sellerId) where.sellerId = sellerId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const rawSales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      items: true,
      seller: { select: { id: true, fullName: true, email: true } },
    },
  });

  const eligibleSales = rawSales.filter((s) => Number(s.balanceDue || 0) === 0 && s.status === 'COMPLETADA');
  const sales = eligibleSales.map((s) => {
    const baseProductos = calculateSaleProductBase(s);
    return {
      ...s,
      baseProductos,
      commissionAmount: Number((baseProductos * 0.20).toFixed(2)),
      shippingCost: Number(s.shippingCost || 0),
    };
  });

  const totalProductsAmount = Number(sales.reduce((sum, s) => sum + s.baseProductos, 0).toFixed(2));
  const totalShippingExcluded = Number(sales.reduce((sum, s) => sum + s.shippingCost, 0).toFixed(2));
  const totalCommission = Number((totalProductsAmount * 0.20).toFixed(2));

  return {
    totalProductsAmount,
    totalShippingExcluded,
    totalCommission,
    salesCount: sales.length,
    commissionRate: 0.20,
    sales,
  };
}

/**
 * Transacción atómica de liquidación: valida compuerta saldo cero, congela ventas y genera LIQ-YYYYMM-001
 */
export async function createSettlementTransaction({ tenantId, sellerId, saleIds, approvedById, notes }) {
  return prisma.$transaction(async (tx) => {
    const seller = await tx.user.findFirst({
      where: { id: sellerId, tenantId },
      select: { id: true, fullName: true, email: true },
    });
    if (!seller) throw createHttpError('Vendedor no encontrado.', 404);

    let sales = [];
    if (saleIds && Array.isArray(saleIds) && saleIds.length > 0) {
      sales = await tx.sale.findMany({
        where: { id: { in: saleIds }, tenantId },
        include: { items: true },
      });
      if (sales.length !== saleIds.length) {
        throw createHttpError('Una o más ventas seleccionadas no existen en la empresa.', 400);
      }
    } else {
      sales = await tx.sale.findMany({
        where: { tenantId, sellerId, status: 'COMPLETADA', commissionPaid: false, commissionSettlementId: null, balanceDue: 0 },
        include: { items: true },
      });
    }

    if (!sales || sales.length === 0) {
      throw createHttpError('No hay ventas elegibles para liquidar', 400);
    }

    for (const sale of sales) {
      if (sale.sellerId !== sellerId) {
        throw createHttpError(`Venta #${sale.saleNumber || sale.id} no pertenece al vendedor seleccionado.`, 400);
      }
      if (Number(sale.balanceDue || 0) > 0 || sale.status !== 'COMPLETADA') {
        throw createHttpError(
          `Venta #${sale.saleNumber || sale.id} no es elegible para liquidación: saldo pendiente o no completada`,
          422
        );
      }
      if (sale.commissionPaid || sale.commissionSettlementId) {
        throw createHttpError(`Venta #${sale.saleNumber || sale.id} ya fue liquidada previamente.`, 400);
      }
    }

    const settlementNumber = await generateSettlementNumber(tenantId, tx);
    const totalProductsAmount = Number(sales.reduce((sum, s) => sum + calculateSaleProductBase(s), 0).toFixed(2));
    const totalCommission = Number((totalProductsAmount * 0.20).toFixed(2));
    const salesCount = sales.length;

    const timestamps = sales.map((s) => new Date(s.createdAt).getTime());
    const settlement = await tx.commissionSettlement.create({
      data: {
        tenantId,
        sellerId,
        settlementNumber,
        totalProductsAmount,
        commissionRate: 0.20,
        totalCommission,
        salesCount,
        periodStart: new Date(Math.min(...timestamps)),
        periodEnd: new Date(Math.max(...timestamps)),
        status: 'PENDIENTE_PAGO',
        approvedById: approvedById || null,
        notes: notes || null,
      },
    });

    await tx.sale.updateMany({
      where: { id: { in: sales.map((s) => s.id) }, tenantId },
      data: { commissionSettlementId: settlement.id, commissionPaid: true },
    });

    if (tx.auditLog?.create) {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: approvedById || sellerId,
          action: 'SETTLEMENT_CREATED',
          entity: 'COMMISSION_SETTLEMENT',
          entityId: settlement.id,
          details: { settlementNumber, totalProductsAmount, totalCommission, salesCount },
        },
      }).catch(() => {});
    }

    return { ...settlement, seller, sales };
  });
}

/**
 * Registra el desembolso efectivo de una liquidación con su comprobante bancario
 */
export async function markSettlementPaid({ tenantId, settlementId, paymentReference, userId, notes }) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.commissionSettlement.findFirst({
      where: { id: settlementId, tenantId },
      include: { seller: { select: { id: true, fullName: true, email: true } } },
    });

    if (!settlement) throw createHttpError('Liquidación no encontrada.', 404);
    if (settlement.status !== 'PENDIENTE_PAGO') {
      throw createHttpError('La liquidación no está en estado PENDIENTE_PAGO', 400);
    }

    const updated = await tx.commissionSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'PAGADO',
        paidAt: new Date(),
        paymentReference: paymentReference.trim(),
        notes: notes !== undefined && notes !== null ? notes : settlement.notes,
      },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (tx.auditLog?.create) {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action: 'SETTLEMENT_PAID',
          entity: 'COMMISSION_SETTLEMENT',
          entityId: settlementId,
          details: { paymentReference: paymentReference.trim() },
        },
      }).catch(() => {});
    }

    return updated;
  });
}

/**
 * Listado paginado de liquidaciones históricas con filtros
 */
export async function getSettlementsList({ tenantId, sellerId, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = { tenantId };
  if (sellerId) where.sellerId = sellerId;
  if (status) where.status = status;

  const [total, settlements] = await Promise.all([
    prisma.commissionSettlement.count({ where }),
    prisma.commissionSettlement.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;
  return {
    settlements,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    hasNext: pageNum < totalPages,
    hasPrev: pageNum > 1,
  };
}

/**
 * Consulta detallada de una liquidación por ID
 */
export async function getSettlementById({ tenantId, settlementId }) {
  const settlement = await prisma.commissionSettlement.findFirst({
    where: { id: settlementId, tenantId },
    include: {
      seller: { select: { id: true, fullName: true, email: true } },
      approvedBy: { select: { id: true, fullName: true, email: true } },
      sales: { include: { items: true } },
    },
  });

  if (!settlement) throw createHttpError('Liquidación no encontrada.', 404);
  return settlement;
}
