import { prisma } from '../config/prisma.js';
import {
  createSaleTransaction, updateSaleTransaction, getEventKPIs,
  getMonitorDashboardMetrics,
  getEventSalesList as getEventSalesServiceList, purgeEventSalesTransaction,
} from '../services/saleService.js';

export { postCashClosing, getCashClosingsList } from './cashClosingController.js';

export async function createSale(req, res) {
  try {
    const { eventId, items, payments, discount, notes, inputChannel, attachments, idempotencyKey: bodyKey } = req.body;
    const sellerId = req.user?.id;
    const tenantId = req.tenantId;
    const rawKey = req.headers['idempotency-key'] || bodyKey || null;
    const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim() : null;

    if (!sellerId || !tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de usuario o empresa no válido.' });
    }

    const sale = await createSaleTransaction({
      tenantId, sellerId, eventId, items, payments, discount, notes, inputChannel,
      attachments: attachments || [], idempotencyKey,
    });

    if (sale.idempotentReplay) {
      return res.status(200).json({
        success: true, idempotentReplay: true,
        message: 'Venta previamente registrada (Idempotent Replay).', data: sale,
      });
    }

    return res.status(201).json({ success: true, message: 'Venta registrada exitosamente.', data: sale });
  } catch (err) {
    console.error('❌ Error creando venta:', err);
    return res.status(400).json({ success: false, error: err.message || 'Error registrando la venta.' });
  }
}

export async function updateSale(req, res) {
  try {
    const { id } = req.params;
    const { items, payments, discount, notes } = req.body;
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    const updatedSale = await updateSaleTransaction({
      saleId: id, tenantId, userId, items, payments, discount, notes,
    });

    return res.json({ success: true, message: 'Venta actualizada exitosamente.', data: updatedSale });
  } catch (err) {
    console.error('❌ Error actualizando venta:', err);
    const status = err.statusCode || (err.message?.includes('no encontrada') ? 404 : 400);
    return res.status(status).json({ success: false, error: err.message || 'Error al actualizar la venta.' });
  }
}

export async function getEventSalesList(req, res) {
  try {
    const { eventId } = req.params;
    const { date, page, limit } = req.query;
    const tenantId = req.tenantId;

    const result = await getEventSalesServiceList({ tenantId, eventId, date, page, limit });

    return res.json({
      success: true,
      data: result.sales,
      count: result.sales.length,
      pagination: {
        total: result.total, page: result.page, limit: result.limit,
        totalPages: result.totalPages, hasNext: result.hasNext, hasPrev: result.hasPrev,
      },
    });
  } catch (err) {
    console.error('❌ Error listando ventas:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo ventas del evento.' });
  }
}

export async function getEventLiveMetrics(req, res) {
  try {
    const { eventId } = req.params;
    const { date } = req.query;
    const tenantId = req.tenantId;

    const kpis = await getEventKPIs({ tenantId, eventId, date: date || null });
    return res.json({ success: true, data: kpis });
  } catch (err) {
    console.error('❌ Error obteniendo métricas:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo métricas en vivo.' });
  }
}

export async function getMonitorMetrics(req, res) {
  try {
    const tenantId = req.tenantId;
    const { date } = req.query;

    const data = await getMonitorDashboardMetrics({ tenantId, date: date || null });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error obteniendo métricas del monitor:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo datos del monitor.' });
  }
}

export async function purgeEventSales(req, res) {
  try {
    const { eventId } = req.body;
    const tenantId = req.tenantId;
    const userId = req.user?.id;

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId es requerido.' });
    }

    const result = await purgeEventSalesTransaction({ tenantId, eventId, userId });
    return res.json({
      success: true,
      message: `Ventas del evento "${result.eventName}" purgadas exitosamente. Secuencia reiniciada a 0.`,
      data: result,
    });
  } catch (err) {
    console.error('❌ Error purgando ventas del evento:', err);
    return res.status(400).json({ success: false, error: err.message || 'Error al purgar ventas.' });
  }
}

/**
 * Listado integral de pedidos de redes para logística y seguimiento
 */
export async function getOrderTrackingList(req, res) {
  try {
    const tenantId = req.tenantId;
    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');

    const { paymentStatus, search, page, limit } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const whereClause = {
      tenantId,
      orderType: 'REDES_PERSONALIZADO',
    };

    if (isVendedorRedes && !isSuperAdmin) {
      whereClause.sellerId = req.user.id;
    }

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
              id: true,
              fullName: true,
              phone: true,
              email: true,
              deliveryAddress: true,
              department: true,
              municipality: true,
            },
          },
          items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              material: true,
              customDimensions: true,
              customImageUrl: true,
              productionStatus: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              reference: true,
              receiptUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          seller: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          pickupEvent: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
    ]);

    const metricsBase = {
      tenantId,
      orderType: 'REDES_PERSONALIZADO',
      ...(isVendedorRedes && !isSuperAdmin ? { sellerId: req.user.id } : {}),
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
          items: {
            some: {
              productionStatus: { in: ['PENDIENTE', 'A_PRODUCCION'] },
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
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
    });
  } catch (err) {
    console.error('❌ Error obteniendo listado de seguimiento de pedidos:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error consultando seguimiento de pedidos.',
    });
  }
}

/**
 * Actualiza la información logística (guía, courier, entrega) de un pedido
 */
export async function updateOrderDelivery(req, res) {
  try {
    const { id } = req.params;
    const { shippingCourier, shippingTrackingNumber, isDelivered } = req.body;
    const tenantId = req.tenantId;

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId, orderType: 'REDES_PERSONALIZADO' },
    });

    if (!sale) {
      return res.status(404).json({ success: false, error: 'Pedido de redes no encontrado.' });
    }

    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin && sale.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para modificar este pedido.' });
    }

    const updateData = {};
    if (shippingCourier !== undefined) updateData.shippingCourier = shippingCourier ? shippingCourier.trim() : null;
    if (shippingTrackingNumber !== undefined) updateData.shippingTrackingNumber = shippingTrackingNumber ? shippingTrackingNumber.trim() : null;
    if (isDelivered === true) {
      updateData.status = 'ENTREGADO';
    } else if (isDelivered === false && sale.status === 'ENTREGADO') {
      updateData.status = Number(sale.balanceDue) > 0 ? 'PENDIENTE' : 'COMPLETADA';
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Logística de entrega actualizada exitosamente.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error actualizando logística del pedido:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al actualizar logística de entrega.',
    });
  }
}
