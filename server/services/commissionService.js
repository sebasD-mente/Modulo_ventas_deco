import { prisma } from '../config/prisma.js';
import { getGuatemalaDayRange } from './sales/saleKpiService.js';

const ELIGIBLE_SALE_STATUSES = ['COMPLETADA', 'ENTREGADO'];

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
export async function generateSettlementNumber(tenantIdOrTx, txOrTenantId = prisma) {
  let tenantId = tenantIdOrTx;
  let tx = txOrTenantId || prisma;
  if (tenantIdOrTx && typeof tenantIdOrTx === 'object' && typeof txOrTenantId === 'string') {
    tx = tenantIdOrTx;
    tenantId = txOrTenantId;
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `LIQ-${yyyy}${mm}-`;

  let maxSeq = 0;
  if (typeof tx.commissionSettlement?.findMany === 'function') {
    const existing = await tx.commissionSettlement.findMany({
      where: { tenantId, settlementNumber: { startsWith: prefix } },
      select: { settlementNumber: true },
    });
    for (const s of existing) {
      const parts = String(s.settlementNumber || '').split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(num) && num > maxSeq) maxSeq = num;
    }
  } else if (typeof tx.commissionSettlement?.findFirst === 'function') {
    const lastSettlement = await tx.commissionSettlement.findFirst({
      where: { tenantId, settlementNumber: { startsWith: prefix } },
      orderBy: { settlementNumber: 'desc' },
      select: { settlementNumber: true },
    });
    if (lastSettlement?.settlementNumber) {
      const parts = String(lastSettlement.settlementNumber).split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastNum)) maxSeq = lastNum;
    }
  }

  const seq = maxSeq + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Consulta ventas pendientes de liquidar con Compuerta de Saldo Cero e Invariante del 20%
 */
export async function getPendingCommissions({ tenantId, sellerId, startDate, endDate }) {
  const where = {
    tenantId,
    orderType: 'REDES_PERSONALIZADO',
    status: { in: ELIGIBLE_SALE_STATUSES },
    commissionPaid: false,
    commissionSettlementId: null,
    balanceDue: 0,
  };
  if (sellerId) where.sellerId = sellerId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const isDateOnly = typeof startDate === 'string' && !startDate.includes('T');
      where.createdAt.gte = isDateOnly ? getGuatemalaDayRange(startDate).startOfDay : new Date(startDate);
    }
    if (endDate) {
      const isDateOnly = typeof endDate === 'string' && !endDate.includes('T');
      where.createdAt.lte = isDateOnly ? getGuatemalaDayRange(endDate).endOfDay : new Date(endDate);
    }
  }

  const rawSales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      items: true,
      seller: { select: { id: true, fullName: true, email: true } },
    },
  });

  const eligibleSales = (rawSales || []).filter(
    (s) =>
      Number(s.balanceDue || 0) === 0 &&
      ELIGIBLE_SALE_STATUSES.includes(s.status) &&
      (!s.orderType || s.orderType === 'REDES_PERSONALIZADO')
  );
  const sales = eligibleSales.map((s) => {
    const baseProductos = calculateSaleProductBase(s);
    return {
      ...s,
      baseProductos,
      commissionAmount: Number((baseProductos * 0.20).toFixed(2)),
      shippingCost: Number(s.shippingCost || 0),
    };
  });

  let salesWaitingBalance = [];
  if (typeof prisma.sale?.findMany === 'function') {
    try {
      const rawWaiting = await prisma.sale.findMany({
        where: {
          tenantId,
          orderType: 'REDES_PERSONALIZADO',
          ...(sellerId ? { sellerId } : {}),
          status: { not: 'ANULADA' },
          balanceDue: { gt: 0 },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          customer: { select: { id: true, fullName: true, phone: true } },
          seller: { select: { id: true, fullName: true, email: true } },
        },
      });
      salesWaitingBalance = (rawWaiting || []).filter(
        (s) => Number(s.balanceDue || 0) > 0 && s.status !== 'ANULADA' && (!s.orderType || s.orderType === 'REDES_PERSONALIZADO')
      );
    } catch (_) {
      salesWaitingBalance = [];
    }
  }

  const waitingSummary = {
    count: salesWaitingBalance.length,
    totalBalance: Number(salesWaitingBalance.reduce((acc, s) => acc + Number(s.balanceDue || 0), 0).toFixed(2)),
    potentialCommission: Number(
      salesWaitingBalance.reduce((acc, s) => acc + Number((calculateSaleProductBase(s) * 0.20).toFixed(2)), 0).toFixed(2)
    ),
  };

  const totalProductsAmount = Number(sales.reduce((sum, s) => sum + s.baseProductos, 0).toFixed(2));
  const totalShippingExcluded = Number(sales.reduce((sum, s) => sum + s.shippingCost, 0).toFixed(2));
  const totalCommission = Number(sales.reduce((sum, s) => sum + s.commissionAmount, 0).toFixed(2));

  return {
    totalProductsAmount,
    totalShippingExcluded,
    totalCommission,
    salesCount: sales.length,
    commissionRate: 0.20,
    sales,
    salesWaitingBalance,
    waitingSummary,
  };
}

