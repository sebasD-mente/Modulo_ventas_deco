import { createCashClosingTransaction } from '../services/saleService.js';
import { prisma } from '../config/prisma.js';

export async function postCashClosing(req, res) {
  try {
    const {
      eventId,
      closingType,
      totalCashReported,
      openingCashFloat = 0,
      pettyCashExpenses = 0,
      cashDrops = 0,
      observations,
      date,
      idempotencyKey = null,
    } = req.body;
    const closedById = req.user?.id;
    const tenantId = req.tenantId;

    const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user?.role || 'VENDEDOR'];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && req.user?.assignedEventId && req.user.assignedEventId !== eventId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes autorización para cerrar la caja de un evento distinto al asignado.',
      });
    }

    const closing = await createCashClosingTransaction({
      tenantId,
      eventId,
      closedById,
      closingType,
      totalCashReported: Number(totalCashReported),
      openingCashFloat: Number(openingCashFloat || 0),
      pettyCashExpenses: Number(pettyCashExpenses || 0),
      cashDrops: Number(cashDrops || 0),
      observations,
      date: date || null,
      idempotencyKey,
    });

    return res.status(201).json({
      success: true,
      message: 'Cierre de caja registrado exitosamente.',
      data: closing,
    });
  } catch (err) {
    console.error('❌ Error registrando cierre de caja:', err);
    return res.status(err.statusCode || 400).json({
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
