/**
 * server/controllers/catalogWebhookController.js
 * Controlador para Webhooks de Catálogo en Tiempo Real.
 * Permite a la tienda web Deco Vintage notificar inmediatamente cuando se
 * crea o modifica una obra, logrando disponibilidad instantánea (0 latencia)
 * sin intervención humana.
 */

import { deltaSyncRecentPosters, normalizeAndUpsertPoster } from '../services/catalog/liveCatalogSyncService.js';
import { invalidateCatalogCache } from '../services/webCatalogService.js';
import { invalidateVectorCache } from '../services/embeddingService.js';
import { resolveDefaultTenantId } from '../services/catalog/liveCatalogSyncService.js';

export async function handleCatalogWebhook(req, res) {
  try {
    const { poster, event } = req.body || {};
    const tenantId = req.query?.tenantId || req.body?.tenantId || null;

    if (poster && typeof poster === 'object') {
      const targetTenantId = await resolveDefaultTenantId(tenantId);
      const product = await normalizeAndUpsertPoster(poster, targetTenantId);
      if (product) {
        invalidateCatalogCache(targetTenantId);
        try { invalidateVectorCache(targetTenantId); } catch {}
      }
      return res.status(200).json({
        success: true,
        message: 'Poster ingested instantly via webhook',
        sku: product?.sku || null,
        timestamp: new Date().toISOString(),
      });
    }

    // Si es un evento general o ping de sincronización
    const syncRes = await deltaSyncRecentPosters(tenantId);
    return res.status(200).json({
      success: true,
      message: 'Delta catalog sync completed via webhook',
      event: event || 'catalog.refresh',
      synced: syncRes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Error en handleCatalogWebhook:', err);
    return res.status(500).json({
      success: false,
      error: 'Error procesando webhook de catálogo',
    });
  }
}
