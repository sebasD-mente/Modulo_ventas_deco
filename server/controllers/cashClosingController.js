import { createCashClosingTransaction } from '../services/saleService.js';
import { prisma } from '../config/prisma.js';

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
