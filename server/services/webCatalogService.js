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

// Caché en memoria segmentada por tenant para búsquedas sub-milisegundo en el POS
// Estructura: Map<tenantId, { products: Array, timestamp: number }>
const productCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de TTL
const DEFAULT_TENANT_KEY = '__GLOBAL__';

/**
 * Invalida la caché en memoria para forzar recarga desde prisma.product.
 * Si se especifica tenantId, invalida únicamente ese tenant; de lo contrario limpia toda la caché.
 * @param {string} [tenantId] - Identificador opcional del tenant a invalidar.
 */
export function invalidateCatalogCache(tenantId = null) {
  if (tenantId) {
    productCache.delete(tenantId);
    productCache.delete(DEFAULT_TENANT_KEY);
  } else {
    productCache.clear();
  }
}

/**
 * Normaliza y formatea un producto local de Prisma al contrato esperado por el frontend.
 * @param {object} p - Registro del modelo Product.
 * @returns {object} - Objeto compatible con la UI del POS.
 */
export function formatProductForPos(p) {
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
      { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: '🎵 Vinilo' },
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
  const key = tenantId || DEFAULT_TENANT_KEY;
  const now = Date.now();
  const cachedEntry = productCache.get(key);

  if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
    return cachedEntry.products;
  }

  const where = { isActive: true };
  if (tenantId) where.tenantId = tenantId;

  try {
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const formatted = products.map(formatProductForPos);
    productCache.set(key, { products: formatted, timestamp: now });
    return formatted;
  } catch (err) {
    console.warn('[WebCatalog Warning] ⚠️ No se pudo consultar prisma.product:', err.message);
    if (cachedEntry && cachedEntry.products?.length > 0) return cachedEntry.products;
    // Fallback de desarrollo para pruebas locales
    return [
      {
        id: 'dev-pablo-1',
        titulo: 'Pablo Escobar (Sonrisa / Mugshot)',
        subtitulo: 'Diseño icónico vintage',
        categoria: 'HISTÓRICOS',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample.jpg',
        thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample.jpg',
        precioMinimo: 25,
        tags: ['pablo', 'escobar', 'mugshot', 'vintage'],
        sizes: [
          { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
          { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
          { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
        ],
      },
      {
        id: 'dev-spiderman-1',
        titulo: 'Spider-Man Vintage Comic',
        subtitulo: 'Portada clásica Marvel',
        categoria: 'CÓMICS',
        imageUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
        thumbUrl: 'https://storage.googleapis.com/deko-eventsales-media/sample2.jpg',
        precioMinimo: 25,
        tags: ['spiderman', 'spider-man', 'marvel'],
        sizes: [
          { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
          { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
          { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 },
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
        ],
      },
    ];
  }
}

/**
 * Extrae un slug normalizado e identificador visual a partir de una URL de imagen.
 * Remueve parámetros de consulta, hashes, extensiones y sufijos de dimensiones (ej. -500x750, -thumb).
 * @param {string} url - URL de la imagen del producto.
 * @returns {string|null} - Slug identificador o null si no es válida.
 */
export function extractImageSlug(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  if (!clean) return null;

  try {
    // 1. Quitar query parameters y fragmentos
    const pathname = clean.split('?')[0].split('#')[0];
    // 2. Obtener el nombre del archivo
    let filename = pathname.split('/').filter(Boolean).pop();
    if (!filename) return null;

    // Decodificar si tiene encoding de URL
    try {
      filename = decodeURIComponent(filename);
    } catch {
      // Si falla la decodificación, continuar con el nombre original
    }

    // 3. Quitar extensión (.jpg, .jpeg, .png, .webp, .avif, .svg)
    const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');

    // 4. Normalizar a slug alfanumérico en minúsculas
    let slug = nameWithoutExt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 5. Quitar sufijos comunes de dimensiones o thumbnails para colapsar versiones
    slug = slug.replace(/-\d+x\d+$/, '').replace(/-thumb$/, '').replace(/-preview$/, '');

    return slug || null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el título representativo completo de un póster (artista + subtítulo de obra).
 * @param {object} poster - Objeto del póster.
 * @returns {string} - Título completo crudo.
 */
export function extractPosterTitle(poster) {
  if (!poster || typeof poster !== 'object') return '';
  if (poster.nombreCompleto && typeof poster.nombreCompleto === 'string') {
    return poster.nombreCompleto;
  }
  if (poster.name && typeof poster.name === 'string') {
    return poster.name;
  }
  if (poster.titulo && typeof poster.titulo === 'string') {
    if (poster.subtitulo && typeof poster.subtitulo === 'string') {
      return `${poster.titulo} - ${poster.subtitulo}`;
    }
    return poster.titulo;
  }
  if (poster.title && typeof poster.title === 'string') {
    if (poster.subtitle && typeof poster.subtitle === 'string') {
      return `${poster.title} - ${poster.subtitle}`;
    }
    return poster.title;
  }
  return '';
}

/**
 * Normaliza un título para comparación semántica: minúsculas, sin acentos,
 * sin signos de puntuación y con espacios colapsados.
 * @param {string} rawTitle - Título en texto plano.
 * @returns {string} - Cadena canónica normalizada.
 */
export function normalizePosterTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  return rawTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`´’‘]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplica una lista de pósters aplicando filtrado estricto bicapa:
 * Capa 1: Unicidad por ID / SKU (identidad de base de datos).
 * Capa 2A: Unicidad por imagen (imageSlug visual).
 * Capa 2B: Unicidad por título normalizado completo (identidad semántica de la obra).
 * 
 * Preserva el orden original de relevancia de los resultados.
 *
 * @param {Array} posters - Colección de pósters a procesar.
 * @returns {Array} - Colección sin obras duplicadas.
 */
export function deduplicatePosters(posters) {
  if (!Array.isArray(posters) || posters.length === 0) {
    return [];
  }

  const seenIds = new Set();
  const seenImageSlugs = new Set();
  const seenNormalizedTitles = new Set();
  const deduplicated = [];

  for (const poster of posters) {
    if (!poster || typeof poster !== 'object') continue;

    // 1. Capa 1: Identificador único de registro (id o sku)
    const id = poster.id ? String(poster.id).trim() : (poster.sku ? String(poster.sku).trim() : null);
    const imageSlug = poster.imageSlug || extractImageSlug(poster.imageUrl || poster.thumbUrl);
    const rawTitle = extractPosterTitle(poster);
    const normalizedTitle = normalizePosterTitle(rawTitle);

    // Ignorar objetos vacíos o inválidos que no tengan id, imagen ni título
    if (!id && !imageSlug && !normalizedTitle) {
      continue;
    }

    if (id && seenIds.has(id)) {
      continue;
    }

    // 2. Capa 2A: Identidad visual de la obra (imageSlug)
    if (imageSlug && seenImageSlugs.has(imageSlug)) {
      continue;
    }

    // 3. Capa 2B: Identidad semántica de la obra (normalizedTitle completo)
    if (normalizedTitle && seenNormalizedTitles.has(normalizedTitle)) {
      continue;
    }

    // Si pasó todos los filtros, registrar en los Sets y agregar al resultado
    if (id) seenIds.add(id);
    if (imageSlug) seenImageSlugs.add(imageSlug);
    if (normalizedTitle) seenNormalizedTitles.add(normalizedTitle);

    deduplicated.push(poster);
  }

  return deduplicated;
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
  const cleanQuery = String(query ?? '').trim().toLowerCase();
  const allProducts = await getCachedProducts(tenantId);

  let filtered = allProducts;

  if (category && String(category).trim()) {
    filtered = filtered.filter((p) => p.categoria === String(category).trim().toUpperCase());
  }

  if (cleanQuery) {
    const normalize = (str) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .trim();

    const alphaOnly = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normQuery = normalize(cleanQuery);
    const alphaQuery = alphaOnly(cleanQuery);

    const rawTokens = normQuery.split(/\s+/).filter((t) => t.length > 0);
    const STOP_WORDS = new Set([
      'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'unos', 'unas',
      'con', 'por', 'para', 'cuanto', 'cuánto', 'cuesta', 'cuestan', 'precio',
      'precios', 'tienen', 'tienes', 'hay', 'que', 'del', 'al', 'o', 'poster',
      'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseño', 'diseños',
      'hola', 'buenas', 'buenos'
    ]);
    const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
    const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

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
          .join(' ');

        const normFullText = normalize(fullText);
        const alphaFullText = alphaOnly(fullText);

        let score = 0;

        // Bonificaciones de coincidencia directa o normalizada
        if (normFullText.startsWith(normQuery)) score += 100;
        if (p.titulo.toLowerCase().startsWith(cleanQuery)) score += 100;
        if (normFullText.includes(normQuery)) score += 60;
        if (alphaQuery.length >= 3 && alphaFullText.includes(alphaQuery)) score += 50;
        if (p.sku && p.sku.toLowerCase().includes(cleanQuery)) score += 60;

        // Bonificación si coinciden todas las palabras clave (multi-token)
        const allTokensMatch = tokens.every((t) => normFullText.includes(t));
        if (allTokensMatch) score += 30;

        // Puntuación por cada token individual presente
        const matchedTokensCount = tokens.filter((t) => normFullText.includes(t)).length;
        score += matchedTokensCount * 10;

        return { p, score };
      })
      .filter((item) => item.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const sortedProducts = scored.map((item) => item.p);
    const deduplicated = deduplicatePosters(sortedProducts);
    return deduplicated.slice(0, limit);
  }

  const deduplicated = deduplicatePosters(filtered);
  return deduplicated.slice(0, limit);
}

/**
 * Obtiene un resumen ligero de todos los pósters locales para contexto de prompts de IA.
 * @param {string} [tenantId] - Filtro opcional por tenant.
 * @returns {Promise<Array>} - Lista resumida { id, titulo, categoria, tags, precioMinimo }.
 */
export async function getAllWebPostersCatalogSummary(tenantId = null) {
  const products = await getCachedProducts(tenantId);
  const deduplicated = deduplicatePosters(products);

  return deduplicated.map((p) => ({
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
 * @param {string} [tenantId] - Identificador opcional del tenant para aislamiento estricto.
 * @returns {Promise<object|null>} - Detalle del póster o null si no se encuentra.
 */
export async function getWebPosterById(posterId, tenantId = null) {
  if (!posterId) return null;

  // Si se especificó tenantId, SOLO buscar en la partición de ese tenant específico.
  // NUNCA iterar sobre las cachés de otros tenants para evitar fuga multitenant.
  if (tenantId) {
    if (productCache.has(tenantId)) {
      const entry = productCache.get(tenantId);
      const cached = entry?.products?.find(
        (p) => p.id === posterId || p.sku === posterId || p.sku === `WEB-${posterId}`
      );
      if (cached) return cached;
    }
  } else {
    // Únicamente si tenantId es null/undefined se permite iterar el mapa global de cachés
    for (const entry of productCache.values()) {
      const cached = entry?.products?.find(
        (p) => p.id === posterId || p.sku === posterId || p.sku === `WEB-${posterId}`
      );
      if (cached) return cached;
    }
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: posterId },
          { sku: posterId },
          { sku: `WEB-${posterId}` },
        ],
        isActive: true,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (!product) return null;

    return formatProductForPos(product);
  } catch (err) {
    console.warn('[WebCatalog Warning] ⚠️ No se pudo consultar prisma.product en getWebPosterById:', err.message);
    return null;
  }
}

// Alias de compatibilidad
export const searchPosters = searchWebPosters;
export const getCatalogPosters = searchWebPosters;
