import { prisma } from '../config/prisma.js';
import { searchHybridPosters, searchWebPosters } from '../services/webCatalogService.js';
import { syncCatalogFromWeb } from '../services/catalogSyncService.js';

export async function getProducts(req, res) {
  try {
    const tenantId = req.tenantId;
    const { page, limit, search, category } = req.query;
    const where = { tenantId, isActive: true };

    if (category) {
      where.category = String(category).trim().toUpperCase();
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }

    const findOptions = {
      where,
      orderBy: [{ category: 'asc' }, { basePrice: 'asc' }],
    };

    if (limit) {
      const parsedLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      findOptions.take = parsedLimit;
      findOptions.skip = (parsedPage - 1) * parsedLimit;
    }

    let products = [];
    try {
      products = await prisma.product.findMany(findOptions);
    } catch (dbErr) {
      console.warn('⚠️ [getProducts Fallback] Fallback a caché web de catálogo:', dbErr.message);
      const posters = await searchWebPosters({
        tenantId,
        query: search || '',
        category: category || null,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      products = (posters || []).map(p => ({
        id: p.id,
        tenantId,
        name: p.name || p.title,
        sku: p.sku || p.code,
        category: p.category,
        basePrice: p.basePrice || 65.0,
        imageUrl: p.imageUrl,
        sizes: p.sizes || [],
        isActive: true,
      }));
    }

    return res.json({ success: true, data: products, count: products.length });
  } catch (err) {
    console.error('❌ Error obteniendo productos:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener catálogo de productos.' });
  }
}

export async function searchWebPostersCatalog(req, res) {
  try {
    const { q, category, limit, hybrid } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 24;
    let results = [];

    if (hybrid === 'true') {
      try {
        results = await searchHybridPosters({
          tenantId: req.tenantId,
          query: q || '',
          category: category || null,
          limit: parsedLimit,
        });
      } catch {
        results = await searchWebPosters({
          tenantId: req.tenantId,
          query: q || '',
          category: category || null,
          limit: parsedLimit,
        });
      }
    } else {
      results = await searchWebPosters({
        tenantId: req.tenantId,
        query: q || '',
        category: category || null,
        limit: parsedLimit,
      });
    }

    return res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    console.error('❌ Error buscando pósters web:', err);
    return res.status(500).json({ success: false, error: 'Error en la búsqueda del catálogo web.' });
  }
}

export async function triggerCatalogSync(req, res) {
  try {
    const tenantId = req.tenantId;
    const result = await syncCatalogFromWeb(tenantId);
    return res.status(200).json({
      success: result.success,
      count: result.count,
      message: result.success
        ? `Sincronización exitosa: ${result.count} productos actualizados.`
        : `Sincronización finalizada: ${result.warning || result.error}`,
      data: result,
    });
  } catch (err) {
    console.error('❌ Error en sincronización de catálogo:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno al sincronizar el catálogo.',
    });
  }
}