/**
 * Transacción atómica de liquidación: valida compuerta saldo cero, congela ventas y genera LIQ-YYYYMM-001
 */
export async function createSettlementTransaction({ tenantId, sellerId, saleIds, approvedById, notes }) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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
            where: {
              tenantId,
              sellerId,
              orderType: 'REDES_PERSONALIZADO',
              status: { in: ELIGIBLE_SALE_STATUSES },
              commissionPaid: false,
              commissionSettlementId: null,
              balanceDue: 0,
            },
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
          if (sale.orderType && sale.orderType !== 'REDES_PERSONALIZADO') {
            throw createHttpError(`Venta #${sale.saleNumber || sale.id} no es un pedido de Redes Sociales elegible para comisión.`, 422);
          }
          if (Number(sale.balanceDue || 0) > 0 || !ELIGIBLE_SALE_STATUSES.includes(sale.status)) {
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
        const totalCommission = Number(
          sales.reduce((sum, s) => sum + Number((calculateSaleProductBase(s) * 0.20).toFixed(2)), 0).toFixed(2)
        );
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

        const updatedSales = await tx.sale.updateMany({
          where: {
            id: { in: sales.map((s) => s.id) },
            tenantId,
            commissionSettlementId: null,
            commissionPaid: false,
          },
          data: { commissionSettlementId: settlement.id, commissionPaid: false },
        });
        if (updatedSales && typeof updatedSales.count === 'number' && updatedSales.count !== sales.length) {
          throw createHttpError('Una o más ventas ya fueron incluidas en otra liquidación concurrente.', 409);
        }

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
    } catch (err) {
      if (err?.code === 'P2002' && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }
  }
}

export const createCommissionSettlement = createSettlementTransaction;

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

    if (typeof tx.sale?.updateMany === 'function') {
      await tx.sale.updateMany({
        where: { tenantId, commissionSettlementId: settlementId },
        data: { commissionPaid: true },
      });
    }

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

/**
 * Rechaza una liquidación pendiente y libera las ventas asociadas
 */
export async function rejectSettlement({ tenantId, settlementId, userId, reason }) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.commissionSettlement.findFirst({ where: { id: settlementId, tenantId } });
    if (!settlement) throw createHttpError('Liquidación no encontrada.', 404);
    if (settlement.status === 'PAGADO') throw createHttpError('No se puede rechazar una liquidación ya pagada.', 400);

    const updated = await tx.commissionSettlement.update({
      where: { id: settlementId },
      data: { status: 'RECHAZADA', notes: reason ? `${settlement.notes ? settlement.notes + ' | ' : ''}Rechazada: ${reason}` : settlement.notes },
    });
    if (typeof tx.sale?.updateMany === 'function') {
      await tx.sale.updateMany({
        where: { commissionSettlementId: settlement.id, tenantId },
        data: { commissionSettlementId: null, commissionPaid: false },
      });
    }
    return updated;
  });
}

/**
 * Anula una liquidación pendiente y libera las ventas asociadas
 */
export async function cancelSettlement({ tenantId, settlementId, userId, reason }) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.commissionSettlement.findFirst({ where: { id: settlementId, tenantId } });
    if (!settlement) throw createHttpError('Liquidación no encontrada.', 404);
    if (settlement.status === 'PAGADO') throw createHttpError('No se puede anular una liquidación ya pagada.', 400);

    const updated = await tx.commissionSettlement.update({
      where: { id: settlementId },
      data: { status: 'ANULADA', notes: reason ? `${settlement.notes ? settlement.notes + ' | ' : ''}Anulada: ${reason}` : settlement.notes },
    });
    if (typeof tx.sale?.updateMany === 'function') {
      await tx.sale.updateMany({
        where: { commissionSettlementId: settlement.id, tenantId },
        data: { commissionSettlementId: null, commissionPaid: false },
      });
    }
    return updated;
  });
}
