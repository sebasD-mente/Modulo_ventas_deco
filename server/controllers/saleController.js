import {
  createSaleTransaction,
  updateSaleTransaction,
  getEventKPIs,
  getMonitorDashboardMetrics,
  createCashClosingTransaction,
} from '../services/saleService.js';
import { prisma } from '../config/prisma.js';

export async function createSale(req, res) {
  try {
    const { eventId, items, payments, discount, notes, inputChannel, attachments } = req.body;
    const sellerId = req.user?.id;
    const tenantId = req.tenantId;

    if (!sellerId || !tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de usuario o empresa no válido.' });
    }

    const sale = await createSaleTransaction({
      tenantId,
      sellerId,
      eventId,
      items,
      payments,
      discount,
      notes,
      inputChannel,
      attachments: attachments || [],
    });

    return res.status(201).json({
      success: true,
      message: 'Venta registrada exitosamente.',
      data: sale,
    });
  } catch (err) {
    console.error('❌ Error creando venta:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Error registrando la venta.',
    });
  }
}

export async function updateSale(req, res) {
  try {
    const { id } = req.params;
    const { items, payments, discount, notes } = req.body;
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    const updatedSale = await updateSaleTransaction({
      saleId: id,
      tenantId,
      userId,
      items,
      payments,
      discount,
      notes,
    });

    return res.json({
      success: true,
      message: 'Venta actualizada exitosamente.',
      data: updatedSale,
    });
  } catch (err) {
    console.error('❌ Error actualizando venta:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Error al actualizar la venta.',
    });
  }
}

export async function getEventSalesList(req, res) {
  try {
    const { eventId } = req.params;
    const { date } = req.query;
    const tenantId = req.tenantId;

    const where = {
      tenantId,
      eventId,
    };

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        payments: true,
        seller: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ success: true, data: sales, count: sales.length });
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

    const data = await getMonitorDashboardMetrics({
      tenantId,
      date: date || null,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('❌ Error obteniendo métricas del monitor:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo datos del monitor.' });
  }
}

export async function postCashClosing(req, res) {
  try {
    const { eventId, closingType, totalCashReported, observations, date } = req.body;
    const closedById = req.user?.id;
    const tenantId = req.tenantId;

    const closing = await createCashClosingTransaction({
      tenantId,
      eventId,
      closedById,
      closingType,
      totalCashReported: Number(totalCashReported),
      observations,
      date: date || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Cierre de caja registrado exitosamente.',
      data: closing,
    });
  } catch (err) {
    console.error('❌ Error registrando cierre de caja:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Error al procesar el cierre de caja.',
    });
  }
}

export async function getCashClosingsList(req, res) {
  try {
    const { eventId } = req.params;
    const tenantId = req.tenantId;

    const closings = await prisma.cashClosing.findMany({
      where: { tenantId, eventId },
      include: {
        closedBy: { select: { fullName: true } },
      },
      orderBy: { closingDate: 'desc' },
    });

    return res.json({ success: true, data: closings });
  } catch (err) {
    console.error('❌ Error obteniendo cierres de caja:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener historial de cierres.' });
  }
}
