import { prisma } from '../config/prisma.js';

/**
 * Servicio Desacoplado de Catálogo de Pósters
 * Fiel al protocolo permanente aislamiento-estricto-proyectos y cirugia-arquitectura-cero-deuda:
 * Consulta la tabla local `Product` en `deko_eventsales_db`, erradicando cualquier
 * consulta cruzada raw SQL a bases de datos o esquemas externos.
 * 
 * Incorpora caché de lectura de alto rendimiento para garantizar latencia < 50ms
 * en el punto de venta durante ferias con alta afluencia de público.
 * 
 * Preserva exactamente la estructura JSON esperada por FastManualSaleForm.jsx:
 * { id, titulo, categoria, imageUrl, thumbUrl, precioMinimo, tags, sizes }
 */

// Caché en memoria para búsquedas sub-milisegundo en el POS
let productCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de TTL

/**
 * Invalida la caché en memoria para forzar recarga desde prisma.product
 */
export function invalidateCatalogCache() {
  productCache = null;
  lastCacheUpdate = 0;
}

/**
 * Normaliza y formatea un producto local de Prisma al contrato esperado por el frontend.
 * @param {object} p - Registro del modelo Product.
 * @returns {object} - Objeto compatible con la UI del POS.
 */
function formatProductForPos(p) {
  let parsedSizes = [];

  if (Array.isArray(p.sizes) && p.sizes.length > 0) {
    parsedSizes = p.sizes.map((s) => ({
      sizeId: s.sizeId || s.id || 'MEDIANO',
      nombre: s.nombre || s.name || 'Mediano',
      dimensiones: s.dimensiones || s.dimensions || '30 x 45 cm',
      precio: Number(s.precio || s.price || p.basePrice || 25),
    }));
  } else {
    // Variantes de tamaño por defecto para pósters de eventos
    const base = Number(p.basePrice || 25);
    parsedSizes = [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '20 x 30 cm', precio: Math.max(25, base - 20) },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '25 x 38 cm', precio: Math.max(35, base - 10) },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: base },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: base + 25 },
    ];
  }

  return {
    id: p.id,
    sku: p.sku,
    titulo: p.name,
    subtitulo: '',
    descripcion: '',
    categoria: p.category,
    imageUrl: p.imageUrl,
    thumbUrl: p.imageUrl,
    precioMinimo: Number(p.basePrice || 25),
    precioDisplay: `Q${Number(p.basePrice || 25)}`,
    tags: Array.isArray(p.tags) ? p.tags : [],
    sizes: parsedSizes,
  };
}

/**
 * Obtiene los productos desde caché o recarga desde la base de datos si expiró.
 */
async function getCachedProducts(tenantId) {
  const now = Date.now();
  if (productCache && now - lastCacheUpdate < CACHE_TTL_MS) {
    return productCache;
  }

  const where = { isActive: true };
  if (tenantId) where.tenantId = tenantId;

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  productCache = products.map(formatProductForPos);
  lastCacheUpdate = now;
  return productCache;
}

/**
 * Busca pósters en la tabla local Product por nombre, categoría, tags o SKU.
 * @param {object} params - Parámetros de búsqueda.
 * @param {string} [params.tenantId] - Filtro opcional por tenant.
 * @param {string} [params.query] - Texto de búsqueda.
 * @param {string} [params.category] - Filtro de categoría.
 * @param {number} [params.limit] - Cantidad máxima de resultados.
 * @returns {Promise<Array>} - Lista de pósters formateados.
 */
export async function searchWebPosters({ tenantId, query = '', category = null, limit = 24 }) {
  const cleanQuery = (query || '').trim().toLowerCase();
  const allProducts = await getCachedProducts(tenantId);

  let filtered = allProducts;

  if (category) {
    filtered = filtered.filter((p) => p.categoria === category);
  }

  if (cleanQuery) {
    filtered = filtered.filter((p) => {
      const matchName = p.titulo && p.titulo.toLowerCase().includes(cleanQuery);
      const matchSku = p.sku && p.sku.toLowerCase().includes(cleanQuery);
      const matchTag = Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(cleanQuery));
      return matchName || matchSku || matchTag;
    });
  }

  return filtered.slice(0, limit);
}

/**
 * Obtiene un resumen ligero de todos los pósters locales para contexto de prompts de IA.
 * @param {string} [tenantId] - Filtro opcional por tenant.
 * @returns {Promise<Array>} - Lista resumida { id, titulo, categoria, tags, precioMinimo }.
 */
export async function getAllWebPostersCatalogSummary(tenantId = null) {
  const products = await getCachedProducts(tenantId);

  return products.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    categoria: p.categoria,
    tags: p.tags,
    precioMinimo: p.precioMinimo,
  }));
}

/**
 * Obtiene un póster específico por su ID o SKU con todas sus variantes de tamaño.
 * @param {string} posterId - ID o SKU del producto.
 * @returns {Promise<object|null>} - Detalle del póster o null si no se encuentra.
 */
export async function getWebPosterById(posterId) {
  if (!posterId) return null;

  // Primero buscar en caché
  if (productCache) {
    const cached = productCache.find(
      (p) => p.id === posterId || p.sku === posterId || p.sku === `WEB-${posterId}`
    );
    if (cached) return cached;
  }

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: posterId },
        { sku: posterId },
        { sku: `WEB-${posterId}` },
      ],
      isActive: true,
    },
  });

  if (!product) return null;

  return formatProductForPos(product);
}
