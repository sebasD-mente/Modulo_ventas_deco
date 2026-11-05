import {
  createSaleTransaction, updateSaleTransaction, getEventKPIs, getMonitorDashboardMetrics,
  getEventSalesList as getEventSalesServiceList, purgeEventSalesTransaction,
  isTargetEventArchived, queryOrderTrackingList, updateOrderDeliveryRecord,
} from '../services/saleService.js';

export { postCashClosing, getCashClosingsList } from './cashClosingController.js';

export async function createSale(req, res) {
  try {
    const { eventId, items, payments, discount, notes, inputChannel, attachments, idempotencyKey: bodyKey } = req.body;
    const sellerId = req.user?.id;
    const tenantId = req.tenantId;
    const rawKey = req.headers['idempotency-key'] || bodyKey || null;
    const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim() : null;

    if (!sellerId || !tenantId) return res.status(400).json({ success: false, error: 'Contexto de usuario o empresa no válido.' });
    if (!eventId) return res.status(400).json({ success: false, error: 'El evento destino es obligatorio.' });

    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0 ? req.user.roles : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
    const isVendedor = userRoles.includes('VENDEDOR');

    if (isVendedor && !isSuperAdmin && !isVendedorRedes && req.user?.assignedEventId && eventId !== req.user.assignedEventId) {
      return res.status(403).json({ success: false, error: 'No tienes autorización para registrar ventas en un evento diferente al asignado.' });
    }
    if (await isTargetEventArchived({ tenantId, eventId })) {
      return res.status(400).json({ success: false, error: 'No se pueden registrar ventas en un evento archivado.' });
    }

    const sale = await createSaleTransaction({
      tenantId, sellerId, eventId, items, payments, discount, notes, inputChannel, attachments: attachments || [], idempotencyKey,
    });
    if (sale.idempotentReplay) {
      return res.status(200).json({ success: true, idempotentReplay: true, message: 'Venta previamente registrada (Idempotent Replay).', data: sale });
    }
    return res.status(201).json({ success: true, message: 'Venta registrada exitosamente.', data: sale });
  } catch (err) {
    console.error('❌ Error creando venta:', err);
    return res.status(400).json({ success: false, error: err.message || 'Error registrando la venta.' });
  }
}

export async function updateSale(req, res) {
  try {
    const { items, payments, discount, notes, status } = req.body;
    const updatedSale = await updateSaleTransaction({
      saleId: req.params.id, tenantId: req.tenantId, userId: req.user?.id,
      userRole: req.user?.role, userRoles: req.user?.roles, assignedEventId: req.user?.assignedEventId,
      items, payments, discount, notes, status,
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
    const { date, page, limit } = req.query;
    const result = await getEventSalesServiceList({ tenantId: req.tenantId, eventId: req.params.eventId, date, page, limit });
    return res.json({
      success: true, data: result.sales, count: result.sales.length,
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
    const kpis = await getEventKPIs({ tenantId: req.tenantId, eventId: req.params.eventId, date: req.query.date || null });
    return res.json({ success: true, data: kpis });
  } catch (err) {
    console.error('❌ Error obteniendo métricas:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo métricas en vivo.' });
  }
}

export async function getMonitorMetrics(req, res) {
  try {
    const tenantId = req.tenantId;
    const { date, eventId } = req.query;
    const user = req.user;
    const userRoles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isVendedorRedes = userRoles.includes('VENDEDOR_REDES');
    const isVendedor = userRoles.includes('VENDEDOR');

    let targetEventId = eventId || null;
    if (isVendedorRedes && !isSuperAdmin && !isVendedor) {
      targetEventId = 'evt-ventas-redes-online';
    } else if (isVendedor && !isSuperAdmin && !isVendedorRedes) {
      targetEventId = user?.assignedEventId || 'none';
    }

    const data = await getMonitorDashboardMetrics({ tenantId, date: date || null, eventId: targetEventId });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error obteniendo métricas del monitor:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo datos del monitor.' });
  }
}

export async function purgeEventSales(req, res) {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ success: false, error: 'eventId es requerido.' });
    const result = await purgeEventSalesTransaction({ tenantId: req.tenantId, eventId, userId: req.user?.id });
    return res.json({
      success: true, message: `Ventas del evento "${result.eventName}" purgadas exitosamente. Secuencia reiniciada a 0.`, data: result,
    });
  } catch (err) {
    console.error('❌ Error purgando ventas del evento:', err);
    return res.status(400).json({ success: false, error: err.message || 'Error al purgar ventas.' });
  }
}

export async function getOrderTrackingList(req, res) {
  try {
    const result = await queryOrderTrackingList({
      tenantId: req.tenantId, paymentStatus: req.query.paymentStatus,
      search: req.query.search, page: req.query.page, limit: req.query.limit,
    });
    return res.status(200).json({ success: true, data: result.orders, pagination: result.pagination, metrics: result.metrics });
  } catch (err) {
    console.error('❌ Error obteniendo listado de seguimiento de pedidos:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error consultando seguimiento de pedidos.' });
  }
}

export async function updateOrderDelivery(req, res) {
  try {
    const { shippingCourier, shippingTrackingNumber, isDelivered, deliveryReceiptUrl, deliveryNotes } = req.body;
    const auditAction = isDelivered ? 'PEDIDO_ENTREGADO' : 'LOGISTICA_ACTUALIZADA';
    const updated = await updateOrderDeliveryRecord({
      id: req.params.id, tenantId: req.tenantId,
      shippingCourier, shippingTrackingNumber, isDelivered, deliveryReceiptUrl, deliveryNotes, user: req.user, auditAction,
    });
    return res.status(200).json({ success: true, message: 'Logística de entrega actualizada exitosamente.', data: updated });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 400) return res.status(err.statusCode).json({ success: false, error: err.message });
    console.error('❌ Error actualizando logística del pedido:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error al actualizar logística de entrega.' });
  }
}
