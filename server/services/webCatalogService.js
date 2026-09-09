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
      badge: s.badge || null,
    }));
  } else {
    // Variantes de tamaño por defecto para pósters de eventos
    const base = Number(p.basePrice || 25);
    parsedSizes = [
      { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
    ];
  }

  // Separar título y subtítulo si el nombre fue guardado como "Título - Subtítulo"
  let titulo = p.name;
  let subtitulo = '';
  if (p.name.includes(' - ')) {
    const parts = p.name.split(' - ');
    titulo = parts[0].trim();
    subtitulo = parts.slice(1).join(' - ').trim();
  }

  const minPrice = parsedSizes.length > 0
    ? parsedSizes.reduce((min, s) => Math.min(min, s.precio), Number(p.basePrice || 25))
    : Number(p.basePrice || 25);

  return {
    id: p.id,
    sku: p.sku,
    titulo,
    subtitulo,
    nombreCompleto: p.name,
    descripcion: subtitulo,
    categoria: p.category,
    imageUrl: p.imageUrl,
    thumbUrl: p.imageUrl,
    precioMinimo: minPrice,
    precioDisplay: `Q${minPrice}`,
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
 * Busca pósters en la tabla local Product por nombre, subtítulo, categoría, tags o SKU.
 * Motor ultrarrápido con scoring de relevancia para autocompletado en stand POS.
 * @param {object} params - Parámetros de búsqueda.
 * @param {string} [params.tenantId] - Filtro opcional por tenant.
 * @param {string} [params.query] - Texto de búsqueda.
 * @param {string} [params.category] - Filtro de categoría.
 * @param {number} [params.limit] - Cantidad máxima de resultados.
 * @returns {Promise<Array>} - Lista de pósters ordenados por relevancia.
 */
export async function searchWebPosters({ tenantId, query = '', category = null, limit = 24 }) {
  const cleanQuery = (query || '').trim().toLowerCase();
  const allProducts = await getCachedProducts(tenantId);

  let filtered = allProducts;

  if (category) {
    filtered = filtered.filter((p) => p.categoria === category.toUpperCase());
  }

  if (cleanQuery) {
    const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 0);

    const scored = filtered
      .map((p) => {
        const fullText = [
          p.titulo,
          p.subtitulo,
          p.nombreCompleto,
          p.sku,
          p.categoria,
          Array.isArray(p.tags) ? p.tags.join(' ') : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 0;

        // Bonificaciones de coincidencia prefijo en título y subtítulo
        if (p.titulo.toLowerCase().startsWith(cleanQuery)) score += 100;
        if (p.subtitulo && p.subtitulo.toLowerCase().startsWith(cleanQuery)) score += 80;
        if (p.titulo.toLowerCase().includes(cleanQuery)) score += 50;
        if (p.subtitulo && p.subtitulo.toLowerCase().includes(cleanQuery)) score += 40;
        if (p.sku && p.sku.toLowerCase().includes(cleanQuery)) score += 60;

        // Bonificación si coinciden todas las palabras clave (multi-token)
        const allTokensMatch = tokens.every((t) => fullText.includes(t));
        if (allTokensMatch) score += 30;

        // Puntuación por cada token individual presente
        const matchedTokensCount = tokens.filter((t) => fullText.includes(t)).length;
        score += matchedTokensCount * 10;

        return { p, score };
      })
      .filter((item) => item.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((item) => item.p);
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
