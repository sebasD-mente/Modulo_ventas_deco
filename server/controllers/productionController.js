import {
  getProductionItems as listProductionItems,
  updateItemProductionStatus,
  getProductionMetrics as fetchProductionMetrics,
} from '../services/productionService.js';

export async function getProductionItems(req, res) {
  try {
    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role || 'VENDEDOR'];

    const { eventId, status, search, page, limit, source } = req.query;

    const result = await listProductionItems({
      tenantId: req.tenantId,
      eventId,
      status,
      search,
      page,
      limit,
      userRoles,
      userId: req.user?.id,
      source,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      count: result.items.length,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
      role: req.user.role,
      roles: userRoles,
    });
  } catch (error) {
    console.error('[Production Controller Error] getProductionItems:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateProductionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const { id: userId } = req.user;

    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role || 'VENDEDOR'];

    try {
      const updatedItem = await updateItemProductionStatus({
        id,
        status,
        notes,
        userId,
        userRoles,
      });

      return res.status(200).json({
        success: true,
        message: `Obra actualizada a estado ${status}`,
        data: updatedItem,
      });
    } catch (dbErr) {
      if (dbErr.statusCode) {
        return res.status(dbErr.statusCode).json({ success: false, error: dbErr.message });
      }
      console.error('❌ [Production Controller DB Error] updateItemStatus:', dbErr);
      return res.status(500).json({
        success: false,
        error: dbErr.message || 'Error al actualizar el estado de producción en base de datos.',
      });
    }
  } catch (error) {
    console.error('[Production Controller Error] updateProductionStatus:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getProductionMetrics(req, res) {
  try {
    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role || 'VENDEDOR'];

    const { eventId, source } = req.query;
    const metrics = await fetchProductionMetrics({
      tenantId: req.tenantId,
      eventId,
      userRoles,
      userId: req.user?.id,
      source,
    });

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[Production Controller Error] getProductionMetrics:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
