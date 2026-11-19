import {
  discardWebOrderSchema,
  listWebOrdersQuerySchema,
  syncWebOrdersSchema,
  webOrderPayloadSchema,
} from '../validators/webOrderValidators.js';
import {
  discardWebOrder,
  ingestWebOrderWebhook,
  isWebOrderWebhookAuthorized,
  listWebOrders,
  restoreWebOrder,
  syncWebOrdersFromWeb,
} from '../services/sales/webOrderInboxService.js';

export async function handleWebOrderWebhook(req, res) {
  try {
    if (!isWebOrderWebhookAuthorized(req)) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado: firma o secreto S2S de pedidos web inválido.',
      });
    }

    const parsed = webOrderPayloadSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; ') || 'Payload de pedido web inválido.',
      });
    }

    const tenantId = req.query?.tenantId || parsed.data?.tenantId || null;
    const result = await ingestWebOrderWebhook({ tenantId, payload: parsed.data });

    return res.status(200).json({
      success: true,
      action: result.action,
      created: result.created,
      updated: result.updated,
      data: result.record,
    });
  } catch (err) {
    console.error('❌ Error en handleWebOrderWebhook:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error procesando webhook de pedido web.',
    });
  }
}

export async function getWebOrdersInbox(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const parsedQuery = listWebOrdersQuerySchema.safeParse(req.query || {});
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        error: parsedQuery.error.issues.map((i) => i.message).join('; '),
      });
    }

    const { status, source, search, page, limit } = parsedQuery.data;
    const result = await listWebOrders({ tenantId, status, source, search, page, limit });

    return res.status(200).json({
      success: true,
      data: result.orders,
      counts: result.counts,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    console.error('❌ Error consultando bandeja de pedidos web:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error consultando la bandeja de pedidos web.',
    });
  }
}

export async function triggerWebOrdersSync(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const parsedBody = syncWebOrdersSchema.safeParse(req.body || {});
    const { status, limit } = parsedBody.success ? parsedBody.data : { status: 'PENDIENTE', limit: 100 };

    const result = await syncWebOrdersFromWeb({ tenantId, status, limit });
    return res.status(200).json({
      success: result.success,
      synced: result.synced,
      message: result.synced
        ? `Sincronización web completada: ${result.createdCount} nuevos, ${result.updatedCount} actualizados.`
        : (result.warning || 'No fue posible sincronizar desde la Web en este momento.'),
      data: result,
    });
  } catch (err) {
    console.error('❌ Error sincronizando bandeja de pedidos web:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error sincronizando pedidos web.',
    });
  }
}

export async function discardWebOrderHandler(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const parsed = discardWebOrderSchema.safeParse(req.body || {});
    const reason = parsed.success ? parsed.data.reason : null;

    const updated = await discardWebOrder({ tenantId, id, userId, reason });
    return res.status(200).json({
      success: true,
      message: `Pedido web #${updated.orderNumber} descartado.`,
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error descartando pedido web:', err);
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || 'Error al descartar el pedido web.',
    });
  }
}

export async function restoreWebOrderHandler(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const updated = await restoreWebOrder({ tenantId, id, userId });
    return res.status(200).json({
      success: true,
      message: `Pedido web #${updated.orderNumber} restaurado a pendientes.`,
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error restaurando pedido web:', err);
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || 'Error al restaurar el pedido web.',
    });
  }
}
