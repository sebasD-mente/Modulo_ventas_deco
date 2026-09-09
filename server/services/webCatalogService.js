import { prisma } from '../config/prisma.js';

/**
 * Servicio de integración con el catálogo maestro de 233 pósters de la web (PostgreSQL public schema)
 */

/**
 * Busca pósters en la tabla public.posters por título, categoría o tags
 */
export async function searchWebPosters({ query = '', category = null, limit = 24 }) {
  const cleanQuery = query.trim();
  
  let sql = `
    SELECT 
      p.id, 
      p.titulo, 
      p.subtitulo, 
      p.descripcion, 
      p.categoria, 
      p."imageUrl", 
      p."thumbUrl", 
      p."precioMinimo", 
      p."precioDisplay",
      p.tags,
      p.estado
    FROM public.posters p
    WHERE p."isPublished" = true
  `;

  const params = [];
  let paramIdx = 1;

  if (category) {
    sql += ` AND p.categoria = $${paramIdx++}`;
    params.push(category);
  }

  if (cleanQuery) {
    sql += ` AND (
      p.titulo ILIKE $${paramIdx} OR 
      p.subtitulo ILIKE $${paramIdx} OR 
      p.descripcion ILIKE $${paramIdx} OR
      EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE tag ILIKE $${paramIdx})
    )`;
    params.push(`%${cleanQuery}%`);
    paramIdx++;
  }

  sql += ` ORDER BY p.rating DESC NULLS LAST, p."createdAt" DESC LIMIT $${paramIdx};`;
  params.push(limit);

  // Ejecución segura de query tipada en PostgreSQL
  const posters = await prisma.$queryRawUnsafe(sql, ...params);

  // Obtener tamaños y precios para los pósters encontrados
  if (posters.length > 0) {
    const posterIds = posters.map(p => `'${p.id}'`).join(',');
    const sizes = await prisma.$queryRawUnsafe(`
      SELECT "posterId", "sizeId", "nombre", "dimensiones", "precio"
      FROM public.poster_sizes
      WHERE "posterId" IN (${posterIds}) AND "isActive" = true
      ORDER BY "precio" ASC;
    `);

    // Agrupar tamaños por póster
    const sizesMap = {};
    sizes.forEach(s => {
      if (!sizesMap[s.posterId]) sizesMap[s.posterId] = [];
      sizesMap[s.posterId].push({
        sizeId: s.sizeId,
        nombre: s.nombre,
        dimensiones: s.dimensiones,
        precio: Number(s.precio)
      });
    });

    return posters.map(p => ({
      id: p.id,
      titulo: p.titulo,
      subtitulo: p.subtitulo,
      categoria: p.categoria,
      imageUrl: p.imageUrl,
      thumbUrl: p.thumbUrl || p.imageUrl,
      precioMinimo: Number(p.precioMinimo || 25),
      tags: p.tags || [],
      sizes: sizesMap[p.id] || [
        { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 }
      ]
    }));
  }

  return [];
}

/**
 * Obtiene un resumen ligero de todos los pósters para contexto del prompt de Gemini
 */
export async function getAllWebPostersCatalogSummary() {
  const posters = await prisma.$queryRawUnsafe(`
    SELECT p.id, p.titulo, p.categoria, p.tags, p."precioMinimo"
    FROM public.posters p
    WHERE p."isPublished" = true
    ORDER BY p.titulo ASC;
  `);

  return posters.map(p => ({
    id: p.id,
    titulo: p.titulo,
    categoria: p.categoria,
    tags: p.tags || [],
    precioMinimo: Number(p.precioMinimo || 25)
  }));
}

/**
 * Obtiene un póster específico por su ID con todos sus tamaños oficiales
 */
export async function getWebPosterById(posterId) {
  const posters = await prisma.$queryRawUnsafe(`
    SELECT p.id, p.titulo, p.categoria, p."imageUrl", p."thumbUrl", p."precioMinimo", p.tags
    FROM public.posters p
    WHERE p.id = $1 LIMIT 1;
  `, posterId);

  if (!posters || posters.length === 0) return null;
  const poster = posters[0];

  const sizes = await prisma.$queryRawUnsafe(`
    SELECT "sizeId", "nombre", "dimensiones", "precio"
    FROM public.poster_sizes
    WHERE "posterId" = $1 AND "isActive" = true
    ORDER BY "precio" ASC;
  `, posterId);

  return {
    id: poster.id,
    titulo: poster.titulo,
    categoria: poster.categoria,
    imageUrl: poster.imageUrl,
    thumbUrl: poster.thumbUrl || poster.imageUrl,
    precioMinimo: Number(poster.precioMinimo || 25),
    sizes: sizes.map(s => ({
      sizeId: s.sizeId,
      nombre: s.nombre,
      dimensiones: s.dimensiones,
      precio: Number(s.precio)
    }))
  };
}
