import * as commissionService from '../services/commissionService.js';

/**
 * Consulta ventas completadas con saldo cero pendientes de liquidación
 */
export async function getPendingCommissions(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || req.user?.role === 'SUPER_ADMIN';
    const sellerId = isSuperAdmin ? (req.query.sellerId || req.user?.id) : req.user?.id;

    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'sellerId es requerido para consultar comisiones.' });
    }

    const { startDate, endDate } = req.query;
    const report = await commissionService.getPendingCommissions({
      tenantId,
      sellerId,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error('❌ [Commission Controller] getPendingCommissions:', err);
    const status = err.statusCode || (err.message?.includes('no encontrad') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Ejecuta la transacción atómica de liquidación de comisiones (Solo SUPER_ADMIN)
 */
export async function settleCommissions(req, res) {
  try {
    const tenantId = req.tenantId;
    const adminId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const { sellerId, saleIds, notes } = req.body;
    const settlement = await commissionService.createSettlementTransaction({
      tenantId,
      sellerId,
      saleIds,
      approvedById: adminId,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: `Liquidación ${settlement.settlementNumber} creada exitosamente.`,
      data: settlement,
    });
  } catch (err) {
    console.error('❌ [Commission Controller] settleCommissions:', err);
    const status = err.statusCode || (err.message?.includes('no encontrad') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Lista histórica paginada de liquidaciones con filtros
 */
export async function listSettlements(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || req.user?.role === 'SUPER_ADMIN';
    const sellerId = isSuperAdmin ? req.query.sellerId : req.user?.id;
    const { status, page, limit } = req.query;

    const result = await commissionService.getSettlementsList({
      tenantId,
      sellerId,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.settlements,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
    });
  } catch (err) {
    console.error('❌ [Commission Controller] listSettlements:', err);
    const status = err.statusCode || (err.message?.includes('no encontrad') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Consulta de detalle 360 de una liquidación por ID
 */
export async function getSettlement(req, res) {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const settlement = await commissionService.getSettlementById({
      tenantId,
      settlementId: id,
    });

    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || req.user?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && settlement.sellerId !== req.user?.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para consultar esta liquidación.' });
    }

    return res.status(200).json({
      success: true,
      data: settlement,
    });
  } catch (err) {
    console.error('❌ [Commission Controller] getSettlement:', err);
    const status = err.statusCode || (err.message?.includes('no encontrad') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Marca una liquidación como pagada registrando referencia bancaria (Solo SUPER_ADMIN)
 */
export async function markPaid(req, res) {
  try {
    const tenantId = req.tenantId;
    const adminId = req.user?.id;
    const { id } = req.params;
    const { paymentReference, notes } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const settlement = await commissionService.markSettlementPaid({
      tenantId,
      settlementId: id,
      paymentReference,
      userId: adminId,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: 'Liquidación marcada como pagada exitosamente.',
      data: settlement,
    });
  } catch (err) {
    console.error('❌ [Commission Controller] markPaid:', err);
    const status = err.statusCode || (err.message?.includes('no encontrad') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}
