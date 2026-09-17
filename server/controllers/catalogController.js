import { prisma } from '../config/prisma.js';
import { searchHybridPosters, searchWebPosters } from '../services/webCatalogService.js';
import { syncCatalogFromWeb } from '../services/catalogSyncService.js';

export async function getProducts(req, res) {
  try {
    const tenantId = req.tenantId;
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { basePrice: 'asc' }],
    });

    return res.json({ success: true, data: products, count: products.length });
  } catch (err) {
    console.error('❌ Error obteniendo productos:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener catálogo de productos.' });
  }
}

export async function searchWebPostersCatalog(req, res) {
  try {
    const { q, category, limit } = req.query;
    let results = [];
    try {
      results = await searchHybridPosters({
        tenantId: req.tenantId,
        query: q || '',
        category: category || null,
        limit: limit ? parseInt(limit, 10) : 24,
      });
    } catch {
      results = await searchWebPosters({
        tenantId: req.tenantId,
        query: q || '',
        category: category || null,
        limit: limit ? parseInt(limit, 10) : 24,
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
