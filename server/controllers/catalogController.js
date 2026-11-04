import { searchHybridPosters, searchWebPosters } from '../services/webCatalogService.js';
import { queryCatalogProducts, syncCatalogFromWeb } from '../services/catalogSyncService.js';

export async function getProducts(req, res) {
  try {
    const tenantId = req.tenantId;
    const { page, limit, search, category } = req.query;
    let products = [];

    try {
      products = await queryCatalogProducts({ tenantId, page, limit, search, category });
    } catch (dbErr) {
      console.warn('⚠️ [getProducts Fallback] Fallback a caché web de catálogo:', dbErr.message);
      const posters = await searchWebPosters({
        tenantId,
        query: search || '',
        category: category || null,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      products = (posters || []).map((p) => ({
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
    const searchArgs = { tenantId: req.tenantId, query: q || '', category: category || null, limit: parsedLimit };
    let results = [];

    if (hybrid === 'true') {
      try {
        results = await searchHybridPosters(searchArgs);
      } catch {
        results = await searchWebPosters(searchArgs);
      }
    } else {
      results = await searchWebPosters(searchArgs);
    }

    return res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    console.error('❌ Error buscando pósters web:', err);
    return res.status(500).json({ success: false, error: 'Error en la búsqueda del catálogo web.' });
  }
}

export async function triggerCatalogSync(req, res) {
  try {
    const result = await syncCatalogFromWeb(req.tenantId);
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
