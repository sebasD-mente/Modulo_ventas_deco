/**
 * server/controllers/catalogWebhookController.js
 * Controlador para Webhooks de Catálogo en Tiempo Real.
 * Permite a la tienda web Deco Vintage notificar inmediatamente cuando se
 * crea o modifica una obra, logrando disponibilidad instantánea (0 latencia)
 * sin intervención humana.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { deltaSyncRecentPosters, normalizeAndUpsertPoster, resolveDefaultTenantId } from '../services/catalog/liveCatalogSyncService.js';
import { invalidateCatalogCache } from '../services/webCatalogService.js';
import { invalidateVectorCache } from '../services/embeddingService.js';
import { ENV } from '../config/env.js';

function isWebhookAuthorized(req) {
  const headers = req?.headers || {};
  const authHeader = typeof headers.authorization === 'string' ? headers.authorization.trim() : '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const incomingSecret = String(
    headers['x-webhook-secret'] ||
    headers['x-catalog-webhook-secret'] ||
    bearerToken ||
    ''
  ).trim();

  if (!incomingSecret) return false;

  const expectedSecret = String(
    ENV.CATALOG_WEBHOOK_SECRET ||
    process.env.CATALOG_WEBHOOK_SECRET ||
    ENV.JWT_SECRET ||
    process.env.JWT_SECRET ||
    ''
  ).trim();

  if (expectedSecret) {
    const incomingBuf = Buffer.from(incomingSecret, 'utf8');
    const expectedBuf = Buffer.from(expectedSecret, 'utf8');
    if (incomingBuf.length === expectedBuf.length && crypto.timingSafeEqual(incomingBuf, expectedBuf)) {
      return true;
    }
  }

  const jwtSecret = ENV.JWT_SECRET || process.env.JWT_SECRET;
  if (bearerToken && jwtSecret) {
    try {
      const decoded = jwt.verify(bearerToken, jwtSecret);
      const roles = Array.isArray(decoded?.roles) ? decoded.roles : (decoded?.role ? [decoded.role] : []);
      if (roles.includes('SUPER_ADMIN')) {
        return true;
      }
    } catch {}
  }

  return false;
}

export async function handleCatalogWebhook(req, res) {
  try {
    if (!isWebhookAuthorized(req)) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado: firma o secreto de webhook inválido.',
      });
    }

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
