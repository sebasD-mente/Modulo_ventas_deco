import * as printSheetService from '../services/printSheetService.js';

/**
 * Consulta y listado paginado de pliegos de taller con filtros
 */
export async function listPrintSheets(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const { status, material, search, page, limit } = req.query;
    const result = await printSheetService.getPrintSheets({
      tenantId,
      status,
      material,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.sheets,
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
    console.error('❌ [PrintSheet Controller] listPrintSheets:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error consultando pliegos de impresión.',
    });
  }
}

/**
 * Consulta de detalle 360 de un pliego de taller por ID
 */
export async function getPrintSheet(req, res) {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const sheet = await printSheetService.getPrintSheetById({
      tenantId,
      sheetId: id,
    });

    return res.status(200).json({ success: true, data: sheet });
  } catch (err) {
    console.error('❌ [PrintSheet Controller] getPrintSheet:', err);
    const status = err.statusCode || (err.message?.includes('no encontrado') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Creación y apertura de nuevo pliego diario de taller
 */
export async function createPrintSheet(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const { material, notes } = req.body;
    const sheet = await printSheetService.createPrintSheet({
      tenantId,
      userId,
      material,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: `Pliego ${sheet.sheetCode} creado exitosamente.`,
      data: sheet,
    });
  } catch (err) {
    console.error('❌ [PrintSheet Controller] createPrintSheet:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Asignación blindada de obras a un pliego de taller con Freno de Taller
 */
export async function assignItems(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { saleItemIds } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const sheet = await printSheetService.assignItemsToSheet({
      tenantId,
      sheetId: id,
      saleItemIds,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: `${saleItemIds.length} obra(s) asignadas exitosamente al pliego.`,
      data: sheet,
    });
  } catch (err) {
    console.error('❌ [PrintSheet Controller] assignItems:', err);
    const status = err.statusCode || (err.message?.includes('no encontrado') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}

/**
 * Transición de estado de pliego de taller con propagación en cascada
 */
export async function updateStatus(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const sheet = await printSheetService.updateSheetStatus({
      tenantId,
      sheetId: id,
      status,
      userId,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: `Pliego actualizado a estado ${status}.`,
      data: sheet,
    });
  } catch (err) {
    console.error('❌ [PrintSheet Controller] updateStatus:', err);
    const status = err.statusCode || (err.message?.includes('no encontrado') ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
}
