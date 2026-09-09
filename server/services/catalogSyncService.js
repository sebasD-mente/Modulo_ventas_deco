import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { invalidateCatalogCache } from './webCatalogService.js';

/**
 * Variantes de tamaño estándar para pósters de eventos en Deco Vintage Guate
 */
export const STANDARD_EVENT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25, badge: 'Escritorio y coleccionable' },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35, badge: 'Espacios reducidos' },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65, badge: '⭐ Más vendido' },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125, badge: 'Salas y cabeceras' },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180, badge: 'Formato mural' },
];

export const ALBUM_COVER_SIZE = {
  sizeId: 'PORTADA_ALBUM',
  nombre: 'Portada de Álbum',
  dimensiones: '30 x 30 cm',
  precio: 55,
  badge: 'Formato vinilo cuadrado para música',
};

/**
 * Construye y normaliza la lista de tamaños disponibles para un póster
 */
function resolvePosterSizes(poster) {
  const isMusic = (poster.categoria || poster.category || '').toUpperCase() === 'MUSICA';
  const apiSizes = Array.isArray(poster.sizes) ? poster.sizes : [];

  const sizeMap = new Map();

  // Si es música o incluye portada de álbum, agregar la portada de álbum primero
  if (isMusic || apiSizes.some(s => (s.sizeId || s.id) === 'PORTADA_ALBUM')) {
    sizeMap.set('PORTADA_ALBUM', ALBUM_COVER_SIZE);
  }

  // Agregar los tamaños estándar del stand
  for (const std of STANDARD_EVENT_SIZES) {
    sizeMap.set(std.sizeId, { ...std });
  }

  // Sobrescribir con precios y badges de la API web si existen
  for (const api of apiSizes) {
    const sId = api.sizeId || api.id || 'MEDIANO';
    const existing = sizeMap.get(sId);
    sizeMap.set(sId, {
      sizeId: sId,
      nombre: api.nombre || api.name || existing?.nombre || 'Estándar',
      dimensiones: api.dimensiones || api.dimensions || existing?.dimensiones || '30 x 45 cm',
      precio: Number(api.precio || api.price || existing?.precio || 65),
      badge: api.badge || existing?.badge || null,
    });
  }

  return Array.from(sizeMap.values());
}

/**
 * Sincroniza el catálogo de productos desde la API web del e-commerce (233 pósters oficiales).
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

  // Filtramos URLs candidatas válidas (evitando decovintageguate.com inactivo)
  const configuredUrl = ENV.WEB_CATALOG_URL || process.env.WEB_CATALOG_URL;
  const candidateUrls = [
    configuredUrl,
    'https://decovintage.online',
  ].filter((url, index, self) => 
    url && 
    typeof url === 'string' && 
    !url.includes('decovintageguate.com') && 
    self.indexOf(url) === index
  );

  let allPosters = [];
  let successfulUrl = null;

  for (const baseUrl of candidateUrls) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    console.log(`[CatalogSync] Consultando catálogo web en ${cleanBase}/api/catalog/posters...`);

    let cursor = null;
    let hasMore = true;
    let collectedForThisUrl = [];

    try {
      while (hasMore) {
        const pageUrl = `${cleanBase}/api/catalog/posters?take=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(pageUrl, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn(`[CatalogSync] Endpoint ${pageUrl} respondió HTTP ${res.status}`);
          break;
        }

        const json = await res.json();
        const batch = json.data || json.posters || [];
        if (!Array.isArray(batch) || batch.length === 0) {
          hasMore = false;
          break;
        }

        collectedForThisUrl.push(...batch);

        if (!json.hasMore || !json.nextCursor) {
          hasMore = false;
        } else {
          cursor = json.nextCursor;
        }
      }

      if (collectedForThisUrl.length > 0) {
        allPosters = collectedForThisUrl;
        successfulUrl = `${cleanBase}/api/catalog/posters`;
        console.log(`[CatalogSync] ✅ Descarga completa: ${allPosters.length} pósters obtenidos de ${cleanBase}.`);
        break;
      }
    } catch (err) {
      console.warn(`[CatalogSync] Advertencia en ${cleanBase}: ${err.message}`);
    }
  }

  // Si la API externa no respondió, no romper el sistema: operar con lo que exista
  if (!allPosters || allPosters.length === 0) {
    console.warn(
      '[CatalogSync] ⚠️ No se pudo obtener catálogo desde el endpoint web. Operando con productos locales.'
    );
    return {
      success: false,
      count: 0,
      warning: 'Catálogo web no disponible o sin conexión. Operando con caché local.',
    };
  }

  console.log(`[CatalogSync] Iniciando upsert de ${allPosters.length} pósters en la tabla local Product...`);
  let upsertedCount = 0;

  for (const poster of allPosters) {
    const posterId = poster.id || poster._id || poster.legacyId;
    if (!posterId) continue;

    const sku = `WEB-${posterId}`;
    const rawTitle = (poster.titulo || poster.title || 'Póster').trim();
    const rawSubtitle = (poster.subtitulo || poster.subtitle || '').trim();
    const name = rawSubtitle ? `${rawTitle} - ${rawSubtitle}` : rawTitle;
    const category = (poster.categoria || poster.category || 'GENERAL').toUpperCase();
    const imageUrl = poster.imageUrl || poster.image || poster.thumbUrl || null;
    const sizes = resolvePosterSizes(poster);
    const minPrice = sizes.reduce((min, s) => Math.min(min, s.precio), Number(poster.precioMinimo || 25));

    // Generar tags enriquecidos con título, subtítulo, categoría y tokens
    const extraTags = Array.isArray(poster.tags) ? poster.tags : [];
    const combinedTags = Array.from(
      new Set([
        rawTitle.toLowerCase(),
        ...(rawSubtitle ? [rawSubtitle.toLowerCase()] : []),
        category.toLowerCase(),
        ...rawTitle.toLowerCase().split(/\s+/),
        ...(rawSubtitle ? rawSubtitle.toLowerCase().split(/\s+/) : []),
        ...extraTags.map(t => String(t).replace(/^#/, '').toLowerCase().trim()),
      ])
    ).filter(t => t.length > 1);

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
          basePrice: minPrice,
          imageUrl,
          sizes,
          tags: combinedTags,
          isActive: true,
        },
        update: {
          name,
          category,
          basePrice: minPrice,
          imageUrl,
          sizes,
          tags: combinedTags,
          isActive: true,
        },
      });
      upsertedCount++;
    } catch (upsertErr) {
      console.warn(`[CatalogSync] Error al actualizar póster SKU ${sku}: ${upsertErr.message}`);
    }
  }

  // Invalidar caché en memoria para refrescar búsquedas instantáneas
  invalidateCatalogCache();

  console.log(`[CatalogSync] ✅ Sincronización exitosa: ${upsertedCount} productos sincronizados en deko_eventsales_db.`);

  return {
    success: true,
    count: upsertedCount,
    source: successfulUrl,
  };
}
