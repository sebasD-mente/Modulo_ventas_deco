import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { invalidateCatalogCache } from './webCatalogService.js';

/**
 * Servicio de Sincronización Desacoplada de Catálogo
 * Cumple con la regla permanente aislamiento-estricto-proyectos:
 * Descarga pósters desde el e-commerce vía API REST pública (GET /api/catalog/posters?take=500)
 * y realiza upsert en la tabla local Product de deko_eventsales_db.
 */

/**
 * Sincroniza el catálogo de productos desde la API web del e-commerce.
 * @param {string} [tenantId] - ID del tenant al que se asociarán los productos.
 * @returns {Promise<{ success: boolean, count: number, source?: string, warning?: string, error?: string }>}
 */
export async function syncCatalogFromWeb(tenantId) {
  let targetTenantId = tenantId;

  if (!targetTenantId) {
    const defaultTenant = await prisma.tenant.findFirst({
      where: { slug: 'deco-vintage' },
      select: { id: true },
    });
    targetTenantId = defaultTenant?.id;
  }

  if (!targetTenantId) {
    const anyTenant = await prisma.tenant.findFirst({
      select: { id: true },
    });
    targetTenantId = anyTenant?.id;
  }

  if (!targetTenantId) {
    console.warn('[CatalogSync] ⚠️ No se encontró ningún tenant en la base de datos para sincronizar productos.');
    return {
      success: false,
      count: 0,
      error: 'Tenant no configurado en la base de datos.',
    };
  }

  // Lista de URLs candidatas respetando configuración .env y fallback live
  const configuredUrl = ENV.WEB_CATALOG_URL || process.env.WEB_CATALOG_URL;
  const candidateUrls = [
    configuredUrl,
    'https://decovintageguate.com',
    'https://decovintage.online',
  ].filter((url, index, self) => url && typeof url === 'string' && self.indexOf(url) === index);

  let posters = null;
  let successfulUrl = null;

  for (const baseUrl of candidateUrls) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const apiUrl = `${cleanBase}/api/catalog/posters?take=500`;

    try {
      console.log(`[CatalogSync] Consultando catálogo web en ${apiUrl}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const items = json.data || json.posters || [];
        if (Array.isArray(items) && items.length > 0) {
          posters = items;
          successfulUrl = apiUrl;
          console.log(`[CatalogSync] ✅ Conexión exitosa con ${apiUrl}. ${items.length} obras recibidas.`);
          break;
        }
      } else {
        console.warn(`[CatalogSync] Endpoint ${apiUrl} respondió con status HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[CatalogSync] Advertencia de red en ${apiUrl}: ${err.message}`);
    }
  }

  // Si la API externa no está disponible, no romper el POS: operar con caché local existente
  if (!posters || posters.length === 0) {
    console.warn(
      '[CatalogSync] ⚠️ No se pudo obtener catálogo desde ningún endpoint web. El sistema POS continuará operando normalmente con los productos almacenados en local.'
    );
    return {
      success: false,
      count: 0,
      warning: 'Catálogo web no disponible o sin conexión. Operando con caché local.',
    };
  }

  console.log(`[CatalogSync] Iniciando upsert de ${posters.length} pósters en la tabla local Product...`);
  let upsertedCount = 0;

  for (const poster of posters) {
    const posterId = poster.id || poster._id || poster.legacyId;
    if (!posterId) continue;

    const sku = `WEB-${posterId}`;
    const name = poster.titulo || poster.title || 'Póster Sin Título';
    const category = poster.categoria || poster.category || 'GENERAL';
    const basePrice = Number(poster.precioMinimo || (poster.sizes?.[0]?.precio || 25));
    const imageUrl = poster.imageUrl || poster.image || poster.thumbUrl || null;
    const sizes = Array.isArray(poster.sizes) ? poster.sizes : [];
    const tags = Array.isArray(poster.tags) ? poster.tags : [];

    try {
      await prisma.product.upsert({
        where: {
          tenantId_sku: {
            tenantId: targetTenantId,
            sku,
          },
        },
        create: {
          tenantId: targetTenantId,
          sku,
          name,
          category,
          basePrice,
          imageUrl,
          sizes,
          tags,
          isActive: true,
        },
        update: {
          name,
          category,
          basePrice,
          imageUrl,
          sizes,
          tags,
          isActive: true,
        },
      });
      upsertedCount++;
    } catch (upsertErr) {
      console.warn(`[CatalogSync] Error al actualizar póster SKU ${sku}: ${upsertErr.message}`);
    }
  }

  // Invalidar caché en memoria para reflejar cambios inmediatamente
  invalidateCatalogCache();

  console.log(`[CatalogSync] ✅ Sincronización exitosa: ${upsertedCount} productos sincronizados en deko_eventsales_db.`);

  return {
    success: true,
    count: upsertedCount,
    source: successfulUrl,
  };
}
